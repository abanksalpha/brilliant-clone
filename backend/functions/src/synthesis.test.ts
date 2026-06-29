import { describe, it, expect } from 'vitest';
import {
  hashStatement,
  parseSynthesisResponse,
  assembleVerifiedProblem,
  toProblemKey,
  buildPlannerPrompt,
  buildPlannedProblemPrompt,
  parseProblemPlan,
  extractFinalAnswer,
} from './synthesis';
import type { IndependentSolve } from './verifyProblem';
import type { PlanSlot } from './types';

// Em dash (U+2014), horizontal bar (U+2015), and en dash (U+2013): the three
// Unicode dashes that must never survive into a student-facing string.
const UNICODE_DASH = /[\u2013\u2014\u2015]/;

function validPayload(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    statement:
      'A 3.0 microcoulomb charge sits 2.0 m from point P. Find the field at P, then the force on a 1.0 C charge placed there.',
    skillIds: ['coulomb', 'field-to-force'],
    principleIds: ['coulomb-field', 'field-to-force'],
    misconceptionTags: ['inverse-square-error'],
    difficultyBand: 3,
    correctSolution: ['E = k q / r^2', 'F = q E'],
    finalAnswer: '6.74e3 N/C',
    rubric: 'Credit the field step and the force step.',
    flaws: [
      { misconceptionId: 'inverse-square-error', signature: 'divides by r not r^2', wrongAnswer: '1.35e4 N/C' },
    ],
    ...overrides,
  });
}

const agreeingSolve: IndependentSolve = async () => '6.74e3 N/C';
const disagreeingSolve: IndependentSolve = async () => '1.0 N/C';

describe('hashStatement', () => {
  it('is stable for the same input', () => {
    expect(hashStatement('the same statement')).toBe(hashStatement('the same statement'));
  });

  it('differs for different input', () => {
    expect(hashStatement('statement one')).not.toBe(hashStatement('statement two'));
  });
});

describe('parseSynthesisResponse', () => {
  it('parses a fenced JSON payload and sets a syn problemId', () => {
    const raw = 'Here is the problem.\n```json\n' + validPayload() + '\n```\nThanks.';
    const candidate = parseSynthesisResponse(raw);
    expect(candidate.problemId).toBe('syn:' + hashStatement(candidate.statement));
    expect(candidate.problemId.startsWith('syn:')).toBe(true);
    expect(candidate.finalAnswer).toBe('6.74e3 N/C');
    expect(candidate.flaws).toHaveLength(1);
  });

  it('throws when statement is missing', () => {
    expect(() => parseSynthesisResponse(validPayload({ statement: undefined }))).toThrow();
  });

  it('throws when flaws is not an array', () => {
    expect(() => parseSynthesisResponse(validPayload({ flaws: 'not an array' }))).toThrow();
  });

  it('throws when a flaw is missing wrongAnswer', () => {
    const raw = validPayload({
      flaws: [{ misconceptionId: 'inverse-square-error', signature: 'divides by r not r^2' }],
    });
    expect(() => parseSynthesisResponse(raw)).toThrow();
  });
});

describe('assembleVerifiedProblem', () => {
  it('returns the candidate when the independent solve agrees', async () => {
    const candidate = await assembleVerifiedProblem(validPayload(), agreeingSolve);
    expect(candidate.finalAnswer).toBe('6.74e3 N/C');
    expect(candidate.problemId.startsWith('syn:')).toBe(true);
  });

  it('throws "synthesis verification failed" when the solve disagrees', async () => {
    await expect(assembleVerifiedProblem(validPayload(), disagreeingSolve)).rejects.toThrow(
      'synthesis verification failed',
    );
  });
});

describe('toProblemKey', () => {
  it('maps a candidate to a grader key whose flaws drop wrongAnswer', () => {
    const candidate = parseSynthesisResponse(validPayload());
    const key = toProblemKey(candidate);
    expect(key.statement).toBe(candidate.statement);
    expect(key.correctSolution).toEqual(candidate.correctSolution);
    expect(key.finalAnswer).toBe(candidate.finalAnswer);
    expect(key.rubric).toBe(candidate.rubric);
    expect(key.flaws).toEqual([
      { misconceptionId: 'inverse-square-error', signature: 'divides by r not r^2' },
    ]);
    key.flaws.forEach((flaw) => {
      expect('wrongAnswer' in flaw).toBe(false);
    });
  });
});

// Two slots: a focused single-topic slot with one target misconception, and a
// synthesis slot that must chain its principles. The planner gets the scope and
// misconceptions only so each sketch fits its slot; it never grades them.
const PLAN_SLOTS: PlanSlot[] = [
  {
    skillIds: ['coulombs-law'],
    principleIds: ['coulomb-force'],
    difficultyBand: 4,
    kind: 'single',
    requireChain: false,
    targetMisconceptions: [
      { nodeId: 'node-inverse-square', principleId: 'coulomb-force', wrongBelief: 'force falls off as 1/r not 1/r^2' },
    ],
  },
  {
    skillIds: ['field-superposition'],
    principleIds: ['coulomb-field', 'superposition'],
    difficultyBand: 5,
    kind: 'synthesis',
    requireChain: true,
    targetMisconceptions: [],
  },
];

describe('buildPlannerPrompt', () => {
  const prompt = buildPlannerPrompt({
    slots: PLAN_SLOTS,
    existingStatements: ['Two point charges sit 0.10 m apart. Find the magnitude of the force between them.'],
    lessonTitle: "Coulomb's Law",
  });

  it('asks for one distinct problem per slot (by the slot count)', () => {
    expect(prompt).toContain('set of 2 AP Physics C problems');
    expect(prompt).toContain('Return exactly 2 plans');
    expect(prompt).toContain('mutually distinct');
  });

  it('lists the existing statements to avoid', () => {
    expect(prompt).toContain('ALREADY IN THE SET');
    expect(prompt).toContain('Two point charges sit 0.10 m apart');
  });

  it('asks only for a title and a short scenario sketch, not the full problem or the answer', () => {
    expect(prompt).toContain('scenario sketch');
    expect(prompt).toContain('"title": string');
    expect(prompt).toContain('"description": string');
    expect(prompt).toContain('Do NOT include the full problem');
  });

  it('requires the synthesis slot to chain its principles', () => {
    expect(prompt).toContain('synthesis slot must chain');
  });

  it('makes each slot scope authoritative so a review never drifts to the current lesson', () => {
    // The lesson title is only context; the per-slot Skills/Principles define the topic.
    expect(prompt).toContain('currently studying');
    expect(prompt).toContain('strictly within its own slot scope');
    expect(prompt).toContain('not the current lesson');
  });

  it('omits the existing-statements section when none are supplied', () => {
    const noExisting = buildPlannerPrompt({ slots: PLAN_SLOTS, existingStatements: [], lessonTitle: 'Fields' });
    expect(noExisting).not.toContain('ALREADY IN THE SET');
  });

  it('contains no em dash or en dash characters', () => {
    expect(UNICODE_DASH.test(prompt)).toBe(false);
  });
});

describe('buildPlannedProblemPrompt', () => {
  const DESCRIPTION =
    'A small charged bead hangs from a thread between two fixed charges; find the tension in the thread.';
  const TITLE = 'Charged bead on a thread';
  const prompt = buildPlannedProblemPrompt({
    skillIds: ['coulombs-law'],
    principleIds: ['coulomb-force', 'superposition'],
    difficultyBand: 5,
    targetMisconceptions: [
      { nodeId: 'node-tension', principleId: 'coulomb-force', wrongBelief: 'tension ignores the electric force' },
    ],
    description: DESCRIPTION,
    title: TITLE,
  });

  it('embeds the planned description verbatim and tells the model to realize it', () => {
    expect(prompt).toContain(DESCRIPTION);
    expect(prompt).toContain('REALIZE EXACTLY THIS SCENARIO');
  });

  it('embeds the planned title and instructs the model to use it', () => {
    expect(prompt).toContain(TITLE);
    expect(prompt).toContain('USE THIS EXACT TITLE');
  });

  it('pins each target misconception to an exact misconceptionId', () => {
    expect(prompt).toContain('node-tension');
    expect(prompt).toContain('misconceptionId is EXACTLY');
  });

  it('chains principles by default and asks for a focused problem when requireChain is false', () => {
    expect(prompt).toContain('PRINCIPLES TO CHAIN');
    const focused = buildPlannedProblemPrompt({
      skillIds: ['mechanics-forces'],
      principleIds: ['mechanics-newtons-laws'],
      difficultyBand: 4,
      targetMisconceptions: [],
      requireChain: false,
      description: 'A box slides across a rough floor; find how far it travels before stopping.',
      title: 'Box sliding to a stop',
    });
    expect(focused).toContain('PRINCIPLES TO EXERCISE');
    expect(focused).toContain('focused');
    expect(focused).not.toContain('at least two of the listed principles');
  });

  it('requests the past concept principles when provided and omits the line otherwise', () => {
    const withPast = buildPlannedProblemPrompt({
      skillIds: ['coulombs-law'],
      principleIds: ['coulomb-force', 'superposition'],
      difficultyBand: 5,
      targetMisconceptions: [],
      pastPrincipleIds: ['mechanics-newtons-laws'],
      description: DESCRIPTION,
      title: TITLE,
    });
    expect(withPast).toContain('mechanics-newtons-laws');
    expect(prompt).not.toContain('PAST CONCEPT PRINCIPLES');
  });

  it('contains no em dash or en dash characters', () => {
    expect(UNICODE_DASH.test(prompt)).toBe(false);
  });
});

function planPayload(plans: unknown): string {
  return JSON.stringify({ plans });
}

describe('parseProblemPlan', () => {
  const TWO_PLANS = [
    { slotIndex: 0, title: 'Charge held in equilibrium', description: 'A bead between two charges; find where it rests.' },
    { slotIndex: 1, title: 'Net field at a square corner', description: 'Four charges on a square; find the field at one corner.' },
  ];

  it('parses a fenced JSON payload into plans sorted by slotIndex', () => {
    const raw = 'Here is the plan.\n```json\n' + planPayload([TWO_PLANS[1], TWO_PLANS[0]]) + '\n```\nThanks.';
    const plans = parseProblemPlan(raw, 2);
    expect(plans.map((p) => p.slotIndex)).toEqual([0, 1]);
    expect(plans[0].title).toBe('Charge held in equilibrium');
    expect(plans[1].description).toContain('Four charges on a square');
  });

  it('strips dashes from the title and description', () => {
    const raw = planPayload([
      { slotIndex: 0, title: 'Field then force\u2014two steps', description: 'Find E\u2014then the force on a test charge.' },
    ]);
    const plans = parseProblemPlan(raw, 1);
    expect(plans[0].title).toBe('Field then force, two steps');
    expect(UNICODE_DASH.test(plans[0].description)).toBe(false);
  });

  it('throws when the plan count does not match the expected count', () => {
    expect(() => parseProblemPlan(planPayload([TWO_PLANS[0]]), 2)).toThrow();
  });

  it('throws when plans is not an array', () => {
    expect(() => parseProblemPlan(JSON.stringify({ plans: 'not an array' }), 1)).toThrow();
  });

  it('throws when a plan is missing a description', () => {
    expect(() => parseProblemPlan(planPayload([{ slotIndex: 0, title: 'X' }]), 1)).toThrow();
  });

  it('throws on a slotIndex out of range', () => {
    expect(() => parseProblemPlan(planPayload([{ slotIndex: 5, title: 'X', description: 'Y' }]), 1)).toThrow();
  });

  it('throws on a duplicate slotIndex', () => {
    const dup = [
      { slotIndex: 0, title: 'A', description: 'a first distinct scenario' },
      { slotIndex: 0, title: 'B', description: 'a second distinct scenario' },
    ];
    expect(() => parseProblemPlan(planPayload(dup), 2)).toThrow();
  });

  it('throws when two descriptions are not mutually distinct (case and spacing insensitive)', () => {
    const dup = [
      { slotIndex: 0, title: 'A', description: 'A bead between two charges; find where it rests.' },
      { slotIndex: 1, title: 'B', description: 'a bead between two   charges; find where it rests.' },
    ];
    expect(() => parseProblemPlan(planPayload(dup), 2)).toThrow();
  });
});

describe('parseSynthesisResponse dash sanitization', () => {
  it('strips dashes from the statement (the screenshot case) and keeps the id content addressed', () => {
    const raw = validPayload({
      statement: "You got the core idea right\u2014it's an inverse square setup. Find E at point P.",
    });
    const candidate = parseSynthesisResponse(raw);
    expect(candidate.statement).toBe(
      "You got the core idea right, it's an inverse square setup. Find E at point P.",
    );
    expect(UNICODE_DASH.test(candidate.statement)).toBe(false);
    // The id is hashed from the sanitized statement we return, so the invariant
    // problemId === 'syn:' + hashStatement(statement) still holds after stripping.
    expect(candidate.problemId).toBe('syn:' + hashStatement(candidate.statement));
  });

  it('strips dashes from correctSolution steps while preserving hyphen math like 10^-6', () => {
    const raw = validPayload({
      correctSolution: ['E = k q / r^2', 'plug in 10^-6\u2014then simplify'],
    });
    const candidate = parseSynthesisResponse(raw);
    expect(candidate.correctSolution).toEqual(['E = k q / r^2', 'plug in 10^-6, then simplify']);
    expect(candidate.correctSolution[1]).toContain('10^-6');
    candidate.correctSolution.forEach((step) => expect(UNICODE_DASH.test(step)).toBe(false));
  });

  it('strips both em and en dashes from the rubric', () => {
    const raw = validPayload({
      rubric: 'Credit the field step\u2014then the force step \u2013 full marks.',
    });
    const candidate = parseSynthesisResponse(raw);
    expect(candidate.rubric).toBe('Credit the field step, then the force step, full marks.');
    expect(UNICODE_DASH.test(candidate.rubric)).toBe(false);
  });

  it('leaves non-prose fields untouched: the finalAnswer quantity and the misconception signature', () => {
    const raw = validPayload({
      finalAnswer: '6.74e3 N/C',
      flaws: [
        { misconceptionId: 'inverse-square-error', signature: 'divides by r\u2014not r^2', wrongAnswer: '1.35e4 N/C' },
      ],
    });
    const candidate = parseSynthesisResponse(raw);
    // finalAnswer is a canonical quantity, not prose: it passes through verbatim.
    expect(candidate.finalAnswer).toBe('6.74e3 N/C');
    // The signature is an internal misconception-matching key, not shown prose, so
    // its Unicode dash is deliberately preserved rather than rewritten to a comma.
    expect(candidate.flaws[0].signature).toBe('divides by r\u2014not r^2');
  });
});

describe('extractFinalAnswer', () => {
  it('takes the quantity after a FINAL marker, ignoring the step-by-step work above it', () => {
    const text = [
      'Net force along the ramp: F = m g sin(theta).',
      'F = 2.0 * 9.8 * sin(30) = 9.8 N.',
      'FINAL: 9.8 N',
    ].join('\n');
    expect(extractFinalAnswer(text)).toBe('9.8 N');
  });

  it('uses the last FINAL marker when the model restates it', () => {
    const text = 'FINAL: 3 N (draft)\nActually recompute.\nFINAL: 4.2 N';
    expect(extractFinalAnswer(text)).toBe('4.2 N');
  });

  it('is case insensitive and tolerates surrounding whitespace', () => {
    expect(extractFinalAnswer('work...\n   final:   2.25e6 N/C   ')).toBe('2.25e6 N/C');
  });

  it('strips markdown emphasis so a bolded answer does not corrupt the unit', () => {
    // The model often bolds the final line; a trailing ** must not survive into
    // the unit (the bug that made the gate reject correct problems).
    expect(extractFinalAnswer('reasoning\nFINAL: 9.9 m/s**')).toBe('9.9 m/s');
    expect(extractFinalAnswer('**FINAL: 2.25e6 N/C**')).toBe('2.25e6 N/C');
    expect(extractFinalAnswer('work\n**5.4 N**')).toBe('5.4 N');
  });

  it('falls back to the last non-empty line when no FINAL marker is present', () => {
    expect(extractFinalAnswer('some reasoning\n\n5.4 N\n')).toBe('5.4 N');
  });

  it('strips LaTeX wrappers (thin spaces, \\text, stray braces) so the unit parses', () => {
    expect(extractFinalAnswer('work\nFINAL: 3.92 \\, \\text{m/s}^2')).toBe('3.92 m/s^2');
    expect(extractFinalAnswer('FINAL: } -0.9 \\, \\text{m/s}^2')).toBe('-0.9 m/s^2');
  });
});

describe('parseSynthesisResponse title', () => {
  it('keeps a provided title and sanitizes dashes', () => {
    expect(parseSynthesisResponse(validPayload({ title: 'Speed at the bottom of a ramp' })).title).toBe(
      'Speed at the bottom of a ramp',
    );
    expect(parseSynthesisResponse(validPayload({ title: 'Field then force\u2014two steps' })).title).toBe(
      'Field then force, two steps',
    );
  });

  it('leaves title undefined when the model omits it', () => {
    expect(parseSynthesisResponse(validPayload()).title).toBeUndefined();
  });
});
