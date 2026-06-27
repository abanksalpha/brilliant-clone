import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Step26_Summary } from './Step26_Summary';

function averageX(nodes: Element[]) {
  return nodes.reduce((sum, node) => sum + Number(node.getAttribute('x')), 0) / nodes.length;
}

describe('Step26_Summary', () => {
  it('brings back the opening balloon-on-wall scene', () => {
    const { container } = render(<Step26_Summary />);

    expect(screen.getByTestId('cci-26-balloon')).toBeInTheDocument();
    expect(screen.getByTestId('cci-26-wall')).toBeInTheDocument();
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('keeps the negative charge marks on the balloon (the bookend)', () => {
    const { container } = render(<Step26_Summary />);

    expect(container.querySelectorAll('.cci-26-charge').length).toBeGreaterThan(0);
  });

  it("annotates the wall's surface molecules as polarized", () => {
    const { container } = render(<Step26_Summary />);

    expect(screen.getByTestId('cci-26-molecules')).toBeInTheDocument();
    const plus = Array.from(container.querySelectorAll('.cci-26-mol-plus'));
    const minus = Array.from(container.querySelectorAll('.cci-26-mol-minus'));
    expect(plus.length).toBeGreaterThan(2);
    expect(minus.length).toBe(plus.length);
  });

  it('turns each molecule so its plus side faces the balloon', () => {
    const { container } = render(<Step26_Summary />);

    const plus = Array.from(container.querySelectorAll('.cci-26-mol-plus'));
    const minus = Array.from(container.querySelectorAll('.cci-26-mol-minus'));
    // The balloon is on the left, so the plus (rod-facing) ends sit left of the
    // minus ends that are pushed into the wall.
    expect(averageX(plus)).toBeLessThan(averageX(minus));
  });

  it('resolves the hook in a short legend with no em dash', () => {
    render(<Step26_Summary />);

    const legend = screen.getByText(/balloon sticks/i);
    expect(legend).toBeInTheDocument();
    expect(legend.textContent ?? '').not.toContain('\u2014');
  });
});
