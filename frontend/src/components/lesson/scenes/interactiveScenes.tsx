import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { LearnerChoice } from '../lessonExperience';
import { inverseSquare } from '../physics';
import { preventClickFocus } from '../shared/preventClickFocus';
import {
  Arrow,
  CHARGE_R,
  Charge,
  DragHandle,
  Figure,
  Legend,
  MiniPanel,
  ReadoutRow,
  clamp,
  scaleByReference,
  usePointerDrag,
} from './primitives';

function formatRelativeForce(distanceMultiplier: number, force: number) {
  if (distanceMultiplier === 1) return '1 (baseline)';
  return `1/${distanceMultiplier * distanceMultiplier} of baseline (${force.toFixed(3)})`;
}

// Step 3 - charging by transferring electrons (the triboelectric effect).
// Rubbing only moves charge between *different* materials, because one grips
// electrons more tightly than the other. Here a wool cloth (gives electrons up
// easily) is rubbed on a rubber balloon (holds them tightly), so electrons flow
// wool -> balloon: the wool ends up positive and the balloon negative. Two
// identical objects would swap nothing. A short timed animation plays the
// transfer out, electron by electron, so it reads as a real, physical event.
const RUB = {
  total: 2400,
  approachEnd: 460,
  rubStart: 360,
  rubEnd: 1820,
  departBase: 820,
  departGap: 240,
  travel: 640,
  flipAt: 1980,
  retreatStart: 1980,
};
const RUB_TRANSFERS = 3;
const RUB_APPROACH = 22;
const CLOTH = { half: 42, x: 102, y: 110 };
const BALLOON = { rx: 44, ry: 56, x: 262, y: 104 };

const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3);
const easeInCubic = (x: number) => x * x * x;
const easeInOutCubic = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

function rubGridDots(cx: number, cy: number, count: number) {
  const rows = Math.ceil(count / 2);
  const startY = cy - ((rows - 1) * 18) / 2;
  return Array.from({ length: count }, (_, index) => {
    const row = Math.floor(index / 2);
    const dotsInRow = Math.min(2, count - row * 2);
    const x = dotsInRow === 1 ? cx : cx + (index % 2) * 24 - 12;
    return { x, y: startY + row * 18 };
  });
}

function rubCanAnimate() {
  if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') return false;
  if (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return false;
  }
  return true;
}

export function RubTransferScene({ onExplore }: { onExplore: () => void }) {
  const [mode, setMode] = useState<'idle' | 'run' | 'done'>('idle');
  const [elapsed, setElapsed] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  function startRub() {
    if (mode === 'run') return;
    onExplore();

    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    // Honor reduced-motion (and non-browser/test environments) by jumping
    // straight to the charged result instead of animating.
    if (!rubCanAnimate()) {
      setElapsed(RUB.total);
      setMode('done');
      return;
    }

    setElapsed(0);
    setMode('run');
    startRef.current = null;
    const tick = (timestamp: number) => {
      if (startRef.current === null) startRef.current = timestamp;
      const next = timestamp - startRef.current;
      if (next >= RUB.total) {
        setElapsed(RUB.total);
        setMode('done');
        rafRef.current = null;
        return;
      }
      setElapsed(next);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }

  const time = mode === 'idle' ? 0 : mode === 'done' ? RUB.total : elapsed;

  const approach =
    time <= RUB.approachEnd
      ? RUB_APPROACH * easeOutCubic(clamp01(time / RUB.approachEnd))
      : time < RUB.retreatStart
        ? RUB_APPROACH
        : RUB_APPROACH * (1 - easeInCubic(clamp01((time - RUB.retreatStart) / (RUB.total - RUB.retreatStart))));

  let shimmy = 0;
  if (time > RUB.rubStart && time < RUB.rubEnd) {
    const local = (time - RUB.rubStart) / (RUB.rubEnd - RUB.rubStart);
    shimmy = Math.sin(local * Math.PI * 6) * 6 * Math.sin(local * Math.PI);
  }

  const clothCx = CLOTH.x + approach;
  const clothCy = CLOTH.y + shimmy;
  const balloonCx = BALLOON.x - approach;
  const balloonCy = BALLOON.y - shimmy;

  const aSlots = rubGridDots(clothCx, clothCy, 4);
  const bSlots = rubGridDots(balloonCx, balloonCy, 7);

  const transfers = Array.from({ length: RUB_TRANSFERS }, (_, k) => {
    const departAt = RUB.departBase + k * RUB.departGap;
    const arriveAt = departAt + RUB.travel;
    const src = aSlots[1 + k];
    const dst = bSlots[4 + k];
    if (time < departAt) return { k, state: 'a' as const, pos: src };
    if (time >= arriveAt) return { k, state: 'b' as const, pos: dst };
    const p = easeInOutCubic(clamp01((time - departAt) / RUB.travel));
    return {
      k,
      state: 'transit' as const,
      pos: {
        x: src.x + (dst.x - src.x) * p,
        y: src.y + (dst.y - src.y) * p - 30 * Math.sin(p * Math.PI),
      },
    };
  });

  const aDots = [aSlots[0], ...transfers.filter((t) => t.state === 'a').map((t) => aSlots[1 + t.k])];
  const bDots = [...bSlots.slice(0, 4), ...transfers.filter((t) => t.state === 'b').map((t) => bSlots[4 + t.k])];
  const movingDots = transfers.filter((t) => t.state === 'transit');
  const charged = time >= RUB.flipAt;

  return (
    <>
      <Figure>
        <rect
          className="cl1-object cl1-cloth"
          x={clothCx - CLOTH.half}
          y={clothCy - CLOTH.half}
          width={CLOTH.half * 2}
          height={CLOTH.half * 2}
          rx={14}
        />
        <ellipse className="cl1-balloon" cx={balloonCx} cy={balloonCy} rx={BALLOON.rx} ry={BALLOON.ry} />
        <path
          className="cl1-balloon-knot"
          d={`M${balloonCx - 5} ${balloonCy + BALLOON.ry} L${balloonCx + 5} ${balloonCy + BALLOON.ry} L${balloonCx} ${balloonCy + BALLOON.ry + 9} Z`}
        />

        {aDots.map((dot, index) => (
          <circle key={`a-${index}`} className="cl1-electron" cx={dot.x} cy={dot.y} r={7} />
        ))}
        {bDots.map((dot, index) => (
          <circle key={`b-${index}`} className="cl1-electron" cx={dot.x} cy={dot.y} r={7} />
        ))}
        {movingDots.map((dot) => (
          <circle key={`m-${dot.k}`} className="cl1-electron cl1-electron-moving" cx={dot.pos.x} cy={dot.pos.y} r={8} />
        ))}

        <text className="cl1-object-badge" x={CLOTH.x} y={192} textAnchor="middle">
          A · Wool
        </text>
        <text
          className={`cl1-object-badge cl1-object-status${charged ? ' cl1-charge-pos' : ''}`}
          x={CLOTH.x}
          y={210}
          textAnchor="middle"
        >
          {charged ? 'positive +' : 'neutral'}
        </text>

        <text className="cl1-object-badge" x={BALLOON.x} y={192} textAnchor="middle">
          B · Balloon
        </text>
        <text
          className={`cl1-object-badge cl1-object-status${charged ? ' cl1-charge-neg' : ''}`}
          x={BALLOON.x}
          y={210}
          textAnchor="middle"
        >
          {charged ? 'negative −' : 'neutral'}
        </text>
      </Figure>
      <button className="secondary-button" type="button" onMouseDown={preventClickFocus} onClick={startRub}>
        {mode === 'done' ? 'Rub again' : 'Rub A against B'}
      </button>
      <Legend text="Rub the wool cloth on the balloon and watch the electrons (blue) hop across. Different materials hold electrons with different strength, so they only move one way: the wool gives them up and the balloon grabs them, leaving the wool positive and the balloon negative. Rub two identical objects and nothing transfers." />
    </>
  );
}

// Step 6 - opposite charges attract (drag the negative toward the positive).
export function AttractionDragScene({ onExplore }: { onExplore: () => void }) {
  const sourceX = 118;
  const startX = 266;
  const minX = 160;
  const maxX = 300;
  const [x, setX] = useState(startX);
  const touched = useRef(false);
  const drag = usePointerDrag(
    (point) => {
      const next = clamp(point.x, minX, maxX);
      setX(next);
      if (next < startX - 8) {
        touched.current = true;
        onExplore();
      }
    },
    () => ({ x, y: 110 }),
  );

  function onKeyMove(event: KeyboardEvent<SVGGElement>) {
    const delta = event.key === 'ArrowLeft' ? -8 : event.key === 'ArrowRight' ? 8 : 0;
    if (delta === 0) return;
    event.preventDefault();
    const next = clamp(x + delta, minX, maxX);
    setX(next);
    if (next < startX - 8) {
      touched.current = true;
      onExplore();
    }
  }

  const distance = x - sourceX;
  const force = inverseSquare(distance / 82);
  const maxForceInScene = inverseSquare((minX - sourceX) / 82);
  const len = scaleByReference(force, maxForceInScene, 92);

  return (
    <>
      <Figure>
        <Charge x={sourceX} y={110} sign="+" />
        {touched.current ? (
          <Arrow x1={x - CHARGE_R - 10} x2={x - CHARGE_R - 10 - len} y1={110} y2={110} />
        ) : null}
        <DragHandle
          drag={drag}
          label="Draggable charge"
          max={maxX}
          min={minX}
          onKeyDown={onKeyMove}
          tone="negative"
          value={Math.round(x)}
          x={x}
          y={110}
        >
          <Charge x={x} y={110} sign="-" />
        </DragHandle>
      </Figure>
      <Legend text="Drag the blue charge toward the red one and watch the force arrow grow." />
    </>
  );
}

// Step 7 - tap the configuration that attracts.
export function CompareSignsTapScene({
  choices,
  onChoose,
  disabled,
  selectedId,
}: {
  choices: LearnerChoice[];
  onChoose: (choice: LearnerChoice) => void;
  disabled: boolean;
  selectedId?: string;
}) {
  const correctChoice = choices.find((choice) => choice.correct);
  const wrongChoice = choices.find((choice) => !choice.correct);
  if (!correctChoice || !wrongChoice) return null;

  return (
    <div className="cl1-compare-grid">
      <MiniPanel
        title="Pair 1"
        ariaLabel={wrongChoice.text}
        onSelect={disabled ? undefined : () => onChoose(wrongChoice)}
        selected={selectedId === wrongChoice.id}
      >
        <svg viewBox="0 0 160 100" aria-hidden="true">
          <Charge x={44} y={52} sign="+" r={14} />
          <Charge x={116} y={52} sign="+" r={14} />
          <Arrow x1={24} x2={4} y1={52} y2={52} />
          <Arrow x1={136} x2={156} y1={52} y2={52} />
        </svg>
      </MiniPanel>
      <MiniPanel
        title="Pair 2"
        ariaLabel={correctChoice.text}
        onSelect={disabled ? undefined : () => onChoose(correctChoice)}
        selected={selectedId === correctChoice.id}
      >
        <svg viewBox="0 0 160 100" aria-hidden="true">
          <Charge x={44} y={52} sign="+" r={14} />
          <Charge x={116} y={52} sign="-" r={14} />
          <Arrow x1={62} x2={82} y1={52} y2={52} />
          <Arrow x1={98} x2={78} y1={52} y2={52} />
        </svg>
      </MiniPanel>
    </div>
  );
}

// Step 8 - same charges repel; dragging farther shrinks the force.
export function RepulsionDragScene({ onExplore }: { onExplore: () => void }) {
  const sourceX = 90;
  const startX = 170;
  const minX = 166;
  const maxX = 286;
  const [x, setX] = useState(startX);
  const drag = usePointerDrag(
    (point) => {
      const next = clamp(point.x, minX, maxX);
      setX(next);
      if (next > startX + 10) onExplore();
    },
    () => ({ x, y: 110 }),
  );

  function onKeyMove(event: KeyboardEvent<SVGGElement>) {
    const delta = event.key === 'ArrowLeft' ? -8 : event.key === 'ArrowRight' ? 8 : 0;
    if (delta === 0) return;
    event.preventDefault();
    const next = clamp(x + delta, minX, maxX);
    setX(next);
    if (next > startX + 10) onExplore();
  }

  const distance = x - sourceX;
  const force = inverseSquare(distance / 82);
  const maxForceInScene = inverseSquare((minX - sourceX) / 82);
  const len = scaleByReference(force, maxForceInScene, 74);

  return (
    <>
      <Figure>
        <Charge x={sourceX} y={110} sign="+" />
        <Arrow x1={x + CHARGE_R + 10} x2={x + CHARGE_R + 10 + len} y1={110} y2={110} />
        <DragHandle
          drag={drag}
          label="Draggable charge"
          max={maxX}
          min={minX}
          onKeyDown={onKeyMove}
          tone="positive"
          value={Math.round(x)}
          x={x}
          y={110}
        >
          <Charge x={x} y={110} sign="+" />
        </DragHandle>
      </Figure>
      <Legend text="Drag the right charge farther away and watch the force arrow shrink." />
    </>
  );
}

// Step 11 - inverse-square reveal slider (1r to 3r).
export function InverseSquareSliderScene({ onExplore }: { onExplore: () => void }) {
  const [distance, setDistance] = useState(1);
  const force = inverseSquare(distance);
  const q2 = { x: 92 + distance * 82, y: 110 };
  const arrowLen = scaleByReference(force, 1, 92);

  return (
    <>
      <Figure>
        <Charge x={92} y={110} sign="+" />
        <Charge x={q2.x} y={q2.y} sign="+" />
        <Arrow x1={q2.x + CHARGE_R + 10} x2={q2.x + CHARGE_R + 10 + arrowLen} y1={q2.y} y2={q2.y} />
      </Figure>
      <label className="lesson-slider">
        <span>Distance multiplier</span>
        <input
          aria-label="Distance multiplier"
          max={3}
          min={1}
          step={1}
          type="range"
          value={distance}
          onChange={(event) => {
            const next = Number(event.currentTarget.value);
            setDistance(next);
            if (next !== 1) onExplore();
          }}
        />
      </label>
      <ReadoutRow
        items={[
          { label: 'Distance', value: `${distance}r` },
          { label: 'Force', value: formatRelativeForce(distance, force) },
        ]}
      />
      <Legend text="Move the slider and compare how quickly force drops with distance." />
    </>
  );
}

// Step 12 - predict the force at 4r, then confirm with the slider.
export function PredictionScene({ revealConfirm }: { revealConfirm: boolean }) {
  const [distance, setDistance] = useState(1);

  useEffect(() => {
    if (!revealConfirm) setDistance(1);
  }, [revealConfirm]);

  if (!revealConfirm) {
    return (
      <>
        <Figure>
          <Charge x={70} y={110} sign="+" />
          <Charge x={152} y={110} sign="+" />
          <Arrow x1={180} x2={264} y1={110} y2={110} />
        </Figure>
        <Legend text="Predict first. Then use the slider to check the force at 4r." />
      </>
    );
  }

  const force = inverseSquare(distance);
  const q1x = 70;
  const q2x = q1x + distance * 60;
  const arrowLen = scaleByReference(force, 1, 86);

  return (
    <>
      <Figure>
        <Charge x={q1x} y={110} sign="+" />
        <Charge x={q2x} y={110} sign="+" />
        <Arrow x1={q2x + CHARGE_R + 10} x2={q2x + CHARGE_R + 10 + arrowLen} y1={110} y2={110} />
      </Figure>
      <label className="lesson-slider">
        <span>Distance multiplier</span>
        <input
          aria-label="Confirmation distance"
          max={4}
          min={1}
          step={1}
          type="range"
          value={distance}
          onChange={(event) => setDistance(Number(event.currentTarget.value))}
        />
      </label>
      <ReadoutRow
        items={[
          { label: 'Distance', value: `${distance}r` },
          { label: 'Force', value: formatRelativeForce(distance, force) },
        ]}
      />
      <Legend text="At 4r the force is one sixteenth of the original." />
    </>
  );
}

// Step 16 - charge scaling slider (linear).
export function ChargeSliderScene({ onExplore }: { onExplore: () => void }) {
  const [q2, setQ2] = useState(1);
  const q2Pos = { x: 244, y: 110 };
  const arrowLen = scaleByReference(q2, 4, 80);

  return (
    <>
      <Figure>
        <Charge x={96} y={110} sign="+" />
        <Charge x={q2Pos.x} y={q2Pos.y} sign="+" r={18 + q2 * 1.5} />
        <Arrow x1={q2Pos.x + CHARGE_R + 10} x2={q2Pos.x + CHARGE_R + 10 + arrowLen} y1={q2Pos.y} y2={q2Pos.y} />
      </Figure>
      <label className="lesson-slider">
        <span>Charge magnitude</span>
        <input
          aria-label="Charge magnitude"
          max={4}
          min={1}
          step={1}
          type="range"
          value={q2}
          onChange={(event) => {
            const next = Number(event.currentTarget.value);
            setQ2(next);
            if (next !== 1) onExplore();
          }}
        />
      </label>
      <ReadoutRow
        items={[
          { label: 'q2', value: `${q2}x` },
          { label: 'Force', value: `${q2.toFixed(2)} units` },
        ]}
      />
      <Legend text="Distance is fixed, so changing q2 changes the force directly." />
    </>
  );
}
