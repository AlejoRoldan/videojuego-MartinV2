import { magnitude, type FlightSample, type Vec3 } from "./shotPhysics3d";

export interface Viewport {
  width: number;
  height: number;
}

export interface CameraPose {
  positionM: Vec3;
  targetM: Vec3;
  verticalFovDegrees: number;
}

export interface ProjectedPoint {
  x: number;
  y: number;
  depthM: number;
  pixelsPerMeter: number;
}

export const FIELD_SCENE = Object.freeze({
  visibleWidthM: 45,
  runUpM: 8,
  beyondGoalM: 8,
  penaltyAreaWidthM: 40.32,
  penaltyAreaDepthM: 16.5,
  penaltySpotDistanceM: 11,
  goalDepthM: 2,
});

const CAMERA_UP: Vec3 = { x: 0, y: 1, z: 0 };
const EPSILON = 1e-8;

function subtract(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function scale(vector: Vec3, factor: number): Vec3 {
  return { x: vector.x * factor, y: vector.y * factor, z: vector.z * factor };
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function normalize(vector: Vec3): Vec3 {
  const length = magnitude(vector);
  if (length <= EPSILON) throw new RangeError("Camera direction cannot have zero length");
  return scale(vector, 1 / length);
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function smoothstep(value: number): number {
  const clamped = clamp01(value);
  return clamped * clamped * (3 - 2 * clamped);
}

function lerp(a: number, b: number, amount: number): number {
  return a + (b - a) * amount;
}

function lerpVec3(a: Vec3, b: Vec3, amount: number): Vec3 {
  return {
    x: lerp(a.x, b.x, amount),
    y: lerp(a.y, b.y, amount),
    z: lerp(a.z, b.z, amount),
  };
}

/** Camera starts behind the ball and advances only slightly during flight. */
export function createGameplayCamera(goalDistanceM: number, flightProgress = 0): CameraPose {
  if (!Number.isFinite(goalDistanceM) || goalDistanceM <= 0) {
    throw new RangeError("goalDistanceM must be a positive finite number");
  }
  const movement = smoothstep(flightProgress);
  return {
    positionM: {
      x: 0,
      y: lerp(1.62, 1.9, movement),
      z: lerp(-6.4, -4.2, movement),
    },
    targetM: {
      x: 0,
      y: lerp(1.05, 1.35, movement),
      z: goalDistanceM * lerp(0.63, 0.76, movement),
    },
    verticalFovDegrees: lerp(49, 45, movement),
  };
}

/** Pinhole projection using a look-at camera and a vertical field of view. */
export function projectWorldPoint(pointM: Vec3, camera: CameraPose, viewport: Viewport): ProjectedPoint | null {
  if (!Number.isFinite(viewport.width) || !Number.isFinite(viewport.height) || viewport.width <= 0 || viewport.height <= 0) {
    throw new RangeError("viewport dimensions must be positive finite numbers");
  }
  const forward = normalize(subtract(camera.targetM, camera.positionM));
  const right = normalize(cross(CAMERA_UP, forward));
  const up = cross(forward, right);
  const relative = subtract(pointM, camera.positionM);
  const depthM = dot(relative, forward);
  if (depthM <= 0.05) return null;

  const focalLengthPx = viewport.height / (2 * Math.tan(camera.verticalFovDegrees * Math.PI / 360));
  return {
    x: viewport.width / 2 + dot(relative, right) * focalLengthPx / depthM,
    y: viewport.height / 2 - dot(relative, up) * focalLengthPx / depthM,
    depthM,
    pixelsPerMeter: focalLengthPx / depthM,
  };
}

export function getProjectedBallRadiusPx(pointM: Vec3, radiusM: number, camera: CameraPose, viewport: Viewport): number {
  if (!Number.isFinite(radiusM) || radiusM <= 0) throw new RangeError("radiusM must be a positive finite number");
  const projected = projectWorldPoint(pointM, camera, viewport);
  return projected ? Math.max(2.8, projected.pixelsPerMeter * radiusM) : 0;
}

/** Interpolates by real simulation time, not by array index. */
export function interpolateFlight(samples: readonly FlightSample[], progress: number): FlightSample {
  if (samples.length === 0) throw new RangeError("samples cannot be empty");
  if (samples.length === 1) return samples[0];
  const clamped = clamp01(progress);
  if (clamped === 0) return samples[0];
  if (clamped === 1) return samples[samples.length - 1];
  const targetTime = lerp(samples[0].timeSeconds, samples[samples.length - 1].timeSeconds, clamped);
  let upperIndex = samples.findIndex((sample) => sample.timeSeconds >= targetTime);
  if (upperIndex <= 0) return samples[0];
  if (upperIndex === -1) return samples[samples.length - 1];
  const lower = samples[upperIndex - 1];
  const upper = samples[upperIndex];
  const duration = upper.timeSeconds - lower.timeSeconds;
  const amount = duration <= EPSILON ? 0 : (targetTime - lower.timeSeconds) / duration;
  const velocityMps = lerpVec3(lower.velocityMps, upper.velocityMps, amount);
  return {
    timeSeconds: targetTime,
    positionM: lerpVec3(lower.positionM, upper.positionM, amount),
    velocityMps,
    accelerationMps2: lerpVec3(lower.accelerationMps2, upper.accelerationMps2, amount),
    speedMps: magnitude(velocityMps),
  };
}
