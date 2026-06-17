import { lazy, Suspense, useLayoutEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { GenerationProvider } from './state/generation';
import { AccountProvider } from './features/account/AccountContext';
import { AccountOverlays } from './features/account/AccountOverlays';
import './design/account-web.css';
import './design/vault.css';
import './design/auth.css';

/**
 * Route components are code-split (lazy) so the initial load — most often the
 * public Landing — doesn't ship the entire authenticated app (Vault, Upload,
 * Scan, Result and the heavy card-export rasterizer). Each route becomes its
 * own chunk, fetched on navigation.
 */
const Landing = lazy(() => import('./features/landing/Landing').then((m) => ({ default: m.Landing })));
const Upload = lazy(() => import('./features/upload/Upload').then((m) => ({ default: m.Upload })));
const Scan = lazy(() => import('./features/scan/Scan').then((m) => ({ default: m.Scan })));
const Result = lazy(() => import('./features/result/Result').then((m) => ({ default: m.Result })));
const Vault = lazy(() => import('./features/vault/Vault').then((m) => ({ default: m.Vault })));
const AccountInfo = lazy(() => import('./features/vault/AccountInfo').then((m) => ({ default: m.AccountInfo })));
const Pricing = lazy(() => import('./features/vault/Pricing').then((m) => ({ default: m.Pricing })));
const Settings = lazy(() => import('./features/vault/Settings').then((m) => ({ default: m.Settings })));
const AuthConfirm = lazy(() => import('./features/auth/AuthConfirm').then((m) => ({ default: m.AuthConfirm })));
const UpdatePassword = lazy(() => import('./features/auth/UpdatePassword').then((m) => ({ default: m.UpdatePassword })));

/**
 * Reset the window scroll to the top on every route (pathname) change. React
 * Router doesn't do this, so without it a page opened after scrolling down
 * (e.g. Landing → Vault) would inherit the previous page's scroll position.
 * Keyed on pathname only, so the Result page's hash-based tab switching
 * (#face/#outfit/#receipt) keeps its own scroll handling.
 */
function ScrollToTop() {
  const { pathname } = useLocation();
  useLayoutEffect(() => {
    // `instant` so a route change never animates, even when a page (the Landing)
    // sets `scroll-behavior: smooth` on <html> for its in-page anchor jumps.
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
  }, [pathname]);
  return null;
}

export function App() {
  return (
    <AccountProvider>
      <GenerationProvider>
        <ScrollToTop />
        <Suspense fallback={<div style={{ minHeight: '100dvh' }} aria-hidden="true" />}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/scan" element={<Upload />} />
            <Route path="/scan/run" element={<Scan />} />
            <Route path="/result" element={<Result />} />
            <Route path="/vault" element={<Vault />} />
            <Route path="/account" element={<AccountInfo />} />
            <Route path="/credits" element={<Pricing />} />
            <Route path="/settings" element={<Settings />} />
            {/* Redirects from the old account-area IA into the new vault. */}
            <Route path="/storage" element={<Navigate to="/settings" replace />} />
            <Route path="/results" element={<Navigate to="/vault" replace />} />
            <Route path="/auth/confirm" element={<AuthConfirm />} />
            <Route path="/auth/update-password" element={<UpdatePassword />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
        <AccountOverlays />
      </GenerationProvider>
    </AccountProvider>
  );
}
