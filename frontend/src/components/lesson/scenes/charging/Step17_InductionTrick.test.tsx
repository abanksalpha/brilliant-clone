import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Step17_InductionTrick } from './Step17_InductionTrick';

describe('Step17_InductionTrick', () => {
  it('renders the metal sphere inside an svg', () => {
    const { container } = render(<Step17_InductionTrick />);

    expect(container.querySelector('svg')).toBeInTheDocument();
    expect(screen.getByTestId('cci-17-sphere')).toBeInTheDocument();
  });

  it('holds a charged rod to one side without touching the sphere', () => {
    render(<Step17_InductionTrick />);

    const rod = screen.getByTestId('cci-17-rod');
    const sphere = screen.getByTestId('cci-17-sphere');
    const rodRight = Number(rod.getAttribute('x')) + Number(rod.getAttribute('width'));
    const sphereLeft = Number(sphere.getAttribute('cx')) - Number(sphere.getAttribute('r'));

    expect(rodRight).toBeLessThan(sphereLeft);
  });

  it('marks the rod as negative', () => {
    const { container } = render(<Step17_InductionTrick />);

    expect(container.querySelectorAll('.cci-17-rod-minus').length).toBeGreaterThan(0);
  });

  it('gives the sphere a ground wire down to earth', () => {
    render(<Step17_InductionTrick />);

    expect(screen.getByTestId('cci-17-ground')).toBeInTheDocument();
  });

  it('hints that the sphere will end up oppositely charged (positive)', () => {
    render(<Step17_InductionTrick />);

    const hint = screen.getByTestId('cci-17-hint');
    expect(hint).toBeInTheDocument();
    expect(hint.textContent ?? '').toContain('+');
  });

  it('renders a short legend about not touching, with no em dash', () => {
    render(<Step17_InductionTrick />);

    const legend = screen.getByText(/never touching/i);
    expect(legend).toBeInTheDocument();
    expect(legend.textContent ?? '').not.toContain('\u2014');
  });
});
