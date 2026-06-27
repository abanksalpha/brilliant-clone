import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Step02_TwoMaterials } from './Step02_TwoMaterials';

describe('Step02_TwoMaterials', () => {
  it('renders both materials side by side without crashing', () => {
    const { container } = render(<Step02_TwoMaterials />);

    expect(container.querySelector('svg')).toBeInTheDocument();
    expect(screen.getByTestId('cci-02-conductor')).toBeInTheDocument();
    expect(screen.getByTestId('cci-02-insulator')).toBeInTheDocument();
  });

  it('labels the copper bar Conductor and the rubber block Insulator', () => {
    render(<Step02_TwoMaterials />);

    expect(screen.getByTestId('cci-02-conductor')).toHaveTextContent('Conductor');
    expect(screen.getByTestId('cci-02-conductor')).toHaveTextContent('copper');
    expect(screen.getByTestId('cci-02-insulator')).toHaveTextContent('Insulator');
    expect(screen.getByTestId('cci-02-insulator')).toHaveTextContent('rubber');
  });

  it('shows a loose sea of free electrons in the conductor', () => {
    const { container } = render(<Step02_TwoMaterials />);

    const free = container.querySelectorAll('.cci-02-electron--free');
    expect(free.length).toBeGreaterThan(2);
  });

  it('shows electrons locked to fixed sites in the insulator', () => {
    const { container } = render(<Step02_TwoMaterials />);

    const locked = container.querySelectorAll('.cci-02-electron--locked');
    expect(locked.length).toBeGreaterThan(2);
  });

  it('draws fixed positive cores in both materials', () => {
    const { container } = render(<Step02_TwoMaterials />);

    expect(container.querySelectorAll('.cci-02-core').length).toBeGreaterThan(0);
  });

  it('renders a short legend contrasting free and locked, with no em dash', () => {
    const { container } = render(<Step02_TwoMaterials />);

    const legend = container.querySelector('.cl1-legend');
    expect(legend).toBeInTheDocument();
    const text = legend?.textContent ?? '';
    expect(text).toMatch(/roam freely/i);
    expect(text).toMatch(/locked/i);
    expect(text).not.toContain('\u2014');
  });
});
