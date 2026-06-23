import { useEffect, useRef, useState, type ChangeEvent, type DragEvent, type PointerEvent, type CSSProperties } from 'react';
import { Icon } from '../../lib/icons';
import { WebcamCapture } from './WebcamCapture';
import { ZOOM_MIN, ZOOM_MAX, clampView, imgStyle, bakeCrop, type View, type Frame } from './cropMath';
// Same demo photos the landing's example Face/Outfit cards use, reused as the
// "Use a sample" images so the sample reads as a real scan, not a placeholder.
import exampleFace from '../../assets/example-face.jpg';
import exampleFit from '../../assets/example-fit.jpg';

const SAMPLE_PHOTO: Record<ZoneKind, string> = { face: exampleFace, outfit: exampleFit };

export type ZoneKind = 'face' | 'outfit';
type Status = 'empty' | 'uploading' | 'ready' | 'error';
type ErrorType = 'invalid';

const ACCEPT_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
const ACCEPT_LABEL = ['JPG', 'PNG', 'WEBP', 'HEIC'];

interface CropSpec {
  frame: Frame;
  ratioLabel: string;
  out: { w: number; h: number };
}
// Any image size is accepted — the crop is always re-baked to `out`, so the
// original dimensions/file size don't affect what gets scanned.
const CROP: Record<ZoneKind, CropSpec> = {
  face: { frame: { w: 220, h: 220 }, ratioLabel: '1:1', out: { w: 640, h: 640 } },
  outfit: { frame: { w: 230, h: 306 }, ratioLabel: '3:4', out: { w: 900, h: 1200 } },
};

const ERR: Record<ErrorType, { title: string; msg: (k: ZoneKind) => string }> = {
  invalid: { title: 'Unsupported file', msg: () => "We can read JPG, PNG, WEBP or HEIC. That file isn't an image we support." },
};

interface UploadZoneProps {
  kind: ZoneKind;
  mobile?: boolean;
  missing?: boolean;
  /**
   * Override the uploaded-image crop frame (display px). Only resizes the live
   * crop preview — the empty dropzone is untouched. `out` is re-derived to match
   * the override's aspect ratio so the baked image is never distorted. Used by
   * the wider Versus cards (taller width, shorter height than Solo's defaults).
   */
  frame?: Frame;
  /** Fires with the baked crop data URL when confirmed, or null when removed. */
  onConfirm: (url: string | null) => void;
  /** Fires whenever the zone has/loses a (not-yet-confirmed) image. */
  onReadyChange?: (ready: boolean) => void;
}

export function UploadZone({ kind, mobile, missing, frame: frameOverride, onConfirm, onReadyChange }: UploadZoneProps) {
  const spec = CROP[kind];
  const frame: Frame = frameOverride ?? spec.frame;
  // Keep the baked output at the frame's aspect ratio (else drawImage stretches it).
  const out = frameOverride
    ? { w: spec.out.w, h: Math.round((spec.out.w * frameOverride.h) / frameOverride.w) }
    : spec.out;

  const [status, setStatus] = useState<Status>('empty');
  const [errorType, setErrorType] = useState<ErrorType | null>(null);
  const [src, setSrc] = useState<{ url: string; w: number; h: number; name: string } | null>(null);
  const [view, setView] = useState<View>({ zoom: 1, x: 0, y: 0 });
  const [progress, setProgress] = useState(0);
  const [over, setOver] = useState(false);
  const [capturing, setCapturing] = useState(false);

  const imgElRef = useRef<HTMLImageElement | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const cropRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef(view);
  viewRef.current = view;
  const fileInfo = useRef('');
  const cancelTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  // The current blob: object URL, so we can revoke it on replace/remove/unmount.
  const objUrlRef = useRef<string | null>(null);
  const revokeObjUrl = () => {
    if (objUrlRef.current) {
      URL.revokeObjectURL(objUrlRef.current);
      objUrlRef.current = null;
    }
  };

  useEffect(() => {
    onReadyChange?.(status === 'ready');
  }, [status, onReadyChange]);

  // Live crop: re-bake the committed image whenever the framing settles, so
  // drag/zoom tweaks apply automatically — no "Looks good" confirm step. Debounced
  // so a drag/pinch bakes once on release, not every frame.
  useEffect(() => {
    if (status !== 'ready' || !imgElRef.current) return;
    const im = imgElRef.current;
    const id = setTimeout(() => bakeAndConfirm(im, view), 200);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, status]);

  // Revoke any outstanding object URL when the zone unmounts.
  useEffect(() => () => revokeObjUrl(), []);

  function setClamped(v: View) {
    if (src) setView(clampView(v, src, frame));
  }

  function reset() {
    if (cancelTimer.current) clearInterval(cancelTimer.current);
    revokeObjUrl();
    setStatus('empty');
    setErrorType(null);
    setSrc(null);
    imgElRef.current = null;
    setView({ zoom: 1, x: 0, y: 0 });
    setProgress(0);
    onConfirm(null);
  }

  function loadImageEl(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = reject;
      im.src = url;
    });
  }

  async function ingest(file: File) {
    if (cancelTimer.current) clearInterval(cancelTimer.current);
    revokeObjUrl(); // free the previous photo's object URL before replacing it
    fileInfo.current = `${file.name} · ${(file.size / (1024 * 1024)).toFixed(1)} MB`;
    if (!ACCEPT_MIME.includes(file.type)) {
      setStatus('error');
      setErrorType('invalid');
      return;
    }
    const url = URL.createObjectURL(file);
    let im: HTMLImageElement;
    try {
      im = await loadImageEl(url);
    } catch {
      setStatus('error');
      setErrorType('invalid');
      URL.revokeObjectURL(url);
      return;
    }
    const w = im.naturalWidth;
    const h = im.naturalHeight;
    objUrlRef.current = url; // decoded OK — track for later revocation
    runProgress(() => {
      const v = clampView({ zoom: 1, x: 0, y: 0 }, { w, h }, frame);
      imgElRef.current = im;
      setSrc({ url, w, h, name: fileInfo.current });
      setView(v);
      setStatus('ready');
      // Register the photo immediately at its default crop — the scan is unlocked
      // as soon as both photos are in. Drag/zoom tweaks then re-bake live.
      bakeAndConfirm(im, v);
    });
  }

  function bakeAndConfirm(im: HTMLImageElement, v: View) {
    const url = bakeCrop(im, v, frame, out);
    if (url) onConfirm(url);
  }

  function runProgress(done: () => void) {
    setStatus('uploading');
    setProgress(0);
    let p = 0;
    cancelTimer.current = setInterval(() => {
      p += Math.random() * 16 + 9;
      if (p >= 100) {
        clearInterval(cancelTimer.current!);
        cancelTimer.current = null;
        setProgress(100);
        setTimeout(done, 180);
      } else {
        setProgress(p);
      }
    }, 90);
  }

  async function loadSample() {
    revokeObjUrl(); // drop any prior file's object URL before switching to the sample
    const url = SAMPLE_PHOTO[kind];
    const im = await loadImageEl(url);
    const s = { url, w: im.naturalWidth, h: im.naturalHeight };
    fileInfo.current = (kind === 'face' ? 'selfie' : 'outfit') + '.jpg · sample';
    runProgress(() => {
      const v = clampView({ zoom: 1, x: 0, y: 0 }, s, frame);
      imgElRef.current = im;
      setSrc({ ...s, name: fileInfo.current });
      setView(v);
      setStatus('ready');
      bakeAndConfirm(im, v);
    });
  }

  function onPick(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) ingest(f);
    e.target.value = '';
  }

  /* drag & drop */
  const depth = useRef(0);
  function dragEnter(e: DragEvent) {
    e.preventDefault();
    depth.current++;
    setOver(true);
  }
  function dragOver(e: DragEvent) {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
  }
  function dragLeave(e: DragEvent) {
    e.preventDefault();
    if (--depth.current <= 0) {
      depth.current = 0;
      setOver(false);
    }
  }
  function drop(e: DragEvent) {
    e.preventDefault();
    depth.current = 0;
    setOver(false);
    const f = e.dataTransfer?.files?.[0];
    if (f) ingest(f);
  }

  /* crop interaction */
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ d: number; zoom: number } | null>(null);
  const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

  function onPointerDown(e: PointerEvent) {
    if (status !== 'ready') return;
    cropRef.current?.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const pts = [...pointers.current.values()];
      pinch.current = { d: dist(pts[0], pts[1]), zoom: viewRef.current.zoom };
    }
  }
  function onPointerMove(e: PointerEvent) {
    if (!pointers.current.has(e.pointerId)) return;
    const prev = pointers.current.get(e.pointerId)!;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size >= 2 && pinch.current) {
      const pts = [...pointers.current.values()];
      const d = dist(pts[0], pts[1]);
      const z = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, pinch.current.zoom * (d / pinch.current.d)));
      setClamped({ ...viewRef.current, zoom: z });
    } else if (pointers.current.size === 1) {
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      setClamped({ ...viewRef.current, x: viewRef.current.x + dx, y: viewRef.current.y + dy });
    }
  }
  function onPointerUp(e: PointerEvent) {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  }

  function setZoom(z: number) {
    setClamped({ ...viewRef.current, zoom: z });
  }
  function nudgeZoom(d: number) {
    setZoom(Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, viewRef.current.zoom + d)));
  }
  function resetCrop() {
    if (src) setView(clampView({ zoom: 1, x: 0, y: 0 }, src, frame));
  }

  const label = kind === 'face' ? 'Face photo' : 'Outfit photo';
  const num = kind === 'face' ? '01' : '02';
  const KindIcon = kind === 'face' ? Icon.face : Icon.hanger;

  return (
    <div
      className="zone"
      data-kind={kind}
      data-status={status}
      data-over={over}
      onDragEnter={dragEnter}
      onDragOver={dragOver}
      onDragLeave={dragLeave}
      onDrop={drop}
    >
      <div className="zone-head">
        <span className="kind">
          <span className="n">{num}</span>
          {label}
        </span>
        {status === 'ready' ? (
          <span className="state-badge ok">
            <Icon.check /> Ready
          </span>
        ) : (
          <span className="req">Required</span>
        )}
      </div>

      {status === 'empty' && capturing && (
        <WebcamCapture
          onCapture={(file) => { setCapturing(false); ingest(file); }}
          onCancel={() => setCapturing(false)}
        />
      )}

      {status === 'empty' && !capturing && (
        <>
          <div
            className="zone-drop"
            data-missing={missing ? 'true' : 'false'}
            style={missing ? { borderColor: 'var(--red)', background: 'color-mix(in oklab, var(--red) 8%, transparent)' } : undefined}
            onClick={() => inputRef.current?.click()}
          >
            <span className="ic">
              <KindIcon />
            </span>
            <span className="big">{kind === 'face' ? 'Drop your selfie' : 'Drop your outfit shot'}</span>
            <span className="or">
              or <u>browse files</u>
            </span>
            <button
              type="button"
              className="sample"
              onClick={(e) => {
                e.stopPropagation();
                loadSample();
              }}
            >
              Use a sample
            </button>
            {kind === 'face' && !mobile && (
              <button
                type="button"
                className="sample"
                onClick={(e) => {
                  e.stopPropagation();
                  setCapturing(true);
                }}
              >
                Take photo
              </button>
            )}
          </div>
          {missing && (
            <div className="crop-note warn" style={{ marginTop: 12 }}>
              <Icon.alert />
              <span>Add your {kind === 'face' ? 'face' : 'outfit'} photo to run the scan.</span>
            </div>
          )}
          <div className="zone-guide">
            <div className="zone-accept">
              {ACCEPT_LABEL.map((f, i) => (
                <span key={f}>
                  <span className="fmt">{f}</span>
                  {i < ACCEPT_LABEL.length - 1 && <span className="sep">·</span>}
                </span>
              ))}
              <span className="sep">·</span>
              <span>any size</span>
            </div>
            <ul className="zone-tips">
              {(kind === 'face'
                ? ['Front-facing, head & shoulders', 'Even light, no heavy shadow', 'Just you, solo shot']
                : ['Full outfit, head to shoes', 'Stand back, plain background', 'Mirror or full-length is perfect']
              ).map((t) => (
                <li key={t}>
                  <Icon.check />
                  {t}
                </li>
              ))}
              <li className="bad">
                <Icon.x />
                {kind === 'face' ? 'No group shots or sunglasses' : 'No close-ups or cropped legs'}
              </li>
            </ul>
          </div>
          <input ref={inputRef} type="file" accept={ACCEPT_MIME.join(',')} hidden onChange={onPick} />
        </>
      )}

      {status === 'uploading' && (
        <div className="zone-prog">
          <div className="meta">Uploading</div>
          <div className="fname">{fileInfo.current}</div>
          <div className="track">
            <div className="fill" style={{ width: `${progress}%` }} />
          </div>
          <div className="meta">{Math.round(progress)}%</div>
          <button className="cancel" onClick={reset}>
            Cancel
          </button>
        </div>
      )}

      {status === 'error' && errorType && (
        <>
          <div className="zone-err">
            <span className="ic">
              <Icon.alert />
            </span>
            <span className="title">{ERR[errorType].title}</span>
            <span className="msg">{ERR[errorType].msg(kind)}</span>
          </div>
          <div className="crop-ctrls" style={{ marginTop: 12 }}>
            <button className="cbtn" onClick={() => inputRef.current?.click()}>
              <Icon.upload /> Choose another
            </button>
          </div>
          <input ref={inputRef} type="file" accept={ACCEPT_MIME.join(',')} hidden onChange={onPick} />
        </>
      )}

      {status === 'ready' && src && (
        <div className="crop-wrap">
          <div className="crop-stageline">
            {kind === 'face' ? 'Center your face in the ring' : 'Fit your whole outfit in the frame'}
          </div>
          <div
            ref={cropRef}
            className={'crop ' + kind}
            style={frameOverride ? { width: frame.w, height: frame.h } : undefined}
            data-panning={pointers.current.size > 0}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            <img src={src.url} alt="" draggable={false} style={imgStyle(view, src, frame)} />
            <div className="guide">
              <span className="label">{kind === 'face' ? 'Keep eyes inside' : 'Keep head & shoes inside'}</span>
            </div>
            <div className="grip">
              <span className="pill">
                {mobile ? <Icon.pinch /> : <Icon.move />}
                {mobile ? 'Pinch · drag' : 'Drag to reposition'}
              </span>
            </div>
          </div>

          <div className="zoom-row">
            <button className="zbtn" onClick={() => nudgeZoom(-0.2)} aria-label="Zoom out">
              <Icon.minus />
            </button>
            <input
              type="range"
              min={ZOOM_MIN}
              max={ZOOM_MAX}
              step="0.01"
              value={view.zoom}
              style={{ ['--p']: `${((view.zoom - ZOOM_MIN) / (ZOOM_MAX - ZOOM_MIN)) * 100}%` } as CSSProperties}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
            />
            <button className="zbtn" onClick={() => nudgeZoom(0.2)} aria-label="Zoom in">
              <Icon.plus />
            </button>
          </div>

          <div className="crop-note">
            <Icon.info />
            <span>
              {mobile ? 'Pinch to zoom, drag to reposition.' : 'Drag the photo or use zoom.'} Your framing applies
              automatically.
            </span>
          </div>

          <div className="crop-ctrls">
            <button className="cbtn" onClick={resetCrop}>
              <Icon.reset /> Reset
            </button>
            <button className="cbtn" onClick={() => inputRef.current?.click()}>
              <Icon.swap /> Replace
            </button>
            <button className="cbtn danger" onClick={reset}>
              <Icon.trash /> Remove
            </button>
          </div>
          <input ref={inputRef} type="file" accept={ACCEPT_MIME.join(',')} hidden onChange={onPick} />
        </div>
      )}
    </div>
  );
}
