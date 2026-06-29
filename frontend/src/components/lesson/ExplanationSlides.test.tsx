import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ExplanationSlides } from './ExplanationSlides';
import type { Slide } from '../../content';

const TWO_SLIDES: Slide[] = [
  {
    heading: 'Charge is conserved',
    body: 'Charge is never created or destroyed. It only moves from one object to another.',
  },
  {
    heading: 'Like charges repel',
    body: 'Two objects with the same sign push apart. Opposite signs pull together.',
  },
];

describe('ExplanationSlides', () => {
  it('renders the first slide on mount', () => {
    render(<ExplanationSlides slides={TWO_SLIDES} onComplete={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Charge is conserved' })).toBeInTheDocument();
    expect(
      screen.getByText('Charge is never created or destroyed. It only moves from one object to another.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Like charges repel' })).not.toBeInTheDocument();
  });

  it('advances to the next slide when Next is pressed', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(<ExplanationSlides slides={TWO_SLIDES} onComplete={onComplete} />);

    await user.click(screen.getByRole('button', { name: 'Next' }));

    expect(screen.getByRole('heading', { name: 'Like charges repel' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Charge is conserved' })).not.toBeInTheDocument();
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('calls onComplete from the last slide button', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(<ExplanationSlides slides={TWO_SLIDES} onComplete={onComplete} />);

    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('calls onComplete from the only button when there is a single slide', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(
      <ExplanationSlides
        slides={[{ heading: 'One idea', body: 'A single comprehensive slide is enough here.' }]}
        onComplete={onComplete}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('reports the slide index on mount and on every advance', async () => {
    const user = userEvent.setup();
    const onStepChange = vi.fn();
    render(<ExplanationSlides slides={TWO_SLIDES} onComplete={vi.fn()} onStepChange={onStepChange} />);

    // Fires once on mount with the first slide.
    expect(onStepChange).toHaveBeenLastCalledWith(0);

    await user.click(screen.getByRole('button', { name: 'Next' }));

    expect(onStepChange).toHaveBeenLastCalledWith(1);
  });

  it('renders optional figure text when present and omits it otherwise', () => {
    const { rerender } = render(
      <ExplanationSlides
        slides={[{ body: 'Body without a figure.' }]}
        onComplete={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('explanation-figure')).not.toBeInTheDocument();

    rerender(
      <ExplanationSlides
        slides={[{ body: 'Body with a figure.', figure: 'Two charged spheres connected by a field arrow.' }]}
        onComplete={vi.fn()}
      />,
    );
    expect(screen.getByTestId('explanation-figure')).toHaveTextContent(
      'Two charged spheres connected by a field arrow.',
    );
  });
});
