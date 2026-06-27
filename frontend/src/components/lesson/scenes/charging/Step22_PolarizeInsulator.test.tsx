import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Step22_PolarizeInsulator } from './Step22_PolarizeInsulator';

// The rod sits on the left, so a dipole whose plus end faces the rod has that
// plus pole to the LEFT of the molecule. Averaging the plus poles' x tells us how
// far the molecules have turned to face the rod: smaller x means more aligned.
function plusCenters(container: HTMLElement) {
  return Array.from(container.querySelectorAll('[data-testid="cci-22-plus"]')).map((node) =>
    Number(node.getAttribute('cx')),
  );
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function nudgeRodCloser(rod: Element, presses = 16) {
  for (let index = 0; index < presses; index += 1) {
    fireEvent.keyDown(rod, { key: 'ArrowRight' });
  }
}

describe('Step22_PolarizeInsulator', () => {
  it('exposes the "Charged rod" slider the explore driver looks for', () => {
    render(<Step22_PolarizeInsulator />);
    expect(screen.getByRole('slider', { name: 'Charged rod' })).toBeInTheDocument();
  });

  it('renders a block of dipole molecules', () => {
    const { container } = render(<Step22_PolarizeInsulator />);
    expect(
      container.querySelectorAll('[data-testid="cci-22-molecule"]').length,
    ).toBeGreaterThan(3);
  });

  it('calls onExplore when the rod is moved closer with the keyboard', () => {
    const onExplore = vi.fn();
    render(<Step22_PolarizeInsulator onExplore={onExplore} />);
    const rod = screen.getByRole('slider', { name: 'Charged rod' });
    nudgeRodCloser(rod, 3);
    expect(onExplore).toHaveBeenCalled();
  });

  it('rotates the molecules so their plus ends turn toward the rod as it nears', () => {
    const { container } = render(<Step22_PolarizeInsulator />);
    const rod = screen.getByRole('slider', { name: 'Charged rod' });
    const before = average(plusCenters(container));
    nudgeRodCloser(rod);
    const after = average(plusCenters(container));
    expect(after).toBeLessThan(before - 5);
  });

  it('does not call onExplore before the rod is moved', () => {
    const onExplore = vi.fn();
    render(<Step22_PolarizeInsulator onExplore={onExplore} />);
    expect(onExplore).not.toHaveBeenCalled();
  });
});
