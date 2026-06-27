import { Figure, Legend } from '../primitives';
import './Step23_SurfaceCharge.css';

// Step 23 (concept) - "Charge rides the surface". A solid metal blob carrying
// excess charge. Because like charges repel, the extra electrons push as far
// apart as they can, which means spreading evenly over the OUTER surface with
// none left in the interior. The blob outline and the electron ring are derived
// from one parametric surface function, so every electron sits exactly on the
// drawn edge. Fully static; no animation.

const CENTER = { x: 180, y: 112 };
const RADIUS = { x: 86, y: 74 };
const WOBBLE_AMP = 5;
const ELECTRON_R = 6.5;
const ELECTRON_COUNT = 16;
const OUTLINE_SAMPLES = 160;

// A gentle 3-lobe wobble turns the ellipse into an organic metal blob without
// breaking the smooth rim the charges ride on.
function surfaceOffset(theta: number) {
  return WOBBLE_AMP * Math.sin(3 * theta + 0.7);
}

function surfacePoint(theta: number) {
  const offset = surfaceOffset(theta);
  return {
    x: CENTER.x + (RADIUS.x + offset) * Math.cos(theta),
    y: CENTER.y + (RADIUS.y + offset) * Math.sin(theta),
  };
}

const BLOB_PATH = (() => {
  let path = '';
  for (let i = 0; i < OUTLINE_SAMPLES; i += 1) {
    const point = surfacePoint((2 * Math.PI * i) / OUTLINE_SAMPLES);
    path += `${i === 0 ? 'M' : 'L'}${point.x.toFixed(2)} ${point.y.toFixed(2)} `;
  }
  return `${path}Z`;
})();

const ELECTRONS = Array.from({ length: ELECTRON_COUNT }, (_, i) =>
  surfacePoint((2 * Math.PI * i) / ELECTRON_COUNT),
);

export function Step23_SurfaceCharge() {
  return (
    <>
      <Figure>
        <path className="cci-23-blob" data-testid="cci-23-blob" d={BLOB_PATH} />
        <ellipse
          className="cci-23-sheen"
          cx={CENTER.x - 28}
          cy={CENTER.y - 30}
          rx={20}
          ry={12}
          aria-hidden="true"
        />
        <text
          className="cci-23-interior-label"
          x={CENTER.x}
          y={CENTER.y + 6}
          textAnchor="middle"
        >
          no charge inside
        </text>
        <g className="cci-23-surface" data-testid="cci-23-surface">
          {ELECTRONS.map((electron, index) => (
            <circle
              className="cl1-electron cci-23-electron"
              key={`electron-${index}`}
              cx={electron.x}
              cy={electron.y}
              r={ELECTRON_R}
            />
          ))}
        </g>
      </Figure>
      <Legend text="Add extra charge to a conductor and the like charges repel until they sit as far apart as possible, spread evenly over the outer surface with the interior left empty." />
    </>
  );
}
