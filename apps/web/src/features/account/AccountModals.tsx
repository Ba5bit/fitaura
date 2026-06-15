import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CREDIT_PACKS, type CreditPack } from '@fitaura/shared';
import { Icon } from '../../lib/icons';
import { useAccount } from './AccountContext';
import { WebModal, WebDialogBody, WebField } from './WebModal';

const packById = (id: string): CreditPack => CREDIT_PACKS.find((p) => p.id === id) ?? CREDIT_PACKS[1];

/* ============================ AUTH GATE ============================ */
export function AuthGate() {
  const { closeScene, signUp, logIn, authStatus, authError } = useAccount();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [mode, setMode] = useState<'signup' | 'login'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // Shown after a successful sign-up, prompting the user to log in.
  const [notice, setNotice] = useState<string | null>(null);
  const isSignup = mode === 'signup';
  const pending = authStatus === 'pending';

  const switchMode = (m: 'signup' | 'login') => {
    setMode(m);
    setNotice(null);
  };

  const submit = async () => {
    if (pending) return;
    if (isSignup) {
      const ok = await signUp(email.trim(), password);
      if (ok) {
        // Registration succeeds but does NOT log you in — switch to the Log in
        // tab and ask for the password again.
        setMode('login');
        setPassword('');
        setNotice("You're registered. Now log in with your email and password.");
      }
    } else {
      void logIn(email.trim(), password);
    }
  };

  return (
    <WebModal size="lg" onClose={closeScene}>
      <div className="aw-auth">
        <div className="aw-auth-left">
          <span className="aw-eyebrow accent">ACCOUNT REQUIRED TO CONTINUE</span>
          <h2 className="aw-modal-title" style={{ marginTop: '16px', fontSize: '34px' }}>
            SAVE YOUR SCANS.
            <br />
            KEEP GOING.
          </h2>
          <p className="aw-modal-sub">
            Your first verdict was free and stayed on this device. An account lets you buy credits and run more — on
            any device you log in from.
          </p>
          <ul className="pts">
            <li>
              <span className="ck">
                <Icon.check />
              </span>
              <span>
                Credits follow your login<span className="s">Not tied to one browser</span>
              </span>
            </li>
            <li>
              <span className="ck">
                <Icon.check />
              </span>
              <span>
                Payment receipts saved<span className="s">On your account, server-side</span>
              </span>
            </li>
            <li>
              <span className="ck">
                <Icon.check />
              </span>
              <span>
                Your photos stay on your device<span className="s">We never store source photos</span>
              </span>
            </li>
          </ul>
        </div>

        <div className="aw-auth-right">
          <div className="aw-seg" role="tablist">
            <button type="button" role="tab" aria-selected={isSignup} onClick={() => switchMode('signup')}>
              Sign up
            </button>
            <button type="button" role="tab" aria-selected={!isSignup} onClick={() => switchMode('login')}>
              Log in
            </button>
          </div>
          {/* A real form so Enter submits from either field. display:contents keeps
              the layout identical to the previous flat stack. */}
          <form
            style={{ display: 'contents' }}
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <WebField label="Email" type="email" placeholder="you@email.com" value={email} onChange={setEmail} />
            <WebField
              label="Password"
              type="password"
              placeholder={isSignup ? 'Create a password' : 'Your password'}
              value={password}
              onChange={setPassword}
            />
            {notice && !authError && (
              <p className="aw-formnotice" role="status">
                {notice}
              </p>
            )}
            {authError && (
              <p className="aw-formerror" role="alert">
                {authError}
              </p>
            )}
            <button
              type="submit"
              className="aw-btn primary block"
              style={{ marginTop: '18px' }}
              disabled={pending}
            >
              {pending ? 'Working…' : isSignup ? 'Create account' : 'Log in'}
            </button>
          </form>
          <div className="aw-finehelp">
            <Icon.shield />
            <span>
              We store your account, credit balance and payment receipts — never your photos.{' '}
              <button
                type="button"
                className="lk"
                onClick={() => {
                  closeScene();
                  navigate('/settings', { state: { from: pathname } });
                }}
              >
                How your data is stored
              </button>
            </span>
          </div>
        </div>
      </div>
    </WebModal>
  );
}

/* ============================ PAYWALL ============================ */
export function Paywall() {
  const { closeScene } = useAccount();
  const navigate = useNavigate();
  return (
    <WebModal size="sm" onClose={closeScene}>
      <WebDialogBody>
        <span className="aw-eyebrow warn" style={{ alignSelf: 'center' }}>
          OUT OF CREDITS
        </span>
        <div className="aw-bignum warn" style={{ fontSize: '64px', marginTop: '12px' }}>
          0
        </div>
        <h2 className="aw-modal-title" style={{ marginTop: '8px' }}>
          FREE VERDICT USED
        </h2>
        <p className="aw-modal-sub">
          Your next scan needs 1 credit. Each credit returns all three cards plus the full analysis — never one card
          at a time.
        </p>
        <button
          className="aw-btn primary block"
          style={{ marginTop: '22px' }}
          onClick={() => {
            closeScene();
            navigate('/credits');
          }}
        >
          <Icon.gem /> Get credits
        </button>
        <button className="aw-linkbtn" onClick={closeScene}>
          Maybe later
        </button>
      </WebDialogBody>
    </WebModal>
  );
}

/* ============================ CHECKOUT ============================ */
export function Checkout() {
  const { pack, pay, closeScene } = useAccount();
  const p = packById(pack);
  const [embedded, setEmbedded] = useState(false);

  return (
    <WebModal size="lg" onClose={closeScene}>
      <div className="aw-checkout">
        {/* LEFT — order summary */}
        <div className="aw-checkout-left">
          <span className="aw-eyebrow accent">ORDER SUMMARY</span>
          <div
            style={{
              fontFamily: 'Anton, sans-serif',
              fontSize: '44px',
              color: '#fff',
              lineHeight: 0.9,
              marginTop: '14px',
              textTransform: 'uppercase',
            }}
          >
            {p.credits} CREDITS
          </div>
          <div className="aw-summary">
            <div className="row">
              <span className="k">Pack</span>
              <span className="v">{p.credits} credits</span>
            </div>
            <div className="row">
              <span className="k">Billing</span>
              <span className="v">One-time</span>
            </div>
            <div className="row total">
              <span className="k">Total today</span>
              <span className="v">{p.price}</span>
            </div>
          </div>
          <div style={{ marginTop: '20px' }}>
            <span className="aw-tag server">
              <Icon.receipt /> Receipt saved to your account
            </span>
          </div>
          <div style={{ marginTop: 'auto', paddingTop: '22px' }}>
            <div className="aw-securebar">
              <Icon.shield /> 256-bit encrypted · PCI-compliant partner · Fitaura never sees your card
            </div>
          </div>
        </div>

        {/* RIGHT — payment entry */}
        <div className="aw-checkout-right" style={{ display: 'flex', flexDirection: 'column' }}>
          <span className="aw-eyebrow accent">{embedded ? 'PAYMENT DETAILS' : 'REVIEW & CONFIRM'}</span>

          {!embedded ? (
            <>
              <h2 className="aw-modal-title" style={{ fontSize: '26px' }}>
                CONFIRM PURCHASE
              </h2>
              <p className="aw-modal-sub">Review your order, then pay securely.</p>
              <div className="aw-paymethod">
                <span className="ic">
                  <Icon.card />
                </span>
                <span>Visa ···· 4242</span>
                <button type="button" className="chg" onClick={() => setEmbedded(true)}>
                  Change
                </button>
              </div>
              <button className="aw-btn primary block" style={{ marginTop: 'auto' }} onClick={pay}>
                <Icon.lock /> Pay {p.price}
              </button>
              <div className="aw-fineprint">
                Your purchase is a one-time charge. Credits are added to your account on success.
              </div>
            </>
          ) : (
            <>
              <h2 className="aw-modal-title" style={{ fontSize: '24px' }}>
                PAY {p.price}
              </h2>
              <p className="aw-modal-sub" style={{ marginBottom: '4px' }}>
                {p.credits} credits · one-time charge
              </p>
              <div className="aw-securebar" style={{ marginTop: '14px' }}>
                <Icon.lock /> Encrypted &amp; secured by our payment partner
              </div>
              <div className="aw-field">
                <label>Card number</label>
                <div className="aw-input-wrap aw-cardnum">
                  <input className="aw-input" inputMode="numeric" placeholder="1234 1234 1234 1234" defaultValue="4242 4242 4242 4242" />
                  <span className="scheme">
                    <i className="a" />
                    <i className="b" />
                  </span>
                </div>
              </div>
              <div className="aw-field-grid">
                <WebField label="Expiry" placeholder="MM / YY" defaultValue="08 / 28" />
                <WebField label="CVC" placeholder="123" lock />
              </div>
              <div className="aw-field-grid">
                <WebField label="ZIP / Postal" placeholder="94107" />
                <WebField label="Country" defaultValue="United States" />
              </div>
              <button className="aw-btn primary block" style={{ marginTop: '18px' }} onClick={pay}>
                <Icon.lock /> Pay {p.price}
              </button>
              <div className="aw-fineprint">Card details are tokenized by our payment partner — never stored by Fitaura.</div>
            </>
          )}
        </div>
      </div>
    </WebModal>
  );
}

/* ============================ PROCESSING ============================ */
export function Processing() {
  const [stage, setStage] = useState(0);
  useEffect(() => {
    const a = setTimeout(() => setStage(1), 700);
    const b = setTimeout(() => setStage(2), 1500);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, []);
  const lines = [
    { t: 'Authorizing payment', done: stage >= 1 },
    { t: 'Confirming with payment partner', done: stage >= 2 },
    { t: 'Adding credits to your account', done: false, on: stage >= 2 },
  ];
  return (
    <WebModal size="sm" closeable={false}>
      <WebDialogBody>
        <div className="aw-spinner" />
        <h2 className="aw-modal-title" style={{ marginTop: '22px' }}>
          PROCESSING…
        </h2>
        <p className="aw-modal-sub">Hang tight — don't close or refresh this window.</p>
        <div className="aw-statuslines">
          {lines.map((l, i) => (
            <div key={i} className={'aw-statusline' + (l.done ? ' done' : l.on || i <= stage ? ' on' : '')}>
              {l.done ? <Icon.check /> : <span className="d" />}
              {l.t}
            </div>
          ))}
        </div>
      </WebDialogBody>
    </WebModal>
  );
}

/* ============================ SUCCESS ============================ */
export function PaySuccess() {
  const { pack, closeScene, credits } = useAccount();
  const navigate = useNavigate();
  const p = packById(pack);
  return (
    <WebModal size="sm" closeable={false}>
      <WebDialogBody>
        <div className="aw-glyph good">
          <Icon.check />
        </div>
        <div className="aw-bignum good" style={{ fontSize: '56px', marginTop: '14px' }}>
          +{p.credits}
        </div>
        <h2 className="aw-modal-title" style={{ marginTop: '4px' }}>
          PAYMENT COMPLETE
        </h2>
        <p className="aw-modal-sub">{p.credits} credits are on your account. You're ready to scan.</p>
        <div className="aw-balance-after">
          New balance <b>{credits} credits</b>
        </div>
        <span className="aw-receiptline" style={{ whiteSpace: 'nowrap' }}>
          <Icon.receipt /> RECEIPT FA-PAY-90412 · {p.price}
        </span>
        <div className="aw-fineprint" style={{ marginTop: '6px' }}>
          Receipt saved to your account · server-side
        </div>
        <button
          className="aw-btn primary block"
          style={{ marginTop: '20px' }}
          onClick={() => {
            closeScene();
            navigate('/scan');
          }}
        >
          <Icon.scan /> Start scanning
        </button>
        <button
          className="aw-linkbtn"
          onClick={() => {
            closeScene();
            navigate('/account');
          }}
        >
          Back to account
        </button>
      </WebDialogBody>
    </WebModal>
  );
}

/* ============================ FAILURE ============================ */
export function PayFailure() {
  const { startCheckout, closeScene } = useAccount();
  return (
    <WebModal size="sm" onClose={closeScene}>
      <WebDialogBody>
        <div className="aw-glyph bad">
          <Icon.x />
        </div>
        <h2 className="aw-modal-title" style={{ marginTop: '18px' }}>
          PAYMENT DECLINED
        </h2>
        <p className="aw-modal-sub">
          Your card was declined by the issuer. <b style={{ color: 'var(--ink)' }}>You haven't been charged</b> and no
          credits were used.
        </p>
        <button className="aw-btn primary block" style={{ marginTop: '22px' }} onClick={() => startCheckout()}>
          <Icon.refresh /> Try again
        </button>
        <button className="aw-linkbtn" onClick={closeScene}>
          Use a different method
        </button>
      </WebDialogBody>
    </WebModal>
  );
}

/* ============================ LOGOUT CONFIRM ============================ */
export function LogoutConfirm() {
  const { confirmLogout, closeScene } = useAccount();
  return (
    <WebModal size="sm" onClose={closeScene}>
      <WebDialogBody>
        <div className="aw-glyph neutral">
          <Icon.logout />
        </div>
        <h2 className="aw-modal-title">LOG OUT?</h2>
        <p className="aw-modal-sub">
          Your credits and payment receipts are safe on your account and will be here when you log back in. Results
          stay saved on this device.
        </p>
        <button className="aw-btn danger block" style={{ marginTop: '22px' }} onClick={confirmLogout}>
          <Icon.logout /> Log out
        </button>
        <button className="aw-linkbtn" onClick={closeScene}>
          Stay logged in
        </button>
      </WebDialogBody>
    </WebModal>
  );
}

/* ============================ MISSING RESULT ============================ */
export function MissingResult() {
  const { missingId, closeScene } = useAccount();
  const navigate = useNavigate();
  return (
    <WebModal size="sm" onClose={closeScene}>
      <WebDialogBody>
        <span className="aw-eyebrow warn" style={{ alignSelf: 'center' }}>
          RESULT NOT ON THIS DEVICE
        </span>
        <div className="aw-glyph neutral" style={{ marginTop: '16px' }}>
          <Icon.ghost />
        </div>
        <h2 className="aw-modal-title">IT'S GONE</h2>
        <p className="aw-modal-sub">
          Result <b style={{ color: 'var(--ink)' }}>{missingId ?? 'this scan'}</b> was saved on this device, but the
          local copy is no longer here. Clearing your browser, private mode, or switching devices removes locally
          stored results.
        </p>
        <div
          className="aw-securebar"
          style={{
            marginTop: '20px',
            color: 'var(--icy)',
            borderColor: 'color-mix(in oklab,var(--icy) 28%,var(--hair-soft))',
            background: 'color-mix(in oklab,var(--icy) 6%,transparent)',
          }}
        >
          <Icon.shield /> Your account and credit balance are unaffected
        </div>
        <button
          className="aw-btn primary block"
          style={{ marginTop: '18px' }}
          onClick={() => {
            closeScene();
            navigate('/scan');
          }}
        >
          <Icon.scan /> Run a new scan
        </button>
        <div style={{ display: 'flex', gap: '10px', marginTop: '12px', width: '100%' }}>
          <button
            className="aw-btn block"
            onClick={() => {
              closeScene();
              navigate('/vault');
            }}
          >
            Back to vault
          </button>
          <button
            className="aw-btn block"
            onClick={() => {
              closeScene();
              navigate('/settings');
            }}
          >
            Why?
          </button>
        </div>
      </WebDialogBody>
    </WebModal>
  );
}
