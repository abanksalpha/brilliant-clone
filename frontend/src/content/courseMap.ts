// The course map for the home path. It mirrors the official AP Physics C:
// Electricity and Magnetism framework (College Board units 8-13) in the
// recommended teaching order, split to the level of the learning objectives
// within each topic (e.g. superposition of forces vs. fields, applying Gauss's
// law) so each node is a single teachable skill.
//
// Only Coulomb's Law ships with real lessons today; every later topic is a
// locked mock until its content is built. A lesson is "live" when its
// `lessonId` is registered in LIVE_LESSONS (see ../progress/dashboardProgress).
// Mock lessons intentionally omit `lessonId`, so the dashboard renders them as
// locked, non-interactive nodes.

export type CourseLesson = {
  title: string;
  // Stable identifier for the teachable skill this node represents. The live
  // lesson reuses its lessonId; every other node uses a kebab-case slug of its
  // title. Problems reference these ids through their skillIds.
  skillId: string;
  lessonId?: string;
  // Fixed problem-set size for a special capstone set (e.g. the final AP exam
  // review). When set, the dashboard shows this count on the problem-set node
  // instead of the generic label. Normal lessons leave it unset and let the
  // composer size their post-lesson set.
  problemSetSize?: number;
};

export type CourseUnit = {
  id: string;
  name: string;
  topic: string;
  lessons: CourseLesson[];
};

export const COURSE_TITLE = 'AP Physics C: Electricity and Magnetism';

export const COURSE_UNITS: CourseUnit[] = [
  {
    id: 'charges-fields-gauss',
    name: "Electric Charges, Fields & Gauss's Law",
    topic: 'Charges & fields',
    lessons: [
      { title: "Coulomb's Law", skillId: 'coulombs-law', lessonId: 'coulombs-law' },
      {
        title: 'Charging, Conductors & Insulators',
        skillId: 'charging-conductors-insulators',
        lessonId: 'charging-conductors-insulators',
      },
      { title: 'Electric Field & Field Lines', skillId: 'electric-field-field-lines', lessonId: 'electric-field-field-lines' },
      {
        title: 'Electric Fields of Charge Distributions',
        skillId: 'electric-fields-of-charge-distributions',
        lessonId: 'electric-fields-of-charge-distributions',
      },
      { title: 'Electric Flux', skillId: 'electric-flux', lessonId: 'electric-flux' },
      { title: "Gauss's Law", skillId: 'gausss-law', lessonId: 'gausss-law' },
      { title: 'Unit Review', skillId: 'charges-fields-gauss-review' },
    ],
  },
  {
    id: 'electric-potential',
    name: 'Electric Potential',
    topic: 'Energy & potential',
    lessons: [
      { title: 'Electric Potential Energy', skillId: 'electric-potential-energy' },
      { title: 'Electric Potential', skillId: 'electric-potential' },
      { title: 'Potential & Field Relationship', skillId: 'potential-field-relationship' },
      { title: 'Conservation of Electric Energy', skillId: 'conservation-of-electric-energy' },
      { title: 'Unit Review', skillId: 'electric-potential-review' },
    ],
  },
  {
    id: 'conductors-capacitors',
    name: 'Conductors & Capacitors',
    topic: 'Conductors & capacitance',
    lessons: [
      { title: 'Electrostatics with Conductors', skillId: 'electrostatics-with-conductors' },
      { title: 'Redistribution of Charge', skillId: 'redistribution-of-charge' },
      { title: 'Capacitors & Capacitance', skillId: 'capacitors-capacitance' },
      { title: 'Capacitor Combinations', skillId: 'capacitor-combinations' },
      { title: 'Dielectrics', skillId: 'dielectrics' },
      { title: 'Unit Review', skillId: 'conductors-capacitors-review' },
    ],
  },
  {
    id: 'electric-circuits',
    name: 'Electric Circuits',
    topic: 'DC circuits',
    lessons: [
      { title: 'Electric Current', skillId: 'electric-current' },
      { title: 'Simple Circuits', skillId: 'simple-circuits' },
      { title: "Resistance, Resistivity & Ohm's Law", skillId: 'resistance-resistivity-ohms-law' },
      { title: 'Electric Power', skillId: 'electric-power' },
      { title: 'Compound DC Circuits', skillId: 'compound-dc-circuits' },
      { title: "Kirchhoff's Rules", skillId: 'kirchhoffs-rules' },
      { title: 'RC Circuits', skillId: 'rc-circuits' },
      { title: 'Unit Review', skillId: 'electric-circuits-review' },
    ],
  },
  {
    id: 'magnetic-fields',
    name: 'Magnetic Fields & Electromagnetism',
    topic: 'Magnetism',
    lessons: [
      { title: 'Magnetic Fields', skillId: 'magnetic-fields' },
      { title: 'Magnetic Force on Charges & Currents', skillId: 'magnetic-force-on-charges-currents' },
      { title: 'Biot-Savart Law', skillId: 'biot-savart-law' },
      { title: "Ampère's Law", skillId: 'amperes-law' },
      { title: 'Unit Review', skillId: 'magnetic-fields-review' },
    ],
  },
  {
    id: 'electromagnetic-induction',
    name: 'Electromagnetic Induction',
    topic: 'Induction',
    lessons: [
      { title: 'Magnetic Flux', skillId: 'magnetic-flux' },
      { title: "Faraday's & Lenz's Laws", skillId: 'faradays-lenzs-laws' },
      { title: 'Induced Currents & Motional EMF', skillId: 'induced-currents-motional-emf' },
      { title: 'Inductance', skillId: 'inductance' },
      { title: 'LR & LC Circuits', skillId: 'lr-lc-circuits' },
    ],
  },
  {
    id: 'final-review',
    name: 'Final Review',
    topic: 'Exam prep',
    lessons: [
      { title: 'Final Review', skillId: 'the-ap-exam', problemSetSize: 50 },
      { title: 'Last Advice', skillId: 'last-advice' },
    ],
  },
];

export const COURSE_LESSON_TOTAL = COURSE_UNITS.reduce((total, unit) => total + unit.lessons.length, 0);

// All lessons flattened in course (teaching) order. The index of a lesson here
// is the timeline "position": a learner who has completed N lessons sits on the
// node at index N (their first not-yet-completed lesson).
export const COURSE_LESSONS_FLAT: CourseLesson[] = COURSE_UNITS.flatMap((unit) => unit.lessons);

/** Human-readable label for the lesson a learner with `completedCount` is on. */
export function lessonLabelAtIndex(completedCount: number): string {
  if (completedCount >= COURSE_LESSONS_FLAT.length) {
    return 'Finished the course';
  }
  return COURSE_LESSONS_FLAT[Math.max(0, completedCount)]?.title ?? 'Just getting started';
}
