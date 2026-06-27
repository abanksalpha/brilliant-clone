import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useEffect, useState } from 'react';
import { XP_PER_QUESTION } from '../progress/dashboardProgress';
import { ProgressProvider } from '../progress/ProgressContext';
import { DashboardPage } from './DashboardPage';
import { LessonPage } from './LessonPage';

const authState = vi.hoisted(() => ({
  currentUser: {
    uid: 'user-progress',
    email: 'progress@example.com',
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

vi.mock('../components/lesson/LessonPlayer', () => ({
  LessonPlayer: ({
    initialStepIndex = 0,
    initialVisitedStepCount,
    lesson,
    onLessonComplete,
    onQuestionAnswered,
    onStepChange,
  }: {
    initialStepIndex?: number;
    initialVisitedStepCount?: number;
    lesson: { lessonId: string; title: string };
    onLessonComplete?: (lessonId: string) => number | void;
    onQuestionAnswered?: (lessonId: string, stepNumber: number) => number | void;
    onStepChange?: (lessonId: string, nextStepIndex: number, maxVisitedStepIndex?: number) => void;
  }) => {
    const [stepIndex, setStepIndex] = useState(initialStepIndex);
    const [maxVisitedStepIndex, setMaxVisitedStepIndex] = useState(
      Math.max(initialStepIndex, (initialVisitedStepCount ?? initialStepIndex + 1) - 1),
    );
    const [awardedXp, setAwardedXp] = useState(0);

    useEffect(() => {
      setStepIndex(initialStepIndex);
      setMaxVisitedStepIndex(Math.max(initialStepIndex, (initialVisitedStepCount ?? initialStepIndex + 1) - 1));
    }, [initialStepIndex, initialVisitedStepCount, lesson.lessonId]);

    return (
      <section>
        <h2>{lesson.title}</h2>
        <p data-testid="mock-step-index">{stepIndex}</p>
        <button
          type="button"
          onClick={() => {
            const nextStep = stepIndex + 1;
            const nextMaxVisitedStepIndex = Math.max(maxVisitedStepIndex, nextStep);
            setStepIndex(nextStep);
            setMaxVisitedStepIndex(nextMaxVisitedStepIndex);
            onStepChange?.(lesson.lessonId, nextStep, nextMaxVisitedStepIndex);
          }}
        >
          Advance mocked step
        </button>
        <button
          type="button"
          onClick={() => {
            const nextStep = Math.max(stepIndex - 1, 0);
            setStepIndex(nextStep);
            onStepChange?.(lesson.lessonId, nextStep, maxVisitedStepIndex);
          }}
        >
          Go back mocked step
        </button>
        <button
          type="button"
          onClick={() => {
            const earned = onQuestionAnswered?.(lesson.lessonId, 2) ?? 0;
            setAwardedXp(earned);
          }}
        >
          Answer mocked question
        </button>
        <button type="button" onClick={() => onLessonComplete?.(lesson.lessonId)}>
          Finish mocked lesson
        </button>
        <p data-testid="mock-awarded-xp">{awardedXp}</p>
        <p data-testid="mock-visited-step-count">{maxVisitedStepIndex + 1}</p>
      </section>
    );
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

function renderDashboard() {
  return render(
    <MemoryRouter>
      <ProgressProvider>
        <DashboardPage />
      </ProgressProvider>
    </MemoryRouter>,
  );
}

describe('Lesson completion progress wiring', () => {
  beforeEach(() => {
    authState.logout.mockReset();
    authState.currentUser = {
      uid: 'user-progress',
      email: 'progress@example.com',
    };
    cloud.reset();
  });

  it('marks the lesson complete from LessonPage and shows it as reviewable on the dashboard', () => {
    const lessonView = renderLesson();

    fireEvent.click(screen.getByRole('button', { name: 'Finish mocked lesson' }));

    expect(cloud.get('user-progress').progress.completedLessonIds).toEqual(['coulombs-law']);

    lessonView.unmount();

    renderDashboard();

    const lesson1 = screen.getByText("Coulomb's Law").closest('li');
    expect(lesson1).toBeTruthy();
    expect(within(lesson1!).getByRole('link', { name: 'Review lesson' })).toBeInTheDocument();
  });

  it('persists in-lesson step progress and resumes from it', () => {
    const lessonView = renderLesson();

    fireEvent.click(screen.getByRole('button', { name: 'Advance mocked step' }));
    fireEvent.click(screen.getByRole('button', { name: 'Advance mocked step' }));
    expect(screen.getByTestId('mock-step-index')).toHaveTextContent('2');

    expect(cloud.get('user-progress').lessonSessions['coulombs-law']).toEqual({
      stepIndex: 2,
      maxVisitedStepIndex: 2,
    });

    lessonView.unmount();

    renderLesson();

    expect(screen.getByTestId('mock-step-index')).toHaveTextContent('2');
    expect(screen.getByTestId('mock-visited-step-count')).toHaveTextContent('3');
  });

  it('resumes a completed lesson on the page last seen instead of resetting to the start', () => {
    const lessonView = renderLesson();

    fireEvent.click(screen.getByRole('button', { name: 'Advance mocked step' }));
    fireEvent.click(screen.getByRole('button', { name: 'Advance mocked step' }));
    expect(screen.getByTestId('mock-step-index')).toHaveTextContent('2');

    fireEvent.click(screen.getByRole('button', { name: 'Finish mocked lesson' }));
    expect(cloud.get('user-progress').progress.completedLessonIds).toEqual(['coulombs-law']);
    expect(cloud.get('user-progress').lessonSessions['coulombs-law']).toEqual({
      stepIndex: 2,
      maxVisitedStepIndex: 2,
    });

    lessonView.unmount();

    renderLesson();

    expect(screen.getByTestId('mock-step-index')).toHaveTextContent('2');
  });

  it('persists visited screens even after navigating back and reopening the lesson', () => {
    const lessonView = renderLesson();

    fireEvent.click(screen.getByRole('button', { name: 'Advance mocked step' }));
    fireEvent.click(screen.getByRole('button', { name: 'Advance mocked step' }));
    fireEvent.click(screen.getByRole('button', { name: 'Go back mocked step' }));
    expect(screen.getByTestId('mock-step-index')).toHaveTextContent('1');
    expect(screen.getByTestId('mock-visited-step-count')).toHaveTextContent('3');

    lessonView.unmount();

    renderLesson();

    expect(screen.getByTestId('mock-step-index')).toHaveTextContent('1');
    expect(screen.getByTestId('mock-visited-step-count')).toHaveTextContent('3');
  });

  it('isolates lesson session persistence by account and keeps it after completion', () => {
    authState.currentUser = {
      uid: 'user-progress',
      email: 'progress@example.com',
    };

    const firstAccount = renderLesson();

    fireEvent.click(screen.getByRole('button', { name: 'Advance mocked step' }));
    expect(screen.getByTestId('mock-step-index')).toHaveTextContent('1');
    expect(screen.getByTestId('mock-visited-step-count')).toHaveTextContent('2');
    firstAccount.unmount();

    authState.currentUser = {
      uid: 'user-second',
      email: 'second@example.com',
    };

    const secondAccount = renderLesson();

    expect(screen.getByTestId('mock-step-index')).toHaveTextContent('0');
    expect(screen.getByTestId('mock-visited-step-count')).toHaveTextContent('1');
    fireEvent.click(screen.getByRole('button', { name: 'Advance mocked step' }));
    fireEvent.click(screen.getByRole('button', { name: 'Finish mocked lesson' }));
    expect(cloud.get('user-second').lessonSessions).toEqual({
      'coulombs-law': { stepIndex: 1, maxVisitedStepIndex: 1 },
    });
    secondAccount.unmount();

    authState.currentUser = {
      uid: 'user-progress',
      email: 'progress@example.com',
    };

    renderLesson();

    expect(screen.getByTestId('mock-step-index')).toHaveTextContent('1');
  });

  it('awards question XP once per question and keeps it account-scoped', () => {
    const firstAccount = renderLesson();

    fireEvent.click(screen.getByRole('button', { name: 'Answer mocked question' }));
    expect(screen.getByTestId('mock-awarded-xp')).toHaveTextContent(String(XP_PER_QUESTION));

    fireEvent.click(screen.getByRole('button', { name: 'Answer mocked question' }));
    expect(screen.getByTestId('mock-awarded-xp')).toHaveTextContent('0');

    expect(cloud.get('user-progress').progress.questionXp).toBe(XP_PER_QUESTION);
    expect(cloud.get('user-progress').progress.answeredQuestionIds).toContain('coulombs-law:2');
    firstAccount.unmount();

    authState.currentUser = {
      uid: 'user-second',
      email: 'second@example.com',
    };

    const secondAccount = renderLesson();

    fireEvent.click(screen.getByRole('button', { name: 'Answer mocked question' }));
    expect(cloud.get('user-second').progress.questionXp).toBe(XP_PER_QUESTION);
    secondAccount.unmount();
  });
});
