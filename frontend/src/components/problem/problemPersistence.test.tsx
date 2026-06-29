import '@testing-library/jest-dom/vitest';
import { act, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { type ForwardedRef, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProblemPlayer } from './ProblemPlayer';
import { AuthProvider } from '../../auth/AuthContext';
import { ProgressProvider, useProgress } from '../../progress/ProgressContext';
import { EMPTY_CLOUD_STATE, toDocument } from '../../progress/cloudStore';
import {
  normalizeProblemSessions,
  type ProblemSetSession,
} from '../../progress/problemSessionProgress';
import type { Problem } from '../../content/problems';
import type { Stroke } from './inkGeometry';

// A faithful, stroke-capturing InkCanvas mock. It mirrors the real canvas: it
// keeps an internal stroke store, getStrokes returns it, setStrokes replaces it,
// and the test can fire onStrokesChange to simulate the student drawing (which,
// like the real canvas, updates the internal store and notifies the parent).
const inkStore = vi.hoisted(() => ({ strokes: [] as unknown[] }));
const inkProps = vi.hoisted(
  () => ({ current: null }) as { current: null | { onStrokesChange?: (strokes: unknown[]) => void } },
);
const setStrokesSpy = vi.hoisted(() => vi.fn());

vi.mock('./InkCanvas', async () => {
  const { forwardRef, useImperativeHandle } = await import('react');
  return {
    InkCanvas: forwardRef(
      (
        props: { className?: string; onStrokesChange?: (strokes: unknown[]) => void },
        ref: ForwardedRef<unknown>,
      ) => {
        inkProps.current = props;
        useImperativeHandle(ref, () => ({
          getStrokeLines: () => [],
          toPngBase64: () => 'cG5nLWRhdGE=',
          annotate: () => {},
          clear: () => {},
          resetView: () => {},
          undo: () => {},
          redo: () => {},
          getStrokes: () => inkStore.strokes.slice(),
          setStrokes: (strokes: unknown[]) => {
            setStrokesSpy(strokes);
            inkStore.strokes = strokes.slice();
          },
          getViewport: () => ({ scale: 1, tx: 0, ty: 0 }),
          setViewport: () => {},
        }));
        return <div data-testid="ink-canvas" />;
      },
    ),
  };
});

vi.mock('./PdfViewer', () => ({ default: () => <div data-testid="pdf-viewer" /> }));

vi.mock('../../lib/grading', () => ({
  gradeAttempt: vi.fn(),
  getHint: vi.fn(),
  askQuestion: vi.fn(),
}));

const PROBLEM: Problem = {
  problemId: 'p1',
  lessonId: 'coulombs-law',
  unitId: 'electrostatics',
  skillIds: ['coulombs-law'],
  principleIds: ['field-concept'],
  title: 'First problem title',
  prompt: 'Find the field at point P.',
  misconceptionTags: ['inverse-square-error'],
  kind: 'single',
  difficulty: 2,
  difficultyBand: 2,
  difficultyFeatures: { steps: 4, symbolic: false, calculus: false, multiPart: false, hasTrap: true },
  provenance: 'authored',
};

const KEY = 'coulombs-law:independent';

const sampleStrokes: Stroke[] = [
  {
    id: 'stroke-1',
    points: [
      { x: 10, y: 12, p: 0.5, t: 1000 },
      { x: 20, y: 22, p: 0.6, t: 1016 },
    ],
  },
];

// A probe that exposes the live progress selectors to the test body, so the
// persisted session can be read the way a returning lesson would read it.
const probe: { current: null | ReturnType<typeof useProgress> } = { current: null };

function Harness({ mounted }: { mounted: boolean }) {
  const progress = useProgress();
  probe.current = progress;
  const { getProblemSetSession, saveProblemSetSession, clearProblemSetSession } = progress;
  if (!mounted) return <div data-testid="left-lesson" />;
  return (
    <ProblemPlayer
      problems={[PROBLEM]}
      title="Solve"
      hideProgressChrome
      initialSession={getProblemSetSession(KEY)}
      onSessionChange={(session) => saveProblemSetSession(KEY, session)}
      onSessionClear={() => clearProblemSetSession(KEY)}
    />
  );
}

function Tree({ mounted }: { mounted: boolean }) {
  return (
    <MemoryRouter>
      <AuthProvider>
        <ProgressProvider>
          <Harness mounted={mounted} />
        </ProgressProvider>
      </AuthProvider>
    </MemoryRouter>
  );
}

function draw(strokes: Stroke[]) {
  act(() => {
    inkStore.strokes = strokes.slice();
    inkProps.current?.onStrokesChange?.(strokes.slice());
  });
}

beforeEach(() => {
  inkStore.strokes = [];
  inkProps.current = null;
  setStrokesSpy.mockClear();
  probe.current = null;
});

describe('lesson handwriting persistence (Solve phase wiring)', () => {
  it('keeps the strokes in the saved session after the student leaves (unmount)', () => {
    const { rerender } = render(<Tree mounted={true} />);

    // Student writes on the whiteboard.
    draw(sampleStrokes);

    // Student leaves the lesson (the ProblemPlayer unmounts, which flushes).
    act(() => {
      rerender(<Tree mounted={false} />);
    });

    const saved = probe.current?.getProblemSetSession(KEY);
    expect(saved).not.toBeNull();
    expect(saved?.work.p1?.strokes).toEqual(sampleStrokes);
  });

  it('restores the strokes into the canvas when the student comes back (remount)', () => {
    const { rerender } = render(<Tree mounted={true} />);

    draw(sampleStrokes);
    act(() => {
      rerender(<Tree mounted={false} />);
    });

    // Coming back into the lesson remounts the player, which should hydrate the
    // canvas with the saved handwriting.
    setStrokesSpy.mockClear();
    act(() => {
      rerender(<Tree mounted={true} />);
    });

    expect(setStrokesSpy).toHaveBeenCalledWith(sampleStrokes);
  });

  it('survives the reload path: toDocument then normalizeProblemSessions keeps the strokes', () => {
    const { rerender } = render(<Tree mounted={true} />);

    draw(sampleStrokes);
    act(() => {
      rerender(<Tree mounted={false} />);
    });

    const saved = probe.current?.getProblemSetSession(KEY);
    expect(saved).not.toBeNull();

    // Simulate a reload: serialize to the Firestore document shape, then read it
    // back through the loader's normalizer.
    const document = toDocument({
      ...EMPTY_CLOUD_STATE,
      problemSessions: { [KEY]: saved as ProblemSetSession },
    });
    const reloaded = normalizeProblemSessions(document.problemSessions);

    expect(reloaded[KEY]?.work.p1?.strokes).toEqual(sampleStrokes);
  });
});
