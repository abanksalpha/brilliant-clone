import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { AuthProvider } from './auth/AuthContext';
import { App } from './App';

vi.mock('./lib/firebase', () => ({
  auth: null,
  googleProvider: {},
  isFirebaseConfigured: false,
  db: null,
}));

function renderRoute(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('Stage 1 routing shell', () => {
  it('renders the login route', () => {
    renderRoute('/login');

    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveClass('auth-page', 'theme-handdrawn');
  });

  it('renders the signup route', () => {
    renderRoute('/signup');

    expect(screen.getByRole('heading', { name: 'Create account' })).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveClass('auth-page', 'theme-handdrawn');
  });

  it('sends signed-out visitors from the dashboard to the landing page', async () => {
    renderRoute('/dashboard');

    expect(
      await screen.findByRole('heading', { name: /interactive lessons for ap classes/i }),
    ).toBeInTheDocument();
  });

  it('sends signed-out visitors from a lesson to the landing page', async () => {
    renderRoute('/lesson/coulombs-law');

    expect(
      await screen.findByRole('heading', { name: /interactive lessons for ap classes/i }),
    ).toBeInTheDocument();
  });
});
