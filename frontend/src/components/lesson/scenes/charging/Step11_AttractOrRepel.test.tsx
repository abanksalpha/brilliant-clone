import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Step11_AttractOrRepel } from './Step11_AttractOrRepel';

describe('Step11_AttractOrRepel', () => {
  it('renders the supporting figure as an svg', () => {
    const { container } = render(<Step11_AttractOrRepel />);

    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('draws the charged rod and the neutral metal can', () => {
    render(<Step11_AttractOrRepel />);

    expect(screen.getByTestId('cci-11-rod')).toBeInTheDocument();
    expect(screen.getByTestId('cci-11-can')).toBeInTheDocument();
  });

  it('marks the rod as charged for either sign', () => {
    render(<Step11_AttractOrRepel />);

    expect(screen.getByTestId('cci-11-rod-sign')).toHaveTextContent('\u00b1');
  });

  it('labels the charged rod and the neutral can', () => {
    render(<Step11_AttractOrRepel />);

    expect(screen.getByTestId('cci-11-rod-label')).toHaveTextContent('charged rod');
    expect(screen.getByTestId('cci-11-can-label')).toHaveTextContent('neutral can');
  });

  it('poses the open question with a question mark over the can', () => {
    render(<Step11_AttractOrRepel />);

    expect(screen.getByTestId('cci-11-question')).toHaveTextContent('?');
  });

  it('renders a short legend that frames the question without an em dash', () => {
    render(<Step11_AttractOrRepel />);

    const legend = screen.getByText(/attract or repel/i);
    expect(legend).toBeInTheDocument();
    expect(legend.textContent ?? '').not.toContain('\u2014');
  });
});
