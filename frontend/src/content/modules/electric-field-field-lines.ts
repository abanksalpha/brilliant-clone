import type { LessonModule } from '../schema';

// Lesson 3, Electric Field & Field Lines, authored as a full five-phase module in
// the exact shape Lesson 1 established. Phase 1 (review) is composed at runtime from
// reviewSkillIds, which point at the two prior electrostatics lessons (Charging,
// then Coulomb). Phases 2 to 5 are authored here: a generative inquiry, two
// explanation slides, a worked-to-faded ladder (an analogical worked pair on the
// point-charge field, then a completion rung on E = F / q, then a skeleton on
// superposition), and a Solve phase of three authored independent problems plus
// three personalized problems generated at runtime. Every referenced
// problemId has a client Problem JSON in ../problems and a verified server key in
// backend/functions/src/problemKeys. Point charges only.
const electricFieldFieldLines: LessonModule = {
  lessonId: 'electric-field-field-lines',
  lessonNumber: 3,
  title: 'Electric Field & Field Lines',
  prerequisites: ['charging-conductors-insulators'],
  // Most recent first: Phase 1 reviews the two prior electrostatics lessons.
  reviewSkillIds: ['charging-conductors-insulators', 'coulombs-law'],
  // Field problems plus their superposition; coulomb-force is the prior idea
  // behind F = qE. Passes the scope guardrail as-is.
  topicPrincipleIds: ['field-concept', 'superposition', 'coulomb-force'],
  inquiry: {
    question:
      'Two charges pull on each other across an empty gap without ever touching. What do you think actually reaches across the gap to pull on the other charge?',
    capture: 'text',
    resolvedBy: 'fills the space around it',
    screens: [
      {
        kind: 'field',
        id: 'point-field',
        prompt: 'A positive charge sits on the left. Drag the arrow to predict the electric field at the open point to its right.',
        sources: [{ id: 'source', x: 3, y: 3, q: 1 }],
        probe: { x: 7, y: 3 },
        show: 'net',
        revealCaption: 'The field points away from the positive charge and weakens with distance, dropping to a quarter when the distance doubles.',
        note: 'The field is there whether or not anything sits at the point; it fills the space around the charge.',
        explore: 'move-probe',
      },
      {
        kind: 'field',
        id: 'null-point',
        prompt: 'Now two equal positive charges flank the point. Drag the arrow to predict the field exactly between them.',
        sources: [
          { id: 'left', x: 2.5, y: 3, q: 1 },
          { id: 'right', x: 7.5, y: 3, q: 1 },
        ],
        probe: { x: 5, y: 3 },
        show: 'contributions',
        revealCaption: 'Each charge pushes its field outward, so at the midpoint they are equal and opposite and cancel. The field is zero, a null point.',
        note: 'Fields add as vectors, so two equal pushes in opposite directions sum to nothing.',
      },
    ],
  },
  explanationSlides: [
    {
      heading: 'The field fills the space',
      body: 'Nothing has to touch. A source charge sets up an electric field that fills the space around it, and a second charge feels only the local field where it sits, not the distant charge directly. The field is what reaches across the gap.\n\nIt is defined as the force per unit positive charge, measured in newtons per coulomb:\n\nE = F / q\n\nIts value at a point does not depend on the charge you probe with: a bigger test charge feels a bigger force but reports the same field.',
    },
    {
      heading: 'Reading the field',
      body: 'A single point charge sets up a field that points away from a positive charge and toward a negative one. Its magnitude follows the inverse square law again, now for one charge:\n\nE = k Q / r^2\n\nFields add as vectors, so the net field is the vector sum from every source, and between two like charges there is a null point where the field cancels.\n\nField lines picture this: a line is tangent to the field, lines start on positive charges and end on negative ones, they never cross, and they crowd together where the field is strong. A charge dropped into a field feels F = q*E, along the field if positive and opposite it if negative, so a field line shows the direction of the force, not the path the charge would travel.\n\nSituation  What to do\n- -\nOne point charge  The field points away from a positive charge and toward a negative one, weakening as one over distance squared.\nSeveral charges  Add the field vectors, splitting into components in two dimensions; a null point is where they cancel.\nField from a force  Divide the measured force by the charge.\nForce on a charge  Along the field for a positive charge, opposite it for a negative one.',
    },
  ],
  workedSequence: [
    {
      mode: 'worked',
      problemId: 'eff-field-point-charge-nc',
      selfExplainPrompt: 'Why does the field drop to a quarter of its value when you double the distance?',
      analogyGroup: 'eff-field-inverse-square',
      solutionSteps: [
        'Identify the relation: a single point charge sets up a field of magnitude E = k Q / r^2.',
        'Convert to base units: Q = 30 nanocoulomb = 30e-9 C and r = 5.0 cm = 0.050 m.',
        'Square the distance: r^2 = (0.050 m)^2 = 2.5e-3 m^2.',
        'Substitute and compute: E = (8.99e9)(30e-9) / 2.5e-3 = 1.08e5 N/C, pointing away from the charge.',
      ],
    },
    {
      mode: 'worked',
      problemId: 'eff-field-solve-distance',
      selfExplainPrompt:
        'This uses the same law as the previous problem. What changed, and why does a square root appear?',
      analogyGroup: 'eff-field-inverse-square',
      solutionSteps: [
        'Identify the relation: the field of a point charge is E = k Q / r^2, with E and Q known and r the unknown.',
        'Solve for the distance: r = sqrt(k Q / E).',
        'Substitute the givens: r = sqrt((8.99e9)(2.0e-6) / 5.0e5) = sqrt(0.036 m^2).',
        'Take the square root: r = 0.19 m.',
      ],
    },
    {
      mode: 'completion',
      problemId: 'eff-field-from-force',
      prefilledSteps: [
        'The field is the force per unit positive charge, so the relation is E = F / q, not F = q E. The force is measured and the field is what you want.',
        'List the givens: F = 0.18 N on a test charge of q = 2.0e-6 C. Now finish the division.',
      ],
    },
    {
      mode: 'skeleton',
      problemId: 'eff-field-collinear-net',
    },
  ],
  independentProblemIds: [
    'eff-field-null-point',
    'eff-field-perp-bisector',
    'eff-field-then-force',
  ],
};

export default electricFieldFieldLines;
