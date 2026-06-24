import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { currentUser, isEmailVerified, isLoading } = useAuth();

  if (isLoading) {
    return <main className="centered-page">Loading</main>;
  }

  if (!currentUser) {
    return <Navigate to="/" replace />;
  }

  if (!isEmailVerified) {
    return <Navigate to="/verify-email" replace />;
  }

  return children;
}
