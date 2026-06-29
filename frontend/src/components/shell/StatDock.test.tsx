import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProgressProvider } from '../../progress/ProgressContext';
import { StatDock } from './StatDock';

const authState = vi.hoisted(() => ({
  currentUser: { uid: 'u1', email: 'ada@physics-arcade.app' },
  logout: vi.fn(),
}));

vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => authState,
}));

const cloud = vi.hoisted(() => {
  type State = {
    progress: {
      completedLessonIds: string[];
      completionDates: Record<string, string>;
      lastOpenedLessonId: string | null;
      answeredQuestionIds: string[];
      questionXp: number;
      dailyXp: Record<string, number>;
    };
    lessonSessions: Record<string, { stepIndex: number; maxVisitedStepIndex: number }>;
  };
  const EMPTY: State = {
    progress: {
      completedLessonIds: [],
      completionDates: {},
      lastOpenedLessonId: null,
      answeredQuestionIds: [],
      questionXp: 0,
      dailyXp: {},
    },
    lessonSessions: {},
  };
  const states = new Map<string, State>();
  const listeners = new Map<string, Set<(state: State) => void>>();
  const get = (userId: string): State => states.get(userId) ?? EMPTY;
  const notify = (userId: string) => listeners.get(userId)?.forEach((cb) => cb(get(userId)));
  const push = (userId: string, state: State) => {
    states.set(userId, state);
    notify(userId);
  };
  const clearAll = () => {
    states.clear();
  };
  return { EMPTY, states, listeners, get, notify, push, clearAll };
});

vi.mock('../../progress/cloudStore', () => ({
  EMPTY_CLOUD_STATE: cloud.EMPTY,
  subscribeUserCloudState: (userId: string, onChange: (state: unknown) => void) => {
    let set = cloud.listeners.get(userId);
    if (!set) {
      set = new Set();
      cloud.listeners.set(userId, set);
    }
    set.add(onChange);
    onChange(cloud.get(userId));
    return () => set!.delete(onChange);
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

function todayStamp() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function renderDock() {
  return render(
    <ProgressProvider>
      <StatDock />
    </ProgressProvider>,
  );
}

describe('StatDock', () => {
  beforeEach(() => {
    authState.currentUser = { uid: 'u1', email: 'ada@physics-arcade.app' };
    cloud.clearAll();
  });

  it('shows streak and total XP from cloud progress', () => {
    const stamp = todayStamp();
    // Total XP is the single earned-XP counter (questionXp); lesson completion no
    // longer adds a bonus, so 60 earned XP shows as 60, not 180.
    cloud.states.set('u1', {
      progress: {
        completedLessonIds: ['coulombs-law'],
        completionDates: { 'coulombs-law': stamp },
        lastOpenedLessonId: 'coulombs-law',
        answeredQuestionIds: [],
        questionXp: 60,
        dailyXp: { [stamp]: 40 },
      },
      lessonSessions: {},
    });

    renderDock();

    expect(screen.getByText('60 XP')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('reacts to remote progress updates from another device', () => {
    renderDock();
    expect(screen.getByText('0 XP')).toBeInTheDocument();

    act(() => {
      // A sibling device records 120 earned XP (e.g. solving graded problems).
      cloud.push('u1', {
        progress: {
          completedLessonIds: ['coulombs-law'],
          completionDates: {},
          lastOpenedLessonId: null,
          answeredQuestionIds: [],
          questionXp: 120,
          dailyXp: {},
        },
        lessonSessions: {},
      });
    });

    expect(screen.getByText('120 XP')).toBeInTheDocument();
  });
});
