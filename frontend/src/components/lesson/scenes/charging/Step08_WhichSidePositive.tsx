import type { KeyboardEvent } from 'react';
import type { LearnerChoice } from '../../lessonExperience';
import { preventClickFocus } from '../../shared/preventClickFocus';
import { Figure } from '../primitives';
import './Step08_WhichSidePositive.css';

// Step 8 - which side turns positive? A fixed negative rod sits on the left of a
// neutral metal sphere, so the sphere is already polarized: like charges repel,
// the free electrons (blue) have piled up on the far (right) side, and the fixed
// positive cores (red +) are left uncovered on the near (left) side. The learner
// answers on the canvas itself by tapping a half of the sphere. The near and far
// halves are two accessible buttons; tapping one reports the matching choice and
// the chosen half lights up. There is no animation: the fully separated state is
// drawn directly, so the picture can never drift out of sync with the question.

const SPHERE = { cx: 214, cy: 106, r: 58 };
const ROD = { w: 16, h: 66, x: 74, y: 106 };
const MINUS_BARS = [-18, 0, 18];

// Free electrons bunched on the far (right) side of the sphere.
const ELECTRONS = [
  { dx: 6, dy: -34 },
  { dx: 6, dy: -11 },
  { dx: 6, dy: 11 },
  { dx: 6, dy: 34 },
  { dx: 27, dy: -27 },
  { dx: 27, dy: -9 },
  { dx: 27, dy: 9 },
  { dx: 27, dy: 27 },
  { dx: 47, dy: -18 },
  { dx: 47, dy: 0 },
  { dx: 47, dy: 18 },
];

// Positive cores left uncovered on the near (left) side of the sphere.
const PLUS_MARKS = [
  { dx: -50, dy: 0 },
  { dx: -36, dy: -24 },
  { dx: -36, dy: 24 },
  { dx: -20, dy: 0 },
];

// Open semicircles: the fill closes across the vertical diameter, but the stroke
// traces only the outer arc so it does not double the dashed divider.
const NEAR_HALF = `M ${SPHERE.cx},${SPHERE.cy - SPHERE.r} A ${SPHERE.r},${SPHERE.r} 0 0 0 ${SPHERE.cx},${SPHERE.cy + SPHERE.r}`;
const FAR_HALF = `M ${SPHERE.cx},${SPHERE.cy - SPHERE.r} A ${SPHERE.r},${SPHERE.r} 0 0 1 ${SPHERE.cx},${SPHERE.cy + SPHERE.r}`;

export function Step08_WhichSidePositive({
  choices,
  disabled,
  onChoose,
  selectedId,
}: {
  choices: LearnerChoice[];
  disabled?: boolean;
  onChoose: (choice: LearnerChoice) => void;
  selectedId?: string;
}) {
  const nearChoice = choices.find((choice) => /near/i.test(choice.text));
  const farChoice = choices.find((choice) => /far/i.test(choice.text));
  if (!nearChoice || !farChoice) return null;

  function choose(choice: LearnerChoice) {
    if (disabled) return;
    onChoose(choice);
  }

  function onKeyChoose(event: KeyboardEvent<SVGPathElement>, choice: LearnerChoice) {
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault();
      choose(choice);
    }
  }

  function halfClassName(side: 'near' | 'far', selected: boolean) {
    return [
      'cci-08-half',
      `cci-08-half--${side}`,
      selected ? 'cci-08-half--selected' : '',
      disabled ? 'cci-08-half--disabled' : '',
    ]
      .filter(Boolean)
      .join(' ');
  }

  const regions: Array<{ side: 'near' | 'far'; choice: LearnerChoice; d: string }> = [
    { side: 'near', choice: nearChoice, d: NEAR_HALF },
    { side: 'far', choice: farChoice, d: FAR_HALF },
  ];

  return (
    <Figure>
      <circle className="cci-08-sphere" cx={SPHERE.cx} cy={SPHERE.cy} r={SPHERE.r} />
      <ellipse
        className="cci-08-sphere-sheen"
        cx={SPHERE.cx - 22}
        cy={SPHERE.cy - 26}
        rx={18}
        ry={11}
      />

      {regions.map(({ side, choice, d }) => {
        const selected = selectedId === choice.id;
        return (
          <path
            key={side}
            className={halfClassName(side, selected)}
            d={d}
            role="button"
            aria-label={choice.text}
            aria-pressed={selected}
            aria-disabled={disabled || undefined}
            tabIndex={disabled ? -1 : 0}
            data-testid={`cci-08-half-${side}`}
            onMouseDown={preventClickFocus}
            onClick={() => choose(choice)}
            onKeyDown={(event) => onKeyChoose(event, choice)}
          />
        );
      })}

      <line
        className="cci-08-divider"
        x1={SPHERE.cx}
        y1={SPHERE.cy - SPHERE.r + 4}
        x2={SPHERE.cx}
        y2={SPHERE.cy + SPHERE.r - 4}
      />

      <g className="cci-08-plus" aria-hidden="true">
        {PLUS_MARKS.map((mark) => (
          <text
            key={`${mark.dx}-${mark.dy}`}
            className="cci-08-plus-mark"
            x={SPHERE.cx + mark.dx}
            y={SPHERE.cy + mark.dy}
            dy="0.32em"
            textAnchor="middle"
          >
            +
          </text>
        ))}
      </g>

      {ELECTRONS.map((electron, index) => (
        <circle
          key={index}
          className="cci-08-electron"
          data-testid="cci-08-electron"
          cx={SPHERE.cx + electron.dx}
          cy={SPHERE.cy + electron.dy}
          r={6.5}
        />
      ))}

      <g className="cci-08-rod-group" aria-hidden="true">
        <rect
          className="cci-08-rod"
          x={ROD.x - ROD.w / 2}
          y={ROD.y - ROD.h / 2}
          width={ROD.w}
          height={ROD.h}
          rx={8}
        />
        {MINUS_BARS.map((offset) => (
          <rect
            key={offset}
            className="cci-08-rod-minus"
            x={ROD.x - 4.5}
            y={ROD.y + offset - 1.5}
            width={9}
            height={3}
            rx={1.5}
          />
        ))}
      </g>

      <text className="cci-08-caption" x={ROD.x} y={196} textAnchor="middle">
        negative rod
      </text>
      <text className="cci-08-caption" x={SPHERE.cx} y={196} textAnchor="middle">
        polarized metal sphere
      </text>
    </Figure>
  );
}
