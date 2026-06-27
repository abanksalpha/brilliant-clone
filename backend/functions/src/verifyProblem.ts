import type { SynthesisCandidate } from './types';

// The verification gate is pure and honest. It returns a pass, or a fail that
// lists every reason it failed. It never repairs, substitutes, or fabricates a
// problem: callers that need a verified problem must throw on a fail.
export type VerifyResult = { ok: true } | { ok: false; reasons: string[] };

// An independent solver. Given only the problem statement, it returns a final
// answer string. It is injected so the gate can re-solve a candidate without
// trusting the candidate's own stated answer.
export type IndependentSolve = (statement: string) => Promise<string>;

// Matches a leading optionally signed decimal, including scientific notation,
// and captures whatever trails as the unit. The number alternation requires at
// least one digit, so plain prose returns no match.
const QUANTITY_RE = /^\s*([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)\s*(.*)$/;

// Parse a leading signed decimal (including scientific notation such as
// "-2.25e6") and an optional trailing unit string (trimmed). Returns null when
// no leading number parses.
export function parseQuantity(text: string): { value: number; unit: string } | null {
  if (typeof text !== 'string') {
    return null;
  }
  const match = text.match(QUANTITY_RE);
  if (match === null) {
    return null;
  }
  const value = Number(match[1]);
  if (!Number.isFinite(value)) {
    return null;
  }
  return { value, unit: match[2].trim() };
}

function normalizeUnit(unit: string): string {
  return unit.replace(/\s+/g, '').toLowerCase();
}

// Two answer strings agree when both parse, their units match (case insensitive,
// ignoring spaces) or at least one unit is empty, and their values are within
// relTol of each other relative to the larger magnitude. Two zeros agree.
export function answersAgree(a: string, b: string, relTol = 0.01): boolean {
  const qa = parseQuantity(a);
  const qb = parseQuantity(b);
  if (qa === null || qb === null) {
    return false;
  }

  const ua = normalizeUnit(qa.unit);
  const ub = normalizeUnit(qb.unit);
  const unitsMatch = ua === ub || ua === '' || ub === '';
  if (!unitsMatch) {
    return false;
  }

  if (qa.value === 0 && qb.value === 0) {
    return true;
  }

  const diff = Math.abs(qa.value - qb.value);
  const scale = Math.max(Math.abs(qa.value), Math.abs(qb.value), 1e-12);
  return diff <= relTol * scale;
}

// Verify a synthesized candidate. Collects every failing reason rather than
// returning on the first one, and passes only when there are none. The gate
// confirms the problem chains at least two principles, declares diagnosable
// misconceptions, states a parseable answer, and survives an independent
// re-solve consensus.
export async function verifyProblem(
  candidate: SynthesisCandidate,
  solve: IndependentSolve,
  resolveCount?: number,
): Promise<VerifyResult> {
  const reasons: string[] = [];

  if (candidate.principleIds.length < 2) {
    reasons.push('must chain at least two principles');
  }

  if (candidate.flaws.length < 1) {
    reasons.push('must declare at least one misconception flaw');
  }
  for (const flaw of candidate.flaws) {
    if (flaw.misconceptionId.length === 0) {
      reasons.push('flaw missing misconceptionId');
    }
  }

  if (parseQuantity(candidate.finalAnswer) === null) {
    reasons.push('final answer is not a parseable quantity');
  }

  const solved = await Promise.all(
    Array.from({ length: resolveCount ?? 2 }, () => solve(candidate.statement)),
  );
  const agreesWithStated = solved.every((answer) => answersAgree(answer, candidate.finalAnswer));
  const agreesWithEachOther = solved.every((answer) => answersAgree(answer, solved[0]));
  if (!agreesWithStated || !agreesWithEachOther) {
    reasons.push('independent re-solve disagreed with the stated answer');
  }

  for (const flaw of candidate.flaws) {
    const wrong = parseQuantity(flaw.wrongAnswer);
    if (wrong === null || answersAgree(flaw.wrongAnswer, candidate.finalAnswer)) {
      reasons.push(`flaw ${flaw.misconceptionId} does not produce a distinct wrong answer`);
    }
  }

  // Each flaw must map to a genuinely different wrong result. Two flaws whose
  // wrong answers agree would be indistinguishable to the grader, so the
  // misconception they target could not be diagnosed from the answer alone. The
  // reason is reported once regardless of how many pairs collide.
  let hasDuplicateWrongAnswer = false;
  for (let i = 0; i < candidate.flaws.length; i += 1) {
    for (let j = i + 1; j < candidate.flaws.length; j += 1) {
      if (answersAgree(candidate.flaws[i].wrongAnswer, candidate.flaws[j].wrongAnswer)) {
        hasDuplicateWrongAnswer = true;
      }
    }
  }
  if (hasDuplicateWrongAnswer) {
    reasons.push('flaws produce duplicate wrong answers');
  }

  if (reasons.length > 0) {
    return { ok: false, reasons };
  }
  return { ok: true };
}
