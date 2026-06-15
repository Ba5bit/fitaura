import { useCallback, useEffect, useRef, useState, type TouchEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  STICKER_BANK,
  stickerFromPreset,
  VERDICT_COLOR_VAR,
  type ReceiptPaper,
  type StickerData,
} from '@fitaura/shared';
import { FaceCard, OutfitCard, Receipt } from '../../components/cards';
import { StickerLayer } from '../../components/cards/StickerLayer';
import { ReceiptStampEditor } from '../../components/cards/ReceiptStampEditor';
import { StaticSticker, StaticStamp } from '../../components/cards/ExportOverlays';
import {
  FaceAnalysisBlock,
  OutfitAnalysisBlock,
  ReceiptSummaryBlock,
} from '../../components/analysis';
import { Icon } from '../../lib/icons';
import { receiptDateTime } from '../../lib/format';
import { renderCardBlob, downloadResult, shareResult } from '../../lib/exportCard';
import { CARD_GEOM, RECEIPT_PRESETS, type Point } from './stickerGeometry';
import { useGeneration } from '../../state/generation';
import { useAccount } from '../account/AccountContext';
import { ProfileMenu } from '../account/ProfileMenu';
import { useLocalStorage } from '../../state/useLocalStorage';
import '../../design/result-shell.css';
import '../../design/sticker-studio.css';

type Kind = 'face' | 'outfit' | 'receipt';
const TABS: { id: number; slug: Kind; name: string; n: string }[] = [
  { id: 0, slug: 'face', name: 'FACE', n: '01' },
  { id: 1, slug: 'outfit', name: 'OUTFIT', n: '02' },
  { id: 2, slug: 'receipt', name: 'RECEIPT', n: '03' },
];

function slugToTab(slug: string): number | null {
  const i = TABS.findIndex((t) => t.slug === slug);
  return i < 0 ? null : i;
}

export function Result() {
  const navigate = useNavigate();
  const { result, startNewScan, hydrated } = useGeneration();
  const { credits } = useAccount();

  // No result yet → back to the start. Wait for hydration so a reload at /result
  // doesn't bounce home before IndexedDB has loaded the current result.
  useEffect(() => {
    if (hydrated && !result) navigate('/', { replace: true });
  }, [hydrated, result, navigate]);

  const initialTab = (() => {
    const fromHash = slugToTab((location.hash || '').replace('#', ''));
    if (fromHash != null) return fromHash;
    const stored = slugToTab(localStorage.getItem('fitaura.tab') || '');
    return stored != null ? stored : 0;
  })();

  const [tab, setTabRaw] = useState(initialTab);
  const [editing, setEditing] = useState(false);
  const [paper, setPaper] = useLocalStorage<ReceiptPaper>('fitaura.paper', 'neon');
  const [stickerOn, setStickerOn] = useLocalStorage('fitaura.stickerOn', true);
  const [toast, setToast] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);

  // Per-kind selected sticker index into STICKER_BANK.
  const [stk, setStk] = useState<{ face: number; outfit: number }>({ face: 0, outfit: 0 });
  // Per-kind sticker position (normalized) + receipt stamp preset — the
  // customization state ported from the Card Studio, now part of this page.
  const [pos, setPos] = useState<{ face: Point; outfit: Point }>({
    face: { ...CARD_GEOM.face.def },
    outfit: { ...CARD_GEOM.outfit.def },
  });
  const [receiptPreset, setReceiptPreset] = useState<string | null>('tr');

  // Offscreen full-scale render hosts used purely for WYSIWYG export. Mounted
  // only while an export is in flight (see `withExportHost`) so the Result page
  // doesn't carry three extra full card trees at all times.
  const exportRefs = {
    face: useRef<HTMLDivElement>(null),
    outfit: useRef<HTMLDivElement>(null),
    receipt: useRef<HTMLDivElement>(null),
  };
  const exportHostRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  const ping = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }, []);

  const setTab = useCallback((next: number) => {
    const n = Math.max(0, Math.min(TABS.length - 1, next));
    setTabRaw(n);
    setEditing(false);
    const slug = TABS[n].slug;
    if (location.hash.replace('#', '') !== slug) history.replaceState(null, '', '#' + slug);
    localStorage.setItem('fitaura.tab', slug);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Apply the verdict color from the result. NB: do NOT set `--receipt-bg` on the
  // document root — the thermal receipt gets its cream paper from the scoped
  // `.receipt[data-style="thermal"]` rule, and a global set here leaks onto other
  // pages (e.g. the Landing's neon receipts would turn cream).
  useEffect(() => {
    if (!result) return;
    document.documentElement.style.setProperty('--verdict', VERDICT_COLOR_VAR[result.verdict]);
  }, [result]);

  // Keyboard nav — arrows change tabs, except while editing (arrows nudge the
  // sticker). Esc exits edit mode.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (e.key === 'Escape' && editing) {
        setEditing(false);
        return;
      }
      if (editing) return;
      if (target.closest?.('input,textarea,select')) return;
      if (e.key === 'ArrowRight') setTab(tab + 1);
      if (e.key === 'ArrowLeft') setTab(tab - 1);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [tab, setTab, editing]);

  // Swipe nav on the asset frame (disabled while editing so drags don't flip tabs).
  const touch = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: TouchEvent) => {
    if (editing) return;
    const t = e.touches[0];
    touch.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: TouchEvent) => {
    if (!touch.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touch.current.x;
    const dy = t.clientY - touch.current.y;
    if (Math.abs(dx) > 52 && Math.abs(dx) > Math.abs(dy) * 1.4) setTab(tab + (dx < 0 ? 1 : -1));
    touch.current = null;
  };

  // Card auto-scale (fit width on mobile, fit the sticky column on desktop).
  useEffect(() => {
    const fit = () => {
      const frame = frameRef.current;
      if (!frame) return;
      const vw = window.innerWidth;
      const colW = vw > 1000 ? 440 : Math.min(560, vw) - 36;
      let s = Math.min(1, (colW - 4) / 360);
      if (vw > 1000) {
        const stickyTop = 62 + 66 + 26;
        const reserve = 210;
        const availH = window.innerHeight - stickyTop - reserve;
        s = Math.min(s, availH / 640);
      }
      s = Math.max(0.6, Math.min(1, s));
      frame.style.setProperty('--rs-scale', s.toFixed(3));
    };
    fit();
    window.addEventListener('resize', fit);
    const id = setTimeout(fit, 120);
    return () => {
      window.removeEventListener('resize', fit);
      clearTimeout(id);
    };
  }, [tab]);

  if (!result) return null;

  const tabDef = TABS[tab];
  const kind = tabDef.slug;

  const facePreset = STICKER_BANK.face[stk.face];
  const outfitPreset = STICKER_BANK.outfit[stk.outfit];
  const faceSticker: StickerData = stickerFromPreset(facePreset, !stickerOn);
  const outfitSticker: StickerData = stickerFromPreset(outfitPreset, !stickerOn);

  const swapSticker = () => {
    if (kind === 'receipt') return;
    setStk((s) => ({ ...s, [kind]: (s[kind] + 1) % STICKER_BANK[kind].length }));
  };
  const pickSticker = (i: number) => {
    if (kind === 'receipt') return;
    setStk((s) => ({ ...s, [kind]: i }));
  };
  const resetPosition = () => {
    if (kind === 'receipt') {
      setReceiptPreset('tr');
    } else {
      setPos((p) => ({ ...p, [kind]: { ...CARD_GEOM[kind as 'face' | 'outfit'].def } }));
    }
    ping('Position reset');
  };

  const flashSaved = () => {
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1600);
  };

  const captureKind = async (k: Kind) => {
    const el = exportRefs[k].current;
    if (!el) return null;
    return renderCardBlob({ el, kind: k, verdict: result.verdict });
  };

  // Mount the offscreen export hosts, wait for them to paint + their images to
  // decode, run the capture(s), then unmount. Avoids keeping the hosts mounted
  // on the Result page when no export is happening.
  const withExportHost = async <T,>(fn: () => Promise<T>): Promise<T> => {
    setExporting(true);
    try {
      await new Promise<void>((res) => requestAnimationFrame(() => requestAnimationFrame(() => res())));
      const host = exportHostRef.current;
      if (host) {
        const imgs = Array.from(host.querySelectorAll('img'));
        await Promise.all(
          imgs.map((im) =>
            im.complete
              ? Promise.resolve()
              : new Promise<void>((r) => {
                  im.onload = im.onerror = () => r();
                }),
          ),
        );
      }
      return await fn();
    } finally {
      setExporting(false);
    }
  };

  const download = async () => {
    try {
      const out = await withExportHost(() => captureKind(kind));
      if (!out) return;
      downloadResult(out);
      ping(`Saved ${tabDef.name.toLowerCase()} card to device`);
      flashSaved();
    } catch {
      ping('Export failed — try again');
    }
  };
  const share = async () => {
    try {
      const out = await withExportHost(() => captureKind(kind));
      if (!out) return;
      const res = await shareResult(out);
      if (res === 'shared') ping('Shared');
      else if (res === 'downloaded') {
        ping('Saved to device · share from there');
        flashSaved();
      }
    } catch {
      ping('Share failed — try again');
    }
  };
  const exportAll = async () => {
    ping('Exporting all 3 cards…');
    try {
      await withExportHost(async () => {
        for (const k of ['face', 'outfit', 'receipt'] as const) {
          const out = await captureKind(k);
          if (out) downloadResult(out);
        }
      });
      flashSaved();
      ping('Saved all 3 cards to device');
    } catch {
      ping('Export failed — try again');
    }
  };
  const saveHistory = () => {
    ping('Saved to history on this device');
    flashSaved();
  };
  const newScan = () => {
    startNewScan();
    navigate('/scan');
  };

  const faceContent = { ...result.face.card, sticker: faceSticker };
  const outfitContent = { ...result.outfit.card, sticker: outfitSticker };

  // Visible asset (built-in sticker/seal off — the editable layer renders it).
  const assetEl =
    kind === 'face' ? (
      <FaceCard content={faceContent} stickerOn={false} run />
    ) : kind === 'outfit' ? (
      <OutfitCard content={outfitContent} stickerOn={false} run />
    ) : (
      <Receipt content={result.receipt} paper={paper} sealOn={false} />
    );

  const overlayEl =
    kind === 'face' ? (
      <StickerLayer
        kind="face"
        sticker={facePreset}
        pos={pos.face}
        setPos={(p) => setPos((s) => ({ ...s, face: p }))}
        editing={editing}
        hidden={!stickerOn}
      />
    ) : kind === 'outfit' ? (
      <StickerLayer
        kind="outfit"
        sticker={outfitPreset}
        pos={pos.outfit}
        setPos={(p) => setPos((s) => ({ ...s, outfit: p }))}
        editing={editing}
        hidden={!stickerOn}
      />
    ) : (
      <ReceiptStampEditor preset={receiptPreset} setPreset={setReceiptPreset} editing={editing} />
    );

  const animKey = `${kind}-${result.verdict}`;
  const analysisEl =
    kind === 'face' ? (
      <FaceAnalysisBlock key={animKey} face={result.face} verdict={result.verdict} run />
    ) : kind === 'outfit' ? (
      <OutfitAnalysisBlock key={animKey} outfit={result.outfit} run />
    ) : (
      <ReceiptSummaryBlock
        key={animKey}
        receipt={result.receipt}
        onExportAll={exportAll}
        onShare={share}
        onSaveHistory={saveHistory}
        onNewScan={newScan}
      />
    );

  const currentSticker = kind === 'face' ? faceSticker : outfitSticker;

  return (
    <div className={'rs-app' + (editing ? ' editing' : '')}>
      {/* HEADER */}
      <header className="rs-header">
        <div className="rs-h-left">
          <button
            type="button"
            className="rs-brand"
            onClick={() => navigate('/')}
            aria-label="FITAURA — back to home"
            title="Back to home"
          >
            <span className="dot" />
            <span className="rs-wm">FITAURA</span>
          </button>
          <div className="rs-divider" />
          <div className="rs-resultlabel">
            RESULT · <b>NO. {result.receipt.generationId}</b>
            <br />
            {receiptDateTime(result.producedAt)}
          </div>
          <div className="verdict-chip" style={{ marginLeft: 6 }}>
            <span className="pulse" />
            {result.chip}
          </div>
        </div>
        <div className="rs-h-right">
          <div className={'rs-saved' + (savedFlash ? ' flash' : '')}>
            <span className="led" />
            <span>{savedFlash ? 'SAVED ✓' : 'SAVED TO DEVICE'}</span>
          </div>
          <button className="rs-credits" onClick={() => navigate('/credits')}>
            <Icon.credit />
            <b>{credits}</b> left
          </button>
          <div className="rs-h-actions" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button className="rs-newscan" onClick={() => navigate('/vault')}>
              <Icon.grid />
              <span>Vault</span>
            </button>
            <button className="rs-newscan" onClick={newScan}>
              <Icon.plus />
              <span>New scan</span>
            </button>
            <ProfileMenu avatarClassName="rs-avatar" />
          </div>
        </div>
      </header>

      {/* NAV */}
      <nav className="rs-nav">
        <div className="rs-tabs" role="tablist">
          {TABS.map((tb) => (
            <button
              key={tb.id}
              className="tab"
              role="tab"
              aria-selected={tab === tb.id}
              onClick={() => setTab(tb.id)}
            >
              <span className="n">{tb.n}</span>
              {tb.name}
            </button>
          ))}
        </div>
        <div className="rs-stepper">
          <span className="rs-count">
            <b>{tabDef.n}</b> / 03
          </span>
          <button className="rs-arrow" onClick={() => setTab(tab - 1)} disabled={tab === 0} aria-label="Previous">
            <Icon.chevronLeft />
          </button>
          <button className="rs-arrow" onClick={() => setTab(tab + 1)} disabled={tab === 2} aria-label="Next">
            <Icon.chevronRight />
          </button>
        </div>
      </nav>

      {/* STAGE */}
      <main className="rs-stage">
        <div className="rs-asset">
          <div
            className={'rs-frame' + (editing ? ' editing' : '')}
            ref={frameRef}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            <div className="rs-frame-inner">
              <div className="rs-card-mount" data-paper={paper} data-verdict={result.verdict}>
                {editing && (
                  <div className="st-edithint">
                    {kind === 'receipt' ? 'PICK A POSITION' : 'DRAG'} · <kbd>←↑↓→</kbd> nudge · <kbd>Esc</kbd> done
                  </div>
                )}
                {assetEl}
                {overlayEl}
              </div>
            </div>
          </div>

          {/* contextual controls — image cards */}
          {!editing && kind !== 'receipt' && (
            <div className="rs-controlbar">
              <span className="rs-cb-label">Sticker</span>
              <span className="rs-cb-current">
                <i style={{ background: 'var(--accent)' }} />
                {currentSticker.label}
              </span>
              <span className="rs-cb-spacer" />
              <button className="rs-cb-btn" onClick={swapSticker}>
                <Icon.swap />
                Swap
              </button>
              <button className={'rs-cb-btn' + (stickerOn ? ' on' : '')} onClick={() => setStickerOn(!stickerOn)}>
                <Icon.eye />
                {stickerOn ? 'Shown' : 'Hidden'}
              </button>
              <button className="rs-cb-btn" onClick={() => setEditing(true)} disabled={!stickerOn}>
                <Icon.move />
                Reposition
              </button>
            </div>
          )}

          {/* contextual controls — receipt */}
          {!editing && kind === 'receipt' && (
            <div className="rs-controlbar">
              <span className="rs-cb-label">Paper</span>
              <div className="rs-seg">
                <button aria-pressed={paper === 'neon'} onClick={() => setPaper('neon')}>
                  Dark neon
                </button>
                <button aria-pressed={paper === 'thermal'} onClick={() => setPaper('thermal')}>
                  Thermal
                </button>
              </div>
              <span className="rs-cb-spacer" />
              <button
                className={'rs-cb-btn' + (receiptPreset ? ' on' : '')}
                onClick={() => setReceiptPreset(receiptPreset ? null : 'tr')}
              >
                <Icon.star />
                {receiptPreset ? 'Stamp on' : 'Stamp off'}
              </button>
              <button className="rs-cb-btn" onClick={() => setEditing(true)}>
                <Icon.move />
                Reposition
              </button>
            </div>
          )}

          {/* edit-mode panel — image cards: sticker picker + reposition help */}
          {editing && kind !== 'receipt' && (
            <div className="rs-editpanel">
              <div className="eh">
                <span className="t">EDIT STICKER · {kind.toUpperCase()}</span>
                <button className={'rs-cb-btn' + (stickerOn ? ' on' : '')} onClick={() => setStickerOn(!stickerOn)}>
                  {stickerOn ? 'Visible' : 'Hidden'}
                </button>
              </div>
              <div className="rs-stickergrid">
                {STICKER_BANK[kind].map((s, i) => (
                  <button
                    key={s.id}
                    className="rs-stickeropt"
                    aria-pressed={stk[kind] === i}
                    onClick={() => {
                      pickSticker(i);
                      if (!stickerOn) setStickerOn(true);
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <div className="erow">
                <button className="ctrl" onClick={resetPosition}>
                  <Icon.reset />
                  Reset position
                </button>
                <button
                  className="ctrl primary"
                  onClick={() => {
                    setEditing(false);
                    ping('Sticker updated');
                  }}
                >
                  Done
                </button>
              </div>
            </div>
          )}

          {/* edit-mode panel — receipt: preset slots live on the card */}
          {editing && kind === 'receipt' && (
            <div className="rs-editpanel">
              <div className="eh">
                <span className="t">STAMP POSITION</span>
                <button
                  className={'rs-cb-btn' + (receiptPreset ? ' on' : '')}
                  onClick={() => setReceiptPreset(receiptPreset ? null : 'tr')}
                >
                  {receiptPreset ? 'On' : 'Off'}
                </button>
              </div>
              <div className="rs-stickergrid">
                {RECEIPT_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    className="rs-stickeropt"
                    aria-pressed={receiptPreset === p.id}
                    onClick={() => setReceiptPreset(p.id)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="erow">
                <button className="ctrl" onClick={resetPosition}>
                  <Icon.reset />
                  Reset
                </button>
                <button
                  className="ctrl primary"
                  onClick={() => {
                    setEditing(false);
                    ping('Stamp updated');
                  }}
                >
                  Done
                </button>
              </div>
            </div>
          )}

          {/* per-asset export / share */}
          {!editing && (
            <div className="rs-assetactions">
              <button className="ctrl" onClick={download}>
                <Icon.download />
                Download {tabDef.name.toLowerCase()}
              </button>
              <button className="ctrl" onClick={share}>
                <Icon.share />
                Share
              </button>
            </div>
          )}
        </div>

        <div className="rs-analysis">{analysisEl}</div>
      </main>

      {/* MOBILE ACTION BAR */}
      <div className="rs-mobilebar">
        <button className="mb-btn" onClick={download}>
          <Icon.download />
          Save
        </button>
        <button className="mb-btn" onClick={share}>
          <Icon.share />
          Share
        </button>
        <button className="mb-btn primary" onClick={newScan}>
          <Icon.plus />
          New scan
        </button>
      </div>

      {/* TOAST */}
      <div className={'rs-toast' + (toast ? ' show' : '')}>
        <span className="led" />
        {toast}
      </div>

      {/* OFFSCREEN EXPORT HOSTS — full-scale, WYSIWYG capture targets. Mounted
          only during an export (see withExportHost) to keep the page light. */}
      {exporting && (
      <div className="rs-exporthost" aria-hidden="true" ref={exportHostRef}>
        <div className="rs-export-card" ref={exportRefs.face}>
          <FaceCard content={faceContent} stickerOn={false} run={false} />
          {stickerOn && (
            <StaticSticker label={facePreset.label} tone={facePreset.tone} rotation={facePreset.rotation} pos={pos.face} />
          )}
        </div>
        <div className="rs-export-card" ref={exportRefs.outfit}>
          <OutfitCard content={outfitContent} stickerOn={false} run={false} />
          {stickerOn && (
            <StaticSticker
              label={outfitPreset.label}
              tone={outfitPreset.tone}
              rotation={outfitPreset.rotation}
              pos={pos.outfit}
            />
          )}
        </div>
        <div
          className="rs-export-card is-receipt"
          ref={exportRefs.receipt}
          data-paper={paper}
          data-verdict={result.verdict}
        >
          <Receipt content={result.receipt} paper={paper} sealOn={false} />
          <StaticStamp preset={receiptPreset} />
        </div>
      </div>
      )}
    </div>
  );
}
