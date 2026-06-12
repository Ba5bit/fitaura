import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../../lib/icons';
import { CardImage } from '../../components/cards';
import { useGeneration } from '../../state/generation';
import { useAccount } from '../account/AccountContext';
import { useMediaQuery } from '../../lib/useMediaQuery';
import '../../design/scanner.css';

interface Stage {
  key: string;
  code: string;
  rail: string;
  title: [string, string];
  boundary: number;
  cap: string;
  micro: string[];
}

const STAGES: Stage[] = [
  { key: 'prep', code: '01', rail: 'Prepping photos', title: ['Prepping your ', 'photos'], boundary: 12, cap: 'PREP · INGESTING PHOTOS', micro: ['Wiping down the lens…', 'Loading you in…', 'Adjusting the lights…', 'Cracking knuckles…'] },
  { key: 'face', code: '02', rail: 'Reading the face', title: ['Reading your ', 'face'], boundary: 40, cap: 'SCAN · FACE GEOMETRY', micro: ['Finding the jawline…', 'Checking the angles…', 'Measuring main-character energy…', 'Locating the gaze…'] },
  { key: 'fit', code: '03', rail: 'Sizing the fit', title: ['Sizing up the ', 'fit'], boundary: 68, cap: 'SCAN · OUTFIT PROPORTIONS', micro: ['Tracing the silhouette…', 'Checking proportions…', 'Rating the drip…', 'Editorial, or gym-bro?…'] },
  { key: 'aura', code: '04', rail: 'Calculating aura', title: ['Calculating your ', 'aura'], boundary: 88, cap: 'COMPUTE · AURA FIELD', micro: ['Bottling the aura…', 'Tallying good-angle points…', 'Cross-checking the vibe…', 'Consulting the group chat…'] },
  { key: 'verdict', code: '05', rail: 'Printing verdict', title: ['Printing your ', 'verdict'], boundary: 100, cap: 'PRINT · DATING VERDICT', micro: ['Warming up the receipt printer…', 'Stamping the verdict…', 'Doing the math on your love life…', 'Tearing the receipt…'] },
];

const MARKERS = [
  { st: 'prep', cls: 'h-tr', label: 'Photos loaded', ok: true },
  { st: 'face', cls: 'h-l', label: 'Gaze · found', ok: false },
  { st: 'face', cls: 'h-tr', label: 'Jawline', ok: true },
  { st: 'face', cls: 'h-r', label: 'Symmetry', ok: false },
  { st: 'fit', cls: 'h-r', label: 'Silhouette', ok: false },
  { st: 'fit', cls: 'h-br', label: 'Proportions', ok: false },
  { st: 'fit', cls: 'h-bl', label: 'Drip · reading', ok: false },
  { st: 'aura', cls: 'h-r', label: 'Aura field', ok: false },
  { st: 'aura', cls: 'h-bl', label: 'Good angles +', ok: false },
  { st: 'verdict', cls: 'h-br', label: 'Receipt · printing', ok: false },
  { st: 'verdict', cls: 'h-tr', label: 'Stamping', ok: false },
];

function stageAt(p: number): number {
  for (let i = 0; i < STAGES.length; i++) {
    if (p < STAGES[i].boundary || i === STAGES.length - 1) return i;
  }
  return 0;
}

function Specimen({ stageKey, faceSrc, outfitSrc }: { stageKey: string; faceSrc: string | null; outfitSrc: string | null }) {
  const cap = (STAGES.find((s) => s.key === stageKey) || STAGES[0]).cap;
  return (
    <div className="specimen ignite">
      <div className="spec-aura" />
      <div className="spec-frame">
        <CardImage src={outfitSrc} shape="rect" placeholder="outfit" />
        <div className="scrim" />
        <div className="spec-ov">
          <div className="spec-grid-ov" />
          <div className="spec-band" />
          <div className="spec-scanline" />
        </div>
        <div className="spec-corners">
          <span className="tl" />
          <span className="tr" />
          <span className="bl" />
          <span className="br" />
        </div>
        <div className="spec-cap">
          <span className="blip" />
          <span className="txt">{cap}</span>
        </div>
      </div>
      <div className="spec-face">
        <div className="ring" />
        <CardImage src={faceSrc} shape="circle" placeholder="face" />
        <span className="tick t1" />
        <span className="tick t2" />
      </div>
      {MARKERS.map((m, i) => (
        <span key={i} className={'hud ' + m.cls} data-on={m.st === stageKey}>
          <span className="hd" />
          {m.label}
          {m.ok ? <span className="ok">✓</span> : null}
        </span>
      ))}
    </div>
  );
}

function Rail({ idx }: { idx: number }) {
  return (
    <div className="rail">
      {STAGES.map((s, i) => {
        const state = i < idx ? 'done' : i === idx ? 'active' : 'todo';
        return (
          <div className="rail-step" key={s.key} data-state={state}>
            <span className="rail-node">{state === 'done' ? <Icon.check /> : <span className="num">{s.code}</span>}</span>
            <span className="rail-label">{s.rail}</span>
            <span className="rail-code">{state === 'active' ? 'scanning' : state === 'done' ? 'done' : '—'}</span>
          </div>
        );
      })}
    </div>
  );
}

export function Scan() {
  const navigate = useNavigate();
  const { face, outfit, bothPhotosReady, runGeneration } = useGeneration();
  const { signedIn, openAuth, canScan, spendForScan, openPaywall, refundScan } = useAccount();
  // Set when a guest hit "reveal" — once they sign in, the effect below finishes
  // the reveal. The verdict is only generated after authentication.
  const [pendingReveal, setPendingReveal] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const [scanError, setScanError] = useState<{ kind: 'retake' | 'error'; message: string } | null>(null);

  const reduced =
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const mobile = useMediaQuery('(max-width: 760px)');

  const [phase, setPhase] = useState<'scanning' | 'done'>('scanning');
  const [progress, setProgress] = useState(0);
  const [microIdx, setMicroIdx] = useState(0);
  const rafRef = useRef(0);
  const startRef = useRef<number | null>(null);

  // Guard: a scan needs both confirmed photos.
  useEffect(() => {
    if (!bothPhotosReady) navigate('/scan', { replace: true });
  }, [bothPhotosReady, navigate]);

  const idx = stageAt(progress);
  const stage = STAGES[idx];

  // Progress driver.
  useEffect(() => {
    if (!bothPhotosReady) return;
    const dur = reduced ? 3500 : 9000;
    const frame = (t: number) => {
      if (startRef.current == null) startRef.current = t;
      const p = Math.min(100, ((t - startRef.current) / dur) * 100);
      setProgress(reduced ? Math.floor(p / 4) * 4 : p);
      if (p >= 100) {
        setProgress(100);
        setPhase('done');
        return;
      }
      rafRef.current = requestAnimationFrame(frame);
    };
    rafRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafRef.current);
  }, [bothPhotosReady, reduced]);

  // Microcopy rotation.
  useEffect(() => {
    if (phase !== 'scanning') return;
    const id = setInterval(() => setMicroIdx((n) => n + 1), 1750);
    return () => clearInterval(id);
  }, [phase]);

  const doReveal = useCallback(async () => {
    setScanError(null);
    const ok = await spendForScan();
    if (!ok) {
      openPaywall();
      return;
    }
    setRevealing(true);
    const outcome = await runGeneration();
    setRevealing(false);

    if (outcome.ok) {
      localStorage.setItem('fitaura.tab', 'face');
      navigate('/result#face');
      return;
    }
    // Any failure after spending → give the credit back.
    if (outcome.reason !== 'missing_photos') await refundScan();
    if (outcome.reason === 'retake') {
      setScanError({ kind: 'retake', message: outcome.retake.instruction });
    } else if (outcome.reason === 'error') {
      setScanError({ kind: 'error', message: 'That scan did not go through. Your credit was refunded — give it another go.' });
    } else {
      navigate('/scan');
    }
  }, [spendForScan, openPaywall, runGeneration, refundScan, navigate]);

  // Reveal policy: a guest's first scan is free (reveals straight away); once it's
  // used, a guest is sent to sign-in (returning here on success), and a signed-in
  // user with no credits hits the paywall.
  const onReveal = useCallback(() => {
    if (canScan) {
      void doReveal();
    } else if (!signedIn) {
      setPendingReveal(true);
      openAuth('/scan/run');
    } else {
      openPaywall();
    }
  }, [canScan, signedIn, doReveal, openAuth, openPaywall]);

  // Once a pending guest signs in (and now has credits), finish the reveal.
  useEffect(() => {
    if (pendingReveal && canScan) {
      setPendingReveal(false);
      void doReveal();
    }
  }, [pendingReveal, canScan, doReveal]);

  const micro = stage.micro[microIdx % stage.micro.length];
  const faceSrc = face?.url ?? null;
  const outfitSrc = outfit?.url ?? null;
  const dataStage = phase === 'done' ? 'verdict' : stage.key;

  return (
    <div className="scan-page">
      <div className={'sa' + (reduced ? ' rm' : '')} data-mobile={mobile ? 'true' : 'false'} data-stage={dataStage} data-phase={phase}>
        <div className="sa-pad">
        <div className="sa-head">
          <div className="brand">
            <span className="dot" />
            <span className="wm">Fitaura</span>
          </div>
          <div className="right">
            {phase === 'scanning' && (
              <>
                <span className="live-chip">
                  <span className="d" />
                  Scanning
                </span>
                <button className="leave-btn" onClick={() => navigate('/scan')} aria-label="Leave scan">
                  <Icon.x />
                </button>
              </>
            )}
          </div>
        </div>

        {phase === 'scanning' && (
          <div className="sa-stage">
            <Specimen stageKey={stage.key} faceSrc={faceSrc} outfitSrc={outfitSrc} />
            <div className="readout">
              <div className="ro-stage">
                <span className="ro-code">
                  {stage.code} · {stage.key.toUpperCase()}
                </span>
                <span className="ro-of">Stage {idx + 1} of 5</span>
              </div>
              <h2 className="ro-title">
                {stage.title[0]}
                <span className="hl">{stage.title[1]}</span>
              </h2>
              <div className="ro-tick">
                <span className="car">›</span>
                <span className="txt" key={micro}>
                  {micro}
                </span>
              </div>
              <div className="ro-prog">
                <div className="ro-pct">
                  <span className="n">{Math.round(progress)}</span>
                  <span className="p">%</span>
                </div>
                <div className="ro-bar">
                  <div className="fill" style={{ width: `${progress}%` }} />
                </div>
              </div>
              <Rail idx={idx} />
              <div className="ro-foot">
                <Icon.shield /> Processed for this scan only · for the bit, not science
              </div>
            </div>
          </div>
        )}

        {phase === 'done' && (
          <div className="reveal">
            <span className="stamp">✶ Verdict printed ✶</span>
            <h2>
              Your verdict is <span className="hl">in.</span>
            </h2>
            <p className="sub">Three cards and one dating receipt — fresh off the press.</p>
            <button className="go" onClick={onReveal} disabled={revealing}>
              {revealing
                ? 'Reading the room…'
                : canScan
                  ? 'Reveal my verdict'
                  : 'Log in to reveal your verdict'}{' '}
              {!revealing && <Icon.arrow />}
            </button>
            {scanError && (
              <div className="crop-note warn" style={{ marginTop: 16, maxWidth: 420 }}>
                <Icon.alert />
                <span>
                  {scanError.kind === 'retake' ? scanError.message : scanError.message}
                  {scanError.kind === 'retake' && (
                    <>
                      {' '}
                      <button
                        className="leave-btn"
                        style={{ textDecoration: 'underline', width: 'auto', padding: 0 }}
                        onClick={() => navigate('/scan')}
                      >
                        Replace a photo
                      </button>
                    </>
                  )}
                </span>
              </div>
            )}
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
