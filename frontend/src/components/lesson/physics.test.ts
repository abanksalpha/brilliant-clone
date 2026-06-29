import { describe, expect, it } from 'vitest';
import {
  angleDifferenceDegrees,
  angleDegrees,
  coulombForceMagnitude,
  forceOnCharge,
  forceVectorsForPair,
  inverseSquare,
  magnitude,
  netForceFromCharges,
  polarizationForce,
  scaleForceToPixels,
} from './physics';

describe('inverseSquare', () => {
  it('drops as 1 over distance squared', () => {
    expect(inverseSquare(1)).toBe(1);
    expect(inverseSquare(2)).toBeCloseTo(0.25, 10);
    expect(inverseSquare(3)).toBeCloseTo(1 / 9, 10);
    expect(inverseSquare(5)).toBeCloseTo(0.04, 10);
  });
});

describe('coulombForceMagnitude', () => {
  it('scales linearly with each charge and inversely with r squared', () => {
    expect(coulombForceMagnitude(1, 1, 1)).toBe(1);
    expect(coulombForceMagnitude(2, 1, 1)).toBe(2);
    expect(coulombForceMagnitude(2, 3, 1)).toBe(6);
    expect(coulombForceMagnitude(1, 1, 2)).toBeCloseTo(0.25, 10);
  });

  it('uses Coulomb constant k when provided', () => {
    expect(coulombForceMagnitude(1, 1, 1, 8.99e9)).toBeCloseTo(8.99e9, 0);
  });
});

describe('forceOnCharge', () => {
  it('pushes like charges apart', () => {
    const force = forceOnCharge({ x: 2, y: 0, q: 1 }, { x: 0, y: 0, q: 1 });
    expect(force.x).toBeGreaterThan(0);
    expect(force.y).toBeCloseTo(0, 10);
  });

  it('pulls opposite charges together', () => {
    const force = forceOnCharge({ x: 2, y: 0, q: 1 }, { x: 0, y: 0, q: -1 });
    expect(force.x).toBeLessThan(0);
  });
});

describe('netForceFromCharges (superposition)', () => {
  it('cancels at the midpoint between two equal like charges', () => {
    const sources = [
      { x: 0, y: 0, q: 1 },
      { x: 10, y: 0, q: 1 },
    ];
    const net = netForceFromCharges({ x: 5, y: 0, q: 1 }, sources);
    expect(magnitude(net)).toBeCloseTo(0, 10);
  });

  it('points away from the nearer like charge when off-center', () => {
    const sources = [
      { x: 0, y: 0, q: 1 },
      { x: 10, y: 0, q: 1 },
    ];
    const net = netForceFromCharges({ x: 3, y: 0, q: 1 }, sources);
    expect(net.x).toBeGreaterThan(0);
  });
});

describe('angle helpers', () => {
  it('reports direction in degrees clockwise from +x', () => {
    expect(angleDegrees({ x: 1, y: 0 })).toBeCloseTo(0, 6);
    expect(angleDegrees({ x: -1, y: 0 })).toBeCloseTo(180, 6);
  });

  it('finds the smallest angle gap with wraparound', () => {
    expect(angleDifferenceDegrees(10, 350)).toBeCloseTo(20, 6);
    expect(angleDifferenceDegrees(180, 175)).toBeCloseTo(5, 6);
  });
});

describe('forceVectorsForPair', () => {
  it('is equal and opposite for two charges', () => {
    const { onLeft, onRight } = forceVectorsForPair({ x: 0, y: 0, q: 1 }, { x: 2, y: 0, q: 1 });
    expect(onLeft.x).toBeCloseTo(-onRight.x, 10);
    expect(onLeft.y).toBeCloseTo(-onRight.y, 10);
    // like charges repel: left is pushed in -x, right in +x
    expect(onLeft.x).toBeLessThan(0);
    expect(onRight.x).toBeGreaterThan(0);
  });

  it('is zero when either charge is zero', () => {
    const { onLeft, onRight } = forceVectorsForPair({ x: 0, y: 0, q: 0 }, { x: 2, y: 0, q: 3 });
    expect(onLeft).toEqual({ x: 0, y: 0 });
    expect(onRight).toEqual({ x: 0, y: 0 });
  });
});

describe('scaleForceToPixels', () => {
  it('scales linearly and clamps at maxPx', () => {
    expect(scaleForceToPixels(0.5, 100, 90)).toBeCloseTo(50, 10);
    expect(scaleForceToPixels(2, 100, 90)).toBe(90);
    expect(scaleForceToPixels(0, 100, 90)).toBe(0);
  });
});

describe('polarizationForce', () => {
  it('attracts a neutral sphere toward a positive source (and induces charge)', () => {
    const { force, induced } = polarizationForce({ x: 10, y: 0, q: 3 }, { x: 0, y: 0 }, 1);
    expect(force.x).toBeGreaterThan(0); // toward the source
    expect(force.y).toBeCloseTo(0, 10);
    expect(induced).toBeGreaterThan(0);
  });

  it('attracts toward a negative source too (sign independent)', () => {
    const { force } = polarizationForce({ x: 10, y: 0, q: -3 }, { x: 0, y: 0 }, 1);
    expect(force.x).toBeGreaterThan(0); // still toward the source
  });

  it('weakens as the source moves farther away', () => {
    const near = polarizationForce({ x: 6, y: 0, q: 3 }, { x: 0, y: 0 }, 1);
    const far = polarizationForce({ x: 12, y: 0, q: 3 }, { x: 0, y: 0 }, 1);
    expect(magnitude(near.force)).toBeGreaterThan(magnitude(far.force));
  });

  it('is zero when the source is at or inside the sphere', () => {
    expect(polarizationForce({ x: 0.5, y: 0, q: 3 }, { x: 0, y: 0 }, 1)).toEqual({ force: { x: 0, y: 0 }, induced: 0 });
  });
});
