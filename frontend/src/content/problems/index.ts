import fieldPointCharge from './cl-field-point-charge.json';
import coulombForceTwoCharges from './cl-coulomb-force-two-charges.json';
import twoChargeSuperposition from './cl-two-charge-superposition.json';
import midpointFieldPotential from './cl-midpoint-field-potential.json';
import coulombForceAp from './cl-coulomb-force-ap.json';
import coulombCollinearNet from './cl-coulomb-collinear-net.json';
import coulombEquilibrium from './cl-coulomb-equilibrium.json';
import coulombScaling from './cl-coulomb-scaling.json';
import fieldAndForce from './cl-field-and-force.json';
import coulombNet2d from './cl-coulomb-net-2d.json';
import coulombSquareCornerNet from './cl-coulomb-square-corner-net.json';
import coulombTriangleNet from './cl-coulomb-triangle-net.json';
import coulombSolveCharge from './cl-coulomb-solve-charge.json';
import coulombChargeSplitMax from './cl-coulomb-charge-split-max.json';
import cciFieldOutsideSphere from './cci-field-outside-sphere.json';
import cciShareIdenticalSpheres from './cci-share-identical-spheres.json';
import cciShareOppositeSigns from './cci-share-opposite-signs.json';
import cciShareThenForce from './cci-share-then-force.json';
import cciShareThreeSpheres from './cci-share-three-spheres.json';
import cciShareUnequalSpheres from './cci-share-unequal-spheres.json';
import cciShellOuterField from './cci-shell-outer-field.json';
import cciShellSurfaceCharges from './cci-shell-surface-charges.json';
import cciSpherePotential from './cci-sphere-potential.json';
import cciSurfaceChargeDensity from './cci-surface-charge-density.json';
import effFieldCollinearNet from './eff-field-collinear-net.json';
import effFieldDistanceRatio from './eff-field-distance-ratio.json';
import effFieldFromForce from './eff-field-from-force.json';
import effFieldNullPoint from './eff-field-null-point.json';
import effFieldPerpBisector from './eff-field-perp-bisector.json';
import effFieldPointChargeNc from './eff-field-point-charge-nc.json';
import effFieldProbeInvariance from './eff-field-probe-invariance.json';
import effFieldSolveDistance from './eff-field-solve-distance.json';
import effFieldThenForce from './eff-field-then-force.json';
import effFieldTwoPositiveNet from './eff-field-two-positive-net.json';
import efcdRingAxis from './efcd-ring-axis.json';
import efcdArcCenter from './efcd-arc-center.json';
import efcdRodBisector from './efcd-rod-bisector.json';
import efcdInfiniteLine from './efcd-infinite-line.json';
import efcdDiskAxis from './efcd-disk-axis.json';
import efcdRodEndAxis from './efcd-rod-end-axis.json';
import efcdQuarterArcCenter from './efcd-quarter-arc-center.json';
import fluxFlatTilted from './flux-flat-tilted.json';
import fluxSolveAngle from './flux-solve-angle.json';
import fluxCubeUniform from './flux-cube-uniform.json';
import fluxPointChargeEnclosed from './flux-point-charge-enclosed.json';
import fluxNetEnclosedCharges from './flux-net-enclosed-charges.json';
import fluxDiskTilted from './flux-disk-tilted.json';
import fluxHemisphereUniform from './flux-hemisphere-uniform.json';
import gaussSphereOutside from './gauss-sphere-outside.json';
import gaussInfiniteSheet from './gauss-infinite-sheet.json';
import gaussConductorSurface from './gauss-conductor-surface.json';
import gaussSolidSphereInside from './gauss-solid-sphere-inside.json';
import gaussTwoSheets from './gauss-two-sheets.json';
import gaussInfiniteLine from './gauss-infinite-line.json';
import gaussShellInside from './gauss-shell-inside.json';
import mechForcesIncline from './mech-forces-incline.json';
import mechEnergyFall from './mech-energy-fall.json';
import mechKinematicsDrop from './mech-kinematics-drop.json';
import type { Problem } from '../problemSchema';

export type { Problem } from '../problemSchema';

const problems = [
  fieldPointCharge,
  coulombForceTwoCharges,
  twoChargeSuperposition,
  midpointFieldPotential,
  coulombForceAp,
  coulombCollinearNet,
  coulombEquilibrium,
  coulombScaling,
  fieldAndForce,
  coulombNet2d,
  coulombSquareCornerNet,
  coulombTriangleNet,
  coulombSolveCharge,
  coulombChargeSplitMax,
  cciFieldOutsideSphere,
  cciShareIdenticalSpheres,
  cciShareOppositeSigns,
  cciShareThenForce,
  cciShareThreeSpheres,
  cciShareUnequalSpheres,
  cciShellOuterField,
  cciShellSurfaceCharges,
  cciSpherePotential,
  cciSurfaceChargeDensity,
  effFieldCollinearNet,
  effFieldDistanceRatio,
  effFieldFromForce,
  effFieldNullPoint,
  effFieldPerpBisector,
  effFieldPointChargeNc,
  effFieldProbeInvariance,
  effFieldSolveDistance,
  effFieldThenForce,
  effFieldTwoPositiveNet,
  efcdRingAxis,
  efcdArcCenter,
  efcdRodBisector,
  efcdInfiniteLine,
  efcdDiskAxis,
  efcdRodEndAxis,
  efcdQuarterArcCenter,
  fluxFlatTilted,
  fluxSolveAngle,
  fluxCubeUniform,
  fluxPointChargeEnclosed,
  fluxNetEnclosedCharges,
  fluxDiskTilted,
  fluxHemisphereUniform,
  gaussSphereOutside,
  gaussInfiniteSheet,
  gaussConductorSurface,
  gaussSolidSphereInside,
  gaussTwoSheets,
  gaussInfiniteLine,
  gaussShellInside,
  mechForcesIncline,
  mechEnergyFall,
  mechKinematicsDrop,
] as Problem[];

export const PROBLEMS: Problem[] = problems;

export function getProblemById(id: string): Problem | undefined {
  return problems.find((problem) => problem.problemId === id);
}

export function getProblemsForLesson(lessonId: string): Problem[] {
  return problems.filter((problem) => problem.lessonId === lessonId);
}
