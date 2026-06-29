import { describe, expect, it } from 'vitest';
import {
  capScopePrinciples,
  findScopeViolations,
  getCourseModules,
  getLessonModule,
  validateLessonModule,
  validateLessonScope,
} from './index';
import { getProblemById } from './problems';
import coulombsLaw from './modules/coulombs-law';
import type { LessonModule } from './schema';

describe('capScopePrinciples', () => {
  it('leads with the in-scope priority principles in priority order, then fills with scope order', () => {
    const scope = ['a', 'b', 'c', 'd'];
    const priority = ['c', 'a'];
    // c then a (priority order), then b and d (scope order), capped at 3.
    expect(capScopePrinciples(scope, priority, 3)).toEqual(['c', 'a', 'b']);
  });

  it('ignores priority ids that are not in scope', () => {
    const scope = ['a', 'b'];
    const priority = ['x', 'b'];
    // x is dropped (off scope); b leads, then a fills.
    expect(capScopePrinciples(scope, priority, 5)).toEqual(['b', 'a']);
  });

  it('dedupes repeated ids across priority and scope', () => {
    const scope = ['a', 'a', 'b'];
    const priority = ['a', 'a'];
    expect(capScopePrinciples(scope, priority, 5)).toEqual(['a', 'b']);
  });

  it('caps to fewer ids than the scope holds', () => {
    expect(capScopePrinciples(['a', 'b', 'c'], [], 2)).toEqual(['a', 'b']);
  });

  it('returns the whole scope when the cap is larger than the scope', () => {
    expect(capScopePrinciples(['a', 'b'], ['b'], 5)).toEqual(['b', 'a']);
  });

  it('falls back to scope order when there is no priority', () => {
    expect(capScopePrinciples(['a', 'b', 'c'], [], 3)).toEqual(['a', 'b', 'c']);
  });

  it('returns an empty list for a non-positive cap', () => {
    expect(capScopePrinciples(['a', 'b'], ['a'], 0)).toEqual([]);
  });
});

describe('lesson module loaders', () => {
  it('loads the coulombs-law module by id', () => {
    const module = getLessonModule('coulombs-law');
    expect(module?.lessonId).toBe('coulombs-law');
    expect(module?.lessonNumber).toBe(1);
  });

  it('validates the authored coulombs-law module with no errors', () => {
    const module = getLessonModule('coulombs-law');
    expect(module).toBeDefined();
    expect(validateLessonModule(module!)).toEqual([]);
  });

  it('resolves every problemId the coulombs-law module references', () => {
    const module = getLessonModule('coulombs-law');
    expect(module).toBeDefined();
    const referenced = [
      ...module!.workedSequence.map((item) => item.problemId),
      ...module!.independentProblemIds,
    ];
    expect(referenced.length).toBeGreaterThan(0);
    for (const id of referenced) {
      expect(getProblemById(id), id).toBeDefined();
    }
  });

  it('carries an analogical worked pair and scaffolded completion rungs (Apply stays scaffolded)', () => {
    const module = getLessonModule('coulombs-law')!;
    const worked = module.workedSequence.filter((item) => item.mode === 'worked');
    expect(worked.length).toBeGreaterThanOrEqual(2);
    // The analogical pair shares one analogyGroup across two worked rungs.
    const group = worked[0].analogyGroup;
    expect(group).toBeTruthy();
    expect(worked.filter((item) => item.analogyGroup === group).length).toBe(2);
    // The faded rungs are completion rungs, each scaffolded with prefilled steps.
    // The independent practice lives in the Solve phase, so Apply keeps no
    // unscaffolded skeleton rung.
    const completions = module.workedSequence.filter((item) => item.mode === 'completion');
    expect(completions.length).toBeGreaterThanOrEqual(1);
    for (const item of completions) {
      expect((item.prefilledSteps?.length ?? 0) > 0, item.problemId).toBe(true);
    }
    expect(module.workedSequence.some((item) => item.mode === 'skeleton')).toBe(false);
    // Every worked rung ships its canonical solution steps.
    for (const item of worked) {
      expect((item.solutionSteps?.length ?? 0) > 0, item.problemId).toBe(true);
    }
  });

  it('returns undefined for an unknown lesson id', () => {
    expect(getLessonModule('not-a-real-lesson')).toBeUndefined();
  });

  it('lists the course modules sorted by lesson number', () => {
    const modules = getCourseModules();
    expect(modules.map((module) => module.lessonId)).toContain('coulombs-law');
    const numbers = modules.map((module) => module.lessonNumber);
    expect([...numbers].sort((a, b) => a - b)).toEqual(numbers);
  });

  it('ships only modules that pass validateLessonModule', () => {
    for (const module of getCourseModules()) {
      expect(validateLessonModule(module), module.lessonId).toEqual([]);
    }
  });

  it('keeps every module within its declared topic scope', () => {
    for (const module of getCourseModules()) {
      expect(validateLessonScope(module), module.lessonId).toEqual([]);
    }
  });

  it('confines the coulombs-law module to the force between point charges', () => {
    const module = getLessonModule('coulombs-law')!;
    expect(module.topicPrincipleIds).toEqual(['coulomb-force', 'superposition']);
    // No field, potential, energy, or flux principle may sneak in through any
    // referenced problem.
    expect(validateLessonScope(module)).toEqual([]);
  });
});

describe('validateLessonScope', () => {
  it('flags a referenced problem whose principle is outside the declared scope', () => {
    // cl-field-and-force carries field-concept, which is off-scope for a module
    // declared to cover only the Coulomb force.
    const drifted = validModule({
      topicPrincipleIds: ['coulomb-force'],
      workedSequence: [],
      independentProblemIds: ['cl-field-and-force'],
    });
    expect(validateLessonScope(drifted)).toContain(
      'problem cl-field-and-force references off-scope principle field-concept',
    );
  });

  it('flags a topic principle that is not a catalogued principle', () => {
    const bogus = validModule({ topicPrincipleIds: ['not-a-principle'], workedSequence: [], independentProblemIds: [] });
    expect(validateLessonScope(bogus)).toContain(
      'topic principle not-a-principle is not a catalogued principle',
    );
  });

  it('passes a module that references only in-scope problems', () => {
    const clean = validModule({
      topicPrincipleIds: ['coulomb-force', 'superposition'],
      workedSequence: [{ mode: 'worked', problemId: 'cl-coulomb-force-two-charges', selfExplainPrompt: 'Why?' }],
      independentProblemIds: ['cl-coulomb-net-2d'],
    });
    expect(validateLessonScope(clean)).toEqual([]);
  });

  it('skips ids that do not resolve and never throws on them', () => {
    const module = validModule({ workedSequence: [], independentProblemIds: ['does-not-exist'] });
    expect(findScopeViolations(module, getProblemById)).toEqual([]);
  });
});

function validModule(overrides: Partial<LessonModule> = {}): LessonModule {
  return {
    lessonId: 'coulombs-law',
    lessonNumber: 1,
    title: "Coulomb's Law",
    prerequisites: [],
    reviewSkillIds: [],
    topicPrincipleIds: ['coulomb-force', 'superposition'],
    inquiry: {
      question: 'How does the force depend on the distance?',
      capture: 'text',
      resolvedBy: 'inverse square',
    },
    explanationSlides: [{ heading: 'The law', body: 'It falls off as an inverse square of the distance.' }],
    workedSequence: [{ mode: 'worked', problemId: 'p1', selfExplainPrompt: 'Why?' }],
    independentProblemIds: ['p1'],
    ...overrides,
  };
}

describe('validateLessonModule', () => {
  it('accepts a clean module', () => {
    expect(validateLessonModule(validModule())).toEqual([]);
  });

  it('flags a worked item missing its selfExplainPrompt', () => {
    const module = validModule({ workedSequence: [{ mode: 'worked', problemId: 'p9' }] });
    expect(validateLessonModule(module)).toContain('worked item p9 is missing selfExplainPrompt');
  });

  it('requires the first slide to resolve the inquiry', () => {
    const module = validModule({ explanationSlides: [{ heading: 'x', body: 'no reference here' }] });
    expect(validateLessonModule(module)).toContain('first explanation slide must reference inquiry.resolvedBy');
  });

  it('requires 1 or 2 explanation slides', () => {
    expect(validateLessonModule(validModule({ explanationSlides: [] }))).toContain(
      'explanationSlides must have 1 or 2 slides',
    );
  });

  it('flags an em dash in any string field', () => {
    expect(validateLessonModule(validModule({ title: 'Coulomb\u2014s Law' }))).toContain(
      'module contains an em dash',
    );
  });
});

function baseModule(): LessonModule {
  return {
    lessonId: 'x', lessonNumber: 1, title: 'X', prerequisites: [], reviewSkillIds: [],
    topicPrincipleIds: [],
    inquiry: { question: 'q', capture: 'text', resolvedBy: 'idea' },
    explanationSlides: [{ heading: 'h', body: 'mentions idea here' }],
    workedSequence: [], independentProblemIds: [],
  };
}

describe('validateLessonModule inquiry screens', () => {
  it('rejects a screen with an empty reveal caption', () => {
    const m = baseModule();
    m.inquiry.screens = [{
      id: 's', variable: 'charge', mode: 'cycle', prompt: 'Predict the force.',
      left: { id: 'left', x: 3, y: 3, q: 1 }, right: { id: 'right', x: 7, y: 3, q: 1 },
      target: { apply: 'set-charge', chargeId: 'right', toQ: 3 }, revealCaption: '',
    }];
    expect(validateLessonModule(m)).toContain('inquiry screen s is missing revealCaption');
  });

  it('rejects an em dash in a screen caption', () => {
    const m = baseModule();
    m.inquiry.screens = [{
      id: 's', variable: 'charge', mode: 'cycle', prompt: 'Predict the force.',
      left: { id: 'left', x: 3, y: 3, q: 1 }, right: { id: 'right', x: 7, y: 3, q: 1 },
      target: { apply: 'set-charge', chargeId: 'right', toQ: 3 },
      revealCaption: 'Triple the charge \u2014 triple the force.',
    }];
    expect(validateLessonModule(m)).toContain('module contains an em dash');
  });

  it('accepts a well-formed screen', () => {
    const m = baseModule();
    m.inquiry.screens = [{
      id: 's', variable: 'charge', mode: 'cycle', prompt: 'Predict the force.',
      left: { id: 'left', x: 3, y: 3, q: 1 }, right: { id: 'right', x: 7, y: 3, q: 1 },
      target: { apply: 'set-charge', chargeId: 'right', toQ: 3 },
      revealCaption: 'Triple the charge, triple the force.',
    }];
    expect(validateLessonModule(m)).toEqual([]);
  });
});

describe('coulomb inquiry screens', () => {
  it('coulomb inquiry opens with an intro, then the charge and distance screens', () => {
    const ids = (coulombsLaw.inquiry.screens ?? []).map((s) => s.id);
    expect(ids).toEqual(['intro', 'charge', 'distance']);
    expect(validateLessonModule(coulombsLaw)).toEqual([]);
  });
});
