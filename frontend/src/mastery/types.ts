// Local, minimal input interfaces for the mastery model and problem selection.
// These are intentionally defined here (not imported from content or progress)
// so this module stays self contained and pure.

export type MisconceptionMastery = {
  caught: number; // times the student correctly handled this misconception
  missed: number; // times the student fell for it
  lastSeenISO: string; // ISO timestamp of the last graded attempt
  strength: number; // stored retrievability at lastSeen, in [0,1]
};

export type MasteryMap = Record<string, MisconceptionMastery>;

// Minimal structural type selection needs. The real Problem type is a superset.
export type ProblemRef = {
  problemId: string;
  lessonId: string;
  misconceptionTags: string[];
  difficulty: number;
};
