import { describe, expect, it } from "vitest";
import { adjustTimeLimit, GAME_PACE_CONFIG, isGamePace } from "./gamePace";

describe("game pace", () => {
  it("uses easy as the slowest pace with the most thinking time", () => {
    expect(adjustTimeLimit(10, "easy")).toBe(20);
    expect(adjustTimeLimit(10, "medium")).toBe(15);
    expect(adjustTimeLimit(10, "hard")).toBe(10);
  });

  it("preserves at least one second", () => {
    expect(adjustTimeLimit(0, "easy")).toBe(1);
    expect(adjustTimeLimit(-10, "hard")).toBe(1);
  });

  it("recognizes only supported paces", () => {
    expect(isGamePace("easy")).toBe(true);
    expect(isGamePace("medium")).toBe(true);
    expect(isGamePace("hard")).toBe(true);
    expect(isGamePace("extreme")).toBe(false);
  });

  it("keeps pace multipliers ordered from relaxed to fast", () => {
    expect(GAME_PACE_CONFIG.easy.multiplier).toBeGreaterThan(GAME_PACE_CONFIG.medium.multiplier);
    expect(GAME_PACE_CONFIG.medium.multiplier).toBeGreaterThan(GAME_PACE_CONFIG.hard.multiplier);
  });
});
