import { Figure, Legend } from '../primitives';
import './Step06_ChargeNearby.css';

// Step 6 (concept) - charge nearby disturbs it. The same neutral metal sphere
// and negative rod as the Step 7 interaction, but frozen at the opening moment:
// the rod is held a short distance to one side and the free-electron sea has
// only just begun to drift to the far side. Nothing is fully polarized yet (no
// positive cores are uncovered), because driving that separation home is the job
// of the next, interactive step. Everything is static; the gentle offset of the
// sea is what reads as "starting to feel the rod's push."

const SPHERE = { cx: 260, cy: 110, r: 56 };

// Negative rod parked to the left, a clear gap from the sphere (never touching).
const ROD = { cx: 116, w: 16, h: 64, y: 110 };
const ROD_MINUS = [-18, 0, 18];

// Free electrons at rest: an even cluster filling the sphere (neutral overall),
// matching the Step 7 layout so the two adjacent scenes read as one object.
const REST_COLS = [-36, -12, 12, 36];
const REST_ROWS = [-20, 20];

// The opening nudge: the whole sea slides a little toward the far side and packs
// in slightly, leaving the near (rod-facing) side thinner. Far smaller than the
// full Step 7 separation, so it reads as "just beginning."
const SEA_SHIFT = 12;
const SEA_BUNCH = 0.16;

const ELECTRONS = REST_ROWS.flatMap((dy) =>
  REST_COLS.map((dx) => ({
    cx: SPHERE.cx + dx * (1 - SEA_BUNCH) + SEA_SHIFT,
    cy: SPHERE.cy + dy,
  })),
);

export function Step06_ChargeNearby() {
  return (
    <>
      <Figure>
        <circle
          className="cci-06-sphere"
          data-testid="cci-06-sphere"
          cx={SPHERE.cx}
          cy={SPHERE.cy}
          r={SPHERE.r}
        />
        <ellipse
          className="cci-06-sphere-sheen"
          cx={SPHERE.cx - 20}
          cy={SPHERE.cy - 24}
          rx={18}
          ry={11}
        />

        {ELECTRONS.map((electron, index) => (
          <circle
            key={index}
            className="cci-06-electron"
            data-testid="cci-06-electron"
            cx={electron.cx}
            cy={electron.cy}
            r={6.5}
          />
        ))}

        <text className="cci-06-caption" x={SPHERE.cx} y={196} textAnchor="middle">
          neutral metal sphere
        </text>

        <g className="cci-06-rod-group">
          <rect
            className="cci-06-rod"
            data-testid="cci-06-rod"
            x={ROD.cx - ROD.w / 2}
            y={ROD.y - ROD.h / 2}
            width={ROD.w}
            height={ROD.h}
            rx={8}
          />
          {ROD_MINUS.map((offset) => (
            <rect
              key={offset}
              className="cci-06-rod-minus"
              x={ROD.cx - 4.5}
              y={ROD.y + offset - 1.5}
              width={9}
              height={3}
              rx={1.5}
            />
          ))}
          <text className="cci-06-caption" x={ROD.cx} y={196} textAnchor="middle">
            charged rod
          </text>
        </g>
      </Figure>
      <Legend text="A charged rod held near the neutral metal makes its free electrons feel a force. The sea is just beginning to shift to the far side, but the sphere stays neutral overall." />
    </>
  );
}
