import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { App } from './App';
import './styles/tokens.css';
import './styles.css';

// Progress now lives in Firestore. Remove any progress/XP/streak/session data
// that earlier builds left in localStorage so nothing learner-specific persists
// on-device.
function clearLegacyLocalProgress() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }

  try {
    const legacyPrefixes = ['physics-arcade.dashboard.progress.', 'physics-arcade.lesson.session.'];
    const staleKeys: string[] = [];
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (key && legacyPrefixes.some((prefix) => key.startsWith(prefix))) {
        staleKeys.push(key);
      }
    }
    staleKeys.forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // Ignore environments where localStorage is unavailable.
  }
}

clearLegacyLocalProgress();

// Dev-only: expose window.resetCoulombToLastScreen() for testing. Excluded from
// production builds (the static DEV check drops the dynamic import).
if (import.meta.env.DEV) {
  void import('./dev/devReset');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
