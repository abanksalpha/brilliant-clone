import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Step04_ElectronSea } from './Step04_ElectronSea';

describe('Step04_ElectronSea', () => {
  it('renders the metal piece inside an svg', () => {
    const { container } = render(<Step04_ElectronSea />);

    expect(screen.getByTestId('cci-04-metal')).toBeInTheDocument();
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('draws a lattice of fixed positive cores using the shared charge primitive', () => {
    const { container } = render(<Step04_ElectronSea />);

    // Small + cores reuse the Coulomb Charge glyph (positive tone).
    expect(container.querySelectorAll('.charge-circle-positive').length).toBeGreaterThanOrEqual(9);
  });

  it('shows a shared cloud of free electron dots between the cores', () => {
    const { container } = render(<Step04_ElectronSea />);

    expect(container.querySelectorAll('.cci-04-electron').length).toBeGreaterThanOrEqual(8);
  });

  it('suggests motion with a few faint trails', () => {
    const { container } = render(<Step04_ElectronSea />);

    expect(container.querySelectorAll('.cci-04-trail').length).toBeGreaterThanOrEqual(3);
  });

  it('renders a short legend that names the free electrons and has no em dash', () => {
    render(<Step04_ElectronSea />);

    const legend = screen.getByText(/free electrons/i);
    expect(legend).toBeInTheDocument();
    expect(legend.textContent ?? '').not.toContain('\u2014');
  });
});
