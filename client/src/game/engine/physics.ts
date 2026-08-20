// TIRO LIBRE MATEMÁTICO — Deterministic Shot Engine V9

import type {
  AppliedModifier,
  GoalkeeperState,
  MathPower,
  ShotInput,
  ShotReasonCode,
  ShotResolution,
  Vec2,
  WallPlayer,
} from "./types";
import { clampGoalPoint, coordToGoalPoint, goalPointToCoord, isInsideGoal } from "./coordinates";
import { getMathPowerModifiers } from "./mathPowers";

export interface PhysicsConfig {
  power: number;
  targetX: number;
  targetY: number;
  spin: number;
  wind: number;
  arcBoost?: number;
  targetPoint?: Vec2;
}

export interface LegacyLevelConfig {
  keeperSpeed: number;
  hasKeeper?: boolean;
  wind: boolean;
  windStrength: number;
  gridMax?: Vec2;
  gridQuadrants?: 1 | 4;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeSeed(seed: number): number {
  return (Math.floor(Number.isFinite(seed) ? seed : 0) >>> 0) || 1;
}

function seededRandom(seed: number): () => number {
  let value = normalizeSeed(seed);
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createWindSnapshot(enabled: boolean, strength: number, seed: number): { x: number; y: number } {
  if (!enabled || strength <= 0) return { x: 0, y: 0 };
  const random = seededRandom(normalizeSeed(seed) ^ 0x51f15e);
  return {
    x: (random() - 0.5) * strength * 0.22,
    y: (random() - 0.5) * strength * 0.12,
  };
}

export function calculateTrajectory(config: PhysicsConfig): Vec2[] {
  const { power, targetX, targetY, spin, wind, arcBoost = 1 } = config;
  const points: Vec2[] = [];
  const steps = 60;
  const startX = 0.5;
  const startY = 0.92;
  const endPoint = config.targetPoint ?? {
    x: 0.5 + targetX * 0.38,
    y: 0.75 - targetY * 0.55,
  };
  const powerFactor = Math.max(0.4, power / 100);

  const clampedEndPoint = clampGoalPoint(endPoint);
  for (let i = 0; i <= steps; i++) {
    if (i === steps) {
      points.push(clampedEndPoint);
      continue;
    }
    const t = i / steps;
    const x = startX + (endPoint.x - startX) * t;
    const arcHeight = 0.25 * powerFactor * arcBoost * Math.sin(Math.PI * t);
    const y = startY + (endPoint.y - startY) * t - arcHeight;
    const spinOffset = spin * 0.08 * Math.sin(Math.PI * t);
    const windOffset = wind * 0.04 * t * t;
    points.push({
      x: clamp(x + spinOffset + windOffset, 0.02, 0.98),
      y: clamp(y, 0.02, 0.98),
    });
  }
  return points;
}

/** Deterministic compatibility helper for the existing engine contract. */
export function checkGoalkeeperSave(targetX: number, keeperX: number, keeperSpeed: number, power: number): boolean {
  const keeperPos = (keeperX - 0.5) * 2;
  const dist = Math.abs(targetX - keeperPos);
  const reach = 0.25 + keeperSpeed * 0.35;
  const powerFactor = power / 100;
  const effectiveReach = reach * (1 - powerFactor * 0.3);
  return dist <= effectiveReach;
}

/** Deterministic compatibility helper for the existing engine contract. */
export function checkWallBlock(targetX: number, targetY: number, wall: WallPlayer[], spin: number): boolean {
  if (wall.length === 0) return false;
  for (const player of wall) {
    const wallX = (player.position.x - 0.5) * 2;
    const dx = Math.abs(targetX - wallX);
    if (targetY > 0.6) continue;
    const spinHelp = Math.abs(spin) * 0.15;
    const blockRadius = 0.18 - spinHelp;
    if (dx < blockRadius) return true;
  }
  return false;
}

function getKeeperReach(keeper: ShotInput["keeper"], power: number): number {
  return keeper.reach * (1 - (power / 100) * 0.3);
}

function isSavedByKeeper(point: Vec2, keeper: ShotInput["keeper"], power: number): boolean {
  const reach = getKeeperReach(keeper, power);
  return Math.abs(point.x - keeper.position.x) <= reach && Math.abs(point.y - keeper.position.y) <= reach * 1.35;
}

function isInsideGoalWithMargin(point: Vec2, targetSizeMultiplier: number): boolean {
  const margin = Math.max(0, targetSizeMultiplier - 1) * 0.5;
  return point.x >= -margin && point.x <= 1 + margin && point.y >= -margin && point.y <= 1 + margin;
}

function isBlockedByWall(point: Vec2, wall: ShotInput["wall"], spin: number): boolean {
  if (point.y < 0.5) return false;
  const spinHelp = Math.abs(spin) * 0.15;
  return wall.some((player) => {
    const radius = Math.max(0.04, player.radius - spinHelp);
    return Math.abs(point.x - player.position.x) <= radius && Math.abs(point.y - player.position.y) <= radius * 1.35;
  });
}

function getReasonCode({
  insideGoal,
  mathCorrect,
  targetPoint,
  landingPoint,
  savedByKeeper,
  blockedByWall,
  wind,
}: {
  insideGoal: boolean;
  mathCorrect: boolean;
  targetPoint: Vec2;
  landingPoint: Vec2;
  savedByKeeper: boolean;
  blockedByWall: boolean;
  wind: Vec2;
}): ShotReasonCode {
  if (!insideGoal) return "outside_goal";
  if (savedByKeeper) return "keeper_reach";
  if (blockedByWall) return "wall_block";
  const drift = Math.hypot(landingPoint.x - targetPoint.x, landingPoint.y - targetPoint.y);
  if (!mathCorrect && drift > 0.001) return "reduced_accuracy";
  if (Math.hypot(wind.x, wind.y) > 0.001) return "wind_drift";
  return "clean_target";
}

function getOutcome(scored: boolean, savedByKeeper: boolean, blockedByWall: boolean): ShotResolution["outcome"] {
  if (scored) return "goal";
  if (savedByKeeper) return "saved";
  if (blockedByWall) return "blocked";
  return "missed";
}

export function resolveShot(input: ShotInput): ShotResolution {
  const random = seededRandom(input.seed);
  const targetPoint = coordToGoalPoint(input.targetCoord, input.gridQuadrants);
  const modifiers = getMathPowerModifiers(input.mathCorrect ? input.mathPower : null);
  const runtime = input.runtimeModifiers;
  const effectivePower = input.mathCorrect
    ? Math.min(100, input.basePower + modifiers.powerBonus)
    : input.basePower * 0.55;
  const direction = input.targetCoord.x >= 0 ? 1 : -1;
  const effectiveSpin = clamp(input.spin || modifiers.autoSpin * direction, -1, 1);
  const accuracy = effectivePower / 100;
  const noise = (1 - accuracy) * 0.15 * modifiers.accuracyNoiseMultiplier;
  const precisionDrift = input.mathCorrect
    ? { x: 0, y: 0 }
    : { x: (random() - 0.5) * noise, y: (random() - 0.5) * noise };
  const windMultiplier = runtime?.windMultiplier ?? 1;
  const rawLandingPoint = {
    x: targetPoint.x + precisionDrift.x + input.wind.x * windMultiplier,
    y: targetPoint.y + precisionDrift.y + input.wind.y * windMultiplier,
  };
  const targetSizeMultiplier = runtime?.targetSizeMultiplier ?? 1;
  const insideGoal = isInsideGoal(rawLandingPoint) || isInsideGoalWithMargin(rawLandingPoint, targetSizeMultiplier);
  const landingPoint = clampGoalPoint(rawLandingPoint, 0.02);
  const keeper = runtime?.keeperReachMultiplier
    ? { ...input.keeper, reach: input.keeper.reach * runtime.keeperReachMultiplier }
    : input.keeper;
  const savedByKeeper = insideGoal && isSavedByKeeper(landingPoint, keeper, effectivePower);
  const blockedByWall = insideGoal && !savedByKeeper && isBlockedByWall(landingPoint, input.wall, effectiveSpin);
  const scored = insideGoal && !savedByKeeper && !blockedByWall;
  const outcome = getOutcome(scored, savedByKeeper, blockedByWall);
  const reasonCode = getReasonCode({
    insideGoal,
    mathCorrect: input.mathCorrect,
    targetPoint,
    landingPoint,
    savedByKeeper,
    blockedByWall,
    wind: input.wind,
  });
  const appliedModifiers: AppliedModifier[] = [];
  if (!input.mathCorrect) appliedModifiers.push({ id: "reduced-accuracy", amount: noise });
  if (Math.hypot(input.wind.x, input.wind.y) > 0) {
    appliedModifiers.push({ id: "wind", amount: Math.hypot(input.wind.x, input.wind.y) });
  }
  if (input.mathPower) appliedModifiers.push({ id: `math-power:${input.mathPower}`, amount: 1 });
  if (runtime?.keeperReachMultiplier !== undefined && runtime.keeperReachMultiplier !== 1) {
    appliedModifiers.push({ id: "flow:keeper-reach", amount: runtime.keeperReachMultiplier });
  }
  if (runtime?.targetSizeMultiplier !== undefined && runtime.targetSizeMultiplier !== 1) {
    appliedModifiers.push({ id: "flow:target-size", amount: runtime.targetSizeMultiplier });
  }
  if (runtime?.windMultiplier !== undefined && runtime.windMultiplier !== 1) {
    appliedModifiers.push({ id: "flow:wind", amount: runtime.windMultiplier });
  }

  return {
    scored,
    targetCoord: input.targetCoord,
    targetPoint,
    landingPoint,
    actualCoord: goalPointToCoord(landingPoint, input.gridQuadrants),
    mathCorrect: input.mathCorrect,
    powerUsed: effectivePower,
    spinUsed: effectiveSpin,
    savedByKeeper,
    blockedByWall,
    trajectoryPoints: calculateTrajectory({
      power: effectivePower,
      targetX: targetPoint.x,
      targetY: targetPoint.y,
      spin: effectiveSpin,
      wind: 0,
      arcBoost: modifiers.arcBoost,
      targetPoint: landingPoint,
    }),
    bonusMultiplier: 1 + (input.mathCorrect ? 0.5 : 0) + modifiers.scoreBonus,
    outcome,
    reasonCode,
    appliedModifiers,
    input,
  };
}

/**
 * Compatibility adapter for the pre-V9 call site. It translates legacy
 * normalized inputs into the explicit V9 ShotInput contract.
 */
export function resolveShotResult(
  targetCoord: Vec2,
  mathCorrect: boolean,
  power: number,
  spin: number,
  keeper: GoalkeeperState,
  wall: WallPlayer[],
  levelConfig: LegacyLevelConfig,
  mathPower: MathPower = null,
  seed = 1,
  runtimeModifiers?: ShotInput["runtimeModifiers"],
): ShotResolution {
  const gridQuadrants: 1 | 4 = levelConfig.gridQuadrants
    ?? (targetCoord.x < 0 || targetCoord.y < 0 ? 4 : 1);
  const wind = createWindSnapshot(levelConfig.wind, levelConfig.windStrength, seed);
  return resolveShot({
    targetCoord,
    gridQuadrants,
    mathCorrect,
    basePower: power,
    spin,
    mathPower,
    keeper: {
      position: keeper.position,
      reach: levelConfig.hasKeeper === false ? 0 : 0.25 + levelConfig.keeperSpeed * 0.35,
    },
    wall: wall.map((player) => ({ position: player.position, radius: 0.18 })),
    wind,
    seed,
    runtimeModifiers,
  });
}
