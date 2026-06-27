import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Step10_NetPull } from './Step10_NetPull';

// The Arrow primitive renders a <line> from the tail and a <polygon> whose first
// point is the tip. We read those to assert direction and magnitude.
function arrowTip(container: HTMLElement, testId: string) {
  const polygon = container.querySelector(`[data-testid="${testId}"] polygon`);
  const first = polygon?.getAttribute('points')?.trim().split(/\s+/)[0] ?? '0,0';
  return Number(first.split(',')[0]);
}

function arrowTail(container: HTMLElement, testId: string) {
  const line = container.querySelector(`[data-testid="${testId}"] line`);
  return Number(line?.getAttribute('x1'));
}

function nudgeRodCloser(rod: Element, presses = 8) {
  for (let index = 0; index < presses; index += 1) {
    fireEvent.keyDown(rod, { key: 'ArrowRight' });
  }
}

describe('Step10_NetPull', () => {
  it('exposes the "Charged rod" slider the explore driver looks for', () => {
    render(<Step10_NetPull />);
    expect(screen.getByRole('slider', { name: 'Charged rod' })).toBeInTheDocument();
  });

  it('calls onExplore once the rod is moved meaningfully', () => {
    const onExplore = vi.fn();
    render(<Step10_NetPull onExplore={onExplore} />);
    const rod = screen.getByRole('slider', { name: 'Charged rod' });
    nudgeRodCloser(rod, 3);
    expect(onExplore).toHaveBeenCalled();
  });

  it('points the net arrow toward the rod (to the left)', () => {
    const { container } = render(<Step10_NetPull />);
    const tip = arrowTip(container, 'cci-10-arrow-net');
    const tail = arrowTail(container, 'cci-10-arrow-net');
    expect(tip).toBeLessThan(tail);
  });

  it('keeps the net arrow pointing toward the rod even after dragging closer', () => {
    const { container } = render(<Step10_NetPull />);
    const rod = screen.getByRole('slider', { name: 'Charged rod' });
    nudgeRodCloser(rod);
    expect(arrowTip(container, 'cci-10-arrow-net')).toBeLessThan(
      arrowTail(container, 'cci-10-arrow-net'),
    );
  });

  it('grows the net pull as the rod nears the sphere', () => {
    const { container } = render(<Step10_NetPull />);
    const rod = screen.getByRole('slider', { name: 'Charged rod' });
    const tipBefore = arrowTip(container, 'cci-10-arrow-net');
    nudgeRodCloser(rod);
    const tipAfter = arrowTip(container, 'cci-10-arrow-net');
    // A longer leftward arrow reaches a smaller x, so the tip moves toward the rod.
    expect(tipAfter).toBeLessThan(tipBefore);
  });

  it('keeps the near attraction stronger than the far repulsion', () => {
    const { container } = render(<Step10_NetPull />);
    const nearLength = arrowTail(container, 'cci-10-arrow-near') - arrowTip(container, 'cci-10-arrow-near');
    const farLength = arrowTip(container, 'cci-10-arrow-far') - arrowTail(container, 'cci-10-arrow-far');
    expect(nearLength).toBeGreaterThan(farLength);
  });
});
