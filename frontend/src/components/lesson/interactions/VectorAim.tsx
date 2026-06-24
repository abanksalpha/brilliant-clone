import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { VectorAimConfig } from '../../../content';
import type { AnswerStatus } from '../FeedbackRenderer';
import { angleDifferenceDegrees } from '../physics';
import { Arrow, Charge, DragHandle, Legend, usePointerDrag } from '../scenes/primitives';

type VectorAimProps = {
  config: VectorAimConfig;
  disabled?: boolean;
  onResult: (status: AnswerStatus) => void;
};

const PIVOT = { x: 176, y: 110 };
const TIP_RADIUS = 74;
const REF_RADIUS = 104;
const KEY_STEP = 4;

function toRadians(deg: number) {
  return (deg * Math.PI) / 180;
}

function normalizeDeg(deg: number) {
  return ((deg % 360) + 360) % 360;
}

export function VectorAim({ config, disabled = false, onResult }: VectorAimProps) {
  const initialAngle = normalizeDeg(config.targetAngleDeg + 125);
  const [angle, setAngle] = useState(initialAngle);
  const latestAngle = useRef(initialAngle);
  const resolved = useRef(false);

  useEffect(() => {
    resolved.current = false;
    const next = normalizeDeg(config.targetAngleDeg + 125);
    latestAngle.current = next;
    setAngle(next);
  }, [config.targetAngleDeg]);

  // Dragging only moves the arrow; it never locks in. That lets the learner
  // settle on a precise angle instead of the arrow snapping "correct" the
  // instant it grazes the edge of the tolerance band.
  function preview(nextAngle: number) {
    if (disabled || resolved.current) return;
    const normalized = normalizeDeg(nextAngle);
    latestAngle.current = normalized;
    setAngle(normalized);
  }

  // Commit on release (or each keyboard nudge): accept only when the arrow is
  // genuinely aligned, then snap it dead-on so a correct answer always looks aimed.
  function commit() {
    if (disabled || resolved.current) return;
    if (angleDifferenceDegrees(latestAngle.current, config.targetAngleDeg) <= config.toleranceDeg) {
      resolved.current = true;
      latestAngle.current = config.targetAngleDeg;
      setAngle(config.targetAngleDeg);
      onResult('correct');
    }
  }

  const tip = {
    x: PIVOT.x + Math.cos(toRadians(angle)) * TIP_RADIUS,
    y: PIVOT.y + Math.sin(toRadians(angle)) * TIP_RADIUS,
  };
  const reference = {
    x: PIVOT.x + Math.cos(toRadians(config.targetAngleDeg)) * REF_RADIUS,
    y: PIVOT.y + Math.sin(toRadians(config.targetAngleDeg)) * REF_RADIUS,
  };

  const drag = usePointerDrag(
    (point) => {
      const deg = (Math.atan2(point.y - PIVOT.y, point.x - PIVOT.x) * 180) / Math.PI;
      preview(deg);
    },
    () => tip,
    commit,
  );

  function onKeyMove(event: KeyboardEvent<SVGGElement>) {
    const delta = event.key === 'ArrowLeft' ? -KEY_STEP : event.key === 'ArrowRight' ? KEY_STEP : 0;
    if (delta === 0) return;
    event.preventDefault();
    preview(latestAngle.current + delta);
    commit();
  }

  return (
    <>
      <div
        className="cl1-figure"
        data-testid="vector-aim"
        data-target={config.targetAngleDeg}
        data-tolerance={config.toleranceDeg}
      >
        <svg viewBox="0 0 360 220" preserveAspectRatio="xMidYMid meet">
          <Charge x={reference.x} y={reference.y} sign={config.targetSign ?? '+'} muted />
          <line className="cl1-aim-axis" x1={PIVOT.x} x2={reference.x} y1={PIVOT.y} y2={reference.y} />
          <Arrow x1={PIVOT.x} x2={tip.x} y1={PIVOT.y} y2={tip.y} tone="net" />
          <DragHandle
            drag={drag}
            label="Force arrow"
            max={359}
            min={0}
            onKeyDown={onKeyMove}
            testId="vector-aim-handle"
            tone="neutral"
            value={Math.round(angle)}
            valueText={`${Math.round(angle)} degrees`}
            x={tip.x}
            y={tip.y}
          >
            <circle className="cl1-aim-grip" cx={tip.x} cy={tip.y} r={9} />
          </DragHandle>
          <Charge x={PIVOT.x} y={PIVOT.y} sign={config.pivotSign ?? '-'} />
        </svg>
      </div>
      <Legend text="Drag the arrow so it points the way the force pushes this charge. Use arrow keys for fine control." />
    </>
  );
}
