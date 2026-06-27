import { useRef, useState, type KeyboardEvent } from 'react';
import { inverseSquare } from '../../physics';
import { Arrow, DragHandle, Figure, Legend, clamp, scaleByReference, usePointerDrag } from '../primitives';
import './Step10_NetPull.css';

// Step 10 - feel the net pull. The metal sphere is already polarized: the near
// side is positive, the far side holds the displaced electrons. Drag the negative
// rod and watch three live force arrows. The near (+) side is pulled toward the
// rod, the far (-) side is pushed away, and because the near charge is closer the
// inverse-square law makes its attraction win, so the net force always points at
// the rod and grows as the rod approaches. Every length is derived from the rod's
// position via 1/r^2, so there is no animation state to drift out of sync.

const SPHERE = { cx: 258, cy: 84, r: 46 };
const ROD = { w: 16, h: 60, y: SPHERE.cy };
const ROD_Y = ROD.y;

const MIN_X = 92; // rod parked at a polite distance (resting)
const MAX_X = 168; // rod brought as close as it gets without touching
const START_X = MIN_X;
const KEY_STEP = 8;

// Effective centers of the two pools of separated charge inside the sphere.
const NEAR_CHARGE_X = SPHERE.cx - 27; // the uncovered positive cores (near side)
const FAR_CHARGE_X = SPHERE.cx + 27; // the gathered electrons (far side)

// The force arrows live in a band below the sphere so they never collide with
// the rod and can grow to full length while staying inside the viewBox.
const NEAR_FAR_Y = 152;
const NET_Y = 180;
const ARROW_MAX_PX = 96;
// Near attraction at the closest approach sets the scale; everything else is
// drawn relative to it, so the net arrow is literally near minus far on screen.
const MAX_FORCE = inverseSquare(NEAR_CHARGE_X - MAX_X);

// Fixed polarized layout: positive cores clustered on the near side, electrons
// gathered on the far side. Offsets stay inside the sphere radius.
const PLUS_MARKS = [
  { dx: -20, dy: -18 },
  { dx: -36, dy: -2 },
  { dx: -20, dy: 16 },
  { dx: -32, dy: 12 },
];
const ELECTRONS = [
  { dx: 18, dy: -20 },
  { dx: 36, dy: -6 },
  { dx: 34, dy: 14 },
  { dx: 20, dy: 16 },
  { dx: 30, dy: -2 },
];

const MINUS_BARS = [-18, 0, 18];

export function Step10_NetPull({ onExplore }: { onExplore?: () => void }) {
  const [x, setX] = useState(START_X);
  const explored = useRef(false);

  function reportIfMoved(next: number) {
    if (!explored.current && Math.abs(next - START_X) >= KEY_STEP - 2) {
      explored.current = true;
      onExplore?.();
    }
  }

  const drag = usePointerDrag(
    (point) => {
      const next = clamp(point.x, MIN_X, MAX_X);
      setX(next);
      reportIfMoved(next);
    },
    () => ({ x, y: ROD_Y }),
  );

  function onKeyMove(event: KeyboardEvent<SVGGElement>) {
    const delta =
      event.key === 'ArrowRight' || event.key === 'ArrowUp'
        ? KEY_STEP
        : event.key === 'ArrowLeft' || event.key === 'ArrowDown'
          ? -KEY_STEP
          : 0;
    if (delta === 0) return;
    event.preventDefault();
    const next = clamp(x + delta, MIN_X, MAX_X);
    setX(next);
    reportIfMoved(next);
  }

  const proximity = clamp((x - MIN_X) / (MAX_X - MIN_X), 0, 1);

  const nearForce = inverseSquare(NEAR_CHARGE_X - x);
  const farForce = inverseSquare(FAR_CHARGE_X - x);
  const netForce = nearForce - farForce;

  const nearLen = scaleByReference(nearForce, MAX_FORCE, ARROW_MAX_PX);
  const farLen = scaleByReference(farForce, MAX_FORCE, ARROW_MAX_PX);
  const netLen = scaleByReference(netForce, MAX_FORCE, ARROW_MAX_PX);

  return (
    <>
      <Figure>
        <circle className="cci-10-sphere" cx={SPHERE.cx} cy={SPHERE.cy} r={SPHERE.r} />
        <ellipse
          className="cci-10-sphere-sheen"
          cx={SPHERE.cx - 18}
          cy={SPHERE.cy - 22}
          rx={16}
          ry={10}
        />

        {PLUS_MARKS.map((mark) => (
          <text
            key={`plus-${mark.dx}-${mark.dy}`}
            className="cci-10-plus-mark"
            x={SPHERE.cx + mark.dx}
            y={SPHERE.cy + mark.dy}
            dy="0.32em"
            textAnchor="middle"
          >
            +
          </text>
        ))}

        {ELECTRONS.map((electron) => (
          <circle
            key={`e-${electron.dx}-${electron.dy}`}
            className="cci-10-electron"
            cx={SPHERE.cx + electron.dx}
            cy={SPHERE.cy + electron.dy}
            r={6.5}
          />
        ))}

        <g data-testid="cci-10-arrow-near" className="cci-10-force">
          <Arrow x1={NEAR_CHARGE_X} x2={NEAR_CHARGE_X - nearLen} y1={NEAR_FAR_Y} y2={NEAR_FAR_Y} />
        </g>
        <g data-testid="cci-10-arrow-far" className="cci-10-force">
          <Arrow x1={FAR_CHARGE_X} x2={FAR_CHARGE_X + farLen} y1={NEAR_FAR_Y} y2={NEAR_FAR_Y} />
        </g>
        <g data-testid="cci-10-arrow-net">
          <Arrow x1={SPHERE.cx} x2={SPHERE.cx - netLen} y1={NET_Y} y2={NET_Y} tone="net" />
        </g>
        <text className="cci-10-net-label" x={SPHERE.cx + 16} y={NET_Y} dy="0.32em">
          net
        </text>

        <DragHandle
          drag={drag}
          label="Charged rod"
          max={MAX_X}
          min={MIN_X}
          onKeyDown={onKeyMove}
          tone="negative"
          value={Math.round(x)}
          valueText={`${Math.round(proximity * 100)}% toward the sphere`}
          x={x}
          y={ROD_Y}
        >
          <rect
            className="cci-10-rod"
            x={x - ROD.w / 2}
            y={ROD_Y - ROD.h / 2}
            width={ROD.w}
            height={ROD.h}
            rx={8}
          />
          {MINUS_BARS.map((offset) => (
            <rect
              key={offset}
              className="cci-10-rod-minus"
              x={x - 4.5}
              y={ROD_Y + offset - 1.5}
              width={9}
              height={3}
              rx={1.5}
            />
          ))}
        </DragHandle>
      </Figure>
      <Legend text="Drag the negative rod. The near positive side is pulled toward it (long arrow) while the far electrons are pushed away (short arrow). The near charge is closer, so by one over r squared its attraction always wins, and the net force points toward the rod, growing as the rod nears." />
    </>
  );
}
