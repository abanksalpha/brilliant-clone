import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { type ForwardedRef } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProblemPlayer } from './ProblemPlayer';
import { gradeAttempt, getHint, askQuestion } from '../../lib/grading';
import { useProgress } from '../../progress/ProgressContext';
import { PRINCIPLES } from '../../content/principles';
import type { Problem } from '../../content/problems';
import type { MisconceptionNode } from '../../mastery/misconceptionGraph';
import type { ProblemSetSession } from '../../progress/problemSessionProgress';

// Boundary mocks only. The ink canvas, the grading network calls, and the
// progress store are the seams ProblemPlayer talks to; everything else (problem
// content, misconception lookup, routing) runs for real.

const inkHandle = vi.hoisted(() => ({
  annotate: vi.fn(),
  clear: vi.fn(),
  resetView: vi.fn(),
  undo: vi.fn(),
  redo: vi.fn(),
  getStrokeLines: vi.fn(() => [{ id: 'line-1', bbox: { x: 1, y: 2, w: 3, h: 4 } }]),
  toPngBase64: vi.fn(() => 'cG5nLWRhdGE='),
  getStrokes: vi.fn(() => [] as unknown[]),
  setStrokes: vi.fn(),
  getViewport: vi.fn(() => ({ scale: 1, tx: 0, ty: 0 })),
  setViewport: vi.fn(),
}));

// Latest props handed to the mocked canvas, so a test can drive the change
// callbacks the real canvas would fire (e.g. simulate drawing a stroke).
const inkProps = vi.hoisted(
  () => ({ current: null }) as { current: null | { onStrokesChange?: (strokes: unknown) => void } },
);

vi.mock('./InkCanvas', async () => {
  const { forwardRef, useImperativeHandle } = await import('react');
  return {
    InkCanvas: forwardRef(
      (props: { className?: string; onStrokesChange?: (strokes: unknown) => void }, ref: ForwardedRef<typeof inkHandle>) => {
        inkProps.current = props;
        useImperativeHandle(ref, () => inkHandle);
        return <div data-testid="ink-canvas" />;
      },
    ),
  };
});

// The real PdfViewer pulls in pdf.js + a web worker, which jsdom cannot run.
// Stub it with a marker that echoes its props so the equation-sheet test can
// assert the right document and starting page are requested.
vi.mock('./PdfViewer', () => ({
  default: ({ src, initialPage }: { src: string; initialPage?: number }) => (
    <div data-testid="pdf-viewer" data-src={src} data-initial-page={String(initialPage)} />
  ),
}));

vi.mock('../../lib/grading', () => ({
  gradeAttempt: vi.fn(),
  getHint: vi.fn(),
  askQuestion: vi.fn(),
}));

const recordProblemResult = vi.hoisted(() => vi.fn());
const recordConceptMiss = vi.hoisted(() => vi.fn());
const recordNodeCatch = vi.hoisted(() => vi.fn());

vi.mock('../../progress/ProgressContext', () => ({
  useProgress: vi.fn(() => ({
    recordProblemResult,
    recordConceptMiss,
    recordNodeCatch,
    progress: { misconceptions: {}, misconceptionGraph: {} },
  })),
}));

const mockedGrade = vi.mocked(gradeAttempt);
const mockedHint = vi.mocked(getHint);
const mockedAsk = vi.mocked(askQuestion);

const problems: Problem[] = [
  {
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
  },
  {
    problemId: 'p2',
    lessonId: 'coulombs-law',
    unitId: 'electrostatics',
    skillIds: ['coulombs-law'],
    principleIds: ['field-concept'],
    title: 'Second problem title',
    prompt: 'Find the potential at point Q.',
    misconceptionTags: [],
    kind: 'single',
    difficulty: 3,
    difficultyBand: 3,
    difficultyFeatures: { steps: 4, symbolic: false, calculus: false, multiPart: false, hasTrap: false },
    provenance: 'authored',
  },
];

function renderPlayer(onAllComplete?: () => void) {
  return render(
    <MemoryRouter>
      <ProblemPlayer problems={problems} title="Problem set" onAllComplete={onAllComplete} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  // Defaults restored after clearAllMocks wiped the stub return values.
  inkHandle.getStrokeLines.mockReturnValue([{ id: 'line-1', bbox: { x: 1, y: 2, w: 3, h: 4 } }]);
  inkHandle.toPngBase64.mockReturnValue('cG5nLWRhdGE=');
  inkHandle.getStrokes.mockReturnValue([]);
  inkHandle.getViewport.mockReturnValue({ scale: 1, tx: 0, ty: 0 });
  vi.mocked(useProgress).mockReturnValue({
    recordProblemResult,
    recordConceptMiss,
    recordNodeCatch,
    progress: { misconceptions: {}, misconceptionGraph: {} },
  } as unknown as ReturnType<typeof useProgress>);
});

describe('ProblemPlayer', () => {
  it('renders the first problem prompt', () => {
    renderPlayer();

    expect(screen.getByText('First problem title')).toBeInTheDocument();
    expect(screen.getByText('Find the field at point P.')).toBeInTheDocument();
  });

  it('shows the explanation, rings the first error line, and offers a revise on an incorrect check', async () => {
    const user = userEvent.setup();
    mockedGrade.mockResolvedValueOnce({
      isCorrect: false,
      transcribedSteps: ['E = kq/r'],
      firstErrorLineId: 'line-1',
      explanation: 'The distance must be squared.',
    });

    renderPlayer();
    await user.click(screen.getByRole('button', { name: /check work/i }));

    expect(mockedGrade).toHaveBeenCalledWith({
      problemId: 'p1',
      imagePngBase64: 'cG5nLWRhdGE=',
      lines: [{ id: 'line-1', bbox: { x: 1, y: 2, w: 3, h: 4 } }],
      knownMisconceptions: [],
      allowedPrincipleIds: PRINCIPLES.map((principle) => principle.id),
    });
    expect(await screen.findByText('The distance must be squared.')).toBeInTheDocument();
    expect(inkHandle.annotate).toHaveBeenCalledWith('line-1');
    // The dead misconceptionId path was removed, so an unclassified incorrect
    // result shows no "Common slip" bank label, only the explanation.
    expect(screen.queryByText(/common slip/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /revise/i })).toBeInTheDocument();
  });

  it('records a solved result and advances after a correct revise', async () => {
    const user = userEvent.setup();
    mockedGrade
      .mockResolvedValueOnce({
        isCorrect: false,
        transcribedSteps: ['E = kq/r'],
        firstErrorLineId: 'line-1',
        misconceptionId: 'inverse-square-error',
        explanation: 'The distance must be squared.',
      })
      .mockResolvedValueOnce({
        isCorrect: true,
        transcribedSteps: ['E = kq/r^2'],
        firstErrorLineId: null,
        misconceptionId: null,
        explanation: 'Looks right.',
        correctSolution: ['Start from Coulomb law', 'Square the distance'],
      });

    renderPlayer();
    await user.click(screen.getByRole('button', { name: /check work/i }));
    await user.click(await screen.findByRole('button', { name: /revise/i }));
    expect(inkHandle.annotate).toHaveBeenLastCalledWith(null);

    await user.click(screen.getByRole('button', { name: /check work/i }));

    expect(await screen.findByText('Start from Coulomb law')).toBeInTheDocument();
    expect(screen.getByText('Square the distance')).toBeInTheDocument();
    // The catch is credited to the problem's own misconception tags (not the
    // model's null id on a correct grade), so mastery actually advances. caught
    // and solved are both true, and attempts counts the two Check submissions.
    expect(recordProblemResult).toHaveBeenCalledWith(
      expect.objectContaining({
        problemId: 'p1',
        misconceptionIds: ['inverse-square-error'],
        caught: true,
        solved: true,
        hintsUsed: 0,
        attempts: 2,
      }),
    );

    await user.click(screen.getByRole('button', { name: /continue/i }));

    // Moving to a fresh problem starts it with a blank canvas.
    expect(inkHandle.setStrokes).toHaveBeenCalledWith([]);
    expect(screen.getByText('Second problem title')).toBeInTheDocument();
  });

  it('restores saved handwriting when navigating back to an earlier problem', async () => {
    const user = userEvent.setup();
    const savedStrokes = [{ id: 'stroke-1', points: [] }];
    inkHandle.getStrokes.mockReturnValue(savedStrokes);

    renderPlayer();

    // Jump to problem 2 from the progress bar, which snapshots problem 1's work.
    await user.click(screen.getByRole('button', { name: /go to screen 2/i }));
    expect(screen.getByText('Second problem title')).toBeInTheDocument();

    // Jump back to problem 1 through the progress segments; its work returns.
    await user.click(screen.getByRole('button', { name: /go to screen 1/i }));
    expect(screen.getByText('First problem title')).toBeInTheDocument();
    expect(inkHandle.setStrokes).toHaveBeenCalledWith(savedStrokes);
  });

  it('resumes on the saved problem and restores its handwriting', () => {
    const savedStrokes = [
      { id: 'stroke-9', points: [{ x: 1, y: 1, p: 0.5, t: 0 }] },
    ];
    const initialSession: ProblemSetSession = {
      index: 1,
      visitedCount: 2,
      solvedProblemIds: [],
      problemIds: ['p1', 'p2'],
      work: {
        p2: {
          strokes: savedStrokes,
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

    render(
      <MemoryRouter>
        <ProblemPlayer problems={problems} title="Problem set" initialSession={initialSession} />
      </MemoryRouter>,
    );

    expect(screen.getByText('Second problem title')).toBeInTheDocument();
    expect(inkHandle.setStrokes).toHaveBeenCalledWith(savedStrokes);
  });

  it('reports the session to onSessionChange when the student advances', async () => {
    const user = userEvent.setup();
    const onSessionChange = vi.fn();

    render(
      <MemoryRouter>
        <ProblemPlayer problems={problems} title="Problem set" onSessionChange={onSessionChange} />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: /go to screen 2/i }));
    expect(screen.getByText('Second problem title')).toBeInTheDocument();

    expect(onSessionChange).toHaveBeenCalled();
    const session = onSessionChange.mock.calls.at(-1)?.[0] as ProblemSetSession;
    expect(session.index).toBe(1);
    expect(session.visitedCount).toBe(2);
    // The session carries the ordered identity of the rendered set so the exact
    // same problems (variant ids included) can be rehydrated on return.
    expect(session.problemIds).toEqual(['p1', 'p2']);
  });

  it('reports the latest handwriting on unmount even without other changes', () => {
    const onSessionChange = vi.fn();
    const drawn = [
      { id: 'stroke-3', points: [{ x: 0, y: 0, p: 0.5, t: 0 }] },
    ];

    const { unmount } = render(
      <MemoryRouter>
        <ProblemPlayer problems={problems} title="Problem set" onSessionChange={onSessionChange} />
      </MemoryRouter>,
    );

    // The real canvas reports committed strokes through onStrokesChange; the
    // player mirrors them so the exit save still has them after the ref detaches.
    inkProps.current?.onStrokesChange?.(drawn);
    onSessionChange.mockClear();
    unmount();

    expect(onSessionChange).toHaveBeenCalledTimes(1);
    const session = onSessionChange.mock.calls[0][0] as ProblemSetSession;
    expect(session.work.p1.strokes).toEqual(drawn);
  });

  it('clears the saved session when the set is finished', async () => {
    const user = userEvent.setup();
    const onSessionClear = vi.fn();
    mockedGrade.mockResolvedValue({
      isCorrect: true,
      transcribedSteps: ['ok'],
      firstErrorLineId: null,
      misconceptionId: null,
      explanation: 'Looks right.',
      correctSolution: ['Step one'],
    });

    render(
      <MemoryRouter>
        <ProblemPlayer
          problems={problems}
          title="Problem set"
          onSessionClear={onSessionClear}
          onAllComplete={vi.fn()}
        />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: /check work/i }));
    await user.click(await screen.findByRole('button', { name: /continue/i }));
    await user.click(screen.getByRole('button', { name: /check work/i }));
    await user.click(await screen.findByRole('button', { name: /finish/i }));

    expect(onSessionClear).toHaveBeenCalledTimes(1);
  });

  it('shows an error state without recording when grading throws', async () => {
    const user = userEvent.setup();
    mockedGrade.mockRejectedValueOnce(new Error('functions/internal: grader exploded'));

    renderPlayer();
    await user.click(screen.getByRole('button', { name: /check work/i }));

    // The raw provider/internal error is replaced with clean, student-friendly copy.
    expect(await screen.findByText(/ai tutor ran into a problem/i)).toBeInTheDocument();
    expect(screen.queryByText(/grader exploded/)).not.toBeInTheDocument();
    expect(recordProblemResult).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    // Hints and ask stay available after a grading failure so the student can keep working.
    expect(screen.getByRole('button', { name: /need a hint/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ask a question/i })).toBeInTheDocument();
  });

  it('records a conceptual miss through the graph when the grader tags one', async () => {
    const user = userEvent.setup();
    mockedGrade.mockResolvedValueOnce({
      isCorrect: false,
      transcribedSteps: ['E = kq/r'],
      firstErrorLineId: 'line-1',
      explanation: 'The distance must be squared.',
      errorType: 'concept',
      conceptMatch: {
        matchedNodeId: null,
        principleId: 'field-concept',
        wrongBelief: 'Coulomb law uses distance not distance squared.',
        specificNote: 'You used r instead of r squared.',
      },
    });

    renderPlayer();
    await user.click(screen.getByRole('button', { name: /check work/i }));

    expect(recordConceptMiss).toHaveBeenCalledWith({
      matchedNodeId: null,
      principleId: 'field-concept',
      wrongBelief: 'Coulomb law uses distance not distance squared.',
      specificNote: 'You used r instead of r squared.',
    });
    expect(await screen.findByText('You used r instead of r squared.')).toBeInTheDocument();
  });

  it('records a concept miss at most once per problem across rechecks', async () => {
    const user = userEvent.setup();
    mockedGrade
      .mockResolvedValueOnce({
        isCorrect: false,
        transcribedSteps: ['E = kq/r'],
        firstErrorLineId: 'line-1',
        explanation: 'The distance must be squared.',
        errorType: 'concept',
        conceptMatch: {
          matchedNodeId: null,
          principleId: 'field-concept',
          wrongBelief: 'Coulomb law uses distance not distance squared.',
          specificNote: 'You used r instead of r squared.',
        },
      })
      .mockResolvedValueOnce({
        isCorrect: false,
        transcribedSteps: ['E = kq/r'],
        firstErrorLineId: 'line-1',
        explanation: 'Still not squared.',
        errorType: 'concept',
        conceptMatch: {
          matchedNodeId: null,
          principleId: 'field-concept',
          wrongBelief: 'Coulomb law uses distance not distance squared.',
          specificNote: 'Still using r, not r squared.',
        },
      });

    renderPlayer();
    await user.click(screen.getByRole('button', { name: /check work/i }));
    expect(await screen.findByText('You used r instead of r squared.')).toBeInTheDocument();
    expect(recordConceptMiss).toHaveBeenCalledTimes(1);

    // A second check on the same problem that still returns a concept error must
    // not record another miss, mirroring the once-per-problem solve guard.
    await user.click(screen.getByRole('button', { name: /i think this is right/i }));
    expect(await screen.findByText('Still using r, not r squared.')).toBeInTheDocument();
    expect(recordConceptMiss).toHaveBeenCalledTimes(1);
  });

  it('frames a careless slip without recording it in the graph', async () => {
    const user = userEvent.setup();
    mockedGrade.mockResolvedValueOnce({
      isCorrect: false,
      transcribedSteps: ['E = kq/r^2'],
      firstErrorLineId: 'line-1',
      explanation: 'Recheck the sign on the last line.',
      errorType: 'slip',
    });

    renderPlayer();
    await user.click(screen.getByRole('button', { name: /check work/i }));

    expect(await screen.findByText('Recheck the sign on the last line.')).toBeInTheDocument();
    // A slip shows only the explanation and is left out of the misconception graph.
    // No slip-versus-misconception framing is shown in the grader feedback.
    expect(screen.queryByText(/misconception/i)).not.toBeInTheDocument();
    expect(recordConceptMiss).not.toHaveBeenCalled();
  });

  it('credits a spaced catch once to the node a solved targeted problem aims at', async () => {
    const user = userEvent.setup();
    const targeted: Problem[] = [
      { ...problems[0], problemId: 'pt', targetMisconceptionNodeIds: ['mc:demo'] },
    ];
    mockedGrade
      .mockResolvedValueOnce({
        isCorrect: false,
        transcribedSteps: ['E = kq/r'],
        firstErrorLineId: 'line-1',
        explanation: 'Not yet.',
        errorType: 'slip',
      })
      .mockResolvedValueOnce({
        isCorrect: true,
        transcribedSteps: ['E = kq/r^2'],
        firstErrorLineId: null,
        misconceptionId: null,
        explanation: 'Looks right.',
        correctSolution: ['Square the distance'],
      });

    render(
      <MemoryRouter>
        <ProblemPlayer problems={targeted} title="Review" />
      </MemoryRouter>,
    );

    // A miss on the targeted problem does not credit a spaced catch.
    await user.click(screen.getByRole('button', { name: /check work/i }));
    expect(await screen.findByText('Not yet.')).toBeInTheDocument();
    expect(recordNodeCatch).not.toHaveBeenCalled();

    // Solving it credits the targeted node exactly once.
    await user.click(await screen.findByRole('button', { name: /i think this is right/i }));
    expect(await screen.findByText('Square the distance')).toBeInTheDocument();
    expect(recordNodeCatch).toHaveBeenCalledTimes(1);
    expect(recordNodeCatch).toHaveBeenCalledWith('mc:demo');
  });

  it('credits a spaced catch once to every node a multi-target solved problem traps', async () => {
    const user = userEvent.setup();
    // A generated problem can trap more than one belief; a correct solve must
    // credit a catch on each targeted node so spaced mastery advances on all.
    const targeted: Problem[] = [
      { ...problems[0], problemId: 'pt-multi', targetMisconceptionNodeIds: ['a', 'b'] },
    ];
    mockedGrade.mockResolvedValue({
      isCorrect: true,
      transcribedSteps: ['E = kq/r^2'],
      firstErrorLineId: null,
      misconceptionId: null,
      explanation: 'Looks right.',
      correctSolution: ['Square the distance'],
    });

    render(
      <MemoryRouter>
        <ProblemPlayer problems={targeted} title="Review" />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: /check work/i }));
    expect(await screen.findByText('Square the distance')).toBeInTheDocument();

    // Both targeted nodes are credited, each exactly once.
    expect(recordNodeCatch).toHaveBeenCalledTimes(2);
    expect(recordNodeCatch).toHaveBeenCalledWith('a');
    expect(recordNodeCatch).toHaveBeenCalledWith('b');
  });

  it('does not credit a node catch when the solved problem carries no target', async () => {
    const user = userEvent.setup();
    mockedGrade.mockResolvedValue({
      isCorrect: true,
      transcribedSteps: ['ok'],
      firstErrorLineId: null,
      misconceptionId: null,
      explanation: 'Looks right.',
      correctSolution: ['Step one'],
    });

    renderPlayer();
    await user.click(screen.getByRole('button', { name: /check work/i }));
    expect(await screen.findByText('Step one')).toBeInTheDocument();

    // The ordinary mastery result still records, but no emergent node is credited.
    expect(recordProblemResult).toHaveBeenCalled();
    expect(recordNodeCatch).not.toHaveBeenCalled();
  });

  it('adds a quiet pattern note when a second matching miss promotes a tracked node', async () => {
    const user = userEvent.setup();
    // An existing note (one prior miss) that this miss will promote to tracked.
    const existingNote: MisconceptionNode = {
      id: 'mc:demo',
      status: 'note',
      principleId: 'field-concept',
      wrongBelief: 'Coulomb law uses distance not distance squared.',
      specificNote: 'You used r instead of r squared.',
      caught: 0,
      missed: 1,
      strength: 0,
      lastSeenISO: '2026-06-25T12:00:00.000Z',
      caughtDayStamps: [],
      createdISO: '2026-06-25T12:00:00.000Z',
    };
    vi.mocked(useProgress).mockReturnValue({
      recordProblemResult,
      recordConceptMiss,
      recordNodeCatch,
      progress: { misconceptions: {}, misconceptionGraph: { 'mc:demo': existingNote } },
    } as unknown as ReturnType<typeof useProgress>);

    mockedGrade.mockResolvedValueOnce({
      isCorrect: false,
      transcribedSteps: ['E = kq/r'],
      firstErrorLineId: 'line-1',
      explanation: 'The distance must be squared.',
      errorType: 'concept',
      conceptMatch: {
        matchedNodeId: 'mc:demo',
        principleId: 'field-concept',
        wrongBelief: 'Coulomb law uses distance not distance squared.',
        specificNote: 'You used r instead of r squared again.',
      },
    });

    renderPlayer();
    await user.click(screen.getByRole('button', { name: /check work/i }));

    // The grader shows the specific note about the error itself, with no
    // "misconception" framing or tracking announcement, but still records the miss.
    expect(await screen.findByText('You used r instead of r squared again.')).toBeInTheDocument();
    expect(screen.queryByText(/misconception map/i)).not.toBeInTheDocument();
    expect(recordConceptMiss).toHaveBeenCalledWith(
      expect.objectContaining({ matchedNodeId: 'mc:demo' }),
    );
  });

  it('shows a completion screen after the last problem and returns to the dashboard', async () => {
    const user = userEvent.setup();
    const onAllComplete = vi.fn();
    mockedGrade.mockResolvedValue({
      isCorrect: true,
      transcribedSteps: ['ok'],
      firstErrorLineId: null,
      misconceptionId: null,
      explanation: 'Looks right.',
      correctSolution: ['Step one'],
    });

    renderPlayer(onAllComplete);

    // Problem 1 of 2: solve and continue.
    await user.click(screen.getByRole('button', { name: /check work/i }));
    await user.click(await screen.findByRole('button', { name: /continue/i }));

    // Problem 2 of 2 (last): solve and finish.
    expect(screen.getByText('Second problem title')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /check work/i }));
    await user.click(await screen.findByRole('button', { name: /finish/i }));

    // The completion screen replaces the workspace; navigation has not fired yet.
    expect(screen.getByText(/problem set complete/i)).toBeInTheDocument();
    expect(screen.getByText('2 / 2')).toBeInTheDocument();
    expect(onAllComplete).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /back to dashboard/i }));
    expect(onAllComplete).toHaveBeenCalledTimes(1);
  });

  it('toggles the movable equation sheet window open and closed', async () => {
    const user = userEvent.setup();
    renderPlayer();

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /equation sheet/i }));

    const dialog = screen.getByRole('dialog', { name: /equation sheet/i });
    const viewer = within(dialog).getByTestId('pdf-viewer');
    expect(viewer).toHaveAttribute('data-src', '/equation-sheet.pdf');
    expect(viewer).toHaveAttribute('data-initial-page', '3');

    await user.click(within(dialog).getByRole('button', { name: /close/i }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('requests a hint with the student work and asks for a deeper follow-up that stacks below the first', async () => {
    const user = userEvent.setup();
    mockedHint
      .mockResolvedValueOnce({ level: 0, text: 'Start from Coulomb law.', targetLineId: null })
      .mockResolvedValueOnce({ level: 1, text: 'Square the distance.', targetLineId: 'line-1' });

    renderPlayer();
    await user.click(screen.getByRole('button', { name: /need a hint/i }));

    expect(await screen.findByText('Start from Coulomb law.')).toBeInTheDocument();
    // The hint reuses the exact same canvas snapshot a grade sends (the student's
    // work image and detected ink lines) so the model can ground the hint in what
    // the student actually wrote, plus the progressive level and prior hints.
    expect(mockedHint).toHaveBeenNthCalledWith(1, {
      problemId: 'p1',
      imagePngBase64: 'cG5nLWRhdGE=',
      lines: [{ id: 'line-1', bbox: { x: 1, y: 2, w: 3, h: 4 } }],
      level: 0,
      priorHints: [],
    });

    // The button now invites a follow-up, which goes one level deeper and carries
    // the first hint so the model can build on it (still with the latest work).
    await user.click(screen.getByRole('button', { name: /another hint/i }));

    expect(await screen.findByText('Square the distance.')).toBeInTheDocument();
    // Both hints remain on screen, stacked.
    expect(screen.getByText('Start from Coulomb law.')).toBeInTheDocument();
    expect(mockedHint).toHaveBeenNthCalledWith(2, {
      problemId: 'p1',
      imagePngBase64: 'cG5nLWRhdGE=',
      lines: [{ id: 'line-1', bbox: { x: 1, y: 2, w: 3, h: 4 } }],
      level: 1,
      priorHints: ['Start from Coulomb law.'],
    });
  });

  it('asks the AI a free-form question and shows the transient answer', async () => {
    const user = userEvent.setup();
    mockedAsk.mockResolvedValueOnce({ answer: 'Think about which charge is enclosed.' });

    renderPlayer();
    await user.click(screen.getByRole('button', { name: /ask a question/i }));

    const field = screen.getByRole('textbox', { name: /ask about this problem/i });
    await user.type(field, 'Which charge is enclosed?');
    await user.click(screen.getByRole('button', { name: /^send$/i }));

    // The ask reuses the same canvas snapshot as a grade, plus the typed question.
    expect(mockedAsk).toHaveBeenCalledWith({
      problemId: 'p1',
      imagePngBase64: 'cG5nLWRhdGE=',
      lines: [{ id: 'line-1', bbox: { x: 1, y: 2, w: 3, h: 4 } }],
      question: 'Which charge is enclosed?',
    });
    expect(await screen.findByText('Think about which charge is enclosed.')).toBeInTheDocument();
  });

  it('shows an error panel when the ask fails and never fabricates an answer', async () => {
    const user = userEvent.setup();
    mockedAsk.mockRejectedValueOnce(new Error('functions/internal: ask exploded'));

    renderPlayer();
    await user.click(screen.getByRole('button', { name: /ask a question/i }));
    await user.type(
      screen.getByRole('textbox', { name: /ask about this problem/i }),
      'Why is the distance squared?',
    );
    await user.click(screen.getByRole('button', { name: /^send$/i }));

    // The raw provider/internal error becomes clean copy; no fabricated answer.
    expect(await screen.findByText(/ai tutor ran into a problem/i)).toBeInTheDocument();
    expect(screen.queryByText(/ask exploded/)).not.toBeInTheDocument();
  });

  it('hides the within-set progress chrome and its exit when hideProgressChrome is set', () => {
    render(
      <MemoryRouter>
        <ProblemPlayer problems={problems} title="Review" hideProgressChrome />
      </MemoryRouter>,
    );

    // The blue/red SessionChrome bar, its per-problem jump buttons, and its exit
    // are all gone; the lesson owns that chrome instead.
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(screen.queryByRole('button', { name: /go to screen/i })).toBeNull();
    expect(screen.queryByRole('link', { name: /exit lesson/i })).toBeNull();
    // The problem itself still renders.
    expect(screen.getByText('First problem title')).toBeInTheDocument();
  });

  it('renders a retry for a failed slot and calls onRetrySlot with its display index', async () => {
    const user = userEvent.setup();
    const onRetrySlot = vi.fn();
    // Slot 0 is ready, slot 1 failed (a hole), slot 2 is ready. Open on the failed
    // slot so its retry control is on screen.
    const sparse = [problems[0], undefined, problems[1]];

    render(
      <MemoryRouter>
        <ProblemPlayer
          problems={sparse}
          title="Review"
          expectedTotal={3}
          hideProgressChrome
          initialProblemIndex={1}
          failedSlots={new Set([1])}
          onRetrySlot={onRetrySlot}
        />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('problem-failed')).toBeInTheDocument();
    // The first (ready) problem is not shown; the failed slot is.
    expect(screen.queryByText('First problem title')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /try again/i }));
    expect(onRetrySlot).toHaveBeenCalledWith(1);
  });

  it('offers a Skip on a failed slot when onSkip is provided (Review) and calls it', async () => {
    const user = userEvent.setup();
    const onSkip = vi.fn();
    const sparse = [problems[0], undefined, problems[1]];

    render(
      <MemoryRouter>
        <ProblemPlayer
          problems={sparse}
          title="Review"
          expectedTotal={3}
          hideProgressChrome
          initialProblemIndex={1}
          failedSlots={new Set([1])}
          onRetrySlot={vi.fn()}
          onSkip={onSkip}
        />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: /skip review/i }));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it('omits the Skip control on a failed slot when onSkip is absent (Solve)', () => {
    const sparse = [problems[0], undefined];

    render(
      <MemoryRouter>
        <ProblemPlayer
          problems={sparse}
          title="Solve"
          expectedTotal={2}
          hideProgressChrome
          initialProblemIndex={1}
          failedSlots={new Set([1])}
          onRetrySlot={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('problem-failed')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /skip review/i })).not.toBeInTheDocument();
  });

  it('shows a generating state for a not-yet-ready slot that has not failed', () => {
    const sparse = [problems[0], undefined];

    render(
      <MemoryRouter>
        <ProblemPlayer
          problems={sparse}
          title="Review"
          expectedTotal={2}
          hideProgressChrome
          initialProblemIndex={1}
        />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('problem-pending')).toBeInTheDocument();
    expect(screen.getByText(/generating the next problem/i)).toBeInTheDocument();
    expect(screen.queryByTestId('problem-failed')).not.toBeInTheDocument();
  });

  it('reports the active problem index on mount and on navigation', async () => {
    const user = userEvent.setup();
    const onProblemIndexChange = vi.fn();
    render(
      <MemoryRouter>
        <ProblemPlayer
          problems={problems}
          title="Review"
          onProblemIndexChange={onProblemIndexChange}
        />
      </MemoryRouter>,
    );

    // Fires on mount with the first problem and the set size.
    expect(onProblemIndexChange).toHaveBeenLastCalledWith(0, 2);

    await user.click(screen.getByRole('button', { name: /go to screen 2/i }));
    expect(onProblemIndexChange).toHaveBeenLastCalledWith(1, 2);
  });
});
