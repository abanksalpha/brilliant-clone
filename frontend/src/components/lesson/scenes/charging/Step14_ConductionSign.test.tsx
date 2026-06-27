import '@testing-library/jest-dom/vitest';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Step14_ConductionSign } from './Step14_ConductionSign';

// Step 14 is a plain multiple-choice step: the rail shows the answer choices, so
// the scene is a static supporting figure. It draws a before/after pair proving
// that charging by conduction leaves the SAME sign.

function signsIn(testId: string) {
  return within(screen.getByTestId(testId))
    .getAllByTestId('cci-14-charge')
    .map((node) => node.getAttribute('data-sign'));
}

describe('Step14_ConductionSign', () => {
  it('renders a static before/after figure with no explore trigger', () => {
    render(<Step14_ConductionSign />);

    expect(screen.getByTestId('cci-14-before')).toBeInTheDocument();
    expect(screen.getByTestId('cci-14-after')).toBeInTheDocument();
    // The rail owns the choices; the scene must not add interactive controls.
    expect(screen.queryByTestId('cci-explore-trigger')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('shows a charged (negative) object touching a neutral one before contact', () => {
    render(<Step14_ConductionSign />);

    const signs = signsIn('cci-14-before');
    expect(signs).toHaveLength(2);
    expect(signs).toContain('negative');
    expect(signs).toContain('neutral');
  });

  it('leaves both objects the same negative sign after contact', () => {
    render(<Step14_ConductionSign />);

    expect(signsIn('cci-14-after')).toEqual(['negative', 'negative']);
  });

  it('never shows a positive object (conduction keeps the same sign, not the opposite)', () => {
    render(<Step14_ConductionSign />);

    const allSigns = screen
      .getAllByTestId('cci-14-charge')
      .map((node) => node.getAttribute('data-sign'));
    expect(allSigns).not.toContain('positive');
  });

  it('labels the two states and emphasizes the same sign after contact', () => {
    render(<Step14_ConductionSign />);

    expect(screen.getByText('before')).toBeInTheDocument();
    expect(screen.getByText('after')).toBeInTheDocument();
    expect(within(screen.getByTestId('cci-14-after')).getByText('same sign')).toBeInTheDocument();
  });

  it('explains conduction in the legend and uses no em dash', () => {
    render(<Step14_ConductionSign />);

    expect(screen.getByText(/conduction leaves the same sign/i)).toBeInTheDocument();
    expect(document.body.textContent ?? '').not.toContain('\u2014');
  });
});
