import { describe, expect, it } from 'vitest';
import { principleIdsForSkills } from './index';
import { PROBLEMS } from './problems';

describe('principleIdsForSkills', () => {
  it('unions the principleIds of every problem that shares a skill, in first-appearance order', () => {
    // coulomb-force appears first (cl-coulomb-force-two-charges), then superposition
    // (cl-coulomb-collinear-net). field-concept and conductor-equilibrium ride in on
    // the cross-skill synthesis problems that also carry the coulombs-law skill
    // (cl-field-and-force, then cci-share-then-force), so they land last.
    expect(principleIdsForSkills(['coulombs-law'])).toEqual([
      'coulomb-force',
      'superposition',
      'field-concept',
      'conductor-equilibrium',
    ]);
  });

  it('returns an empty list for a skill no problem carries, and for no skills', () => {
    expect(principleIdsForSkills(['not-a-real-skill'])).toEqual([]);
    expect(principleIdsForSkills([])).toEqual([]);
  });

  it('dedupes a repeated skill and a principle shared across skills', () => {
    const once = principleIdsForSkills(['coulombs-law']);
    // Passing the same skill twice cannot introduce duplicates or change the result.
    expect(principleIdsForSkills(['coulombs-law', 'coulombs-law'])).toEqual(once);

    // Two overlapping skills share several principles; each still appears once, and
    // the union covers everything either skill contributes.
    const combined = principleIdsForSkills(['coulombs-law', 'electric-field-field-lines']);
    expect(new Set(combined).size).toBe(combined.length);
    for (const id of once) {
      expect(combined).toContain(id);
    }
  });

  it('maps a skill to whatever principles its problems carry (not 1:1 by name)', () => {
    // skill mechanics-forces resolves to principle mechanics-newtons-laws.
    const result = principleIdsForSkills(['mechanics-forces']);
    expect(result).toEqual(['mechanics-newtons-laws']);

    // Cross-check against the bank: the union must match exactly the set of
    // principles carried by every problem that shares the skill.
    const expected = new Set<string>();
    for (const problem of PROBLEMS) {
      if (problem.skillIds.includes('mechanics-forces')) {
        for (const id of problem.principleIds) expected.add(id);
      }
    }
    expect(new Set(result)).toEqual(expected);
  });
});
