import { Link } from 'react-router-dom';
import { ArrowLeft, Target } from 'lucide-react';
import { AppShell } from '../components/shell/AppShell';
import { currentStrength } from '../mastery/masteryModel';
import { isNodeMastered, trackedNodes } from '../mastery/misconceptionGraph';
import { useProgress } from '../progress/ProgressContext';

// Spaced practice builds mastery across this many distinct days, so the row's
// progress indicator counts caught days toward this target.
const MASTERY_DAYS_TARGET = 3;

export function MasteryPage() {
  const { progress } = useProgress();

  // Strength decays with time, so the whole page is read against one shared
  // "now" captured at render.
  const now = new Date();

  // Weakest first, so the work that needs the most attention sits on top; ties
  // fall back to the order the misconceptions first appeared.
  const rows = trackedNodes(progress.misconceptionGraph)
    .map((node) => ({ node, strength: currentStrength(node, now) }))
    .sort((a, b) => a.strength - b.strength || a.node.createdISO.localeCompare(b.node.createdISO));

  const hasTracked = rows.length > 0;

  return (
    <AppShell className="app-shell--handdrawn" showCourseSwitcher={false}>
      <div className="friends-page">
        <Link className="friends-back" to="/dashboard">
          <ArrowLeft size={16} strokeWidth={2.4} aria-hidden="true" /> Return to dashboard
        </Link>
        <header className="friends-header">
          <h1 className="friends-title">
            <Target size={26} strokeWidth={2.2} aria-hidden="true" /> Misconception map
          </h1>
          <p className="friends-lede">
            Misconceptions we have found in your work for you to pay attention to.
          </p>
        </header>

        <section className="friends-section" aria-labelledby="mastery-list-title">
          <h2 id="mastery-list-title" className="friends-section-title">
            Misconceptions ({rows.length})
          </h2>

          {hasTracked ? (
            <ul className="friends-list mastery-list" aria-label="Misconception mastery">
              {rows.map(({ node, strength }) => {
                const percent = Math.round(strength * 100);
                const days = Math.min(node.caughtDayStamps.length, MASTERY_DAYS_TARGET);
                const mastered = isNodeMastered(node, now);
                return (
                  <li
                    className="friend-row mastery-row"
                    key={node.id}
                    {...(mastered ? { 'data-mastered': true } : {})}
                  >
                    <div className="friend-row-info">
                      <span className="friend-row-name">{node.wrongBelief}</span>
                      <span className="friend-row-meta">{node.specificNote}</span>
                      <div
                        className="mastery-bar"
                        role="progressbar"
                        aria-label={`${node.wrongBelief} strength`}
                        aria-valuenow={percent}
                        aria-valuemin={0}
                        aria-valuemax={100}
                      >
                        <span className="mastery-bar-fill" style={{ width: `${percent}%` }} />
                      </div>
                    </div>
                    <div className="mastery-row-stats">
                      <span className="mastery-percent">{percent}%</span>
                      <span className="friend-row-meta">
                        {node.caught} caught · {node.missed} missed
                      </span>
                      <span className="friend-row-meta">
                        {days} of {MASTERY_DAYS_TARGET} days
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="friends-empty mastery-empty" role="status">
              <p className="mastery-empty-text">
                No misconceptions yet. They will appear here as we spot patterns in your work.
              </p>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
