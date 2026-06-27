import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { LearnerChoice } from '../../lessonExperience';
import { Step08_WhichSidePositive } from './Step08_WhichSidePositive';

const CHOICES: LearnerChoice[] = [
  { id: 'A', text: 'The near side, closest to the rod', correct: true },
  { id: 'B', text: 'The far side, away from the rod', correct: false },
];

const nearChoice = CHOICES.find((choice) => /near/i.test(choice.text))!;
const farChoice = CHOICES.find((choice) => /far/i.test(choice.text))!;

describe('Step08_WhichSidePositive', () => {
  it('calls onChoose with the near-side choice when the near region is tapped', async () => {
    const user = userEvent.setup();
    const onChoose = vi.fn();
    render(<Step08_WhichSidePositive choices={CHOICES} onChoose={onChoose} />);

    await user.click(screen.getByRole('button', { name: /near side/i }));

    expect(onChoose).toHaveBeenCalledTimes(1);
    expect(onChoose).toHaveBeenCalledWith(nearChoice);
  });

  it('calls onChoose with the far-side choice when the far region is tapped', async () => {
    const user = userEvent.setup();
    const onChoose = vi.fn();
    render(<Step08_WhichSidePositive choices={CHOICES} onChoose={onChoose} />);

    await user.click(screen.getByRole('button', { name: /far side/i }));

    expect(onChoose).toHaveBeenCalledTimes(1);
    expect(onChoose).toHaveBeenCalledWith(farChoice);
  });

  it('highlights the side named by selectedId and not the other', () => {
    render(
      <Step08_WhichSidePositive choices={CHOICES} onChoose={vi.fn()} selectedId={nearChoice.id} />,
    );

    expect(screen.getByRole('button', { name: /near side/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: /far side/i })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('does not call onChoose while disabled', async () => {
    const user = userEvent.setup();
    const onChoose = vi.fn();
    render(<Step08_WhichSidePositive choices={CHOICES} onChoose={onChoose} disabled />);

    await user.click(screen.getByRole('button', { name: /near side/i }));

    expect(onChoose).not.toHaveBeenCalled();
  });
});
