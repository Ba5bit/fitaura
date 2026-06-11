import { Icon } from '../../lib/icons';
import { useAccount } from './AccountContext';
import {
  AuthGate,
  Paywall,
  Checkout,
  Processing,
  PaySuccess,
  PayFailure,
  LogoutConfirm,
  MissingResult,
} from './AccountModals';

/**
 * Renders the active account/monetization overlay (modals + dialogs) and the
 * global toast. Mounted once at the app root so any surface can open a scene.
 */
export function AccountOverlays() {
  const { scene, toast } = useAccount();
  return (
    <>
      {scene === 'auth' && <AuthGate />}
      {scene === 'paywall' && <Paywall />}
      {scene === 'checkout' && <Checkout />}
      {scene === 'processing' && <Processing />}
      {scene === 'success' && <PaySuccess />}
      {scene === 'failure' && <PayFailure />}
      {scene === 'logout' && <LogoutConfirm />}
      {scene === 'missing' && <MissingResult />}
      {toast && (
        <div className="aw-toast">
          <Icon.check />
          {toast}
        </div>
      )}
    </>
  );
}
