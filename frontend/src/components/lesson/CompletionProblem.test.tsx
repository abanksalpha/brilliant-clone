import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { type ForwardedRef } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CompletionProblem } from './CompletionProblem';
import { gradeAttempt } from '../../lib/grading';
import { useProgress } from '../../progress/ProgressContext';
import type { FadedItem } from '../../content';

// Boundary mocks only, mirroring ProblemPlayer.test.tsx. CompletionProblem embeds
// the real ProblemPlayer so the whiteboard, the grading network call, the pdf
// equation sheet, and the progress store are the seams to stub; the problem
// content lookup and the grader wiring run for real.
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

vi.mock('../problem/InkCanvas', async () => {
  const { forwardRef, useImperativeHandle } = await import('react');
  return {
    InkCanvas: forwardRef((_props: unknown, ref: ForwardedRef<typeof inkHandle>) => {
      useImperativeHandle(ref, () => inkHandle);
      return <div data-testid="ink-canvas" />;
    }),
  };
});

// The real PdfViewer pulls in pdf.js + a web worker, which jsdom cannot run.
vi.mock('../problem/PdfViewer', () => ({
  default: () => <div data-testid="pdf-viewer" />,
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

beforeEach(() => {
  vi.clearAllMocks();
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

function renderItem(item: FadedItem, onComplete: () => void = vi.fn()) {
  render(
    <MemoryRouter>
      <CompletionProblem item={item} onComplete={onComplete} />
    </MemoryRouter>,
  );
  return onComplete;
}

// cl-coulomb-collinear-net: title "Net force on a charge in a row".
const completionItem: FadedItem = {
  mode: 'completion',
  problemId: 'cl-coulomb-collinear-net',
  prefilledSteps: [
    'Find the force from each neighbor on its own.',
    'Add the two opposite pushes as vectors.',
  ],
};

// cl-coulomb-square-corner-net: title "Net force on a corner of a square".
const skeletonItem: FadedItem = {
  mode: 'skeleton',
  problemId: 'cl-coulomb-square-corner-net',
};

describe('CompletionProblem', () => {
  it('resolves the problem by id and renders its prompt', () => {
    renderItem(completionItem);

    expect(screen.getByText('Net force on a charge in a row')).toBeInTheDocument();
    expect(
      screen.getByText(/find the magnitude of the net electric force/i),
    ).toBeInTheDocument();
  });

  it('shows the prefilled steps as already-worked first steps for a completion rung', () => {
    renderItem(completionItem);

    const prefilled = screen.getByTestId('completion-prefilled');
    expect(
      within(prefilled).getByText('Find the force from each neighbor on its own.'),
    ).toBeInTheDocument();
    expect(
      within(prefilled).getByText('Add the two opposite pushes as vectors.'),
    ).toBeInTheDocument();
  });

  it('omits prefilled steps for a skeleton rung but still renders the problem', () => {
    renderItem(skeletonItem);

    expect(screen.queryByTestId('completion-prefilled')).not.toBeInTheDocument();
    expect(screen.getByText('Net force on a corner of a square')).toBeInTheDocument();
  });

  it('grades the resolved problem and calls onComplete when the student solves it', async () => {
    const user = userEvent.setup();
    mockedGrade.mockResolvedValue({
      isCorrect: true,
      transcribedSteps: ['ok'],
      firstErrorLineId: null,
      explanation: 'Looks right.',
      correctSolution: ['Add the two fields as vectors.'],
    });
    const onComplete = renderItem(completionItem);

    await user.click(screen.getByRole('button', { name: /check work/i }));
    await user.click(await screen.findByRole('button', { name: /finish/i }));

    expect(mockedGrade).toHaveBeenCalledWith(
      expect.objectContaining({ problemId: 'cl-coulomb-collinear-net' }),
    );
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('still lets the lesson continue when the problem id cannot be resolved', async () => {
    const user = userEvent.setup();
    const onComplete = renderItem({ mode: 'completion', problemId: 'does-not-exist' });

    await user.click(screen.getByRole('button', { name: /continue/i }));

    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
