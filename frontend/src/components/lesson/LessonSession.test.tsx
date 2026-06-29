import '@testing-library/jest-dom/vitest';
import { StrictMode, type ReactElement } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LessonSession } from './LessonSession';
import { buildGeneratedReview } from '../../assign/buildGeneratedReview';
import { buildPersonalizedSolveSet } from '../../assign/buildPersonalizedSolveSet';
import { celebrate, celebrateSmall } from '../../lib/confetti';
import type { LessonModule } from '../../content';
import type { Problem } from '../../content/problems';

// Confetti is spied so the lesson's celebration wiring is asserted without
// touching a real canvas.
vi.mock('../../lib/confetti', () => ({
  celebrate: vi.fn(),
  celebrateSmall: vi.fn(),
}));

// Minimal Problem stand-ins for the mocked builders: a generated success carries a
// planSlotIndex (the slot it realizes); an authored lead carries none.
function gen(id: string, slot: number): Problem {
  return { problemId: id, planSlotIndex: slot } as unknown as Problem;
}
function authored(id: string): Problem {
  return { problemId: id } as unknown as Problem;
}

const REVIEW_DEFAULT = {
  problems: [gen('r1', 0), gen('r2', 1), gen('r3', 2)],
  failedSlotIndices: [] as number[],
};
const SOLVE_DEFAULT = {
  problems: [authored('s1'), authored('s2'), authored('s3'), gen('s4', 0), gen('s5', 1), gen('s6', 2)],
  failedSlotIndices: [] as number[],
};

// The whiteboard player (Phases 1 and 5) is heavy, so it is mocked down to a
// button that fires onAllComplete (driving phase advancement) plus a retry button
// per failed slot, so the per-slot retry wiring can be exercised.
vi.mock('../problem/ProblemPlayer', () => ({
  ProblemPlayer: ({
    title,
    onAllComplete,
    initialProblemIndex,
    failedSlots,
    onRetrySlot,
  }: {
    title?: string;
    onAllComplete?: () => void;
    initialProblemIndex?: number;
    failedSlots?: Set<number>;
    onRetrySlot?: (index: number) => void;
  }) => (
    <>
      <button
        type="button"
        data-testid="mock-problem-player"
        data-initial-index={initialProblemIndex ?? ''}
        onClick={() => onAllComplete?.()}
      >
        {title} complete
      </button>
      {[...(failedSlots ?? [])].map((slot) => (
        <button key={slot} type="button" data-testid={`retry-slot-${slot}`} onClick={() => onRetrySlot?.(slot)}>
          retry {slot}
        </button>
      ))}
    </>
  ),
}));

// Screen-aware inquiry stub: with no screens it is a single continue (the legacy
// behavior every other test relies on); with screens it renders the current
// screen (driven by the initialScreen prop) and a continue that reports each
// within-phase step via onStepChange, then onComplete on the last screen.
vi.mock('./InquiryPrompt', () => ({
  InquiryPrompt: ({
    inquiry,
    onComplete,
    initialScreen,
    onStepChange,
  }: {
    inquiry: { screens?: Array<{ id: string }> };
    onComplete: () => void;
    initialScreen?: number;
    onStepChange?: (index: number) => void;
  }) => {
    const screens = inquiry.screens ?? [];
    if (screens.length === 0) {
      return (
        <section data-testid="inquiry-prompt">
          <button type="button" onClick={onComplete}>
            continue
          </button>
        </section>
      );
    }
    const index = Math.min(Math.max(0, initialScreen ?? 0), screens.length - 1);
    return (
      <section data-testid="inquiry-prompt">
        <span data-testid="inquiry-screen-id">{screens[index].id}</span>
        <button
          type="button"
          onClick={() => {
            if (index < screens.length - 1) onStepChange?.(index + 1);
            else onComplete();
          }}
        >
          continue
        </button>
      </section>
    );
  },
}));
// Surface the resume slide so the within-Learn resume can be asserted.
vi.mock('./ExplanationSlides', () => ({
  ExplanationSlides: ({ initialIndex, onComplete }: { initialIndex?: number; onComplete: () => void }) => (
    <section data-testid="explanation-slides">
      <span data-testid="slide-initial-index">{initialIndex ?? 0}</span>
      <button type="button" onClick={onComplete}>
        continue
      </button>
    </section>
  ),
}));
// Surface whether worked-example persistence was wired into the rung, mirroring
// the completion-rung mock below.
vi.mock('./WorkedExample', () => ({
  WorkedExample: ({ onComplete, onSessionChange }: { onComplete: () => void; onSessionChange?: unknown }) => (
    <section data-testid="worked-example">
      <span data-testid="worked-has-session">{onSessionChange ? 'yes' : 'no'}</span>
      <button type="button" onClick={onComplete}>
        continue
      </button>
    </section>
  ),
}));
// Surface whether whiteboard persistence was wired into the rung.
vi.mock('./CompletionProblem', () => ({
  CompletionProblem: ({ onComplete, onSessionChange }: { onComplete: () => void; onSessionChange?: unknown }) => (
    <section data-testid="completion-problem">
      <span data-testid="completion-has-session">{onSessionChange ? 'yes' : 'no'}</span>
      <button type="button" onClick={onComplete}>
        continue
      </button>
    </section>
  ),
}));

// Phase 1 review and Phase 5 solve are generated on the fly; stub both builders so
// the phases render the (mocked) whiteboard without reaching the backend. The
// injected generator is irrelevant once the builders are stubbed.
vi.mock('../../assign/buildGeneratedReview', () => ({
  buildGeneratedReview: vi.fn(),
}));
vi.mock('../../assign/buildPersonalizedSolveSet', () => ({
  buildPersonalizedSolveSet: vi.fn(),
}));
vi.mock('../../lib/grading', () => ({
  planProblemSet: vi.fn(async () => []),
  generatePlannedProblem: vi.fn(async () => ({})),
}));

vi.mock('../../progress/ProgressContext', () => ({
  useProgress: () => ({
    progress: {},
    getProblemSetSession: () => null,
    saveProblemSetSession: vi.fn(),
    clearProblemSetSession: vi.fn(),
    getWorkedExampleSession: () => null,
    saveWorkedExampleSession: vi.fn(),
    clearWorkedExampleSession: vi.fn(),
    getGeneratedSet: () => null,
    saveGeneratedSet: vi.fn(),
    getGeneratedPlan: () => null,
    saveGeneratedPlan: vi.fn(),
  }),
}));

beforeEach(() => {
  // A clean default each test: the builders resolve to a full slot-indexed set
  // with no failures. Tests that need a failure or planner error override this.
  vi.mocked(buildGeneratedReview).mockReset();
  vi.mocked(buildGeneratedReview).mockResolvedValue(REVIEW_DEFAULT);
  vi.mocked(buildPersonalizedSolveSet).mockReset();
  vi.mocked(buildPersonalizedSolveSet).mockResolvedValue(SOLVE_DEFAULT);
});

function fixtureModule(): LessonModule {
  return {
    lessonId: 'coulombs-law',
    lessonNumber: 1,
    title: "Coulomb's Law",
    prerequisites: [],
    reviewSkillIds: ['coulombs-law'],
    topicPrincipleIds: ['coulomb-force', 'superposition'],
    inquiry: { question: 'How does the force change with distance?', capture: 'text', resolvedBy: 'inverse square' },
    explanationSlides: [{ heading: 'The law', body: 'It falls off as an inverse square.' }],
    workedSequence: [
      { mode: 'worked', problemId: 'cl-coulomb-force-two-charges', selfExplainPrompt: 'Why?' },
      { mode: 'completion', problemId: 'cl-coulomb-collinear-net' },
    ],
    independentProblemIds: ['cl-coulomb-force-two-charges'],
  };
}

async function clickContinue(user: ReturnType<typeof userEvent.setup>, testId: string) {
  await user.click(within(screen.getByTestId(testId)).getByRole('button'));
}

// The session now renders a Link (the relocated exit), so every render needs a
// router context.
function renderSession(ui: ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('LessonSession', () => {
  it('advances through phases 1 to 5 and calls onLessonComplete after the last phase', async () => {
    const user = userEvent.setup();
    const onLessonComplete = vi.fn();
    const onPhaseChange = vi.fn();
    const onQuestionAnswered = vi.fn();

    renderSession(
      <LessonSession
        module={fixtureModule()}
        initialPhase={0}
        initialWithin={0}
        onPhaseChange={onPhaseChange}
        onLessonComplete={onLessonComplete}
        onQuestionAnswered={onQuestionAnswered}
      />,
    );

    // Phase 1: review (mocked whiteboard), the first segment is active.
    expect(await screen.findByTestId('mock-problem-player')).toBeInTheDocument();
    expect(screen.getByTestId('phase-seg-0')).toHaveAttribute('aria-current', 'step');
    await user.click(screen.getByTestId('mock-problem-player'));

    // Phase 2: inquiry primer.
    expect(await screen.findByTestId('inquiry-prompt')).toBeInTheDocument();
    expect(screen.getByTestId('phase-seg-1')).toHaveAttribute('aria-current', 'step');
    await clickContinue(user, 'inquiry-prompt');

    // Phase 3: explanation slides.
    expect(await screen.findByTestId('explanation-slides')).toBeInTheDocument();
    await clickContinue(user, 'explanation-slides');

    // Phase 4: worked-to-faded ladder, walked item by item.
    expect(await screen.findByTestId('worked-example')).toBeInTheDocument();
    await clickContinue(user, 'worked-example');
    expect(await screen.findByTestId('completion-problem')).toBeInTheDocument();
    await clickContinue(user, 'completion-problem');

    // Phase 5: independent problems (mocked whiteboard) finishes the lesson.
    expect(await screen.findByTestId('mock-problem-player')).toBeInTheDocument();
    expect(screen.getByTestId('phase-seg-4')).toHaveAttribute('aria-current', 'step');
    expect(onLessonComplete).not.toHaveBeenCalled();
    await user.click(screen.getByTestId('mock-problem-player'));

    expect(onLessonComplete).toHaveBeenCalledTimes(1);
    // Four phase transitions plus one within-phase step inside Phase 4.
    expect(onPhaseChange.mock.calls).toEqual([
      [1, 0],
      [2, 0],
      [3, 0],
      [3, 1],
      [4, 0],
    ]);
    // The two worked-to-faded rungs each report a question answered.
    expect(onQuestionAnswered.mock.calls).toEqual([[1], [2]]);
  });

  it('resumes at the given initial phase', async () => {
    renderSession(
      <LessonSession
        module={fixtureModule()}
        initialPhase={2}
        initialWithin={0}
        onPhaseChange={vi.fn()}
        onLessonComplete={vi.fn()}
      />,
    );

    expect(await screen.findByTestId('explanation-slides')).toBeInTheDocument();
    expect(screen.getByTestId('phase-seg-2')).toHaveAttribute('aria-current', 'step');
  });

  it('shows two Inquiry sub-cells and reports screen changes', async () => {
    const user = userEvent.setup();
    const onPhaseChange = vi.fn();
    const moduleWith2Screens: LessonModule = {
      ...fixtureModule(),
      inquiry: {
        ...fixtureModule().inquiry,
        screens: [
          {
            id: 'charge', variable: 'charge', mode: 'cycle', prompt: 'Charge prompt.',
            left: { id: 'left', x: 3, y: 3, q: 1 }, right: { id: 'right', x: 7, y: 3, q: 1 },
            target: { apply: 'set-charge', chargeId: 'right', toQ: 3 }, revealCaption: 'Charge caption.',
          },
          {
            id: 'distance', variable: 'distance', mode: 'move', prompt: 'Distance prompt.',
            left: { id: 'left', x: 2, y: 3, q: 2 }, right: { id: 'right', x: 4, y: 3, q: 2 },
            target: { apply: 'set-distance', toDistanceFactor: 2 }, revealCaption: 'Distance caption.',
          },
        ],
      },
    };

    renderSession(
      <LessonSession
        module={moduleWith2Screens}
        initialPhase={1}
        initialWithin={0}
        onPhaseChange={onPhaseChange}
        onLessonComplete={() => {}}
      />,
    );

    // Inquiry segment (index 1) has 2 sub-cells, one per authored screen.
    expect(await screen.findByTestId('inquiry-prompt')).toBeInTheDocument();
    const seg = screen.getByTestId('phase-seg-1');
    expect(seg.querySelectorAll('.phase-bar__cell')).toHaveLength(2);

    // Advancing the first screen reports within=1 for phase 1 (no phase change).
    await clickContinue(user, 'inquiry-prompt');
    expect(onPhaseChange).toHaveBeenCalledWith(1, 1);
  });

  it('jumps straight to a chosen subpart in dev mode (e.g. the 3rd Solve problem)', async () => {
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
      const user = userEvent.setup();
      const module = {
        ...fixtureModule(),
        independentProblemIds: [
          'cl-coulomb-force-two-charges',
          'cl-coulomb-scaling',
          'cl-coulomb-collinear-net',
        ],
      };

      renderSession(
        <LessonSession
          module={module}
          initialPhase={0}
          initialWithin={0}
          onPhaseChange={vi.fn()}
          onLessonComplete={vi.fn()}
        />,
      );

      // From a fresh Phase 1, free navigation exposes each Solve problem as its
      // own jump target; a normal unprogressed session withholds Solve entirely.
      await user.click(await screen.findByRole('button', { name: 'Go to Solve, part 3' }));

      // The Solve player opens directly on the 3rd problem (index 2), not the first.
      const player = await screen.findByTestId('mock-problem-player');
      expect(player).toHaveTextContent('Solve complete');
      expect(player).toHaveAttribute('data-initial-index', '2');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('resumes Learn on the saved slide within the deck', async () => {
    const module = {
      ...fixtureModule(),
      explanationSlides: [
        { heading: 'A', body: 'a' },
        { heading: 'B', body: 'b' },
      ],
    };

    renderSession(
      <LessonSession
        module={module}
        initialPhase={2}
        initialWithin={1}
        onPhaseChange={vi.fn()}
        onLessonComplete={vi.fn()}
      />,
    );

    expect(await screen.findByTestId('explanation-slides')).toBeInTheDocument();
    expect(screen.getByTestId('slide-initial-index')).toHaveTextContent('1');
  });

  it('wires whiteboard persistence into the resumed Apply completion rung', async () => {
    renderSession(
      <LessonSession
        module={fixtureModule()}
        initialPhase={3}
        initialWithin={1}
        onPhaseChange={vi.fn()}
        onLessonComplete={vi.fn()}
      />,
    );

    // workedSequence[1] is the completion rung; it should receive a session sink
    // so its handwriting persists across leaving and re-entering the lesson.
    expect(await screen.findByTestId('completion-problem')).toBeInTheDocument();
    expect(screen.getByTestId('completion-has-session')).toHaveTextContent('yes');
  });

  it('wires worked-example persistence into the resumed Apply worked rung', async () => {
    renderSession(
      <LessonSession
        module={fixtureModule()}
        initialPhase={3}
        initialWithin={0}
        onPhaseChange={vi.fn()}
        onLessonComplete={vi.fn()}
      />,
    );

    // workedSequence[0] is the worked rung; it should receive a session sink so
    // its revealed steps and self-explanation persist across leaving the tab.
    expect(await screen.findByTestId('worked-example')).toBeInTheDocument();
    expect(screen.getByTestId('worked-has-session')).toHaveTextContent('yes');
  });

  it('celebrates only finishing the lesson, never reaching Learn or any transition', async () => {
    const user = userEvent.setup();
    vi.mocked(celebrate).mockClear();
    vi.mocked(celebrateSmall).mockClear();

    renderSession(
      <LessonSession
        module={fixtureModule()}
        initialPhase={0}
        initialWithin={0}
        onPhaseChange={vi.fn()}
        onLessonComplete={vi.fn()}
      />,
    );

    // Entering the lesson (Review) and advancing to Inquiry fire no confetti.
    await user.click(await screen.findByTestId('mock-problem-player'));
    expect(vi.mocked(celebrateSmall)).not.toHaveBeenCalled();

    // Reaching the Learn page no longer bursts confetti.
    await clickContinue(user, 'inquiry-prompt');
    expect(await screen.findByTestId('explanation-slides')).toBeInTheDocument();
    expect(vi.mocked(celebrateSmall)).not.toHaveBeenCalled();

    // The remaining transitions fire nothing either: the problem player and the
    // Apply rungs are mocked, so there is no correct-answer burst, and no
    // lesson-complete celebrate until the very end.
    await clickContinue(user, 'explanation-slides');
    await clickContinue(user, 'worked-example');
    await clickContinue(user, 'completion-problem');

    expect(vi.mocked(celebrateSmall)).not.toHaveBeenCalled();
    expect(vi.mocked(celebrate)).not.toHaveBeenCalled();

    await user.click(await screen.findByTestId('mock-problem-player'));

    expect(vi.mocked(celebrate)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(celebrateSmall)).not.toHaveBeenCalled();
  });

  it('does not deadlock on the review loading state under StrictMode', async () => {
    // React 19 StrictMode double-invokes effects; the review build must still
    // resolve (it is guarded by a build key with no cancel-on-cleanup), so Phase 1
    // never sticks on "Loading review". This guards the just-fixed deadlock.
    renderSession(
      <StrictMode>
        <LessonSession
          module={fixtureModule()}
          initialPhase={0}
          initialWithin={0}
          onPhaseChange={vi.fn()}
          onLessonComplete={vi.fn()}
        />
      </StrictMode>,
    );

    // buildGeneratedReview is mocked to resolve, so the phase renders the review
    // (the mocked whiteboard) and the loading placeholder is gone for good.
    expect(await screen.findByTestId('mock-problem-player')).toBeInTheDocument();
    expect(screen.queryByTestId('phase-review-loading')).not.toBeInTheDocument();
  });

  it('shows a whole-set retry and skip when the review planner fails', async () => {
    // The planner failing is the only whole-set, loud error: the builder rejects.
    vi.mocked(buildGeneratedReview).mockReset();
    vi.mocked(buildGeneratedReview).mockRejectedValue(new Error('planner down'));

    renderSession(
      <LessonSession
        module={fixtureModule()}
        initialPhase={0}
        initialWithin={0}
        onPhaseChange={vi.fn()}
        onLessonComplete={vi.fn()}
      />,
    );

    expect(await screen.findByTestId('phase-review-error')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /skip review/i })).toBeInTheDocument();
  });

  it('regenerates a single failed review slot on a per-slot retry', async () => {
    const user = userEvent.setup();
    // First build: slots 0 and 1 succeed, slot 2 fails. The retry rebuild succeeds.
    vi.mocked(buildGeneratedReview).mockReset();
    vi.mocked(buildGeneratedReview)
      .mockImplementationOnce(async (...args) => {
        const options = args[5];
        options?.onProblem?.(gen('r0', 0));
        options?.onProblem?.(gen('r1', 1));
        options?.onSlotError?.(2);
        return { problems: [gen('r0', 0), gen('r1', 1)], failedSlotIndices: [2] };
      })
      .mockImplementationOnce(async (...args) => {
        const options = args[5];
        options?.onProblem?.(gen('r2', 2));
        return { problems: [gen('r0', 0), gen('r1', 1), gen('r2', 2)], failedSlotIndices: [] };
      });

    renderSession(
      <LessonSession
        module={fixtureModule()}
        initialPhase={0}
        initialWithin={0}
        onPhaseChange={vi.fn()}
        onLessonComplete={vi.fn()}
      />,
    );

    // The failed review slot (display index 2, no authored offset) shows a retry.
    const retry = await screen.findByTestId('retry-slot-2');
    expect(vi.mocked(buildGeneratedReview)).toHaveBeenCalledTimes(1);

    await user.click(retry);

    // The retry regenerates just that slot (a second builder run) and clears the failure.
    await waitFor(() => expect(vi.mocked(buildGeneratedReview)).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByTestId('retry-slot-2')).not.toBeInTheDocument());
  });
});
