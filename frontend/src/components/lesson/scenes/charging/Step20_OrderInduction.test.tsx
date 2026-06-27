import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Step20_OrderInduction } from './Step20_OrderInduction';

describe('Step20_OrderInduction', () => {
  it('renders the static induction reference figure', () => {
    const { container } = render(<Step20_OrderInduction />);

    // The supporting figure renders through the shared Figure primitive (an SVG).
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('labels the three pieces of the induction setup', () => {
    render(<Step20_OrderInduction />);

    // Rod, sphere, and ground are the cast the learner sequences in the rail.
    expect(screen.getByText('charged rod')).toBeInTheDocument();
    expect(screen.getByText('metal sphere')).toBeInTheDocument();
    expect(screen.getByText('ground')).toBeInTheDocument();
  });

  it('keeps the sphere neutral so it does not give away the order', () => {
    render(<Step20_OrderInduction />);

    // A balanced figure shows the conductor still neutral: equal positive cores
    // and free electrons, no polarized split that would hint at the steps.
    const scene = screen.getByTestId('cci-20-sphere');
    expect(scene).toHaveAttribute('data-charge', 'neutral');
  });
});
