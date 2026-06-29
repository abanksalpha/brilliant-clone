import './PhaseBar.css';

// The lesson session's single progress indicator: five segments in phase order,
// each subdivided into one sub-cell per within-phase step. A sub-cell reads blue
// when its step is done, red for the step the learner is on, and a muted neutral
// for steps not yet reached. Any segment up to the furthest phase reached is a
// button (back navigation); later phases are not selectable. The data-testid plus
// data-state and aria-current contract is the lock LessonSession builds against.
export type PhaseDescriptor = {
  label: string;
  steps: number;
};

type PhaseBarProps = {
  phases: PhaseDescriptor[];
  current: number;
  withinStep: number;
  maxVisited: number;
  onNavigate?: (phase: number, within: number) => void;
  // Free navigation (dev mode or a finished lesson): every sub-cell of every
  // phase is an individual jump target and reads as accessible (blue), so the
  // whole lesson can be inspected subpart by subpart, not just phase by phase.
  freeNavigation?: boolean;
};

type SegmentState = 'complete' | 'active' | 'upcoming';
type CellState = 'done' | 'current' | 'upcoming';

function segmentState(index: number, current: number): SegmentState {
  if (index < current) return 'complete';
  if (index === current) return 'active';
  return 'upcoming';
}

// A done phase is filled (every cell blue); a later phase is empty (every cell
// gray); the current phase is blue up to withinStep, red at withinStep, gray
// after it.
function cellState(
  segmentIndex: number,
  cellIndex: number,
  current: number,
  withinStep: number,
): CellState {
  if (segmentIndex < current) return 'done';
  if (segmentIndex > current) return 'upcoming';
  if (cellIndex < withinStep) return 'done';
  if (cellIndex === withinStep) return 'current';
  return 'upcoming';
}

function cellCount(steps: number): number {
  return Math.max(1, Number.isFinite(steps) ? Math.trunc(steps) : 1);
}

// In free navigation the colors convey accessibility, not progress: every cell a
// learner can jump to reads blue (done); only the cell they are on reads red.
function freeCellState(
  segmentIndex: number,
  cellIndex: number,
  current: number,
  withinStep: number,
): CellState {
  return segmentIndex === current && cellIndex === withinStep ? 'current' : 'done';
}

export function PhaseBar({ phases, current, withinStep, maxVisited, onNavigate, freeNavigation }: PhaseBarProps) {
  const free = Boolean(freeNavigation) && Boolean(onNavigate);

  return (
    <ol className="phase-bar" data-testid="phase-bar" aria-label="Lesson progress">
      {phases.map((phase, index) => {
        const state = segmentState(index, current);
        const count = cellCount(phase.steps);
        const cells = Array.from({ length: count }, (_, cellIndex) =>
          free
            ? freeCellState(index, cellIndex, current, withinStep)
            : cellState(index, cellIndex, current, withinStep),
        );
        const cellLabel = (cellIndex: number) =>
          count > 1 ? `Go to ${phase.label}, part ${cellIndex + 1}` : `Go to ${phase.label}`;
        const currentCellLabel = (cellIndex: number) =>
          count > 1 ? `${phase.label}, part ${cellIndex + 1} (current)` : `${phase.label} (current)`;

        // Free navigation: each sub-cell is its own jump target, so the learner
        // can open any subpart of any phase directly.
        if (free) {
          return (
            <li
              key={`${phase.label}-${index}`}
              className="phase-bar__segment"
              data-testid={`phase-seg-${index}`}
              data-state={state}
              aria-current={state === 'active' ? 'step' : undefined}
            >
              <div className="phase-bar__nav phase-bar__nav--cells">
                <span className="phase-bar__track">
                  {cells.map((cell, cellIndex) =>
                    // The current subpart is already on screen, so it is a no-op. It
                    // still renders as a button so it reads as clickable (pointer
                    // cursor and the same hover darken as the others), but it carries
                    // no onClick, so clicking it does nothing instead of remounting
                    // the phase already showing.
                    cell === 'current' ? (
                      <button
                        key={cellIndex}
                        type="button"
                        className="phase-bar__cell phase-bar__cell--nav"
                        data-cell-state={cell}
                        aria-current="step"
                        aria-label={currentCellLabel(cellIndex)}
                      />
                    ) : (
                      <button
                        key={cellIndex}
                        type="button"
                        className="phase-bar__cell phase-bar__cell--nav"
                        data-cell-state={cell}
                        aria-label={cellLabel(cellIndex)}
                        onClick={() => onNavigate?.(index, cellIndex)}
                      />
                    ),
                  )}
                </span>
                <span className="phase-bar__label">{phase.label}</span>
              </div>
            </li>
          );
        }

        // Normal navigation: the whole segment jumps to its first step, and only
        // phases up to the furthest reached are selectable.
        const navigable = Boolean(onNavigate) && index <= maxVisited;
        const inner = (
          <>
            <span className="phase-bar__track" aria-hidden="true">
              {cells.map((cell, cellIndex) => (
                <span key={cellIndex} className="phase-bar__cell" data-cell-state={cell} />
              ))}
            </span>
            <span className="phase-bar__label">{phase.label}</span>
          </>
        );

        return (
          <li
            key={`${phase.label}-${index}`}
            className="phase-bar__segment"
            data-testid={`phase-seg-${index}`}
            data-state={state}
            aria-current={state === 'active' ? 'step' : undefined}
          >
            {navigable ? (
              <button
                type="button"
                className="phase-bar__nav"
                aria-label={`Go to ${phase.label}`}
                onClick={() => onNavigate?.(index, 0)}
              >
                {inner}
              </button>
            ) : (
              <span className="phase-bar__nav phase-bar__nav--static">{inner}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
