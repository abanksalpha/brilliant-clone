import type { Misconception } from './problemSchema';

export type { Misconception } from './problemSchema';

export const MISCONCEPTIONS: Misconception[] = [
  {
    id: 'inverse-square-error',
    name: 'Inverse-square confusion',
    shortLabel: 'uses 1/r not 1/r squared',
    description:
      'Treats the electric field or force as falling off like 1 over r instead of 1 over r squared.',
  },
  {
    id: 'field-potential-conflation',
    name: 'Field and potential conflation',
    shortLabel: 'V is zero so E is zero',
    description:
      'Assumes the electric field is zero wherever the electric potential is zero, or the reverse.',
  },
  {
    id: 'superposition-magnitude-add',
    name: 'Scalar superposition',
    shortLabel: 'adds field magnitudes',
    description:
      'Adds electric field contributions as plain numbers and ignores their vector directions.',
  },
  {
    id: 'field-requires-test-charge',
    name: 'Field needs a test charge',
    shortLabel: 'no charge, no field',
    description:
      'Believes the electric field exists only where a test charge is placed, rather than being set up by the source charges throughout space.',
  },
  {
    id: 'flux-shape-dependence',
    name: 'Flux depends on the surface',
    shortLabel: 'flux changes with the box',
    description:
      'Thinks the electric flux through a closed surface depends on its size or shape, instead of only on the charge enclosed.',
  },
  {
    id: 'potential-as-vector',
    name: 'Potential treated as a vector',
    shortLabel: 'adds potentials with direction',
    description:
      'Adds electric potentials as vectors with direction, rather than as signed scalars.',
  },
  {
    id: 'equipotential-work',
    name: 'Work along an equipotential',
    shortLabel: 'moving along V costs work',
    description:
      'Believes moving a charge along an equipotential surface requires work, even though the potential does not change.',
  },
  {
    id: 'conductor-interior-charge',
    name: 'Charge inside a conductor',
    shortLabel: 'charge fills the metal',
    description:
      'Assumes excess charge spreads through the volume of a conductor in equilibrium, rather than residing on its surface.',
  },
  {
    id: 'capacitor-combination-swap',
    name: 'Capacitor combination swap',
    shortLabel: 'series adds like resistors',
    description:
      'Swaps the series and parallel rules for capacitors, adding capacitances in series the way resistances add in series.',
  },
  {
    id: 'current-consumed',
    name: 'Current gets used up',
    shortLabel: 'less current returns',
    description:
      'Believes current is consumed by components so less of it returns to the battery, instead of charge being conserved around the loop.',
  },
  {
    id: 'magnetic-force-does-work',
    name: 'Magnetic force does work',
    shortLabel: 'the field speeds charges up',
    description:
      'Thinks a magnetic field does work on a moving charge and changes its speed, rather than only its direction.',
  },
  {
    id: 'induced-current-direction',
    name: 'Induced current direction',
    shortLabel: 'induced current aids the change',
    description:
      "Sets the induced current so it reinforces the changing flux, rather than opposing it as Lenz's law requires.",
  },
];

export function getMisconception(id: string): Misconception | undefined {
  return MISCONCEPTIONS.find((misconception) => misconception.id === id);
}
