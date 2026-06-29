import type { LessonModule } from '../schema';

// Lesson 5, Electric Flux, authored as a full five-phase module in the shape lessons
// 1 to 4 established. Phase 1 (review) is composed at runtime from reviewSkillIds
// (the two prior field lessons). Phases 2 to 5 are authored here: an interactive
// inquiry (flux through a tilted surface, then the net flux through a closed box),
// two explanation slides (flux as field lines through a surface, then closed surfaces
// and Gauss's law with a strategy table), a worked-to-faded ladder (an analogical
// worked pair on the tilted flat area, a completion on the cube, then a skeleton on
// the enclosed point charge), and a Solve phase of three authored independent
// problems plus three personalized problems generated at runtime. Flux as the bridge
// to Gauss's law; no field integrals here.
const electricFlux: LessonModule = {
  lessonId: 'electric-flux',
  lessonNumber: 5,
  title: 'Electric Flux',
  prerequisites: ['electric-fields-of-charge-distributions'],
  // Most recent first: Phase 1 reviews the two prior field lessons.
  reviewSkillIds: ['electric-fields-of-charge-distributions', 'electric-field-field-lines'],
  // Flux of a field through a surface, and the net flux through a closed surface.
  topicPrincipleIds: ['field-concept', 'symmetry-gauss'],
  inquiry: {
    question:
      'A flat loop sits in a uniform field. How much of the field passes through it, and what happens as you tilt the loop?',
    capture: 'text',
    // The first explanation slide must contain this phrase (validateLessonModule).
    resolvedBy: 'the component of the field perpendicular to the surface',
    screens: [
      {
        kind: 'flux',
        id: 'plate-tilt',
        surface: 'plate',
        tiltDeg: 60,
        prompt: 'This flat surface is tilted 60 degrees from facing the field. Drag the gauge to predict the flux through it.',
        revealCaption: 'Tilted 60 degrees, only the perpendicular part counts, so the flux is half the face-on value: cos(60 degrees) = 0.5.',
        note: 'Face-on the flux is the most it can be; edge-on it is zero.',
      },
      {
        kind: 'flux',
        id: 'box-closed',
        surface: 'box',
        prompt: 'This closed box sits in the same uniform field. Drag the gauge to predict the net flux out of it.',
        revealCaption: 'Every line that enters one side leaves the other, so the net flux through a closed surface in a uniform field is zero.',
        note: 'Put a charge inside and the net flux is no longer zero: it becomes Q_enc / epsilon_0.',
      },
    ],
  },
  explanationSlides: [
    {
      heading: 'Flux is field lines through a surface',
      body: 'Electric flux measures how much of the field passes through a surface, like counting the field lines that cross it. For a flat area in a uniform field it is the field times the area times the cosine of the angle between the field and the surface normal.\n\nPhi = E A cos(theta)\n\nThe cosine picks out the component of the field perpendicular to the surface, so the flux is largest face-on and falls to zero edge-on. Flux is measured in N m^2/C.',
    },
    {
      heading: "Closed surfaces and Gauss's law",
      body: "For a closed surface, add the flux through every part, counting flux leaving as positive and entering as negative. In a uniform field every line that enters also leaves, so the net flux is zero. Put a charge inside and field lines begin or end there, so the net flux is no longer zero:\n\nPhi = Q_enc / epsilon_0\n\nThe net flux depends only on the enclosed charge, not the size or shape of the surface. This is Gauss's law.\n\nSurface  Net flux\n- -\nFlat area, face-on  E A; every field line crosses.\nFlat area, tilted  E A cos(theta).\nClosed surface, empty  Zero; every line that enters also leaves.\nClosed surface, charge inside  Q_enc / epsilon_0, whatever the shape.",
    },
  ],
  workedSequence: [
    {
      mode: 'worked',
      problemId: 'flux-flat-tilted',
      selfExplainPrompt: 'Why does tilting the surface reduce the flux through it?',
      analogyGroup: 'flux-orientation',
      solutionSteps: [
        'The flux through a flat area is Phi = E A cos(theta), where theta is the angle between the field and the surface normal.',
        'List the givens: E = 300 N/C, the square has side 0.20 m so A = 0.040 m^2, and theta = 30 degrees.',
        'Find the cosine: cos(30 degrees) = 0.866.',
        'Substitute: Phi = (300)(0.040)(0.866) = 10.4 N m^2/C.',
      ],
    },
    {
      mode: 'worked',
      problemId: 'flux-solve-angle',
      selfExplainPrompt: 'This uses the same law as the previous problem. What did we solve for instead, and why does a cosine get inverted?',
      analogyGroup: 'flux-orientation',
      solutionSteps: [
        'The same relation applies, Phi = E A cos(theta), now with theta the unknown.',
        'Solve for the angle: cos(theta) = Phi / (E A).',
        'Substitute the givens: cos(theta) = 6.0 / ((300)(0.040)) = 6.0 / 12 = 0.50.',
        'Take the inverse cosine: theta = 60 degrees.',
      ],
    },
    {
      mode: 'completion',
      problemId: 'flux-cube-uniform',
      prefilledSteps: [
        'A closed surface adds the flux through every face, counting flux leaving as positive and flux entering as negative.',
        'In a uniform field the field is the same on every face. Decide how the entering flux on one side compares with the leaving flux on the other, then state the net flux through the whole cube.',
      ],
    },
    {
      mode: 'skeleton',
      problemId: 'flux-point-charge-enclosed',
    },
  ],
  independentProblemIds: [
    'flux-net-enclosed-charges',
    'flux-disk-tilted',
    'flux-hemisphere-uniform',
  ],
};

export default electricFlux;
