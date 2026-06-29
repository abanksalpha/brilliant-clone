import type { LessonModule } from '../schema';

// Lesson 2, Charging, Conductors & Insulators, authored as a full five-phase
// module in the same shape as Lesson 1 (coulombs-law.ts). Phase 1 (review) is
// composed at runtime from reviewSkillIds, which anchor on the prior lesson
// (Coulomb's law) plus a mechanics seed. Phases 2 to 5 are authored here: a
// generative inquiry whose guess the first explanation slide resolves, two
// explanation slides (conductors vs insulators and polarization, then the three
// charging methods and grounding), a worked-to-faded ladder (an analogical
// worked pair on conductor charge sharing, then a completion rung, then a
// skeleton rung), and a Solve phase of three authored independent problems (plus
// three personalized problems generated at runtime) on conductor
// electrostatics. Every referenced problemId resolves to an authored client
// Problem and a verified server key.
const chargingConductorsInsulators: LessonModule = {
  lessonId: 'charging-conductors-insulators',
  lessonNumber: 2,
  title: 'Charging, Conductors & Insulators',
  prerequisites: ['coulombs-law'],
  // Most recent first: Phase 1 reviews the prior lesson, then a mechanics seed.
  reviewSkillIds: ['coulombs-law', 'mechanics-forces'],
  // Conductor electrostatics only: charge on conductors and how it redistributes,
  // plus the Coulomb force the share-then-force capstone reaches back to. Field and
  // potential belong to later lessons, so they stay out. validateLessonScope enforces it.
  topicPrincipleIds: ['conductor-equilibrium', 'coulomb-force'],
  inquiry: {
    question:
      'You rub a balloon on your hair, then hold it near a wall that carries no net charge. The balloon sticks. Why does a neutral wall pull on the balloon?',
    capture: 'text',
    resolvedBy: 'polarization',
    screens: [
      {
        kind: 'polarize',
        id: 'polarize',
        prompt: 'A positively charged rod is brought near this neutral metal sphere. Drag the arrow to predict the net force the sphere feels.',
        rodCharge: 3,
        revealCaption: 'The near side turns negative and sits closer, so its pull beats the far side push. A neutral sphere is drawn in.',
        note: 'The sphere is still neutral overall; only its charges have shifted.',
      },
      {
        kind: 'share',
        id: 'share',
        prompt: 'The left sphere is charged and the right is neutral. They are identical and briefly touch. Tap the right sphere to predict its charge afterward.',
        leftStart: 2,
        revealCaption: 'Identical spheres share the total evenly, so each ends with half. The charged and neutral spheres come out the same.',
        note: 'Charge is conserved: the total is the same before and after, just shared between the two.',
      },
    ],
  },
  explanationSlides: [
    {
      heading: 'Conductors, insulators, and polarization',
      body: 'Conductors like metals have free electrons that roam through the material, while insulators like rubber and glass hold their electrons bound to each atom. Bring a charged object near a neutral one and its charges shift slightly, a separation called polarization. The near side takes the opposite charge and sits closer. The Coulomb force between two charges\n\nF = k q_1 q_2 / r^2\n\nfalls off with the square of the distance, so the shorter distance on the near side makes its attraction beat the far side repulsion, and the neutral object is pulled in.',
    },
    {
      heading: 'Three ways to charge, and grounding',
      body: 'Friction rubs electrons from one material onto another. Conduction touches a charged object to a conductor and leaves it the same sign. Induction charges with no contact: hold a charge nearby, ground the conductor so electrons flow to or from the earth, then remove the ground before the charge, which leaves the opposite sign. Excess charge on a conductor always spreads out and rides the outer surface.\n\nMethod  What happens\n- -\nFriction or conduction  The object keeps the same sign.\nInduction, ground then remove  The object ends the opposite sign.\nTwo conductors touch  Charge splits in proportion to size.\nExcess on a conductor  It rides the outer surface.',
    },
  ],
  workedSequence: [
    {
      mode: 'worked',
      problemId: 'cci-share-identical-spheres',
      selfExplainPrompt: 'Why does touching two identical spheres leave each one holding half of the total charge?',
      analogyGroup: 'conductor-sharing',
      solutionSteps: [
        'Identify the principle: two identical conductors that touch share their charge until both reach the same potential, which for equal spheres means equal charge.',
        'List the givens: sphere A holds +8.0 nC, sphere B is neutral, and the two spheres are identical.',
        'Conserve charge: the total is +8.0 nC + 0 = +8.0 nC, and it splits evenly between the two equal spheres.',
        'Divide: each sphere ends with (8.0 nC) / 2 = +4.0 nC.',
      ],
    },
    {
      mode: 'worked',
      problemId: 'cci-share-unequal-spheres',
      selfExplainPrompt: 'What is the same about this sharing and the equal spheres before it?',
      analogyGroup: 'conductor-sharing',
      solutionSteps: [
        'Identify the principle: two conductors joined by a wire share charge until it is distributed in proportion to their size, so each sphere holds charge in proportion to its radius.',
        'List the givens: the radii are in the ratio 1 to 2 and the total charge is +9.0 nC.',
        'Split in proportion to radius: the charges divide as 1 to 2, so the larger sphere takes two thirds of the total.',
        'Compute: the larger sphere ends with (2/3)(9.0 nC) = +6.0 nC.',
      ],
    },
    {
      mode: 'completion',
      problemId: 'cci-share-three-spheres',
      prefilledSteps: [
        'First touch: sphere A (+12 nC) meets the identical neutral sphere B, so the +12 nC splits evenly and each leaves with +6.0 nC.',
        'Now sphere B (+6.0 nC) is about to touch the identical neutral sphere C. Decide how this second sharing splits the charge, then read off sphere C.',
      ],
    },
    {
      mode: 'skeleton',
      problemId: 'cci-share-then-force',
    },
  ],
  independentProblemIds: [
    'cci-share-opposite-signs',
    'cci-shell-surface-charges',
    'cci-surface-charge-density',
  ],
};

export default chargingConductorsInsulators;
