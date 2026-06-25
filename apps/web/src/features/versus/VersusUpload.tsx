import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Side, VersusMode } from '@fitaura/shared';
import { Icon } from '../../lib/icons';
import { UploadZone } from '../upload/UploadZone';
import { useMediaQuery } from '../../lib/useMediaQuery';
import { useAccount } from '../account/AccountContext';
import { useBattle, type BattleImages } from '../../state/battle';
import { DualGlowButton, ModeSelector } from './components/versusBits';
import '../../design/upload.css';
import '../../design/versus.css';

const NAME_MAX = 14;

// Face keeps Solo's default size (no override). Only the outfit is resized for the
// wider Versus cards: wider than Solo, a touch shorter, then −10% overall. Aspect
// change is safe — UploadZone re-derives the bake `out` to match.
const VS_FIT_FRAME = { w: 280, h: 316 }; // 230 ×1.35 ×0.9 wide · 306 ×1.35 ×0.85 ×0.9 tall

/** Which image slots a mode requires. */
function requiredSlots(mode: VersusMode): (keyof BattleImages)[] {
  const needFace = mode === 'face';
  const needFit = mode === 'fit';
  const out: (keyof BattleImages)[] = [];
  if (needFace) out.push('aFace', 'bFace');
  if (needFit) out.push('aFit', 'bFit');
  return out;
}

function ContenderCard({
  side,
  mode,
  name,
  onName,
  imgs,
  attempted,
  onImg,
  mobile,
}: {
  side: Side;
  mode: VersusMode;
  name: string;
  onName: (v: string) => void;
  imgs: BattleImages;
  attempted: boolean;
  onImg: (slot: keyof BattleImages, url: string | null) => void;
  mobile: boolean;
}) {
  const needFace = mode === 'face';
  const needFit = mode === 'fit';
  const faceSlot: keyof BattleImages = side === 'a' ? 'aFace' : 'bFace';
  const fitSlot: keyof BattleImages = side === 'a' ? 'aFit' : 'bFit';

  return (
    <div className="vs-contender vs-c" data-side={side}>
      <span className="glow" />
      <div className="vs-c-head">
        <span className="vs-badge">{side.toUpperCase()}</span>
        <input
          className="vs-name"
          value={name}
          maxLength={NAME_MAX}
          placeholder={side === 'a' ? 'Player A' : 'Player B'}
          aria-label={`Name for contender ${side.toUpperCase()}`}
          onChange={(e) => onName(e.target.value)}
        />
      </div>
      <div className="vs-zones">
        {needFace && (
          <UploadZone
            kind="face"
            mobile={mobile}
            missing={attempted && !imgs[faceSlot]}
            onConfirm={(url) => onImg(faceSlot, url)}
          />
        )}
        {needFit && (
          <UploadZone
            kind="outfit"
            mobile={mobile}
            frame={mobile ? undefined : VS_FIT_FRAME}
            missing={attempted && !imgs[fitSlot]}
            onConfirm={(url) => onImg(fitSlot, url)}
          />
        )}
      </div>
    </div>
  );
}

/** Step 1 — the versus upload arena (A vs B + mode + medallion). */
export function VersusUpload() {
  const navigate = useNavigate();
  const { commit } = useBattle();
  const { signedIn, credits } = useAccount();
  const mobile = useMediaQuery('(max-width: 760px)');

  const [mode, setMode] = useState<VersusMode>('face');
  const [nameA, setNameA] = useState('');
  const [nameB, setNameB] = useState('');
  const [imgs, setImgs] = useState<BattleImages>({});
  const [attempted, setAttempted] = useState(false);

  // Fixed action bar (mirrors Solo Upload): measure its height so the scroll
  // content reserves exactly that much room and the CTA is always reachable.
  const footRef = useRef<HTMLDivElement>(null);
  const [footH, setFootH] = useState(0);
  useEffect(() => {
    const el = footRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setFootH(el.offsetHeight));
    ro.observe(el);
    setFootH(el.offsetHeight);
    return () => ro.disconnect();
  }, []);

  const setImg = (slot: keyof BattleImages, url: string | null) =>
    setImgs((prev) => {
      const next = { ...prev };
      if (url) next[slot] = url;
      else delete next[slot];
      return next;
    });

  const required = useMemo(() => requiredSlots(mode), [mode]);
  const filled = required.filter((k) => imgs[k]);
  const allReady = required.length > 0 && filled.length === required.length;

  const sideReady = (side: Side) => required.filter((s) => s.startsWith(side)).every((s) => imgs[s]);
  const aReady = sideReady('a');
  const bReady = sideReady('b');

  const ctaLabel = allReady
    ? 'Compare & crown a winner'
    : `Add photos — ${filled.length}/${required.length} in`;

  function launch() {
    if (!allReady) {
      setAttempted(true);
      return;
    }
    const kept: BattleImages = {};
    for (const k of required) kept[k] = imgs[k];
    commit({ mode, nameA: nameA.trim(), nameB: nameB.trim(), imgs: kept });
    navigate('/versus/run');
  }

  const labelA = nameA.trim() || 'Player A';
  const labelB = nameB.trim() || 'Player B';

  return (
    <div className="vs-page">
      <div className="vs-wrap" style={{ paddingBottom: footH ? footH + 16 : undefined }}>
        <div className="vs-top">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Link className="vs-brand" to="/" aria-label="Fitaura home">
              <span className="dot" />
              <span className="wm">Fitaura</span>
            </Link>
            <Link to="/vault" className="vs-back">
              <Icon.back /> Vault
            </Link>
          </div>
          {signedIn ? (
            <span className="status-chip credits">
              <Icon.credit />
              <b>{credits}</b>&nbsp;credits
            </span>
          ) : (
            <span className="status-chip free">
              <span className="d" />
              10 free credits
            </span>
          )}
        </div>

        <div className="vs-title">
          <div className="step">Friend vs Friend · Step 01 / 03</div>
          <h1>
            Two friends, <span className="vs-grad">head to head</span>
          </h1>
          <p className="sub">
            Name each side, pick what to compare, drop the photos. One winner, one loser, one
            shareable verdict.
          </p>
        </div>

        <ModeSelector mode={mode} onChange={setMode} />

        <div className="vs-arena">
          <ContenderCard side="a" mode={mode} name={nameA} onName={setNameA} imgs={imgs} attempted={attempted} onImg={setImg} mobile={mobile} />
          <ContenderCard side="b" mode={mode} name={nameB} onName={setNameB} imgs={imgs} attempted={attempted} onImg={setImg} mobile={mobile} />
        </div>
      </div>

      {/* Fixed action bar — same structure/classes as Solo Upload. */}
      <div className="ua-foot" ref={footRef}>
        <div className="ua-foot-inner">
          <div className="review-row">
            <span className={'rchip ' + (aReady ? 'done' : attempted ? 'miss' : '')}>
              {aReady ? <Icon.check /> : <Icon.user />} {labelA} {aReady ? 'ready' : 'needed'}
            </span>
            <span className={'rchip ' + (bReady ? 'done' : attempted ? 'miss' : '')}>
              {bReady ? <Icon.check /> : <Icon.user />} {labelB} {bReady ? 'ready' : 'needed'}
            </span>
          </div>

          {attempted && !allReady && (
            <div className="val-banner">
              <Icon.alert />
              <span className="vt">
                <b>Add the missing photos</b> for both contenders to start the battle.
              </span>
            </div>
          )}

          <div className="cta-block">
            <DualGlowButton onClick={launch}>
              <Icon.bolt /> {ctaLabel}
            </DualGlowButton>
            <div className="cta-meta">
              <span className="free">
                <Icon.spark /> 10 free credits to start
              </span>
              <span>~8 sec</span>
            </div>
            {!allReady && !attempted && (
              <div className="cta-hint">Drop a {mode === 'face' ? 'face' : 'fit'} for both A and B to crown a winner.</div>
            )}
          </div>

          <div className="ua-trust">
            <Icon.shield /> Photos are analyzed in-session only · never permanently stored on our servers
          </div>
        </div>
      </div>
    </div>
  );
}
