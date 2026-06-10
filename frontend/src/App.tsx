import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ThemeModeProvider } from './context/ThemeModeContext';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';

function App() {
  return (
    <ThemeModeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ThemeModeProvider>
  );
}

export default App;
