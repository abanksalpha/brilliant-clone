import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { SandboxConfig } from '../../../content';
import { ChargeSandbox } from './ChargeSandbox';

const exploreConfig: SandboxConfig = {
  width: 10,
  height: 6,
  fixedCharges: [
    { id: 'left', x: 2, y: 3, q: 1 },
    { id: 'right', x: 8, y: 3, q: -1 },
  ],
  testCharge: { id: 'test', x: 5, y: 1.7, q: 1 },
};

const goalConfig: SandboxConfig = {
  width: 10,
  height: 6,
  fixedCharges: [
    { id: 'a', x: 2, y: 3, q: 1 },
    { id: 'b', x: 8, y: 3, q: 1 },
  ],
  testCharge: { id: 'test', x: 3.6, y: 3, q: 1 },
  lockAxis: 'x',
  goal: { type: 'equilibrium', toleranceForce: 0.02, targetX: 5 },
};

describe('ChargeSandbox explore mode', () => {
  it('shows a live net-force readout and marks exploration on first move', () => {
    const onExplore = vi.fn();
    render(<ChargeSandbox config={exploreConfig} onExplore={onExplore} />);

    expect(screen.getByText('Net force on test charge')).toBeInTheDocument();

    fireEvent.keyDown(screen.getByTestId('charge-sandbox-handle'), { key: 'ArrowRight' });
    expect(onExplore).toHaveBeenCalled();
  });
});

describe('ChargeSandbox equilibrium goal', () => {
  it('is wrong off-center and correct at the balance point', () => {
    const onResult = vi.fn();
    render(<ChargeSandbox config={goalConfig} onResult={onResult} />);

    // The off-center start position has a non-zero net force.
    fireEvent.click(screen.getByRole('button', { name: 'Check this spot' }));
    expect(onResult).toHaveBeenLastCalledWith('wrong');

    const board = screen.getByTestId('charge-sandbox');
    const handle = screen.getByTestId('charge-sandbox-handle');
    const target = Number(board.getAttribute('data-target-x'));
    const current = Number(handle.getAttribute('aria-valuenow'));
    const presses = Math.round((target - current) / 10);
    for (let index = 0; index < Math.abs(presses); index += 1) {
      fireEvent.keyDown(handle, { key: presses >= 0 ? 'ArrowRight' : 'ArrowLeft' });
    }

    fireEvent.click(screen.getByRole('button', { name: 'Check this spot' }));
    expect(onResult).toHaveBeenLastCalledWith('correct');
  });

  it('locks vertical movement to keep the test charge on the axis', () => {
    render(<ChargeSandbox config={goalConfig} onResult={vi.fn()} />);
    const handle = screen.getByTestId('charge-sandbox-handle');
    const before = handle.getAttribute('aria-valuenow');

    fireEvent.keyDown(handle, { key: 'ArrowUp' });
    fireEvent.keyDown(handle, { key: 'ArrowDown' });

    // aria-valuenow tracks the x position; vertical keys must not change it.
    expect(handle.getAttribute('aria-valuenow')).toBe(before);
  });
});
