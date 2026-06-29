import type { LessonModule } from '../schema';

// Lesson 6, Gauss's Law, authored as a full five-phase module in the shape lessons 1
// to 5 established. Phase 1 (review) is composed at runtime from reviewSkillIds (the
// two prior field lessons). Phases 2 to 5 are authored here: an interactive inquiry
// (net flux depends only on the enclosed charge), two explanation slides (Gauss's law,
// then using symmetry to find the field, with a strategy table), a worked-to-faded
// ladder (an analogical worked pair on the sphere and the sheet, a completion on a
// conductor surface, then a skeleton inside a solid sphere), and a Solve phase of
// three authored independent problems plus three personalized problems generated at
// runtime.
const gausssLaw: LessonModule = {
  lessonId: 'gausss-law',
  lessonNumber: 6,
  title: "Gauss's Law",
  prerequisites: ['electric-flux'],
  // Most recent first: Phase 1 reviews flux, then charge distributions.
  reviewSkillIds: ['electric-flux', 'electric-fields-of-charge-distributions'],
  // Gauss's law: the net flux through a closed surface and the field it yields.
  topicPrincipleIds: ['symmetry-gauss', 'field-concept'],
  inquiry: {
    question:
      'A field line goes wherever the field points. How many net lines pass out through a closed surface, and what decides that number?',
    capture: 'text',
    // The first explanation slide must contain this phrase (validateLessonModule).
    resolvedBy: 'depends only on the charge inside',
    screens: [
      {
        kind: 'gauss',
        id: 'charge-inside',
        enclosed: true,
        prompt: 'A point charge sits at the center of this loop. Drag the gauge to predict the net flux out through the loop.',
        revealCaption: "All of the charge is enclosed, so by Gauss's law the net flux is Q / epsilon_0: every field line leaves through the loop.",
        note: 'Grow or shrink the loop and the net flux stays the same; only the enclosed charge matters.',
      },
      {
        kind: 'gauss',
        id: 'charge-outside',
        enclosed: false,
        prompt: 'Now the same charge sits outside the loop. Drag the gauge to predict the net flux out through the loop.',
        revealCaption: 'With no charge inside, every field line that enters one side leaves the other, so the net flux is zero.',
        note: 'A charge outside a closed surface never changes the net flux through it.',
      },
    ],
  },
  explanationSlides: [
    {
      heading: "Gauss's law",
      body: "Gauss's law says the net electric flux through any closed surface equals the enclosed charge divided by epsilon_0.\n\nPhi = Q_enc / epsilon_0\n\nThe flux depends only on the charge inside, not on the size or shape of the surface and not on any charge outside. To find it, add up E times area over the whole closed surface; that total is the net flux Phi.",
    },
    {
      heading: 'Using symmetry to find the field',
      body: "Gauss's law becomes a tool when the charge is symmetric. Pick a Gaussian surface where the field is constant and points straight through it, so the flux is simply the field times the area, E A. Set that equal to the enclosed charge over epsilon_0 and solve for the field.\n\nE = Q_enc / epsilon_0 A\n\nWhich surface to pick follows from the symmetry:\n\nSymmetry  Gaussian surface  Field magnitude\n- - -\nSphere of charge  Sphere  Outside, E = k Q / r^2; inside a shell, E = 0\nLong line  Cylinder  E = 2 k lambda / r, falling off as 1/r\nSheet or plane  Pillbox  E = sigma / (2 epsilon_0), the same at any distance\nConductor  Pillbox  Just outside, E = sigma / epsilon_0; inside, E = 0",
    },
  ],
  workedSequence: [
    {
      mode: 'worked',
      problemId: 'gauss-sphere-outside',
      selfExplainPrompt: 'Why does the whole sphere of charge act like a point charge at its center?',
      analogyGroup: 'gauss-symmetry',
      solutionSteps: [
        'Pick a Gaussian sphere of radius r through the point. By symmetry the field is the same size everywhere on it and points straight out, so the flux is E times the area, E (4 pi r^2).',
        'Set that flux equal to the enclosed charge over epsilon_0: E (4 pi r^2) = Q / epsilon_0.',
        'Solve for E and write 1 / (4 pi epsilon_0) as k: E = k Q / r^2, the same as a point charge at the center.',
        'Substitute Q = 8.0e-9 C and r = 0.20 m: E = (8.99e9)(8.0e-9) / (0.20)^2 = 1.80e3 N/C.',
      ],
    },
    {
      mode: 'worked',
      problemId: 'gauss-infinite-sheet',
      selfExplainPrompt: 'This rests on the same Gauss\'s law idea as the sphere. Why is the field the same at every distance from the sheet?',
      analogyGroup: 'gauss-symmetry',
      solutionSteps: [
        'Pick a Gaussian pillbox poking through the sheet, with end caps of area A on each side. By symmetry the field points straight out of both caps, so the flux is E times 2A.',
        'The enclosed charge is sigma A, so E (2A) = sigma A / epsilon_0.',
        'The area cancels: E = sigma / (2 epsilon_0), which does not depend on the distance from the sheet.',
        'Substitute sigma = 4.0e-8 C/m^2: E = 4.0e-8 / ((2)(8.85e-12)) = 2.26e3 N/C.',
      ],
    },
    {
      mode: 'completion',
      problemId: 'gauss-conductor-surface',
      prefilledSteps: [
        'Just outside a conductor the field is perpendicular to the surface, and the field inside the metal is zero, so a small pillbox has flux only through its outer cap, E times A.',
        'The enclosed charge is sigma A. Set E A = sigma A / epsilon_0, solve for E, then substitute sigma = 5.0e-8 C/m^2.',
      ],
    },
    {
      mode: 'skeleton',
      problemId: 'gauss-solid-sphere-inside',
    },
  ],
  independentProblemIds: [
    'gauss-two-sheets',
    'gauss-infinite-line',
    'gauss-shell-inside',
  ],
};

export default gausssLaw;
