import '@testing-library/jest-dom/vitest';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Step19_InductionSign } from './Step19_InductionSign';

describe('Step19_InductionSign', () => {
  it('renders the supporting figure as an svg', () => {
    const { container } = render(<Step19_InductionSign />);

    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('labels the two halves Before and After', () => {
    render(<Step19_InductionSign />);

    expect(screen.getByTestId('cci-19-head-before')).toHaveTextContent('Before');
    expect(screen.getByTestId('cci-19-head-after')).toHaveTextContent('After');
  });

  it('shows a negative rod held near a grounded conductor in the before half', () => {
    render(<Step19_InductionSign />);

    const before = screen.getByTestId('cci-19-before');
    const rod = within(before).getByTestId('cci-19-rod');
    expect(rod).toHaveAttribute('data-sign', 'negative');
    expect(rod.querySelector('.charge-circle-negative')).toBeInTheDocument();
    expect(within(before).getByTestId('cci-19-ground')).toBeInTheDocument();
  });

  it('leaves the conductor positive, the opposite sign, after the rod and ground are gone', () => {
    render(<Step19_InductionSign />);

    const after = screen.getByTestId('cci-19-after');
    expect(after).toHaveAttribute('data-charge', 'positive');
    expect(after.querySelector('.charge-circle-positive')).toBeInTheDocument();
    expect(within(after).queryByTestId('cci-19-rod')).not.toBeInTheDocument();
    expect(within(after).queryByTestId('cci-19-ground')).not.toBeInTheDocument();
    expect(screen.getByTestId('cci-19-result')).toHaveTextContent('Positive');
  });

  it('renders a short legend about the opposite sign with no em dash', () => {
    render(<Step19_InductionSign />);

    const legend = screen.getByText(/opposite/i);
    expect(legend).toBeInTheDocument();
    expect(legend.textContent ?? '').not.toContain('\u2014');
  });
});
