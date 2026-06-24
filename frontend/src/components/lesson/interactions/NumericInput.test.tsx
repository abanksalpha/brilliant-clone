import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { NumericConfig } from '../../../content';
import { NumericInput, checkNumericAnswer, parseNumericInput } from './NumericInput';

describe('parseNumericInput', () => {
  it('parses decimals and thousands separators', () => {
    expect(parseNumericInput('0.04')).toBeCloseTo(0.04, 10);
    expect(parseNumericInput('1,000')).toBe(1000);
  });

  it('parses simple fractions', () => {
    expect(parseNumericInput('1/25')).toBeCloseTo(0.04, 10);
    expect(parseNumericInput('1/0')).toBeNull();
  });

  it('parses scientific notation in several forms', () => {
    expect(parseNumericInput('9e9')).toBe(9e9);
    expect(parseNumericInput('9 x 10^9')).toBeCloseTo(9e9, 0);
    expect(parseNumericInput('9 × 10^9')).toBeCloseTo(9e9, 0);
  });

  it('strips leading operators and trailing unit noise', () => {
    expect(parseNumericInput('x6')).toBe(6);
    expect(parseNumericInput('6 times')).toBe(6);
    expect(parseNumericInput('150 N')).toBe(150);
  });

  it('returns null for empty or non-numeric input', () => {
    expect(parseNumericInput('')).toBeNull();
    expect(parseNumericInput('abc')).toBeNull();
  });
});

describe('checkNumericAnswer', () => {
  const fraction: NumericConfig = { answer: 0.04, tolerance: 0.005, accepts: ['1/25'] };

  it('accepts exact string forms', () => {
    expect(checkNumericAnswer(fraction, '1/25')).toBe(true);
  });

  it('accepts values within the absolute tolerance', () => {
    expect(checkNumericAnswer(fraction, '0.04')).toBe(true);
    expect(checkNumericAnswer(fraction, '0.042')).toBe(true);
    expect(checkNumericAnswer(fraction, '0.2')).toBe(false);
  });

  it('honors a relative tolerance for big magnitudes', () => {
    const big: NumericConfig = { answer: 8.99e9, relativeTolerance: 0.12 };
    expect(checkNumericAnswer(big, '9e9')).toBe(true);
    expect(checkNumericAnswer(big, '5e9')).toBe(false);
  });

  it('rejects empty input', () => {
    expect(checkNumericAnswer(fraction, '   ')).toBe(false);
  });
});

describe('NumericInput component', () => {
  const config: NumericConfig = { answer: 0.04, tolerance: 0.005, accepts: ['1/25'], unit: 'of F' };

  it('reports a correct result for an accepted fraction', async () => {
    const user = userEvent.setup();
    const onResult = vi.fn();
    render(<NumericInput config={config} onResult={onResult} />);

    await user.type(screen.getByRole('textbox', { name: 'Your answer' }), '1/25');
    await user.click(screen.getByRole('button', { name: 'Check answer' }));

    expect(onResult).toHaveBeenCalledWith('correct');
  });

  it('reports a wrong result for an out-of-tolerance value', async () => {
    const user = userEvent.setup();
    const onResult = vi.fn();
    render(<NumericInput config={config} onResult={onResult} />);

    await user.type(screen.getByRole('textbox', { name: 'Your answer' }), '0.5');
    await user.click(screen.getByRole('button', { name: 'Check answer' }));

    expect(onResult).toHaveBeenCalledWith('wrong');
  });

  it('keeps the submit button disabled until something is typed', () => {
    render(<NumericInput config={config} onResult={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Check answer' })).toBeDisabled();
  });
});
