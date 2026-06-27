import { useEffect, useRef, useState } from 'react';
import { preventClickFocus } from '../../shared/preventClickFocus';
import { Figure, Legend } from '../primitives';
import './Step13_Conduction.css';

// Step 13 - charging by conduction (touch). A negative rod carrying extra
// electron dots is brought to a neutral metal sphere. The whole event is driven
// by a single elapsed-time value (copy of the RubTransferScene pattern):
//   1. Approach: the rod slides right until its tip touches the sphere.
//   2. Transfer: on contact, several of the rod's extra electrons cross over,
//      one after another, and spread out across the sphere.
//   3. Retract: the rod slides back, leaving the sphere visibly negative (it
//      gained electrons) and the rod with fewer than it started with.
// Reduced-motion / non-browser environments jump straight to the final frame
// (see cciCanAnimate, copied from RubTransferScene).

const SPHERE = { x: 238, y: 106, r: 52 };
const ROD = { halfW: 40, halfH: 15, restX: 54, touchX: 186 - 40, y: 106 };
const ELEC_R = 6.5;

// Six electrons ride the rod, offset from its moving centre. Three of them
// (the movers) cross to the sphere on contact; three stay behind, so the rod
// retracts visibly less negative than it arrived.
const ROD_SLOTS = [
  { dx: -22, dy: -7 },
  { dx: 0, dy: -7 },
  { dx: -22, dy: 7 },
  { dx: 22, dy: -7 },
  { dx: 22, dy: 7 },
  { dx: 0, dy: 7 },
];
const STAYER_SLOTS = [ROD_SLOTS[0], ROD_SLOTS[1], ROD_SLOTS[2]];
const MOVER_SLOTS = [ROD_SLOTS[3], ROD_SLOTS[4], ROD_SLOTS[5]];

// Where each transferred electron settles on the sphere: spread upper-left,
// right, and low so the new charge reads as distributed over the conductor.
const SPHERE_TARGETS = [
  { x: 210, y: 86 },
  { x: 266, y: 96 },
  { x: 232, y: 142 },
];

const TIMING = {
  total: 2700,
  approachEnd: 700,
  departBase: 880,
  departGap: 230,
  travel: 500,
  retreatStart: 2040,
};
const ARC = 18;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3);
const easeInCubic = (x: number) => x * x * x;
const easeInOutCubic = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

// Honor prefers-reduced-motion (and non-browser/test environments) by jumping
// straight to the final frame instead of animating. Mirrors RubTransferScene.
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

type MoverState = 'rod' | 'transit' | 'sphere';
type Mover = { x: number; y: number; state: MoverState; progress: number };

type Frame = {
  rodCx: number;
  stayers: Array<{ x: number; y: number }>;
  movers: Mover[];
  sphereCount: number;
  rodCount: number;
  landedAmt: number;
};

function computeFrame(time: number): Frame {
  let rodCx: number;
  if (time <= TIMING.approachEnd) {
    rodCx = lerp(ROD.restX, ROD.touchX, easeOutCubic(clamp01(time / TIMING.approachEnd)));
  } else if (time < TIMING.retreatStart) {
    rodCx = ROD.touchX;
  } else {
    const t = clamp01((time - TIMING.retreatStart) / (TIMING.total - TIMING.retreatStart));
    rodCx = lerp(ROD.touchX, ROD.restX, easeInCubic(t));
  }

  const stayers = STAYER_SLOTS.map((slot) => ({ x: rodCx + slot.dx, y: ROD.y + slot.dy }));

  const movers: Mover[] = MOVER_SLOTS.map((slot, k) => {
    const departAt = TIMING.departBase + k * TIMING.departGap;
    const arriveAt = departAt + TIMING.travel;
    const src = { x: rodCx + slot.dx, y: ROD.y + slot.dy };
    const dst = SPHERE_TARGETS[k];
    if (time < departAt) return { ...src, state: 'rod', progress: 0 };
    if (time >= arriveAt) return { ...dst, state: 'sphere', progress: 1 };
    const p = easeInOutCubic(clamp01((time - departAt) / TIMING.travel));
    return {
      x: lerp(src.x, dst.x, p),
      y: lerp(src.y, dst.y, p) - ARC * Math.sin(p * Math.PI),
      state: 'transit',
      progress: p,
    };
  });

  const sphereCount = movers.filter((m) => m.state === 'sphere').length;
  const rodCount = stayers.length + movers.filter((m) => m.state === 'rod').length;
  const landedAmt =
    movers.reduce((sum, m) => sum + (m.state === 'sphere' ? 1 : m.state === 'transit' ? m.progress : 0), 0) /
    movers.length;

  return { rodCx, stayers, movers, sphereCount, rodCount, landedAmt };
}

export function Step13_Conduction({ onExplore }: { onExplore?: () => void }) {
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

  function touch() {
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
  const chargeAttr = frame.sphereCount > 0 ? 'negative' : 'neutral';
  const charged = frame.sphereCount >= MOVER_SLOTS.length;

  return (
    <>
      <Figure>
        <g
          data-testid="cci-13-sphere"
          data-charge={chargeAttr}
          data-electrons={String(frame.sphereCount)}
        >
          <circle className="cci-13-sphere-body" cx={SPHERE.x} cy={SPHERE.y} r={SPHERE.r} />
          <circle
            className="cci-13-sphere-neg"
            cx={SPHERE.x}
            cy={SPHERE.y}
            r={SPHERE.r - 2}
            opacity={frame.landedAmt * 0.5}
          />
          {charged ? (
            <circle className="cci-13-result-ring" cx={SPHERE.x} cy={SPHERE.y} r={SPHERE.r + 5} />
          ) : null}
        </g>

        {SPHERE_TARGETS.slice(0, frame.sphereCount).map((dot, index) => (
          <circle key={`landed-${index}`} className="cl1-electron cci-13-electron" cx={dot.x} cy={dot.y} r={ELEC_R} />
        ))}

        <g
          className="cci-13-rod-group"
          data-testid="cci-13-rod"
          data-electrons={String(frame.rodCount)}
        >
          <rect
            className="cci-13-rod"
            x={frame.rodCx - ROD.halfW}
            y={ROD.y - ROD.halfH}
            width={ROD.halfW * 2}
            height={ROD.halfH * 2}
            rx={ROD.halfH}
          />
          {frame.stayers.map((dot, index) => (
            <circle key={`stay-${index}`} className="cl1-electron cci-13-electron" cx={dot.x} cy={dot.y} r={ELEC_R} />
          ))}
          {frame.movers
            .filter((m) => m.state === 'rod')
            .map((dot, index) => (
              <circle key={`hold-${index}`} className="cl1-electron cci-13-electron" cx={dot.x} cy={dot.y} r={ELEC_R} />
            ))}
          <text className="cci-13-rod-label" x={frame.rodCx} y={ROD.y + ROD.halfH + 21}>
            charged rod
          </text>
        </g>

        {frame.movers
          .filter((m) => m.state === 'transit')
          .map((dot, index) => (
            <circle
              key={`fly-${index}`}
              className="cl1-electron cl1-electron-moving cci-13-electron"
              cx={dot.x}
              cy={dot.y}
              r={ELEC_R + 0.5}
            />
          ))}

        <text className={`cci-13-status${charged ? ' cci-13-status--neg' : ''}`} x={SPHERE.x} y={198}>
          {chargeAttr === 'negative' ? 'Negative' : 'Neutral'}
        </text>
      </Figure>

      <button
        className="secondary-button cci-13-touch"
        data-testid="cci-explore-trigger"
        type="button"
        onMouseDown={preventClickFocus}
        onClick={touch}
      >
        {mode === 'done' ? 'Touch again' : 'Touch the rod to the sphere'}
      </button>

      <Legend text="The blue dots are electrons. The negative rod carries extra electrons; on contact some of them cross onto the metal sphere and spread out, leaving the sphere negative, the same sign as the rod, and the rod with fewer." />
    </>
  );
}
