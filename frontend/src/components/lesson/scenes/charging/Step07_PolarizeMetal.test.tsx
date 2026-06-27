import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Step07_PolarizeMetal } from './Step07_PolarizeMetal';

function electronCenters(container: HTMLElement) {
  return Array.from(container.querySelectorAll('[data-testid="cci-07-electron"]')).map((node) =>
    Number(node.getAttribute('cx')),
  );
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function nudgeRodCloser(rod: Element, presses = 14) {
  for (let index = 0; index < presses; index += 1) {
    fireEvent.keyDown(rod, { key: 'ArrowRight' });
  }
}

describe('Step07_PolarizeMetal', () => {
  it('exposes the "Charged rod" slider the explore driver looks for', () => {
    render(<Step07_PolarizeMetal />);
    expect(screen.getByRole('slider', { name: 'Charged rod' })).toBeInTheDocument();
  });

  it('renders a cluster of free electrons inside the sphere', () => {
    const { container } = render(<Step07_PolarizeMetal />);
    expect(container.querySelectorAll('[data-testid="cci-07-electron"]').length).toBeGreaterThan(3);
  });

  it('calls onExplore when the rod is moved closer with the keyboard', () => {
    const onExplore = vi.fn();
    render(<Step07_PolarizeMetal onExplore={onExplore} />);
    const rod = screen.getByRole('slider', { name: 'Charged rod' });
    nudgeRodCloser(rod, 3);
    expect(onExplore).toHaveBeenCalled();
  });

  it('pushes the free electrons toward the far side as the rod nears', () => {
    const { container } = render(<Step07_PolarizeMetal />);
    const rod = screen.getByRole('slider', { name: 'Charged rod' });
    const before = average(electronCenters(container));
    nudgeRodCloser(rod);
    const after = average(electronCenters(container));
    expect(after).toBeGreaterThan(before + 5);
  });

  it('reveals positive marks on the near side only once polarized', () => {
    const { container } = render(<Step07_PolarizeMetal />);
    const rod = screen.getByRole('slider', { name: 'Charged rod' });
    const plus = container.querySelector('[data-testid="cci-07-plus"]') as SVGGElement;
    expect(plus).toBeInTheDocument();

    const restOpacity = Number(plus.style.opacity || '0');
    expect(restOpacity).toBeLessThan(0.1);

    nudgeRodCloser(rod);
    const movedOpacity = Number(plus.style.opacity || '0');
    expect(movedOpacity).toBeGreaterThan(0.5);
  });
});
