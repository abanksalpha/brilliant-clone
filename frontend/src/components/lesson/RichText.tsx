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

// Converts authoring shorthand ("r-squared", "epsilon-0", "4*pi") into the same
// clean notation the interactive scenes use, so equations read as real math.
function prettyMath(equation: string): string {
  return equation
    .replace(/-squared\b/gi, '²')
    .replace(/-cubed\b/gi, '³')
    .replace(/\^\(?(-?\d+)\)?/g, (_match, exponent: string) => toSuperscript(exponent))
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
      nodes.push(text.slice(cursor, headStart));
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
    nodes.push(text.slice(cursor));
  }

  if (nodes.length === 0) return text;
  return nodes.length === 1 ? nodes[0] : nodes;
}
