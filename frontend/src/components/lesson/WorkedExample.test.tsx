import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkedExample } from './WorkedExample';
import { getProblemById } from '../../content/problems';
import { getExplanationFeedback } from '../../lib/grading';
import { celebrateSmall } from '../../lib/confetti';
import type { Problem } from '../../content/problems';
import type { FadedItem } from '../../content';

// getProblemById is mocked so the unit fully controls the resolved problem
// (prompt and givens) and the unresolved case, independent of the authored bank.
vi.mock('../../content/problems', () => ({
  getProblemById: vi.fn(),
}));

// The self-explanation feedback callable is mocked so the flow can be driven
// without Firebase: tests control the AI response (on-track, needs-more, error).
vi.mock('../../lib/grading', () => ({
  getExplanationFeedback: vi.fn(),
}));

// Confetti is spied so the correct-grading celebration can be asserted without
// touching a real canvas.
vi.mock('../../lib/confetti', () => ({
  celebrateSmall: vi.fn(),
}));

function makeProblem(overrides: Partial<Problem> = {}): Problem {
  return {
    problemId: 'cl-coulomb-force-two-charges',
    lessonId: 'coulombs-law',
    unitId: 'electrostatics',
    skillIds: ['coulombs-law'],
    principleIds: ['coulomb-force'],
    misconceptionTags: [],
    kind: 'single',
    difficulty: 2,
    difficultyBand: 2,
    difficultyFeatures: { steps: 3, symbolic: false, calculus: false, multiPart: false, hasTrap: false },
    provenance: 'authored',
    title: 'Force between two point charges',
    prompt: 'Two point charges, +2.0 microcoulomb and +3.0 microcoulomb, are 0.10 m apart. Find the force.',
    ...overrides,
  };
}

function makeItem(overrides: Partial<FadedItem> = {}): FadedItem {
  return {
    mode: 'worked',
    problemId: 'cl-coulomb-force-two-charges',
    selfExplainPrompt: 'Why is the force the same size on each charge?',
    solutionSteps: [
      'Write Coulomb law F = k q1 q2 / r squared.',
      'Substitute k, the two charges, and the separation.',
      'Evaluate to get F about 5.4 N.',
    ],
    ...overrides,
  };
}

beforeEach(() => {
  vi.mocked(getProblemById).mockReset();
  vi.mocked(getProblemById).mockReturnValue(makeProblem());
  vi.mocked(getExplanationFeedback).mockReset();
  vi.mocked(getExplanationFeedback).mockResolvedValue({
    feedback: 'You have the core idea: the forces are a Newton third law pair.',
    isOnTrack: true,
  });
  vi.mocked(celebrateSmall).mockClear();
});

// Reveal every solution step so the self-explanation gate is on screen.
async function revealAll(user: ReturnType<typeof userEvent.setup>) {
  let next = screen.queryByRole('button', { name: /reveal next step/i });
  while (next) {
    await user.click(next);
    next = screen.queryByRole('button', { name: /reveal next step/i });
  }
}

describe('WorkedExample', () => {
  it('resolves the problem by id and shows its prompt and givens', () => {
    vi.mocked(getProblemById).mockReturnValue(
      makeProblem({
        prompt: 'A specific worked prompt to display.',
        givens: [
          { label: 'q1', value: '+2.0 microcoulomb' },
          { label: 'r', value: '0.10 m' },
        ],
      }),
    );

    render(<WorkedExample item={makeItem({ problemId: 'cl-coulomb-scaling' })} onComplete={vi.fn()} />);

    expect(getProblemById).toHaveBeenCalledWith('cl-coulomb-scaling');
    expect(screen.getByText('A specific worked prompt to display.')).toBeInTheDocument();
    expect(screen.getByText('q1')).toBeInTheDocument();
    expect(screen.getByText('+2.0 microcoulomb')).toBeInTheDocument();
    expect(screen.getByText('r')).toBeInTheDocument();
    expect(screen.getByText('0.10 m')).toBeInTheDocument();
  });

  it('shows the plain "Worked example" eyebrow when no label is provided', () => {
    render(<WorkedExample item={makeItem()} onComplete={vi.fn()} />);

    // The resolved problem supplies the <h2> title, so "Worked example" appears
    // only as the default eyebrow.
    expect(screen.getByText('Worked example')).toBeInTheDocument();
  });

  it('renders the provided ladder eyebrow in place of the default', () => {
    render(<WorkedExample item={makeItem()} eyebrow="Worked example 1 of 4" onComplete={vi.fn()} />);

    expect(screen.getByText('Worked example 1 of 4')).toBeInTheDocument();
    expect(screen.queryByText('Worked example')).not.toBeInTheDocument();
  });

  it('uncovers the solution steps one at a time, in order', async () => {
    const user = userEvent.setup();
    render(<WorkedExample item={makeItem()} onComplete={vi.fn()} />);

    // Only the first step is on screen to begin with.
    expect(screen.getAllByTestId('worked-step')).toHaveLength(1);
    expect(screen.getByTestId('worked-step')).toHaveTextContent('Write Coulomb law');
    expect(screen.queryByText(/Substitute k/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Evaluate to get/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /reveal next step/i }));

    let steps = screen.getAllByTestId('worked-step');
    expect(steps).toHaveLength(2);
    expect(steps[1]).toHaveTextContent('Substitute k');
    expect(screen.queryByText(/Evaluate to get/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /reveal next step/i }));

    steps = screen.getAllByTestId('worked-step');
    expect(steps.map((step) => step.textContent)).toEqual([
      expect.stringContaining('Write Coulomb law'),
      expect.stringContaining('Substitute k'),
      expect.stringContaining('Evaluate to get'),
    ]);

    // Nothing left to reveal once every step is shown.
    expect(screen.queryByRole('button', { name: /reveal next step/i })).not.toBeInTheDocument();
  });

  it('gates the self-explanation behind a full reveal, then behind getting AI feedback', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(<WorkedExample item={makeItem()} onComplete={onComplete} />);

    // The self-explanation and Continue appear only after the last step.
    expect(screen.queryByRole('button', { name: /continue/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();

    await revealAll(user);

    expect(screen.getByText('Why is the force the same size on each charge?')).toBeInTheDocument();

    const continueButton = screen.getByRole('button', { name: /continue/i });
    const checkButton = screen.getByRole('button', { name: /check explanation/i });
    expect(continueButton).toBeDisabled();
    expect(checkButton).toBeDisabled();

    // Whitespace alone does not enable the check.
    const response = screen.getByRole('textbox');
    await user.type(response, '   ');
    expect(checkButton).toBeDisabled();

    // A real answer enables Check, but Continue stays locked until feedback returns.
    await user.type(response, 'Forces come in equal and opposite pairs.');
    expect(checkButton).toBeEnabled();
    expect(continueButton).toBeDisabled();

    await user.click(checkButton);

    expect(getExplanationFeedback).toHaveBeenCalledWith({
      problemId: 'cl-coulomb-force-two-charges',
      question: 'Why is the force the same size on each charge?',
      answer: 'Forces come in equal and opposite pairs.',
    });
    expect(await screen.findByText(/Newton third law pair/)).toBeInTheDocument();
    expect(continueButton).toBeEnabled();
    // After a first check the control invites another pass.
    expect(screen.getByRole('button', { name: /check again/i })).toBeInTheDocument();

    await user.click(continueButton);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('keeps Continue locked until the explanation is accepted, then unlocks on a good answer', async () => {
    vi.mocked(getExplanationFeedback).mockResolvedValue({
      feedback: 'Close, but say what happens to the r^2 in the denominator when r doubles.',
      isOnTrack: false,
    });
    const user = userEvent.setup();
    render(<WorkedExample item={makeItem()} onComplete={vi.fn()} />);
    await revealAll(user);

    await user.type(screen.getByRole('textbox'), 'The force just gets weaker.');
    await user.click(screen.getByRole('button', { name: /check explanation/i }));

    // Not on track: the student must revise, so Continue stays locked.
    expect(await screen.findByText(/Keep building/)).toBeInTheDocument();
    expect(screen.getByText(/what happens to the r/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled();

    // Revise to a complete answer; the next check comes back on-track and unlocks.
    vi.mocked(getExplanationFeedback).mockResolvedValue({
      feedback: 'Exactly: the force depends on 1/r^2, so halving r multiplies it by four.',
      isOnTrack: true,
    });
    await user.type(
      screen.getByRole('textbox'),
      ' The force depends on 1/r^2, so halving r makes the force four times larger.',
    );
    await user.click(screen.getByRole('button', { name: /check again/i }));

    expect(await screen.findByText(/Good thinking/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue/i })).toBeEnabled();
  });

  it('soft-fails when feedback is unavailable but never traps the student', async () => {
    vi.mocked(getExplanationFeedback).mockRejectedValue(new Error('internal: explanation feedback failed'));
    const user = userEvent.setup();
    render(<WorkedExample item={makeItem()} onComplete={vi.fn()} />);
    await revealAll(user);

    await user.type(screen.getByRole('textbox'), 'Forces come in equal and opposite pairs.');
    await user.click(screen.getByRole('button', { name: /check explanation/i }));

    expect(await screen.findByText(/Feedback unavailable/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue/i })).toBeEnabled();
  });

  it('bursts confetti when the self-explanation is graded on-track', async () => {
    const user = userEvent.setup();
    render(<WorkedExample item={makeItem()} onComplete={vi.fn()} />);
    await revealAll(user);

    await user.type(screen.getByRole('textbox'), 'Forces come in equal and opposite pairs.');
    await user.click(screen.getByRole('button', { name: /check explanation/i }));

    // The default feedback mock returns isOnTrack: true ("Good thinking"), so the
    // correct grading fires exactly one small celebration.
    expect(await screen.findByText(/Good thinking/)).toBeInTheDocument();
    expect(celebrateSmall).toHaveBeenCalledTimes(1);
  });

  it('does not burst confetti when the explanation is not yet on-track', async () => {
    vi.mocked(getExplanationFeedback).mockResolvedValue({
      feedback: 'Close, but say what happens to the r^2 term when r doubles.',
      isOnTrack: false,
    });
    const user = userEvent.setup();
    render(<WorkedExample item={makeItem()} onComplete={vi.fn()} />);
    await revealAll(user);

    await user.type(screen.getByRole('textbox'), 'The force just gets weaker.');
    await user.click(screen.getByRole('button', { name: /check explanation/i }));

    // A "keep building" result must stay silent: no celebration on an incorrect
    // (not-yet-on-track) grading.
    expect(await screen.findByText(/Keep building/)).toBeInTheDocument();
    expect(celebrateSmall).not.toHaveBeenCalled();
  });

  it('reveals a single placeholder step when solutionSteps is absent', () => {
    render(<WorkedExample item={makeItem({ solutionSteps: undefined })} onComplete={vi.fn()} />);

    expect(screen.getAllByTestId('worked-step')).toHaveLength(1);
    // A single step is already fully revealed, so there is no reveal control.
    expect(screen.queryByRole('button', { name: /reveal next step/i })).not.toBeInTheDocument();
    // The self-explanation gate is immediately available.
    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled();
  });

  it('renders without crashing when the problem cannot be resolved', () => {
    vi.mocked(getProblemById).mockReturnValue(undefined);

    render(<WorkedExample item={makeItem()} onComplete={vi.fn()} />);

    expect(screen.getByTestId('worked-example')).toBeInTheDocument();
    expect(screen.getAllByTestId('worked-step').length).toBeGreaterThan(0);
  });

  it('restores revealed steps, the explanation, and prior feedback from initialSession', () => {
    render(
      <WorkedExample
        item={makeItem()}
        onComplete={vi.fn()}
        initialSession={{
          revealedCount: 3,
          explanation: 'Newton third law: an equal and opposite pair.',
          feedback: { isOnTrack: true, feedback: 'You have the core idea.' },
          feedbackError: null,
          checked: true,
        }}
      />,
    );

    // All three steps are restored, so the reveal control is gone and the gate is
    // open on the saved explanation with its prior on-track feedback showing.
    expect(screen.getAllByTestId('worked-step')).toHaveLength(3);
    expect(screen.queryByRole('button', { name: /reveal next step/i })).not.toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveValue('Newton third law: an equal and opposite pair.');
    expect(screen.getByText('You have the core idea.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue/i })).toBeEnabled();
    // Having checked before, the control invites another pass rather than a first.
    expect(screen.getByRole('button', { name: /check again/i })).toBeInTheDocument();
  });

  it('restores a partial reveal so the learner resumes mid-uncover', () => {
    render(
      <WorkedExample
        item={makeItem()}
        onComplete={vi.fn()}
        initialSession={{
          revealedCount: 2,
          explanation: '',
          feedback: null,
          feedbackError: null,
          checked: false,
        }}
      />,
    );

    // Two of three steps are uncovered, so the reveal control is still present and
    // the self-explanation gate has not opened yet.
    expect(screen.getAllByTestId('worked-step')).toHaveLength(2);
    expect(screen.getByRole('button', { name: /reveal next step/i })).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('reports a durable session when a step is revealed', async () => {
    const user = userEvent.setup();
    const onSessionChange = vi.fn();
    render(<WorkedExample item={makeItem()} onComplete={vi.fn()} onSessionChange={onSessionChange} />);

    // Seeding the mount does not write; the first save is the revealed step.
    expect(onSessionChange).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /reveal next step/i }));

    expect(onSessionChange).toHaveBeenCalled();
    expect(onSessionChange.mock.calls.at(-1)?.[0]).toMatchObject({
      revealedCount: 2,
      explanation: '',
      feedback: null,
      feedbackError: null,
      checked: false,
    });
  });

  it('reports the resolved feedback after a check, without the transient pending flag', async () => {
    const user = userEvent.setup();
    const onSessionChange = vi.fn();
    render(<WorkedExample item={makeItem()} onComplete={vi.fn()} onSessionChange={onSessionChange} />);
    await revealAll(user);

    await user.type(screen.getByRole('textbox'), 'Forces come in equal and opposite pairs.');
    await user.click(screen.getByRole('button', { name: /check explanation/i }));
    await screen.findByText(/Newton third law pair/);

    const last = onSessionChange.mock.calls.at(-1)?.[0];
    expect(last).toMatchObject({
      checked: true,
      feedback: { isOnTrack: true, feedback: expect.stringContaining('Newton third law pair') },
      feedbackError: null,
    });
    expect(last && 'feedbackPending' in last).toBe(false);
  });

  it('persists the in-progress explanation when the rung unmounts', async () => {
    const user = userEvent.setup();
    const onSessionChange = vi.fn();
    const { unmount } = render(
      <WorkedExample item={makeItem()} onComplete={vi.fn()} onSessionChange={onSessionChange} />,
    );
    await revealAll(user);
    await user.type(screen.getByRole('textbox'), 'A partial thought');

    // Leaving the lesson (unmount) flushes the pending debounced explanation save.
    onSessionChange.mockClear();
    unmount();

    expect(onSessionChange).toHaveBeenCalledTimes(1);
    expect(onSessionChange.mock.calls[0][0]).toMatchObject({
      explanation: 'A partial thought',
      revealedCount: 3,
    });
  });

  it('clears its saved session and does not re-save once the learner continues', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    const onSessionChange = vi.fn();
    const onSessionClear = vi.fn();
    const { unmount } = render(
      <WorkedExample
        item={makeItem()}
        onComplete={onComplete}
        onSessionChange={onSessionChange}
        onSessionClear={onSessionClear}
      />,
    );
    await revealAll(user);
    await user.type(screen.getByRole('textbox'), 'Forces come in equal and opposite pairs.');
    await user.click(screen.getByRole('button', { name: /check explanation/i }));
    await screen.findByText(/Newton third law pair/);

    await user.click(screen.getByRole('button', { name: /continue/i }));
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onSessionClear).toHaveBeenCalledTimes(1);

    // The finished rung must not write its state back over the cleared session
    // when it unmounts on advance.
    onSessionChange.mockClear();
    unmount();
    expect(onSessionChange).not.toHaveBeenCalled();
  });
});
