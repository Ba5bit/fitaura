import { Icon } from '../../lib/icons';
import { useAccount } from './AccountContext';
import {
  AuthGate,
  EmailSentNotice,
  Paywall,
  Checkout,
  Processing,
  PaySuccess,
  PayFailure,
  LogoutConfirm,
  ChangePassword,
  DeleteAccountConfirm,
  MissingResult,
} from './AccountModals';

/**
 * Renders the active account/monetization overlay (modals + dialogs) and the
 * global toast. Mounted once at the app root so any surface can open a scene.
 */
export function AccountOverlays() {
  const { scene, toast, toastTone } = useAccount();
  return (
    <>
      {scene === 'auth' && <AuthGate />}
      {scene === 'confirm' && <EmailSentNotice />}
      {scene === 'paywall' && <Paywall />}
      {scene === 'checkout' && <Checkout />}
      {scene === 'processing' && <Processing />}
      {scene === 'success' && <PaySuccess />}
      {scene === 'failure' && <PayFailure />}
      {scene === 'logout' && <LogoutConfirm />}
      {scene === 'changePassword' && <ChangePassword />}
      {scene === 'deleteAccount' && <DeleteAccountConfirm />}
      {scene === 'missing' && <MissingResult />}
      {toast && (
        <div className={'aw-toast' + (toastTone === 'error' ? ' aw-toast--error' : '')}>
          {toastTone === 'error' ? <Icon.x /> : <Icon.check />}
          {toast}
        </div>
      )}
    </>
  );
}
