import { describe, expect, it } from 'vitest';
import {
  BASE_HALF_LIFE_DAYS,
  MASTERY_MIN_CAUGHT,
  MASTERY_STRENGTH_THRESHOLD,
  currentStrength,
  emptyMastery,
  isLessonMastered,
  isMisconceptionMastered,
  recordGradedAttempt,
} from './masteryModel';
import type { MisconceptionMastery, ProblemRef } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;

function isoPlusDays(baseISO: string, days: number): Date {
  return new Date(Date.parse(baseISO) + days * DAY_MS);
}

describe('constants', () => {
  it('match the documented thresholds', () => {
    expect(MASTERY_STRENGTH_THRESHOLD).toBe(0.8);
    expect(MASTERY_MIN_CAUGHT).toBe(2);
    expect(BASE_HALF_LIFE_DAYS).toBe(3);
  });
});

describe('emptyMastery', () => {
  it('starts fresh with the given timestamp', () => {
    const now = new Date('2026-01-01T00:00:00.000Z');

    expect(emptyMastery(now)).toEqual({
      caught: 0,
      missed: 0,
      lastSeenISO: '2026-01-01T00:00:00.000Z',
      strength: 0,
    });
  });
});

describe('recordGradedAttempt', () => {
  const now = new Date('2026-01-01T00:00:00.000Z');

  it('does not mutate the input map and returns a new one', () => {
    const map = {};
    const next = recordGradedAttempt(map, 'm1', true, now);

    expect(next).not.toBe(map);
    expect(map).toEqual({});
  });

  it('on a catch raises stored strength and increments caught', () => {
    const next = recordGradedAttempt({}, 'm1', true, now);

    expect(next.m1.caught).toBe(1);
    expect(next.m1.missed).toBe(0);
    // stored 0 -> 0 + (1 - 0) * 0.5 = 0.5
    expect(next.m1.strength).toBeCloseTo(0.5, 10);
    expect(next.m1.lastSeenISO).toBe('2026-01-01T00:00:00.000Z');
  });

  it('keeps moving stored strength toward 1 on repeated catches', () => {
    const once = recordGradedAttempt({}, 'm1', true, now);
    const twice = recordGradedAttempt(once, 'm1', true, now);

    expect(twice.m1.caught).toBe(2);
    // stored 0.5 -> 0.5 + (1 - 0.5) * 0.5 = 0.75
    expect(twice.m1.strength).toBeCloseTo(0.75, 10);
  });

  it('on a miss lowers stored strength and increments missed', () => {
    const caught = recordGradedAttempt({}, 'm1', true, now); // strength 0.5
    const missed = recordGradedAttempt(caught, 'm1', false, now);

    expect(missed.m1.caught).toBe(1);
    expect(missed.m1.missed).toBe(1);
    // stored 0.5 -> 0.5 * 0.4 = 0.2
    expect(missed.m1.strength).toBeCloseTo(0.2, 10);
  });

  it('updates lastSeenISO to the latest attempt time', () => {
    const first = recordGradedAttempt({}, 'm1', true, now);
    const later = new Date('2026-01-05T00:00:00.000Z');
    const second = recordGradedAttempt(first, 'm1', true, later);

    expect(second.m1.lastSeenISO).toBe('2026-01-05T00:00:00.000Z');
  });

  it('tracks each misconception independently', () => {
    const a = recordGradedAttempt({}, 'm1', true, now);
    const b = recordGradedAttempt(a, 'm2', false, now);

    expect(b.m1.caught).toBe(1);
    expect(b.m2.missed).toBe(1);
    expect(b.m2.caught).toBe(0);
  });
});

describe('currentStrength', () => {
  it('returns the stored strength when no time has elapsed', () => {
    const m: MisconceptionMastery = {
      caught: 0,
      missed: 0,
      lastSeenISO: '2026-01-01T00:00:00.000Z',
      strength: 1,
    };

    expect(currentStrength(m, new Date('2026-01-01T00:00:00.000Z'))).toBeCloseTo(1, 10);
  });

  it('decays by half over one base half life when caught is 0', () => {
    const m: MisconceptionMastery = {
      caught: 0,
      missed: 0,
      lastSeenISO: '2026-01-01T00:00:00.000Z',
      strength: 1,
    };

    // halfLife = 3 * 2^0 = 3 days, after 3 days -> 0.5
    expect(currentStrength(m, isoPlusDays('2026-01-01T00:00:00.000Z', 3))).toBeCloseTo(0.5, 10);
  });

  it('forgets more slowly when caught is higher', () => {
    const base = {
      missed: 0,
      lastSeenISO: '2026-01-01T00:00:00.000Z',
      strength: 1,
    };
    const few: MisconceptionMastery = { ...base, caught: 0 }; // halfLife 3 days
    const many: MisconceptionMastery = { ...base, caught: 2 }; // halfLife 3 * 4 = 12 days
    const at = isoPlusDays('2026-01-01T00:00:00.000Z', 3);

    const sFew = currentStrength(few, at);
    const sMany = currentStrength(many, at);

    expect(sFew).toBeCloseTo(0.5, 10);
    expect(sMany).toBeCloseTo(Math.pow(0.5, 3 / 12), 10);
    expect(sMany).toBeGreaterThan(sFew);
  });

  it('clamps the result into [0,1]', () => {
    const m: MisconceptionMastery = {
      caught: 0,
      missed: 0,
      lastSeenISO: '2026-01-01T00:00:00.000Z',
      strength: 1,
    };

    // now before lastSeen would scale above 1 without clamping
    const before = currentStrength(m, isoPlusDays('2026-01-01T00:00:00.000Z', -10));
    expect(before).toBeLessThanOrEqual(1);
    expect(before).toBeGreaterThanOrEqual(0);
  });
});

describe('isMisconceptionMastered', () => {
  const now = new Date('2026-01-01T00:00:00.000Z');

  it('is false when strength is high but caught is below the minimum', () => {
    const strongButNew: MisconceptionMastery = {
      caught: 1,
      missed: 0,
      lastSeenISO: now.toISOString(),
      strength: 1,
    };

    expect(isMisconceptionMastered(strongButNew, now)).toBe(false);
  });

  it('is false when caught is high enough but strength is below threshold', () => {
    const seenButWeak: MisconceptionMastery = {
      caught: 3,
      missed: 2,
      lastSeenISO: now.toISOString(),
      strength: 0.5,
    };

    expect(isMisconceptionMastered(seenButWeak, now)).toBe(false);
  });

  it('is true when both threshold and minimum caught are met', () => {
    const mastered: MisconceptionMastery = {
      caught: 2,
      missed: 0,
      lastSeenISO: now.toISOString(),
      strength: 0.9,
    };

    expect(isMisconceptionMastered(mastered, now)).toBe(true);
  });

  it('can fall out of mastery as strength decays over time', () => {
    const m: MisconceptionMastery = {
      caught: 5,
      missed: 0,
      lastSeenISO: '2026-01-01T00:00:00.000Z',
      strength: 1,
    };

    // halfLife = 3 * 2^5 = 96 days, after 96 days strength is 0.5 (< 0.8)
    const later = isoPlusDays('2026-01-01T00:00:00.000Z', 96);
    expect(isMisconceptionMastered(m, later)).toBe(false);
  });
});

describe('isLessonMastered', () => {
  const now = new Date('2026-01-01T00:00:00.000Z');
  const problems: ProblemRef[] = [
    { problemId: 'p1', lessonId: 'L1', misconceptionTags: ['a', 'b'], difficulty: 1 },
    { problemId: 'p2', lessonId: 'L1', misconceptionTags: ['b'], difficulty: 2 },
  ];
  const masteredEntry: MisconceptionMastery = {
    caught: 3,
    missed: 0,
    lastSeenISO: now.toISOString(),
    strength: 1,
  };
  const weakEntry: MisconceptionMastery = {
    caught: 0,
    missed: 2,
    lastSeenISO: now.toISOString(),
    strength: 0.1,
  };

  it('is true only when every unique tag is mastered', () => {
    expect(isLessonMastered({ a: masteredEntry, b: masteredEntry }, problems, now)).toBe(true);
  });

  it('is false when any tag is still weak', () => {
    expect(isLessonMastered({ a: masteredEntry, b: weakEntry }, problems, now)).toBe(false);
  });

  it('is false when a tag has no entry at all', () => {
    expect(isLessonMastered({ a: masteredEntry }, problems, now)).toBe(false);
  });

  it('is false for an empty problem set', () => {
    expect(isLessonMastered({ a: masteredEntry }, [], now)).toBe(false);
  });

  it('is false when problems carry no misconception tags', () => {
    const untagged: ProblemRef[] = [
      { problemId: 'p', lessonId: 'L1', misconceptionTags: [], difficulty: 1 },
    ];

    expect(isLessonMastered({}, untagged, now)).toBe(false);
  });
});
