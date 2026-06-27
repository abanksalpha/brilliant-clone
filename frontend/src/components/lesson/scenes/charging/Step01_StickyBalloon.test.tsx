import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Step01_StickyBalloon } from './Step01_StickyBalloon';

describe('Step01_StickyBalloon', () => {
  it('renders the charged balloon and the wall without crashing', () => {
    const { container } = render(<Step01_StickyBalloon />);

    expect(screen.getByTestId('cci-01-balloon')).toBeInTheDocument();
    expect(screen.getByTestId('cci-01-wall')).toBeInTheDocument();
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('labels the wall as neutral', () => {
    render(<Step01_StickyBalloon />);

    expect(screen.getByTestId('cci-01-wall-label')).toHaveTextContent('neutral');
  });

  it('shows a few charge marks on the balloon', () => {
    const { container } = render(<Step01_StickyBalloon />);

    expect(container.querySelectorAll('.cci-01-charge').length).toBeGreaterThan(0);
  });

  it('renders a legend that poses the puzzle without an em dash', () => {
    render(<Step01_StickyBalloon />);

    const legend = screen.getByText(/neutral wall/i);
    expect(legend).toBeInTheDocument();
    expect(legend.textContent ?? '').not.toContain('\u2014');
  });
});
