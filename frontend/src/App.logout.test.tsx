import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuth } from './auth/AuthContext';
import { App } from './App';

vi.mock('./auth/AuthContext', () => ({
  useAuth: vi.fn(),
}));

// Keep Firestore out of this routing test; the cloud store no-ops when db is null.
vi.mock('./lib/firebase', () => ({
  auth: null,
  googleProvider: {},
  isFirebaseConfigured: false,
  db: null,
}));

const mockedUseAuth = vi.mocked(useAuth);

function setUser(currentUser: { uid: string; email: string } | null) {
  mockedUseAuth.mockReturnValue({
    currentUser,
    isConfigured: true,
    isEmailVerified: true,
    isLoading: false,
    login: vi.fn(),
    loginWithGoogle: vi.fn(),
    logout: vi.fn(),
    reloadUser: vi.fn(),
    resendVerification: vi.fn(),
    signup: vi.fn(),
  } as unknown as ReturnType<typeof useAuth>);
}

const landingHeading = { name: /interactive lessons for ap classes/i } as const;

describe('App auth redirect', () => {
  beforeEach(() => {
    mockedUseAuth.mockReset();
  });

  it('returns to the landing page when the user signs out from the dashboard', () => {
    setUser({ uid: 'u1', email: 'ada@b.com' });

    const { rerender } = render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.queryByRole('heading', landingHeading)).not.toBeInTheDocument();

    setUser(null);
    rerender(
      <MemoryRouter initialEntries={['/dashboard']}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', landingHeading)).toBeInTheDocument();
  });

  it('shows the landing page when a signed-out visitor opens a protected route', () => {
    setUser(null);

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', landingHeading)).toBeInTheDocument();
  });
});
