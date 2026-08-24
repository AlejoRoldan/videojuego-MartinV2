// TIRO LIBRE MATEMÁTICO V10 — metric, deterministic free-kick prototype

export interface Vec3 {
  /** Lateral position/velocity: positive values go to the shooter's right. */
  x: number;
  /** Vertical position/velocity: positive values go up. */
  y: number;
  /** Longitudinal position/velocity: positive values travel toward the goal. */
  z: number;
}

export interface BallSpecification {
  radiusM: number;
  massKg: number;
  airDensityKgM3: number;
  dragCoefficient: number;
  maxLiftCoefficient: number;
}

export interface GoalSpecification {
  widthM: number;
  heightM: number;
  planeZM: number;
}

export interface ShotPhysicsConfig {
  initialPositionM: Vec3;
  initialVelocityMps: Vec3;
  spinRadPerSecond: Vec3;
  goal: GoalSpecification;
  ball?: BallSpecification;
  windMps?: Vec3;
  gravityMps2?: number;
  fixedStepSeconds?: number;
  maxFlightSeconds?: number;
}

export interface FlightSample {
  timeSeconds: number;
  positionM: Vec3;
  velocityMps: Vec3;
  accelerationMps2: Vec3;
  speedMps: number;
}

export type FlightTermination = "goal_plane" | "ground" | "timeout";

export interface ShotPhysicsResult {
  samples: FlightSample[];
  termination: FlightTermination;
  goalPlaneCrossing: FlightSample | null;
  goalMouthResult: "goal" | "wide" | "high" | "grounded" | null;
  apex: FlightSample;
  flightTimeSeconds: number;
}

export const REGULATION_GOAL = Object.freeze<GoalSpecification>({
  widthM: 7.32,
  heightM: 2.44,
  planeZM: 18.3,
});

export const MATCH_BALL = Object.freeze<BallSpecification>({
  radiusM: 0.11,
  massKg: 0.43,
  airDensityKgM3: 1.225,
  dragCoefficient: 0.27,
  maxLiftCoefficient: 0.28,
});

export const DEFAULT_FIXED_STEP_SECONDS = 1 / 120;
export const DEFAULT_GRAVITY_MPS2 = 9.81;
export const ZERO_VEC3: Readonly<Vec3> = Object.freeze({ x: 0, y: 0, z: 0 });

const EPSILON = 1e-9;

function add(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

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

export function magnitude(vector: Vec3): number {
  return Math.hypot(vector.x, vector.y, vector.z);
}

function normalize(vector: Vec3): Vec3 {
  const length = magnitude(vector);
  return length <= EPSILON ? { ...ZERO_VEC3 } : scale(vector, 1 / length);
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

function assertPositiveFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${label} must be a positive finite number`);
  }
}

function assertFiniteVector(vector: Vec3, label: string): void {
  if (![vector.x, vector.y, vector.z].every(Number.isFinite)) {
    throw new RangeError(`${label} must contain finite values`);
  }
}

function validateConfig(config: ShotPhysicsConfig, ball: BallSpecification): void {
  assertFiniteVector(config.initialPositionM, "initialPositionM");
  assertFiniteVector(config.initialVelocityMps, "initialVelocityMps");
  assertFiniteVector(config.spinRadPerSecond, "spinRadPerSecond");
  assertFiniteVector(config.windMps ?? ZERO_VEC3, "windMps");
  assertPositiveFinite(config.goal.widthM, "goal.widthM");
  assertPositiveFinite(config.goal.heightM, "goal.heightM");
  assertPositiveFinite(config.goal.planeZM, "goal.planeZM");
  assertPositiveFinite(ball.radiusM, "ball.radiusM");
  assertPositiveFinite(ball.massKg, "ball.massKg");
  assertPositiveFinite(ball.airDensityKgM3, "ball.airDensityKgM3");
  if (ball.dragCoefficient < 0 || !Number.isFinite(ball.dragCoefficient)) {
    throw new RangeError("ball.dragCoefficient must be a finite non-negative number");
  }
  if (ball.maxLiftCoefficient < 0 || !Number.isFinite(ball.maxLiftCoefficient)) {
    throw new RangeError("ball.maxLiftCoefficient must be a finite non-negative number");
  }
}

/** Converts player-friendly launch angles into a velocity vector in SI units. */
export function velocityFromAngles(speedMps: number, elevationDegrees: number, yawDegrees = 0): Vec3 {
  assertPositiveFinite(speedMps, "speedMps");
  const elevation = elevationDegrees * Math.PI / 180;
  const yaw = yawDegrees * Math.PI / 180;
  const horizontalSpeed = speedMps * Math.cos(elevation);
  return {
    x: horizontalSpeed * Math.sin(yaw),
    y: speedMps * Math.sin(elevation),
    z: horizontalSpeed * Math.cos(yaw),
  };
}

/**
 * Force model: gravity + quadratic drag + Magnus lift.
 * Lift grows with the dimensionless spin ratio and is capped for stability.
 */
export function calculateAcceleration(
  velocityMps: Vec3,
  spinRadPerSecond: Vec3,
  windMps: Vec3,
  ball: BallSpecification = MATCH_BALL,
  gravityMps2 = DEFAULT_GRAVITY_MPS2,
): Vec3 {
  const relativeVelocity = subtract(velocityMps, windMps);
  const relativeSpeed = magnitude(relativeVelocity);
  if (relativeSpeed <= EPSILON) return { x: 0, y: -gravityMps2, z: 0 };

  const areaM2 = Math.PI * ball.radiusM * ball.radiusM;
  const dragForceMagnitude = 0.5 * ball.airDensityKgM3 * ball.dragCoefficient * areaM2 * relativeSpeed ** 2;
  const dragAcceleration = scale(normalize(relativeVelocity), -dragForceMagnitude / ball.massKg);

  const spinSpeed = magnitude(spinRadPerSecond);
  const spinRatio = spinSpeed * ball.radiusM / relativeSpeed;
  const effectiveLiftCoefficient = Math.min(ball.maxLiftCoefficient, 0.6 * spinRatio);
  const magnusDirection = normalize(cross(spinRadPerSecond, relativeVelocity));
  const liftForceMagnitude = 0.5 * ball.airDensityKgM3 * effectiveLiftCoefficient * areaM2 * relativeSpeed ** 2;
  const magnusAcceleration = scale(magnusDirection, liftForceMagnitude / ball.massKg);

  return add(add(dragAcceleration, magnusAcceleration), { x: 0, y: -gravityMps2, z: 0 });
}

function makeSample(timeSeconds: number, positionM: Vec3, velocityMps: Vec3, accelerationMps2: Vec3): FlightSample {
  return {
    timeSeconds,
    positionM: { ...positionM },
    velocityMps: { ...velocityMps },
    accelerationMps2: { ...accelerationMps2 },
    speedMps: magnitude(velocityMps),
  };
}

function interpolateSample(previous: FlightSample, current: FlightSample, amount: number): FlightSample {
  const velocityMps = lerpVec3(previous.velocityMps, current.velocityMps, amount);
  return {
    timeSeconds: lerp(previous.timeSeconds, current.timeSeconds, amount),
    positionM: lerpVec3(previous.positionM, current.positionM, amount),
    velocityMps,
    accelerationMps2: lerpVec3(previous.accelerationMps2, current.accelerationMps2, amount),
    speedMps: magnitude(velocityMps),
  };
}

export function classifyGoalMouth(crossing: FlightSample, goal: GoalSpecification, ballRadiusM = MATCH_BALL.radiusM): ShotPhysicsResult["goalMouthResult"] {
  if (crossing.positionM.y < ballRadiusM) return "grounded";
  if (crossing.positionM.y > goal.heightM - ballRadiusM) return "high";
  if (Math.abs(crossing.positionM.x) > goal.widthM / 2 - ballRadiusM) return "wide";
  return "goal";
}

/** Simulates a shot with a deterministic, fixed-step semi-implicit Euler integrator. */
export function simulateShot(config: ShotPhysicsConfig): ShotPhysicsResult {
  const ball = config.ball ?? MATCH_BALL;
  validateConfig(config, ball);
  const windMps = config.windMps ?? ZERO_VEC3;
  const gravityMps2 = config.gravityMps2 ?? DEFAULT_GRAVITY_MPS2;
  const stepSeconds = config.fixedStepSeconds ?? DEFAULT_FIXED_STEP_SECONDS;
  const maxFlightSeconds = config.maxFlightSeconds ?? 5;
  assertPositiveFinite(stepSeconds, "fixedStepSeconds");
  assertPositiveFinite(maxFlightSeconds, "maxFlightSeconds");
  if (!Number.isFinite(gravityMps2) || gravityMps2 < 0) {
    throw new RangeError("gravityMps2 must be a finite non-negative number");
  }

  let timeSeconds = 0;
  let positionM = { ...config.initialPositionM };
  let velocityMps = { ...config.initialVelocityMps };
  let accelerationMps2 = calculateAcceleration(velocityMps, config.spinRadPerSecond, windMps, ball, gravityMps2);
  const samples = [makeSample(timeSeconds, positionM, velocityMps, accelerationMps2)];
  let apex = samples[0];
  let termination: FlightTermination = "timeout";
  let goalPlaneCrossing: FlightSample | null = null;
  let wasAirborne = positionM.y > ball.radiusM + EPSILON || velocityMps.y > 0;

  while (timeSeconds + EPSILON < maxFlightSeconds) {
    const previous = samples[samples.length - 1];
    const currentStep = Math.min(stepSeconds, maxFlightSeconds - timeSeconds);
    accelerationMps2 = calculateAcceleration(velocityMps, config.spinRadPerSecond, windMps, ball, gravityMps2);
    velocityMps = add(velocityMps, scale(accelerationMps2, currentStep));
    positionM = add(positionM, scale(velocityMps, currentStep));
    timeSeconds += currentStep;
    const current = makeSample(timeSeconds, positionM, velocityMps, accelerationMps2);

    if (previous.positionM.z < config.goal.planeZM && current.positionM.z >= config.goal.planeZM) {
      const amount = (config.goal.planeZM - previous.positionM.z) / (current.positionM.z - previous.positionM.z);
      goalPlaneCrossing = interpolateSample(previous, current, amount);
      goalPlaneCrossing.positionM.z = config.goal.planeZM;
      samples.push(goalPlaneCrossing);
      if (goalPlaneCrossing.positionM.y > apex.positionM.y) apex = goalPlaneCrossing;
      termination = "goal_plane";
      break;
    }

    wasAirborne = wasAirborne || current.positionM.y > ball.radiusM + EPSILON;
    if (wasAirborne && current.positionM.y <= ball.radiusM && current.velocityMps.y < 0) {
      const amount = (ball.radiusM - previous.positionM.y) / (current.positionM.y - previous.positionM.y);
      const groundSample = interpolateSample(previous, current, Math.max(0, Math.min(1, amount)));
      groundSample.positionM.y = ball.radiusM;
      samples.push(groundSample);
      if (groundSample.positionM.y > apex.positionM.y) apex = groundSample;
      termination = "ground";
      break;
    }

    samples.push(current);
    if (current.positionM.y > apex.positionM.y) apex = current;
  }

  const finalSample = samples[samples.length - 1];
  return {
    samples,
    termination,
    goalPlaneCrossing,
    goalMouthResult: goalPlaneCrossing ? classifyGoalMouth(goalPlaneCrossing, config.goal, ball.radiusM) : null,
    apex,
    flightTimeSeconds: finalSample.timeSeconds,
  };
}
