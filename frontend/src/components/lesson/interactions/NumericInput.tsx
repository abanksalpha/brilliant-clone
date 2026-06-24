import { useState, type FormEvent } from 'react';
import type { NumericConfig } from '../../../content';
import type { AnswerStatus } from '../FeedbackRenderer';

type NumericInputProps = {
  config: NumericConfig;
  disabled?: boolean;
  onResult: (status: AnswerStatus) => void;
};

const TRAILING_NOISE = /\s*(n|newtons?|units?|x|times)?$/i;

function normalize(raw: string): string {
  return raw.trim().replace(/,/g, '').replace(/\s+/g, '').toLowerCase();
}

/** Parse learner input into a number. Supports decimals, e-notation, and a/b fractions. */
export function parseNumericInput(raw: string): number | null {
  let value = raw.trim().replace(/,/g, '');
  value = value.replace(/^[=×x]\s*/i, '');
  value = value.replace(/\s*[×x]\s*10\s*\^\s*(-?\d+)/i, 'e$1');
  value = value.replace(TRAILING_NOISE, '').trim();

  if (value.length === 0) return null;

  if (value.includes('/')) {
    const [top, bottom] = value.split('/');
    const numerator = Number(top);
    const denominator = Number(bottom);
    if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
      return null;
    }
    return numerator / denominator;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function checkNumericAnswer(config: NumericConfig, raw: string): boolean {
  const normalized = normalize(raw);
  if (normalized.length === 0) return false;

  if (config.accepts?.some((form) => normalize(form) === normalized)) {
    return true;
  }

  const value = parseNumericInput(raw);
  if (value === null) return false;

  const absoluteTolerance = config.tolerance ?? 0;
  const relativeTolerance = config.relativeTolerance
    ? Math.abs(config.answer) * config.relativeTolerance
    : 0;
  const tolerance = Math.max(absoluteTolerance, relativeTolerance, 1e-9);

  return Math.abs(value - config.answer) <= tolerance;
}

export function NumericInput({ config, disabled = false, onResult }: NumericInputProps) {
  const [value, setValue] = useState('');

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (disabled || value.trim().length === 0) return;
    onResult(checkNumericAnswer(config, value) ? 'correct' : 'wrong');
  }

  return (
    <form className="cl1-numeric" onSubmit={handleSubmit}>
      <label className="cl1-numeric-field">
        <span className="sr-only">Your answer</span>
        <input
          aria-label="Your answer"
          className="cl1-numeric-input"
          disabled={disabled}
          inputMode="decimal"
          autoComplete="off"
          placeholder={config.placeholder ?? 'Type your answer'}
          type="text"
          value={value}
          onChange={(event) => setValue(event.currentTarget.value)}
        />
        {config.unit ? <span className="cl1-numeric-unit">{config.unit}</span> : null}
      </label>
      <button className="secondary-button" disabled={disabled || value.trim().length === 0} type="submit">
        Check answer
      </button>
    </form>
  );
}
