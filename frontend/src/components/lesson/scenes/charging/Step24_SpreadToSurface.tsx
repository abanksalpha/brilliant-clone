import { useEffect, useRef, useState } from 'react';
import { preventClickFocus } from '../../shared/preventClickFocus';
import { Figure, Legend } from '../primitives';
import './Step24_SpreadToSurface.css';

// Step 24 - excess charge rides the outer surface of a conductor.
//
// The learner adds extra electrons to a neutral metal conductor. They drop in
// as a tight clump near the centre, then, because like charges repel, they push
// each other apart until they are spread evenly around the OUTER surface with
// none left inside. The whole event is driven by a single elapsed-time value
// (copy of the RubTransferScene pattern): each electron appears at its interior
// drop point, then slides out to an evenly spaced spot on the boundary.
// Reduced-motion / non-browser environments jump straight to the settled frame
// (see cciCanAnimate, copied from RubTransferScene).

const CENTER = { x: 180, y: 102 };
const R = 62;
const ELEC_R = 7.5;
// Past this radius an electron counts as sitting on the outer surface.
const SURFACE_BAND = R * 0.72;

// Eight excess electrons dropped as a tight clump near the centre (offsets from
// CENTER). All sit well inside SURFACE_BAND so they read as interior charge.
const DROP = [
  { x: -2, y: -5 },
  { x: 9, y: -9 },
  { x: -12, y: -1 },
  { x: 4, y: 7 },
  { x: 13, y: 4 },
  { x: -7, y: 11 },
  { x: 2, y: -13 },
  { x: -13, y: -8 },
];

// Their settled homes: evenly spaced around the surface, starting from the top.
const TARGETS = DROP.map((_, i) => {
  const theta = -Math.PI / 2 + (i * 2 * Math.PI) / DROP.length;
  return { x: CENTER.x + R * Math.cos(theta), y: CENTER.y + R * Math.sin(theta) };
});

const TIMING = {
  appearEnd: 300, // electrons pop in at the interior clump
  spreadStart: 340, // then begin sliding outward
  spreadDur: 1040, // time each electron takes to reach the surface
  stagger: 36, // small per-electron delay so the push reads as a cascade
  total: 1700,
};

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3);
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

type Electron = { x: number; y: number; scale: number; moving: boolean; place: 'interior' | 'surface' };

function computeElectrons(time: number): Electron[] {
  const appear = easeOutCubic(clamp01(time / TIMING.appearEnd));
  return DROP.map((drop, i) => {
    const start = { x: CENTER.x + drop.x, y: CENTER.y + drop.y };
    const target = TARGETS[i];
    const p = clamp01((time - (TIMING.spreadStart + i * TIMING.stagger)) / TIMING.spreadDur);
    const e = easeInOutCubic(p);
    const x = lerp(start.x, target.x, e);
    const y = lerp(start.y, target.y, e);
    const dist = Math.hypot(x - CENTER.x, y - CENTER.y);
    return {
      x,
      y,
      scale: appear,
      moving: p > 0.02 && p < 0.98,
      place: dist >= SURFACE_BAND ? 'surface' : 'interior',
    };
  });
}

export function Step24_SpreadToSurface({ onExplore }: { onExplore?: () => void }) {
  const [mode, setMode] = useState<'empty' | 'run' | 'settled'>('empty');
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

  function addElectrons() {
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
      setMode('settled');
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
        setMode('settled');
        rafRef.current = null;
        return;
      }
      setElapsed(next);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }

  const present = mode !== 'empty';
  const time = mode === 'empty' ? 0 : mode === 'settled' ? TIMING.total : elapsed;
  const electrons = present ? computeElectrons(time) : [];
  const surfaceCount = electrons.filter((e) => e.place === 'surface').length;
  const interiorCount = electrons.length - surfaceCount;
  const phase = mode === 'empty' ? 'empty' : mode === 'settled' ? 'settled' : 'spreading';
  const settled = mode === 'settled';
  const ringOpacity = present ? clamp01((clamp01(time / TIMING.total) - 0.6) / 0.4) : 0;
  const status = mode === 'empty' ? 'Neutral metal' : settled ? 'Charge on the surface' : 'Pushing apart';

  return (
    <>
      <Figure>
        <g
          data-testid="cci-24-conductor"
          data-phase={phase}
          data-electron-count={String(electrons.length)}
          data-surface-count={String(surfaceCount)}
          data-interior-count={String(interiorCount)}
        >
          <circle className="cci-24-body" cx={CENTER.x} cy={CENTER.y} r={R} />
          <circle className="cci-24-inner" cx={CENTER.x} cy={CENTER.y} r={R - 12} />
          {ringOpacity > 0.001 ? (
            <circle
              className="cci-24-surface-ring"
              cx={CENTER.x}
              cy={CENTER.y}
              r={R}
              opacity={ringOpacity}
            />
          ) : null}
        </g>

        {electrons.map((e, i) =>
          e.scale <= 0.001 ? null : (
            <circle
              key={`elec-${i}`}
              className={`cl1-electron cci-24-electron${e.moving ? ' cci-24-electron--moving' : ''}`}
              cx={e.x}
              cy={e.y}
              r={ELEC_R * e.scale}
            />
          ),
        )}

        <text className={`cci-24-status${settled ? ' cci-24-status--settled' : ''}`} x={CENTER.x} y={196}>
          {status}
        </text>
      </Figure>

      <button
        className="secondary-button cci-24-add"
        data-testid="cci-explore-trigger"
        type="button"
        onMouseDown={preventClickFocus}
        onClick={addElectrons}
      >
        {settled ? 'Add again' : 'Add electrons'}
      </button>

      <Legend text="The blue dots are extra electrons added to the metal. Because like charges repel, they push each other apart until they ride the outer surface, leaving the inside empty." />
    </>
  );
}
