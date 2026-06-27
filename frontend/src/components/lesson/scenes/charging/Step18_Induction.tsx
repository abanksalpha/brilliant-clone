import { useEffect, useRef, useState } from 'react';
import { preventClickFocus } from '../../shared/preventClickFocus';
import { Figure, Legend } from '../primitives';
import './Step18_Induction.css';

// Step 18 - charging by induction (the showcase staged animation).
//
// A neutral metal sphere is charged WITHOUT contact, in four advance-button
// stages, each one an animated transition driven by a single elapsed-time value:
//   1. A negative rod approaches; the sphere's free electrons flee to the far
//      side, leaving the near side positive (the sphere is still neutral).
//   2. A ground wire connects on the far side; the repelled electrons drain out
//      to earth, so the sphere is now net positive while the rod is still near.
//   3. The ground wire is removed, trapping the deficit (electrons cannot return).
//   4. The rod is removed; the remaining positive charge spreads evenly and the
//      sphere is left clearly positive.
// Reduced-motion / non-browser environments jump straight to each stage's final
// frame (see cciCanAnimate, copied from RubTransferScene).

const SPHERE = { x: 180, y: 110, r: 58 };
const CORE_Y = 99;
const ELEC_Y = 121;
// Six fixed positive cores (the metal lattice), evenly spread across the sphere.
const CORE_XS = [133, 152, 171, 189, 208, 227];

// Rod centre x at each resting stage (0..4). Off-screen left when absent.
const ROD_X = [-54, 52, 52, 52, -54];

// Far-side ground wire: out of the sphere's right edge, across, then down.
const ATTACH = { x: 238, y: 110 };
const WIRE_B = { x: 300, y: 110 };
const WIRE_C = { x: 300, y: 160 };

// Transition durations in ms; index === the stage being entered.
const STAGE_DUR = [0, 1100, 1500, 700, 1300];

// Three electrons that stay on the sphere; x at each resting stage 0..4.
// They flee right (1), get pushed to the far side as others drain (2, 3), then
// spread evenly once the rod is gone (4).
const STAYERS = [
  [133, 165, 188, 188, 152],
  [152, 178, 206, 206, 189],
  [171, 191, 224, 224, 227],
];

// Three electrons that drain to earth during the grounding stage. They sit at
// home (0), flee right (1), then flow out down the wire and vanish (>= 2).
const DRAINERS = [
  { home: 189, near: 204 },
  { home: 208, near: 216 },
  { home: 227, near: 228 },
];

const BUTTON_LABEL = [
  'Bring the rod near',
  'Connect to ground',
  'Disconnect ground',
  'Remove the rod',
  'Replay',
];

const STAGE_TEXT = [
  { n: 'Start', t: 'Neutral metal sphere, electrons evenly spread.' },
  { n: 'Stage 1 of 4', t: 'Rod brought near, electrons pushed to the far side.' },
  { n: 'Stage 2 of 4', t: 'Grounded, the repelled electrons drain to earth.' },
  { n: 'Stage 3 of 4', t: 'Ground disconnected, the electrons cannot return.' },
  { n: 'Stage 4 of 4', t: 'Rod removed, the sphere is left positive.' },
];

const STATUS = [
  'Neutral',
  'Polarized, still neutral',
  'Net charge positive',
  'Net charge positive',
  'Positive',
];

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function stageLerp(vals: number[], target: number, p: number, ease: (t: number) => number) {
  if (target <= 0) return vals[0];
  return lerp(vals[target - 1], vals[target], ease(clamp01(p)));
}

type Pt = { x: number; y: number };

function pathPoint(points: Pt[], t: number): Pt {
  const segLens: number[] = [];
  let total = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    const d = Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y);
    segLens.push(d);
    total += d;
  }
  let dist = clamp01(t) * total;
  for (let i = 0; i < segLens.length; i += 1) {
    if (dist <= segLens[i] || i === segLens.length - 1) {
      const f = segLens[i] === 0 ? 0 : dist / segLens[i];
      return { x: lerp(points[i].x, points[i + 1].x, f), y: lerp(points[i].y, points[i + 1].y, f) };
    }
    dist -= segLens[i];
  }
  return points[points.length - 1];
}

type Electron = { x: number; y: number; op: number; draining: boolean };

type Frame = {
  rodCx: number;
  rodOp: number;
  wireAmt: number;
  electrons: Electron[];
  positiveAmt: number;
};

function computeFrame(target: number, p: number): Frame {
  // Rod: approaches on stage 1, holds through 2 and 3, retreats on stage 4.
  let rodCx: number;
  let rodOp: number;
  if (target <= 0) {
    rodCx = ROD_X[0];
    rodOp = 0;
  } else {
    const ease = target === 4 ? easeInOut : easeOut;
    rodCx = lerp(ROD_X[target - 1], ROD_X[target], ease(clamp01(p)));
    if (target === 1) rodOp = clamp01(p * 1.7);
    else if (target === 4) rodOp = 1 - clamp01((p - 0.05) / 0.7);
    else rodOp = 1;
  }

  // Ground wire: draws in on stage 2, retracts on stage 3.
  let wireAmt: number;
  if (target <= 1) wireAmt = 0;
  else if (target === 2) wireAmt = easeOut(clamp01(p / 0.32));
  else if (target === 3) wireAmt = 1 - easeInOut(clamp01(p / 0.85));
  else wireAmt = 0;

  const electrons: Electron[] = [];
  for (const xs of STAYERS) {
    electrons.push({ x: stageLerp(xs, target, p, easeInOut), y: ELEC_Y, op: 1, draining: false });
  }
  DRAINERS.forEach((d, i) => {
    if (target <= 1) {
      const x = target <= 0 ? d.home : lerp(d.home, d.near, easeInOut(clamp01(p)));
      electrons.push({ x, y: ELEC_Y, op: 1, draining: false });
    } else if (target === 2) {
      // Stagger the three drainers so they flow out one after another.
      const start = 0.26 + i * 0.17;
      const t = easeInOut(clamp01((p - start) / 0.42));
      const pos = pathPoint([{ x: d.near, y: ELEC_Y }, ATTACH, WIRE_B, WIRE_C], t);
      const op = t < 0.82 ? 1 : clamp01(1 - (t - 0.82) / 0.14);
      electrons.push({ x: pos.x, y: pos.y, op, draining: t > 0.04 && op > 0 });
    }
    // target >= 3: drainers have left for good, so they are not rendered.
  });

  const presentWeight = electrons.reduce((sum, e) => sum + e.op, 0);
  const positiveAmt = clamp01((CORE_XS.length - presentWeight) / DRAINERS.length);

  return { rodCx, rodOp, wireAmt, electrons, positiveAmt };
}

function cciCanAnimate() {
  if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') return false;
  if (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    return false;
  }
  return true;
}

function Dot({
  x,
  y,
  sign,
  op = 1,
  draining = false,
}: {
  x: number;
  y: number;
  sign: '+' | '-';
  op?: number;
  draining?: boolean;
}) {
  const tone = sign === '+' ? 'positive' : 'negative';
  return (
    <g opacity={op}>
      <circle
        className={`charge-circle charge-circle-${tone} cci-18-dot${draining ? ' cci-18-dot--draining' : ''}`}
        cx={x}
        cy={y}
        r={8.5}
      />
      <text className="cci-18-sign" x={x} y={y}>
        {sign === '+' ? '+' : '\u2212'}
      </text>
    </g>
  );
}

export function Step18_Induction({ onExplore }: { onExplore?: () => void }) {
  const [stage, setStage] = useState(0);
  const [phase, setPhase] = useState<'idle' | 'anim'>('idle');
  const [elapsed, setElapsed] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  const targetRef = useRef(0);
  const exploredRef = useRef(false);

  useEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  function advance() {
    if (phase === 'anim') return;

    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    // After the last stage the button replays from the neutral start.
    if (stage >= 4) {
      setElapsed(0);
      setStage(0);
      return;
    }

    const target = stage + 1;
    if (!exploredRef.current) {
      exploredRef.current = true;
      onExplore?.();
    }

    // Honor reduced-motion (and non-browser/test environments) by jumping
    // straight to the next stage's final frame instead of animating.
    if (!cciCanAnimate()) {
      setStage(target);
      return;
    }

    targetRef.current = target;
    setElapsed(0);
    setPhase('anim');
    startRef.current = null;
    const dur = STAGE_DUR[target];
    const tick = (timestamp: number) => {
      if (startRef.current === null) startRef.current = timestamp;
      const next = timestamp - startRef.current;
      if (next >= dur) {
        setElapsed(dur);
        setStage(target);
        setPhase('idle');
        rafRef.current = null;
        return;
      }
      setElapsed(next);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }

  const animating = phase === 'anim';
  // While animating, the figure and its captions describe the stage being
  // entered so they track the visuals; the button keeps naming the action for
  // the stage already reached until that transition completes.
  const target = animating ? targetRef.current : stage;
  const p = animating ? clamp01(elapsed / (STAGE_DUR[target] || 1)) : 1;
  const frame = computeFrame(target, p);
  const chargeAttr = target >= 2 ? 'positive' : 'neutral';

  return (
    <>
      <Figure>
        {frame.wireAmt > 0.001 ? (
          <g className="cci-18-wire-group">
            <path
              className="cci-18-wire"
              d={`M${ATTACH.x},${ATTACH.y} H${WIRE_B.x} V${WIRE_C.y}`}
              pathLength={1}
              strokeDasharray={`${frame.wireAmt} 1`}
            />
            <g className="cci-18-ground" opacity={clamp01((frame.wireAmt - 0.55) / 0.45)}>
              <line x1={WIRE_C.x - 18} x2={WIRE_C.x + 18} y1={160} y2={160} />
              <line x1={WIRE_C.x - 11} x2={WIRE_C.x + 11} y1={166} y2={166} />
              <line x1={WIRE_C.x - 5} x2={WIRE_C.x + 5} y1={172} y2={172} />
              <text className="cci-18-label" x={WIRE_C.x} y={188}>
                to ground
              </text>
            </g>
          </g>
        ) : null}

        <g data-testid="cci-18-sphere" data-stage={String(target)} data-charge={chargeAttr}>
          <circle className="cci-18-sphere-body" cx={SPHERE.x} cy={SPHERE.y} r={SPHERE.r} />
          <circle
            className="cci-18-sphere-pos"
            cx={SPHERE.x}
            cy={SPHERE.y}
            r={SPHERE.r - 2}
            opacity={frame.positiveAmt * 0.55}
          />
          {target === 4 && p > 0.55 ? (
            <circle className="cci-18-result-ring" cx={SPHERE.x} cy={SPHERE.y} r={SPHERE.r + 5} />
          ) : null}
        </g>

        {CORE_XS.map((cx, i) => (
          <Dot key={`core-${i}`} x={cx} y={CORE_Y} sign="+" />
        ))}

        {frame.electrons.map((e, i) =>
          e.op <= 0.001 ? null : (
            <Dot key={`elec-${i}`} x={e.x} y={e.y} sign="-" op={e.op} draining={e.draining} />
          ),
        )}

        {frame.rodOp > 0.001 ? (
          <g className="cci-18-rod-group" opacity={frame.rodOp}>
            <rect
              className="cci-18-rod"
              x={frame.rodCx - 34}
              y={SPHERE.y - 15}
              width={68}
              height={30}
              rx={15}
            />
            {[-18, 0, 18].map((dx) => (
              <text key={dx} className="cci-18-rod-sign" x={frame.rodCx + dx} y={SPHERE.y}>
                {'\u2212'}
              </text>
            ))}
            <text className="cci-18-rod-label" x={frame.rodCx} y={SPHERE.y + 31}>
              charged rod
            </text>
          </g>
        ) : null}

        <text
          className={`cci-18-status${target >= 2 ? ' cci-18-status--pos' : ''}`}
          x={SPHERE.x}
          y={198}
        >
          {STATUS[target]}
        </text>
      </Figure>

      <p className="cci-18-stage">
        <strong>{STAGE_TEXT[target].n}.</strong> {STAGE_TEXT[target].t}
      </p>

      <button
        className="secondary-button cci-18-advance"
        data-testid="cci-explore-trigger"
        type="button"
        onMouseDown={preventClickFocus}
        onClick={advance}
      >
        {BUTTON_LABEL[stage]}
      </button>

      <Legend text="Blue minus signs are the metal's free electrons. Red plus signs are the fixed positive cores. Where electrons leave, the bare cores read as net positive." />
    </>
  );
}
