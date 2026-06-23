import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Side, VersusMode } from '@fitaura/shared';
import { Icon } from '../../lib/icons';
import { UploadZone } from '../upload/UploadZone';
import { useMediaQuery } from '../../lib/useMediaQuery';
import { useBattle, type BattleImages } from '../../state/battle';
import { DualGlowButton, ModeSelector, VersusMedallion } from './components/versusBits';
import '../../design/upload.css';
import '../../design/versus.css';

const NAME_MAX = 14;
const FORMATS = ['JPG', 'PNG', 'WEBP', 'HEIC'];

/** Which image slots a mode requires. */
function requiredSlots(mode: VersusMode): (keyof BattleImages)[] {
  const needFace = mode === 'face' || mode === 'both';
  const needFit = mode === 'fit' || mode === 'both';
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
  onImg,
  mobile,
}: {
  side: Side;
  mode: VersusMode;
  name: string;
  onName: (v: string) => void;
  onImg: (slot: keyof BattleImages, url: string | null) => void;
  mobile: boolean;
}) {
  const needFace = mode === 'face' || mode === 'both';
  const needFit = mode === 'fit' || mode === 'both';
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
            onConfirm={(url) => onImg(faceSlot, url)}
          />
        )}
        {needFit && (
          <UploadZone
            kind="outfit"
            mobile={mobile}
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
  const mobile = useMediaQuery('(max-width: 760px)');

  const [mode, setMode] = useState<VersusMode>('both');
  const [nameA, setNameA] = useState('');
  const [nameB, setNameB] = useState('');
  const [imgs, setImgs] = useState<BattleImages>({});

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

  const ctaLabel = allReady
    ? 'Compare & crown a winner'
    : `Add photos — ${filled.length}/${required.length} in`;

  function launch() {
    if (!allReady) return;
    // Only keep the images relevant to the chosen mode.
    const kept: BattleImages = {};
    for (const k of required) kept[k] = imgs[k];
    commit({ mode, nameA: nameA.trim(), nameB: nameB.trim(), imgs: kept });
    navigate('/versus/run');
  }

  return (
    <div className="vs-page">
      <div className="vs-wrap">
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
          <span className="vs-pill">
            <Icon.users /> Friend vs Friend
          </span>
        </div>

        <div className="vs-title">
          <div className="step">Step 01 / 03 — Upload</div>
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
          <ContenderCard side="a" mode={mode} name={nameA} onName={setNameA} onImg={setImg} mobile={mobile} />
          <VersusMedallion />
          <ContenderCard side="b" mode={mode} name={nameB} onName={setNameB} onImg={setImg} mobile={mobile} />
        </div>

        <div className="vs-foot">
          <div className="cta-wrap">
            <DualGlowButton onClick={launch} disabled={!allReady}>
              <Icon.bolt /> {ctaLabel}
            </DualGlowButton>
          </div>
          <div className="vs-chips">
            {FORMATS.map((f) => (
              <span key={f} className="vs-fmt">
                {f}
              </span>
            ))}
          </div>
          <div className="vs-trust">
            <Icon.shield /> Analyzed in-session · nothing stored
          </div>
        </div>
      </div>
    </div>
  );
}
