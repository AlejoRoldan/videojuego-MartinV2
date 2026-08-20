import "../test/coverageSetup";
import { describe, expect, it, vi, afterEach } from "vitest";
import {
  calculatePowerFromMath,
  coordToGoalPosition,
  generateChallenge,
  goalPositionToCoord,
  updateAdaptiveDifficulty,
} from "./mathEngine";
import { LEVELS } from "../levels/levelData";

afterEach(() => vi.restoreAllMocks());

describe("math engine", () => {
  it("generates a valid multiplication challenge", () => {
    const level = LEVELS.find((l) => l.concept === "multiplication")!;
    const challenge = generateChallenge(level);
    expect(challenge.type).toBe("multiplication");
    expect(challenge.options).toContain(challenge.answer);
    expect(challenge.timeLimit).toBeGreaterThan(0);
  });

  it("generates velocity challenges using consistent m/s and meters", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const level = LEVELS.find((l) => l.concept === "velocity")!;
    const challenge = generateChallenge(level);
    expect(challenge.type).toBe("velocity");
    expect(challenge.question).toMatch(/m\/s|metros/);
    expect(challenge.question).not.toMatch(/km\/h/);
    expect(challenge.options).toContain(challenge.answer);
  });

  it("gives higher power for correct fast answers", () => {
    const fast = calculatePowerFromMath(12, 12, 1, 10);
    const slow = calculatePowerFromMath(12, 12, 9, 10);
    expect(fast).toBeGreaterThan(slow);
    expect(fast).toBeLessThanOrEqual(100);
  });

  it("limits incorrect-answer power to 40-60", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    expect(calculatePowerFromMath(11, 12, 1, 10)).toBe(50);
  });

  it("reduces difficulty and enables hints when player struggles", () => {
    const result = updateAdaptiveDifficulty(1, [1, 1, 1, 1, 0], 9.5, 10);
    expect(result.multiplier).toBeLessThan(1);
    expect(result.hintsEnabled).toBe(true);
    expect(result.targetSizeMultiplier).toBeGreaterThan(1);
  });

  it("increases difficulty when player excels", () => {
    const result = updateAdaptiveDifficulty(1, [0, 0, 0, 0, 0], 2, 10);
    expect(result.multiplier).toBeGreaterThan(1);
    expect(result.hintsEnabled).toBe(false);
    expect(result.targetSizeMultiplier).toBeLessThan(1);
  });

  it("handles empty error history without NaN", () => {
    const result = updateAdaptiveDifficulty(1, [], 5, 10);
    expect(Number.isNaN(result.multiplier)).toBe(false);
  });

  it("round-trips goal coordinates", () => {
    const grid = { x: 3, y: 3 };
    const coord = { x: 2, y: -1 };
    const pos = coordToGoalPosition(coord, grid);
    expect(goalPositionToCoord(pos, grid)).toEqual(coord);
  });
});
