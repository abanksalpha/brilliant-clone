import { Charge, Figure, Legend } from '../primitives';
import './Step04_ElectronSea.css';

// Step 4 (concept) - the sea of free electrons. A single piece of metal drawn as
// a fixed lattice of heavy positive cores (small + glyphs, reusing the Coulomb
// Charge so they match the rest of the lesson) with a shared cloud of free
// electrons (blue) sitting in the gaps between them. The figure is fully static;
// a few faint streaks behind some electrons hint that the sea drifts.

const CORE_R = 13;
const ELECTRON_R = 6;

// Fixed lattice: 4 columns x 3 rows, centered on the 360x220 grid (x center 180).
const CORE_COLS = [84, 148, 212, 276];
const CORE_ROWS = [72, 110, 148];
const CORES = CORE_ROWS.flatMap((y) => CORE_COLS.map((x) => ({ x, y })));

// Free electrons drift in the interstitial gaps, never on top of a core. They are
// scattered (x and y both vary) so the cloud reads as a diffuse sea rather than a
// grid, plus one riding near each side wall. A few carry a drift direction so we
// draw a short streak behind them.
type Electron = { x: number; y: number; drift?: { x: number; y: number } };
const ELECTRONS: Electron[] = [
  { x: 110, y: 90, drift: { x: 1, y: 0.06 } },
  { x: 124, y: 112, drift: { x: 1, y: 0.1 } },
  { x: 108, y: 132 },
  { x: 170, y: 92 },
  { x: 188, y: 112 },
  { x: 174, y: 132, drift: { x: 1, y: 0.04 } },
  { x: 236, y: 90, drift: { x: 1, y: -0.1 } },
  { x: 252, y: 112, drift: { x: 1, y: -0.06 } },
  { x: 240, y: 132 },
  { x: 58, y: 110 },
  { x: 302, y: 110 },
];

// Streak sits a few px behind the dot (TRAIL_FRONT) and fades back (TRAIL_BACK),
// so it reads as a motion trail without touching the electron glyph or a core.
const TRAIL_FRONT = ELECTRON_R + 3;
const TRAIL_BACK = 19;

const TRAILS = ELECTRONS.filter((e): e is Required<Electron> => Boolean(e.drift)).map((e) => {
  const length = Math.hypot(e.drift.x, e.drift.y) || 1;
  const ux = e.drift.x / length;
  const uy = e.drift.y / length;
  return {
    x1: e.x - ux * TRAIL_BACK,
    y1: e.y - uy * TRAIL_BACK,
    x2: e.x - ux * TRAIL_FRONT,
    y2: e.y - uy * TRAIL_FRONT,
  };
});

export function Step04_ElectronSea() {
  return (
    <>
      <Figure>
        <rect
          className="cci-04-metal"
          data-testid="cci-04-metal"
          x={40}
          y={40}
          width={280}
          height={140}
          rx={16}
        />

        <g className="cci-04-trails" aria-hidden="true">
          {TRAILS.map((trail, index) => (
            <line
              className="cci-04-trail"
              key={`trail-${index}`}
              x1={trail.x1}
              y1={trail.y1}
              x2={trail.x2}
              y2={trail.y2}
            />
          ))}
        </g>

        <g className="cci-04-lattice" data-testid="cci-04-lattice">
          {CORES.map((core) => (
            <Charge key={`core-${core.x}-${core.y}`} x={core.x} y={core.y} sign="+" r={CORE_R} />
          ))}
        </g>

        <g className="cci-04-sea">
          {ELECTRONS.map((electron, index) => (
            <circle
              className="cl1-electron cci-04-electron"
              key={`electron-${index}`}
              cx={electron.x}
              cy={electron.y}
              r={ELECTRON_R}
            />
          ))}
        </g>
      </Figure>
      <Legend text="Inside a metal, the heavy positive cores stay fixed in a lattice while a shared sea of free electrons (blue) drifts between them. That mobile sea is what lets a conductor carry charge." />
    </>
  );
}
