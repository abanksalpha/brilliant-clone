import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { ProgressProvider } from './progress/ProgressContext';
import { SocialProvider } from './social/SocialContext';
import { DashboardPage } from './pages/DashboardPage';
import { FriendsPage } from './pages/FriendsPage';
import { LandingPage } from './pages/LandingPage';
import { LessonPage } from './pages/LessonPage';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { VerifyEmailPage } from './pages/VerifyEmailPage';

export function App() {
  return (
    <ProgressProvider>
      <SocialProvider>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/friends"
            element={
              <ProtectedRoute>
                <FriendsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/lesson/:lessonId"
            element={
              <ProtectedRoute>
                <LessonPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </SocialProvider>
    </ProgressProvider>
  );
}
