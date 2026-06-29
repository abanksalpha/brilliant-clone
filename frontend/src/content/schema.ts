// Sandbox primitive types, retained from the saga era for Phase 2 inquiry reuse
// (ChargeSandbox). The rest of the saga schema (Step, interaction configs, the
// saga Lesson) was removed with the saga surface.

export type SandboxCharge = {
  id: string;
  x: number;
  y: number;
  q: number;
  fixed?: boolean;
  label?: string;
};

export type SandboxConfig = {
  width: number;
  height: number;
  fixedCharges: SandboxCharge[];
  testCharge: SandboxCharge;
  lockAxis?: 'x' | 'y';
  goal?: {
    type: 'equilibrium';
    toleranceForce: number;
    targetX?: number;
    targetY?: number;
  };
};

// ---------------------------------------------------------------------------
// LessonModule: the five-phase lesson model that replaces the saga `Lesson`.
// Phase 1 (review) is composed at runtime by the assignment composer and is not
// stored here. Phases 2 to 5 are authored.
// ---------------------------------------------------------------------------

export type Slide = {
  heading?: string;
  body: string;
  figure?: string;
};

// Phase 2: one generative prompt that activates prior knowledge before teaching.
export type InquiryCapture = 'text' | 'choice' | 'sandbox';

export type InquiryPrompt = {
  question: string;
  capture: InquiryCapture;
  choices?: { id: string; text: string }[];
  // A key the first explanation slide references so Phase 3 resolves the guess.
  resolvedBy: string;
  screens?: InquiryScreen[];
};

export type InquiryChargeId = 'left' | 'right';

// A predict-then-reveal two-charge box. 'cycle' fixes positions and lets the
// learner change charge values; 'move' fixes charges and lets one charge slide.
// `target` is the change applied at reveal (and the thing the learner predicts).
export type InquiryPredictScreen = {
  kind?: 'predict';
  id: string;
  variable: 'charge' | 'distance';
  mode: 'cycle' | 'move';
  prompt: string;
  left: SandboxCharge;
  right: SandboxCharge;
  target:
    | { apply: 'set-charge'; chargeId: InquiryChargeId; toQ: number }
    | { apply: 'set-distance'; toDistanceFactor: number };
  revealCaption: string;
  note?: string;
};

// A read-and-continue orientation slide (no prediction) shown before the predict
// screens. Used on the first lesson to introduce what charge is: it shows the two
// charges and a short body, then a Continue.
export type InquiryIntroScreen = {
  kind: 'intro';
  id: string;
  heading?: string;
  body: string;
  left: SandboxCharge;
  right: SandboxCharge;
};

// A predict-then-reveal screen for polarization: a charged rod near a neutral
// conductor. The learner predicts the net force on the neutral sphere; the reveal
// shows the induced charge separation and the true (attractive) net force, then
// lets them drag the rod nearer or farther to explore.
export type InquiryPolarizeScreen = {
  kind: 'polarize';
  id: string;
  prompt: string;
  // The charged rod's signed charge; its magnitude sets the glyph count (1 to 3).
  rodCharge: number;
  revealCaption: string;
  note?: string;
};

// A predict-then-reveal screen for charge sharing: a charged conductor and an
// identical neutral one briefly touch. The learner taps the neutral sphere to
// predict its charge afterward; the reveal splits the total evenly. `leftStart`
// is the charged sphere's starting charge in glyph units (the neutral one is 0).
export type InquiryShareScreen = {
  kind: 'share';
  id: string;
  prompt: string;
  leftStart: number;
  revealCaption: string;
  note?: string;
};

export type InquiryFieldSource = { id: string; x: number; y: number; q: number };

// A predict-then-reveal screen for the electric field: one or more source charges
// and a probe point. The learner predicts the field at the probe; the reveal shows
// it. `show: 'net'` draws the single net field arrow (a lone source). `show:
// 'contributions'` draws each source's field at the probe, so two equal-and-opposite
// fields read as a null point. Sources and probe are in a 10 by 6 grid (scaled to
// the scene). `explore: 'move-probe'` lets the learner drag the probe after reveal.
export type InquiryFieldScreen = {
  kind: 'field';
  id: string;
  prompt: string;
  sources: InquiryFieldSource[];
  probe: { x: number; y: number };
  show: 'net' | 'contributions';
  revealCaption: string;
  note?: string;
  explore?: 'move-probe';
};

// A predict-then-reveal screen for electric flux: a uniform field and a surface.
// The learner predicts the flux (a fraction of the maximum, set on a gauge); the
// reveal shows the field lines that cross. `surface: 'plate'` tilts a flat area to
// `tiltDeg` on reveal (flux falls as cos of the tilt). `surface: 'box'` is a closed
// surface whose net flux is zero in a uniform field.
export type InquiryFluxScreen = {
  kind: 'flux';
  id: string;
  prompt: string;
  surface: 'plate' | 'box';
  tiltDeg?: number;
  revealCaption: string;
  note?: string;
};

// A predict-then-reveal screen for Gauss's law: a point charge and a Gaussian
// surface (a loop). The learner predicts the net flux through the loop; the reveal
// shows that it depends only on whether the charge is enclosed. `enclosed: true`
// surrounds the charge (net flux q over epsilon_0); `enclosed: false` puts it
// outside (every line that enters also leaves, net zero).
export type InquiryGaussScreen = {
  kind: 'gauss';
  id: string;
  prompt: string;
  enclosed: boolean;
  revealCaption: string;
  note?: string;
};

export type InquiryScreen =
  | InquiryPredictScreen
  | InquiryIntroScreen
  | InquiryPolarizeScreen
  | InquiryShareScreen
  | InquiryFieldScreen
  | InquiryFluxScreen
  | InquiryGaussScreen;

// Phase 4: one rung of the worked-to-faded ladder. 'worked' reveals the full
// solution and requires a self-explanation answer; 'completion' pre-seeds the
// whiteboard with the first steps; 'skeleton' is near-independent.
export type FadedMode = 'worked' | 'completion' | 'skeleton';

export type FadedItem = {
  mode: FadedMode;
  problemId: string;
  selfExplainPrompt?: string;
  // The canonical worked solution, uncovered one step at a time on the 'worked'
  // rung. Shown on the client because a worked example is a taught artifact.
  solutionSteps?: string[];
  prefilledSteps?: string[];
  // Two worked items sharing a group form an analogical pair (same principle,
  // different surface) shown for comparison.
  analogyGroup?: string;
};

export type LessonModule = {
  lessonId: string;
  lessonNumber: number;
  title: string;
  prerequisites: string[];
  // Skills the Phase 1 composer anchors on (prior lessons; mechanics seeds for
  // lesson 1), most recent first.
  reviewSkillIds: string[];
  // The big ideas this lesson is allowed to cover (ids from principles.ts). Every
  // referenced problem's principleIds must be a subset of this list. The scope
  // guardrail (findScopeViolations / validateLessonScope) enforces it.
  topicPrincipleIds: string[];
  inquiry: InquiryPrompt;
  explanationSlides: Slide[];
  workedSequence: FadedItem[];
  independentProblemIds: string[];
};

const EM_DASH = /\u2014|--/;

function hasEmDash(value: string): boolean {
  return EM_DASH.test(value);
}

/**
 * Returns a list of human-readable violations for a candidate module. An empty
 * list means valid. Pure; no throwing. The five-phase invariants:
 * - 1 or 2 explanation slides, the first referencing inquiry.resolvedBy
 * - every 'worked' faded item carries a selfExplainPrompt
 * - no em dashes anywhere
 */
export function validateLessonModule(module: LessonModule): string[] {
  const errors: string[] = [];

  if (module.explanationSlides.length < 1 || module.explanationSlides.length > 2) {
    errors.push('explanationSlides must have 1 or 2 slides');
  }

  const firstSlide = module.explanationSlides[0];
  if (firstSlide && module.inquiry.resolvedBy && !firstSlide.body.includes(module.inquiry.resolvedBy)) {
    errors.push('first explanation slide must reference inquiry.resolvedBy');
  }

  for (const item of module.workedSequence) {
    if (item.mode === 'worked' && !item.selfExplainPrompt) {
      errors.push(`worked item ${item.problemId} is missing selfExplainPrompt`);
    }
  }

  for (const screen of module.inquiry.screens ?? []) {
    if (screen.kind === 'intro') {
      if (!screen.body.trim()) errors.push(`inquiry screen ${screen.id} is missing body`);
    } else {
      if (!screen.prompt.trim()) errors.push(`inquiry screen ${screen.id} is missing prompt`);
      if (!screen.revealCaption.trim()) errors.push(`inquiry screen ${screen.id} is missing revealCaption`);
    }
  }

  const strings = [
    module.title,
    module.inquiry.question,
    ...(module.inquiry.choices ?? []).map((choice) => choice.text),
    ...module.explanationSlides.flatMap((slide) => [slide.heading ?? '', slide.body]),
    ...module.workedSequence.map((item) => item.selfExplainPrompt ?? ''),
    ...(module.inquiry.screens ?? []).flatMap((s) =>
      s.kind === 'intro' ? [s.heading ?? '', s.body] : [s.prompt, s.revealCaption, s.note ?? ''],
    ),
  ];
  if (strings.some(hasEmDash)) {
    errors.push('module contains an em dash');
  }

  return errors;
}

/**
 * Returns a list of human-readable scope violations for a module: every problem
 * it references (across workedSequence and independentProblemIds) whose
 * principleIds stray outside module.topicPrincipleIds. An empty list means every
 * referenced problem stays within the lesson's declared topic.
 *
 * Pure; the caller passes a resolver so the schema stays free of the problem
 * catalog. Unresolved ids are skipped (an existing test already proves every
 * referenced id resolves), and a problem with no principles contributes nothing.
 */
export function findScopeViolations(
  module: LessonModule,
  resolveProblem: (id: string) => { principleIds: string[] } | undefined,
): string[] {
  const allowed = new Set(module.topicPrincipleIds);
  const errors: string[] = [];
  const referencedIds = [
    ...module.workedSequence.map((item) => item.problemId),
    ...module.independentProblemIds,
  ];

  for (const id of referencedIds) {
    const problem = resolveProblem(id);
    if (!problem) continue;
    for (const principleId of problem.principleIds) {
      if (!allowed.has(principleId)) {
        errors.push(`problem ${id} references off-scope principle ${principleId}`);
      }
    }
  }

  return errors;
}
