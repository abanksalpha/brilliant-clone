import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LandingPage } from './LandingPage';

const authState = vi.hoisted(() => ({ currentUser: null as { uid: string } | null }));
vi.mock('../auth/AuthContext', () => ({ useAuth: () => authState }));

const progressState = vi.hoisted(() => ({
  progress: { lastOpenedLessonId: null as string | null, completedLessonIds: [] as string[] },
  isLoading: false,
}));
vi.mock('../progress/ProgressContext', () => ({ useProgress: () => progressState }));

function renderLanding() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/dashboard" element={<div>dashboard page</div>} />
        <Route path="/lesson/:lessonId" element={<div>lesson page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('LandingPage', () => {
  beforeEach(() => {
    authState.currentUser = null;
    progressState.progress = { lastOpenedLessonId: null, completedLessonIds: [] };
    progressState.isLoading = false;
  });

  it('shows the marketing page when signed out', () => {
    renderLanding();
    expect(
      screen.getByRole('heading', { name: /Interactive lessons for AP classes/i }),
    ).toBeInTheDocument();
  });

  it('resumes the most recently opened, unfinished lesson when signed in', () => {
    authState.currentUser = { uid: 'u1' };
    progressState.progress = { lastOpenedLessonId: 'coulombs-law', completedLessonIds: [] };

    renderLanding();

    expect(screen.getByText('lesson page')).toBeInTheDocument();
  });

  it('goes to the dashboard when the most recent lesson is already finished', () => {
    authState.currentUser = { uid: 'u1' };
    progressState.progress = { lastOpenedLessonId: 'coulombs-law', completedLessonIds: ['coulombs-law'] };

    renderLanding();

    expect(screen.getByText('dashboard page')).toBeInTheDocument();
  });

  it('goes to the dashboard when no lesson has been opened', () => {
    authState.currentUser = { uid: 'u1' };

    renderLanding();

    expect(screen.getByText('dashboard page')).toBeInTheDocument();
  });

  it('waits (renders nothing) while cloud progress is still loading', () => {
    authState.currentUser = { uid: 'u1' };
    progressState.isLoading = true;

    const { container } = renderLanding();

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText('dashboard page')).not.toBeInTheDocument();
    expect(screen.queryByText('lesson page')).not.toBeInTheDocument();
  });
});
