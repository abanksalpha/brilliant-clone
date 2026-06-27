import { LIVE_LESSON_IDS, type DashboardProgress } from './dashboardProgress';

/**
 * A lesson's post-lesson problem set is complete only when the durable
 * `completedProblemSetIds` marker carries it. That marker is written exclusively
 * when the learner finishes the dynamically composed set with every problem in
 * it solved, so the set never reads complete until all of its problems are done.
 * Shared by the dashboard's lesson gating and the friend-position computation so
 * a learner's own node and their friends' avatars agree.
 */
export function isProblemSetComplete(
  progress: DashboardProgress,
  lessonId: string | null | undefined,
): boolean {
  if (!lessonId) {
    return false;
  }
  return (progress.completedProblemSetIds ?? []).includes(lessonId);
}

/**
 * Number of leading live lessons whose problem set is complete. Counts the
 * prefix (stops at the first incomplete set) because the path is sequential:
 * finishing a set is what unlocks the next lesson, so this is the learner's
 * problem-set position on the timeline.
 */
export function countCompletedProblemSets(progress: DashboardProgress): number {
  let count = 0;
  for (const lessonId of LIVE_LESSON_IDS) {
    if (!isProblemSetComplete(progress, lessonId)) {
      break;
    }
    count += 1;
  }
  return count;
}
