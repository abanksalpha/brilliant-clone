import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Step18_Induction } from './Step18_Induction';

// Force the reduced-motion branch so each advance jumps straight to the target
// stage's final frame instead of scheduling requestAnimationFrame in the test
// env. This makes the staged transitions deterministic and synchronous.
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
  return screen.getByTestId('cci-18-sphere');
}

describe('Step18_Induction', () => {
  it('starts on a neutral sphere with the first stage prompt', () => {
    render(<Step18_Induction onExplore={vi.fn()} />);

    expect(trigger()).toHaveTextContent('Bring the rod near');
    expect(sphere()).toHaveAttribute('data-stage', '0');
    expect(sphere()).toHaveAttribute('data-charge', 'neutral');
  });

  it('keeps exactly one explore trigger present through every stage', async () => {
    const user = userEvent.setup();
    render(<Step18_Induction onExplore={vi.fn()} />);

    for (let i = 0; i < 5; i += 1) {
      expect(screen.getAllByTestId('cci-explore-trigger')).toHaveLength(1);
      await user.click(trigger());
    }
    expect(screen.getAllByTestId('cci-explore-trigger')).toHaveLength(1);
  });

  it('calls onExplore once, only on the first advance', async () => {
    const user = userEvent.setup();
    const onExplore = vi.fn();
    render(<Step18_Induction onExplore={onExplore} />);

    expect(onExplore).not.toHaveBeenCalled();

    await user.click(trigger());
    expect(onExplore).toHaveBeenCalledTimes(1);

    await user.click(trigger());
    await user.click(trigger());
    expect(onExplore).toHaveBeenCalledTimes(1);
  });

  it('advances through the four induction stages and ends on a positive sphere', async () => {
    const user = userEvent.setup();
    render(<Step18_Induction onExplore={vi.fn()} />);

    // Stage 0 -> 1: bring the rod near (still neutral, just polarized).
    await user.click(trigger());
    expect(sphere()).toHaveAttribute('data-stage', '1');
    expect(sphere()).toHaveAttribute('data-charge', 'neutral');
    expect(trigger()).toHaveTextContent('Connect to ground');

    // Stage 1 -> 2: ground the far side; repelled electrons drain to earth.
    await user.click(trigger());
    expect(sphere()).toHaveAttribute('data-stage', '2');
    expect(sphere()).toHaveAttribute('data-charge', 'positive');
    expect(trigger()).toHaveTextContent('Disconnect ground');

    // Stage 2 -> 3: disconnect the ground (electrons cannot return).
    await user.click(trigger());
    expect(sphere()).toHaveAttribute('data-stage', '3');
    expect(sphere()).toHaveAttribute('data-charge', 'positive');
    expect(trigger()).toHaveTextContent('Remove the rod');

    // Stage 3 -> 4: remove the rod; the sphere is left clearly positive.
    await user.click(trigger());
    expect(sphere()).toHaveAttribute('data-stage', '4');
    expect(sphere()).toHaveAttribute('data-charge', 'positive');
    expect(trigger()).toHaveTextContent('Replay');
  });

  it('replays back to the neutral start without re-firing onExplore', async () => {
    const user = userEvent.setup();
    const onExplore = vi.fn();
    render(<Step18_Induction onExplore={onExplore} />);

    for (let i = 0; i < 4; i += 1) await user.click(trigger());
    expect(trigger()).toHaveTextContent('Replay');
    expect(sphere()).toHaveAttribute('data-charge', 'positive');

    await user.click(trigger());
    expect(trigger()).toHaveTextContent('Bring the rod near');
    expect(sphere()).toHaveAttribute('data-stage', '0');
    expect(sphere()).toHaveAttribute('data-charge', 'neutral');
    expect(onExplore).toHaveBeenCalledTimes(1);
  });

  it('does not require onExplore to be provided', async () => {
    const user = userEvent.setup();
    render(<Step18_Induction />);

    await user.click(trigger());
    expect(sphere()).toHaveAttribute('data-stage', '1');
  });
});
