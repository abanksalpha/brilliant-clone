import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EMPTY_CLOUD_STATE, toDocument, type UserCloudState } from './cloudStore';
import { EMPTY_PROGRESS, normalizeProgress } from './dashboardProgress';

describe('cloudStore toDocument', () => {
  it('writes misconceptions and problemAttempts into the persisted document', () => {
    const state: UserCloudState = {
      progress: {
        ...EMPTY_PROGRESS,
        misconceptions: {
          'sign-error': { caught: 2, missed: 1, lastSeenISO: '2026-06-20T10:00:00.000Z', strength: 0.74 },
        },
        problemAttempts: {
          'cl-field-point-charge': { attempts: 3, solvedISO: '2026-06-21T09:30:00.000Z', hintsUsed: 1 },
        },
      },
      lessonSessions: EMPTY_CLOUD_STATE.lessonSessions,
      problemSessions: EMPTY_CLOUD_STATE.problemSessions,
    };

    const document = toDocument(state);

    expect(document.misconceptions).toEqual(state.progress.misconceptions);
    expect(document.problemAttempts).toEqual(state.progress.problemAttempts);
  });

  it('round-trips the mastery fields back through normalizeProgress', () => {
    const state: UserCloudState = {
      progress: {
        ...EMPTY_PROGRESS,
        misconceptions: {
          'vector-direction': { caught: 1, missed: 4, lastSeenISO: '2026-06-19T08:00:00.000Z', strength: 0.21 },
        },
        problemAttempts: {
          'cl-midpoint-field-potential': { attempts: 2, hintsUsed: 0 },
        },
      },
      lessonSessions: EMPTY_CLOUD_STATE.lessonSessions,
      problemSessions: EMPTY_CLOUD_STATE.problemSessions,
    };

    const restored = normalizeProgress(toDocument(state));

    expect(restored.misconceptions).toEqual(state.progress.misconceptions);
    expect(restored.problemAttempts).toEqual(state.progress.problemAttempts);
  });
});

// Regression guard for a real outage: the client rewrites the whole users doc on
// every save, and the security rules validate it with `hasOnly([...])`. If
// toDocument ever writes a field the rules do not list, EVERY write is rejected
// with permission-denied, so nothing persists (work silently reverts on reload).
// This locks the writer's shape to the deployed allowlist so the two can never
// drift apart again. NOTE: the rules still have to be deployed for a live fix;
// this only proves the source-of-truth file matches the writer.
describe('cloudStore document honors the firestore.rules allowlist', () => {
  // Walk up from the test runner's working directory to find the rules file, so
  // this works whether vitest runs from frontend/ or the repo root.
  function findRulesFile(): string {
    let dir = process.cwd();
    for (let depth = 0; depth < 8; depth += 1) {
      const candidate = join(dir, 'backend', 'firestore.rules');
      if (existsSync(candidate)) return candidate;
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
    throw new Error(`Could not locate backend/firestore.rules from ${process.cwd()}`);
  }

  const rulesSrc = readFileSync(findRulesFile(), 'utf8');

  // Pulls the quoted key names out of the first `hasOnly([...])` inside a rules
  // helper function (the users-doc validator lists its full allowed key set).
  function allowlistFor(fnName: string): string[] {
    const fnIdx = rulesSrc.indexOf(`function ${fnName}`);
    expect(fnIdx).toBeGreaterThanOrEqual(0);
    const openIdx = rulesSrc.indexOf('hasOnly([', fnIdx);
    const closeIdx = rulesSrc.indexOf('])', openIdx);
    expect(openIdx).toBeGreaterThanOrEqual(0);
    expect(closeIdx).toBeGreaterThan(openIdx);
    const body = rulesSrc.slice(openIdx, closeIdx);
    return Array.from(body.matchAll(/'([^']+)'/g), (match) => match[1]);
  }

  it('writes only keys the rules allow, so saves are never rejected as invalid', () => {
    const allowed = new Set(allowlistFor('isValidProgress'));
    const written = Object.keys(toDocument(EMPTY_CLOUD_STATE));
    const disallowed = written.filter((key) => !allowed.has(key));

    expect(disallowed).toEqual([]);
  });
});
