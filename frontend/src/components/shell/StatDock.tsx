import { Flame, Zap } from 'lucide-react';
import { useProgress } from '../../progress/ProgressContext';

/**
 * Floating streak + XP indicators, pinned to the bottom-right corner to mirror
 * the bottom-left course switcher.
 */
export function StatDock() {
  const { streakDays, totalXp } = useProgress();

  return (
    <div className="stat-dock">
      <span className="stat-pill stat-pill--streak" title="Day streak">
        <Flame size={16} strokeWidth={2.4} />
        <span>{streakDays}</span>
      </span>

      <span className="stat-pill stat-pill--xp" title="Total XP">
        <Zap size={16} strokeWidth={2.4} />
        <span>{totalXp} XP</span>
      </span>
    </div>
  );
}
