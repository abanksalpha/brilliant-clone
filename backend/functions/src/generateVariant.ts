import { ProblemKey, VariantParams } from './types';
import { getTemplate, serializeVariantId } from './templates';

// Pure and deterministic: given a template id and a set of parameters, derive the
// full server side ProblemKey (statement, correct solution, final answer, rubric,
// and one signature per misconception). Throws on an unknown template, a missing
// or out-of-range parameter, or a parameter the template does not declare. Never
// clamps and never fabricates a key.
export function generateVariant(templateId: string, params: VariantParams): ProblemKey {
  const template = getTemplate(templateId);
  const specKeys = Object.keys(template.paramSpec);

  for (const key of Object.keys(params)) {
    if (!specKeys.includes(key)) {
      throw new Error(`unexpected param for template ${templateId}: ${key}`);
    }
  }

  for (const key of specKeys) {
    const value = params[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(`missing or non-numeric param for template ${templateId}: ${key}`);
    }
    const range = template.paramSpec[key];
    if (value < range.min || value > range.max) {
      throw new Error(
        `param ${key} for template ${templateId} is out of range [${range.min}, ${range.max}]: ${value}`,
      );
    }
  }

  const solved = template.solve(params);

  return {
    problemId: serializeVariantId(templateId, params),
    statement: template.renderStatement(params),
    correctSolution: solved.correctSolution,
    finalAnswer: solved.finalAnswer,
    rubric: template.rubric,
    flaws: template.flaws.map((flaw) => ({
      misconceptionId: flaw.misconceptionId,
      signature: flaw.buggyPath(params),
    })),
  };
}
