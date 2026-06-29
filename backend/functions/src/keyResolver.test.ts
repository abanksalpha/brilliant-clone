import { describe, it, expect, vi } from 'vitest';
import { resolveProblemKey, type SynthesisFetch } from './keyResolver';
import { getProblemKey } from './problemKeys';
import type { ProblemKey } from './types';

describe('resolveProblemKey', () => {
  it('resolves a syn: id through the injected fetch to that key', async () => {
    const synKey: ProblemKey = {
      problemId: 'syn:abc123',
      statement: 'A synthesized problem.',
      correctSolution: ['E = k q / r^2', 'F = q E'],
      finalAnswer: '6.74e3 N/C',
      rubric: 'Credit the field step and the force step.',
      flaws: [{ misconceptionId: 'inverse-square-error', signature: 'divides by r not r^2' }],
    };
    const fetchSynthesis: SynthesisFetch = vi.fn(async () => synKey);

    const resolved = await resolveProblemKey('syn:abc123', fetchSynthesis);

    expect(resolved).toEqual(synKey);
    expect(fetchSynthesis).toHaveBeenCalledWith('syn:abc123');
  });

  it('throws "unknown synthesis problem" when the fetch returns null', async () => {
    const fetchSynthesis: SynthesisFetch = vi.fn(async () => null);

    await expect(resolveProblemKey('syn:missing', fetchSynthesis)).rejects.toThrow(
      'unknown synthesis problem',
    );
  });

  it('resolves a static id without ever calling the synthesis fetch', async () => {
    const fetchSynthesis: SynthesisFetch = vi.fn(async () => null);

    const resolved = await resolveProblemKey('cl-field-point-charge', fetchSynthesis);

    expect(resolved).toEqual(getProblemKey('cl-field-point-charge'));
    expect(fetchSynthesis).not.toHaveBeenCalled();
  });

  it('throws on an unknown plain id', async () => {
    const fetchSynthesis: SynthesisFetch = vi.fn(async () => null);

    await expect(resolveProblemKey('does-not-exist', fetchSynthesis)).rejects.toThrow();
  });
});
