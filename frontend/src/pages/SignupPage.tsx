import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { GoogleSignInButton } from '../auth/GoogleSignInButton';
import { isCancelledPopupError } from '../auth/authErrors';

export function SignupPage() {
  const { currentUser, isConfigured, loginWithGoogle, signup } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const navigate = useNavigate();

  if (currentUser) {
    return <Navigate to="/dashboard" replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      await signup(email, password);
      navigate('/verify-email', { replace: true });
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Sign up failed.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleGoogle() {
    setError('');
    setIsGoogleSubmitting(true);

    try {
      await loginWithGoogle();
      navigate('/dashboard', { replace: true });
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
      <section className="auth-card" aria-labelledby="signup-title">
        <h1 id="signup-title">Create account</h1>

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
          <label htmlFor="signup-email">Email</label>
          <input
            id="signup-email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />

          <label htmlFor="signup-password">Password</label>
          <input
            id="signup-password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={6}
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
            {isSubmitting ? 'Creating account' : 'Create account'}
          </button>
        </form>

        <p className="auth-link">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </section>
    </main>
  );
}
