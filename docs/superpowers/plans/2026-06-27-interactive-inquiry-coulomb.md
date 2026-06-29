# Interactive Inquiry (Coulomb) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Coulomb lesson's text-box inquiry with an interactive, two-screen pretest: free-form charge boxes where the student predicts, then sees the truth, before the Learn phase explains it.

**Architecture:** Phase 2 (Inquiry) gains an optional ordered list of `screens` on the lesson's `inquiry`. When present, `InquiryPrompt` renders a multi-screen pretest flow instead of the legacy capture UI. Each screen is one constrained two-charge box (charge box: positions fixed, charges cycle through -3..3; distance box: charges fixed, one charge moves) showing equal-and-opposite Coulomb vectors at a fixed faithful scale, run as predict -> reveal -> explore. Charging and Electric Field keep their existing text inquiry untouched (the new field is optional). No backend and no AI in this version.

**Tech Stack:** React 19, TypeScript, Vite, SVG, Vitest + Testing Library + jsdom. Reuse `scenes/primitives.tsx` (`Charge`, `Arrow`, `DragHandle`, `usePointerDrag`, `clamp`) and the pure `physics.ts`. Reuse existing CSS: `.cl1-experience`, `.cl1-stage`, `.cl1-rail`, `.charge-circle`, `.charge-sign`, `.force-arrow`, `.lesson-visual-readouts`.

## Global Constraints

- No em dashes or en dashes anywhere in authored copy; use commas, periods, or parentheses. `validateLessonModule` already enforces this on inquiry text, and the new `revealCaption`/`note`/`prompt` must be included in that check.
- Scope is Coulomb's Law only. The new `screens` field is OPTIONAL; do not modify the `charging-conductors-insulators` or `electric-field-field-lines` inquiry content.
- Pretest order is fixed: the student commits a guess BEFORE the answer is shown; the correct outcome is revealed immediately after the guess; the conceptual explanation stays in the Learn phase (do not turn Learn into a recap).
- No multiple choice. The prediction is a dragged ghost arrow (a continuous magnitude), not a list of options.
- Charge magnitude is shown by the NUMBER of `+` or `-` glyphs, never by changing the circle radius. Neutral (0) shows `0`.
- Always show the equal-and-opposite force vector on BOTH charges.
- Arrows use one fixed force-to-pixel scale per box (computed from the box's strongest reachable force) so relative magnitudes are honest (doubling distance visibly quarters the arrow).
- Low stakes: nothing is graded, a wrong guess is expected, and Continue is always reachable.
- No backend changes. No OpenAI calls. No new Cloud Functions.

---

## File Structure

- `frontend/src/components/lesson/physics.ts` (modify): add `forceVectorsForPair` and `scaleForceToPixels` pure helpers.
- `frontend/src/components/lesson/physics.test.ts` (modify): tests for the two helpers.
- `frontend/src/components/lesson/scenes/primitives.tsx` (modify): `Charge` renders a glyph count, no radius change.
- `frontend/src/components/lesson/scenes/primitives.test.tsx` (create): `Charge` glyph test.
- `frontend/src/content/schema.ts` (modify): `InquiryScreen` type, optional `InquiryPrompt.screens`, validation.
- `frontend/src/content/content.test.ts` (modify): screen validation tests.
- `frontend/src/components/lesson/interactions/TwoChargeField.tsx` (create): presentational SVG scene (two charges + two vectors + optional ghost + drag/cycle hooks).
- `frontend/src/components/lesson/interactions/InquiryScene.tsx` (create): one screen's predict -> reveal -> explore controller.
- `frontend/src/components/lesson/interactions/InquiryScene.test.tsx` (create): controller behavior tests.
- `frontend/src/components/lesson/InquiryPrompt.tsx` (modify): branch to the screens flow; walk screens; report index.
- `frontend/src/components/lesson/InquiryPrompt.test.tsx` (modify): multi-screen flow test.
- `frontend/src/content/modules/coulombs-law.ts` (modify): author the two screens.
- `frontend/src/components/lesson/LessonSession.tsx` (modify): Inquiry phase sub-steps, within-step, resume wiring.
- `frontend/src/components/lesson/LessonSession.test.tsx` (modify): PhaseBar sub-steps + resume.
- `frontend/src/styles.css` (modify): dashed ghost arrow, reveal caption, multi-glyph spacing.

---

## Task 1: Pure physics helpers

**Files:**
- Modify: `frontend/src/components/lesson/physics.ts`
- Test: `frontend/src/components/lesson/physics.test.ts`

**Interfaces:**
- Consumes: existing `Vec2`, `PointCharge`, `forceOnCharge`, `magnitude`.
- Produces:
  - `type ForcePair = { onLeft: Vec2; onRight: Vec2 }`
  - `forceVectorsForPair(left: PointCharge, right: PointCharge, k?: number): ForcePair`
  - `scaleForceToPixels(magnitude: number, pxPerUnit: number, maxPx: number): number`

- [ ] **Step 1: Write the failing test**

Append to `frontend/src/components/lesson/physics.test.ts`:

```ts
import { forceVectorsForPair, scaleForceToPixels } from './physics';

describe('forceVectorsForPair', () => {
  it('is equal and opposite for two charges', () => {
    const { onLeft, onRight } = forceVectorsForPair({ x: 0, y: 0, q: 1 }, { x: 2, y: 0, q: 1 });
    expect(onLeft.x).toBeCloseTo(-onRight.x, 10);
    expect(onLeft.y).toBeCloseTo(-onRight.y, 10);
    // like charges repel: left is pushed in -x, right in +x
    expect(onLeft.x).toBeLessThan(0);
    expect(onRight.x).toBeGreaterThan(0);
  });

  it('is zero when either charge is zero', () => {
    const { onLeft, onRight } = forceVectorsForPair({ x: 0, y: 0, q: 0 }, { x: 2, y: 0, q: 3 });
    expect(onLeft).toEqual({ x: 0, y: 0 });
    expect(onRight).toEqual({ x: 0, y: 0 });
  });
});

describe('scaleForceToPixels', () => {
  it('scales linearly and clamps at maxPx', () => {
    expect(scaleForceToPixels(0.5, 100, 90)).toBeCloseTo(50, 10);
    expect(scaleForceToPixels(2, 100, 90)).toBe(90);
    expect(scaleForceToPixels(0, 100, 90)).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/lesson/physics.test.ts`
Expected: FAIL with "forceVectorsForPair is not a function" / "scaleForceToPixels is not a function".

- [ ] **Step 3: Write minimal implementation**

Append to `frontend/src/components/lesson/physics.ts`:

```ts
export type ForcePair = { onLeft: Vec2; onRight: Vec2 };

/** Equal-and-opposite Coulomb forces on a pair of point charges (k = 1 scene units). */
export function forceVectorsForPair(left: PointCharge, right: PointCharge, k = 1): ForcePair {
  return {
    onLeft: forceOnCharge(left, right, k),
    onRight: forceOnCharge(right, left, k),
  };
}

/** Map a force magnitude to an on-screen arrow length in pixels at a fixed scale. */
export function scaleForceToPixels(forceMagnitude: number, pxPerUnit: number, maxPx: number): number {
  if (!Number.isFinite(forceMagnitude) || forceMagnitude <= 0) return 0;
  return Math.min(forceMagnitude * pxPerUnit, maxPx);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/components/lesson/physics.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/lesson/physics.ts frontend/src/components/lesson/physics.test.ts
git commit -m "feat(inquiry): add pair-force and force-to-pixel physics helpers"
```

---

## Task 2: Charge primitive renders a glyph count

**Files:**
- Modify: `frontend/src/components/lesson/scenes/primitives.tsx:12-44`
- Test: `frontend/src/components/lesson/scenes/primitives.test.tsx`

**Interfaces:**
- Produces: `Charge` gains optional `count?: number` (default 1). Renders `count` repeated sign glyphs (capped at 3), `0` when neutral. Circle radius is unchanged by `count`.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/components/lesson/scenes/primitives.test.tsx`:

```tsx
import { render } from '@testing-library/react';
import { Charge, CHARGE_R } from './primitives';

function svg(child: React.ReactNode) {
  return render(<svg>{child}</svg>);
}

describe('Charge', () => {
  it('renders one glyph by default and three when count is 3', () => {
    const { getByText, rerender } = svg(<Charge x={10} y={10} sign="+" />);
    expect(getByText('+')).toBeInTheDocument();
    rerender(<svg><Charge x={10} y={10} sign="+" count={3} /></svg>);
    expect(getByText('+++')).toBeInTheDocument();
  });

  it('shows 0 for neutral', () => {
    const { getByText } = svg(<Charge x={10} y={10} sign="neutral" />);
    expect(getByText('0')).toBeInTheDocument();
  });

  it('does not change the circle radius with count', () => {
    const { container } = svg(<Charge x={10} y={10} sign="-" count={3} />);
    const circle = container.querySelector('circle.charge-circle');
    expect(circle?.getAttribute('r')).toBe(String(CHARGE_R));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/lesson/scenes/primitives.test.tsx`
Expected: FAIL (count prop ignored: `+++` not found).

- [ ] **Step 3: Write minimal implementation**

Replace the `Charge` function in `frontend/src/components/lesson/scenes/primitives.tsx` with:

```tsx
export function Charge({
  x,
  y,
  sign,
  count = 1,
  r = CHARGE_R,
  muted = false,
}: {
  x: number;
  y: number;
  sign: '+' | '-' | 'neutral';
  count?: number;
  r?: number;
  muted?: boolean;
}) {
  const tone = sign === '+' ? 'positive' : sign === '-' ? 'negative' : 'neutral';
  const glyphCount = Math.max(1, Math.min(3, Math.round(count)));
  const label = sign === 'neutral' ? '0' : sign.repeat(glyphCount);
  // Keep the circle a fixed size; shrink the type a little when several glyphs share it.
  const fontSize = label.length > 1 ? Math.max(11, Math.round(r * 0.6)) : Math.max(14, Math.round(r * 0.9));
  const dy = sign === '-' ? '0.02em' : '0.03em';
  return (
    <g opacity={muted ? 0.45 : 1}>
      <circle className={`charge-circle charge-circle-${tone}`} cx={x} cy={y} r={r} />
      <text
        className="charge-sign cl1-charge-sign"
        dy={dy}
        style={{ fontSize: `${fontSize}px` }}
        textAnchor="middle"
        x={x}
        y={y}
      >
        {label}
      </text>
    </g>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/components/lesson/scenes/primitives.test.tsx`
Expected: PASS. Also run `npx vitest run src/components/lesson/interactions/ChargeSandbox.test.tsx` to confirm the default (single glyph) caller is unaffected.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/lesson/scenes/primitives.tsx frontend/src/components/lesson/scenes/primitives.test.tsx
git commit -m "feat(inquiry): render charge magnitude as glyph count, not circle size"
```

---

## Task 3: Schema for inquiry screens

**Files:**
- Modify: `frontend/src/content/schema.ts`
- Test: `frontend/src/content/content.test.ts`

**Interfaces:**
- Produces:
  - `type InquiryChargeId = 'left' | 'right'`
  - `type InquiryScreen` (see code).
  - `InquiryPrompt` gains optional `screens?: InquiryScreen[]`.
  - `validateLessonModule` validates screens when present and includes their copy in the em-dash scan.

- [ ] **Step 1: Write the failing test**

Append to `frontend/src/content/content.test.ts`:

```ts
import { validateLessonModule, type LessonModule } from './schema';

function baseModule(): LessonModule {
  return {
    lessonId: 'x', lessonNumber: 1, title: 'X', prerequisites: [], reviewSkillIds: [],
    inquiry: { question: 'q', capture: 'text', resolvedBy: 'idea' },
    explanationSlides: [{ heading: 'h', body: 'mentions idea here' }],
    workedSequence: [], independentProblemIds: [],
  };
}

describe('validateLessonModule inquiry screens', () => {
  it('rejects a screen with an empty reveal caption', () => {
    const m = baseModule();
    m.inquiry.screens = [{
      id: 's', variable: 'charge', mode: 'cycle', prompt: 'Predict the force.',
      left: { id: 'left', x: 3, y: 3, q: 1 }, right: { id: 'right', x: 7, y: 3, q: 1 },
      target: { apply: 'set-charge', chargeId: 'right', toQ: 3 }, revealCaption: '',
    }];
    expect(validateLessonModule(m)).toContain('inquiry screen s is missing revealCaption');
  });

  it('rejects an em dash in a screen caption', () => {
    const m = baseModule();
    m.inquiry.screens = [{
      id: 's', variable: 'charge', mode: 'cycle', prompt: 'Predict the force.',
      left: { id: 'left', x: 3, y: 3, q: 1 }, right: { id: 'right', x: 7, y: 3, q: 1 },
      target: { apply: 'set-charge', chargeId: 'right', toQ: 3 },
      revealCaption: 'Triple the charge \u2014 triple the force.',
    }];
    expect(validateLessonModule(m)).toContain('module contains an em dash');
  });

  it('accepts a well-formed screen', () => {
    const m = baseModule();
    m.inquiry.screens = [{
      id: 's', variable: 'charge', mode: 'cycle', prompt: 'Predict the force.',
      left: { id: 'left', x: 3, y: 3, q: 1 }, right: { id: 'right', x: 7, y: 3, q: 1 },
      target: { apply: 'set-charge', chargeId: 'right', toQ: 3 },
      revealCaption: 'Triple the charge, triple the force.',
    }];
    expect(validateLessonModule(m)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/content/content.test.ts`
Expected: FAIL (`screens` not a known property / validation messages missing).

- [ ] **Step 3: Write minimal implementation**

In `frontend/src/content/schema.ts`, add after the `InquiryPrompt` type:

```ts
export type InquiryChargeId = 'left' | 'right';

// One constrained two-charge box. 'cycle' fixes positions and lets the learner
// change charge values; 'move' fixes charges and lets one charge slide. `target`
// is the change applied at reveal (and the thing the learner predicts first).
export type InquiryScreen = {
  id: string;
  variable: 'charge' | 'distance';
  mode: 'cycle' | 'move';
  prompt: string;
  left: SandboxCharge;
  right: SandboxCharge;
  target:
    | { apply: 'set-charge'; chargeId: InquiryChargeId; toQ: number }
    | { apply: 'set-distance'; toDistanceFactor: number };
  revealCaption: string;
  note?: string;
};
```

Add `screens?: InquiryScreen[];` to the `InquiryPrompt` type (after `resolvedBy`).

Then extend `validateLessonModule`. Inside it, before the `const strings = [...]` block, add:

```ts
  for (const screen of module.inquiry.screens ?? []) {
    if (!screen.prompt.trim()) errors.push(`inquiry screen ${screen.id} is missing prompt`);
    if (!screen.revealCaption.trim()) errors.push(`inquiry screen ${screen.id} is missing revealCaption`);
  }
```

And include screen copy in the existing em-dash scan by extending the `strings` array with:

```ts
    ...(module.inquiry.screens ?? []).flatMap((s) => [s.prompt, s.revealCaption, s.note ?? '']),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/content/content.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/content/schema.ts frontend/src/content/content.test.ts
git commit -m "feat(inquiry): add optional InquiryScreen schema with validation"
```

---

## Task 4: TwoChargeField presentational scene

**Files:**
- Create: `frontend/src/components/lesson/interactions/TwoChargeField.tsx`
- Test: covered by Task 5's controller test (this component has no own state).

**Interfaces:**
- Consumes: `forceVectorsForPair`, `magnitude`, `scaleForceToPixels` (Task 1); `Charge`, `Arrow`, `DragHandle`, `usePointerDrag`, `clamp`, `VIEW` (primitives).
- Produces:
  - `type FieldCharge = { id: 'left' | 'right'; x: number; y: number; q: number }`
  - `type Ghost = { px: number } | null`
  - `TwoChargeField` component with props:
    ```ts
    {
      left: FieldCharge; right: FieldCharge;
      sceneWidth: number; sceneHeight: number;
      pxPerUnit: number; maxArrowPx: number;
      ghost: Ghost;
      onPredictPx?: (px: number) => void;   // predict stage: drag sets ghost length
      onCycle?: (id: 'left' | 'right') => void;  // explore stage, cycle mode
      onMove?: (id: 'left' | 'right', xUnits: number) => void; // explore stage, move mode
      movableId?: 'left' | 'right';
    }
    ```

- [ ] **Step 1: Write the implementation (no standalone test; exercised in Task 5)**

Create `frontend/src/components/lesson/interactions/TwoChargeField.tsx`:

```tsx
import { type KeyboardEvent } from 'react';
import { forceVectorsForPair, magnitude, scaleForceToPixels, type PointCharge, type Vec2 } from '../physics';
import { Arrow, Charge, DragHandle, VIEW, clamp, usePointerDrag } from '../scenes/primitives';

export type FieldCharge = { id: 'left' | 'right'; x: number; y: number; q: number };
export type Ghost = { px: number } | null;

const PAD = 40;

function signOf(q: number): '+' | '-' | 'neutral' {
  if (q > 0) return '+';
  if (q < 0) return '-';
  return 'neutral';
}

export function TwoChargeField({
  left,
  right,
  sceneWidth,
  sceneHeight,
  pxPerUnit,
  maxArrowPx,
  ghost,
  onPredictPx,
  onCycle,
  onMove,
  movableId,
}: {
  left: FieldCharge;
  right: FieldCharge;
  sceneWidth: number;
  sceneHeight: number;
  pxPerUnit: number;
  maxArrowPx: number;
  ghost: Ghost;
  onPredictPx?: (px: number) => void;
  onCycle?: (id: 'left' | 'right') => void;
  onMove?: (id: 'left' | 'right', xUnits: number) => void;
  movableId?: 'left' | 'right';
}) {
  const scale = Math.min((VIEW.w - 2 * PAD) / sceneWidth, (VIEW.h - 2 * PAD) / sceneHeight);
  const offsetX = (VIEW.w - sceneWidth * scale) / 2;
  const offsetY = (VIEW.h - sceneHeight * scale) / 2;
  const toScreen = (lx: number, ly: number) => ({ x: offsetX + lx * scale, y: offsetY + ly * scale });

  const forces = forceVectorsForPair(toPC(left), toPC(right));
  const ls = toScreen(left.x, left.y);
  const rs = toScreen(right.x, right.y);

  const drawForce = (origin: { x: number; y: number }, f: Vec2) => {
    const mag = magnitude(f);
    const px = scaleForceToPixels(mag, pxPerUnit, maxArrowPx);
    if (px <= 0) return null;
    const end = { x: origin.x + (f.x / mag) * px, y: origin.y + (f.y / mag) * px };
    return <Arrow x1={origin.x} y1={origin.y} x2={end.x} y2={end.y} tone="net" />;
  };

  // Predict drag: a dashed horizontal ghost arrow off the left charge whose length
  // is the learner's guess. Pure horizontal so it is a single magnitude they set.
  const predictDrag = usePointerDrag(
    (point) => onPredictPx?.(clamp(point.x - ls.x, 0, maxArrowPx)),
    () => ({ x: ls.x + (ghost?.px ?? 0), y: ls.y }),
  );

  const moveDrag = usePointerDrag(
    (point) => onMove?.(movableId ?? 'right', clamp((point.x - offsetX) / scale, 1, sceneWidth - 1)),
    () => (movableId === 'left' ? ls : rs),
  );

  const onCycleKey = (id: 'left' | 'right') => (e: KeyboardEvent<SVGGElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onCycle?.(id);
    }
  };

  return (
    <div className="cl1-figure" data-testid="two-charge-field">
      <svg viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} preserveAspectRatio="xMidYMid meet">
        {drawForce(ls, forces.onLeft)}
        {drawForce(rs, forces.onRight)}

        {ghost ? (
          <line
            className="inquiry-ghost-arrow"
            data-testid="ghost-arrow"
            x1={ls.x}
            y1={ls.y - 22}
            x2={ls.x + ghost.px}
            y2={ls.y - 22}
          />
        ) : null}

        {renderCharge(left, ls, 'left')}
        {renderCharge(right, rs, 'right')}

        {onPredictPx ? (
          <DragHandle
            drag={predictDrag}
            label="Your predicted force"
            min={0}
            max={Math.round(maxArrowPx)}
            value={Math.round(ghost?.px ?? 0)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight') onPredictPx(clamp((ghost?.px ?? 0) + 6, 0, maxArrowPx));
              if (e.key === 'ArrowLeft') onPredictPx(clamp((ghost?.px ?? 0) - 6, 0, maxArrowPx));
            }}
            testId="predict-handle"
            x={ls.x + (ghost?.px ?? 0)}
            y={ls.y - 22}
          >
            <circle className="pot-hit-target" cx={ls.x + (ghost?.px ?? 0)} cy={ls.y - 22} r={9} />
          </DragHandle>
        ) : null}
      </svg>
    </div>
  );

  function renderCharge(c: FieldCharge, s: { x: number; y: number }, id: 'left' | 'right') {
    const node = <Charge x={s.x} y={s.y} sign={signOf(c.q)} count={Math.abs(c.q)} />;
    if (onCycle) {
      return (
        <g
          key={id}
          role="button"
          tabIndex={0}
          aria-label={`Cycle ${id} charge`}
          data-testid={`cycle-${id}`}
          onClick={() => onCycle(id)}
          onKeyDown={onCycleKey(id)}
          style={{ cursor: 'pointer' }}
        >
          {node}
        </g>
      );
    }
    if (onMove && movableId === id) {
      return (
        <DragHandle
          key={id}
          drag={moveDrag}
          label={`Move ${id} charge`}
          min={1}
          max={Math.round(sceneWidth - 1)}
          value={Math.round(c.x)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') onMove(id, clamp(c.x + 0.25, 1, sceneWidth - 1));
            if (e.key === 'ArrowLeft') onMove(id, clamp(c.x - 0.25, 1, sceneWidth - 1));
          }}
          testId={`move-${id}`}
          x={s.x}
          y={s.y}
        >
          {node}
        </DragHandle>
      );
    }
    return <g key={id}>{node}</g>;
  }
}

function toPC(c: FieldCharge): PointCharge {
  return { x: c.x, y: c.y, q: c.q };
}
```

- [ ] **Step 2: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors from this file.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/lesson/interactions/TwoChargeField.tsx
git commit -m "feat(inquiry): add TwoChargeField scene with equal-and-opposite vectors"
```

---

## Task 5: InquiryScene controller (predict -> reveal -> explore)

**Files:**
- Create: `frontend/src/components/lesson/interactions/InquiryScene.tsx`
- Test: `frontend/src/components/lesson/interactions/InquiryScene.test.tsx`

**Interfaces:**
- Consumes: `InquiryScreen` (schema), `TwoChargeField`/`FieldCharge` (Task 4), `clamp` (primitives), `coulombForceMagnitude` (physics).
- Produces: `InquiryScene({ screen, onComplete }: { screen: InquiryScreen; onComplete: () => void })`.
- Behavior: stage starts `predict` (Reveal button, drag sets ghost, controls disabled). After Reveal: applies `target`, shows true vectors, shows `revealCaption`, enables cycle/move, shows Continue which calls `onComplete`.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/components/lesson/interactions/InquiryScene.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { InquiryScene } from './InquiryScene';
import type { InquiryScreen } from '../../content/schema';

const chargeScreen: InquiryScreen = {
  id: 'charge', variable: 'charge', mode: 'cycle', prompt: 'Predict the force when the right charge triples.',
  left: { id: 'left', x: 3, y: 3, q: 1 }, right: { id: 'right', x: 7, y: 3, q: 1 },
  target: { apply: 'set-charge', chargeId: 'right', toQ: 3 },
  revealCaption: 'Triple the charge, triple the force.',
};

describe('InquiryScene', () => {
  it('hides the caption until reveal, then shows it and a Continue', () => {
    const onComplete = vi.fn();
    render(<InquiryScene screen={chargeScreen} onComplete={onComplete} />);
    expect(screen.queryByText('Triple the charge, triple the force.')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /reveal/i }));
    expect(screen.getByText('Triple the charge, triple the force.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('only allows cycling after reveal in a cycle screen', () => {
    render(<InquiryScene screen={chargeScreen} onComplete={() => {}} />);
    expect(screen.queryByTestId('cycle-left')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /reveal/i }));
    expect(screen.getByTestId('cycle-left')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/lesson/interactions/InquiryScene.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 3: Write minimal implementation**

Create `frontend/src/components/lesson/interactions/InquiryScene.tsx`:

```tsx
import { useMemo, useState } from 'react';
import type { InquiryScreen } from '../../content/schema';
import { coulombForceMagnitude } from '../physics';
import { clamp } from '../scenes/primitives';
import { TwoChargeField, type FieldCharge } from './TwoChargeField';

const SCENE = { w: 10, h: 6 };
const MAX_ARROW_PX = 92;
const CYCLE = [-3, -2, -1, 0, 1, 2, 3];
const MIN_SEP = 2;

type Stage = 'predict' | 'revealed';

function nextInCycle(q: number): number {
  const i = CYCLE.indexOf(q);
  return CYCLE[(i + 1) % CYCLE.length] ?? 0;
}

// One fixed force-to-pixel scale per box, taken from the strongest force the box
// can reach, so every arrow in the box is honest relative to the others.
function pxPerUnitFor(screen: InquiryScreen): number {
  const r0 = Math.abs(screen.right.x - screen.left.x) || MIN_SEP;
  let maxForce: number;
  if (screen.mode === 'cycle') {
    maxForce = coulombForceMagnitude(3, 3, r0);
  } else {
    const qL = Math.abs(screen.left.q) || 1;
    const qR = Math.abs(screen.right.q) || 1;
    maxForce = coulombForceMagnitude(qL, qR, MIN_SEP);
  }
  return maxForce > 0 ? (MAX_ARROW_PX * 0.95) / maxForce : 1;
}

export function InquiryScene({ screen, onComplete }: { screen: InquiryScreen; onComplete: () => void }) {
  const [stage, setStage] = useState<Stage>('predict');
  const [left, setLeft] = useState<FieldCharge>({ id: 'left', x: screen.left.x, y: screen.left.y, q: screen.left.q });
  const [right, setRight] = useState<FieldCharge>({ id: 'right', x: screen.right.x, y: screen.right.y, q: screen.right.q });
  const [ghostPx, setGhostPx] = useState(0);

  const pxPerUnit = useMemo(() => pxPerUnitFor(screen), [screen]);
  const movableId: 'left' | 'right' = 'right';

  function reveal() {
    if (screen.target.apply === 'set-charge') {
      const setter = screen.target.chargeId === 'left' ? setLeft : setRight;
      setter((c) => ({ ...c, q: screen.target.apply === 'set-charge' ? screen.target.toQ : c.q }));
    } else {
      const factor = screen.target.toDistanceFactor;
      setRight((c) => ({ ...c, x: clamp(screen.left.x + (screen.right.x - screen.left.x) * factor, screen.left.x + MIN_SEP, SCENE.w - 1) }));
    }
    setStage('revealed');
  }

  function cycle(id: 'left' | 'right') {
    const setter = id === 'left' ? setLeft : setRight;
    setter((c) => ({ ...c, q: nextInCycle(c.q) }));
  }

  function move(id: 'left' | 'right', xUnits: number) {
    const setter = id === 'left' ? setLeft : setRight;
    const minX = id === 'right' ? left.x + MIN_SEP : 1;
    const maxX = id === 'right' ? SCENE.w - 1 : right.x - MIN_SEP;
    setter((c) => ({ ...c, x: clamp(xUnits, minX, maxX) }));
  }

  const predicting = stage === 'predict';

  return (
    <article className="lesson-experience cl1-experience inquiry-scene" data-testid={`inquiry-scene-${screen.id}`}>
      <section className="lesson-visual cl1-stage" aria-label={screen.prompt}>
        <TwoChargeField
          left={left}
          right={right}
          sceneWidth={SCENE.w}
          sceneHeight={SCENE.h}
          pxPerUnit={pxPerUnit}
          maxArrowPx={MAX_ARROW_PX}
          ghost={predicting ? { px: ghostPx } : null}
          onPredictPx={predicting ? setGhostPx : undefined}
          onCycle={!predicting && screen.mode === 'cycle' ? cycle : undefined}
          onMove={!predicting && screen.mode === 'move' ? move : undefined}
          movableId={movableId}
        />
      </section>
      <div className="experience-panel cl1-rail inquiry-rail">
        <p className="eyebrow">Predict</p>
        <p className="inquiry-prompt-text">{screen.prompt}</p>
        {predicting ? (
          <>
            <p className="inquiry-hint">Drag the dashed arrow to your guess. A guess is the point; you will see the answer next.</p>
            <button type="button" className="secondary-button" onClick={reveal}>
              Reveal
            </button>
          </>
        ) : (
          <>
            <p className="inquiry-reveal-caption">{screen.revealCaption}</p>
            {screen.note ? <p className="inquiry-note">{screen.note}</p> : null}
            <p className="inquiry-hint">
              {screen.mode === 'cycle' ? 'Tap a charge to change it.' : 'Drag a charge to change the distance.'}
            </p>
            <button type="button" className="secondary-button" onClick={onComplete}>
              Continue
            </button>
          </>
        )}
      </div>
    </article>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/components/lesson/interactions/InquiryScene.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/lesson/interactions/InquiryScene.tsx frontend/src/components/lesson/interactions/InquiryScene.test.tsx
git commit -m "feat(inquiry): add InquiryScene predict-reveal-explore controller"
```

---

## Task 6: InquiryPrompt walks screens when present

**Files:**
- Modify: `frontend/src/components/lesson/InquiryPrompt.tsx`
- Test: `frontend/src/components/lesson/InquiryPrompt.test.tsx`

**Interfaces:**
- Consumes: `InquiryScene` (Task 5).
- Produces: `InquiryPrompt` gains optional props `initialScreen?: number` and `onStepChange?: (index: number) => void`. When `inquiry.screens?.length`, it renders `InquiryScene` for the current screen; the last screen's `onComplete` calls the existing `onComplete`; earlier screens advance the index. When there are no screens, the existing capture UI is unchanged.

- [ ] **Step 1: Write the failing test**

Append to `frontend/src/components/lesson/InquiryPrompt.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { InquiryPrompt } from './InquiryPrompt';
import type { InquiryPrompt as InquiryModel } from '../../content';

const twoScreen: InquiryModel = {
  question: 'unused when screens present', capture: 'text', resolvedBy: 'inverse square law',
  screens: [
    { id: 'charge', variable: 'charge', mode: 'cycle', prompt: 'Charge prompt.',
      left: { id: 'left', x: 3, y: 3, q: 1 }, right: { id: 'right', x: 7, y: 3, q: 1 },
      target: { apply: 'set-charge', chargeId: 'right', toQ: 3 }, revealCaption: 'Charge caption.' },
    { id: 'distance', variable: 'distance', mode: 'move', prompt: 'Distance prompt.',
      left: { id: 'left', x: 2, y: 3, q: 2 }, right: { id: 'right', x: 5, y: 3, q: 2 },
      target: { apply: 'set-distance', toDistanceFactor: 2 }, revealCaption: 'Distance caption.' },
  ],
};

describe('InquiryPrompt screens flow', () => {
  it('walks both screens then completes', () => {
    const onComplete = vi.fn();
    render(<InquiryPrompt inquiry={twoScreen} onComplete={onComplete} />);
    expect(screen.getByTestId('inquiry-scene-charge')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /reveal/i }));
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(screen.getByTestId('inquiry-scene-distance')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /reveal/i }));
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/lesson/InquiryPrompt.test.tsx`
Expected: FAIL (no screens branch; both scenes not found).

- [ ] **Step 3: Write minimal implementation**

In `frontend/src/components/lesson/InquiryPrompt.tsx`, add the import and a screens branch at the very top of the component body. Add to imports:

```tsx
import { useState } from 'react';
import { InquiryScene } from './interactions/InquiryScene';
```

Change the props type to add the optional fields:

```tsx
type InquiryPromptProps = {
  inquiry: InquiryPromptModel;
  onComplete: () => void;
  initialScreen?: number;
  onStepChange?: (index: number) => void;
};
```

At the start of the `InquiryPrompt` function body (before the existing `useState` calls), add:

```tsx
  const screens = inquiry.screens ?? [];
  const [screenIndex, setScreenIndex] = useState(() =>
    Math.min(Math.max(0, Math.trunc(initialScreen ?? 0)), Math.max(0, screens.length - 1)),
  );

  if (screens.length > 0) {
    const current = screens[screenIndex];
    return (
      <section className="panel lesson-phase inquiry" data-testid="inquiry-prompt">
        <InquiryScene
          key={current.id}
          screen={current}
          onComplete={() => {
            if (screenIndex < screens.length - 1) {
              const next = screenIndex + 1;
              setScreenIndex(next);
              onStepChange?.(next);
            } else {
              onComplete();
            }
          }}
        />
      </section>
    );
  }
```

(The existing capture UI below this block is unchanged.)

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/components/lesson/InquiryPrompt.test.tsx`
Expected: PASS. Confirm legacy capture tests in the same file still pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/lesson/InquiryPrompt.tsx frontend/src/components/lesson/InquiryPrompt.test.tsx
git commit -m "feat(inquiry): render multi-screen pretest when inquiry.screens present"
```

---

## Task 7: Author the Coulomb screens

**Files:**
- Modify: `frontend/src/content/modules/coulombs-law.ts`
- Test: `frontend/src/content/content.test.ts` (validation already runs over all modules; add a Coulomb-specific assertion).

**Interfaces:**
- Consumes: `InquiryScreen` shape (Task 3).
- Produces: `coulombsLaw.inquiry.screens` with two entries (`charge`, `distance`). `resolvedBy` stays `'inverse square law'`; the first explanation slide already contains that phrase, so the existing slide check still passes. The legacy `question`/`capture` fields stay (ignored when screens render).

- [ ] **Step 1: Write the failing test**

Append to `frontend/src/content/content.test.ts`:

```ts
import coulombsLaw from './modules/coulombs-law';

it('coulomb inquiry has a charge screen and a distance screen', () => {
  const ids = (coulombsLaw.inquiry.screens ?? []).map((s) => s.id);
  expect(ids).toEqual(['charge', 'distance']);
  expect(validateLessonModule(coulombsLaw)).toEqual([]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/content/content.test.ts`
Expected: FAIL (screens undefined).

- [ ] **Step 3: Write minimal implementation**

In `frontend/src/content/modules/coulombs-law.ts`, add a `screens` array to the `inquiry` object (keep the existing `question`, `capture`, `resolvedBy`):

```ts
    screens: [
      {
        id: 'charge',
        variable: 'charge',
        mode: 'cycle',
        prompt: 'These two charges repel. Predict the force if you triple the right charge.',
        left: { id: 'left', x: 3, y: 3, q: 1 },
        right: { id: 'right', x: 7, y: 3, q: 1 },
        target: { apply: 'set-charge', chargeId: 'right', toQ: 3 },
        revealCaption: 'Triple a charge and the force triples. The force grows with each charge.',
        note: 'Notice both arrows stay equal and opposite, even when the charges differ.',
      },
      {
        id: 'distance',
        variable: 'distance',
        mode: 'move',
        prompt: 'Now keep the charges fixed and predict the force when you double the distance.',
        left: { id: 'left', x: 2, y: 3, q: 2 },
        right: { id: 'right', x: 4, y: 3, q: 2 },
        target: { apply: 'set-distance', toDistanceFactor: 2 },
        revealCaption: 'Double the distance and the force drops to a quarter, not a half.',
      },
    ],
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/content/content.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/content/modules/coulombs-law.ts frontend/src/content/content.test.ts
git commit -m "feat(inquiry): author Coulomb charge and distance pretest screens"
```

---

## Task 8: Wire the Inquiry phase in LessonSession (sub-steps + resume)

**Files:**
- Modify: `frontend/src/components/lesson/LessonSession.tsx`
- Test: `frontend/src/components/lesson/LessonSession.test.tsx`

**Interfaces:**
- Consumes: `InquiryPrompt` new props `initialScreen`, `onStepChange` (Task 6).
- Produces: the Inquiry `PhaseDescriptor` reports `steps = inquiry.screens?.length || 1`; the within-phase position for phase 1 follows the active screen; resume passes `initialWithin` into `InquiryPrompt`.

- [ ] **Step 1: Write the failing test**

Append to `frontend/src/components/lesson/LessonSession.test.tsx` (follow the existing render helper/imports in that file; this assumes a `renderSession` helper or inline render of `LessonSession` with a module whose inquiry has 2 screens and starting `initialPhase={1}`):

```tsx
it('shows two Inquiry sub-cells and reports screen changes', () => {
  // moduleWith2Screens: a LessonModule whose inquiry.screens has length 2.
  const onPhaseChange = vi.fn();
  render(
    <Wrapper>
      <LessonSession
        module={moduleWith2Screens}
        initialPhase={1}
        initialWithin={0}
        onPhaseChange={onPhaseChange}
        onLessonComplete={() => {}}
      />
    </Wrapper>,
  );
  // Inquiry segment (index 1) has 2 sub-cells.
  const seg = screen.getByTestId('phase-seg-1');
  expect(seg.querySelectorAll('.phase-bar__cell')).toHaveLength(2);
  // Advancing the first screen reports within=1 for phase 1.
  fireEvent.click(screen.getByRole('button', { name: /reveal/i }));
  fireEvent.click(screen.getByRole('button', { name: /continue/i }));
  expect(onPhaseChange).toHaveBeenCalledWith(1, 1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/lesson/LessonSession.test.tsx`
Expected: FAIL (Inquiry segment has 1 cell; onPhaseChange not called with (1, 1)).

- [ ] **Step 3: Write minimal implementation**

In `frontend/src/components/lesson/LessonSession.tsx`:

(a) Add inquiry within-screen state near the other within-phase state (after `slideIndex`):

```tsx
  const [inquiryScreen, setInquiryScreen] = useState(() => {
    if (clampPhase(initialPhase) !== 1) return 0;
    const max = Math.max(0, (module.inquiry.screens?.length ?? 1) - 1);
    const within = Math.max(0, Math.trunc(Number.isFinite(initialWithin) ? initialWithin : 0));
    return Math.min(within, max);
  });
```

(b) Reset it in `goToPhase` alongside the others:

```tsx
    setInquiryScreen(0);
```

(c) Replace the phase 1 render block with:

```tsx
    if (phase === 1) {
      return (
        <InquiryPrompt
          key={`inquiry-${jumpNonce}`}
          inquiry={module.inquiry}
          initialScreen={inquiryScreen}
          onComplete={advance}
          onStepChange={(index) => {
            setInquiryScreen(index);
            onPhaseChange(1, index);
          }}
        />
      );
    }
```

(d) In the `phases` `useMemo`, change the Inquiry descriptor:

```tsx
      { label: 'Inquiry', steps: Math.max(1, module.inquiry.screens?.length ?? 1) },
```

and add `module.inquiry.screens?.length` to the `useMemo` dependency array.

(e) In the within-step computation, add phase 1:

```tsx
  else if (phase === 1) withinStep = inquiryScreen;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/components/lesson/LessonSession.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/lesson/LessonSession.tsx frontend/src/components/lesson/LessonSession.test.tsx
git commit -m "feat(inquiry): drive PhaseBar inquiry sub-steps and resume from screens"
```

---

## Task 9: Styling (ghost arrow, reveal caption, glyph spacing)

**Files:**
- Modify: `frontend/src/styles.css`
- Verification: visual check in the dev server plus the full test run.

**Interfaces:**
- Consumes: existing `.cl1-experience`, `.cl1-stage`, `.cl1-rail`, `.force-arrow`, `.charge-sign` (reused as-is by the components above).
- Produces: `.inquiry-ghost-arrow`, `.inquiry-reveal-caption`, `.inquiry-note`, `.inquiry-hint`, `.inquiry-prompt-text` styles.

- [ ] **Step 1: Add styles**

Append to `frontend/src/styles.css`:

```css
.inquiry-scene .cl1-stage {
  position: relative;
}

.inquiry-ghost-arrow {
  stroke: var(--sketch-accent, #c2410c);
  stroke-width: 3;
  stroke-linecap: round;
  stroke-dasharray: 4 6;
  opacity: 0.85;
}

.inquiry-rail .inquiry-prompt-text {
  font-weight: 600;
  margin: 0.25rem 0 0.5rem;
}

.inquiry-rail .inquiry-hint {
  font-size: 0.9rem;
  opacity: 0.75;
  margin: 0 0 0.75rem;
}

.inquiry-rail .inquiry-reveal-caption {
  font-weight: 600;
  margin: 0.25rem 0 0.5rem;
}

.inquiry-rail .inquiry-note {
  font-size: 0.9rem;
  opacity: 0.8;
  margin: 0 0 0.75rem;
}
```

- [ ] **Step 2: Verify in the browser**

Run: `cd frontend && npm run dev`, open the Coulomb lesson with `?dev=1`, jump to Inquiry. Confirm: charge box shows glyph counts (no size change), both arrows equal and opposite, dashed ghost is draggable, Reveal shows the caption, tapping a charge cycles it, the distance box drags and the arrow shrinks to a quarter at double distance.

- [ ] **Step 3: Run the full suite and type-check**

Run: `cd frontend && npx tsc --noEmit && npx vitest run`
Expected: PASS (no regressions).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/styles.css
git commit -m "style(inquiry): dashed ghost arrow, reveal caption, prompt text"
```

---

## Self-Review

**Spec coverage:**
- Interactive free-form boxes, draggable/cyclable charges, equal-and-opposite vectors at faithful scale: Tasks 1, 4, 5.
- Two screens (charge cycle, distance move): Tasks 3, 5, 7.
- Glyph count not circle size: Task 2.
- Pretest order (predict before reveal; immediate reveal; Learn unchanged): Task 5 (stage machine) and Task 7 (Learn slides untouched).
- No multiple choice: prediction is a dragged ghost arrow (Task 4).
- Saga stage/rail layout reused: Tasks 4, 5, 9 (existing `cl1-` classes).
- PhaseBar sub-steps and resume: Task 8.
- Coulomb only; other lessons untouched: optional `screens` (Task 3) and only `coulombs-law.ts` edited (Task 7).
- No backend / no AI: nothing in `backend/` is touched.

**Placeholder scan:** No TBDs; every code step has complete code.

**Type consistency:** `FieldCharge` (`id`,`x`,`y`,`q`) is shared by `TwoChargeField` and `InquiryScene`. `InquiryScreen.target` is the same discriminated union in schema, content, and controller. `Charge` `count` prop matches its test and `TwoChargeField` usage (`count={Math.abs(c.q)}`). `InquiryPrompt` new props (`initialScreen`, `onStepChange`) match the `LessonSession` call site.

**Known follow-ups (out of scope, do not implement here):**
- Optional AI flourish after reveal (`inquiryDialogue` callable + inquiry keys).
- Apply the same screens pattern to Electric Field; design a non-charge scene for Charging (polarization).
- Persisting the predicted ghost across a mid-screen resume (currently resume restores the screen index only).
