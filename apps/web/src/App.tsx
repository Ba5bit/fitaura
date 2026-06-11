import { Routes, Route, Navigate } from 'react-router-dom';
import { GenerationProvider } from './state/generation';
import { AccountProvider } from './features/account/AccountContext';
import { AccountOverlays } from './features/account/AccountOverlays';
import { AccountDashboard } from './features/account/AccountDashboard';
import { CreditsPage } from './features/account/CreditsPage';
import { StoragePage } from './features/account/StoragePage';
import { ResultsPage } from './features/account/ResultsPage';
import { Landing } from './features/landing/Landing';
import { Upload } from './features/upload/Upload';
import { Scan } from './features/scan/Scan';
import { Result } from './features/result/Result';
import './design/account-web.css';

export function App() {
  return (
    <GenerationProvider>
      <AccountProvider>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/scan" element={<Upload />} />
          <Route path="/scan/run" element={<Scan />} />
          <Route path="/result" element={<Result />} />
          <Route path="/account" element={<AccountDashboard />} />
          <Route path="/credits" element={<CreditsPage />} />
          <Route path="/storage" element={<StoragePage />} />
          <Route path="/results" element={<ResultsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <AccountOverlays />
      </AccountProvider>
    </GenerationProvider>
  );
}
