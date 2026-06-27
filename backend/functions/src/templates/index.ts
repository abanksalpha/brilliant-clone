import { SeedTemplate, VariantParams } from '../types';
import { clCoulombForceTwoCharges } from './cl-coulomb-force-two-charges';
import { clCoulombForceCollinear } from './cl-coulomb-force-collinear';
import { clFieldPointCharge } from './cl-field-point-charge';
import { clMidpointFieldPotential } from './cl-midpoint-field-potential';
import { clTwoChargeSuperposition } from './cl-two-charge-superposition';

// Variant ids are versioned so the derivation rules can evolve without colliding
// with the existing static problem ids. Format:
//   v1:<templateId>:<k>=<v>;<k>=<v>;...
// with keys sorted ascending and numbers written as plain decimals.
const VARIANT_PREFIX = 'v1:';

const REGISTRY: Record<string, SeedTemplate> = {
  [clCoulombForceTwoCharges.templateId]: clCoulombForceTwoCharges,
  [clCoulombForceCollinear.templateId]: clCoulombForceCollinear,
  [clFieldPointCharge.templateId]: clFieldPointCharge,
  [clMidpointFieldPotential.templateId]: clMidpointFieldPotential,
  [clTwoChargeSuperposition.templateId]: clTwoChargeSuperposition,
};

export function getTemplate(templateId: string): SeedTemplate {
  const template = REGISTRY[templateId];
  if (!template) {
    throw new Error(`unknown template: ${templateId}`);
  }
  return template;
}

export const TEMPLATE_IDS: string[] = Object.keys(REGISTRY);

// Render one numeric parameter value as a plain decimal. Throws on a non-finite
// value rather than serializing something that cannot round trip.
function formatParamValue(value: number): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`cannot serialize a non-finite param value: ${value}`);
  }
  return String(value);
}

export function serializeVariantId(templateId: string, params: VariantParams): string {
  const pairs = Object.keys(params)
    .sort()
    .map((key) => `${key}=${formatParamValue(params[key])}`);
  return `${VARIANT_PREFIX}${templateId}:${pairs.join(';')}`;
}

export function parseVariantId(id: string): { templateId: string; params: VariantParams } {
  if (typeof id !== 'string' || !id.startsWith(VARIANT_PREFIX)) {
    throw new Error(`malformed variant id (missing ${VARIANT_PREFIX} prefix): ${id}`);
  }
  const rest = id.slice(VARIANT_PREFIX.length);
  const separator = rest.indexOf(':');
  if (separator === -1) {
    throw new Error(`malformed variant id (missing template separator): ${id}`);
  }
  const templateId = rest.slice(0, separator);
  const paramSection = rest.slice(separator + 1);
  if (templateId === '') {
    throw new Error(`malformed variant id (empty template id): ${id}`);
  }
  if (paramSection === '') {
    throw new Error(`malformed variant id (no params): ${id}`);
  }

  const params: VariantParams = {};
  for (const pair of paramSection.split(';')) {
    const eq = pair.indexOf('=');
    if (eq <= 0) {
      throw new Error(`malformed variant id (bad pair "${pair}"): ${id}`);
    }
    const key = pair.slice(0, eq);
    const rawValue = pair.slice(eq + 1);
    if (rawValue === '') {
      throw new Error(`malformed variant id (empty value for "${key}"): ${id}`);
    }
    const value = Number(rawValue);
    if (!Number.isFinite(value)) {
      throw new Error(`malformed variant id (non-numeric value for "${key}"): ${id}`);
    }
    params[key] = value;
  }

  return { templateId, params };
}
