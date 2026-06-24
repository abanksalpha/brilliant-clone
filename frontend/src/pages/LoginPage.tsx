import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { GoogleSignInButton } from '../auth/GoogleSignInButton';
import { isCancelledPopupError } from '../auth/authErrors';

type LocationState = {
  from?: {
    pathname?: string;
  };
};

export function LoginPage() {
  const { currentUser, isConfigured, login, loginWithGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as LocationState | null;
  const returnPath = state?.from?.pathname ?? '/dashboard';

  if (currentUser) {
    return <Navigate to="/dashboard" replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      await login(email, password);
      navigate(returnPath, { replace: true });
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Sign in failed.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleGoogle() {
    setError('');
    setIsGoogleSubmitting(true);

    try {
      await loginWithGoogle();
      navigate(returnPath, { replace: true });
    } catch (authError) {
      if (!isCancelledPopupError(authError)) {
        setError(authError instanceof Error ? authError.message : 'Google sign in failed.');
      }
    } finally {
      setIsGoogleSubmitting(false);
    }
  }

  return (
    <main className="auth-page theme-handdrawn theme-handdrawn--auth">
      <section className="auth-card" aria-labelledby="login-title">
        <h1 id="login-title">Sign in</h1>

        {!isConfigured ? (
          <p className="notice" role="status">
            Firebase config is missing. Add values to .env.local to use auth.
          </p>
        ) : null}

        <GoogleSignInButton
          label="Continue with Google"
          onClick={handleGoogle}
          disabled={isGoogleSubmitting || isSubmitting || !isConfigured}
        />

        <div className="auth-divider" aria-hidden="true">
          <span>or</span>
        </div>

        <form className="form" onSubmit={handleSubmit}>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />

          {error ? (
            <p className="error" role="alert">
              {error}
            </p>
          ) : null}

          <button type="submit" disabled={isSubmitting || isGoogleSubmitting || !isConfigured}>
            {isSubmitting ? 'Signing in' : 'Sign in'}
          </button>
        </form>

        <p className="auth-link">
          Need an account? <Link to="/signup">Create one</Link>
        </p>
      </section>
    </main>
  );
}
