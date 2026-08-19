// =============================================================
// TIRO LIBRE MATEMÁTICO — Physics Engine v3
// Math Powers integrated into shot resolution
// =============================================================

import type { Vec2, GoalkeeperState, WallPlayer, ShotResult, MathPower } from "./types";
import { getMathPowerModifiers } from "./mathPowers";

export interface PhysicsConfig {
  power: number;
  targetX: number;
  targetY: number;
  spin: number;
  wind: number;
  arcBoost?: number;
}

export function calculateTrajectory(config: PhysicsConfig): Vec2[] {
  const { power, targetX, targetY, spin, wind, arcBoost = 1 } = config;
  const points: Vec2[] = [];
  const steps = 60;
  const startX = 0.5;
  const startY = 0.92;
  const endX = 0.5 + targetX * 0.38;
  const endY = 0.75 - targetY * 0.55;
  const powerFactor = Math.max(0.4, power / 100);

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = startX + (endX - startX) * t;
    const arcHeight = 0.25 * powerFactor * arcBoost * Math.sin(Math.PI * t);
    const y = startY + (endY - startY) * t - arcHeight;
    const spinOffset = spin * 0.08 * Math.sin(Math.PI * t);
    const windOffset = wind * 0.04 * t * t;
    points.push({
      x: Math.max(0.02, Math.min(0.98, x + spinOffset + windOffset)),
      y: Math.max(0.02, Math.min(0.98, y)),
    });
  }
  return points;
}

export function checkGoalkeeperSave(targetX: number, keeperX: number, keeperSpeed: number, power: number): boolean {
  const keeperPos = (keeperX - 0.5) * 2;
  const dist = Math.abs(targetX - keeperPos);
  const reach = 0.25 + keeperSpeed * 0.35;
  const powerFactor = power / 100;
  const effectiveReach = reach * (1 - powerFactor * 0.3);
  if (dist > effectiveReach) return false;
  const closeness = 1 - dist / effectiveReach;
  return Math.random() < closeness * 0.75;
}

export function checkWallBlock(targetX: number, targetY: number, wall: WallPlayer[], spin: number): boolean {
  if (wall.length === 0) return false;
  for (const player of wall) {
    const wallX = (player.position.x - 0.5) * 2;
    const dx = Math.abs(targetX - wallX);
    if (targetY > 0.6) continue;
    const spinHelp = Math.abs(spin) * 0.15;
    const blockRadius = 0.18 - spinHelp;
    if (dx < blockRadius) return Math.random() > 0.25;
  }
  return false;
}

export function resolveShotResult(
  targetCoord: Vec2,
  mathCorrect: boolean,
  power: number,
  spin: number,
  keeper: GoalkeeperState,
  wall: WallPlayer[],
  levelConfig: {
    keeperSpeed: number;
    wind: boolean;
    windStrength: number;
    gridMax?: Vec2;
  },
  mathPower: MathPower = null
): ShotResult {
  const gridMax = levelConfig.gridMax ?? { x: 3, y: 3 };
  const normalizedX = targetCoord.x / gridMax.x;
  const normalizedY = (targetCoord.y + gridMax.y) / (gridMax.y * 2);
  const modifiers = getMathPowerModifiers(mathCorrect ? mathPower : null);
  const effectivePower = mathCorrect
    ? Math.min(100, power + modifiers.powerBonus)
    : power * 0.55;
  const direction = normalizedX >= 0 ? 1 : -1;
  const effectiveSpin = Math.max(-1, Math.min(1, spin || modifiers.autoSpin * direction));
  const wind = levelConfig.wind ? (Math.random() - 0.5) * levelConfig.windStrength * 2 : 0;

  const accuracy = effectivePower / 100;
  const noise = (1 - accuracy) * 0.15 * modifiers.accuracyNoiseMultiplier;
  const actualX = normalizedX + (Math.random() - 0.5) * noise;
  const actualY = normalizedY + (Math.random() - 0.5) * noise;

  const savedByKeeper = levelConfig.keeperSpeed > 0
    ? checkGoalkeeperSave(actualX, keeper.position.x, levelConfig.keeperSpeed, effectivePower)
    : false;
  const blockedByWall = checkWallBlock(actualX, actualY, wall, effectiveSpin);
  const inGoal = Math.abs(actualX) <= 1.0 && actualY >= 0 && actualY <= 1.0;
  const scored = inGoal && !savedByKeeper && !blockedByWall;

  const trajectory = calculateTrajectory({
    power: effectivePower,
    targetX: normalizedX,
    targetY: normalizedY,
    spin: effectiveSpin,
    wind,
    arcBoost: modifiers.arcBoost,
  });

  let bonusMultiplier = 1;
  if (mathCorrect) bonusMultiplier += 0.5;
  bonusMultiplier += modifiers.scoreBonus;
  if (scored && Math.abs(normalizedX) > 0.65) bonusMultiplier += 0.5;
  if (scored && normalizedY > 0.65) bonusMultiplier += 0.3;

  return {
    scored,
    targetCoord,
    actualCoord: {
      x: Math.round(actualX * gridMax.x),
      y: Math.round(actualY * gridMax.y * 2 - gridMax.y),
    },
    mathCorrect,
    powerUsed: effectivePower,
    spinUsed: effectiveSpin,
    savedByKeeper,
    blockedByWall,
    trajectoryPoints: trajectory,
    bonusMultiplier,
  };
}
