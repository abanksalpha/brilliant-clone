import { fireEvent, screen } from '@testing-library/react';
import type userEvent from '@testing-library/user-event';
import type { Step } from '../content';

export type LessonUser = ReturnType<typeof userEvent.setup>;

export const ADVANCE_LABEL = /Continue|Finish lesson/;

// Lesson 1 hides several answers behind real exploration (drag a charge, move a
// slider). This trips those gates generically so a walker can advance; it only
// ever touches Lesson 1 controls and is a no-op on plain multiple-choice steps.
export function revealLessonOneGates() {
  const draggable = screen.queryByRole('slider', { name: 'Draggable charge' });
  if (draggable) {
    for (let index = 0; index < 20; index += 1) fireEvent.keyDown(draggable, { key: 'ArrowLeft' });
    for (let index = 0; index < 20; index += 1) fireEvent.keyDown(draggable, { key: 'ArrowRight' });
  }

  for (const name of ['Distance multiplier', 'Charge magnitude']) {
    const slider = screen.queryByRole('slider', { name }) as HTMLInputElement | null;
    if (slider && !slider.disabled) {
      fireEvent.change(slider, { target: { value: slider.max } });
    }
  }
}

// Lesson 2 hides several answers behind exploration too (drag a rod, step through
// induction). This trips those gates generically and is a no-op on any step that
// does not expose the lesson-2 explore controls. Every explore-gated lesson-2
// scene must satisfy one of these contracts: an SVG slider named "Charged rod" or
// "Test charge" the driver nudges, or a button with
// data-testid="cci-explore-trigger" the driver clicks (repeatedly for staged
// scenes such as induction).
export function revealLessonTwoGates() {
  for (const name of ['Charged rod', 'Test charge']) {
    for (const slider of screen.queryAllByRole('slider', { name })) {
      for (let index = 0; index < 20; index += 1) fireEvent.keyDown(slider, { key: 'ArrowLeft' });
      for (let index = 0; index < 20; index += 1) fireEvent.keyDown(slider, { key: 'ArrowRight' });
    }
  }

  // Staged scenes advance one stage per click and keep the same trigger; click
  // until it is gone, with a guard against an unexpected infinite loop.
  for (let guard = 0; guard < 12; guard += 1) {
    const triggers = screen.queryAllByTestId('cci-explore-trigger');
    if (triggers.length === 0) break;
    fireEvent.click(triggers[0]);
  }
}

async function clickAdvance(user: LessonUser) {
  await user.click(screen.getByRole('button', { name: ADVANCE_LABEL }));
}

async function chooseCorrect(user: LessonUser, step: Step) {
  const correct = step.type === 'interactive' ? step.choices?.find((choice) => choice.correct) : undefined;
  if (!correct) {
    await clickAdvance(user);
    return;
  }
  await user.click(screen.getByRole('button', { name: correct.text }));
}

async function solveNumeric(user: LessonUser, step: Step) {
  if (step.type !== 'interactive' || !step.numeric) return;
  const answer = step.numeric.accepts?.[0] ?? String(step.numeric.answer);
  const input = screen.getByRole('textbox', { name: 'Your answer' });
  await user.clear(input);
  await user.type(input, answer);
  await user.click(screen.getByRole('button', { name: 'Check answer' }));
}

async function solveOrdering(user: LessonUser, step: Step) {
  if (step.type !== 'interactive' || !step.ordering) return;
  const correctIds = step.ordering.correctOrder ?? step.ordering.items.map((item) => item.id);
  const labelById = new Map(step.ordering.items.map((item) => [item.id, item.label]));
  const currentOrder = () =>
    Array.from(document.querySelectorAll('[data-cci-order-id]')).map(
      (element) => element.getAttribute('data-cci-order-id') ?? '',
    );

  // Selection sort using the widget's Up controls: settle each id into place from
  // the top down so already-placed rows are never disturbed.
  for (let targetIndex = 0; targetIndex < correctIds.length; targetIndex += 1) {
    const wantedId = correctIds[targetIndex];
    let currentIndex = currentOrder().indexOf(wantedId);
    while (currentIndex > targetIndex) {
      const label = labelById.get(wantedId) ?? '';
      await user.click(screen.getByRole('button', { name: `Move ${label} up` }));
      currentIndex -= 1;
    }
  }

  await user.click(screen.getByRole('button', { name: 'Check order' }));
}

async function solveBuildFormula(user: LessonUser, step: Step) {
  if (step.type !== 'interactive' || !step.buildFormula) return;
  const { pieces, numerator, denominator } = step.buildFormula;
  for (const pieceId of [...numerator, ...denominator]) {
    const piece = pieces.find((candidate) => candidate.id === pieceId);
    if (!piece) continue;
    await user.click(screen.getByRole('button', { name: piece.label }));
  }
  await user.click(screen.getByRole('button', { name: 'Check formula' }));
}

// The aim arrow auto-resolves once it lands within tolerance, so spin it with the
// keyboard until the success heading appears.
function solveVectorAim() {
  const handle = screen.getByTestId('vector-aim-handle');
  for (let index = 0; index < 90; index += 1) {
    if (screen.queryByRole('heading', { name: 'Nice work' })) break;
    fireEvent.keyDown(handle, { key: 'ArrowRight' });
  }
}

async function solveSandbox(user: LessonUser, step: Step) {
  if (step.type !== 'interactive' || !step.sandbox) return;
  const handle = screen.getByTestId('charge-sandbox-handle');

  if (step.sandbox.goal) {
    const board = screen.getByTestId('charge-sandbox');
    const targetValue = Number(board.getAttribute('data-target-x'));
    const current = Number(handle.getAttribute('aria-valuenow'));
    const stepValue = 10; // keyboard nudge is 0.1 logical units, reported as *100
    const presses = Math.round((targetValue - current) / stepValue);
    const key = presses >= 0 ? 'ArrowRight' : 'ArrowLeft';
    for (let index = 0; index < Math.abs(presses); index += 1) {
      fireEvent.keyDown(handle, { key });
    }
    await user.click(screen.getByRole('button', { name: 'Check this spot' }));
    return;
  }

  fireEvent.keyDown(handle, { key: 'ArrowRight' });
  await chooseCorrect(user, step);
}

/** Drive whatever interaction the current step renders to a correct, advanced state. */
export async function completeCurrentStep(user: LessonUser, step: Step) {
  if (step.type === 'concept') {
    await clickAdvance(user);
    return;
  }

  switch (step.interactionType) {
    case 'numeric':
      await solveNumeric(user, step);
      break;
    case 'ordering':
      await solveOrdering(user, step);
      break;
    case 'build-formula':
      await solveBuildFormula(user, step);
      break;
    case 'vector-aim':
      solveVectorAim();
      break;
    case 'sandbox':
      await solveSandbox(user, step);
      break;
    case 'tap': {
      const rub = screen.queryByRole('button', { name: 'Rub A against B' });
      if (rub) await user.click(rub);
      revealLessonOneGates();
      revealLessonTwoGates();
      await chooseCorrect(user, step);
      break;
    }
    default:
      revealLessonOneGates();
      revealLessonTwoGates();
      await chooseCorrect(user, step);
  }

  await clickAdvance(user);
}
