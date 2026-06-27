import { Figure, Legend } from '../primitives';
import './Step02_TwoMaterials.css';

// Step 2 (concept) - the two camps of material, side by side. A copper bar
// (conductor) holds a loose sea of free electron dots that drift between fixed
// positive cores; a rubber block (insulator) holds the same charges, but every
// electron is locked to its own atom. Static, hand-drawn, matching the Step 3
// slab geometry so the two adjacent steps share a visual rhythm.

const CONDUCTOR = { x: 30, y: 40, w: 130, h: 110 };
const INSULATOR = { x: 200, y: 40, w: 130, h: 110 };

// Conductor: fixed positive cores on a lattice, with free electrons drifting in
// the gaps between them (offset from the lattice so they read as a loose sea).
const CONDUCTOR_CORES = [72, 116].flatMap((y) => [62, 95, 128].map((x) => ({ x, y })));
const FREE_ELECTRONS = [
  { x: 76, y: 68 },
  { x: 113, y: 76 },
  { x: 60, y: 96 },
  { x: 97, y: 90 },
  { x: 130, y: 98 },
  { x: 80, y: 120 },
  { x: 109, y: 112 },
];

// Insulator: the same lattice of fixed sites, but each site is a bound atom with
// one electron locked right against its core. The offsets vary slightly so the
// bound electrons read as held in place, not lined up into a polarized field.
const INSULATOR_SITES = [72, 116].flatMap((y) => [232, 265, 298].map((x) => ({ x, y })));
const LOCKED_OFFSETS = [
  { dx: 8, dy: 5 },
  { dx: -7, dy: 6 },
  { dx: 7, dy: -6 },
  { dx: -8, dy: -5 },
  { dx: 6, dy: 6 },
  { dx: -6, dy: -6 },
];

export function Step02_TwoMaterials() {
  return (
    <>
      <Figure>
        <g data-testid="cci-02-conductor" aria-label="Copper bar, a conductor">
          <rect
            className="cci-02-bar cci-02-bar--copper"
            x={CONDUCTOR.x}
            y={CONDUCTOR.y}
            width={CONDUCTOR.w}
            height={CONDUCTOR.h}
            rx={10}
          />
          {CONDUCTOR_CORES.map((core) => (
            <text
              className="cci-02-core"
              key={`cond-core-${core.x}-${core.y}`}
              x={core.x}
              y={core.y}
              textAnchor="middle"
              dominantBaseline="central"
            >
              +
            </text>
          ))}
          {FREE_ELECTRONS.map((dot) => (
            <circle
              className="cl1-electron cci-02-electron cci-02-electron--free"
              key={`free-${dot.x}-${dot.y}`}
              cx={dot.x}
              cy={dot.y}
              r={6}
            />
          ))}
          <text className="cci-02-label" x={95} y={174} textAnchor="middle">
            Conductor
          </text>
          <text className="cci-02-sublabel" x={95} y={192} textAnchor="middle">
            copper
          </text>
        </g>

        <g data-testid="cci-02-insulator" aria-label="Rubber block, an insulator">
          <rect
            className="cci-02-bar cci-02-bar--rubber"
            x={INSULATOR.x}
            y={INSULATOR.y}
            width={INSULATOR.w}
            height={INSULATOR.h}
            rx={10}
          />
          {INSULATOR_SITES.map((site, index) => {
            const offset = LOCKED_OFFSETS[index % LOCKED_OFFSETS.length];
            return (
              <g key={`atom-${site.x}-${site.y}`}>
                <ellipse className="cci-02-atom" cx={site.x} cy={site.y} rx={16} ry={14} />
                <text
                  className="cci-02-core"
                  x={site.x}
                  y={site.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                >
                  +
                </text>
                <circle
                  className="cl1-electron cci-02-electron cci-02-electron--locked"
                  cx={site.x + offset.dx}
                  cy={site.y + offset.dy}
                  r={6}
                />
              </g>
            );
          })}
          <text className="cci-02-label" x={265} y={174} textAnchor="middle">
            Insulator
          </text>
          <text className="cci-02-sublabel" x={265} y={192} textAnchor="middle">
            rubber
          </text>
        </g>
      </Figure>
      <Legend text="In a conductor like copper, electrons roam freely as a shared sea. In an insulator like rubber, each electron stays locked to its own atom." />
    </>
  );
}
