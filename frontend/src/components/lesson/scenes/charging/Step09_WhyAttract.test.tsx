import '@testing-library/jest-dom/vitest';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Step09_WhyAttract } from './Step09_WhyAttract';

function lineIn(scope: HTMLElement) {
  const line = scope.querySelector('line.force-arrow') as SVGLineElement | null;
  if (!line) throw new Error('expected a force-arrow line inside the wrapper');
  return line;
}

function dx(line: SVGLineElement) {
  return Number(line.getAttribute('x2')) - Number(line.getAttribute('x1'));
}

function shaftLength(line: SVGLineElement) {
  const ddx = Number(line.getAttribute('x2')) - Number(line.getAttribute('x1'));
  const ddy = Number(line.getAttribute('y2')) - Number(line.getAttribute('y1'));
  return Math.hypot(ddx, ddy);
}

function averageCx(nodes: Element[]) {
  return nodes.reduce((sum, node) => sum + Number(node.getAttribute('cx')), 0) / nodes.length;
}

describe('Step09_WhyAttract', () => {
  it('renders the polarized sphere, the negative rod and an svg figure', () => {
    const { container } = render(<Step09_WhyAttract />);
    expect(screen.getByTestId('cci-09-sphere')).toBeInTheDocument();
    expect(screen.getByTestId('cci-09-rod')).toBeInTheDocument();
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('shows the near side positive and the far side electrons', () => {
    const { container } = render(<Step09_WhyAttract />);
    const plus = Array.from(container.querySelectorAll('.cci-09-plus-mark'));
    const electrons = Array.from(container.querySelectorAll('.cci-09-electron'));
    expect(plus.length).toBeGreaterThan(0);
    expect(electrons.length).toBeGreaterThan(0);
    // The positive (near) cluster sits closer to the rod than the electron (far) cluster.
    expect(averageCx(plus)).toBeLessThan(averageCx(electrons));
  });

  it('points the attraction toward the rod and the repulsion away from it', () => {
    render(<Step09_WhyAttract />);
    const attract = lineIn(screen.getByTestId('cci-09-attract'));
    const repel = lineIn(screen.getByTestId('cci-09-repel'));
    // Rod is on the left, so "toward the rod" is leftward (negative dx).
    expect(dx(attract)).toBeLessThan(0);
    expect(dx(repel)).toBeGreaterThan(0);
  });

  it('draws a net arrow with the net tone pointing toward the rod', () => {
    render(<Step09_WhyAttract />);
    const netWrapper = screen.getByTestId('cci-09-net');
    const netLine = netWrapper.querySelector('line.force-arrow-net') as SVGLineElement | null;
    expect(netLine).not.toBeNull();
    expect(dx(netLine as SVGLineElement)).toBeLessThan(0);
  });

  it('makes the near attraction read clearly stronger than the far repulsion', () => {
    render(<Step09_WhyAttract />);
    const attract = shaftLength(lineIn(screen.getByTestId('cci-09-attract')));
    const repel = shaftLength(lineIn(screen.getByTestId('cci-09-repel')));
    const net = shaftLength(lineIn(screen.getByTestId('cci-09-net')));
    // Big near pull vs small far push: a clear, unmistakable size gap.
    expect(attract).toBeGreaterThan(repel * 2);
    // The net pull is the leftover of the two, so it lands between them.
    expect(net).toBeLessThan(attract);
    expect(net).toBeGreaterThan(repel);
  });

  it('explains the result in a legend with no em dash', () => {
    render(<Step09_WhyAttract />);
    const legend = screen.getByText(/toward the rod/i);
    expect(legend).toBeInTheDocument();
    expect(legend.textContent ?? '').not.toContain('\u2014');
  });
});
