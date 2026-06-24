// Pure, framework-free physics used by the Coulomb's Law lesson scenes and
// interactions. Keeping these here (and unit-tested) means the sandbox, numeric
// checks, and force arrows all agree with the same ground truth.

export const COULOMB_K = 8.99e9;

export type Vec2 = { x: number; y: number };

export type PointCharge = {
  x: number;
  y: number;
  q: number;
};

/** Relative force factor for the inverse-square law (force at distance n*r). */
export function inverseSquare(distanceMultiplier: number): number {
  if (distanceMultiplier === 0) return Infinity;
  return 1 / (distanceMultiplier * distanceMultiplier);
}

/** Coulomb force magnitude. Defaults to k = 1 for normalized scene units. */
export function coulombForceMagnitude(q1: number, q2: number, r: number, k = 1): number {
  if (r === 0) return Infinity;
  return (k * Math.abs(q1 * q2)) / (r * r);
}

/**
 * Force vector on `test` due to a single `source` charge (k = 1 by default).
 * Like signs (q1*q2 > 0) push the test charge away from the source; opposite
 * signs pull it toward the source.
 */
export function forceOnCharge(test: PointCharge, source: PointCharge, k = 1): Vec2 {
  const dx = test.x - source.x;
  const dy = test.y - source.y;
  const r2 = dx * dx + dy * dy;
  if (r2 === 0) return { x: 0, y: 0 };

  const r = Math.sqrt(r2);
  const signedMagnitude = (k * test.q * source.q) / r2;
  return {
    x: signedMagnitude * (dx / r),
    y: signedMagnitude * (dy / r),
  };
}

/** Net force on `test` from many sources, via superposition. */
export function netForceFromCharges(test: PointCharge, sources: PointCharge[], k = 1): Vec2 {
  return sources.reduce<Vec2>(
    (acc, source) => {
      const force = forceOnCharge(test, source, k);
      return { x: acc.x + force.x, y: acc.y + force.y };
    },
    { x: 0, y: 0 },
  );
}

export function magnitude(vector: Vec2): number {
  return Math.hypot(vector.x, vector.y);
}

/** Angle of a vector in degrees, 0 = +x (right), increasing clockwise (y down). */
export function angleDegrees(vector: Vec2): number {
  const degrees = (Math.atan2(vector.y, vector.x) * 180) / Math.PI;
  return (degrees + 360) % 360;
}

/** Smallest absolute difference between two angles in degrees (0..180). */
export function angleDifferenceDegrees(a: number, b: number): number {
  const diff = Math.abs(((a - b) % 360) + 360) % 360;
  return diff > 180 ? 360 - diff : diff;
}
