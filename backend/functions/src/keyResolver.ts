import { getProblemKey } from './problemKeys';
import type { ProblemKey } from './types';

export type SynthesisFetch = (problemId: string) => Promise<ProblemKey | null>;

// Resolve any problemId to its grading key. Static and v1: variant ids derive
// synchronously via getProblemKey; a syn: id is fetched through the injected
// boundary. A missing synthesis problem throws (no fallback).
export async function resolveProblemKey(problemId: string, fetchSynthesis: SynthesisFetch): Promise<ProblemKey> {
  if (problemId.startsWith('syn:')) {
    const key = await fetchSynthesis(problemId);
    if (!key) throw new Error('unknown synthesis problem: ' + problemId);
    return key;
  }
  return getProblemKey(problemId);
}
