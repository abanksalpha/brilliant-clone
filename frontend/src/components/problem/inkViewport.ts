// Pure, framework free view math for the ink canvas. It is split out from the
// React component so the screen/world mapping can be unit tested without a real
// raster canvas (jsdom has none). Everything here is deterministic.
//
// Two coordinate spaces:
//   WORLD  - where strokes are stored. Independent of the current view, so the
//            graded image and the stroke bounding boxes never move when the user
//            pans or zooms.
//   SCREEN - CSS pixels inside the canvas element, used only for display. The
//            Viewport maps world -> screen as screen = world * scale + translate.

export type Viewport = { scale: number; tx: number; ty: number };

export type Rect = { x: number; y: number; w: number; h: number };

// Lower min scale = a larger finite board (board size is view / MIN_SCALE), so
// there is more room to pan and write while still being able to zoom out far
// enough to see the whole board.
export const MIN_SCALE = 0.4;
export const MAX_SCALE = 5;

/** Map a screen (CSS pixel) point back to world space. Inverse of worldToScreen. */
export function screenToWorld(v: Viewport, sx: number, sy: number): { x: number; y: number } {
  return { x: (sx - v.tx) / v.scale, y: (sy - v.ty) / v.scale };
}

/** Map a world point to screen (CSS pixel) space. */
export function worldToScreen(v: Viewport, wx: number, wy: number): { x: number; y: number } {
  return { x: wx * v.scale + v.tx, y: wy * v.scale + v.ty };
}

/** Clamp a scale into the supported zoom range. */
export function clampScale(scale: number): number {
  return Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale));
}

/**
 * Zoom by `factor` while keeping `screenPoint` pinned to the same world point.
 * The new translate is solved from the world point under the cursor and the new
 * (clamped) scale, so the cursor stays fixed even when the zoom hits a limit.
 */
export function zoomAbout(
  v: Viewport,
  screenPoint: { x: number; y: number },
  factor: number,
): Viewport {
  const scale = clampScale(v.scale * factor);
  const world = screenToWorld(v, screenPoint.x, screenPoint.y);
  return {
    scale,
    tx: screenPoint.x - world.x * scale,
    ty: screenPoint.y - world.y * scale,
  };
}

/** Translate the view by a screen-space delta. Scale is unchanged. */
export function panBy(v: Viewport, dxScreen: number, dyScreen: number): Viewport {
  return { scale: v.scale, tx: v.tx + dxScreen, ty: v.ty + dyScreen };
}

/**
 * Center `contentBBox` in a viewport of size viewW x viewH with equal margins on
 * all sides. The scale is the smaller of the width and height fits (so the whole
 * box is visible) inside the area left after `padding` on every edge, clamped to
 * [MIN_SCALE, MAX_SCALE]. A zero-width or zero-height box does not constrain that
 * axis, and a zero-area box (a single point) falls back to MAX_SCALE.
 */
export function fitToContent(
  contentBBox: { x: number; y: number; w: number; h: number },
  viewW: number,
  viewH: number,
  padding: number,
): Viewport {
  const availW = viewW - 2 * padding;
  const availH = viewH - 2 * padding;
  const fitW = contentBBox.w > 0 ? availW / contentBBox.w : Infinity;
  const fitH = contentBBox.h > 0 ? availH / contentBBox.h : Infinity;

  let scale = Math.min(fitW, fitH);
  if (!Number.isFinite(scale)) scale = MAX_SCALE;
  scale = clampScale(scale);

  const cx = contentBBox.x + contentBBox.w / 2;
  const cy = contentBBox.y + contentBBox.h / 2;
  return {
    scale,
    tx: viewW / 2 - cx * scale,
    ty: viewH / 2 - cy * scale,
  };
}

/**
 * The finite whiteboard, in WORLD units. Its size is the visible world rect at
 * MIN_SCALE (1 / MIN_SCALE screens wide and tall), so when fully zoomed out the
 * board exactly fills the view: the pen can never reach world outside the board,
 * and panning can never push the board off screen. The board is centered on the
 * initial identity view center (viewW / 2, viewH / 2), which is where the first
 * strokes land.
 */
export function boardBounds(viewW: number, viewH: number): Rect {
  const w = viewW / MIN_SCALE;
  const h = viewH / MIN_SCALE;
  return { x: viewW / 2 - w / 2, y: viewH / 2 - h / 2, w, h };
}

/** Clamp one axis translate so the board keeps covering the screen on that axis. */
function clampAxis(translate: number, scale: number, boardMin: number, boardSize: number, viewSize: number): number {
  // Board edges on screen: boardMin * scale + translate (near) and
  // (boardMin + boardSize) * scale + translate (far). To cover the screen the
  // near edge must be <= 0 and the far edge must be >= viewSize.
  const maxT = -boardMin * scale; // near edge at screen 0
  const minT = viewSize - (boardMin + boardSize) * scale; // far edge at viewSize
  if (minT > maxT) {
    // Board is smaller than the view on this axis: center it.
    return (minT + maxT) / 2;
  }
  return Math.max(minT, Math.min(maxT, translate));
}

/**
 * Constrain a viewport so the bounded board always covers the screen, which
 * keeps every drawn stroke reachable: work can never be permanently panned or
 * zoomed off into empty space. Scale is left untouched (clamp it with
 * clampScale before zooming); only the translate is corrected.
 */
export function clampViewport(v: Viewport, viewW: number, viewH: number): Viewport {
  const board = boardBounds(viewW, viewH);
  return {
    scale: v.scale,
    tx: clampAxis(v.tx, v.scale, board.x, board.w, viewW),
    ty: clampAxis(v.ty, v.scale, board.y, board.h, viewH),
  };
}
