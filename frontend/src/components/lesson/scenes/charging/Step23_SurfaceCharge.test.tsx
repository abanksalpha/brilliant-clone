import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Step23_SurfaceCharge } from './Step23_SurfaceCharge';

function electronCenters(container: HTMLElement) {
  return Array.from(container.querySelectorAll('.cci-23-electron')).map((node) => ({
    x: Number(node.getAttribute('cx')),
    y: Number(node.getAttribute('cy')),
  }));
}

describe('Step23_SurfaceCharge', () => {
  it('renders the solid metal blob inside an svg', () => {
    const { container } = render(<Step23_SurfaceCharge />);

    expect(screen.getByTestId('cci-23-blob')).toBeInTheDocument();
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('spreads a full set of excess electrons around the blob', () => {
    const { container } = render(<Step23_SurfaceCharge />);

    expect(electronCenters(container).length).toBeGreaterThanOrEqual(14);
  });

  it('keeps every excess electron on the outer surface with an empty interior', () => {
    const { container } = render(<Step23_SurfaceCharge />);
    const centers = electronCenters(container);
    expect(centers.length).toBeGreaterThan(0);

    const cx = centers.reduce((sum, p) => sum + p.x, 0) / centers.length;
    const cy = centers.reduce((sum, p) => sum + p.y, 0) / centers.length;
    const distances = centers.map((p) => Math.hypot(p.x - cx, p.y - cy));
    const min = Math.min(...distances);
    const max = Math.max(...distances);

    // Nothing sits near the centre: the interior is empty.
    expect(min).toBeGreaterThan(40);
    // They all hug a single rim rather than filling the body.
    expect(max - min).toBeLessThan(45);
  });

  it('renders a short legend about surface charge with no em dash', () => {
    render(<Step23_SurfaceCharge />);

    const legend = screen.getByText(/surface/i);
    expect(legend).toBeInTheDocument();
    expect(legend.textContent ?? '').not.toContain('\u2014');
  });
});
