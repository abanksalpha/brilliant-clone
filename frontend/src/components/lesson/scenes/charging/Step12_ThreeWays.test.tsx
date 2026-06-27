import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Step12_ThreeWays } from './Step12_ThreeWays';

describe('Step12_ThreeWays', () => {
  it('renders three labeled method panels in a row', () => {
    const { container } = render(<Step12_ThreeWays />);

    expect(container.querySelector('svg')).toBeInTheDocument();
    expect(screen.getByTestId('cci-12-row')).toBeInTheDocument();
    expect(screen.getByText('Friction')).toBeInTheDocument();
    expect(screen.getByText('Conduction')).toBeInTheDocument();
    expect(screen.getByText('Induction')).toBeInTheDocument();
  });

  it('draws a separate figure for each of the three methods', () => {
    render(<Step12_ThreeWays />);

    expect(screen.getByTestId('cci-12-friction')).toBeInTheDocument();
    expect(screen.getByTestId('cci-12-conduction')).toBeInTheDocument();
    expect(screen.getByTestId('cci-12-induction')).toBeInTheDocument();
  });

  it('shows two objects rubbing together in the friction panel', () => {
    render(<Step12_ThreeWays />);

    const friction = screen.getByTestId('cci-12-friction');
    expect(friction.querySelectorAll('.cci-12-block')).toHaveLength(2);
    // Electrons trade across when two materials rub.
    expect(friction.querySelectorAll('.cl1-electron').length).toBeGreaterThan(0);
  });

  it('shows a rod touching a sphere in the conduction panel', () => {
    render(<Step12_ThreeWays />);

    const conduction = screen.getByTestId('cci-12-conduction');
    expect(conduction.querySelector('.cci-12-rod')).toBeInTheDocument();
    expect(conduction.querySelector('.cci-12-sphere')).toBeInTheDocument();
    // No ground wire on conduction.
    expect(conduction.querySelector('.cci-12-ground')).not.toBeInTheDocument();
  });

  it('shows a rod near a sphere plus a ground wire in the induction panel', () => {
    render(<Step12_ThreeWays />);

    const induction = screen.getByTestId('cci-12-induction');
    expect(induction.querySelector('.cci-12-rod')).toBeInTheDocument();
    expect(induction.querySelector('.cci-12-sphere')).toBeInTheDocument();
    expect(induction.querySelector('.cci-12-ground')).toBeInTheDocument();
  });

  it('renders a short legend with no em dash anywhere', () => {
    const { container } = render(<Step12_ThreeWays />);

    const legend = container.querySelector('.cl1-legend');
    expect(legend).toBeInTheDocument();
    expect(legend?.textContent ?? '').toMatch(/three/i);
    expect(container.textContent ?? '').not.toContain('\u2014');
  });
});
