import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getLessonById } from '../content';
import { ProgressProvider } from '../progress/ProgressContext';
import { completeCurrentStep } from '../test/lessonDriver';
import { LessonPage } from './LessonPage';

// This suite intentionally renders the REAL LessonPlayer (LessonCompletionProgress
// mocks it) so it exercises the LessonPage <-> ProgressContext loop: completing a
// lesson clears its saved session, and LessonPage must not let that flip the
// "initial" step back to 0 and bounce the learner to step 1.

const authState = vi.hoisted(() => ({
  currentUser: {
    uid: 'user-finish',
    email: 'finish@example.com',
  },
  logout: vi.fn(),
}));

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => authState,
}));

const cloud = vi.hoisted(() => {
  const EMPTY = {
    progress: {
      completedLessonIds: [] as string[],
      completionDates: {} as Record<string, string>,
      lastOpenedLessonId: null as string | null,
      answeredQuestionIds: [] as string[],
      questionXp: 0,
      dailyXp: {} as Record<string, number>,
    },
    lessonSessions: {} as Record<string, { stepIndex: number; maxVisitedStepIndex: number }>,
  };
  const states = new Map<string, typeof EMPTY>();
  const listeners = new Map<string, Set<(state: typeof EMPTY) => void>>();
  const get = (userId: string) => states.get(userId) ?? EMPTY;
  const notify = (userId: string) => listeners.get(userId)?.forEach((cb) => cb(get(userId)));
  const reset = () => states.clear();
  return { EMPTY, states, listeners, get, notify, reset };
});

vi.mock('../progress/cloudStore', () => ({
  EMPTY_CLOUD_STATE: cloud.EMPTY,
  subscribeUserCloudState: (userId: string, onChange: (state: unknown) => void) => {
    let set = cloud.listeners.get(userId);
    if (!set) {
      set = new Set();
      cloud.listeners.set(userId, set);
    }
    set.add(onChange as never);
    onChange(cloud.get(userId));
    return () => set!.delete(onChange as never);
  },
  saveUserCloudState: async (userId: string, state: unknown) => {
    cloud.states.set(userId, state as never);
    cloud.notify(userId);
  },
  resetUserCloudState: async (userId: string) => {
    cloud.states.delete(userId);
    cloud.notify(userId);
  },
}));

function renderLesson() {
  return render(
    <MemoryRouter initialEntries={['/lesson/coulombs-law']}>
      <ProgressProvider>
        <Routes>
          <Route path="/lesson/:lessonId" element={<LessonPage />} />
        </Routes>
      </ProgressProvider>
    </MemoryRouter>,
  );
}

describe('Lesson completion flow (real player)', () => {
  beforeEach(() => {
    authState.logout.mockReset();
    authState.currentUser = { uid: 'user-finish', email: 'finish@example.com' };
    cloud.reset();
  });

  it('shows the completion screen after finishing, instead of bouncing back to step 1', async () => {
    const user = userEvent.setup();
    const lesson = getLessonById('coulombs-law')!;

    renderLesson();

    for (const step of lesson.steps) {
      await completeCurrentStep(user, step);
    }

    expect(screen.getByText('You finished this topic.')).toBeInTheDocument();
    // The first step's copy must be gone: a regression here re-rendered step 1.
    expect(screen.queryByText(/pulled a sweater over your head/)).not.toBeInTheDocument();
    expect(cloud.get('user-finish').progress.completedLessonIds).toEqual(['coulombs-law']);
  });

  it('reopens a finished lesson with every screen visited and unlocked for review', async () => {
    const user = userEvent.setup();
    const lesson = getLessonById('coulombs-law')!;

    const finished = renderLesson();
    for (const step of lesson.steps) {
      await completeCurrentStep(user, step);
    }
    expect(screen.getByText('You finished this topic.')).toBeInTheDocument();
    finished.unmount();

    // Reopening from the dashboard should let the learner jump to any screen.
    renderLesson();
    const stepButtons = screen.getAllByRole('button', { name: /Go to screen/ });
    expect(stepButtons).toHaveLength(lesson.steps.length);
    for (const button of stepButtons) {
      expect(button).toBeEnabled();
    }
  });
});
