import { describe, expect, it } from 'vitest';
import {
  angleDifferenceDegrees,
  angleDegrees,
  coulombForceMagnitude,
  forceOnCharge,
  inverseSquare,
  magnitude,
  netForceFromCharges,
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
