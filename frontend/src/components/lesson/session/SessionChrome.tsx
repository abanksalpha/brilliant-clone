import { Link } from 'react-router-dom';
import { X } from 'lucide-react';

type SessionChromeProps = {
  current: number;
  total: number;
  title?: string;
  visitedStepCount?: number;
  onStepSelect?: (stepIndex: number) => void;
};

export function SessionChrome({ current, total, title, visitedStepCount, onStepSelect }: SessionChromeProps) {
  const segments = Array.from({ length: total }, (_, index) => index + 1);
  const maxVisitedSegment = Math.max(1, Math.min(visitedStepCount ?? current, total));

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
          // "Seen" means visited at some point (tracked by the furthest-visited
          // count), so segments stay blue even after navigating back. The single
          // current segment is always red, never blue.
          const isSeen = segment <= maxVisitedSegment;
          const className = `seg${isSeen && !isCurrent ? ' seg--done' : ''}${isCurrent ? ' seg--current' : ''}`;

          if (!onStepSelect) {
            return <span key={segment} className={className} />;
          }

          return (
            <button
              key={segment}
              type="button"
              className={className}
              aria-label={`Go to screen ${segment}`}
              disabled={!isSeen}
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
