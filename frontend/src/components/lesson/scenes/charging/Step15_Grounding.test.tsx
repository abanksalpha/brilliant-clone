import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Step15_Grounding } from './Step15_Grounding';

describe('Step15_Grounding', () => {
  it('renders the charged metal sphere inside an svg', () => {
    const { container } = render(<Step15_Grounding />);

    expect(screen.getByTestId('cci-15-sphere')).toBeInTheDocument();
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('shows the sphere carrying excess electrons, so it reads as charged', () => {
    const { container } = render(<Step15_Grounding />);

    expect(container.querySelectorAll('.cci-15-sphere-electron').length).toBeGreaterThanOrEqual(3);
  });

  it('connects the sphere to the ground with a vertical wire anchored at the sphere edge', () => {
    render(<Step15_Grounding />);

    const sphere = screen.getByTestId('cci-15-sphere');
    const wire = screen.getByTestId('cci-15-wire');
    const cx = Number(sphere.getAttribute('cx'));
    const cy = Number(sphere.getAttribute('cy'));
    const r = Number(sphere.getAttribute('r'));
    const x1 = Number(wire.getAttribute('x1'));
    const x2 = Number(wire.getAttribute('x2'));
    const y1 = Number(wire.getAttribute('y1'));
    const y2 = Number(wire.getAttribute('y2'));

    // Vertical wire, aligned on the sphere's center column.
    expect(x1).toBe(x2);
    expect(Math.abs(x1 - cx)).toBeLessThanOrEqual(1);
    // Runs downward from the sphere edge toward the ground below it.
    expect(Math.max(y1, y2)).toBeGreaterThan(Math.min(y1, y2));
    expect(Math.min(y1, y2)).toBeGreaterThanOrEqual(cy + r - 2);
  });

  it('draws a standard ground symbol of three bars that shrink as they descend', () => {
    const { container } = render(<Step15_Grounding />);

    const bars = Array.from(container.querySelectorAll('.cci-15-ground-bar'));
    expect(bars.length).toBe(3);

    const widths = bars.map(
      (bar) => Math.abs(Number(bar.getAttribute('x2')) - Number(bar.getAttribute('x1'))),
    );
    expect(widths[0]).toBeGreaterThan(widths[1]);
    expect(widths[1]).toBeGreaterThan(widths[2]);

    const ys = bars.map((bar) => Number(bar.getAttribute('y1')));
    expect(ys[0]).toBeLessThan(ys[1]);
    expect(ys[1]).toBeLessThan(ys[2]);
  });

  it('shows electrons riding the wire between the sphere and the ground', () => {
    render(<Step15_Grounding />);

    const sphere = screen.getByTestId('cci-15-sphere');
    const cx = Number(sphere.getAttribute('cx'));
    const cy = Number(sphere.getAttribute('cy'));
    const r = Number(sphere.getAttribute('r'));

    const wireElectrons = screen.getAllByTestId('cci-15-wire-electron');
    expect(wireElectrons.length).toBeGreaterThanOrEqual(3);
    wireElectrons.forEach((el) => {
      const ex = Number(el.getAttribute('cx'));
      const ey = Number(el.getAttribute('cy'));
      expect(Math.abs(ex - cx)).toBeLessThanOrEqual(6);
      expect(ey).toBeGreaterThan(cy + r - 2);
    });
  });

  it('marks the flow as bidirectional, electrons can go either way', () => {
    const { container } = render(<Step15_Grounding />);

    // Two arrowheads (one up, one down) convey flow off to ground or back up.
    expect(container.querySelectorAll('.cci-15-flow-head').length).toBe(2);
  });

  it('renders a short legend about the limitless reservoir with no em dash', () => {
    render(<Step15_Grounding />);

    const legend = screen.getByText(/reservoir/i);
    expect(legend).toBeInTheDocument();
    expect(legend.textContent ?? '').not.toContain('\u2014');
  });
});
