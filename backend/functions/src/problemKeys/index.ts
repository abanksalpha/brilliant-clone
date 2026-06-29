import { ProblemKey } from '../types';
import { clFieldPointCharge } from './cl-field-point-charge';
import { clCoulombForceTwoCharges } from './cl-coulomb-force-two-charges';
import { clTwoChargeSuperposition } from './cl-two-charge-superposition';
import { clMidpointFieldPotential } from './cl-midpoint-field-potential';
import { clCoulombForceAp } from './cl-coulomb-force-ap';
import { clCoulombCollinearNet } from './cl-coulomb-collinear-net';
import { clCoulombEquilibrium } from './cl-coulomb-equilibrium';
import { clCoulombScaling } from './cl-coulomb-scaling';
import { clFieldAndForce } from './cl-field-and-force';
import { clCoulombNet2d } from './cl-coulomb-net-2d';
import { clCoulombSquareCornerNet } from './cl-coulomb-square-corner-net';
import { clCoulombTriangleNet } from './cl-coulomb-triangle-net';
import { clCoulombSolveCharge } from './cl-coulomb-solve-charge';
import { clCoulombChargeSplitMax } from './cl-coulomb-charge-split-max';
import { cciFieldOutsideSphere } from './cci-field-outside-sphere';
import { cciShareIdenticalSpheres } from './cci-share-identical-spheres';
import { cciShareOppositeSigns } from './cci-share-opposite-signs';
import { cciShareThenForce } from './cci-share-then-force';
import { cciShareThreeSpheres } from './cci-share-three-spheres';
import { cciShareUnequalSpheres } from './cci-share-unequal-spheres';
import { cciShellOuterField } from './cci-shell-outer-field';
import { cciShellSurfaceCharges } from './cci-shell-surface-charges';
import { cciSpherePotential } from './cci-sphere-potential';
import { cciSurfaceChargeDensity } from './cci-surface-charge-density';
import { effFieldCollinearNet } from './eff-field-collinear-net';
import { effFieldDistanceRatio } from './eff-field-distance-ratio';
import { effFieldFromForce } from './eff-field-from-force';
import { effFieldNullPoint } from './eff-field-null-point';
import { effFieldPerpBisector } from './eff-field-perp-bisector';
import { effFieldPointChargeNc } from './eff-field-point-charge-nc';
import { effFieldProbeInvariance } from './eff-field-probe-invariance';
import { effFieldSolveDistance } from './eff-field-solve-distance';
import { effFieldThenForce } from './eff-field-then-force';
import { effFieldTwoPositiveNet } from './eff-field-two-positive-net';
import { efcdRingAxis } from './efcd-ring-axis';
import { efcdArcCenter } from './efcd-arc-center';
import { efcdRodBisector } from './efcd-rod-bisector';
import { efcdInfiniteLine } from './efcd-infinite-line';
import { efcdDiskAxis } from './efcd-disk-axis';
import { efcdRodEndAxis } from './efcd-rod-end-axis';
import { efcdQuarterArcCenter } from './efcd-quarter-arc-center';
import { fluxFlatTilted } from './flux-flat-tilted';
import { fluxSolveAngle } from './flux-solve-angle';
import { fluxCubeUniform } from './flux-cube-uniform';
import { fluxPointChargeEnclosed } from './flux-point-charge-enclosed';
import { fluxNetEnclosedCharges } from './flux-net-enclosed-charges';
import { fluxDiskTilted } from './flux-disk-tilted';
import { fluxHemisphereUniform } from './flux-hemisphere-uniform';
import { gaussSphereOutside } from './gauss-sphere-outside';
import { gaussInfiniteSheet } from './gauss-infinite-sheet';
import { gaussConductorSurface } from './gauss-conductor-surface';
import { gaussSolidSphereInside } from './gauss-solid-sphere-inside';
import { gaussTwoSheets } from './gauss-two-sheets';
import { gaussInfiniteLine } from './gauss-infinite-line';
import { gaussShellInside } from './gauss-shell-inside';
import { mechForcesIncline } from './mech-forces-incline';
import { mechEnergyFall } from './mech-energy-fall';
import { mechKinematicsDrop } from './mech-kinematics-drop';

const REGISTRY: Record<string, ProblemKey> = {
  [clFieldPointCharge.problemId]: clFieldPointCharge,
  [clCoulombForceTwoCharges.problemId]: clCoulombForceTwoCharges,
  [clTwoChargeSuperposition.problemId]: clTwoChargeSuperposition,
  [clMidpointFieldPotential.problemId]: clMidpointFieldPotential,
  [clCoulombForceAp.problemId]: clCoulombForceAp,
  [clCoulombCollinearNet.problemId]: clCoulombCollinearNet,
  [clCoulombEquilibrium.problemId]: clCoulombEquilibrium,
  [clCoulombScaling.problemId]: clCoulombScaling,
  [clFieldAndForce.problemId]: clFieldAndForce,
  [clCoulombNet2d.problemId]: clCoulombNet2d,
  [clCoulombSquareCornerNet.problemId]: clCoulombSquareCornerNet,
  [clCoulombTriangleNet.problemId]: clCoulombTriangleNet,
  [clCoulombSolveCharge.problemId]: clCoulombSolveCharge,
  [clCoulombChargeSplitMax.problemId]: clCoulombChargeSplitMax,
  [cciFieldOutsideSphere.problemId]: cciFieldOutsideSphere,
  [cciShareIdenticalSpheres.problemId]: cciShareIdenticalSpheres,
  [cciShareOppositeSigns.problemId]: cciShareOppositeSigns,
  [cciShareThenForce.problemId]: cciShareThenForce,
  [cciShareThreeSpheres.problemId]: cciShareThreeSpheres,
  [cciShareUnequalSpheres.problemId]: cciShareUnequalSpheres,
  [cciShellOuterField.problemId]: cciShellOuterField,
  [cciShellSurfaceCharges.problemId]: cciShellSurfaceCharges,
  [cciSpherePotential.problemId]: cciSpherePotential,
  [cciSurfaceChargeDensity.problemId]: cciSurfaceChargeDensity,
  [effFieldCollinearNet.problemId]: effFieldCollinearNet,
  [effFieldDistanceRatio.problemId]: effFieldDistanceRatio,
  [effFieldFromForce.problemId]: effFieldFromForce,
  [effFieldNullPoint.problemId]: effFieldNullPoint,
  [effFieldPerpBisector.problemId]: effFieldPerpBisector,
  [effFieldPointChargeNc.problemId]: effFieldPointChargeNc,
  [effFieldProbeInvariance.problemId]: effFieldProbeInvariance,
  [effFieldSolveDistance.problemId]: effFieldSolveDistance,
  [effFieldThenForce.problemId]: effFieldThenForce,
  [effFieldTwoPositiveNet.problemId]: effFieldTwoPositiveNet,
  [efcdRingAxis.problemId]: efcdRingAxis,
  [efcdArcCenter.problemId]: efcdArcCenter,
  [efcdRodBisector.problemId]: efcdRodBisector,
  [efcdInfiniteLine.problemId]: efcdInfiniteLine,
  [efcdDiskAxis.problemId]: efcdDiskAxis,
  [efcdRodEndAxis.problemId]: efcdRodEndAxis,
  [efcdQuarterArcCenter.problemId]: efcdQuarterArcCenter,
  [fluxFlatTilted.problemId]: fluxFlatTilted,
  [fluxSolveAngle.problemId]: fluxSolveAngle,
  [fluxCubeUniform.problemId]: fluxCubeUniform,
  [fluxPointChargeEnclosed.problemId]: fluxPointChargeEnclosed,
  [fluxNetEnclosedCharges.problemId]: fluxNetEnclosedCharges,
  [fluxDiskTilted.problemId]: fluxDiskTilted,
  [fluxHemisphereUniform.problemId]: fluxHemisphereUniform,
  [gaussSphereOutside.problemId]: gaussSphereOutside,
  [gaussInfiniteSheet.problemId]: gaussInfiniteSheet,
  [gaussConductorSurface.problemId]: gaussConductorSurface,
  [gaussSolidSphereInside.problemId]: gaussSolidSphereInside,
  [gaussTwoSheets.problemId]: gaussTwoSheets,
  [gaussInfiniteLine.problemId]: gaussInfiniteLine,
  [gaussShellInside.problemId]: gaussShellInside,
  [mechForcesIncline.problemId]: mechForcesIncline,
  [mechEnergyFall.problemId]: mechEnergyFall,
  [mechKinematicsDrop.problemId]: mechKinematicsDrop,
};

export function getProblemKey(problemId: string): ProblemKey {
  const key = REGISTRY[problemId];
  if (!key) {
    throw new Error(`unknown problemId: ${problemId}`);
  }
  return key;
}
