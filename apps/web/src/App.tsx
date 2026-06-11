import { Routes, Route, Navigate } from 'react-router-dom';
import { GenerationProvider } from './state/generation';
import { AccountProvider } from './features/account/AccountContext';
import { AccountOverlays } from './features/account/AccountOverlays';
import { Vault } from './features/vault/Vault';
import { AccountInfo } from './features/vault/AccountInfo';
import { Pricing } from './features/vault/Pricing';
import { Settings } from './features/vault/Settings';
import { Landing } from './features/landing/Landing';
import { Upload } from './features/upload/Upload';
import { Scan } from './features/scan/Scan';
import { Result } from './features/result/Result';
import './design/account-web.css';
import './design/vault.css';

export function App() {
  return (
    <GenerationProvider>
      <AccountProvider>
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
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <AccountOverlays />
      </AccountProvider>
    </GenerationProvider>
  );
}
