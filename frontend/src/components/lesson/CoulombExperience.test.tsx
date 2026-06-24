import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { getLessonById, type InteractiveStep } from '../../content';
import { completeCurrentStep } from '../../test/lessonDriver';
import { LessonPlayer } from './LessonPlayer';

function renderLessonOne(options?: { initialStepIndex?: number }) {
  const lesson = getLessonById('coulombs-law');
  if (!lesson) throw new Error('Missing Coulomb lesson content');

  return {
    lesson,
    ...render(
      <MemoryRouter>
        <LessonPlayer
          initialStepIndex={options?.initialStepIndex}
          initialVisitedStepCount={(options?.initialStepIndex ?? 0) + 1}
          lesson={lesson}
        />
      </MemoryRouter>,
    ),
  };
}

const ATTRACT_CHOICE = 'It pulls them together, and grows as they get closer';

describe('Lesson 1 explore-first integrity', () => {
  it('keeps the drag prediction hidden until the learner moves the charge', () => {
    renderLessonOne({ initialStepIndex: 5 }); // Step 6: opposite charges attract

    expect(screen.queryByRole('button', { name: ATTRACT_CHOICE })).not.toBeInTheDocument();

    const draggable = screen.getByRole('slider', { name: 'Draggable charge' });
    fireEvent.pointerDown(draggable, { clientX: 266, clientY: 110, pointerId: 1 });
    fireEvent.pointerMove(draggable, { clientX: 200, clientY: 110, pointerId: 1 });
    fireEvent.pointerUp(draggable, { pointerId: 1 });

    expect(screen.getByRole('button', { name: ATTRACT_CHOICE })).toBeInTheDocument();
  });

  it('does not snap the charge when it is clicked without dragging', () => {
    renderLessonOne({ initialStepIndex: 5 });

    const draggable = screen.getByRole('slider', { name: 'Draggable charge' });
    expect(draggable).toHaveAttribute('aria-valuenow', '266');

    fireEvent.pointerDown(draggable, { clientX: 240, clientY: 110, pointerId: 1 });
    fireEvent.pointerUp(draggable, { clientX: 240, clientY: 110, pointerId: 1 });

    expect(draggable).toHaveAttribute('aria-valuenow', '266');
    expect(screen.queryByRole('button', { name: ATTRACT_CHOICE })).not.toBeInTheDocument();
  });

  it('gates the inverse-square slider choices and caps discovery at 3r', () => {
    renderLessonOne({ initialStepIndex: 10 }); // Step 11: triple the distance

    const slider = screen.getByRole('slider', { name: 'Distance multiplier' }) as HTMLInputElement;
    expect(slider.max).toBe('3');
    expect(screen.queryByRole('button', { name: 'One ninth' })).not.toBeInTheDocument();

    fireEvent.change(slider, { target: { value: '3' } });

    expect(screen.getByRole('button', { name: 'One ninth' })).toBeInTheDocument();
  });

  it('lets the learner tap the attracting pair and recover from a wrong tap', async () => {
    const user = userEvent.setup();
    renderLessonOne({ initialStepIndex: 6 }); // Step 7: tap the attracting pair

    await user.click(screen.getByRole('button', { name: 'The same-sign pair, plus and plus' }));
    expect(screen.getByRole('heading', { name: 'Look again' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Try again' }));
    await user.click(screen.getByRole('button', { name: 'The opposite-sign pair, plus and minus' }));

    expect(screen.getByRole('heading', { name: 'Nice work' })).toBeInTheDocument();
  });

  it('auto-checks the aimed force vector once it points the right way', () => {
    renderLessonOne({ initialStepIndex: 8 }); // Step 9: aim the force

    const handle = screen.getByTestId('vector-aim-handle');
    for (let index = 0; index < 90; index += 1) {
      if (screen.queryByRole('heading', { name: 'Nice work' })) break;
      fireEvent.keyDown(handle, { key: 'ArrowRight' });
    }

    expect(screen.getByRole('heading', { name: 'Nice work' })).toBeInTheDocument();
  });

  it('accepts a fraction in the numeric step and recovers from a wrong value', async () => {
    const user = userEvent.setup();
    renderLessonOne({ initialStepIndex: 13 }); // Step 14: force at 5r

    const input = screen.getByRole('textbox', { name: 'Your answer' });
    await user.type(input, '1/5');
    await user.click(screen.getByRole('button', { name: 'Check answer' }));
    expect(screen.getByRole('heading', { name: 'Look again' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Try again' }));
    await user.clear(screen.getByRole('textbox', { name: 'Your answer' }));
    await user.type(screen.getByRole('textbox', { name: 'Your answer' }), '1/25');
    await user.click(screen.getByRole('button', { name: 'Check answer' }));

    expect(screen.getByRole('heading', { name: 'Nice work' })).toBeInTheDocument();
  });

  it('checks the assembled formula when the pieces land in the right slots', async () => {
    const user = userEvent.setup();
    const { lesson } = renderLessonOne({ initialStepIndex: 17 }); // Step 18: build the law

    const config = (lesson.steps[17] as InteractiveStep).buildFormula!;
    for (const pieceId of [...config.numerator, ...config.denominator]) {
      const piece = config.pieces.find((candidate) => candidate.id === pieceId)!;
      await user.click(screen.getByRole('button', { name: piece.label }));
    }
    await user.click(screen.getByRole('button', { name: 'Check formula' }));

    expect(screen.getByRole('heading', { name: 'Nice work' })).toBeInTheDocument();
  });

  it('checks the equilibrium sandbox only when the net force is near zero', async () => {
    const user = userEvent.setup();
    renderLessonOne({ initialStepIndex: 25 }); // Step 26: find the balance point

    // Checking from the off-center start position is wrong.
    await user.click(screen.getByRole('button', { name: 'Check this spot' }));
    expect(screen.getByRole('heading', { name: 'Look again' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    const board = screen.getByTestId('charge-sandbox');
    const handle = screen.getByTestId('charge-sandbox-handle');
    const target = Number(board.getAttribute('data-target-x'));
    const current = Number(handle.getAttribute('aria-valuenow'));
    const presses = Math.round((target - current) / 10);
    for (let index = 0; index < Math.abs(presses); index += 1) {
      fireEvent.keyDown(handle, { key: presses >= 0 ? 'ArrowRight' : 'ArrowLeft' });
    }

    await user.click(screen.getByRole('button', { name: 'Check this spot' }));
    expect(screen.getByRole('heading', { name: 'Nice work' })).toBeInTheDocument();
  });

  it('plays the full 27-step lesson from start to finish', async () => {
    const user = userEvent.setup();
    const { lesson } = renderLessonOne();

    for (const step of lesson.steps) {
      await completeCurrentStep(user, step);
    }

    expect(screen.getByText('You finished this topic.')).toBeInTheDocument();
  });
});
