import { useEffect, useRef, useState } from 'react';
import { Icon } from '../../lib/icons';
import { revealAboveBar } from './revealAboveBar';

interface WebcamCaptureProps {
  /** Called with a captured JPEG File (un-mirrored), then the capture view closes. */
  onCapture: (file: File) => void;
  onCancel: () => void;
}

/** Inline webcam capture for the face or outfit zone (desktop). Shows a mirrored live
 * preview, captures the current frame to a JPEG File (the zone then crops it to the
 * right ratio). Stops the stream on exit. */
export function WebcamCapture({ onCapture, onCancel }: WebcamCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const ctrlsRef = useRef<HTMLDivElement>(null);
  const [err, setErr] = useState<string | null>(null);

  // Once the live preview has real dimensions (layout settled), nudge the
  // Capture/Cancel buttons just clear of the page's fixed CTA bar — keeping the
  // preview visible (the tall video otherwise hides them under the bar).
  const revealControls = () => requestAnimationFrame(() => revealAboveBar(ctrlsRef.current));

  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'user' }, audio: false })
      .then((stream) => {
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; void videoRef.current.play(); }
      })
      .catch(() => setErr('Camera unavailable. Use "browse files" instead.'));
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  function capture() {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement('canvas');
    c.width = v.videoWidth; c.height = v.videoHeight;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    // Mirror the capture so the saved photo matches the selfie (CSS-mirrored) preview.
    ctx.translate(c.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(v, 0, 0, c.width, c.height);
    c.toBlob((blob) => {
      if (!blob) return;
      onCapture(new File([blob], 'webcam.jpg', { type: 'image/jpeg' }));
    }, 'image/jpeg', 0.92);
  }

  if (err) {
    return (
      <div className="zone-err">
        <span className="ic"><Icon.alert /></span>
        <span className="title">No camera</span>
        <span className="msg">{err}</span>
        <button className="cbtn" onClick={onCancel} style={{ marginTop: 12 }}>Back</button>
      </div>
    );
  }
  return (
    <div className="webcam-capture">
      <video ref={videoRef} playsInline muted onLoadedMetadata={revealControls} style={{ width: '100%', borderRadius: 14, transform: 'scaleX(-1)' }} />
      <div className="crop-ctrls" ref={ctrlsRef} style={{ marginTop: 12 }}>
        <button className="cbtn" onClick={capture}><Icon.face /> Capture</button>
        <button className="cbtn danger" onClick={onCancel}><Icon.x /> Cancel</button>
      </div>
    </div>
  );
}
