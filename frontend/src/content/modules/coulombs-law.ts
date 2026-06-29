import type { LessonModule } from '../schema';

// Lesson 1, Coulomb's Law, authored as a full five-phase module. Phase 1 (review)
// is composed at runtime from reviewSkillIds, which point at the mechanics seed
// problems (forces, energy, kinematics). Phases 2 to 5 are authored here: a quick
// inquiry, two explanation slides (the law with its typeset equation tied back to
// the inquiry, then a strategy table for the different problem types), a
// worked-to-faded ladder of four rungs: two fully worked examples (the force
// equation, then proportional scaling) followed by two scaffolded completions
// (superposition along a line, then net force in two dimensions), and a
// Solve phase of three authored independent problems plus three personalized
// problems generated at runtime. Everything stays inside Coulomb's law,
// the force between point charges: no electric field, potential, energy, or flux.
// Every referenced problemId resolves through getProblemById, each has a verified
// server key, and every problem's principles stay within topicPrincipleIds (the
// scope guardrail validateLessonScope enforces it).
const coulombsLaw: LessonModule = {
  lessonId: 'coulombs-law',
  lessonNumber: 1,
  title: "Coulomb's Law",
  prerequisites: [],
  // Most recent first: the mechanics prerequisites the Phase 1 review pulls from.
  reviewSkillIds: ['mechanics-forces', 'mechanics-energy', 'mechanics-kinematics'],
  // Coulomb's law only: the force between point charges and its superposition.
  topicPrincipleIds: ['coulomb-force', 'superposition'],
  inquiry: {
    question:
      'Two charges sit a short distance apart. If you double the distance between them, what happens to the force between them?',
    capture: 'text',
    // The first explanation slide must contain this phrase (validateLessonModule).
    // It is the concept the distance screen reveals; it is never shown to the learner.
    resolvedBy: 'inversely proportional to the square of the distance',
    screens: [
      {
        kind: 'intro',
        id: 'intro',
        heading: 'What is charge?',
        body: 'Electric charge is a basic property of matter, like mass, and it comes in two kinds, positive and negative. It is carried by the tiny particles inside atoms: protons are positive and electrons are negative. An object is negative when it gains extra electrons, positive when it loses some, and neutral when the two balance.\n\nCharges push and pull on each other even across empty space, and centuries of experiments point to one simple rule: like charges repel and opposite charges attract.',
        left: { id: 'left', x: 3, y: 3, q: 1 },
        right: { id: 'right', x: 7, y: 3, q: -1 },
      },
      {
        id: 'charge',
        variable: 'charge',
        mode: 'cycle',
        prompt: 'These two charges repel. Predict the force if you triple the right charge.',
        left: { id: 'left', x: 3, y: 3, q: 1 },
        right: { id: 'right', x: 7, y: 3, q: 1 },
        target: { apply: 'set-charge', chargeId: 'right', toQ: 3 },
        revealCaption: 'Triple a charge and the force triples. The force grows with each charge.',
        note: 'Notice both arrows stay equal and opposite, even when the charges differ.',
      },
      {
        id: 'distance',
        variable: 'distance',
        mode: 'move',
        prompt: 'Predict the force on the left charge if the right charge moves twice as far away.',
        left: { id: 'left', x: 2, y: 3, q: 2 },
        right: { id: 'right', x: 4, y: 3, q: 2 },
        target: { apply: 'set-distance', toDistanceFactor: 2 },
        revealCaption: 'Double the distance and the force drops to a quarter, not a half.',
      },
    ],
  },
  explanationSlides: [
    {
      heading: "Coulomb's law",
      body: "Coulomb's law states that the electric force between two point charges is proportional to each charge and inversely proportional to the square of the distance. Written as an equation,\n\nF = k q_1 q_2 / r^2\n\nwhere k = 8.99 × 10⁹ N·m²/C² is Coulomb's constant, q₁ and q₂ are the two charge magnitudes in coulombs, r is the distance between them in meters, and F is the force in newtons.\n\nEach part of the equation is something you just saw: the charges on top are why tripling one charge tripled the force, and the r² underneath is why doubling the distance dropped the force to a quarter, not a half.",
    },
    {
      heading: "Using Coulomb's law",
      body: "Every problem here is one move repeated: find the force between a single pair of charges, then combine when more than one charge acts. The case you are in tells you what to do.\n\nProblem  What to do\n- -\nTwo charges  Size from the equation, direction from the signs (like charges apart, opposite together), along the line joining them.\nSeveral charges  Find each pairwise force on its own, then add them as vectors. In two dimensions, split into x and y components first.\nScaling a charge or distance  Use the proportions instead of recomputing: the force scales with each charge and with one over the distance squared.\nEquilibrium  Set the total force on the charge to zero and solve for the unknown.",
    },
  ],
  workedSequence: [
    {
      mode: 'worked',
      problemId: 'cl-coulomb-force-two-charges',
      selfExplainPrompt: 'Why does halving the distance multiply the force by four?',
      analogyGroup: 'inverse-square',
      solutionSteps: [
        'Identify the governing relation: Coulomb law gives the force magnitude F = k q_1 q_2 / r^2.',
        'List the givens: k = 8.99e9 N m^2/C^2, q_1 = 2.0e-6 C, q_2 = 3.0e-6 C, r = 0.10 m.',
        'Square the separation: r^2 = (0.10 m)^2 = 0.010 m^2.',
        'Substitute and compute: F = (8.99e9)(2.0e-6)(3.0e-6) / 0.010 = 5.4 N.',
      ],
    },
    {
      mode: 'worked',
      problemId: 'cl-coulomb-scaling',
      selfExplainPrompt:
        'We never used the actual charges or the original distance, only their ratio. Why does cutting the separation to one third multiply the force by nine instead of three?',
      analogyGroup: 'inverse-square',
      solutionSteps: [
        'Identify the governing relation: Coulomb law gives F = k q_1 q_2 / r^2, and the two charges do not change, so the force is proportional to 1 / r^2.',
        'List the givens: the original force is 0.080 N and the new separation is one third of the original, r_new = r / 3.',
        'Compare with the proportion instead of recomputing: squaring r / 3 gives r^2 / 9, and dividing by one ninth multiplies the force by 9.',
        'Apply the factor: F_new = 9 (0.080 N) = 0.72 N.',
      ],
    },
    {
      mode: 'completion',
      problemId: 'cl-coulomb-collinear-net',
      prefilledSteps: [
        'Set up the geometry: the middle +3.0 microcoulomb charge is pushed by each neighbor. The +6.0 microcoulomb charge sits 0.20 m to its left and pushes it right; the +2.0 microcoulomb charge sits 0.30 m to its right and pushes it left.',
        'Find each pairwise force from Coulomb law F = k q_1 q_2 / r^2, then decide how the two opposite pushes combine into the net force.',
      ],
    },
    {
      mode: 'completion',
      problemId: 'cl-coulomb-triangle-net',
      prefilledSteps: [
        'Set up the geometry: pick one +5.0 microcoulomb charge. The other two each sit 0.20 m away, and from your chosen charge the two directions are 60 degrees apart (the angles of an equilateral triangle).',
        'By symmetry the two repulsions are equal, F = k q^2 / r^2. Find that magnitude, then add the two force vectors by components and use the symmetry to get the net force and its direction.',
      ],
    },
  ],
  independentProblemIds: [
    'cl-coulomb-net-2d',
    'cl-coulomb-equilibrium',
    'cl-coulomb-square-corner-net',
  ],
};

export default coulombsLaw;
