import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Step13_Conduction } from './Step13_Conduction';

// Force the reduced-motion branch so a click jumps straight to the final frame
// (rod retracted, electrons landed on the sphere) instead of scheduling
// requestAnimationFrame in the test env. Mirrors Step03 / Step18.
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
  return screen.getByTestId('cci-13-sphere');
}

function rod() {
  return screen.getByTestId('cci-13-rod');
}

describe('Step13_Conduction', () => {
  it('starts on a neutral sphere with the touch prompt and no electrons on it', () => {
    render(<Step13_Conduction onExplore={vi.fn()} />);

    expect(trigger()).toHaveTextContent('Touch the rod to the sphere');
    expect(sphere()).toHaveAttribute('data-charge', 'neutral');
    expect(sphere()).toHaveAttribute('data-electrons', '0');
  });

  it('keeps exactly one explore trigger present before and after the touch', async () => {
    const user = userEvent.setup();
    render(<Step13_Conduction onExplore={vi.fn()} />);

    expect(screen.getAllByTestId('cci-explore-trigger')).toHaveLength(1);
    await user.click(trigger());
    expect(screen.getAllByTestId('cci-explore-trigger')).toHaveLength(1);
  });

  it('calls onExplore once, only on the first touch', async () => {
    const user = userEvent.setup();
    const onExplore = vi.fn();
    render(<Step13_Conduction onExplore={onExplore} />);

    expect(onExplore).not.toHaveBeenCalled();

    await user.click(trigger());
    expect(onExplore).toHaveBeenCalledTimes(1);

    // A second touch (replay) must not re-fire the gate.
    await user.click(trigger());
    expect(onExplore).toHaveBeenCalledTimes(1);
  });

  it('transfers electrons onto the sphere so it ends visibly negative', async () => {
    const user = userEvent.setup();
    render(<Step13_Conduction onExplore={vi.fn()} />);

    // Before contact the sphere is neutral and the rod carries every electron.
    const startingRodElectrons = Number(rod().getAttribute('data-electrons'));
    expect(startingRodElectrons).toBeGreaterThanOrEqual(4);

    await user.click(trigger());

    // After the touch-and-retract the sphere has gained extra electrons and the
    // rod is left with fewer than it started with.
    const sphereElectrons = Number(sphere().getAttribute('data-electrons'));
    expect(sphereElectrons).toBeGreaterThanOrEqual(3);
    expect(sphere()).toHaveAttribute('data-charge', 'negative');

    const endingRodElectrons = Number(rod().getAttribute('data-electrons'));
    expect(endingRodElectrons).toBeLessThan(startingRodElectrons);
  });

  it('does not require onExplore to be provided', async () => {
    const user = userEvent.setup();
    render(<Step13_Conduction />);

    await user.click(trigger());
    expect(sphere()).toHaveAttribute('data-charge', 'negative');
  });
});
