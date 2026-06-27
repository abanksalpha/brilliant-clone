import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Step05_ClassifyMaterials } from './Step05_ClassifyMaterials';

describe('Step05_ClassifyMaterials', () => {
  it('renders the supporting figure as an svg', () => {
    const { container } = render(<Step05_ClassifyMaterials />);

    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('draws the three objects', () => {
    render(<Step05_ClassifyMaterials />);

    expect(screen.getByTestId('cci-05-copper')).toBeInTheDocument();
    expect(screen.getByTestId('cci-05-rubber')).toBeInTheDocument();
    expect(screen.getByTestId('cci-05-glass')).toBeInTheDocument();
  });

  it('labels each object: a copper wire, a rubber balloon, and a glass rod', () => {
    render(<Step05_ClassifyMaterials />);

    expect(screen.getByTestId('cci-05-label-copper')).toHaveTextContent('Copper wire');
    expect(screen.getByTestId('cci-05-label-rubber')).toHaveTextContent('Rubber balloon');
    expect(screen.getByTestId('cci-05-label-glass')).toHaveTextContent('Glass rod');
  });

  it('renders a legend that reinforces the idea without an em dash', () => {
    render(<Step05_ClassifyMaterials />);

    const legend = screen.getByText(/sea of free electrons/i);
    expect(legend).toBeInTheDocument();
    expect(legend.textContent ?? '').not.toContain('\u2014');
  });
});
