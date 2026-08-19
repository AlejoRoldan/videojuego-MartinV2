import { describe, expect, it, vi, afterEach } from "vitest";
import {
  calculateTrajectory,
  checkGoalkeeperSave,
  checkWallBlock,
  resolveShotResult,
} from "./physics";
import type { GoalkeeperState, WallPlayer } from "./types";

afterEach(() => vi.restoreAllMocks());

describe("physics engine", () => {
  it("generates 61 bounded trajectory points", () => {
    const points = calculateTrajectory({ power: 80, targetX: 0.5, targetY: 0.8, spin: 0.2, wind: 0.1 });
    expect(points).toHaveLength(61);
    for (const p of points) {
      expect(p.x).toBeGreaterThanOrEqual(0.02);
      expect(p.x).toBeLessThanOrEqual(0.98);
      expect(p.y).toBeGreaterThanOrEqual(0.02);
      expect(p.y).toBeLessThanOrEqual(0.98);
    }
  });

  it("does not save shots outside goalkeeper reach", () => {
    expect(checkGoalkeeperSave(1, 0.5, 0.3, 80)).toBe(false);
  });

  it("can save a centered shot inside reach", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    expect(checkGoalkeeperSave(0, 0.5, 0.8, 40)).toBe(true);
  });

  it("ignores empty walls", () => {
    expect(checkWallBlock(0, 0.2, [], 0)).toBe(false);
  });

  it("does not block high shots", () => {
    const wall: WallPlayer[] = [{ id: 1, position: { x: 0.5, y: 0.5 }, number: 4 }];
    expect(checkWallBlock(0, 0.9, wall, 0)).toBe(false);
  });

  it("blocks low aligned shots when RNG says so", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.9);
    const wall: WallPlayer[] = [{ id: 1, position: { x: 0.5, y: 0.5 }, number: 4 }];
    expect(checkWallBlock(0, 0.2, wall, 0)).toBe(true);
  });

  it("reduces power after an incorrect math answer", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const keeper: GoalkeeperState = {
      position: { x: 0.5, y: 0.5 }, speed: 0, direction: 1, diving: false, diveTarget: null,
    };
    const result = resolveShotResult(
      { x: 0, y: 0 }, false, 80, 0, keeper, [],
      { keeperSpeed: 0, wind: false, windStrength: 0, gridMax: { x: 3, y: 3 } }
    );
    expect(result.powerUsed).toBe(44);
  });

  it("awards math bonus multiplier on correct answers", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const keeper: GoalkeeperState = {
      position: { x: 0.5, y: 0.5 }, speed: 0, direction: 1, diving: false, diveTarget: null,
    };
    const result = resolveShotResult(
      { x: 0, y: 0 }, true, 80, 0, keeper, [],
      { keeperSpeed: 0, wind: false, windStrength: 0, gridMax: { x: 3, y: 3 } }
    );
    expect(result.bonusMultiplier).toBeGreaterThanOrEqual(1.5);
  });
});
