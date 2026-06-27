import { describe, expect, it } from 'vitest';
import {
  MAX_SCALE,
  MIN_SCALE,
  boardBounds,
  clampScale,
  clampViewport,
  fitToContent,
  panBy,
  screenToWorld,
  worldToScreen,
  zoomAbout,
  type Viewport,
} from './inkViewport';

const viewports: Viewport[] = [
  { scale: 1, tx: 0, ty: 0 },
  { scale: 2, tx: 35, ty: -12 },
  { scale: 0.5, tx: -8, ty: 120 },
  { scale: 3.25, tx: 4.5, ty: 9.75 },
];

describe('screenToWorld / worldToScreen', () => {
  it('are exact inverses for several viewports and points', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 17, y: 42 },
      { x: -33, y: 88 },
      { x: 250.5, y: 9.25 },
    ];
    for (const v of viewports) {
      for (const pt of points) {
        const world = screenToWorld(v, pt.x, pt.y);
        const back = worldToScreen(v, world.x, world.y);
        expect(back.x).toBeCloseTo(pt.x, 9);
        expect(back.y).toBeCloseTo(pt.y, 9);

        const screen = worldToScreen(v, pt.x, pt.y);
        const world2 = screenToWorld(v, screen.x, screen.y);
        expect(world2.x).toBeCloseTo(pt.x, 9);
        expect(world2.y).toBeCloseTo(pt.y, 9);
      }
    }
  });

  it('maps world through scale then translate', () => {
    const v: Viewport = { scale: 2, tx: 10, ty: -5 };
    expect(worldToScreen(v, 3, 4)).toEqual({ x: 16, y: 3 });
    expect(screenToWorld(v, 16, 3)).toEqual({ x: 3, y: 4 });
  });
});

describe('clampScale', () => {
  it('clamps to [MIN_SCALE, MAX_SCALE]', () => {
    expect(clampScale(MIN_SCALE / 2)).toBe(MIN_SCALE);
    expect(clampScale(MAX_SCALE * 4)).toBe(MAX_SCALE);
    expect(clampScale(0.0001)).toBe(MIN_SCALE);
    expect(clampScale(999)).toBe(MAX_SCALE);
  });

  it('leaves an in-range scale untouched', () => {
    expect(clampScale(1)).toBe(1);
    expect(clampScale(2.5)).toBe(2.5);
  });
});

describe('zoomAbout', () => {
  it('keeps the given screen point fixed', () => {
    const v: Viewport = { scale: 1.5, tx: 20, ty: -10 };
    const screenPoint = { x: 120, y: 80 };
    const worldBefore = screenToWorld(v, screenPoint.x, screenPoint.y);
    for (const factor of [1.2, 0.8, 2, 0.5]) {
      const zoomed = zoomAbout(v, screenPoint, factor);
      // The screen point still maps back to the same world coordinate.
      const worldAfter = screenToWorld(zoomed, screenPoint.x, screenPoint.y);
      expect(worldAfter.x).toBeCloseTo(worldBefore.x, 9);
      expect(worldAfter.y).toBeCloseTo(worldBefore.y, 9);
      // And that world point still lands under the cursor.
      const screenAfter = worldToScreen(zoomed, worldBefore.x, worldBefore.y);
      expect(screenAfter.x).toBeCloseTo(screenPoint.x, 9);
      expect(screenAfter.y).toBeCloseTo(screenPoint.y, 9);
      expect(zoomed.scale).toBeCloseTo(clampScale(v.scale * factor), 9);
    }
  });

  it('keeps the point fixed even when the zoom is clamped at MAX_SCALE', () => {
    const v: Viewport = { scale: 4, tx: 5, ty: 5 };
    const screenPoint = { x: 200, y: 150 };
    const worldBefore = screenToWorld(v, screenPoint.x, screenPoint.y);
    const zoomed = zoomAbout(v, screenPoint, 100); // would blow past MAX_SCALE
    expect(zoomed.scale).toBe(MAX_SCALE);
    const screenAfter = worldToScreen(zoomed, worldBefore.x, worldBefore.y);
    expect(screenAfter.x).toBeCloseTo(screenPoint.x, 9);
    expect(screenAfter.y).toBeCloseTo(screenPoint.y, 9);
  });
});

describe('panBy', () => {
  it('translates in screen space and leaves scale alone', () => {
    const v: Viewport = { scale: 2, tx: 10, ty: 20 };
    expect(panBy(v, 5, -7)).toEqual({ scale: 2, tx: 15, ty: 13 });
  });
});

describe('fitToContent', () => {
  it('centers the content with equal left/right and top/bottom margins', () => {
    const bbox = { x: 100, y: 50, w: 200, h: 100 };
    const viewW = 800;
    const viewH = 600;
    const padding = 20;
    const v = fitToContent(bbox, viewW, viewH, padding);

    const topLeft = worldToScreen(v, bbox.x, bbox.y);
    const bottomRight = worldToScreen(v, bbox.x + bbox.w, bbox.y + bbox.h);

    const leftMargin = topLeft.x;
    const rightMargin = viewW - bottomRight.x;
    const topMargin = topLeft.y;
    const bottomMargin = viewH - bottomRight.y;

    expect(leftMargin).toBeCloseTo(rightMargin, 6);
    expect(topMargin).toBeCloseTo(bottomMargin, 6);
    // The content sits inside the requested padding.
    expect(leftMargin).toBeGreaterThanOrEqual(padding - 1e-6);
    expect(topMargin).toBeGreaterThanOrEqual(padding - 1e-6);
  });

  it('uses the smaller fit scale so the content never overflows', () => {
    // Wide, short content is limited by width: 500/1000 = 0.5 beats 500/10 = 50.
    const bbox = { x: 0, y: 0, w: 1000, h: 10 };
    const v = fitToContent(bbox, 500, 500, 0);
    expect(v.scale).toBeCloseTo(0.5, 9);
  });

  it('never exceeds MAX_SCALE for tiny content', () => {
    const bbox = { x: 0, y: 0, w: 2, h: 2 };
    const v = fitToContent(bbox, 800, 600, 10);
    expect(v.scale).toBe(MAX_SCALE);
    expect(v.scale).toBeLessThanOrEqual(MAX_SCALE);
  });

  it('centers a zero-size point without producing NaN', () => {
    const bbox = { x: 40, y: 60, w: 0, h: 0 };
    const v = fitToContent(bbox, 200, 100, 10);
    expect(Number.isFinite(v.scale)).toBe(true);
    expect(Number.isFinite(v.tx)).toBe(true);
    expect(Number.isFinite(v.ty)).toBe(true);
    const center = worldToScreen(v, 40, 60);
    expect(center.x).toBeCloseTo(100, 6); // viewW / 2
    expect(center.y).toBeCloseTo(50, 6); // viewH / 2
  });
});

describe('boardBounds', () => {
  it('spans 1 / MIN_SCALE screens and is centered on the initial view center', () => {
    const viewW = 800;
    const viewH = 600;
    const board = boardBounds(viewW, viewH);
    expect(board.w).toBeCloseTo(viewW / MIN_SCALE, 9);
    expect(board.h).toBeCloseTo(viewH / MIN_SCALE, 9);
    // Centered on (viewW / 2, viewH / 2).
    expect(board.x + board.w / 2).toBeCloseTo(viewW / 2, 9);
    expect(board.y + board.h / 2).toBeCloseTo(viewH / 2, 9);
  });

  it('is exactly the visible world rect at MIN_SCALE', () => {
    const viewW = 1024;
    const viewH = 768;
    const board = boardBounds(viewW, viewH);
    // At MIN_SCALE the visible world is viewW / MIN_SCALE wide, so the board and
    // the view coincide: nothing can be drawn outside the board.
    expect(board.w).toBeCloseTo(viewW / MIN_SCALE, 9);
    expect(board.h).toBeCloseTo(viewH / MIN_SCALE, 9);
  });
});

describe('clampViewport', () => {
  const viewW = 800;
  const viewH = 600;

  // The visible screen rect must stay inside the board: the board edges never
  // cross into the screen interior, so board content is always reachable.
  function assertBoardCoversScreen(v: Viewport) {
    const board = boardBounds(viewW, viewH);
    const left = worldToScreen(v, board.x, board.y);
    const right = worldToScreen(v, board.x + board.w, board.y + board.h);
    expect(left.x).toBeLessThanOrEqual(1e-6);
    expect(left.y).toBeLessThanOrEqual(1e-6);
    expect(right.x).toBeGreaterThanOrEqual(viewW - 1e-6);
    expect(right.y).toBeGreaterThanOrEqual(viewH - 1e-6);
  }

  it('leaves an in-bounds viewport untouched', () => {
    const v: Viewport = { scale: 1, tx: -100, ty: -80 };
    expect(clampViewport(v, viewW, viewH)).toEqual(v);
    assertBoardCoversScreen(clampViewport(v, viewW, viewH));
  });

  it('pulls back a pan that would scroll the board off screen', () => {
    // A wild pan far past the board edge in both axes.
    const v: Viewport = { scale: 1, tx: 5000, ty: 5000 };
    const clamped = clampViewport(v, viewW, viewH);
    assertBoardCoversScreen(clamped);
    // The scale is never touched by the translate clamp.
    expect(clamped.scale).toBe(1);
  });

  it('pulls back a pan in the negative direction too', () => {
    const v: Viewport = { scale: 2, tx: -100000, ty: -100000 };
    assertBoardCoversScreen(clampViewport(v, viewW, viewH));
  });

  it('centers the board when the view is at MIN_SCALE (board equals view)', () => {
    // At MIN_SCALE the board exactly fills the screen, so the translate is pinned
    // to the single centering value regardless of the requested pan.
    const v: Viewport = { scale: MIN_SCALE, tx: 9999, ty: -9999 };
    const clamped = clampViewport(v, viewW, viewH);
    const board = boardBounds(viewW, viewH);
    const expectedTx = viewW / 2 - (board.x + board.w / 2) * MIN_SCALE;
    const expectedTy = viewH / 2 - (board.y + board.h / 2) * MIN_SCALE;
    expect(clamped.tx).toBeCloseTo(expectedTx, 6);
    expect(clamped.ty).toBeCloseTo(expectedTy, 6);
  });
});
