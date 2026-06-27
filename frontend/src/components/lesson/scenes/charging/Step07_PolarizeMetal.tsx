import { useRef, useState, type KeyboardEvent } from 'react';
import { DragHandle, Figure, Legend, clamp, usePointerDrag } from '../primitives';
import './Step07_PolarizeMetal.css';

// Step 7 - polarize a neutral conductor. Drag the negative rod toward the metal
// sphere: like charges repel, so the sphere's free electrons are pushed to the
// far side, uncovering the fixed positive cores on the near side. The whole
// sphere stays neutral; only the charge has separated. Everything is derived
// from one value, the rod's proximity, so the scene reads correctly at any
// distance with no animation state to drift out of sync.

const SPHERE = { cx: 260, cy: 110, r: 56 };
const ROD = { w: 16, h: 64, y: 110 };
const ROD_Y = ROD.y;

const MIN_X = 64; // rod parked far from the sphere (resting, neutral)
const MAX_X = 168; // rod brought as close as it gets without touching
const START_X = MIN_X;
const KEY_STEP = 8;

// Free electrons at rest: an even cluster filling the sphere (neutral overall).
const REST_COLS = [-36, -12, 12, 36];
const REST_ROWS = [-20, 20];
const ELECTRONS = REST_ROWS.flatMap((dy) => REST_COLS.map((dx) => ({ dx, dy })));

// Positive cores left behind on the near (rod-facing) side as electrons flee.
const PLUS_MARKS = [
  { dx: -36, dy: -20 },
  { dx: -36, dy: 20 },
  { dx: -44, dy: 0 },
];

const ELECTRON_SPREAD = 0.45; // how much the cluster bunches as it is pushed
const ELECTRON_PUSH = 24; // how far the cluster slides toward the far side

const MINUS_BARS = [-18, 0, 18];

export function Step07_PolarizeMetal({ onExplore }: { onExplore?: () => void }) {
  const [x, setX] = useState(START_X);
  const explored = useRef(false);

  function reportIfMoved(next: number) {
    if (next > START_X + KEY_STEP - 2) {
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
  const plusOpacity = clamp(proximity * 1.1, 0, 1);

  const electrons = ELECTRONS.map(({ dx, dy }) => ({
    cx: SPHERE.cx + dx * (1 - ELECTRON_SPREAD * proximity) + ELECTRON_PUSH * proximity,
    cy: SPHERE.cy + dy * (1 - 0.12 * proximity),
  }));

  return (
    <>
      <Figure>
        <circle className="cci-07-sphere" cx={SPHERE.cx} cy={SPHERE.cy} r={SPHERE.r} />
        <ellipse
          className="cci-07-sphere-sheen"
          cx={SPHERE.cx - 20}
          cy={SPHERE.cy - 24}
          rx={18}
          ry={11}
        />

        <g className="cci-07-plus" data-testid="cci-07-plus" style={{ opacity: plusOpacity }}>
          {PLUS_MARKS.map((mark) => (
            <text
              key={`${mark.dx}-${mark.dy}`}
              className="cci-07-plus-mark"
              x={SPHERE.cx + mark.dx}
              y={SPHERE.cy + mark.dy}
              dy="0.32em"
              textAnchor="middle"
            >
              +
            </text>
          ))}
        </g>

        {electrons.map((electron, index) => (
          <circle
            key={index}
            className="cci-07-electron"
            data-testid="cci-07-electron"
            cx={electron.cx}
            cy={electron.cy}
            r={6.5}
          />
        ))}

        <text className="cci-07-caption" x={SPHERE.cx} y={196} textAnchor="middle">
          neutral metal sphere
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
            className="cci-07-rod"
            x={x - ROD.w / 2}
            y={ROD_Y - ROD.h / 2}
            width={ROD.w}
            height={ROD.h}
            rx={8}
          />
          {MINUS_BARS.map((offset) => (
            <rect
              key={offset}
              className="cci-07-rod-minus"
              x={x - 4.5}
              y={ROD_Y + offset - 1.5}
              width={9}
              height={3}
              rx={1.5}
            />
          ))}
        </DragHandle>
      </Figure>
      <Legend text="Drag the negative rod toward the metal sphere. Its free electrons (blue) are repelled to the far side, uncovering the fixed positive cores (red) on the near side. The closer the rod, the stronger the separation, yet the sphere stays neutral overall." />
    </>
  );
}
