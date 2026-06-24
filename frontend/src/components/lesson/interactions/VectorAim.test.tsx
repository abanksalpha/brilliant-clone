import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { VectorAimConfig } from '../../../content';
import { VectorAim } from './VectorAim';

const config: VectorAimConfig = {
  targetAngleDeg: 180,
  toleranceDeg: 12,
  pivotSign: '-',
  targetSign: '+',
};

// The arrow starts 125° off target, so it can be aligned with deliberate nudges.
describe('VectorAim', () => {
  it('does not accept the arrow until it is genuinely aligned, then snaps it dead-on', () => {
    const onResult = vi.fn();
    render(<VectorAim config={config} onResult={onResult} />);

    const handle = screen.getByTestId('vector-aim-handle');

    // 28 left nudges land on 193°, which is 13° off — just outside the 12° band.
    for (let index = 0; index < 28; index += 1) {
      fireEvent.keyDown(handle, { key: 'ArrowLeft' });
    }
    expect(onResult).not.toHaveBeenCalled();
    expect(handle).toHaveAttribute('aria-valuenow', '193');

    // One more nudge reaches 189° (within tolerance): it accepts and snaps to 180°.
    fireEvent.keyDown(handle, { key: 'ArrowLeft' });
    expect(onResult).toHaveBeenCalledWith('correct');
    expect(handle).toHaveAttribute('aria-valuenow', '180');
  });

  it('locks once resolved so further nudges cannot knock it back off target', () => {
    const onResult = vi.fn();
    render(<VectorAim config={config} onResult={onResult} />);

    const handle = screen.getByTestId('vector-aim-handle');
    for (let index = 0; index < 90; index += 1) {
      if (onResult.mock.calls.length > 0) break;
      fireEvent.keyDown(handle, { key: 'ArrowLeft' });
    }

    expect(onResult).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(handle, { key: 'ArrowLeft' });
    fireEvent.keyDown(handle, { key: 'ArrowRight' });
    expect(onResult).toHaveBeenCalledTimes(1);
    expect(handle).toHaveAttribute('aria-valuenow', '180');
  });
});
