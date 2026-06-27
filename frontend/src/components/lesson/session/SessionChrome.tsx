import { Link } from 'react-router-dom';
import { X } from 'lucide-react';

type SessionChromeProps = {
  current: number;
  total: number;
  title?: string;
  visitedStepCount?: number;
  onStepSelect?: (stepIndex: number) => void;
  // 1-based segments that are solved (rendered green). The current segment stays
  // red even when solved.
  solvedSteps?: number[];
  // When true every segment is selectable, regardless of how far the student has
  // reached. Used by problem sets, where all problems are open from the start.
  allowAllSteps?: boolean;
};

export function SessionChrome({
  current,
  total,
  title,
  visitedStepCount,
  onStepSelect,
  solvedSteps,
  allowAllSteps,
}: SessionChromeProps) {
  const segments = Array.from({ length: total }, (_, index) => index + 1);
  const maxVisitedSegment = Math.max(1, Math.min(visitedStepCount ?? current, total));
  const solvedSet = new Set(solvedSteps ?? []);

  return (
    <div className="session-chrome">
      <Link className="session-close" to="/dashboard" aria-label="Exit lesson">
        <X size={20} strokeWidth={2.4} />
      </Link>

      <div
        className="seg-progress"
        role="progressbar"
        aria-label="Course progress"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={current}
      >
        <span className="sr-only">Progress</span>
        {segments.map((segment) => {
          const isCurrent = segment === current;
          const isSolved = solvedSet.has(segment);
          // "Seen" means visited at some point (tracked by the furthest-visited
          // count), so segments stay blue even after navigating back.
          const isSeen = segment <= maxVisitedSegment;
          const selectable = allowAllSteps || isSeen;
          // Priority: the current segment is always red, then a solved segment
          // is green, then any other available segment is blue. A problem set
          // opens every segment at once, so they all start blue; a lesson only
          // turns a segment blue once it has been reached.
          let stateClass = '';
          if (isCurrent) stateClass = ' seg--current';
          else if (isSolved) stateClass = ' seg--solved';
          else if (allowAllSteps || isSeen) stateClass = ' seg--done';
          const className = `seg${stateClass}`;

          if (!onStepSelect) {
            return <span key={segment} className={className} />;
          }

          return (
            <button
              key={segment}
              type="button"
              className={className}
              aria-label={`Go to screen ${segment}`}
              disabled={!selectable}
              onClick={() => onStepSelect(segment - 1)}
            />
          );
        })}
      </div>

      <span className="session-progress-count" aria-hidden="true">
        {current} / {total}
      </span>

      {title ? <span className="session-title">{title}</span> : null}
    </div>
  );
}
