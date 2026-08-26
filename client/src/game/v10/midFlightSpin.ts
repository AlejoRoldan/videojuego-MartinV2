import { interpolateFlight } from "./cameraProjection";
import {
  MATCH_BALL,
  simulateShot,
  velocityFromAngles,
  type FlightSample,
  type ShotPhysicsConfig,
  type ShotPhysicsResult,
} from "./shotPhysics3d";

export interface SpinContinuation {
  result: ShotPhysicsResult;
  appliedAt: FlightSample;
}

function shiftSample(sample: FlightSample, offsetSeconds: number): FlightSample {
  return { ...sample, timeSeconds: sample.timeSeconds + offsetSeconds };
}

/** Re-simulates only the remaining flight from the exact visual sample. */
export function continueFlightWithSpin(
  currentResult: ShotPhysicsResult,
  progress: number,
  sidespinRadPerSecond: number,
  originalConfig: ShotPhysicsConfig,
): SpinContinuation {
  if (!Number.isFinite(sidespinRadPerSecond)) throw new RangeError("sidespinRadPerSecond must be finite");
  if (currentResult.samples.length < 2) throw new RangeError("currentResult must contain a flight");
  const safeProgress = Math.max(0.04, Math.min(0.9, progress));
  const appliedAt = interpolateFlight(currentResult.samples, safeProgress);
  const remainingSeconds = Math.max(0.2, (originalConfig.maxFlightSeconds ?? 5) - appliedAt.timeSeconds);
  const continuation = simulateShot({
    ...originalConfig,
    initialPositionM: appliedAt.positionM,
    initialVelocityMps: appliedAt.velocityMps,
    spinRadPerSecond: { x: 0, y: sidespinRadPerSecond, z: 0 },
    maxFlightSeconds: remainingSeconds,
  });
  const prefix = currentResult.samples.filter((sample) => sample.timeSeconds < appliedAt.timeSeconds);
  const shiftedContinuation = continuation.samples.slice(1).map((sample) => shiftSample(sample, appliedAt.timeSeconds));
  const samples = [...prefix, appliedAt, ...shiftedContinuation];
  const goalPlaneCrossing = continuation.goalPlaneCrossing
    ? shiftSample(continuation.goalPlaneCrossing, appliedAt.timeSeconds)
    : null;
  const apex = samples.reduce((highest, sample) => sample.positionM.y > highest.positionM.y ? sample : highest, samples[0]);

  return {
    appliedAt,
    result: {
      ...continuation,
      samples,
      goalPlaneCrossing,
      goalMouthResult: goalPlaneCrossing
        ? continuation.goalMouthResult
        : null,
      apex,
      flightTimeSeconds: samples[samples.length - 1].timeSeconds,
    },
  };
}

export function createInteractiveShotConfig(speedMps: number, elevationDegrees: number, yawDegrees: number, goalDistanceM: number): ShotPhysicsConfig {
  return {
    initialPositionM: { x: 0, y: MATCH_BALL.radiusM, z: 0 },
    initialVelocityMps: velocityFromAngles(speedMps, elevationDegrees, yawDegrees),
    spinRadPerSecond: { x: 0, y: 0, z: 0 },
    goal: { widthM: 7.32, heightM: 2.44, planeZM: goalDistanceM },
  };
}
