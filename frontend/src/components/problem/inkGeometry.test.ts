import { describe, expect, it } from 'vitest';
import {
  eraseHitTest,
  segmentStrokesIntoLines,
  strokeBBox,
  type Stroke,
} from './inkGeometry';

// Build a stroke from bare [x, y] pairs. Pressure and time are filled in with
// stable values so the tests stay deterministic.
function stroke(id: string, points: Array<[number, number]>): Stroke {
  return {
    id,
    points: points.map(([x, y], index) => ({ x, y, p: 0.5, t: index })),
  };
}

describe('strokeBBox', () => {
  it('spans the min and max of every point', () => {
    const box = strokeBBox(stroke('s1', [
      [10, 20],
      [30, 5],
      [18, 40],
    ]));
    expect(box).toEqual({ x: 10, y: 5, w: 20, h: 35 });
  });

  it('collapses a single point into a zero area box', () => {
    expect(strokeBBox(stroke('dot', [[7, 9]]))).toEqual({ x: 7, y: 9, w: 0, h: 0 });
  });

  it('throws on a stroke with no points instead of inventing a box', () => {
    expect(() => strokeBBox({ id: 'empty', points: [] })).toThrow();
  });
});

describe('segmentStrokesIntoLines', () => {
  it('returns no lines for no strokes', () => {
    expect(segmentStrokesIntoLines([])).toEqual([]);
  });

  it('wraps a single stroke in one line that contains it', () => {
    const s = stroke('s1', [
      [0, 0],
      [10, 8],
    ]);
    const lines = segmentStrokesIntoLines([s]);
    expect(lines).toHaveLength(1);
    expect(lines[0].id).toBe('line-1');
    expect(lines[0].strokeIds).toEqual(['s1']);
    expect(lines[0].bbox).toEqual(strokeBBox(s));
  });

  it('groups two vertically overlapping strokes into one line', () => {
    const a = stroke('a', [
      [0, 0],
      [20, 18],
    ]); // y spans 0..18
    const b = stroke('b', [
      [30, 6],
      [50, 22],
    ]); // y spans 6..22, overlaps a
    const lines = segmentStrokesIntoLines([a, b]);
    expect(lines).toHaveLength(1);
    expect(lines[0].id).toBe('line-1');
    expect(lines[0].strokeIds).toEqual(['a', 'b']);
  });

  it('splits three separated rows into three lines ordered top to bottom', () => {
    const top = stroke('top', [
      [0, 0],
      [40, 18],
    ]); // y 0..18
    const mid = stroke('mid', [
      [0, 60],
      [40, 78],
    ]); // y 60..78
    const low = stroke('low', [
      [0, 120],
      [40, 138],
    ]); // y 120..138

    // Fed out of order on purpose to prove the deterministic top to bottom sort.
    const lines = segmentStrokesIntoLines([mid, low, top]);
    expect(lines.map((line) => line.id)).toEqual(['line-1', 'line-2', 'line-3']);
    expect(lines.map((line) => line.strokeIds)).toEqual([['top'], ['mid'], ['low']]);
    expect(lines[0].bbox.y).toBeLessThan(lines[1].bbox.y);
    expect(lines[1].bbox.y).toBeLessThan(lines[2].bbox.y);
  });

  it('uses the union of member bounding boxes for a line bbox', () => {
    const a = stroke('a', [
      [0, 0],
      [20, 18],
    ]);
    const b = stroke('b', [
      [30, 6],
      [50, 22],
    ]);
    const [line] = segmentStrokesIntoLines([a, b]);
    expect(line.bbox).toEqual({ x: 0, y: 0, w: 50, h: 22 });
  });
});

describe('eraseHitTest', () => {
  const lower = stroke('lower', [
    [0, 0],
    [40, 0],
  ]); // horizontal segment along y = 0
  const upper = stroke('upper', [
    [0, 0],
    [40, 0],
  ]); // same place, drawn later, so it sits on top

  it('returns the topmost stroke within the radius', () => {
    expect(eraseHitTest([lower, upper], { x: 20, y: 2 }, 5)).toBe('upper');
  });

  it('hits a stroke when the point is near a segment, not only a vertex', () => {
    // The query x = 20 sits between the two stored vertices (0 and 40).
    expect(eraseHitTest([lower], { x: 20, y: 4 }, 5)).toBe('lower');
  });

  it('returns null when nothing is within the radius', () => {
    expect(eraseHitTest([lower, upper], { x: 200, y: 200 }, 5)).toBeNull();
  });
});
