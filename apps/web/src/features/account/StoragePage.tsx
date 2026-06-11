import { useNavigate } from 'react-router-dom';
import { Icon } from '../../lib/icons';
import { AccountNav } from './AccountChrome';

/** Server-vs-on-device storage & privacy explainer. */
export function StoragePage() {
  const navigate = useNavigate();
  return (
    <>
      <AccountNav />
      <div className="aw-page">
        <span className="aw-eyebrow">STORAGE &amp; PRIVACY</span>
        <h1 className="aw-h1">
          WHERE YOUR
          <br />
          <span className="hl">STUFF LIVES</span>
        </h1>
        <p className="aw-lead">
          Two places, on purpose. Your account stays in sync across devices; your photos and the results we generate
          never leave your device for our servers.
        </p>

        <div className="aw-store-cols">
          <div className="aw-store-col server">
            <div className="ch">
              <span className="ic">
                <Icon.cloud />
              </span>
              <div>
                <div className="ti">On our servers</div>
                <div className="tag">Synced to your login</div>
              </div>
            </div>
            <ul>
              <li>
                <Icon.check /> Your account &amp; login
              </li>
              <li>
                <Icon.check /> Credit balance
              </li>
              <li>
                <Icon.check /> Payment receipts &amp; records
              </li>
              <li>
                <Icon.check /> Generation authorization
              </li>
            </ul>
            <p className="note">
              Only what's needed to run the business and keep your credits portable — so they follow you on any device
              the moment you log in. No photos, ever.
            </p>
          </div>

          <div className="aw-store-col local">
            <div className="ch">
              <span className="ic">
                <Icon.phone />
              </span>
              <div>
                <div className="ti">On this device</div>
                <div className="tag">Never stored on our servers</div>
              </div>
            </div>
            <ul>
              <li>
                <Icon.check /> Your face &amp; outfit photos
              </li>
              <li>
                <Icon.check /> Generated cards &amp; receipts
              </li>
              <li>
                <Icon.check /> Your verdict history
              </li>
            </ul>
            <p className="note">
              Used to build your verdict, then kept in this browser. Clear your browser or switch devices and they're
              gone — from us too. We don't permanently store your source photos.
            </p>
          </div>
        </div>

        <div className="aw-store-flow">
          <span>You upload photos</span>
          <Icon.arrow />
          <b>Server generates &amp; authorizes</b>
          <Icon.arrow />
          <span>
            Results return to <b>your device</b>
          </span>
          <Icon.arrow />
          <span>Server keeps nothing but the receipt</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '30px' }}>
          <button className="aw-btn primary" onClick={() => navigate(-1)}>
            <Icon.check /> Got it
          </button>
        </div>
      </div>
    </>
  );
}
