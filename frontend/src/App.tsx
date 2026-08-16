import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { LocaleProvider } from './context/LocaleContext';
import { ThemeModeProvider } from './context/ThemeModeContext';
import { ActivityPage } from './pages/ActivityPage';
import { HomePage } from './pages/HomePage';
import { KpiPage } from './pages/KpiPage';
import { LoginPage } from './pages/LoginPage';
import { LoginSsoCallbackPage } from './pages/LoginSsoCallbackPage';

function App() {
  return (
    <LocaleProvider>
      <ThemeModeProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/activity" element={<ActivityPage />} />
            <Route path="/kpi" element={<KpiPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/login/sso/callback" element={<LoginSsoCallbackPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ThemeModeProvider>
    </LocaleProvider>
  );
}

export default App;
