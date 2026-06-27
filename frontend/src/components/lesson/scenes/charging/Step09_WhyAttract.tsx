import { Arrow, Figure, Legend } from '../primitives';
import './Step09_WhyAttract.css';

// Step 9 (concept) - why a charged object attracts a neutral conductor. A static
// figure that pays off the polarization steps: a negative rod sits on the left
// and the metal sphere has already separated its charge, near side positive and
// far side electrons. The near (opposite) charge is closer, so by one over r
// squared its attraction (the long arrow) beats the far side's repulsion (the
// short arrow). The leftover is a net pull toward the rod (the green net arrow).

const ROD = { x: 44, y: 102, w: 16, h: 88 };
const ROD_MINUS = [-18, 0, 18];

const SPHERE = { cx: 238, cy: 102, r: 52 };

// Near side (rod-facing) positive cores left behind, and far side electrons.
const PLUS_MARKS = [
  { x: 200, y: 84 },
  { x: 190, y: 102 },
  { x: 200, y: 120 },
];
const ELECTRONS = [
  { x: 276, y: 84 },
  { x: 286, y: 102 },
  { x: 276, y: 120 },
];

// Forces along the line of centres (y = SPHERE.cy). Toward the rod is leftward.
const FORCE_Y = SPHERE.cy;
const ATTRACT = { tail: 178, head: 80 }; // large near pull, toward the rod
const REPEL = { tail: 296, head: 326 }; // small far push, away from the rod

// The net force is the leftover of the two, drawn below as the result.
const NET_Y = 182;
const NET = { tail: 242, head: 176 };

export function Step09_WhyAttract() {
  return (
    <>
      <Figure>
        <circle className="cci-09-sphere" cx={SPHERE.cx} cy={SPHERE.cy} r={SPHERE.r} />
        <ellipse
          className="cci-09-sphere-sheen"
          cx={SPHERE.cx - 20}
          cy={SPHERE.cy - 24}
          rx={18}
          ry={11}
        />

        <g data-testid="cci-09-sphere">
          {PLUS_MARKS.map((mark) => (
            <text
              key={`plus-${mark.x}-${mark.y}`}
              className="cci-09-plus-mark"
              x={mark.x}
              y={mark.y}
              dy="0.32em"
              textAnchor="middle"
            >
              +
            </text>
          ))}
          {ELECTRONS.map((electron) => (
            <circle
              key={`elec-${electron.x}-${electron.y}`}
              className="cci-09-electron"
              cx={electron.x}
              cy={electron.y}
              r={6.5}
            />
          ))}
        </g>

        <g data-testid="cci-09-rod">
          <rect
            className="cci-09-rod"
            x={ROD.x - ROD.w / 2}
            y={ROD.y - ROD.h / 2}
            width={ROD.w}
            height={ROD.h}
            rx={8}
          />
          {ROD_MINUS.map((offset) => (
            <rect
              key={offset}
              className="cci-09-rod-minus"
              x={ROD.x - 4.5}
              y={ROD.y + offset - 1.5}
              width={9}
              height={3}
              rx={1.5}
            />
          ))}
          <text className="cci-09-rod-label" x={ROD.x} y={ROD.y + ROD.h / 2 + 18} textAnchor="middle">
            negative rod
          </text>
        </g>

        <text
          className="cci-09-arrow-label"
          x={(ATTRACT.tail + ATTRACT.head) / 2}
          y={FORCE_Y - 14}
          textAnchor="middle"
        >
          attract
        </text>
        <g data-testid="cci-09-attract">
          <Arrow x1={ATTRACT.tail} x2={ATTRACT.head} y1={FORCE_Y} y2={FORCE_Y} />
        </g>

        <text
          className="cci-09-arrow-label"
          x={(REPEL.tail + REPEL.head) / 2}
          y={FORCE_Y - 14}
          textAnchor="middle"
        >
          repel
        </text>
        <g data-testid="cci-09-repel">
          <Arrow x1={REPEL.tail} x2={REPEL.head} y1={FORCE_Y} y2={FORCE_Y} />
        </g>

        <text
          className="cci-09-net-label"
          x={(NET.tail + NET.head) / 2}
          y={NET_Y - 12}
          textAnchor="middle"
        >
          net force
        </text>
        <g data-testid="cci-09-net">
          <Arrow x1={NET.tail} x2={NET.head} y1={NET_Y} y2={NET_Y} tone="net" />
        </g>
      </Figure>
      <Legend text="The near side is the opposite charge and closer, so its attraction beats the far side's repulsion. The leftover is a net force toward the rod, which is why a charged object pulls in neutral ones." />
    </>
  );
}
