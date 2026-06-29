import '@testing-library/jest-dom/vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProgressProvider } from '../progress/ProgressContext';
import { DashboardPage } from './DashboardPage';
import { COURSE_LESSON_TOTAL } from '../content/courseMap';
import { DAILY_XP_GOAL } from '../progress/dashboardProgress';

const authState = vi.hoisted(() => ({
  currentUser: {
    uid: 'user-1',
    email: 'learner@example.com',
  },
  logout: vi.fn(),
}));

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => authState,
}));

type ProgressShape = {
  completedLessonIds: string[];
  completionDates: Record<string, string>;
  lastOpenedLessonId: string | null;
  answeredQuestionIds: string[];
  questionXp: number;
  dailyXp: Record<string, number>;
};

type CloudState = {
  progress: ProgressShape;
  lessonSessions: Record<string, { stepIndex: number; maxVisitedStepIndex: number }>;
};

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
  const config = { autoEmit: true };
  const get = (userId: string) => states.get(userId) ?? EMPTY;
  const notify = (userId: string) => listeners.get(userId)?.forEach((cb) => cb(get(userId)));
  const push = (userId: string, state: typeof EMPTY) => {
    states.set(userId, state);
    notify(userId);
  };
  const reset = () => {
    states.clear();
    config.autoEmit = true;
  };
  return { EMPTY, states, listeners, config, get, notify, push, reset };
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
    if (cloud.config.autoEmit) {
      onChange(cloud.get(userId));
    }
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

function makeState(progress: Partial<ProgressShape>, lessonSessions: CloudState['lessonSessions'] = {}): CloudState {
  return {
    progress: { ...cloud.EMPTY.progress, ...progress },
    lessonSessions,
  };
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

function todayStamp() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

describe('DashboardPage progression', () => {
  beforeEach(() => {
    authState.logout.mockReset();
    authState.currentUser = { uid: 'user-1', email: 'learner@example.com' };
    cloud.reset();
  });

  it('starts with the Coulomb lesson open and every later topic locked', () => {
    renderDashboard();

    const lesson1 = screen.getByText("Coulomb's Law").closest('li');

    expect(lesson1).toBeTruthy();
    expect(within(lesson1!).getByRole('link', { name: 'Start lesson' })).toBeInTheDocument();

    const potentialNode = screen.getByText('Electric Potential Energy').closest('li');
    expect(potentialNode?.className).toContain('path-node--locked');
    expect(within(potentialNode!).queryByRole('link')).toBeNull();

    const capacitorsNode = screen.getByText('Capacitors & Capacitance').closest('li');
    expect(capacitorsNode?.className).toContain('path-node--locked');
    expect(within(capacitorsNode!).queryByRole('link')).toBeNull();
  });

  it('renders one node per lesson, never a separate problem-set node', () => {
    renderDashboard();

    const lesson1 = screen.getByText("Coulomb's Law").closest('li')!;
    // The five-phase loop lives inside the lesson, so there is a single node and
    // no "Problem Set" sibling.
    expect(within(lesson1).getAllByRole('link')).toHaveLength(1);
    expect(screen.queryByText('Problem Set')).toBeNull();
    expect(screen.queryByText(/Misconception/i)).toBeNull();
    expect(screen.queryByText(/^Practice$/)).toBeNull();
  });

  it('marks every live lesson complete in dev mode and keeps faux lessons locked', () => {
    // Dev mode persists via localStorage; stub a working one with it enabled (the
    // URL-parsing path is covered by resolveDevMode's own tests).
    const store = new Map<string, string>([['apt.devMode', '1']]);
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, String(value));
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
      clear: () => store.clear(),
      key: () => null,
      length: 0,
    });

    try {
      renderDashboard();

      // Dev mode marks every built (live) lesson complete (blue) and clickable, so
      // the whole real path reads as done and is freely navigable.
      const chargingLi = screen.getByText('Charging, Conductors & Insulators').closest('li');
      expect(within(chargingLi!).getByRole('link')).toBeInTheDocument();
      expect(chargingLi?.className).toContain('path-node--complete');
      expect(chargingLi?.className).not.toContain('path-node--locked');
      expect(chargingLi?.className).not.toContain('path-node--active');

      // Faux/mock lessons (no built content) stay locked even in dev, and inert.
      const potentialNode = screen.getByText('Electric Potential Energy').closest('li');
      expect(potentialNode?.className).toContain('path-node--locked');
      expect(within(potentialNode!).queryByRole('link')).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('persists last opened lesson to the cloud when a learner starts a topic', () => {
    renderDashboard();

    const lesson1 = screen.getByText("Coulomb's Law").closest('li');
    expect(lesson1).toBeTruthy();

    fireEvent.click(within(lesson1!).getByRole('link', { name: 'Start lesson' }));

    expect(cloud.get('user-1').progress.lastOpenedLessonId).toBe('coulombs-law');
  });

  it('loads progress from the cloud when available', () => {
    cloud.states.set(
      'user-1',
      makeState({
        completedLessonIds: ['coulombs-law'],
        completionDates: { 'coulombs-law': '2026-06-20' },
        lastOpenedLessonId: 'coulombs-law',
        questionXp: 40,
        answeredQuestionIds: ['coulombs-law:2'],
      }),
    );

    renderDashboard();

    const lesson1 = screen.getByText("Coulomb's Law").closest('li');
    expect(lesson1).toBeTruthy();

    expect(within(lesson1!).getByRole('link', { name: 'Review lesson' })).toBeInTheDocument();
    expect(screen.getByText(`1/${COURSE_LESSON_TOTAL}`)).toBeInTheDocument();
    // Total XP is now the single earned-XP counter (questionXp); lesson
    // completion no longer adds a 120 bonus, so a learner with 40 earned XP and
    // one finished lesson shows 40, not 160.
    expect(screen.getByText('40')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'AP Physics C: Electricity and Magnetism' })).toBeInTheDocument();
  });

  it('shows a loading state until cloud progress resolves, then the resolved state', () => {
    cloud.config.autoEmit = false;

    renderDashboard();

    expect(screen.getByText('Loading')).toBeInTheDocument();
    expect(screen.queryByText("Coulomb's Law")).toBeNull();

    act(() => {
      cloud.push(
        'user-1',
        makeState({
          completedLessonIds: ['coulombs-law'],
          completionDates: { 'coulombs-law': '2026-06-20' },
          lastOpenedLessonId: 'coulombs-law',
        }),
      );
    });

    const lessonNode = screen.getByText("Coulomb's Law").closest('li');
    expect(lessonNode?.className).toContain('path-node--complete');
    expect(screen.queryByText('Loading')).toBeNull();
  });

  it('plays the course intro on arrival but suppresses it when returning from a lesson', () => {
    // Normalize the module-level guard regardless of prior tests: every mount
    // consumes (clears) the flag in its effect, so this leaves it cleared.
    renderDashboard().unmount();

    // Arrival (login / first visit / refresh): the intro should run.
    const arrival = renderDashboard();
    expect(arrival.container.querySelector('.home')?.className).toContain('home--intro');

    // Opening a lesson marks the next dashboard view as a lesson return.
    fireEvent.click(screen.getByRole('link', { name: 'Start lesson' }));
    arrival.unmount();

    // Coming back from the lesson: the intro should be suppressed.
    const back = renderDashboard();
    expect(back.container.querySelector('.home')?.className).not.toContain('home--intro');

    // A later non-lesson arrival should play again (flag was consumed).
    back.unmount();
    const reArrival = renderDashboard();
    expect(reArrival.container.querySelector('.home')?.className).toContain('home--intro');
  });

  it("turns today's goal card green when daily XP surpasses the goal", () => {
    const surpassing = DAILY_XP_GOAL + 10;
    cloud.states.set(
      'user-1',
      makeState({
        dailyXp: { [todayStamp()]: surpassing },
      }),
    );

    renderDashboard();

    const goalCard = screen.getByText("Today's goal").closest('.home-stat');
    expect(goalCard?.className).toContain('home-stat--goal-met');
    expect(screen.queryByText(`${surpassing}/${DAILY_XP_GOAL}`)).not.toBeNull();
  });

  it("turns today's goal card green when daily XP exactly reaches the goal", () => {
    cloud.states.set(
      'user-1',
      makeState({
        dailyXp: { [todayStamp()]: DAILY_XP_GOAL },
      }),
    );

    renderDashboard();

    const goalCard = screen.getByText("Today's goal").closest('.home-stat');
    expect(goalCard?.className).toContain('home-stat--goal-met');
  });
});
