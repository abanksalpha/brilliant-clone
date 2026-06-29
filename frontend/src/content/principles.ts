// The big ideas of AP Physics C: Electricity and Magnetism. A principle is the
// conceptual through line a problem exercises, independent of the specific skill
// or lesson. The composer tags each problem with the principles it touches so it
// can balance a set across ideas and assemble synthesis problems that span them.

export type Principle = {
  id: string;
  name: string;
  description: string;
};

export const PRINCIPLES: Principle[] = [
  {
    id: 'coulomb-force',
    name: "Coulomb's law force",
    description:
      'The electrostatic force between point charges acts along the line joining them, scales with each charge, and falls off as one over distance squared.',
  },
  {
    id: 'superposition',
    name: 'Superposition',
    description: 'Net field or force is the vector sum of contributions from each source.',
  },
  {
    id: 'symmetry-gauss',
    name: "Symmetry and Gauss's law",
    description: 'Use symmetry to relate enclosed charge, flux, and field.',
  },
  {
    id: 'field-concept',
    name: 'Field concept',
    description:
      'The electric field is set up by sources and is distinct from the force on a test charge and from field lines.',
  },
  {
    id: 'energy-potential',
    name: 'Energy and potential',
    description:
      'Work, potential energy, electric potential, and the field to potential relationship.',
  },
  {
    id: 'conductor-equilibrium',
    name: 'Conductor equilibrium',
    description:
      'In electrostatic equilibrium the field inside a conductor is zero and charge sits on the surface.',
  },
  {
    id: 'capacitance',
    name: 'Capacitance',
    description: 'Charge storage on conductors, capacitor combinations, and dielectrics.',
  },
  {
    id: 'circuit-conservation',
    name: 'Circuit conservation',
    description: "Kirchhoff's rules for charge at junctions and energy around loops.",
  },
  {
    id: 'ohmic-transport',
    name: 'Ohmic transport',
    description: "Current, resistance, resistivity, Ohm's law, and electric power.",
  },
  {
    id: 'magnetic-force',
    name: 'Magnetic force',
    description: 'Force on moving charges and on currents in a magnetic field.',
  },
  {
    id: 'magnetic-source',
    name: 'Magnetic source',
    description: "Magnetic fields produced by currents via Biot-Savart and Ampere's law.",
  },
  {
    id: 'induction',
    name: 'Induction',
    description:
      "Changing magnetic flux induces EMF via Faraday's and Lenz's laws, including motional EMF.",
  },
  {
    id: 'transients',
    name: 'Transients',
    description: 'Time behavior of RC, LR, and LC circuits.',
  },
  // Mechanics prerequisites. Not part of the E&M framework itself, but the
  // lesson 1 Phase 1 review seeds (kinematics, forces, energy) reference these so
  // every authored problem still names a catalogued principle.
  {
    id: 'mechanics-kinematics',
    name: 'Kinematics',
    description:
      'Motion under constant acceleration, including free fall, related through the kinematic equations.',
  },
  {
    id: 'mechanics-newtons-laws',
    name: "Newton's laws",
    description: 'Net force sets acceleration, and forces resolve into components along chosen axes.',
  },
  {
    id: 'mechanics-energy',
    name: 'Work and energy',
    description: 'Work, kinetic energy, gravitational potential energy, and conservation of energy.',
  },
];
