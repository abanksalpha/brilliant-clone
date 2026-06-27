import { useEffect, useRef, useState } from 'react';
import { preventClickFocus } from '../../shared/preventClickFocus';
import { Figure, Legend } from '../primitives';
import './Step03_ElectronMobility.css';

// Step 3 - where electrons can move. Two slabs sit side by side: a metal
// (conductor) and a plastic (insulator), each dotted with electrons. One nudge
// drives the whole animation from a single elapsed-time value: in the metal the
// free electrons slide all the way across the slab, while in the plastic they
// only jiggle a hair and settle back exactly where they started.
const TOTAL = 2200;
const SLIDE = 64; // how far each metal electron travels across its slab
const JIGGLE = 2.6; // tiny in-place wobble for the locked insulator electrons

const easeInOutCubic = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

// Resting positions on the shared 360x220 grid. The metal electrons start
// clustered on the left so the slide reads as a real journey across the slab;
// the insulator electrons are spread evenly because they never leave home.
const METAL_BASE = [60, 82, 104, 126].flatMap((y) => [
  { x: 52, y },
  { x: 74, y },
]);
const PLASTIC_BASE = [70, 95, 120].flatMap((y) => [232, 265, 298].map((x) => ({ x, y })));

// Honor prefers-reduced-motion (and non-browser/test environments) by jumping
// straight to the final frame instead of animating. Mirrors RubTransferScene.
function cciCanAnimate() {
  if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') return false;
  if (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return false;
  }
  return true;
}

export function Step03_ElectronMobility({ onExplore }: { onExplore?: () => void }) {
  const [mode, setMode] = useState<'idle' | 'run' | 'done'>('idle');
  const [elapsed, setElapsed] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  const exploredOnce = useRef(false);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  function nudge() {
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
      setElapsed(TOTAL);
      setMode('done');
      return;
    }

    setElapsed(0);
    setMode('run');
    startRef.current = null;
    const tick = (timestamp: number) => {
      if (startRef.current === null) startRef.current = timestamp;
      const next = timestamp - startRef.current;
      if (next >= TOTAL) {
        setElapsed(TOTAL);
        setMode('done');
        rafRef.current = null;
        return;
      }
      setElapsed(next);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }

  const time = mode === 'idle' ? 0 : mode === 'done' ? TOTAL : elapsed;
  const p = clamp01(time / TOTAL);
  const slide = SLIDE * easeInOutCubic(p);
  // sin envelope is zero at the start and at the end, so the insulator electrons
  // rest and finish exactly on their base positions: they stay put.
  const wobble = Math.sin(p * Math.PI);

  const metalDots = METAL_BASE.map((dot) => ({ x: dot.x + slide, y: dot.y }));
  const plasticDots = PLASTIC_BASE.map((dot, index) => ({
    x: dot.x + JIGGLE * Math.sin(p * Math.PI * 6 + index) * wobble,
    y: dot.y + JIGGLE * Math.cos(p * Math.PI * 5 + index * 1.7) * wobble,
  }));

  const drifting = mode === 'run';

  return (
    <>
      <Figure>
        <g data-testid="cci-03-slab-metal" aria-label="Metal slab, a conductor">
          <rect className="cci-03-slab cci-03-slab--metal" x={30} y={40} width={130} height={110} rx={10} />
          {metalDots.map((dot, index) => (
            <circle
              key={`metal-${index}`}
              className={`cl1-electron cci-03-electron${drifting ? ' cci-03-electron--drifting' : ''}`}
              cx={dot.x}
              cy={dot.y}
              r={6}
            />
          ))}
          <text className="cci-03-label" x={95} y={174} textAnchor="middle">
            Metal
          </text>
          <text className="cci-03-sublabel" x={95} y={192} textAnchor="middle">
            conductor
          </text>
        </g>

        <g data-testid="cci-03-slab-plastic" aria-label="Plastic slab, an insulator">
          <rect className="cci-03-slab cci-03-slab--plastic" x={200} y={40} width={130} height={110} rx={10} />
          {plasticDots.map((dot, index) => (
            <circle key={`plastic-${index}`} className="cl1-electron cci-03-electron" cx={dot.x} cy={dot.y} r={6} />
          ))}
          <text className="cci-03-label" x={265} y={174} textAnchor="middle">
            Plastic
          </text>
          <text className="cci-03-sublabel" x={265} y={192} textAnchor="middle">
            insulator
          </text>
        </g>
      </Figure>

      <button
        className="secondary-button cci-03-nudge"
        type="button"
        data-testid="cci-explore-trigger"
        onMouseDown={preventClickFocus}
        onClick={nudge}
      >
        {mode === 'done' ? 'Nudge again' : 'Nudge the electrons'}
      </button>

      <Legend text="Nudge the electrons (blue) and watch each slab. In the metal they slide freely all the way across, because a conductor has a sea of free electrons. In the plastic they only jiggle in place and settle right back, because an insulator holds every electron to its atom." />
    </>
  );
}
