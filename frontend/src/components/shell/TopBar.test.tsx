import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TopBar } from './TopBar';

const authState = vi.hoisted(() => ({
  currentUser: { uid: 'u1', email: 'ada@physics-arcade.app' },
  logout: vi.fn(),
}));

vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => authState,
}));

function renderTopBar() {
  return render(
    <MemoryRouter>
      <TopBar />
    </MemoryRouter>,
  );
}

describe('TopBar', () => {
  beforeEach(() => {
    authState.logout.mockReset();
    authState.currentUser = { uid: 'u1', email: 'ada@physics-arcade.app' };
  });

  it('links to the friends page', () => {
    renderTopBar();
    expect(screen.getByRole('link', { name: 'Friends' })).toHaveAttribute('href', '/friends');
  });

  it('opens the account menu and signs out', () => {
    renderTopBar();

    fireEvent.click(screen.getByRole('button', { name: 'Account menu' }));
    const signout = screen.getByRole('menuitem', { name: /Sign out/ });
    fireEvent.click(signout);

    expect(authState.logout).toHaveBeenCalledTimes(1);
  });
});
