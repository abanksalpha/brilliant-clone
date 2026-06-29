import { findScopeViolations, type LessonModule } from './schema';
import coulombsLaw from './modules/coulombs-law';
import chargingConductorsInsulators from './modules/charging-conductors-insulators';
import electricFieldFieldLines from './modules/electric-field-field-lines';
import electricFieldsOfChargeDistributions from './modules/electric-fields-of-charge-distributions';
import electricFlux from './modules/electric-flux';
import gausssLaw from './modules/gausss-law';
import { getProblemById, PROBLEMS } from './problems';
import { PRINCIPLES } from './principles';

export type {
  FadedItem,
  InquiryPrompt,
  LessonModule,
  SandboxConfig,
  Slide,
} from './schema';

export { validateLessonModule, findScopeViolations } from './schema';

// The authored five-phase lesson modules in course order. Phase 1 (review) is
// composed at runtime by the assignment composer, so it is not stored here.
const MODULES: LessonModule[] = [
  coulombsLaw,
  chargingConductorsInsulators,
  electricFieldFieldLines,
  electricFieldsOfChargeDistributions,
  electricFlux,
  gausssLaw,
];

export function getCourseModules(): LessonModule[] {
  return [...MODULES].sort((a, b) => a.lessonNumber - b.lessonNumber);
}

export function getLessonModule(id: string): LessonModule | undefined {
  return MODULES.find((module) => module.lessonId === id);
}

/**
 * Returns a list of human-readable scope violations for a module, binding the
 * pure {@link findScopeViolations} to the real problem catalog and principle
 * list. It first flags any topicPrincipleId that is not a catalogued principle
 * (mirroring the problem-level "references only catalogued principles" check),
 * then appends every referenced problem that strays outside the declared scope.
 * An empty list means the lesson stays entirely within its authored topic.
 */
export function validateLessonScope(module: LessonModule): string[] {
  const knownPrincipleIds = new Set(PRINCIPLES.map((principle) => principle.id));
  const errors: string[] = [];

  for (const principleId of module.topicPrincipleIds) {
    if (!knownPrincipleIds.has(principleId)) {
      errors.push(`topic principle ${principleId} is not a catalogued principle`);
    }
  }

  return [...errors, ...findScopeViolations(module, getProblemById)];
}

/**
 * Returns at most `cap` principle ids for a generated slot: the priority ones
 * that are in scope first (in priority order), then the remaining scope ids in
 * their original order, deduped. The priority ids are the learner's weakest
 * tracked-node principles, so a capped synthesis keeps the most useful
 * principles instead of an unverifiable chain of every past concept. Pure and
 * order-stable; never mutates its inputs. A priority id outside the scope is
 * ignored, and a non-positive cap yields an empty list.
 */
export function capScopePrinciples(
  scopePrincipleIds: string[],
  priorityPrincipleIds: string[],
  cap: number,
): string[] {
  if (cap <= 0) return [];

  const scope = new Set(scopePrincipleIds);
  const seen = new Set<string>();
  const ordered: string[] = [];

  for (const principleId of priorityPrincipleIds) {
    if (!scope.has(principleId) || seen.has(principleId)) continue;
    seen.add(principleId);
    ordered.push(principleId);
  }

  for (const principleId of scopePrincipleIds) {
    if (seen.has(principleId)) continue;
    seen.add(principleId);
    ordered.push(principleId);
  }

  return ordered.slice(0, cap);
}

/**
 * The de-duplicated union of principleIds drawn from every authored problem whose
 * skillIds intersect the given skillIds, in order of first appearance. This derives
 * a practice scope's principles from the bank itself rather than a separate table,
 * so a skill resolves to whatever principles its problems actually exercise (the
 * mapping is not 1:1 by name, e.g. skill mechanics-forces resolves to principle
 * mechanics-newtons-laws). Pure: it reads only the static catalog and never mutates
 * it.
 */
export function principleIdsForSkills(skillIds: string[]): string[] {
  const scope = new Set(skillIds);
  const seen = new Set<string>();
  const union: string[] = [];
  for (const problem of PROBLEMS) {
    if (!problem.skillIds.some((skillId) => scope.has(skillId))) continue;
    for (const principleId of problem.principleIds) {
      if (seen.has(principleId)) continue;
      seen.add(principleId);
      union.push(principleId);
    }
  }
  return union;
}
