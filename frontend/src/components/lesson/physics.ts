// Pure, framework-free physics used by the Coulomb's Law lesson scenes and
// interactions. Keeping these here (and unit-tested) means the sandbox, numeric
// checks, and force arrows all agree with the same ground truth.

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

export type ForcePair = { onLeft: Vec2; onRight: Vec2 };

// Collapse a signed zero to +0 so a zero force reads as { x: 0, y: 0 } rather
// than { x: -0, y: 0 } (forceOnCharge multiplies a zero magnitude by a unit
// direction, which can keep the direction's sign on the zero).
function normalizeZero(vector: Vec2): Vec2 {
  return { x: vector.x === 0 ? 0 : vector.x, y: vector.y === 0 ? 0 : vector.y };
}

/** Equal-and-opposite Coulomb forces on a pair of point charges (k = 1 scene units). */
export function forceVectorsForPair(left: PointCharge, right: PointCharge, k = 1): ForcePair {
  return {
    onLeft: normalizeZero(forceOnCharge(left, right, k)),
    onRight: normalizeZero(forceOnCharge(right, left, k)),
  };
}

/** Map a force magnitude to an on-screen arrow length in pixels at a fixed scale. */
export function scaleForceToPixels(forceMagnitude: number, pxPerUnit: number, maxPx: number): number {
  if (!Number.isFinite(forceMagnitude) || forceMagnitude <= 0) return 0;
  return Math.min(forceMagnitude * pxPerUnit, maxPx);
}

export type PolarizationResult = { force: Vec2; induced: number };

/**
 * A neutral conductor near a point charge polarizes: its free charges shift so the
 * near side takes the opposite sign and the far side the same sign. Model the
 * sphere as two induced point charges of magnitude `induced` at its surface along
 * the axis to the source (near = opposite sign, far = same sign). The induced
 * magnitude grows with the source field at the sphere (proportional to |q| / d^2).
 * The net force is the sum of the forces on the two induced charges; it points
 * toward the source because the opposite (near) charge is closer than the same
 * (far) one, so attraction beats repulsion. The force is zero when the source sits
 * at or inside the sphere.
 */
export function polarizationForce(
  source: PointCharge,
  center: Vec2,
  sphereRadius: number,
  induceK = 1,
): PolarizationResult {
  const dx = source.x - center.x;
  const dy = source.y - center.y;
  const d = Math.hypot(dx, dy);
  if (d <= sphereRadius) return { force: { x: 0, y: 0 }, induced: 0 };

  const ux = dx / d;
  const uy = dy / d;
  const induced = (induceK * Math.abs(source.q)) / (d * d);
  const sign = source.q >= 0 ? 1 : -1;
  const near: PointCharge = { x: center.x + ux * sphereRadius, y: center.y + uy * sphereRadius, q: -sign * induced };
  const far: PointCharge = { x: center.x - ux * sphereRadius, y: center.y - uy * sphereRadius, q: sign * induced };

  const fNear = forceOnCharge(near, source);
  const fFar = forceOnCharge(far, source);
  return { force: normalizeZero({ x: fNear.x + fFar.x, y: fNear.y + fFar.y }), induced };
}
