import '@testing-library/jest-dom/vitest';
import { act, render } from '@testing-library/react';
import { type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProgressProvider, useProgress } from './ProgressContext';
import type { ProblemSetSession } from './problemSessionProgress';
import type { WorkedExampleSession } from './workedExampleProgress';
import type { Stroke } from '../components/problem/inkGeometry';
import type { ProblemPlan } from '../content/problemSchema';

// Signed-in learner so the real cloud write path (saveUserCloudState ->
// toDocument -> setDoc, and the onSnapshot echo) is exercised.
vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ currentUser: { uid: 'u1' } }),
}));

// db must be truthy so the real cloudStore talks to (the faked) Firestore
// instead of taking its unconfigured no-op path.
vi.mock('../lib/firebase', () => ({
  db: { __fake: true },
  auth: null,
  isFirebaseConfigured: true,
}));

// A faithful Firestore: it enforces the real document constraints (no undefined
// values, no directly nested arrays, and the ~1 MiB per-document size limit) and
// models latency compensation with rollback. A rejected write rolls the cached
// document back to its prior value and re-emits it through onSnapshot, which is
// exactly how an in-progress optimistic save is silently lost.
const FIRESTORE_MAX_BYTES = 1_048_576;

const fire = vi.hoisted(() => ({
  store: new Map<string, unknown>(),
  listeners: new Map<string, Set<(snapshot: { exists: () => boolean; data: () => unknown }) => void>>(),
  writes: [] as Array<{ ok: boolean; bytes: number; error?: string }>,
}));

function snapshotFor(path: string) {
  const data = fire.store.get(path);
  return { exists: () => data !== undefined, data: () => data };
}

function notify(path: string) {
  fire.listeners.get(path)?.forEach((listener) => listener(snapshotFor(path)));
}

function assertFirestoreValue(value: unknown, path: string): void {
  if (value === undefined) {
    throw new Error(`Unsupported field value: undefined (found in field ${path || '<root>'})`);
  }
  if (value === null) return;
  if (Array.isArray(value)) {
    value.forEach((element, index) => {
      if (Array.isArray(element)) {
        throw new Error(`Nested arrays are not supported (found in field ${path}[${index}])`);
      }
      assertFirestoreValue(element, `${path}[${index}]`);
    });
    return;
  }
  if (typeof value === 'object') {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      assertFirestoreValue(child, path ? `${path}.${key}` : key);
    }
  }
}

vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, collection: string, id: string) => ({ path: `${collection}/${id}` }),
  onSnapshot: (
    ref: { path: string },
    onNext: (snapshot: { exists: () => boolean; data: () => unknown }) => void,
  ) => {
    let set = fire.listeners.get(ref.path);
    if (!set) {
      set = new Set();
      fire.listeners.set(ref.path, set);
    }
    set.add(onNext);
    onNext(snapshotFor(ref.path));
    return () => {
      set?.delete(onNext);
    };
  },
  setDoc: (ref: { path: string }, data: unknown) => {
    const previous = fire.store.get(ref.path);
    const bytes = new TextEncoder().encode(JSON.stringify(data)).length;
    try {
      assertFirestoreValue(data, '');
      if (bytes > FIRESTORE_MAX_BYTES) {
        throw new Error(`document exceeds the maximum allowed size (${bytes} > ${FIRESTORE_MAX_BYTES} bytes)`);
      }
    } catch (error) {
      fire.writes.push({ ok: false, bytes, error: (error as Error).message });
      // Firestore rolls the optimistic local write back and re-emits the prior
      // value; the strokes that were just drawn never reach the server.
      fire.store.set(ref.path, previous);
      notify(ref.path);
      return Promise.reject(error);
    }
    fire.writes.push({ ok: true, bytes });
    fire.store.set(ref.path, data);
    notify(ref.path);
    return Promise.resolve();
  },
  deleteDoc: (ref: { path: string }) => {
    fire.store.delete(ref.path);
    notify(ref.path);
    return Promise.resolve();
  },
}));

const KEY = 'coulombs-law:independent';

const probe: { current: null | ReturnType<typeof useProgress> } = { current: null };

function Probe() {
  probe.current = useProgress();
  return null;
}

function Tree({ children }: { children?: ReactNode }) {
  return <ProgressProvider>{children ?? <Probe />}</ProgressProvider>;
}

function sessionWith(strokes: Stroke[]): ProblemSetSession {
  return {
    index: 0,
    visitedCount: 1,
    solvedProblemIds: [],
    problemIds: ['p1'],
    work: {
      p1: {
        strokes,
        viewport: { scale: 1, tx: 0, ty: 0 },
        phase: 'solving',
        attempts: 0,
        hintTier: 0,
        hintsUsed: 0,
        result: null,
        hint: null,
        recorded: false,
      },
    },
  };
}

// A drawing of `pointCount` full-precision points, the way world-space pointer
// samples actually look once screen coordinates are mapped through the view.
function drawingOf(pointCount: number): Stroke[] {
  const points = Array.from({ length: pointCount }, (_unused, i) => ({
    x: i * 0.12345678901234567 + Math.PI,
    y: i * 0.98765432109876543 + Math.E,
    p: 0.3 + (i % 7) * 0.0918273645,
    t: 1000 + i * 16.673,
  }));
  return [{ id: 'stroke-1', points }];
}

beforeEach(() => {
  fire.store.clear();
  fire.listeners.clear();
  fire.writes = [];
  probe.current = null;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('cloud persistence of handwriting (real cloudStore against a faithful Firestore)', () => {
  it('persists a light drawing across a reload', () => {
    const { unmount } = render(<Tree />);

    act(() => {
      probe.current?.saveProblemSetSession(KEY, sessionWith(drawingOf(40)));
    });

    // Every write Firestore accepted, nothing rejected.
    expect(fire.writes.every((write) => write.ok)).toBe(true);

    // Reload: the provider tears down and a fresh one reads the stored document.
    unmount();
    render(<Tree />);

    const reloaded = probe.current?.getProblemSetSession(KEY);
    expect(reloaded?.work.p1?.strokes).toHaveLength(1);
  });

  it('persists a realistic full page of dense handwriting across a reload', () => {
    const { unmount } = render(<Tree />);

    // A learner who works a full problem on the whiteboard: dense Apple Pencil
    // sampling produces tens of thousands of world-space points per problem.
    act(() => {
      probe.current?.saveProblemSetSession(KEY, sessionWith(drawingOf(16000)));
    });

    const rejected = fire.writes.filter((write) => !write.ok);
    expect(rejected, `rejected writes: ${JSON.stringify(rejected)}`).toEqual([]);

    unmount();
    render(<Tree />);

    // The whole page of handwriting comes back, not a truncated or empty stroke.
    const reloaded = probe.current?.getProblemSetSession(KEY);
    expect(reloaded?.work.p1?.strokes?.[0]?.points.length).toBe(16000);
  });
});

describe('cloud persistence of worked-example progress (real cloudStore against a faithful Firestore)', () => {
  const APPLY_KEY = 'coulombs-law:apply:0';

  function workedSessionWith(explanation: string): WorkedExampleSession {
    return {
      revealedCount: 2,
      explanation,
      feedback: { isOnTrack: true, feedback: 'On the right track.' },
      feedbackError: null,
      checked: true,
    };
  }

  it('persists the revealed steps, explanation, and feedback across a reload', () => {
    const { unmount } = render(<Tree />);

    act(() => {
      probe.current?.saveWorkedExampleSession(APPLY_KEY, workedSessionWith('Forces are an equal/opposite pair.'));
    });

    // Firestore accepts the write (no undefined fields, well under the size cap).
    expect(fire.writes.every((write) => write.ok)).toBe(true);

    // Reload: tear the provider down and let a fresh one read the stored document.
    unmount();
    render(<Tree />);

    const reloaded = probe.current?.getWorkedExampleSession(APPLY_KEY);
    expect(reloaded?.revealedCount).toBe(2);
    expect(reloaded?.explanation).toBe('Forces are an equal/opposite pair.');
    expect(reloaded?.feedback?.isOnTrack).toBe(true);
    expect(reloaded?.checked).toBe(true);
  });

  it('drops a worked-example session when it is cleared', () => {
    const { unmount } = render(<Tree />);

    act(() => {
      probe.current?.saveWorkedExampleSession(APPLY_KEY, workedSessionWith('A first pass.'));
    });
    act(() => {
      probe.current?.clearWorkedExampleSession(APPLY_KEY);
    });

    unmount();
    render(<Tree />);

    expect(probe.current?.getWorkedExampleSession(APPLY_KEY)).toBeNull();
  });
});

describe('cloud persistence of generated plans (real cloudStore against a faithful Firestore)', () => {
  const PLAN_KEY = 'coulombs-law:review:v6';
  const plans: ProblemPlan[] = [
    { slotIndex: 0, title: 'Net force from two charges', description: 'Two point charges on a line; find the net force.' },
    { slotIndex: 1, title: 'Charge at equilibrium', description: 'Place a third charge where the net force is zero.' },
  ];

  it('persists a generated plan across a reload so resume regenerates the same set', () => {
    const { unmount } = render(<Tree />);

    act(() => {
      probe.current?.saveGeneratedPlan(PLAN_KEY, plans);
    });

    // Firestore accepts the write (no undefined fields, lists of maps allowed).
    expect(fire.writes.every((write) => write.ok)).toBe(true);

    // Reload: tear the provider down and let a fresh one read the stored document.
    unmount();
    render(<Tree />);

    expect(probe.current?.getGeneratedPlan(PLAN_KEY)).toEqual(plans);
  });
});

describe('per-problem XP through recordProblemResult (real ProgressContext against a faithful Firestore)', () => {
  // The exact shape ProblemPlayer sends on a correct solve.
  function solve(problemId: string) {
    act(() => {
      probe.current?.recordProblemResult({
        problemId,
        misconceptionIds: [],
        caught: true,
        solved: true,
        hintsUsed: 0,
        attempts: 1,
      });
    });
  }

  it('awards 50 XP on a first solve (into totalXp and todayXp) and nothing on a re-solve', () => {
    render(<Tree />);
    expect(probe.current?.totalXp).toBe(0);
    expect(probe.current?.todayXp).toBe(0);

    solve('coulombs-law:solve:0');
    expect(probe.current?.totalXp).toBe(50);
    expect(probe.current?.todayXp).toBe(50);

    // Returning to a solved problem and checking again records another attempt
    // but farms no XP — the award dedups on the stored solvedISO.
    solve('coulombs-law:solve:0');
    expect(probe.current?.totalXp).toBe(50);
    expect(probe.current?.todayXp).toBe(50);

    // The write Firestore accepted carries the earned XP, so it survives a reload.
    expect(fire.writes.every((write) => write.ok)).toBe(true);
  });

  it('totals ~550 XP for a full coulombs-law lesson (3 review + 2 apply + 6 solve), once each', () => {
    render(<Tree />);

    const gradedIds = [
      'coulombs-law:review:0',
      'coulombs-law:review:1',
      'coulombs-law:review:2',
      'coulombs-law:apply:0',
      'coulombs-law:apply:1',
      'syn:s1',
      'syn:s2',
      'syn:s3',
      'syn:s4',
      'syn:s5',
      'syn:s6',
    ];
    for (const id of gradedIds) {
      solve(id);
    }

    expect(gradedIds).toHaveLength(11);
    expect(probe.current?.totalXp).toBe(550);
    expect(probe.current?.todayXp).toBe(550);
    // 550 clears the 500 daily goal in a single lesson.
    expect(probe.current?.todayXp ?? 0).toBeGreaterThanOrEqual(probe.current?.dailyGoal ?? 0);
  });
});
