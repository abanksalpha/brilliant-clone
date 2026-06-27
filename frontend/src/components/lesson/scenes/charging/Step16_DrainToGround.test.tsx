import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Step16_DrainToGround } from './Step16_DrainToGround';

// Force the reduced-motion branch so a click jumps straight to the final frame
// (switch closed, every excess electron drained to earth) instead of scheduling
// requestAnimationFrame in the test env. Mirrors Step13 / Step18.
beforeEach(() => {
  vi.stubGlobal(
    'matchMedia',
    (query: string) =>
      ({
        matches: true,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(() => false),
      }) as unknown as MediaQueryList,
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function trigger() {
  return screen.getByTestId('cci-explore-trigger');
}

function sphere() {
  return screen.getByTestId('cci-16-sphere');
}

describe('Step16_DrainToGround', () => {
  it('starts on a negatively charged sphere with the connect prompt', () => {
    render(<Step16_DrainToGround onExplore={vi.fn()} />);

    expect(trigger()).toHaveTextContent('Connect to ground');
    expect(sphere()).toHaveAttribute('data-charge', 'negative');
    expect(Number(sphere().getAttribute('data-electrons'))).toBeGreaterThanOrEqual(4);
  });

  it('keeps exactly one explore trigger present before and after connecting', async () => {
    const user = userEvent.setup();
    render(<Step16_DrainToGround onExplore={vi.fn()} />);

    expect(screen.getAllByTestId('cci-explore-trigger')).toHaveLength(1);
    await user.click(trigger());
    expect(screen.getAllByTestId('cci-explore-trigger')).toHaveLength(1);
  });

  it('calls onExplore once, only on the first connect', async () => {
    const user = userEvent.setup();
    const onExplore = vi.fn();
    render(<Step16_DrainToGround onExplore={onExplore} />);

    expect(onExplore).not.toHaveBeenCalled();

    await user.click(trigger());
    expect(onExplore).toHaveBeenCalledTimes(1);

    // A second connect (replay) must not re-fire the gate.
    await user.click(trigger());
    expect(onExplore).toHaveBeenCalledTimes(1);
  });

  it('drains the excess electrons to earth so the sphere ends neutral', async () => {
    const user = userEvent.setup();
    render(<Step16_DrainToGround onExplore={vi.fn()} />);

    const startingElectrons = Number(sphere().getAttribute('data-electrons'));
    expect(startingElectrons).toBeGreaterThanOrEqual(4);

    await user.click(trigger());

    expect(sphere()).toHaveAttribute('data-charge', 'neutral');
    expect(Number(sphere().getAttribute('data-electrons'))).toBe(0);
  });

  it('does not require onExplore to be provided', async () => {
    const user = userEvent.setup();
    render(<Step16_DrainToGround />);

    await user.click(trigger());
    expect(sphere()).toHaveAttribute('data-charge', 'neutral');
  });
});
