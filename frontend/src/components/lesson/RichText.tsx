import type { ReactNode } from 'react';

type RichTextProps = {
  text: string;
  variant?: 'body' | 'visual' | 'feedback';
};

type TextBlock =
  | {
      kind: 'formula';
      lines: string[];
    }
  | {
      kind: 'fraction';
      lhs: string;
      num: string;
      den: string;
    }
  | {
      kind: 'labeled-list';
      items: Array<{
        label: string;
        text: string;
      }>;
    }
  | {
      kind: 'ordered-list';
      items: string[];
    }
  | {
      kind: 'paragraph';
      text: string;
    }
  | {
      kind: 'table';
      headers: string[];
      rows: string[][];
    };

const formulaPattern = /\bF\s*=/;

// Matches only the *head* of an inline equation ("F ="). The body is consumed
// separately by findEquationEnd so trailing prose is not swallowed.
const equationHeadPattern = /\bF\s*=/g;

const OPERATOR_CHARS = '=+-*/^';

// A raised exponent or scientific-notation power must never wrap onto the next
// line: "8.85e-12" -> "8.85×10⁻¹²" should stay one unit, and a compound exponent
// like (x²+R²)^(3/2) must not break at the slash inside the superscript.
const NOWRAP = { whiteSpace: 'nowrap' as const };

export function RichText({ text, variant = 'body' }: RichTextProps) {
  const blocks = parseRichText(text);

  return (
    <div className={`rich-text rich-text-${variant}`}>
      {blocks.map((block, index) => renderBlock(block, index))}
    </div>
  );
}

function parseRichText(text: string): TextBlock[] {
  return text
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map(parseBlock);
}

function parseBlock(block: string): TextBlock {
  const lines = block
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const table = parseTable(lines);
  if (table) return table;

  const orderedList = parseOrderedList(lines);
  if (orderedList) return orderedList;

  const labeledList = parseLabeledList(lines);
  if (labeledList) return labeledList;

  const fraction = parseFraction(lines);
  if (fraction) return fraction;

  if (isFormulaBlock(lines)) {
    return {
      kind: 'formula',
      lines,
    };
  }

  return {
    kind: 'paragraph',
    text: lines.join(' '),
  };
}

function renderBlock(block: TextBlock, index: number) {
  if (block.kind === 'table') {
    return (
      <div className="rich-table-wrap" key={index}>
        <table className="rich-table">
          <thead>
            <tr>
              {block.headers.map((header) => (
                <th key={header}>{renderInline(header)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, rowIndex) => (
              <tr key={`${row.join('-')}-${rowIndex}`}>
                {row.map((cell, cellIndex) => (
                  <td key={`${cell}-${cellIndex}`}>{renderInline(cell)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (block.kind === 'ordered-list') {
    return (
      <ol className="rich-list" key={index}>
        {block.items.map((item) => (
          <li key={item}>{renderInline(item)}</li>
        ))}
      </ol>
    );
  }

  if (block.kind === 'labeled-list') {
    return (
      <ul className="rich-list rich-label-list" key={index}>
        {block.items.map((item) => (
          <li key={`${item.label}-${item.text}`}>
            <strong>{item.label}</strong>
            {item.text ? <span>{renderInline(item.text)}</span> : null}
          </li>
        ))}
      </ul>
    );
  }

  if (block.kind === 'fraction') {
    return (
      <div className="rich-equation rich-equation--fraction" key={index}>
        <span className="eq" role="math" aria-label={speakFraction(block)}>
          <span className="eq-lhs" aria-hidden="true">
            {renderMath(block.lhs)}
          </span>
          <span className="eq-rel" aria-hidden="true">
            =
          </span>
          <span className="eq-frac" aria-hidden="true">
            <span className="eq-num">{renderMath(block.num)}</span>
            <span className="eq-den">{renderMath(block.den)}</span>
          </span>
        </span>
      </div>
    );
  }

  if (block.kind === 'formula') {
    return (
      <div className="rich-equation-block" key={index}>
        {block.lines.map((line) => (
          <code key={line}>{prettyMath(line)}</code>
        ))}
      </div>
    );
  }

  return <p key={index}>{renderInline(block.text)}</p>;
}

function parseTable(lines: string[]): TextBlock | null {
  if (lines.length < 3) return null;

  const separatorIndex = lines.findIndex(isTableSeparator);
  if (separatorIndex <= 0) return null;

  const headers = splitTableColumns(lines[separatorIndex - 1]);
  const rows = lines.slice(separatorIndex + 1).map(splitTableColumns);

  if (headers.length < 2 || rows.some((row) => row.length !== headers.length)) {
    return null;
  }

  return {
    kind: 'table',
    headers,
    rows,
  };
}

function parseOrderedList(lines: string[]): TextBlock | null {
  if (!lines.every((line) => /^\d+\.\s+/.test(line))) {
    return null;
  }

  return {
    kind: 'ordered-list',
    items: lines.map((line) => line.replace(/^\d+\.\s+/, '')),
  };
}

function parseLabeledList(lines: string[]): TextBlock | null {
  const items = lines.map((line) => {
    // Require the colon so a label list only triggers on real "Label: text"
    // syntax (used for diagram regions). Without it, ordinary prose that merely
    // begins with one of these words ("Right. Opposite signs attract...") would
    // be mis-rendered as a bold label on its own line.
    const match = line.match(/^(Left|Right|Center|Diagram [A-Z]|Pair \d+):\s*(.*)$/);

    if (!match) return null;

    return {
      label: match[1],
      text: match[2],
    };
  });

  if (items.some((item) => item === null)) {
    return null;
  }

  return {
    kind: 'labeled-list',
    items: items as Array<{ label: string; text: string }>,
  };
}

// A standalone single-line equation of the simple shape "SYMBOL = NUM / DEN"
// (exactly one '=' and one '/') renders as a real typeset fraction in the lesson
// hand font instead of a monospace chip. Anything more complex (extra '=', no
// fraction bar, a sentence) falls through to the existing formula/paragraph paths.
function parseFraction(lines: string[]): TextBlock | null {
  if (lines.length !== 1) return null;
  const sides = lines[0].split('=');
  if (sides.length !== 2) return null;
  const lhs = sides[0].trim();
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(lhs)) return null;
  const parts = sides[1].split('/');
  if (parts.length !== 2) return null;
  const num = parts[0].trim();
  const den = parts[1].trim();
  if (!num || !den) return null;
  return { kind: 'fraction', lhs, num, den };
}

// A spoken phrasing of the fraction for assistive tech, e.g. "F equals k q1 q2
// over r squared". The visual spans are aria-hidden so only this label is read.
function speakFraction(block: { lhs: string; num: string; den: string }): string {
  return `${speakMath(block.lhs)} equals ${speakMath(block.num)} over ${speakMath(block.den)}`;
}

function speakMath(value: string): string {
  return value
    .replace(/\^2\b/g, ' squared')
    .replace(/\^3\b/g, ' cubed')
    .replace(/\^\(?(-?\d+)\)?/g, ' to the power $1')
    .replace(/_\{?(-?\d+)\}?/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

// Spell-out Greek names, square roots, the multiplication dot, and "epsilon naught"
// become real symbols, so equations read the same everywhere (inline prose,
// fractions, and formula blocks). Greek names only convert as whole tokens, so an
// English word that happens to contain one (graphite, must) is never mangled.
const GREEK_SYMBOLS: Record<string, string> = {
  epsilon: 'ε',
  sigma: 'σ',
  lambda: 'λ',
  theta: 'θ',
  pi: 'π',
  phi: 'φ',
  Phi: 'Φ',
  rho: 'ρ',
  omega: 'ω',
  Omega: 'Ω',
};

function prettySymbols(text: string): string {
  return text
    .replace(/\s*\*\s*/g, '·')
    .replace(/\bepsilon[\s_-]*(?:naught|0)\b/gi, 'epsilon_0')
    .replace(/\bsqrt\s*\(/g, '√(')
    .replace(
      /(?<![A-Za-z])(epsilon|sigma|lambda|theta|pi|phi|Phi|rho|omega|Omega)(?![A-Za-z])/g,
      (name) => GREEK_SYMBOLS[name] ?? name,
    );
}

// Renders an equation fragment with real <sub>/<sup> elements so the digits stay
// in the equation's own font. The hand face has no Unicode subscript glyphs, so
// authoring "q_1" as the ₁ character would fall back to a different font; a plain
// "1" inside <sub> keeps the whole equation in one face.
function renderMath(value: string): ReactNode {
  const normalized = prettySymbols(value);
  const nodes: ReactNode[] = [];
  const pattern = /([_^])\{?([A-Za-z0-9-]+)\}?/g;
  let cursor = 0;
  let key = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(normalized)) !== null) {
    if (match.index > cursor) nodes.push(normalized.slice(cursor, match.index));
    nodes.push(
      match[1] === '_' ? (
        <sub key={key} style={NOWRAP}>
          {match[2]}
        </sub>
      ) : (
        <sup key={key} style={NOWRAP}>
          {match[2]}
        </sup>
      ),
    );
    key += 1;
    cursor = match.index + match[0].length;
  }
  if (cursor < normalized.length) nodes.push(normalized.slice(cursor));
  return nodes.length === 1 ? nodes[0] : nodes;
}

function isFormulaBlock(lines: string[]) {
  return (
    lines.length <= 4 &&
    lines.every((line) => formulaPattern.test(line) || line.startsWith('=') || /^\([^)]/.test(line)) &&
    lines.every((line) => line.length <= 120)
  );
}

function isTableSeparator(line: string) {
  return /^[-\s]+$/.test(line) && line.includes('-');
}

function splitTableColumns(line: string) {
  return line
    .trim()
    .split(/\s{2,}/)
    .map((cell) => cell.trim())
    .filter(Boolean);
}

const SUPERSCRIPTS: Record<string, string> = {
  '-': '⁻',
  '0': '⁰',
  '1': '¹',
  '2': '²',
  '3': '³',
  '4': '⁴',
  '5': '⁵',
  '6': '⁶',
  '7': '⁷',
  '8': '⁸',
  '9': '⁹',
};

function toSuperscript(value: string): string {
  return value.replace(/./g, (ch) => SUPERSCRIPTS[ch] ?? ch);
}

const SUBSCRIPTS: Record<string, string> = {
  '-': '₋',
  '0': '₀',
  '1': '₁',
  '2': '₂',
  '3': '₃',
  '4': '₄',
  '5': '₅',
  '6': '₆',
  '7': '₇',
  '8': '₈',
  '9': '₉',
};

function toSubscript(value: string): string {
  return value.replace(/./g, (ch) => SUBSCRIPTS[ch] ?? ch);
}

// Converts authoring shorthand ("r-squared", "epsilon-0", "4*pi") into the same
// clean notation the interactive scenes use, so equations read as real math.
function prettyMath(equation: string): string {
  return prettySymbols(equation)
    .replace(/-squared\b/gi, '²')
    .replace(/-cubed\b/gi, '³')
    .replace(/\^\(?(-?\d+)\)?/g, (_match, exponent: string) => toSuperscript(exponent))
    .replace(/_\{?(-?\d+)\}?/g, (_match, index: string) => toSubscript(index))
    .replace(/\bepsilon-0\b/gi, 'ε₀')
    .replace(/\bepsilon\b/gi, 'ε')
    .replace(/\bpi\b/gi, 'π')
    .replace(/\s*\*\s*/g, '·');
}

function isHardTerminator(ch: string): boolean {
  return ch === ',' || ch === ':' || ch === ';' || ch === '"' || ch === '\n';
}

// Walks an equation body starting just after "=". The body may contain spaces,
// but only when an operator bridges the gap (e.g. "E * A", "F / q", "V = U/q =
// kQ/r"). A space that drops into ordinary prose ("kQ/r-squared does not depend
// on angle") ends the equation, so prose is never pulled into the code chip.
function findEquationEnd(text: string, bodyStart: number): number {
  const n = text.length;
  let i = bodyStart;
  let end = bodyStart;
  let prevToken = '';
  let first = true;

  while (i < n) {
    const tokenStart = i;
    let stoppedAtTerminator = false;

    while (i < n) {
      const ch = text[i];
      if (ch === ' ' || ch === '\t') break;
      if (isHardTerminator(ch)) {
        stoppedAtTerminator = true;
        break;
      }
      if (ch === '.') {
        const prev = text[i - 1] ?? '';
        const next = text[i + 1] ?? '';
        const insideDecimal = prev >= '0' && prev <= '9' && next >= '0' && next <= '9';
        if (!insideDecimal) {
          stoppedAtTerminator = true;
          break;
        }
      }
      i += 1;
    }

    const token = text.slice(tokenStart, i);
    if (token.length > 0) {
      const bridged =
        OPERATOR_CHARS.includes(prevToken[prevToken.length - 1] ?? '') ||
        OPERATOR_CHARS.includes(token[0]);
      if (first || bridged) {
        end = i;
        prevToken = token;
        first = false;
      } else {
        break;
      }
    }

    if (stoppedAtTerminator) break;
    while (i < n && (text[i] === ' ' || text[i] === '\t')) i += 1;
  }

  return end;
}

// Inline math typesetting applied to ordinary prose so authored notation reads as
// real math: exponents (r^2 -> r squared), subscripts (q_1 -> q sub 1), scientific
// notation (8.99e9 -> 8.99 x 10^9), and the multiplication dot (a*b -> a.b). The
// ASCII syntax (^, _, digit-e-digit, *) does not occur in normal prose, so applying
// these globally never mis-reads a sentence as an equation. Digits ride in real
// <sub>/<sup> elements (not Unicode glyphs) so they keep the surrounding font; the
// hand faces have no dedicated sub/superscript glyphs.
const INLINE_MATH =
  /(?<![A-Za-z0-9.])(\d+(?:\.\d+)?)[eE](-?\d+)(?![A-Za-z0-9])|(?<=[\w)\]επθσλρφΦωΩ])\^\(([^)]+)\)|(?<=[\w)\]επθσλρφΦωΩ])\^(-?\d+)|(?<=[\w)\]επθσλρφΦωΩ])_\{?([A-Za-z0-9]+)\}?/gu;

// Characters that mark a space-separated token as part of a math expression: the
// relation/arithmetic operators, the fraction slash, grouping, the sub/superscript
// markers, and the multiplication dot.
const MATH_TOKEN_CHARS = '=/^_·×+-()[]√';

function mathCore(token: string): string {
  return token.replace(/^[(["']+/, '').replace(/[)\].,;:!?"']+$/, '');
}

// A single space-separated token that reads as math: a number, a one-character
// symbol or unit (F, k, r, m, N, C, ...), or anything carrying a math operator.
function isMathToken(token: string): boolean {
  const core = mathCore(token);
  if (core === '') return false;
  if (/\d/.test(core)) return true;
  if ([...core].some((ch) => MATH_TOKEN_CHARS.includes(ch))) return true;
  return /^[A-Za-zµμεπθσλρφΦωΩ]$/.test(core);
}

// Joins the spaces inside an inline equation with non-breaking spaces so the
// expression never line-breaks mid-formula: the whole equation stays on one line
// and wraps down to the next line as a single unit rather than splitting after
// "=" or orphaning "/ r^2". A token ending in a comma or semicolon still ends the
// run, so a comma-separated list of givens wraps between entries. Prose is
// untouched: a run only forms from two or more adjacent math tokens that together
// carry an operator or a digit.
function bindMathRuns(text: string): string {
  const parts = text.split(/(\s+)/).filter((part) => part.length > 0);
  const isSpace = (part: string) => /^\s+$/.test(part);
  let out = '';
  let i = 0;
  while (i < parts.length) {
    if (isSpace(parts[i]) || !isMathToken(parts[i])) {
      out += parts[i];
      i += 1;
      continue;
    }
    const words: string[] = [parts[i]];
    let j = i + 1;
    while (j + 1 < parts.length && isSpace(parts[j]) && isMathToken(parts[j + 1])) {
      words.push(parts[j + 1]);
      j += 2;
      if (/[,;]$/.test(words[words.length - 1])) break;
    }
    const joined = words.join(' ');
    const qualifies = words.length >= 2 && (/[=/^·×]/.test(joined) || /\d/.test(joined));
    if (qualifies) {
      out += words.join('\u00A0');
    } else {
      out += joined;
    }
    i = j;
  }
  return out;
}

export function typesetInline(text: string): ReactNode[] {
  const prepared = bindMathRuns(prettySymbols(text));

  const nodes: ReactNode[] = [];
  let cursor = 0;
  let key = 0;
  let match: RegExpExecArray | null;
  INLINE_MATH.lastIndex = 0;
  while ((match = INLINE_MATH.exec(prepared)) !== null) {
    if (match.index > cursor) nodes.push(prepared.slice(cursor, match.index));
    if (match[1] !== undefined) {
      nodes.push(
        <span key={key} style={NOWRAP}>
          {match[1]}×10<sup>{match[2]}</sup>
        </span>,
      );
    } else if (match[3] !== undefined) {
      nodes.push(
        <sup key={key} style={NOWRAP}>
          {match[3]}
        </sup>,
      );
    } else if (match[4] !== undefined) {
      nodes.push(
        <sup key={key} style={NOWRAP}>
          {match[4]}
        </sup>,
      );
    } else if (match[5] !== undefined) {
      nodes.push(
        <sub key={key} style={NOWRAP}>
          {match[5]}
        </sub>,
      );
    }
    key += 1;
    cursor = match.index + match[0].length;
  }
  if (cursor < prepared.length) nodes.push(prepared.slice(cursor));
  return nodes.length > 0 ? nodes : [prepared];
}

// Inline-only typesetting for short strings rendered outside RichText's block
// parser: problem statements, worked/completion steps, and givens. Same inline math
// rules. The output is wrapped in a single inline <span> so the text and its
// <sub>/<sup> nodes stay one inline run: several of these hosts are flex containers
// (e.g. .worked-example__step), where a bare fragment would turn each node into a
// separate flex item and scatter the sub/superscripts across the row.
export function MathText({ text }: { text: string }) {
  return <span className="math-text">{typesetInline(text)}</span>;
}

function renderInline(text: string): ReactNode {
  equationHeadPattern.lastIndex = 0;
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let key = 0;
  let match: RegExpExecArray | null;

  while ((match = equationHeadPattern.exec(text)) !== null) {
    const headStart = match.index;
    const headEnd = headStart + match[0].length;

    let bodyStart = headEnd;
    while (bodyStart < text.length && (text[bodyStart] === ' ' || text[bodyStart] === '\t')) {
      bodyStart += 1;
    }

    const eqEnd = findEquationEnd(text, bodyStart);
    if (eqEnd <= bodyStart) {
      equationHeadPattern.lastIndex = headEnd;
      continue;
    }

    if (headStart > cursor) {
      nodes.push(...typesetInline(text.slice(cursor, headStart)));
    }
    nodes.push(
      <code className="rich-inline-equation" key={`eq-${key}`}>
        {prettyMath(text.slice(headStart, eqEnd))}
      </code>,
    );
    key += 1;
    cursor = eqEnd;
    equationHeadPattern.lastIndex = eqEnd;
  }

  if (cursor < text.length) {
    nodes.push(...typesetInline(text.slice(cursor)));
  }

  if (nodes.length === 0) return text;
  return nodes.length === 1 ? nodes[0] : nodes;
}
