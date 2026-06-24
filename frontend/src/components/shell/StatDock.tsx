import { Flame, Zap } from 'lucide-react';
import { useProgress } from '../../progress/ProgressContext';
import { calculateStreakDays } from '../../progress/dashboardProgress';

/**
 * Floating streak + XP indicators, pinned to the bottom-right corner to mirror
 * the bottom-left course switcher.
 */
export function StatDock() {
  const { progress, totalXp } = useProgress();
  const streak = calculateStreakDays(progress.completionDates);

  return (
    <div className="stat-dock">
      <span className="stat-pill stat-pill--streak" title="Day streak">
        <Flame size={16} strokeWidth={2.4} />
        <span>{streak}</span>
      </span>

      <span className="stat-pill stat-pill--xp" title="Total XP">
        <Zap size={16} strokeWidth={2.4} />
        <span>{totalXp} XP</span>
      </span>
    </div>
  );
}
