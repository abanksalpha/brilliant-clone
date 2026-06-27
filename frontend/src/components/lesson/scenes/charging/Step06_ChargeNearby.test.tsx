import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Step06_ChargeNearby } from './Step06_ChargeNearby';

describe('Step06_ChargeNearby', () => {
  it('renders the neutral metal sphere and a free electron sea inside an svg', () => {
    const { container } = render(<Step06_ChargeNearby />);

    expect(screen.getByTestId('cci-06-sphere')).toBeInTheDocument();
    expect(container.querySelector('svg')).toBeInTheDocument();
    expect(screen.getAllByTestId('cci-06-electron').length).toBeGreaterThanOrEqual(6);
  });

  it('holds a charged rod a short distance to one side without touching the sphere', () => {
    render(<Step06_ChargeNearby />);

    const rod = screen.getByTestId('cci-06-rod');
    const sphere = screen.getByTestId('cci-06-sphere');
    const rodRight = Number(rod.getAttribute('x')) + Number(rod.getAttribute('width'));
    const center = Number(sphere.getAttribute('cx'));
    const radius = Number(sphere.getAttribute('r'));

    expect(rodRight).toBeLessThan(center - radius);
  });

  it('marks the rod as negative so the electrons are repelled', () => {
    const { container } = render(<Step06_ChargeNearby />);

    expect(container.querySelectorAll('.cci-06-rod-minus').length).toBeGreaterThan(0);
  });

  it('shows the sea just beginning to drift to the far side, away from the rod', () => {
    render(<Step06_ChargeNearby />);

    const center = Number(screen.getByTestId('cci-06-sphere').getAttribute('cx'));
    const xs = screen.getAllByTestId('cci-06-electron').map((el) => Number(el.getAttribute('cx')));
    const average = xs.reduce((sum, x) => sum + x, 0) / xs.length;

    expect(average).toBeGreaterThan(center);
    expect(xs.filter((x) => x > center).length).toBeGreaterThan(xs.filter((x) => x < center).length);
  });

  it('is not fully polarized yet: no positive cores are revealed', () => {
    const { container } = render(<Step06_ChargeNearby />);

    expect(container.querySelectorAll('.cci-06-plus-mark').length).toBe(0);
  });

  it('renders a legend stating the sphere is still neutral, with no em dash', () => {
    render(<Step06_ChargeNearby />);

    const legend = screen.getByText(/neutral overall/i);
    expect(legend).toBeInTheDocument();
    expect(legend.textContent ?? '').not.toContain('\u2014');
  });
});
