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
  lessonId?: string;
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
      { title: "Coulomb's Law", lessonId: 'coulombs-law' },
      { title: 'Superposition of Electric Forces' },
      { title: 'Charging, Conductors & Insulators' },
      { title: 'Electric Field & Field Lines' },
      { title: 'Electric Fields of Charge Distributions' },
      { title: 'Electric Flux' },
      { title: "Gauss's Law" },
    ],
  },
  {
    id: 'electric-potential',
    name: 'Electric Potential',
    topic: 'Energy & potential',
    lessons: [
      { title: 'Electric Potential Energy' },
      { title: 'Electric Potential' },
      { title: 'Potential & Field Relationship' },
      { title: 'Conservation of Electric Energy' },
    ],
  },
  {
    id: 'conductors-capacitors',
    name: 'Conductors & Capacitors',
    topic: 'Conductors & capacitance',
    lessons: [
      { title: 'Electrostatics with Conductors' },
      { title: 'Redistribution of Charge' },
      { title: 'Capacitors & Capacitance' },
      { title: 'Capacitor Combinations' },
      { title: 'Dielectrics' },
    ],
  },
  {
    id: 'electric-circuits',
    name: 'Electric Circuits',
    topic: 'DC circuits',
    lessons: [
      { title: 'Electric Current' },
      { title: 'Simple Circuits' },
      { title: "Resistance, Resistivity & Ohm's Law" },
      { title: 'Electric Power' },
      { title: 'Compound DC Circuits' },
      { title: "Kirchhoff's Loop Rule" },
      { title: "Kirchhoff's Junction Rule" },
      { title: 'RC Circuits' },
    ],
  },
  {
    id: 'magnetic-fields',
    name: 'Magnetic Fields & Electromagnetism',
    topic: 'Magnetism',
    lessons: [
      { title: 'Magnetic Fields' },
      { title: 'Magnetic Force on Moving Charges' },
      { title: 'Magnetic Force on Currents' },
      { title: 'Biot–Savart Law' },
      { title: "Ampère's Law" },
    ],
  },
  {
    id: 'electromagnetic-induction',
    name: 'Electromagnetic Induction',
    topic: 'Induction',
    lessons: [
      { title: 'Magnetic Flux' },
      { title: "Faraday's & Lenz's Laws" },
      { title: 'Induced Currents & Motional EMF' },
      { title: 'Inductance' },
      { title: 'LR Circuits' },
      { title: 'LC Circuits' },
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
