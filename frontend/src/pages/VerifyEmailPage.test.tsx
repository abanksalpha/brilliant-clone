import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VerifyEmailPage } from './VerifyEmailPage';

const authState = vi.hoisted(() => ({
  currentUser: null as { email: string } | null,
  isConfigured: true,
  isEmailVerified: false,
  logout: vi.fn(),
  reloadUser: vi.fn(),
  resendVerification: vi.fn(),
}));

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => authState,
}));

function renderVerifyPage() {
  return render(
    <MemoryRouter initialEntries={['/verify-email']}>
      <Routes>
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/login" element={<div>Login page</div>} />
        <Route path="/dashboard" element={<div>Dashboard page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('VerifyEmailPage', () => {
  beforeEach(() => {
    authState.currentUser = { email: 'learner@example.com' };
    authState.isConfigured = true;
    authState.isEmailVerified = false;
    authState.logout.mockReset().mockResolvedValue(undefined);
    authState.reloadUser.mockReset().mockResolvedValue(false);
    authState.resendVerification.mockReset().mockResolvedValue(undefined);
  });

  it('redirects to login when signed out', () => {
    authState.currentUser = null;
    renderVerifyPage();
    expect(screen.getByText('Login page')).toBeInTheDocument();
  });

  it('redirects to dashboard when already verified', () => {
    authState.isEmailVerified = true;
    renderVerifyPage();
    expect(screen.getByText('Dashboard page')).toBeInTheDocument();
  });

  it('shows the pending-verification screen with the user email', () => {
    renderVerifyPage();
    expect(screen.getByRole('main')).toHaveClass('auth-page', 'theme-handdrawn');
    expect(screen.getByRole('heading', { name: 'Verify your email' })).toBeInTheDocument();
    expect(screen.getByText('learner@example.com')).toBeInTheDocument();
  });

  it('resends the verification email and confirms', async () => {
    const user = userEvent.setup();
    renderVerifyPage();

    await user.click(screen.getByRole('button', { name: /resend verification email/i }));

    expect(authState.resendVerification).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(/verification email sent/i)).toBeInTheDocument();
  });

  it('routes to the dashboard once verification is confirmed', async () => {
    authState.reloadUser.mockResolvedValue(true);
    const user = userEvent.setup();
    renderVerifyPage();

    await user.click(screen.getByRole('button', { name: /i've verified/i }));

    expect(authState.reloadUser).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Dashboard page')).toBeInTheDocument();
  });

  it('explains when verification is still pending', async () => {
    authState.reloadUser.mockResolvedValue(false);
    const user = userEvent.setup();
    renderVerifyPage();

    await user.click(screen.getByRole('button', { name: /i've verified/i }));

    expect(await screen.findByText(/not verified yet/i)).toBeInTheDocument();
  });
});
