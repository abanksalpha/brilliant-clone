import { ProblemKey } from '../types';
import { clFieldPointCharge } from './cl-field-point-charge';
import { clCoulombForceTwoCharges } from './cl-coulomb-force-two-charges';
import { clTwoChargeSuperposition } from './cl-two-charge-superposition';
import { clMidpointFieldPotential } from './cl-midpoint-field-potential';
import { parseVariantId } from '../templates';
import { generateVariant } from '../generateVariant';

const VARIANT_PREFIX = 'v1:';

const REGISTRY: Record<string, ProblemKey> = {
  [clFieldPointCharge.problemId]: clFieldPointCharge,
  [clCoulombForceTwoCharges.problemId]: clCoulombForceTwoCharges,
  [clTwoChargeSuperposition.problemId]: clTwoChargeSuperposition,
  [clMidpointFieldPotential.problemId]: clMidpointFieldPotential,
};

export function getProblemKey(problemId: string): ProblemKey {
  // A versioned variant id carries its own parameters, so its key is derived at
  // grade time rather than stored. Static ids keep their existing behavior.
  if (problemId.startsWith(VARIANT_PREFIX)) {
    const { templateId, params } = parseVariantId(problemId);
    return generateVariant(templateId, params);
  }
  const key = REGISTRY[problemId];
  if (!key) {
    throw new Error(`unknown problemId: ${problemId}`);
  }
  return key;
}

export const PROBLEM_IDS: string[] = Object.keys(REGISTRY);
