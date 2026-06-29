import { describe, expect, it } from 'vitest';
import {
  EMPTY_WORKED_EXAMPLE_SESSION_STATE,
  mergeWorkedExampleSession,
  normalizeWorkedExampleSession,
  normalizeWorkedExampleSessions,
  removeWorkedExampleSession,
  selectWorkedExampleSession,
  type WorkedExampleSession,
} from './workedExampleProgress';

function sampleSession(): WorkedExampleSession {
  return {
    revealedCount: 3,
    explanation: 'Newton third law: the forces are an equal and opposite pair.',
    feedback: { isOnTrack: true, feedback: 'You have the core idea.' },
    feedbackError: null,
    checked: true,
  };
}

describe('workedExampleProgress', () => {
  it('round-trips a full session through normalize', () => {
    const session = sampleSession();
    const merged = mergeWorkedExampleSession(
      EMPTY_WORKED_EXAMPLE_SESSION_STATE,
      'coulombs-law:apply:0',
      session,
    );

    const restored = normalizeWorkedExampleSessions(merged);

    expect(restored['coulombs-law:apply:0']).toEqual(session);
  });

  it('fills safe defaults for an empty session object', () => {
    expect(normalizeWorkedExampleSession({})).toEqual({
      revealedCount: 1,
      explanation: '',
      feedback: null,
      feedbackError: null,
      checked: false,
    });
  });

  it('drops the transient feedbackPending flag, keeping only durable fields', () => {
    const normalized = normalizeWorkedExampleSession({
      revealedCount: 2,
      explanation: 'work in progress',
      feedback: { isOnTrack: false, feedback: 'Keep building.' },
      // The live "checking" flag must never round-trip into the persisted shape.
      feedbackPending: true,
      feedbackError: null,
      checked: true,
    });

    expect(normalized).toEqual({
      revealedCount: 2,
      explanation: 'work in progress',
      feedback: { isOnTrack: false, feedback: 'Keep building.' },
      feedbackError: null,
      checked: true,
    });
    expect(normalized && 'feedbackPending' in normalized).toBe(false);
  });

  it('clamps a negative revealedCount and rejects malformed scalar fields', () => {
    const normalized = normalizeWorkedExampleSession({
      revealedCount: -4,
      explanation: 42, // not a string
      feedback: { isOnTrack: 'yes', feedback: 'bad shape' }, // isOnTrack not boolean
      feedbackError: 7, // not a string
      checked: 'totally', // not boolean true
    });

    expect(normalized).toEqual({
      revealedCount: 1,
      explanation: '',
      feedback: null,
      feedbackError: null,
      checked: false,
    });
  });

  it('truncates a fractional revealedCount', () => {
    expect(normalizeWorkedExampleSession({ revealedCount: 3.9 })?.revealedCount).toBe(3);
  });

  it('strips undefined so the document is Firestore-safe', () => {
    // A null feedback / feedbackError must survive the round trip as null, never
    // as an absent (undefined) key the Firestore SDK would reject.
    const merged = mergeWorkedExampleSession({}, 'k', {
      ...sampleSession(),
      feedback: null,
      feedbackError: null,
    });
    const serialized = JSON.parse(JSON.stringify(merged));

    expect(serialized).toEqual(merged);
    expect(merged.k.feedback).toBeNull();
    expect(merged.k.feedbackError).toBeNull();
  });

  it('drops malformed entries when normalizing the whole map', () => {
    const normalized = normalizeWorkedExampleSessions({
      good: sampleSession(),
      brokenString: 'nope',
      brokenNull: null,
    });

    expect(Object.keys(normalized)).toEqual(['good']);
    expect(normalized.good).toEqual(sampleSession());
  });

  it('selects and removes a stored session', () => {
    const state = mergeWorkedExampleSession({}, 'k', sampleSession());

    expect(selectWorkedExampleSession(state, 'k')).not.toBeNull();
    expect(selectWorkedExampleSession(state, 'missing')).toBeNull();

    const removed = removeWorkedExampleSession(state, 'k');
    expect(removed).toEqual({});
    // Removing an absent key returns the same (empty) map.
    expect(removeWorkedExampleSession({}, 'k')).toEqual({});
  });
});
