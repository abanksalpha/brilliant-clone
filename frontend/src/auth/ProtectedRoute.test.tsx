import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProtectedRoute } from './ProtectedRoute';
import { useAuth } from './AuthContext';

vi.mock('./AuthContext', () => ({
  useAuth: vi.fn(),
}));

const mockedUseAuth = vi.mocked(useAuth);

type AuthOverrides = {
  currentUser?: { uid: string; email: string } | null;
  isEmailVerified?: boolean;
  isLoading?: boolean;
};

function setAuth(overrides: AuthOverrides) {
  mockedUseAuth.mockReturnValue({
    currentUser: null,
    isEmailVerified: false,
    isLoading: false,
    ...overrides,
  } as ReturnType<typeof useAuth>);
}

function renderGuarded() {
  return render(
    <MemoryRouter initialEntries={['/secret']}>
      <Routes>
        <Route
          path="/secret"
          element={
            <ProtectedRoute>
              <div>Secret content</div>
            </ProtectedRoute>
          }
        />
        <Route path="/" element={<div>Landing page</div>} />
        <Route path="/login" element={<div>Login page</div>} />
        <Route path="/verify-email" element={<div>Verify page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProtectedRoute email verification gate', () => {
  beforeEach(() => {
    mockedUseAuth.mockReset();
  });

  it('shows a loading state while auth resolves', () => {
    setAuth({ isLoading: true });
    renderGuarded();
    expect(screen.getByText('Loading')).toBeInTheDocument();
  });

  it('redirects signed-out users to the landing page', () => {
    setAuth({ currentUser: null });
    renderGuarded();
    expect(screen.getByText('Landing page')).toBeInTheDocument();
  });

  it('redirects signed-in but unverified users to verify-email', () => {
    setAuth({ currentUser: { uid: 'u1', email: 'a@b.com' }, isEmailVerified: false });
    renderGuarded();
    expect(screen.getByText('Verify page')).toBeInTheDocument();
  });

  it('renders children for verified users', () => {
    setAuth({ currentUser: { uid: 'u1', email: 'a@b.com' }, isEmailVerified: true });
    renderGuarded();
    expect(screen.getByText('Secret content')).toBeInTheDocument();
  });
});
