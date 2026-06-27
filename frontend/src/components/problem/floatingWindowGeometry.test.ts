import { describe, expect, it } from 'vitest';
import { centeredPosition, clampPosition, clampSizeAt, MIN_H, MIN_W } from './floatingWindowGeometry';

describe('clampSizeAt', () => {
  it('never shrinks below the minimum', () => {
    expect(clampSizeAt({ x: 0, y: 0 }, { w: 10, h: 10 }, { w: 1000, h: 800 })).toEqual({
      w: MIN_W,
      h: MIN_H,
    });
  });

  it('never extends past the viewport from the current corner', () => {
    expect(clampSizeAt({ x: 700, y: 500 }, { w: 999, h: 999 }, { w: 1000, h: 800 })).toEqual({
      w: 300,
      h: 300,
    });
  });

  it('keeps a size that already fits', () => {
    expect(clampSizeAt({ x: 50, y: 50 }, { w: 400, h: 500 }, { w: 1000, h: 800 })).toEqual({
      w: 400,
      h: 500,
    });
  });
});

describe('clampPosition', () => {
  it('keeps the window fully inside the viewport', () => {
    expect(clampPosition({ x: 2000, y: 2000 }, { w: 400, h: 300 }, { w: 1000, h: 800 })).toEqual({
      x: 600,
      y: 500,
    });
  });

  it('never goes negative', () => {
    expect(clampPosition({ x: -50, y: -10 }, { w: 400, h: 300 }, { w: 1000, h: 800 })).toEqual({
      x: 0,
      y: 0,
    });
  });
});

describe('centeredPosition', () => {
  it('centers to the pixel, rounding the half pixel', () => {
    expect(centeredPosition({ w: 401, h: 301 }, { w: 1000, h: 800 })).toEqual({ x: 300, y: 250 });
  });

  it('pins to the corner when larger than the viewport', () => {
    expect(centeredPosition({ w: 1200, h: 900 }, { w: 1000, h: 800 })).toEqual({ x: 0, y: 0 });
  });
});
