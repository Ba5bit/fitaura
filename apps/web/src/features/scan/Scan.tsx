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
  const { face, outfit, bothPhotosReady, runGeneration, hydrated } = useGeneration();
  const { signedIn, openAuth, canScan, spendForScan, openPaywall, refundScan } = useAccount();
  // Set when a guest hit "reveal" — once they sign in, the effect below finishes
  // the reveal. The verdict is only generated after authentication.
  const [pendingReveal, setPendingReveal] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const [scanError, setScanError] = useState<{ kind: 'retake' | 'error'; message: string } | null>(null);
  // Signed-in generation lifecycle — the AI runs DURING the scan animation (synced).
  // Guests stay 'idle' (teaser only) and generate after they sign up at the reveal.
  const [genState, setGenState] = useState<'idle' | 'running' | 'ready' | 'error' | 'retake'>('idle');
  const [genErr, setGenErr] = useState<string | null>(null);
  const genStateRef = useRef(genState);
  genStateRef.current = genState;
  // Guards the one-time scan kickoff against React StrictMode's double-invoke
  // (a double run here would double-spend a credit / double-call the AI).
  const startedRef = useRef(false);

  const reduced =
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const mobile = useMediaQuery('(max-width: 760px)');

  const [phase, setPhase] = useState<'scanning' | 'done'>('scanning');
  const [progress, setProgress] = useState(0);
  const [microIdx, setMicroIdx] = useState(0);
  const rafRef = useRef(0);
  const startRef = useRef<number | null>(null);
  // Guards against a double-tap double-spend before `revealing` disables the button.
  const revealingRef = useRef(false);

  // Guard: a scan needs both confirmed photos (after hydration, so a reload here
  // doesn't bounce to the upload page before IndexedDB loads).
  useEffect(() => {
    if (hydrated && !bothPhotosReady) navigate('/scan', { replace: true });
  }, [hydrated, bothPhotosReady, navigate]);

  const idx = stageAt(progress);
  const stage = STAGES[idx];

  // Kick off the real generation immediately for a signed-in user, so the AI
  // works WHILE the animation plays (Task 3 sync). A credit is spent up front; on
  // failure it's refunded. Guests run the teaser only — no token spend until they
  // sign up at the reveal (Task 2). Runs exactly once (startedRef + StrictMode).
  useEffect(() => {
    if (!hydrated) return;
    if (!bothPhotosReady || startedRef.current) return;
    if (!signedIn) {
      startedRef.current = true; // guest teaser — generation deferred to post-sign-up
      return;
    }
    if (!canScan) {
      startedRef.current = true;
      openPaywall();
      navigate('/scan');
      return;
    }
    startedRef.current = true;
    setGenState('running');
    void (async () => {
      const ok = await spendForScan();
      if (!ok) {
        openPaywall();
        navigate('/scan');
        return;
      }
      const outcome = await runGeneration();
      if (outcome.ok) {
        setGenState('ready');
        return;
      }
      await refundScan();
      if (outcome.reason === 'retake') {
        setGenErr(outcome.retake.instruction);
        setGenState('retake');
      } else if (outcome.reason === 'error') {
        setGenErr('That scan did not go through. Your credit was refunded — give it another go.');
        setGenState('error');
      } else {
        navigate('/scan');
      }
    })();
  }, [hydrated, bothPhotosReady, signedIn, canScan, spendForScan, runGeneration, refundScan, openPaywall, navigate]);

  // Progress driver. For a signed-in scan the animation HOLDS near the end until
  // the real generation settles, so the wait is synced to the actual AI. Guests
  // have no generation in flight, so they finish on the timer (pure teaser).
  useEffect(() => {
    if (!bothPhotosReady) return;
    const dur = reduced ? 3500 : 9000;
    const frame = (t: number) => {
      if (startRef.current == null) startRef.current = t;
      const rawP = Math.min(100, ((t - startRef.current) / dur) * 100);
      const settled = !signedIn || (genStateRef.current !== 'idle' && genStateRef.current !== 'running');
      const capped = settled ? rawP : Math.min(rawP, 95);
      setProgress(reduced ? Math.floor(capped / 4) * 4 : capped);
      if (rawP >= 100 && settled) {
        setProgress(100);
        setPhase('done');
        return;
      }
      rafRef.current = requestAnimationFrame(frame);
    };
    rafRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafRef.current);
  }, [bothPhotosReady, reduced, signedIn]);

  // Microcopy rotation.
  useEffect(() => {
    if (phase !== 'scanning') return;
    const id = setInterval(() => setMicroIdx((n) => n + 1), 1750);
    return () => clearInterval(id);
  }, [phase]);

  // Guest-only: after sign-up the verdict is generated (this is the FIRST time we
  // spend tokens for a guest — never before registration). Same spend→generate→
  // refund-on-failure contract as the signed-in kickoff.
  const doRevealGuest = useCallback(async () => {
    if (revealingRef.current) return;
    revealingRef.current = true;
    setScanError(null);
    const ok = await spendForScan();
    if (!ok) {
      revealingRef.current = false;
      openPaywall();
      return;
    }
    setRevealing(true);
    const outcome = await runGeneration();
    setRevealing(false);
    revealingRef.current = false;

    if (outcome.ok) {
      localStorage.setItem('fitaura.tab', 'face');
      navigate('/result#face');
      return;
    }
    await refundScan();
    if (outcome.reason === 'retake') {
      setScanError({ kind: 'retake', message: outcome.retake.instruction });
    } else if (outcome.reason === 'error') {
      setScanError({ kind: 'error', message: 'That scan did not go through. Your credit was refunded — give it another go.' });
    } else {
      navigate('/scan');
    }
  }, [spendForScan, openPaywall, runGeneration, refundScan, navigate]);

  // Reveal: a signed-in user already has their verdict (generated during the scan)
  // — just open it. A guest is sent to sign-up; generation happens afterwards.
  const onReveal = useCallback(() => {
    if (signedIn) {
      if (genStateRef.current === 'ready') {
        localStorage.setItem('fitaura.tab', 'face');
        navigate('/result#face');
      }
      return;
    }
    setPendingReveal(true);
    openAuth('/scan/run');
  }, [signedIn, navigate, openAuth]);

  // Once a pending guest signs up (and the free credits land), run the generation.
  useEffect(() => {
    if (pendingReveal && signedIn && canScan) {
      setPendingReveal(false);
      void doRevealGuest();
    }
  }, [pendingReveal, signedIn, canScan, doRevealGuest]);

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
            {signedIn && (genState === 'error' || genState === 'retake') ? (
              // Signed-in generation failed during the scan — credit already refunded.
              <>
                <span className="stamp" style={{ color: 'var(--red)' }}>
                  ✶ Scan hiccup ✶
                </span>
                <h2>
                  Let's try <span className="hl">again.</span>
                </h2>
                <div className="crop-note warn" style={{ marginTop: 16, maxWidth: 420 }}>
                  <Icon.alert />
                  <span>
                    {genErr}{' '}
                    <button
                      className="leave-btn"
                      style={{ textDecoration: 'underline', width: 'auto', padding: 0 }}
                      onClick={() => navigate('/scan')}
                    >
                      {genState === 'retake' ? 'Replace a photo' : 'Try again'}
                    </button>
                  </span>
                </div>
              </>
            ) : (
              <>
                <span className="stamp">✶ Verdict printed ✶</span>
                <h2>
                  Your verdict is <span className="hl">in.</span>
                </h2>
                <p className="sub">
                  {signedIn
                    ? 'Three cards and one dating receipt — fresh off the press.'
                    : 'Create your free account to reveal all three cards and your dating receipt.'}
                </p>
                <button className="go" onClick={onReveal} disabled={revealing}>
                  {revealing
                    ? 'Reading the room…'
                    : signedIn
                      ? 'Reveal my verdict'
                      : 'Sign up to reveal your verdict'}
                </button>
                {scanError && (
                  <div className="crop-note warn" style={{ marginTop: 16, maxWidth: 420 }}>
                    <Icon.alert />
                    <span>
                      {scanError.message}
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
              </>
            )}
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
