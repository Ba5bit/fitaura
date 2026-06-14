import { useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Icon } from '../../lib/icons';
import { useGeneration } from '../../state/generation';
import { useAccount } from '../account/AccountContext';
import { useMediaQuery } from '../../lib/useMediaQuery';
import { UploadZone } from './UploadZone';
import '../../design/upload.css';

/**
 * Upload page — one combined page, two clearly-labelled drop zones, inline
 * crop. The lowest-friction path (no wizard). The design's device-frame review
 * harness and spec sheet were QA scaffolding and are intentionally not ported.
 */
export function Upload() {
  const navigate = useNavigate();
  const { face, outfit, setFace, setOutfit } = useGeneration();
  const { freeScanAvailable, credits, canScan } = useAccount();
  const mobile = useMediaQuery('(max-width: 760px)');
  const [attempted, setAttempted] = useState(false);

  // The action bar is fixed to the viewport bottom (always-reachable CTA while
  // the tall cards scroll). Measure its height so the scroll content reserves
  // exactly that much room — the bar grows/shrinks with the validation banner.
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

  const faceReady = !!face;
  const outfitReady = !!outfit;
  const bothReady = faceReady && outfitReady;
  const missingList = [!faceReady && 'face', !outfitReady && 'outfit'].filter(Boolean) as string[];

  function onGenerate() {
    if (!bothReady) {
      setAttempted(true);
      return;
    }
    navigate('/scan/run');
  }

  return (
    <div className="ua-page">
      <div className="ua" data-mobile={mobile ? 'true' : 'false'}>
        <div className="ua-pad" style={{ paddingBottom: footH ? footH + 16 : undefined }}>
          <div className="ua-head">
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <Link className="brand" to="/" aria-label="Fitaura home">
                <span className="dot" />
                <span className="wm">Fitaura</span>
              </Link>
              <Link to="/vault" className="vlt-back" style={{ textDecoration: 'none' }}>
                <Icon.back /> Vault
              </Link>
            </div>
            {freeScanAvailable ? (
              <span className="status-chip free">
                <span className="d" />
                First scan free
              </span>
            ) : (
              <span className="status-chip credits">
                <Icon.credit />
                <b>{credits}</b>&nbsp;credits
              </span>
            )}
          </div>

          <div className="ua-title">
            <span className="eyebrow">Upload · 2 photos</span>
            <h2>
              Drop your <span className="hl">face</span> &amp; <span className="hl">fit</span>
            </h2>
            <p className="sub">Two photos, one scan. We read your face and outfit, then score the aura.</p>
          </div>

          <div className="ua-zones">
            <UploadZone
              kind="face"
              mobile={mobile}
              missing={attempted && !faceReady}
              onConfirm={(url) => setFace(url ? { url } : null)}
            />
            <UploadZone
              kind="outfit"
              mobile={mobile}
              missing={attempted && !outfitReady}
              onConfirm={(url) => setOutfit(url ? { url } : null)}
            />
          </div>

          <div className="ua-foot" ref={footRef}>
            <div className="ua-foot-inner">
            <div className="review-row">
              <span className={'rchip ' + (faceReady ? 'done' : attempted && !faceReady ? 'miss' : '')}>
                {faceReady ? <Icon.check /> : <Icon.face />} Face {faceReady ? 'ready' : 'needed'}
              </span>
              <span className={'rchip ' + (outfitReady ? 'done' : attempted && !outfitReady ? 'miss' : '')}>
                {outfitReady ? <Icon.check /> : <Icon.hanger />} Outfit {outfitReady ? 'ready' : 'needed'}
              </span>
            </div>

            {attempted && missingList.length > 0 && (
              <div className="val-banner">
                <Icon.alert />
                <span className="vt">
                  <b>
                    Add {missingList.length === 2 ? 'both photos' : 'your ' + (missingList[0] === 'face' ? 'face photo' : 'outfit photo')}
                  </b>{' '}
                  to run your scan.
                </span>
              </div>
            )}

            <div className="cta-block">
              {canScan ? (
                <button className={'cta ' + (bothReady ? 'go' : 'disabled')} onClick={onGenerate}>
                  <Icon.bolt /> {freeScanAvailable ? 'Scan my aura — free' : 'Scan my aura'}
                </button>
              ) : (
                // Out of free scans + no credits — make the action explicit instead
                // of silently jumping to pricing.
                <button className="cta go" onClick={() => navigate('/#credits')}>
                  <Icon.credit /> Out of scans — get credits
                </button>
              )}
              <div className="cta-meta">
                {freeScanAvailable ? (
                  <span className="free">
                    <Icon.spark /> First generation is on us
                  </span>
                ) : canScan ? (
                  <span className="cost">
                    <Icon.credit /> Costs 1 credit · {Math.max(0, credits - 1)} left after
                  </span>
                ) : (
                  <span className="cost">
                    <Icon.credit /> Free scan used · 1 credit per scan
                  </span>
                )}
                <span>~20 sec</span>
              </div>
              {canScan && !bothReady && !attempted && (
                <div className="cta-hint">Add both photos to unlock your scan.</div>
              )}
              {!canScan && (
                <div className="cta-hint block">
                  You've used your free verdict. <Link to="/#credits">Grab a credit pack</Link> to keep scanning.
                </div>
              )}
            </div>

            <div className="ua-trust">
              <Icon.shield /> Photos are processed for your scan only · never permanently stored on our servers
            </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
