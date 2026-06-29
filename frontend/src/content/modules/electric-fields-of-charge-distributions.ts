import type { LessonModule } from '../schema';

// Lesson 4, Electric Fields of Charge Distributions, authored as a full five-phase
// module in the shape lessons 1 to 3 established. Phase 1 (review) is composed at
// runtime from reviewSkillIds (the two prior field lessons). Phases 2 to 5 are
// authored here: an interactive inquiry (build the field of many charges by
// superposition, then a symmetric null), two explanation slides (build the field
// from pieces, then use symmetry to integrate, with a strategy table), a
// worked-to-faded ladder (an analogical worked pair on the ring and the arc, a
// completion on the rod bisector, then a skeleton on the infinite line), and a
// Solve phase of three authored independent problems plus three personalized
// problems generated at runtime. This is the first calculus lesson: every problem
// integrates dE = k dq / r^2 over a shape. Continuous distributions, point-charge
// pieces only.
const electricFieldsOfChargeDistributions: LessonModule = {
  lessonId: 'electric-fields-of-charge-distributions',
  lessonNumber: 4,
  title: 'Electric Fields of Charge Distributions',
  prerequisites: ['electric-field-field-lines'],
  // Most recent first: Phase 1 reviews the two prior field lessons.
  reviewSkillIds: ['electric-field-field-lines', 'charging-conductors-insulators'],
  // Continuous distributions are the superposition of point-charge field pieces.
  topicPrincipleIds: ['field-concept', 'superposition'],
  inquiry: {
    question:
      'A charged rod is really many tiny charges in a line. How would you find the electric field it makes at a nearby point?',
    capture: 'text',
    // The first explanation slide must contain this phrase (validateLessonModule).
    resolvedBy: 'sum of the field from every piece',
    screens: [
      {
        kind: 'field',
        id: 'rod-superposition',
        prompt: 'These charges form a short rod. Drag the arrow to predict the electric field at the open point to its right.',
        sources: [
          { id: 'p1', x: 3, y: 1.5, q: 1 },
          { id: 'p2', x: 3, y: 2.25, q: 1 },
          { id: 'p3', x: 3, y: 3, q: 1 },
          { id: 'p4', x: 3, y: 3.75, q: 1 },
          { id: 'p5', x: 3, y: 4.5, q: 1 },
        ],
        probe: { x: 6.5, y: 3 },
        show: 'net',
        revealCaption: 'Each piece adds its own field, and across from the center the sideways parts cancel, leaving a net field straight out from the rod.',
        note: 'The field is the vector sum of the field from every piece.',
        explore: 'move-probe',
      },
      {
        kind: 'field',
        id: 'ring-center',
        prompt: 'Now the charge is spread evenly around a ring. Drag the arrow to predict the field at the center.',
        sources: [
          { id: 'r0', x: 6.84, y: 3, q: 1 },
          { id: 'r1', x: 5.92, y: 4.91, q: 1 },
          { id: 'r2', x: 4.08, y: 4.91, q: 1 },
          { id: 'r3', x: 3.16, y: 3, q: 1 },
          { id: 'r4', x: 4.08, y: 1.09, q: 1 },
          { id: 'r5', x: 5.92, y: 1.09, q: 1 },
        ],
        probe: { x: 5, y: 3 },
        show: 'contributions',
        revealCaption: 'Every piece pushes its field outward, and around a symmetric ring those pushes cancel in pairs. The field at the center is zero.',
        note: 'Symmetry decides what survives: pieces that pair off cancel.',
      },
    ],
  },
  explanationSlides: [
    {
      heading: 'Build the field from pieces',
      body: 'A charge spread over a region is the sum of many tiny pieces, and the field is the sum of the field from every piece. Break the charge into bits dq, each setting up its own field that points away from a positive bit, and add them as vectors.\n\ndE = k dq / r^2\n\nFor a line use dq = lambda dx, for a surface dq = sigma dA. The law for each piece is the same inverse square field you already know; the work is the geometry of adding them up.',
    },
    {
      heading: 'Use symmetry, then integrate',
      body: 'Symmetry is the shortcut. On the axis of a ring or the perpendicular bisector of a rod, the sideways pieces pair off and cancel, so only the component along the symmetry axis survives.\n\ndE_axis = k dq cos(theta) / r^2\n\nIntegrate that surviving component: set it up, pull the constants out, and add over the shape.\n\nShape  What to do\n- -\nRing on its axis  Only the axial component survives; the sideways parts cancel.\nLine or rod  Break it into pieces and add their fields; up close it falls off more slowly than a point charge.\nSymmetric shapes  Cancel the parts that pair off, then integrate only what is left.\nFar away  Any finite charge looks like a single point charge.',
    },
  ],
  workedSequence: [
    {
      mode: 'worked',
      problemId: 'efcd-ring-axis',
      selfExplainPrompt: 'Why does only the axial component survive on the axis of the ring?',
      analogyGroup: 'efcd-integrate-symmetry',
      solutionSteps: [
        'Set up the symmetry: on the axis, every piece has a partner across the ring whose sideways field cancels, so only the component along the axis survives.',
        'Each piece sits the same distance sqrt(x^2 + R^2) from the point, and the axial fraction is x / sqrt(x^2 + R^2), so summing dq over the ring gives E = k Q x / (x^2 + R^2)^(3/2).',
        'List the givens: Q = 5.0e-9 C, R = 0.10 m, x = 0.15 m, so x^2 + R^2 = 0.0325 m^2.',
        'Substitute and compute: E = (8.99e9)(5.0e-9)(0.15) / (0.0325)^(3/2), which gives E = 1.15e3 N/C pointing along the axis away from the ring.',
      ],
    },
    {
      mode: 'worked',
      problemId: 'efcd-arc-center',
      selfExplainPrompt: 'This uses the same method as the ring. What cancels here, and where does the factor of 2 come from?',
      analogyGroup: 'efcd-integrate-symmetry',
      solutionSteps: [
        'Set up the symmetry: at the center, the components along the arc cancel and only the component along the symmetry axis survives, dE_axis = dE sin(theta).',
        'Each piece is a distance R away with dq = lambda R d theta, so E = integral of (k lambda / R) sin(theta) d theta from 0 to pi.',
        'The integral of sin over 0 to pi is 2, so E = 2 k lambda / R, with lambda = Q / (pi R) = 6.0e-9 / (pi)(0.050) = 3.82e-8 C/m for a semicircle.',
        'Substitute: E = 2 (8.99e9)(3.82e-8) / 0.050, which gives E = 1.37e4 N/C along the symmetry axis.',
      ],
    },
    {
      mode: 'completion',
      problemId: 'efcd-rod-bisector',
      prefilledSteps: [
        'By symmetry only the perpendicular component survives. With dq = lambda dx (lambda = Q / L) and each piece a distance sqrt(y^2 + x^2) away, the perpendicular component integrates to E = k Q / (y sqrt(y^2 + (L/2)^2)).',
        'List the givens: Q = 8.0e-9 C, L = 0.20 m, y = 0.060 m, so L/2 = 0.10 m. Now substitute and compute E.',
      ],
    },
    {
      mode: 'skeleton',
      problemId: 'efcd-infinite-line',
    },
  ],
  independentProblemIds: [
    'efcd-disk-axis',
    'efcd-rod-end-axis',
    'efcd-quarter-arc-center',
  ],
};

export default electricFieldsOfChargeDistributions;
