import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const RESEND_COOLDOWN_SECONDS = 30;

function describeError(error: unknown, fallback: string) {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'auth/too-many-requests'
  ) {
    return 'Too many requests. Please wait a moment before trying again.';
  }

  return error instanceof Error ? error.message : fallback;
}

export function VerifyEmailPage() {
  const { currentUser, isConfigured, isEmailVerified, logout, reloadUser, resendVerification } =
    useAuth();
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    if (cooldown <= 0) {
      return;
    }

    const timer = window.setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  if (isEmailVerified) {
    return <Navigate to="/dashboard" replace />;
  }

  async function handleCheck() {
    setError('');
    setInfo('');
    setIsChecking(true);

    try {
      const verified = await reloadUser();
      if (verified) {
        navigate('/dashboard', { replace: true });
      } else {
        setInfo("Not verified yet. Click the link in your email, then try again.");
      }
    } catch (checkError) {
      setError(describeError(checkError, 'Could not check your status.'));
    } finally {
      setIsChecking(false);
    }
  }

  async function handleResend() {
    setError('');
    setInfo('');
    setIsResending(true);

    try {
      await resendVerification();
      setInfo('Verification email sent. Check your inbox (and spam).');
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (resendError) {
      setError(describeError(resendError, 'Could not resend the email.'));
    } finally {
      setIsResending(false);
    }
  }

  async function handleSwitchAccount() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <main className="auth-page theme-handdrawn theme-handdrawn--auth">
      <section className="auth-card" aria-labelledby="verify-title">
        <p className="eyebrow">APT</p>
        <h1 id="verify-title">Verify your email</h1>

        {!isConfigured ? (
          <p className="notice" role="status">
            Firebase config is missing. Add values to .env.local to use auth.
          </p>
        ) : null}

        <p>
          We sent a verification link to <strong>{currentUser.email}</strong>. Open it to
          activate your account, then come back here.
        </p>

        {info ? (
          <p className="notice" role="status">
            {info}
          </p>
        ) : null}

        {error ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="auth-actions">
          <button
            className="secondary-button"
            type="button"
            onClick={handleCheck}
            disabled={isChecking}
          >
            {isChecking ? 'Checking' : "I've verified \u2014 continue"}
          </button>

          <button
            className="secondary-link"
            type="button"
            onClick={handleResend}
            disabled={isResending || cooldown > 0}
          >
            {cooldown > 0
              ? `Resend email (${cooldown}s)`
              : isResending
                ? 'Sending'
                : 'Resend verification email'}
          </button>
        </div>

        <p className="auth-link">
          Wrong account?{' '}
          <button className="link-button" type="button" onClick={handleSwitchAccount}>
            Use a different account
          </button>
        </p>
      </section>
    </main>
  );
}
