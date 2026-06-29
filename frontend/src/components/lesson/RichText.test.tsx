import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MathText, RichText } from './RichText';

describe('RichText feedback rendering', () => {
  it('renders prose that begins with "Right." as a single paragraph', () => {
    const text = 'Right. Opposite signs attract, and the pull gets stronger as the gap shrinks.';
    const { container } = render(<RichText text={text} variant="feedback" />);

    // The whole sentence should stay together in one paragraph...
    const paragraph = screen.getByText(text);
    expect(paragraph.tagName).toBe('P');

    // ...and never be split into a bold "Right" label list.
    expect(container.querySelector('strong')).toBeNull();
    expect(container.querySelector('.rich-label-list')).toBeNull();
  });

  it('does not treat other position-word sentence starters as labels', () => {
    for (const text of [
      'Left of the midpoint the force flips direction.',
      'Center the test charge and the net force is zero.',
    ]) {
      const { container, unmount } = render(<RichText text={text} />);
      expect(screen.getByText(text).tagName).toBe('P');
      expect(container.querySelector('strong')).toBeNull();
      unmount();
    }
  });

  it('still renders a genuine "Label: text" block as a labeled list', () => {
    const { container } = render(
      <RichText text={'Left: the positive charge\nRight: the negative charge'} />,
    );

    const list = container.querySelector('.rich-label-list');
    expect(list).not.toBeNull();

    const labels = Array.from(container.querySelectorAll('strong')).map((node) => node.textContent);
    expect(labels).toEqual(['Left', 'Right']);
    expect(screen.getByText('the positive charge')).toBeInTheDocument();
    expect(screen.getByText('the negative charge')).toBeInTheDocument();
  });
});

describe('RichText fraction typesetting', () => {
  it('renders a "SYMBOL = NUM / DEN" block as a typeset fraction, not a code chip', () => {
    const { container } = render(<RichText text={'F = k q_1 q_2 / r^2'} />);

    expect(container.querySelector('.rich-equation--fraction')).not.toBeNull();
    expect(container.querySelector('.rich-equation-block')).toBeNull();
    // Subscripts/superscripts render as real <sub>/<sup> so the digits stay in the
    // equation font instead of Unicode glyphs that fall back to a different face.
    expect(container.querySelector('.eq-num')?.textContent).toBe('k q1 q2');
    expect(Array.from(container.querySelectorAll('.eq-num sub')).map((node) => node.textContent)).toEqual([
      '1',
      '2',
    ]);
    expect(container.querySelector('.eq-den')?.textContent).toBe('r2');
    expect(container.querySelector('.eq-den sup')?.textContent).toBe('2');
  });

  it('labels the fraction for assistive tech and hides the visual parts', () => {
    const { container } = render(<RichText text={'F = k q_1 q_2 / r^2'} />);

    const math = container.querySelector('[role="math"]');
    expect(math?.getAttribute('aria-label')).toBe('F equals k q1 q2 over r squared');
    expect(container.querySelector('.eq-frac')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('leaves a multi-step equation (two equals signs) as a formula chip', () => {
    const { container } = render(<RichText text={'F = q E / 2 = 5 N'} />);

    expect(container.querySelector('.rich-equation--fraction')).toBeNull();
    expect(container.querySelector('.rich-equation-block')).not.toBeNull();
  });

  it('does not turn a sentence that contains a slash into a fraction', () => {
    const text = 'Each sphere ends with (8.0 nC) / 2 of the total charge.';
    const { container } = render(<RichText text={text} />);

    expect(container.querySelector('.rich-equation--fraction')).toBeNull();
    expect(screen.getByText(text).tagName).toBe('P');
  });
});

describe('MathText inline typesetting', () => {
  it('typesets an exponent in prose with a real <sup>', () => {
    const { container } = render(<MathText text="Use k q / r^2 at the midpoint." />);
    expect(container.querySelector('sup')?.textContent).toBe('2');
    // textContent flattens the <sup>, so the caret markup is gone. The equation's
    // internal spaces are bound with non-breaking spaces, so normalize them back
    // to compare the visible text.
    expect(container.textContent?.replace(/\u00A0/g, ' ')).toBe('Use k q / r2 at the midpoint.');
  });

  it('typesets subscripts with real <sub>', () => {
    const { container } = render(<MathText text="F = k q_1 q_2 / r^2" />);
    expect(Array.from(container.querySelectorAll('sub')).map((n) => n.textContent)).toEqual(['1', '2']);
    expect(container.querySelector('sup')?.textContent).toBe('2');
  });

  it('typesets scientific notation as a power of ten', () => {
    const { container } = render(<MathText text="k = 8.99e9 N" />);
    expect(container.textContent).toContain('8.99×10');
    expect(container.querySelector('sup')?.textContent).toBe('9');
  });

  it('typesets the exponents in units like N m^2/C^2', () => {
    const { container } = render(<MathText text="8.99e9 N m^2/C^2" />);
    expect(Array.from(container.querySelectorAll('sup')).map((n) => n.textContent)).toEqual([
      '9',
      '2',
      '2',
    ]);
  });

  it('leaves ordinary prose untouched (no false equations)', () => {
    const text = 'The force gets stronger as the gap shrinks.';
    const { container } = render(<MathText text={text} />);
    expect(container.querySelector('sup')).toBeNull();
    expect(container.querySelector('sub')).toBeNull();
    expect(container.textContent).toBe(text);
  });
});

describe('MathText keeps inline equations from breaking mid-formula', () => {
  it('keeps the whole equation together so it never splits mid-formula', () => {
    const { container } = render(<MathText text="F = k q_1 q_2 / r^2" />);
    const txt = container.textContent ?? '';
    // The entire equation is bound with non-breaking spaces, so it wraps to the
    // next line as one unit rather than splitting after "=" or orphaning "/ r^2".
    expect(txt).not.toContain(' ');
    expect(txt).toContain('\u00A0/\u00A0');
  });

  it('keeps each number with its unit but lets a list of givens break at commas', () => {
    const { container } = render(<MathText text="k = 8.99e9 N, r = 0.10 m." />);
    const txt = container.textContent ?? '';
    // Number and unit stay together...
    expect(txt).toContain('0.10\u00A0m');
    // ...while the space after the comma stays a normal, breakable space.
    expect(txt).toContain(', r');
  });

  it('does not bind plain prose with non-breaking spaces', () => {
    const text = 'The force gets stronger as the gap shrinks.';
    const { container } = render(<MathText text={text} />);
    expect(container.textContent).not.toContain('\u00A0');
  });
});

describe('MathText typesets spelled-out symbols and richer exponents', () => {
  it('renders Greek names as glyphs', () => {
    const { container } = render(<MathText text="sigma over lambda gives Phi" />);
    const txt = container.textContent ?? '';
    expect(txt).toContain('σ');
    expect(txt).toContain('λ');
    expect(txt).toContain('Φ');
    expect(txt).not.toMatch(/sigma|lambda|Phi/);
  });

  it('turns "epsilon naught" into epsilon with a zero subscript', () => {
    const { container } = render(<MathText text="E = sigma / (2 epsilon naught)" />);
    const txt = container.textContent ?? '';
    expect(txt).not.toContain('naught');
    expect(txt).toContain('ε');
    expect(Array.from(container.querySelectorAll('sub')).map((n) => n.textContent)).toContain('0');
  });

  it('does not mangle ordinary words that contain a Greek name', () => {
    const text = 'A graphite rod must hold its charge.';
    const { container } = render(<MathText text={text} />);
    expect(container.textContent).toBe(text);
  });

  it('renders sqrt as a radical glyph and keeps the radicand', () => {
    const { container } = render(<MathText text="r = sqrt(k Q / E)" />);
    const txt = container.textContent ?? '';
    expect(txt).toContain('√(');
    expect(txt).not.toContain('sqrt');
  });

  it('renders a parenthesized fractional exponent as one superscript', () => {
    const { container } = render(<MathText text="E = k Q x / (x^2 + R^2)^(3/2)" />);
    const sups = Array.from(container.querySelectorAll('sup')).map((n) => n.textContent);
    expect(sups).toContain('3/2');
    expect(container.textContent).not.toContain('^');
  });

  it('renders a negative parenthesized exponent', () => {
    const { container } = render(<MathText text="field falls off as r^(-2) far away" />);
    const sups = Array.from(container.querySelectorAll('sup')).map((n) => n.textContent);
    expect(sups).toContain('-2');
  });

  it('renders word subscripts such as Q_enc', () => {
    const { container } = render(<MathText text="flux = Q_enc / epsilon_0" />);
    const subs = Array.from(container.querySelectorAll('sub')).map((n) => n.textContent);
    expect(subs).toContain('enc');
    expect(subs).toContain('0');
  });

  it('keeps scientific notation and signed exponents from wrapping mid-unit', () => {
    const { container } = render(<MathText text="charge 4.0e-8 C falls off as r^(-2)" />);
    const nowrap = Array.from(container.querySelectorAll('[style]')).filter((el) =>
      (el.getAttribute('style') ?? '').includes('nowrap'),
    );
    // the scientific-notation unit and the signed exponent are both protected
    expect(nowrap.length).toBeGreaterThanOrEqual(2);
    const sci = nowrap.find((el) => (el.textContent ?? '').includes('×10'));
    expect(sci?.textContent).toContain('4.0×10');
  });
});
