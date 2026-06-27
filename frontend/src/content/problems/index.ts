import fieldPointCharge from './cl-field-point-charge.json';
import coulombForceTwoCharges from './cl-coulomb-force-two-charges.json';
import twoChargeSuperposition from './cl-two-charge-superposition.json';
import midpointFieldPotential from './cl-midpoint-field-potential.json';
import type { Problem } from '../problemSchema';

export type { Problem } from '../problemSchema';

const problems = [
  fieldPointCharge,
  coulombForceTwoCharges,
  twoChargeSuperposition,
  midpointFieldPotential,
] as Problem[];

export const PROBLEMS: Problem[] = problems;

export function getProblemById(id: string): Problem | undefined {
  return problems.find((problem) => problem.problemId === id);
}

export function getProblemsForLesson(lessonId: string): Problem[] {
  return problems.filter((problem) => problem.lessonId === lessonId);
}
