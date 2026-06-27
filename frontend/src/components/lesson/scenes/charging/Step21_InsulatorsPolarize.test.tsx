import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Step21_InsulatorsPolarize } from './Step21_InsulatorsPolarize';

describe('Step21_InsulatorsPolarize', () => {
  it('renders the insulator block inside an svg', () => {
    const { container } = render(<Step21_InsulatorsPolarize />);

    expect(screen.getByTestId('cci-21-insulator')).toBeInTheDocument();
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('shows a charged rod to the left of the insulator', () => {
    const { container } = render(<Step21_InsulatorsPolarize />);

    const rod = screen.getByTestId('cci-21-rod');
    const block = container.querySelector('.cci-21-block');
    expect(rod).toBeInTheDocument();
    expect(block).not.toBeNull();

    const rodX = Number(rod.querySelector('.cci-21-rod-body')?.getAttribute('x'));
    const blockX = Number(block?.getAttribute('x'));
    expect(rodX).toBeLessThan(blockX);
  });

  it('fills the block with many little dipole molecules', () => {
    const { container } = render(<Step21_InsulatorsPolarize />);

    expect(container.querySelectorAll('.cci-21-molecule').length).toBeGreaterThanOrEqual(12);
  });

  it('draws each molecule as one plus end and one minus end', () => {
    const { container } = render(<Step21_InsulatorsPolarize />);

    const molecules = container.querySelectorAll('.cci-21-molecule').length;
    const plusEnds = container.querySelectorAll('.cci-21-pos').length;
    const minusEnds = container.querySelectorAll('.cci-21-neg').length;

    expect(plusEnds).toBe(molecules);
    expect(minusEnds).toBe(molecules);
  });

  it('orients every dipole so the opposite (plus) end faces the rod on the left', () => {
    const { container } = render(<Step21_InsulatorsPolarize />);

    const plusEnds = Array.from(container.querySelectorAll('.cci-21-pos'));
    const minusEnds = Array.from(container.querySelectorAll('.cci-21-neg'));
    expect(plusEnds.length).toBeGreaterThan(0);
    expect(plusEnds.length).toBe(minusEnds.length);

    plusEnds.forEach((plus, index) => {
      const plusX = Number(plus.getAttribute('cx'));
      const minusX = Number(minusEnds[index].getAttribute('cx'));
      expect(plusX).toBeLessThan(minusX);
    });
  });

  it('renders a short legend naming the dipoles with no em dash', () => {
    render(<Step21_InsulatorsPolarize />);

    const legend = screen.getByText(/dipole/i);
    expect(legend).toBeInTheDocument();
    expect(legend.textContent ?? '').not.toContain('\u2014');
  });
});
