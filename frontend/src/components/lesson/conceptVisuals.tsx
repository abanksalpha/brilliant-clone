import type { ReactNode } from 'react';

// Shared, framework-free building blocks for rendering the formulas and summaries
// that lessons describe in prose, so the central equations are actually shown.

export function ConceptPlate({
  ariaLabel,
  children,
}: {
  ariaLabel: string;
  children: ReactNode;
}) {
  return (
    <section className="lesson-visual concept-plate" role="group" aria-label={ariaLabel}>
      {children}
    </section>
  );
}

export function Fraction({
  numerator,
  denominator,
}: {
  numerator: ReactNode;
  denominator: ReactNode;
}) {
  return (
    <span className="frac">
      <span className="frac-num">{numerator}</span>
      <span className="frac-den">{denominator}</span>
    </span>
  );
}

export function FormulaDisplay({ children }: { children: ReactNode }) {
  return <div className="formula-display">{children}</div>;
}

export function FormulaCaption({ children }: { children: ReactNode }) {
  return <p className="formula-caption">{children}</p>;
}

export function RuleList({
  rules,
}: {
  rules: Array<{ icon: ReactNode; term: string; detail: string }>;
}) {
  return (
    <ul className="rule-list">
      {rules.map((rule) => (
        <li key={rule.term}>
          <span aria-hidden="true" className="rule-icon">
            {rule.icon}
          </span>
          <span className="rule-copy">
            <strong>{rule.term}</strong>
            <span>{rule.detail}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
