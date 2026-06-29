import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { LoadingScreen } from '../components/shell/LoadingScreen';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { currentUser, isEmailVerified, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!currentUser) {
    return <Navigate to="/" replace />;
  }

  if (!isEmailVerified) {
    return <Navigate to="/verify-email" replace />;
  }

  return children;
}
