// Per misconception mastery model with time decay. Pure and deterministic:
// every function takes the current time as an explicit Date so there is no
// hidden I/O, no Math.random, and no global clock reads.

import type { MasteryMap, MisconceptionMastery, ProblemRef } from './types';

/** A misconception counts as mastered once stored retrievability reaches this. */
export const MASTERY_STRENGTH_THRESHOLD = 0.8;

/** Mastery also requires this many catches, so one lucky answer is not enough. */
export const MASTERY_MIN_CAUGHT = 2;

/** Half life of retrievability for a misconception caught zero times, in days. */
export const BASE_HALF_LIFE_DAYS = 3;

/** On a catch, stored strength moves halfway toward 1. */
const CATCH_GAIN = 0.5;

/** On a miss, stored strength is cut to this fraction. */
const MISS_RETENTION = 0.4;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

/** A blank record for a misconception first seen at `now`. */
export function emptyMastery(now: Date): MisconceptionMastery {
  return {
    caught: 0,
    missed: 0,
    lastSeenISO: now.toISOString(),
    strength: 0,
  };
}

/**
 * Record one graded attempt and return a brand new MasteryMap (the input map
 * and its entries are never mutated).
 *
 * Stored strength is updated from the previously stored value (not the decayed
 * current value), per the brief:
 *   catch: strength + (1 - strength) * CATCH_GAIN   (here CATCH_GAIN = 0.5)
 *   miss:  strength * MISS_RETENTION                (here MISS_RETENTION = 0.4)
 * Counts increment by one and lastSeenISO is set to now.
 */
export function recordGradedAttempt(
  map: MasteryMap,
  misconceptionId: string,
  caught: boolean,
  now: Date,
): MasteryMap {
  const prior = map[misconceptionId] ?? emptyMastery(now);

  const nextStrength = caught
    ? prior.strength + (1 - prior.strength) * CATCH_GAIN
    : prior.strength * MISS_RETENTION;

  const updated: MisconceptionMastery = {
    caught: caught ? prior.caught + 1 : prior.caught,
    missed: caught ? prior.missed : prior.missed + 1,
    lastSeenISO: now.toISOString(),
    strength: clamp01(nextStrength),
  };

  return { ...map, [misconceptionId]: updated };
}

/**
 * Retrievability right now, decaying exponentially from the stored value:
 *   currentStrength = stored * 0.5 ^ (elapsedDays / halfLife)
 *   halfLife = BASE_HALF_LIFE_DAYS * 2 ^ caught
 * More catches mean a longer half life, so well practiced misconceptions fade
 * more slowly. The result is clamped into [0,1].
 */
export function currentStrength(m: MisconceptionMastery, now: Date): number {
  const elapsedDays = (now.getTime() - Date.parse(m.lastSeenISO)) / MS_PER_DAY;
  const halfLife = BASE_HALF_LIFE_DAYS * Math.pow(2, m.caught);
  const decayed = m.strength * Math.pow(0.5, elapsedDays / halfLife);
  return clamp01(decayed);
}

/** Mastered when decayed strength meets the threshold and caught is high enough. */
export function isMisconceptionMastered(m: MisconceptionMastery, now: Date): boolean {
  return currentStrength(m, now) >= MASTERY_STRENGTH_THRESHOLD && m.caught >= MASTERY_MIN_CAUGHT;
}

/**
 * A lesson is mastered when every unique misconception tag across its problems
 * has a mastered entry in the map.
 *
 * Choices (documented):
 *   - No problems at all: false. There is nothing loaded to prove mastery over.
 *   - Problems present but zero tags: false. Nothing to prove yet, so we do not
 *     hand out a free pass.
 *   - A tag with no map entry: treated as not mastered (returns false).
 */
export function isLessonMastered(
  map: MasteryMap,
  lessonProblems: ProblemRef[],
  now: Date,
): boolean {
  if (lessonProblems.length === 0) return false;

  const tags = new Set<string>();
  for (const problem of lessonProblems) {
    for (const tag of problem.misconceptionTags) {
      tags.add(tag);
    }
  }
  if (tags.size === 0) return false;

  for (const tag of tags) {
    const entry = map[tag];
    if (!entry || !isMisconceptionMastered(entry, now)) return false;
  }
  return true;
}
