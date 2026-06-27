import { describe, it, expect } from 'vitest';
import {
  hashStatement,
  parseSynthesisResponse,
  assembleVerifiedProblem,
  toProblemKey,
  buildMisconceptionPrompt,
} from './synthesis';
import type { IndependentSolve } from './verifyProblem';

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

const TARGET_BELIEF = 'electric potential adds like a vector with direction';
const TARGET_PRINCIPLE = 'energy-potential';

// A payload aimed at a specific misconception: principleIds carries the targeted
// principle plus a second one (so the gate's chain rule is satisfied), and a flaw
// encodes the targeted wrong belief with a distinct wrong answer.
function misconceptionPayload(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    statement:
      'Two point charges define a potential along a line. Find the potential at the midpoint, then the energy to bring a third charge there from infinity.',
    skillIds: ['potential-superposition', 'work-energy'],
    principleIds: [TARGET_PRINCIPLE, 'superposition'],
    misconceptionTags: ['potential-as-vector'],
    difficultyBand: 4,
    correctSolution: ['V = k sum(q_i / r_i)', 'U = q V'],
    finalAnswer: '4.5e2 V',
    rubric: 'Credit the scalar potential sum and the energy step.',
    flaws: [
      { misconceptionId: 'potential-as-vector', signature: 'adds potentials as vectors with direction', wrongAnswer: '1.2e2 V' },
    ],
    ...overrides,
  });
}

const agreeingReviewSolve: IndependentSolve = async () => '4.5e2 V';
const disagreeingReviewSolve: IndependentSolve = async () => '1.0 V';

describe('buildMisconceptionPrompt', () => {
  const prompt = buildMisconceptionPrompt({
    wrongBelief: TARGET_BELIEF,
    principleId: TARGET_PRINCIPLE,
    difficultyBand: 4,
  });

  it('includes the targeted wrong belief', () => {
    expect(prompt).toContain(TARGET_BELIEF);
  });

  it('includes the principle id', () => {
    expect(prompt).toContain(TARGET_PRINCIPLE);
  });

  it('instructs the model to return JSON only', () => {
    expect(prompt).toContain('Return ONLY a JSON object');
  });
});

describe('assembleVerifiedProblem for a misconception-targeted candidate', () => {
  it('returns the candidate carrying the targeted principle when the solve agrees', async () => {
    const candidate = await assembleVerifiedProblem(misconceptionPayload(), agreeingReviewSolve);
    expect(candidate.principleIds).toContain(TARGET_PRINCIPLE);
    expect(candidate.finalAnswer).toBe('4.5e2 V');
    expect(candidate.problemId.startsWith('syn:')).toBe(true);
  });

  it('throws "synthesis verification failed" when the independent solve disagrees', async () => {
    await expect(
      assembleVerifiedProblem(misconceptionPayload(), disagreeingReviewSolve),
    ).rejects.toThrow('synthesis verification failed');
  });
});
