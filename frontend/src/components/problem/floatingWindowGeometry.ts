// Pure geometry for the floating, draggable, resizable window. Kept framework
// free so the drag, resize, and centering math can be unit tested without a real
// DOM, and so the window can never escape the viewport.

export type Vec = { x: number; y: number };
export type Size = { w: number; h: number };
export type Bounds = { w: number; h: number };

// Smallest the window may shrink to, so the header and the PDF stay usable.
export const MIN_W = 280;
export const MIN_H = 220;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

/**
 * Clamp a size so it never falls below the minimum and never extends past the
 * viewport from the window's current top left. On a viewport smaller than the
 * minimum the max collapses to the minimum on purpose: usability wins over
 * staying perfectly inside the bounds.
 */
export function clampSizeAt(pos: Vec, size: Size, viewport: Bounds): Size {
  const maxW = Math.max(MIN_W, viewport.w - pos.x);
  const maxH = Math.max(MIN_H, viewport.h - pos.y);
  return { w: clamp(size.w, MIN_W, maxW), h: clamp(size.h, MIN_H, maxH) };
}

/** Clamp a top left so the whole window stays inside the viewport. */
export function clampPosition(pos: Vec, size: Size, viewport: Bounds): Vec {
  const maxX = Math.max(0, viewport.w - size.w);
  const maxY = Math.max(0, viewport.h - size.h);
  return { x: clamp(pos.x, 0, maxX), y: clamp(pos.y, 0, maxY) };
}

/** Pixel centered top left for a window of `size` inside `viewport`. */
export function centeredPosition(size: Size, viewport: Bounds): Vec {
  return {
    x: Math.max(0, Math.round((viewport.w - size.w) / 2)),
    y: Math.max(0, Math.round((viewport.h - size.h) / 2)),
  };
}
