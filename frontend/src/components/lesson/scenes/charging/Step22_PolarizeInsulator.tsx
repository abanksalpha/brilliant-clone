import { useRef, useState, type KeyboardEvent } from 'react';
import { DragHandle, Figure, Legend, clamp, usePointerDrag } from '../primitives';
import './Step22_PolarizeInsulator.css';

// Step 22 - polarize a neutral insulator. Drag the negative rod toward the block:
// an insulator has no free electrons to flow, so instead each bound molecule
// turns in place into a tiny dipole, swinging its positive end to face the rod.
// The closer the rod, the more fully each molecule lines up, leaving the near
// surface positive and the far surface negative. Everything is derived from one
// value, the rod's proximity, so the scene reads correctly at any distance with
// no animation state to drift out of sync.

const ROD = { w: 16, h: 64, y: 110 };
const ROD_Y = ROD.y;

const MIN_X = 60; // rod parked far from the block (resting, molecules scattered)
const MAX_X = 176; // rod brought as close as it gets without touching
const START_X = MIN_X;
const KEY_STEP = 8;

const BLOCK = { x: 202, y: 54, w: 140, h: 112 };
const BLOCK_CX = BLOCK.x + BLOCK.w / 2;

// A grid of bound molecules. Each is a short dipole of half-length HALF; at rest
// it points along its own scattered angle, and it turns toward the rod as the rod
// nears. The rest angles are the twelve multiples of 30 degrees, so they look
// scrambled yet cancel out to a neutral block (no net direction) before the rod
// arrives.
const COLS = [220, 254, 288, 322];
const ROWS = [76, 110, 144];
const HALF = 11;
const POLE_R = 6;

const MOLECULES = ROWS.flatMap((my, rowIndex) =>
  COLS.map((mx, colIndex) => {
    const index = rowIndex * COLS.length + colIndex;
    return { mx, my, restAngle: ((index * 150) * Math.PI) / 180 };
  }),
);

function shortestDelta(from: number, to: number) {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

export function Step22_PolarizeInsulator({ onExplore }: { onExplore?: () => void }) {
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
  const edgeOpacity = clamp(proximity * 0.95, 0, 1);

  const molecules = MOLECULES.map(({ mx, my, restAngle }) => {
    const target = Math.atan2(ROD_Y - my, x - mx);
    const angle = restAngle + shortestDelta(restAngle, target) * proximity;
    const dx = Math.cos(angle) * HALF;
    const dy = Math.sin(angle) * HALF;
    return {
      mx,
      my,
      plus: { cx: mx + dx, cy: my + dy },
      minus: { cx: mx - dx, cy: my - dy },
    };
  });

  return (
    <>
      <Figure>
        <rect
          className="cci-22-block"
          x={BLOCK.x}
          y={BLOCK.y}
          width={BLOCK.w}
          height={BLOCK.h}
          rx={14}
        />

        <line
          className="cci-22-block-edge"
          x1={BLOCK.x + 3}
          x2={BLOCK.x + 3}
          y1={BLOCK.y + 16}
          y2={BLOCK.y + BLOCK.h - 16}
          style={{ opacity: edgeOpacity }}
        />
        <line
          className="cci-22-block-edge cci-22-block-edge--minus"
          x1={BLOCK.x + BLOCK.w - 3}
          x2={BLOCK.x + BLOCK.w - 3}
          y1={BLOCK.y + 16}
          y2={BLOCK.y + BLOCK.h - 16}
          style={{ opacity: edgeOpacity }}
        />

        {molecules.map((molecule, index) => (
          <g key={index} className="cci-22-molecule" data-testid="cci-22-molecule">
            <line
              className="cci-22-bond"
              x1={molecule.minus.cx}
              y1={molecule.minus.cy}
              x2={molecule.plus.cx}
              y2={molecule.plus.cy}
            />
            <circle
              className="cci-22-pole cci-22-pole-minus"
              data-testid="cci-22-minus"
              cx={molecule.minus.cx}
              cy={molecule.minus.cy}
              r={POLE_R}
            />
            <text
              className="cci-22-pole-sign"
              x={molecule.minus.cx}
              y={molecule.minus.cy}
              dy="0.32em"
              textAnchor="middle"
            >
              {'\u2212'}
            </text>
            <circle
              className="cci-22-pole cci-22-pole-plus"
              data-testid="cci-22-plus"
              cx={molecule.plus.cx}
              cy={molecule.plus.cy}
              r={POLE_R}
            />
            <text
              className="cci-22-pole-sign"
              x={molecule.plus.cx}
              y={molecule.plus.cy}
              dy="0.32em"
              textAnchor="middle"
            >
              +
            </text>
          </g>
        ))}

        <text className="cci-22-caption" x={BLOCK_CX} y={186} textAnchor="middle">
          neutral insulator
        </text>

        <DragHandle
          drag={drag}
          label="Charged rod"
          max={MAX_X}
          min={MIN_X}
          onKeyDown={onKeyMove}
          tone="negative"
          value={Math.round(x)}
          valueText={`${Math.round(proximity * 100)}% toward the insulator`}
          x={x}
          y={ROD_Y}
        >
          <rect
            className="cci-22-rod"
            x={x - ROD.w / 2}
            y={ROD_Y - ROD.h / 2}
            width={ROD.w}
            height={ROD.h}
            rx={8}
          />
          {[-18, 0, 18].map((offset) => (
            <rect
              key={offset}
              className="cci-22-rod-minus"
              x={x - 4.5}
              y={ROD_Y + offset - 1.5}
              width={9}
              height={3}
              rx={1.5}
            />
          ))}
        </DragHandle>
      </Figure>
      <Legend text="Drag the negative rod toward the insulator. It has no free electrons to flow, so instead each molecule turns in place into a tiny dipole, swinging its positive end (red) to face the rod. The closer the rod, the more they line up, leaving the near surface positive and the far surface negative." />
    </>
  );
}
