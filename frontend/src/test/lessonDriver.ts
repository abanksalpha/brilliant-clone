import { screen, within } from '@testing-library/react';
import type userEvent from '@testing-library/user-event';

// Drivers for the five-phase LessonSession, used by the walk tests. Each helper
// targets a single phase by its data-testid and the controls the phase exposes,
// so a test can play a lesson end to end without reaching into component
// internals. Phases 1 and 5 (the graded whiteboard) are driven by
// solveProblemSet, which expects the grader to be mocked the way the ProblemPlayer
// suite mocks it.

export type LessonUser = ReturnType<typeof userEvent.setup>;

// Phase 2: answer the inquiry primer (low-stakes, never graded) and continue.
export async function answerInquiry(user: LessonUser) {
  const prompt = screen.getByTestId('inquiry-prompt');
  const guess = within(prompt).queryByLabelText('Your guess');
  if (guess) {
    await user.type(guess, 'My prediction.');
  }
  await user.click(within(prompt).getByRole('button', { name: 'Continue' }));
}

// Phase 3: advance the static explanation slides until the phase hands off.
export async function advanceSlides(user: LessonUser) {
  for (let guard = 0; guard < 8; guard += 1) {
    const slides = screen.queryByTestId('explanation-slides');
    if (!slides) return;
    const next = within(slides).queryByRole('button', { name: 'Next' });
    if (next) {
      await user.click(next);
      continue;
    }
    await user.click(within(slides).getByRole('button', { name: 'Continue' }));
    return;
  }
}

// Phase 4: walk the worked-to-faded ladder, satisfying each rung's gate (a
// self-explanation on worked rungs, a continue on completion and skeleton rungs).
export async function completeWorkedLadder(user: LessonUser) {
  for (let guard = 0; guard < 16; guard += 1) {
    const worked = screen.queryByTestId('worked-example');
    if (worked) {
      const reveal = within(worked).queryByRole('button', { name: 'Reveal the solution' });
      if (reveal) await user.click(reveal);
      const explain = within(worked).queryByLabelText('Your explanation');
      if (explain) await user.type(explain, 'Because the relationship is not linear.');
      await user.click(within(worked).getByRole('button', { name: 'Continue' }));
      continue;
    }
    const completion = screen.queryByTestId('completion-problem');
    if (completion) {
      await user.click(within(completion).getByRole('button', { name: 'Continue' }));
      continue;
    }
    return;
  }
}

// Phases 1 and 5: solve a ProblemPlayer set by driving the whiteboard player's
// check/continue loop to the set-complete screen. The walk tests that use this
// mock the grader (as the ProblemPlayer suite does) so each check resolves
// correct. On the Foundation, with no authored review pool and no grading mock,
// the full graded walk is deferred (see lessonWalk.test).
export async function solveProblemSet(user: LessonUser) {
  for (let guard = 0; guard < 40; guard += 1) {
    const finished = screen.queryByRole('button', { name: 'Back to dashboard' });
    if (finished) {
      await user.click(finished);
      return;
    }
    const advance = screen.queryByRole('button', { name: /^(Continue|Finish)$/ });
    if (advance) {
      await user.click(advance);
      continue;
    }
    const check = screen.queryByRole('button', { name: /Check work/ });
    if (check) {
      await user.click(check);
      continue;
    }
    return;
  }
}
