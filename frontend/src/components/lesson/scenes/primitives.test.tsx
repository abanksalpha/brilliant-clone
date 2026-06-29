import { render } from '@testing-library/react';
import { Charge, CHARGE_R } from './primitives';

function svg(child: React.ReactNode) {
  return render(<svg>{child}</svg>);
}

describe('Charge', () => {
  it('renders one glyph by default and three when count is 3', () => {
    const { getByText, rerender } = svg(<Charge x={10} y={10} sign="+" />);
    expect(getByText('+')).toBeInTheDocument();
    rerender(<svg><Charge x={10} y={10} sign="+" count={3} /></svg>);
    expect(getByText('+++')).toBeInTheDocument();
  });

  it('shows 0 for neutral', () => {
    const { getByText } = svg(<Charge x={10} y={10} sign="neutral" />);
    expect(getByText('0')).toBeInTheDocument();
  });

  it('does not change the circle radius with count', () => {
    const { container } = svg(<Charge x={10} y={10} sign="-" count={3} />);
    const circle = container.querySelector('circle.charge-circle');
    expect(circle?.getAttribute('r')).toBe(String(CHARGE_R));
  });
});
