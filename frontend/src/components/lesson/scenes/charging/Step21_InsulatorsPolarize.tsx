import { Figure, Legend } from '../primitives';
import './Step21_InsulatorsPolarize.css';

// Step 21 (concept) - insulators polarize too. An insulator block sits to the
// right of a charged rod. The insulator has no free sea, so nothing flows across
// it; instead every bound molecule has turned into a tiny dipole and lined up the
// same way, with its plus (opposite) end facing the negative rod. That leaves the
// whole near surface a column of plus ends, slightly opposite to the rod and just
// enough to attract. Fully static, hand-drawn, matching the rod and charge hues
// of the polarization steps.

const BLOCK = { x: 100, y: 40, w: 240, h: 140 };

// Negative rod parked to the left, a clear gap from the block (never touching).
// Centred on the block (cy 110) and sized to span the dipole field (62 to 158).
const ROD = { cx: 50, cy: 110, w: 16, h: 96 };
const ROD_MINUS = [-32, -16, 0, 16, 32];

// Molecule grid: 5 columns x 4 rows of identical dipoles, centred in the block.
const MOL_COLS = [128, 174, 220, 266, 312];
const MOL_ROWS = [62, 94, 126, 158];
const MOLECULES = MOL_ROWS.flatMap((cy) => MOL_COLS.map((cx) => ({ cx, cy })));

// Each dipole: plus end to the left (toward the rod), minus end to the right.
const END_OFFSET = 10;
const END_R = 6;
const BODY = { w: 32, h: 14, rx: 7 };
const SIGN_LONG = 7;
const SIGN_THICK = 2.6;

function Molecule({ cx, cy }: { cx: number; cy: number }) {
  const posX = cx - END_OFFSET;
  const negX = cx + END_OFFSET;
  return (
    <g className="cci-21-molecule" data-testid="cci-21-molecule">
      <rect
        className="cci-21-body"
        x={cx - BODY.w / 2}
        y={cy - BODY.h / 2}
        width={BODY.w}
        height={BODY.h}
        rx={BODY.rx}
      />

      <circle className="cci-21-pos" cx={posX} cy={cy} r={END_R} />
      <rect
        className="cci-21-sign"
        x={posX - SIGN_LONG / 2}
        y={cy - SIGN_THICK / 2}
        width={SIGN_LONG}
        height={SIGN_THICK}
        rx={SIGN_THICK / 2}
      />
      <rect
        className="cci-21-sign"
        x={posX - SIGN_THICK / 2}
        y={cy - SIGN_LONG / 2}
        width={SIGN_THICK}
        height={SIGN_LONG}
        rx={SIGN_THICK / 2}
      />

      <circle className="cci-21-neg" cx={negX} cy={cy} r={END_R} />
      <rect
        className="cci-21-sign"
        x={negX - SIGN_LONG / 2}
        y={cy - SIGN_THICK / 2}
        width={SIGN_LONG}
        height={SIGN_THICK}
        rx={SIGN_THICK / 2}
      />
    </g>
  );
}

export function Step21_InsulatorsPolarize() {
  return (
    <>
      <Figure>
        <g className="cci-21-rod-group" data-testid="cci-21-rod">
          <rect
            className="cci-21-rod-body"
            x={ROD.cx - ROD.w / 2}
            y={ROD.cy - ROD.h / 2}
            width={ROD.w}
            height={ROD.h}
            rx={8}
          />
          {ROD_MINUS.map((offset) => (
            <rect
              className="cci-21-rod-minus"
              key={offset}
              x={ROD.cx - 5}
              y={ROD.cy + offset - 1.5}
              width={10}
              height={3}
              rx={1.5}
            />
          ))}
          <text className="cci-21-caption" x={ROD.cx} y={196} textAnchor="middle">
            charged rod
          </text>
        </g>

        <rect
          className="cci-21-block"
          data-testid="cci-21-insulator"
          x={BLOCK.x}
          y={BLOCK.y}
          width={BLOCK.w}
          height={BLOCK.h}
          rx={16}
        />

        <g className="cci-21-lattice">
          {MOLECULES.map((mol) => (
            <Molecule key={`mol-${mol.cx}-${mol.cy}`} cx={mol.cx} cy={mol.cy} />
          ))}
        </g>

        <text className="cci-21-block-label" x={BLOCK.x + BLOCK.w / 2} y={196} textAnchor="middle">
          insulator
        </text>
      </Figure>
      <Legend text="An insulator cannot let charge flow across it, so each molecule turns into a tiny dipole and lines up with its opposite end facing the rod. The near surface ends up slightly opposite, just enough to attract." />
    </>
  );
}
