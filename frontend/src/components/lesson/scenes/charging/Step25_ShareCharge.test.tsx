import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Step25_ShareCharge } from './Step25_ShareCharge';

describe('Step25_ShareCharge', () => {
  it('renders the before charge Q and the two shared Q/2 labels without crashing', () => {
    const { container } = render(<Step25_ShareCharge />);

    // The supporting figure renders through the shared Figure primitive (an SVG).
    expect(container.querySelector('svg')).toBeInTheDocument();

    // Before separation: one sphere carries the full charge Q.
    expect(screen.getByText('Q')).toBeInTheDocument();

    // After separation: the two identical spheres each carry Q/2.
    expect(screen.getAllByText('Q/2')).toHaveLength(2);
  });
});
