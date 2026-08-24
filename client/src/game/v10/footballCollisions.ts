import {
  MATCH_BALL,
  magnitude,
  type FlightSample,
  type GoalSpecification,
  type ShotPhysicsResult,
  type Vec3,
} from "./shotPhysics3d";

export type DefenseMode = "open" | "wall" | "keeper";
export type FootballOutcome = "goal" | "saved" | "blocked" | "post" | "crossbar" | "miss" | "short";
export type FootballImpact = "net" | "keeper" | "wall" | "post" | "crossbar" | "none";

export interface WallActor {
  xM: number;
  zM: number;
  widthM: number;
  heightM: number;
}

export interface GoalkeeperActor {
  startXM: number;
  targetXM: number;
  centerYM: number;
  zM: number;
  reachXM: number;
  reachYM: number;
}

export interface SceneActors {
  wall: WallActor[];
  goalkeeper: GoalkeeperActor | null;
}

export interface ResolvedFootballShot {
  outcome: FootballOutcome;
  impactType: FootballImpact;
  impactSample: FlightSample | null;
  displaySamples: FlightSample[];
  flightTimeSeconds: number;
  actors: SceneActors;
}

const WALL_DISTANCE_M = 9.15;
const WALL_WIDTH_M = 0.48;
const WALL_HEIGHT_M = 1.85;
const FRAME_RADIUS_M = 0.06;
const REBOUND_STEP_SECONDS = 1 / 60;
const EPSILON = 1e-8;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function interpolateVector(a: Vec3, b: Vec3, amount: number): Vec3 {
  return {
    x: a.x + (b.x - a.x) * amount,
    y: a.y + (b.y - a.y) * amount,
    z: a.z + (b.z - a.z) * amount,
  };
}

function interpolateSample(a: FlightSample, b: FlightSample, amount: number): FlightSample {
  const velocityMps = interpolateVector(a.velocityMps, b.velocityMps, amount);
  return {
    timeSeconds: a.timeSeconds + (b.timeSeconds - a.timeSeconds) * amount,
    positionM: interpolateVector(a.positionM, b.positionM, amount),
    velocityMps,
    accelerationMps2: interpolateVector(a.accelerationMps2, b.accelerationMps2, amount),
    speedMps: magnitude(velocityMps),
  };
}

function sampleAtPlane(samples: readonly FlightSample[], planeZM: number): FlightSample | null {
  for (let index = 1; index < samples.length; index += 1) {
    const previous = samples[index - 1];
    const current = samples[index];
    const deltaZ = current.positionM.z - previous.positionM.z;
    if (Math.abs(deltaZ) <= EPSILON) continue;
    const amount = (planeZM - previous.positionM.z) / deltaZ;
    if (amount >= 0 && amount <= 1) {
      const sample = interpolateSample(previous, current, amount);
      sample.positionM.z = planeZM;
      return sample;
    }
  }
  return null;
}

export function createDefenseActors(
  mode: DefenseMode,
  result: ShotPhysicsResult,
  goal: GoalSpecification,
): SceneActors {
  const crossing = result.goalPlaneCrossing ?? result.samples[result.samples.length - 1];
  const wall = mode === "wall"
    ? [-0.65, 0, 0.65].map((xM) => ({ xM, zM: WALL_DISTANCE_M, widthM: WALL_WIDTH_M, heightM: WALL_HEIGHT_M }))
    : [];
  const goalkeeper = mode === "keeper"
    ? {
        startXM: 0,
        targetXM: clamp(crossing.positionM.x * 0.62, -1.85, 1.85),
        centerYM: clamp(0.42 + crossing.positionM.y * 0.52, 0.82, 1.34),
        zM: goal.planeZM - 0.42,
        reachXM: 0.78,
        reachYM: 0.9,
      }
    : null;
  return { wall, goalkeeper };
}

function normalize(vector: Vec3): Vec3 {
  const length = magnitude(vector);
  return length <= EPSILON ? { x: 0, y: 0, z: -1 } : {
    x: vector.x / length,
    y: vector.y / length,
    z: vector.z / length,
  };
}

function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function reflectedVelocity(velocity: Vec3, normal: Vec3, restitution: number): Vec3 {
  const unitNormal = normalize(normal);
  const incoming = dot(velocity, unitNormal);
  const reflected = incoming < 0
    ? {
        x: velocity.x - (1 + restitution) * incoming * unitNormal.x,
        y: velocity.y - (1 + restitution) * incoming * unitNormal.y,
        z: velocity.z - (1 + restitution) * incoming * unitNormal.z,
      }
    : { x: velocity.x, y: velocity.y, z: -Math.abs(velocity.z) * restitution };
  return { x: reflected.x * 0.72, y: reflected.y * 0.72, z: reflected.z * 0.72 };
}

function appendRebound(
  source: readonly FlightSample[],
  impact: FlightSample,
  normal: Vec3,
  restitution: number,
): FlightSample[] {
  const prefix = source.filter((sample) => sample.timeSeconds < impact.timeSeconds - EPSILON);
  const samples = [...prefix, impact];
  let position = { ...impact.positionM };
  let velocity = reflectedVelocity(impact.velocityMps, normal, restitution);
  let time = impact.timeSeconds;
  const acceleration = { x: 0, y: -9.81, z: 0 };

  for (let index = 0; index < 42; index += 1) {
    velocity = {
      x: velocity.x * 0.988,
      y: velocity.y + acceleration.y * REBOUND_STEP_SECONDS,
      z: velocity.z * 0.988,
    };
    position = {
      x: position.x + velocity.x * REBOUND_STEP_SECONDS,
      y: position.y + velocity.y * REBOUND_STEP_SECONDS,
      z: position.z + velocity.z * REBOUND_STEP_SECONDS,
    };
    time += REBOUND_STEP_SECONDS;
    if (position.y <= MATCH_BALL.radiusM) {
      position.y = MATCH_BALL.radiusM;
      velocity.y = Math.abs(velocity.y) * 0.28;
    }
    samples.push({
      timeSeconds: time,
      positionM: { ...position },
      velocityMps: { ...velocity },
      accelerationMps2: acceleration,
      speedMps: magnitude(velocity),
    });
  }
  return samples;
}

function appendNetCatch(source: readonly FlightSample[], crossing: FlightSample): FlightSample[] {
  const prefix = source.filter((sample) => sample.timeSeconds < crossing.timeSeconds - EPSILON);
  const samples = [...prefix, crossing];
  let position = { ...crossing.positionM };
  let velocity = { ...crossing.velocityMps };
  let time = crossing.timeSeconds;

  for (let index = 0; index < 34; index += 1) {
    const netDepth = position.z - crossing.positionM.z;
    const braking = netDepth > 0.48 ? 0.72 : 0.91;
    velocity = {
      x: velocity.x * 0.9,
      y: velocity.y * 0.9 - 9.81 * REBOUND_STEP_SECONDS,
      z: Math.max(0, velocity.z * braking),
    };
    position = {
      x: position.x + velocity.x * REBOUND_STEP_SECONDS,
      y: Math.max(MATCH_BALL.radiusM, position.y + velocity.y * REBOUND_STEP_SECONDS),
      z: Math.min(crossing.positionM.z + 1.72, position.z + velocity.z * REBOUND_STEP_SECONDS),
    };
    time += REBOUND_STEP_SECONDS;
    samples.push({
      timeSeconds: time,
      positionM: { ...position },
      velocityMps: { ...velocity },
      accelerationMps2: { x: 0, y: -9.81, z: 0 },
      speedMps: magnitude(velocity),
    });
  }
  return samples;
}

function resolved(
  outcome: FootballOutcome,
  impactType: FootballImpact,
  impactSample: FlightSample | null,
  displaySamples: FlightSample[],
  actors: SceneActors,
): ResolvedFootballShot {
  return {
    outcome,
    impactType,
    impactSample,
    displaySamples,
    flightTimeSeconds: displaySamples[displaySamples.length - 1].timeSeconds,
    actors,
  };
}

/** Resolves the first football contact without mutating the aerodynamic trajectory. */
export function resolveFootballShot(
  result: ShotPhysicsResult,
  mode: DefenseMode,
  goal: GoalSpecification,
): ResolvedFootballShot {
  if (result.samples.length === 0) throw new RangeError("result.samples cannot be empty");
  const actors = createDefenseActors(mode, result, goal);

  if (actors.wall.length > 0) {
    const wallSample = sampleAtPlane(result.samples, WALL_DISTANCE_M);
    if (wallSample) {
      const player = actors.wall.find((actor) => (
        Math.abs(wallSample.positionM.x - actor.xM) <= actor.widthM / 2 + MATCH_BALL.radiusM
        && wallSample.positionM.y <= actor.heightM + MATCH_BALL.radiusM
        && wallSample.positionM.y >= MATCH_BALL.radiusM
      ));
      if (player) {
        const normal = normalize({
          x: wallSample.positionM.x - player.xM,
          y: Math.max(-0.12, wallSample.positionM.y - player.heightM * 0.58) * 0.18,
          z: -1,
        });
        return resolved("blocked", "wall", wallSample, appendRebound(result.samples, wallSample, normal, 0.52), actors);
      }
    }
  }

  const keeper = actors.goalkeeper;
  if (keeper) {
    const keeperSample = sampleAtPlane(result.samples, keeper.zM);
    if (keeperSample) {
      const horizontal = (keeperSample.positionM.x - keeper.targetXM) / keeper.reachXM;
      const vertical = (keeperSample.positionM.y - keeper.centerYM) / keeper.reachYM;
      if (horizontal ** 2 + vertical ** 2 <= 1) {
        const normal = normalize({ x: horizontal * 0.48, y: vertical * 0.32, z: -1 });
        return resolved("saved", "keeper", keeperSample, appendRebound(result.samples, keeperSample, normal, 0.4), actors);
      }
    }
  }

  const crossing = result.goalPlaneCrossing ?? sampleAtPlane(result.samples, goal.planeZM);
  if (!crossing) {
    return resolved("short", "none", null, [...result.samples], actors);
  }

  const frameClearance = MATCH_BALL.radiusM + FRAME_RADIUS_M;
  const halfWidth = goal.widthM / 2;
  const touchesPost = Math.abs(Math.abs(crossing.positionM.x) - halfWidth) <= frameClearance
    && crossing.positionM.y <= goal.heightM + frameClearance;
  if (touchesPost) {
    const postX = crossing.positionM.x < 0 ? -halfWidth : halfWidth;
    const normal = normalize({ x: crossing.positionM.x - postX, y: 0, z: -0.78 });
    return resolved("post", "post", crossing, appendRebound(result.samples, crossing, normal, 0.68), actors);
  }

  const touchesCrossbar = Math.abs(crossing.positionM.y - goal.heightM) <= frameClearance
    && Math.abs(crossing.positionM.x) <= halfWidth + frameClearance;
  if (touchesCrossbar) {
    const normal = normalize({ x: 0, y: crossing.positionM.y - goal.heightM, z: -0.78 });
    return resolved("crossbar", "crossbar", crossing, appendRebound(result.samples, crossing, normal, 0.64), actors);
  }

  if (result.goalMouthResult === "goal") {
    return resolved("goal", "net", crossing, appendNetCatch(result.samples, crossing), actors);
  }
  return resolved("miss", "none", crossing, [...result.samples], actors);
}
