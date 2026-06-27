import { useEffect, useRef, useState } from 'react';
import { preventClickFocus } from '../../shared/preventClickFocus';
import { Figure, Legend } from '../primitives';
import './Step16_DrainToGround.css';

// Step 16 - draining a charged conductor to ground. A metal sphere holds extra
// electrons (it is net negative). A grounding wire runs off to the earth, broken
// by an open switch. The whole event is driven by a single elapsed-time value
// (copy of the RubTransferScene / Step13 pattern):
//   1. Connect: the switch lever drops to close the gap, joining the sphere to
//      the earth through the wire.
//   2. Drain: the mutually repelling excess electrons leave the sphere one by
//      one, flow along the wire, and sink into the ground, fading out.
//   3. End: no excess is left, the cool tint is gone, and the sphere is neutral.
// Reduced-motion / non-browser environments jump straight to the final frame
// (see cciCanAnimate, copied from RubTransferScene).

const SPHERE = { x: 150, y: 104, r: 52 };
const ELEC_R = 6.5;

// The sphere's excess electrons, spread inside the metal. Every one drains away.
const HOME = [
  { x: 132, y: 86 },
  { x: 168, y: 88 },
  { x: 138, y: 120 },
  { x: 170, y: 120 },
  { x: 150, y: 103 },
];

// Ground wire: out of the sphere's right edge, across (through the switch), then
// down to the earth symbol.
const ATTACH = { x: 202, y: 104 };
const WIRE_B = { x: 272, y: 104 };
const WIRE_C = { x: 272, y: 158 };

// The switch sits in the horizontal run. The lever pivots at SW_PIVOT and, when
// closed, bridges the gap to SW_RIGHT.
const SW_PIVOT = { x: 224, y: 104 };
const SW_LEN = 24;
const SW_RIGHT = { x: SW_PIVOT.x + SW_LEN, y: 104 };
const SW_ANGLE_OPEN = (-35 * Math.PI) / 180;

const TIMING = {
  total: 2600,
  connectEnd: 460,
  departBase: 560,
  departGap: 230,
  travel: 780,
};

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3);
const easeInOutCubic = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

type Pt = { x: number; y: number };

// Position along a multi-segment polyline by fraction of total arc length.
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

type ElState = 'home' | 'transit' | 'gone';
type Electron = { x: number; y: number; op: number; state: ElState };

type Frame = {
  leverEnd: Pt;
  electrons: Electron[];
  homeCount: number;
  notGone: number;
};

function computeFrame(time: number): Frame {
  const switchP = easeOutCubic(clamp01(time / TIMING.connectEnd));
  const angle = lerp(SW_ANGLE_OPEN, 0, switchP);
  const leverEnd = {
    x: SW_PIVOT.x + SW_LEN * Math.cos(angle),
    y: SW_PIVOT.y + SW_LEN * Math.sin(angle),
  };

  const electrons: Electron[] = HOME.map((home, i) => {
    const departAt = TIMING.departBase + i * TIMING.departGap;
    const arriveAt = departAt + TIMING.travel;
    if (time < departAt) return { x: home.x, y: home.y, op: 1, state: 'home' };
    if (time >= arriveAt) return { x: WIRE_C.x, y: WIRE_C.y, op: 0, state: 'gone' };
    const p = clamp01((time - departAt) / TIMING.travel);
    const pos = pathPoint([home, ATTACH, WIRE_B, WIRE_C], easeInOutCubic(p));
    const op = p < 0.82 ? 1 : clamp01(1 - (p - 0.82) / 0.18);
    return { x: pos.x, y: pos.y, op, state: 'transit' };
  });

  const homeCount = electrons.filter((e) => e.state === 'home').length;
  const notGone = electrons.filter((e) => e.state !== 'gone').length;

  return { leverEnd, electrons, homeCount, notGone };
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

export function Step16_DrainToGround({ onExplore }: { onExplore?: () => void }) {
  const [mode, setMode] = useState<'idle' | 'run' | 'done'>('idle');
  const [elapsed, setElapsed] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  const exploredOnce = useRef(false);

  useEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  function connect() {
    if (mode === 'run') return;
    if (!exploredOnce.current) {
      exploredOnce.current = true;
      onExplore?.();
    }

    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    if (!cciCanAnimate()) {
      setElapsed(TIMING.total);
      setMode('done');
      return;
    }

    setElapsed(0);
    setMode('run');
    startRef.current = null;
    const tick = (timestamp: number) => {
      if (startRef.current === null) startRef.current = timestamp;
      const next = timestamp - startRef.current;
      if (next >= TIMING.total) {
        setElapsed(TIMING.total);
        setMode('done');
        rafRef.current = null;
        return;
      }
      setElapsed(next);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }

  const time = mode === 'idle' ? 0 : mode === 'done' ? TIMING.total : elapsed;
  const frame = computeFrame(time);
  const chargeAttr = frame.homeCount > 0 ? 'negative' : 'neutral';
  const tintOpacity = (frame.homeCount / HOME.length) * 0.5;
  const drained = frame.notGone === 0;

  return (
    <>
      <Figure>
        <g className="cci-16-wire-group">
          <path className="cci-16-wire" d={`M${ATTACH.x},${ATTACH.y} H${SW_PIVOT.x}`} />
          <path className="cci-16-wire" d={`M${SW_RIGHT.x},${SW_RIGHT.y} H${WIRE_B.x} V${WIRE_C.y}`} />
          <line
            className="cci-16-switch"
            x1={SW_PIVOT.x}
            y1={SW_PIVOT.y}
            x2={frame.leverEnd.x}
            y2={frame.leverEnd.y}
          />
          <circle className="cci-16-switch-contact" cx={SW_PIVOT.x} cy={SW_PIVOT.y} r={2.6} />
          <circle className="cci-16-switch-contact" cx={SW_RIGHT.x} cy={SW_RIGHT.y} r={2.6} />
          <g className="cci-16-ground">
            <line x1={WIRE_C.x - 18} x2={WIRE_C.x + 18} y1={158} y2={158} />
            <line x1={WIRE_C.x - 11} x2={WIRE_C.x + 11} y1={164} y2={164} />
            <line x1={WIRE_C.x - 5} x2={WIRE_C.x + 5} y1={170} y2={170} />
            <text className="cci-16-label" x={WIRE_C.x} y={186}>
              to ground
            </text>
          </g>
        </g>

        <g data-testid="cci-16-sphere" data-charge={chargeAttr} data-electrons={String(frame.homeCount)}>
          <circle className="cci-16-sphere-body" cx={SPHERE.x} cy={SPHERE.y} r={SPHERE.r} />
          <circle
            className="cci-16-sphere-neg"
            cx={SPHERE.x}
            cy={SPHERE.y}
            r={SPHERE.r - 2}
            opacity={tintOpacity}
          />
          {drained ? (
            <circle className="cci-16-result-ring" cx={SPHERE.x} cy={SPHERE.y} r={SPHERE.r + 5} />
          ) : null}
        </g>

        {frame.electrons.map((e, i) =>
          e.op <= 0.001 ? null : (
            <circle
              key={`elec-${i}`}
              className={`cl1-electron cci-16-electron${e.state === 'transit' ? ' cl1-electron-moving cci-16-electron-draining' : ''}`}
              cx={e.x}
              cy={e.y}
              r={e.state === 'transit' ? ELEC_R + 0.5 : ELEC_R}
              opacity={e.op}
            />
          ),
        )}

        <text className={`cci-16-status${chargeAttr === 'negative' ? ' cci-16-status--neg' : ''}`} x={SPHERE.x} y={196}>
          {chargeAttr === 'negative' ? 'Negative' : 'Neutral'}
        </text>
      </Figure>

      <button
        className="secondary-button cci-16-connect"
        data-testid="cci-explore-trigger"
        type="button"
        onMouseDown={preventClickFocus}
        onClick={connect}
      >
        {mode === 'done' ? 'Drain again' : 'Connect to ground'}
      </button>

      <Legend text="The blue dots are the sphere's extra electrons. Connect the wire to ground and they repel each other out down the wire into the earth, until none are left and the sphere is neutral." />
    </>
  );
}
