import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Trophy } from 'lucide-react';
import { celebrate } from '../../lib/confetti';

type LessonCompleteProps = {
  title: string;
  earnedXp?: number;
};

export function LessonComplete({ title, earnedXp = 0 }: LessonCompleteProps) {
  useEffect(() => {
    celebrate();
  }, []);

  return (
    <section className="lesson-player lesson-complete" aria-labelledby="lesson-complete-title">
      <div className={`complete-card${earnedXp > 0 ? ' complete-card--rewarded' : ''}`}>
        <div className="complete-badge" aria-hidden="true">
          <Trophy size={40} strokeWidth={1.8} />
        </div>

        <p className="eyebrow">Topic complete</p>
        <h2 id="lesson-complete-title">{title}</h2>
        <p className="complete-sub">You finished this topic.</p>

        {earnedXp > 0 ? (
          <div className="complete-reward" role="status" aria-live="polite">
            <div className="complete-reward-row">
              <Sparkles size={20} strokeWidth={2.2} />
              <span className="complete-reward-label">Reward unlocked</span>
            </div>
            <p className="complete-reward-value" data-testid="lesson-xp-earned">
              +{earnedXp} XP
            </p>
          </div>
        ) : null}

        <Link className="secondary-button complete-cta" to="/dashboard">
          Back to dashboard
        </Link>
      </div>
    </section>
  );
}
