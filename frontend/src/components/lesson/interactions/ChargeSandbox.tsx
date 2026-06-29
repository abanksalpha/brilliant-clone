import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { SandboxConfig } from '../../../content';
import { magnitude, netForceFromCharges, type PointCharge } from '../physics';
import {
  Arrow,
  Charge,
  DragHandle,
  Legend,
  ReadoutRow,
  clamp,
  usePointerDrag,
  } from '../scenes/primitives';

// The answer outcome a sandbox interaction reports. Inlined when the saga
// feedback renderer was removed; ChargeSandbox is its only remaining consumer.
type AnswerStatus = 'correct' | 'wrong';

type ChargeSandboxProps = {
  config: SandboxConfig;
  disabled?: boolean;
  onExplore?: () => void;
  onResult?: (status: AnswerStatus) => void;
};

const VIEW = { h: 220, w: 360 };
const PAD = 34;
const MARGIN = 0.5;
const FORCE_PX = 150;
const MIN_ARROW = 14;

function signOf(q: number): '+' | '-' {
  return q >= 0 ? '+' : '-';
}

export function ChargeSandbox({ config, disabled = false, onExplore, onResult }: ChargeSandboxProps) {
  const isGoal = Boolean(config.goal);
  const stepSize = isGoal ? 0.1 : 0.25;
  const lockAxis = config.lockAxis ?? (isGoal ? 'x' : undefined);

  const scale = Math.min((VIEW.w - 2 * PAD) / config.width, (VIEW.h - 2 * PAD) / config.height);
  const offsetX = (VIEW.w - config.width * scale) / 2;
  const offsetY = (VIEW.h - config.height * scale) / 2;

  const toScreen = (lx: number, ly: number) => ({
    x: offsetX + lx * scale,
    y: offsetY + ly * scale,
  });

  const [pos, setPos] = useState({ x: config.testCharge.x, y: config.testCharge.y });
  const exploredRef = useRef(false);

  useEffect(() => {
    exploredRef.current = false;
    setPos({ x: config.testCharge.x, y: config.testCharge.y });
  }, [config.testCharge.x, config.testCharge.y]);

  function markExplored() {
    if (!exploredRef.current) {
      exploredRef.current = true;
      onExplore?.();
    }
  }

  function moveTo(lx: number, ly: number) {
    if (disabled) return;
    const nextX = clamp(lx, MARGIN, config.width - MARGIN);
    const nextY = lockAxis === 'x' ? config.testCharge.y : clamp(ly, MARGIN, config.height - MARGIN);
    setPos({ x: nextX, y: nextY });
    markExplored();
  }

  const testCharge: PointCharge = { x: pos.x, y: pos.y, q: config.testCharge.q };
  const sources: PointCharge[] = config.fixedCharges.map((charge) => ({
    x: charge.x,
    y: charge.y,
    q: charge.q,
  }));
  const net = netForceFromCharges(testCharge, sources);
  const netMagnitude = magnitude(net);

  const testScreen = toScreen(pos.x, pos.y);
  const drag = usePointerDrag(
    (point) => {
      const lx = (point.x - offsetX) / scale;
      const ly = (point.y - offsetY) / scale;
      moveTo(lx, ly);
    },
    () => testScreen,
  );

  function onKeyMove(event: KeyboardEvent<SVGGElement>) {
    let dx = 0;
    let dy = 0;
    if (event.key === 'ArrowLeft') dx = -stepSize;
    else if (event.key === 'ArrowRight') dx = stepSize;
    else if (event.key === 'ArrowUp') dy = -stepSize;
    else if (event.key === 'ArrowDown') dy = stepSize;
    if (dx === 0 && dy === 0) return;
    event.preventDefault();
    moveTo(pos.x + dx, pos.y + dy);
  }

  let arrowEnd = testScreen;
  if (netMagnitude > 1e-4) {
    const length = Math.max(netMagnitude * FORCE_PX, MIN_ARROW);
    arrowEnd = {
      x: testScreen.x + (net.x / netMagnitude) * length,
      y: testScreen.y + (net.y / netMagnitude) * length,
    };
  }

  return (
    <>
      <div
        className="cl1-figure"
        data-testid="charge-sandbox"
        data-target-x={config.goal?.targetX !== undefined ? Math.round(config.goal.targetX * 100) : undefined}
      >
        <svg viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} preserveAspectRatio="xMidYMid meet">
          {lockAxis === 'x' ? (
            <line
              className="cl1-sandbox-track"
              x1={toScreen(MARGIN, config.testCharge.y).x}
              x2={toScreen(config.width - MARGIN, config.testCharge.y).x}
              y1={testScreen.y}
              y2={testScreen.y}
            />
          ) : null}

          {config.fixedCharges.map((charge) => {
            const screen = toScreen(charge.x, charge.y);
            return <Charge key={charge.id} x={screen.x} y={screen.y} sign={signOf(charge.q)} />;
          })}

          {netMagnitude > 1e-4 ? (
            <Arrow x1={testScreen.x} x2={arrowEnd.x} y1={testScreen.y} y2={arrowEnd.y} tone="net" />
          ) : null}

          <DragHandle
            drag={drag}
            label="Test charge"
            max={Math.round((config.width - MARGIN) * 100)}
            min={Math.round(MARGIN * 100)}
            onKeyDown={onKeyMove}
            testId="charge-sandbox-handle"
            tone={config.testCharge.q >= 0 ? 'positive' : 'negative'}
            value={Math.round(pos.x * 100)}
            valueText={`net force ${netMagnitude.toFixed(2)} units`}
            x={testScreen.x}
            y={testScreen.y}
          >
            <Charge x={testScreen.x} y={testScreen.y} sign={signOf(config.testCharge.q)} />
          </DragHandle>
        </svg>
      </div>

      <ReadoutRow items={[{ label: 'Net force on test charge', value: `${netMagnitude.toFixed(2)} units` }]} />

      {isGoal ? (
        <button
          className="secondary-button"
          type="button"
          disabled={disabled}
          onClick={() => {
            if (disabled) return;
            const withinGoal = netMagnitude <= (config.goal?.toleranceForce ?? 0.02);
            onResult?.(withinGoal ? 'correct' : 'wrong');
          }}
        >
          Check this spot
        </button>
      ) : (
        <Legend text="Drag the test charge around. The arrow is the combined push and pull from both fixed charges." />
      )}
    </>
  );
}
