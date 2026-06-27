import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Step03_ElectronMobility } from './Step03_ElectronMobility';

// Force the reduced-motion branch so the scene jumps straight to its final
// frame on click instead of scheduling requestAnimationFrame in the test env.
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

describe('Step03_ElectronMobility', () => {
  it('renders both the metal and plastic slabs', () => {
    render(<Step03_ElectronMobility onExplore={vi.fn()} />);

    expect(screen.getByTestId('cci-03-slab-metal')).toBeInTheDocument();
    expect(screen.getByTestId('cci-03-slab-plastic')).toBeInTheDocument();
  });

  it('calls onExplore when the nudge trigger is clicked', async () => {
    const user = userEvent.setup();
    const onExplore = vi.fn();
    render(<Step03_ElectronMobility onExplore={onExplore} />);

    await user.click(screen.getByTestId('cci-explore-trigger'));

    expect(onExplore).toHaveBeenCalledTimes(1);
  });

  it('reaches the final frame on the reduced-motion fallback', async () => {
    const user = userEvent.setup();
    render(<Step03_ElectronMobility onExplore={vi.fn()} />);

    const trigger = screen.getByTestId('cci-explore-trigger');
    expect(trigger).toHaveTextContent('Nudge the electrons');

    await user.click(trigger);

    expect(trigger).toHaveTextContent('Nudge again');
  });
});
