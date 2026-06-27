import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Step24_SpreadToSurface } from './Step24_SpreadToSurface';

// Force the reduced-motion branch so an add jumps straight to the final frame
// (every electron spread onto the outer surface) instead of scheduling
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

function conductor() {
  return screen.getByTestId('cci-24-conductor');
}

describe('Step24_SpreadToSurface', () => {
  it('starts as an empty conductor with the add prompt and no surface charge', () => {
    render(<Step24_SpreadToSurface onExplore={vi.fn()} />);

    expect(trigger()).toHaveTextContent('Add electrons');
    expect(conductor()).toHaveAttribute('data-phase', 'empty');
    expect(conductor()).toHaveAttribute('data-electron-count', '0');
    expect(conductor()).toHaveAttribute('data-surface-count', '0');
  });

  it('keeps exactly one explore trigger present before and after adding', async () => {
    const user = userEvent.setup();
    render(<Step24_SpreadToSurface onExplore={vi.fn()} />);

    expect(screen.getAllByTestId('cci-explore-trigger')).toHaveLength(1);
    await user.click(trigger());
    expect(screen.getAllByTestId('cci-explore-trigger')).toHaveLength(1);
  });

  it('calls onExplore once, only on the first add', async () => {
    const user = userEvent.setup();
    const onExplore = vi.fn();
    render(<Step24_SpreadToSurface onExplore={onExplore} />);

    expect(onExplore).not.toHaveBeenCalled();

    await user.click(trigger());
    expect(onExplore).toHaveBeenCalledTimes(1);

    // A second add (replay) must not re-fire the gate.
    await user.click(trigger());
    expect(onExplore).toHaveBeenCalledTimes(1);
  });

  it('settles every added electron on the outer surface, none in the interior', async () => {
    const user = userEvent.setup();
    render(<Step24_SpreadToSurface onExplore={vi.fn()} />);

    await user.click(trigger());

    const el = conductor();
    expect(el).toHaveAttribute('data-phase', 'settled');

    const count = Number(el.getAttribute('data-electron-count'));
    const surface = Number(el.getAttribute('data-surface-count'));
    const interior = Number(el.getAttribute('data-interior-count'));

    // Several electrons were added, and all of them ended on the surface with
    // an empty interior: this is the "rides the surface" result, not a clump.
    expect(count).toBeGreaterThanOrEqual(6);
    expect(surface).toBe(count);
    expect(interior).toBe(0);
  });

  it('does not require onExplore to be provided', async () => {
    const user = userEvent.setup();
    render(<Step24_SpreadToSurface />);

    await user.click(trigger());
    expect(conductor()).toHaveAttribute('data-phase', 'settled');
    expect(conductor()).toHaveAttribute('data-interior-count', '0');
  });
});
