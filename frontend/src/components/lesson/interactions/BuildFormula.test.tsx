import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BuildFormulaConfig } from '../../../content';
import { BuildFormula } from './BuildFormula';

const config: BuildFormulaConfig = {
  prefixLabel: 'F = k ×',
  pieces: [
    { id: 'q1', label: 'q\u2081' },
    { id: 'q2', label: 'q\u2082' },
    { id: 'rSquared', label: 'r\u00b2' },
    { id: 'r', label: 'r' },
  ],
  numerator: ['q1', 'q2'],
  denominator: ['rSquared'],
};

const Q1 = 'q\u2081';
const Q2 = 'q\u2082';
const R2 = 'r\u00b2';

function rect(x: number, y: number, w = 48, h = 48): DOMRect {
  return {
    x,
    y,
    width: w,
    height: h,
    left: x,
    top: y,
    right: x + w,
    bottom: y + h,
    toJSON: () => ({}),
  } as DOMRect;
}

// The three slots render in DOM order: numerator [n0, n1] then denominator [d0].
function refreshSlotRects(container: HTMLElement, rects: Map<Element, DOMRect>) {
  const slots = Array.from(container.querySelectorAll('.cl1-build-slot'));
  rects.clear();
  rects.set(slots[0], rect(0, 0)); // n0
  rects.set(slots[1], rect(60, 0)); // n1
  rects.set(slots[2], rect(0, 60)); // d0
  return slots;
}

function dragPieceTo(
  container: HTMLElement,
  rects: Map<Element, DOMRect>,
  name: string,
  point: { x: number; y: number },
) {
  refreshSlotRects(container, rects);
  const piece = screen.getByRole('button', { name });
  fireEvent.pointerDown(piece, { clientX: 4, clientY: 4, pointerId: 1 });
  fireEvent.pointerMove(piece, { clientX: point.x, clientY: point.y, pointerId: 1 });
  fireEvent.pointerUp(piece, { clientX: point.x, clientY: point.y, pointerId: 1 });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('BuildFormula drag and drop', () => {
  it('drops a piece into the exact slot it is dragged onto, not just the next empty one', () => {
    const rects = new Map<Element, DOMRect>();
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: Element,
    ) {
      return rects.get(this) ?? rect(-1000, -1000, 50, 48);
    });

    const { container } = render(<BuildFormula config={config} onResult={vi.fn()} />);

    // Drag q2 onto the SECOND numerator slot, leaving the first slot empty.
    dragPieceTo(container, rects, Q2, { x: 84, y: 24 });

    expect(screen.getByRole('button', { name: `Remove ${Q2}` })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: Q2 })).not.toBeInTheDocument();

    const slots = Array.from(container.querySelectorAll('.cl1-build-slot'));
    expect(slots[0]).not.toHaveClass('cl1-build-slot--filled');
    expect(slots[1]).toHaveTextContent(Q2);
  });

  it('checks the formula as correct once every piece is dragged into place', () => {
    const onResult = vi.fn();
    const rects = new Map<Element, DOMRect>();
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: Element,
    ) {
      return rects.get(this) ?? rect(-1000, -1000, 50, 48);
    });

    const { container } = render(<BuildFormula config={config} onResult={onResult} />);

    dragPieceTo(container, rects, Q1, { x: 20, y: 24 }); // -> n0
    dragPieceTo(container, rects, Q2, { x: 84, y: 24 }); // -> n1
    dragPieceTo(container, rects, R2, { x: 20, y: 84 }); // -> d0

    fireEvent.click(screen.getByRole('button', { name: 'Check formula' }));
    expect(onResult).toHaveBeenCalledWith('correct');
  });

  it('returns a placed piece to the tray when it is dragged off the slots', () => {
    const rects = new Map<Element, DOMRect>();
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: Element,
    ) {
      return rects.get(this) ?? rect(-1000, -1000, 50, 48);
    });

    const { container } = render(<BuildFormula config={config} onResult={vi.fn()} />);

    dragPieceTo(container, rects, Q1, { x: 20, y: 24 });
    expect(screen.getByRole('button', { name: `Remove ${Q1}` })).toBeInTheDocument();

    // Drag the placed piece far away from every slot: it should pop back to the tray.
    refreshSlotRects(container, rects);
    const placed = screen.getByRole('button', { name: `Remove ${Q1}` });
    fireEvent.pointerDown(placed, { clientX: 20, clientY: 24, pointerId: 1 });
    fireEvent.pointerMove(placed, { clientX: 600, clientY: 600, pointerId: 1 });
    fireEvent.pointerUp(placed, { clientX: 600, clientY: 600, pointerId: 1 });

    expect(screen.queryByRole('button', { name: `Remove ${Q1}` })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: Q1 })).toBeInTheDocument();
  });
});
