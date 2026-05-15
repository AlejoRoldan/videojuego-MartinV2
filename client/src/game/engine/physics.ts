// =============================================================
// TIRO LIBRE MATEMÁTICO — Physics Engine v2
// FIXES: shot precision, trajectory mapping, keeper logic
// =============================================================

import type { Vec2, BallState, GoalkeeperState, WallPlayer, ShotResult } from "./types";

// ── Trajectory ───────────────────────────────────────────────
export interface PhysicsConfig {
  power: number;    // 0-100
  targetX: number;  // -1 to 1 (normalized goal position)
  targetY: number;  // 0 to 1 (normalized goal position)
  spin: number;     // -1 to 1
  wind: number;     // -1 to 1
}

/**
 * Generates a smooth parabolic arc from the ball's starting position
 * to the target in the goal. 60 frames total.
 */
export function calculateTrajectory(config: PhysicsConfig): Vec2[] {
  const { power, targetX, targetY, spin, wind } = config;
  const points: Vec2[] = [];
  const steps = 60;

  // Start: bottom center of the goal area (normalized 0-1 within goal)
  const startX = 0.5;
  const startY = 0.92;

  // End: map normalized -1..1 target to 0.1..0.9 within goal
  const endX = 0.5 + targetX * 0.38;
  // Target Y: 0 = bottom, 1 = top of goal → map to 0.75..0.15 in screen coords
  const endY = 0.75 - targetY * 0.55;

  const powerFactor = Math.max(0.4, power / 100);

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;

    // Horizontal: linear interpolation
    const x = startX + (endX - startX) * t;

    // Vertical: parabolic arc
    const arcHeight = 0.25 * powerFactor * Math.sin(Math.PI * t);
    const y = startY + (endY - startY) * t - arcHeight;

    // Spin: lateral curve (peaks at midpoint)
    const spinOffset = spin * 0.08 * Math.sin(Math.PI * t);

    // Wind: quadratic drift
    const windOffset = wind * 0.04 * t * t;

    points.push({
      x: Math.max(0.02, Math.min(0.98, x + spinOffset + windOffset)),
      y: Math.max(0.02, Math.min(0.98, y)),
    });
  }

  return points;
}

// ── Goalkeeper Save Check ────────────────────────────────────
/**
 * Returns true if the keeper saves the shot.
 * targetX: -1 to 1 (goal position, 0 = center)
 * keeperX: 0 to 1 (keeper position, 0.5 = center)
 */
export function checkGoalkeeperSave(
  targetX: number,
  keeperX: number,  // 0-1 normalized
  keeperSpeed: number,
  power: number
): boolean {
  // Convert keeper position to -1..1 range
  const keeperPos = (keeperX - 0.5) * 2;

  // Distance between target and keeper
  const dist = Math.abs(targetX - keeperPos);

  // Keeper reach depends on speed
  const reach = 0.25 + keeperSpeed * 0.35;

  // High power shots are harder to save
  const powerFactor = power / 100;
  const effectiveReach = reach * (1 - powerFactor * 0.3);

  if (dist > effectiveReach) return false;

  // Within reach: probability based on how close
  const closeness = 1 - dist / effectiveReach;
  const saveProb = closeness * 0.75;
  return Math.random() < saveProb;
}

// ── Wall Block Check ─────────────────────────────────────────
export function checkWallBlock(
  targetX: number,  // -1 to 1
  targetY: number,  // 0 to 1
  wall: WallPlayer[],
  spin: number
): boolean {
  if (wall.length === 0) return false;

  for (const player of wall) {
    // Wall players are positioned in 0-1 space, convert to -1..1
    const wallX = (player.position.x - 0.5) * 2;
    const dx = Math.abs(targetX - wallX);

    // Wall only blocks low shots (targetY < 0.5)
    if (targetY > 0.6) continue;

    // Spin helps curve around wall
    const spinHelp = Math.abs(spin) * 0.15;
    const blockRadius = 0.18 - spinHelp;

    if (dx < blockRadius) {
      return Math.random() > 0.25; // 75% block chance if in range
    }
  }

  return false;
}

// ── Main Shot Resolver ───────────────────────────────────────
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
  }
): ShotResult {
  const gridMax = levelConfig.gridMax ?? { x: 3, y: 3 };

  // Normalize target coord to -1..1 range
  const normalizedX = targetCoord.x / gridMax.x;
  const normalizedY = (targetCoord.y + gridMax.y) / (gridMax.y * 2); // 0..1

  // Math affects power
  const effectivePower = mathCorrect ? power : power * 0.55;

  // Wind effect
  const wind = levelConfig.wind
    ? (Math.random() - 0.5) * levelConfig.windStrength * 2
    : 0;

  // Accuracy noise: less noise with higher power
  const accuracy = effectivePower / 100;
  const noise = (1 - accuracy) * 0.15; // reduced noise for better feel
  const actualX = normalizedX + (Math.random() - 0.5) * noise;
  const actualY = normalizedY + (Math.random() - 0.5) * noise;

  // Check keeper save (using keeper's current animated position)
  const savedByKeeper = levelConfig.keeperSpeed > 0
    ? checkGoalkeeperSave(actualX, keeper.position.x, levelConfig.keeperSpeed, effectivePower)
    : false;

  // Check wall block
  const blockedByWall = checkWallBlock(actualX, actualY, wall, spin);

  // Shot is in goal if within bounds (-1..1 x, 0..1 y)
  const inGoal = Math.abs(actualX) <= 1.0 && actualY >= 0 && actualY <= 1.0;
  const scored = inGoal && !savedByKeeper && !blockedByWall;

  // Generate trajectory
  const trajectory = calculateTrajectory({
    power: effectivePower,
    targetX: normalizedX,
    targetY: normalizedY,
    spin,
    wind,
  });

  // Bonus multiplier
  let bonusMultiplier = 1;
  if (mathCorrect) bonusMultiplier += 0.5;
  if (scored && Math.abs(normalizedX) > 0.65) bonusMultiplier += 0.5; // corner
  if (scored && normalizedY > 0.65) bonusMultiplier += 0.3; // top corner

  return {
    scored,
    targetCoord,
    actualCoord: {
      x: Math.round(actualX * gridMax.x),
      y: Math.round(actualY * gridMax.y * 2 - gridMax.y),
    },
    mathCorrect,
    powerUsed: effectivePower,
    spinUsed: spin,
    savedByKeeper,
    blockedByWall,
    trajectoryPoints: trajectory,
    bonusMultiplier,
  };
}
