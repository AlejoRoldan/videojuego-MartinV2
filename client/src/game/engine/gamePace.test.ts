import "../test/coverageSetup";
import { describe, expect, it } from "vitest";
import {
  adjustTimeLimit,
  GAME_PACE_CONFIG,
  getMathAssistanceStage,
  getRetrySeconds,
  isGamePace,
} from "./gamePace";

describe("game pace", () => {
  it("gives easy mode at least 30 seconds and medium at least 20", () => {
    expect(adjustTimeLimit(10, "easy")).toBe(30);
    expect(adjustTimeLimit(10, "medium")).toBe(20);
    expect(adjustTimeLimit(10, "hard")).toBe(10);
  });

  it("preserves at least one second for invalid base timers", () => {
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

  it("progresses assistance from calm to hint, visual, urgent and expired", () => {
    expect(getMathAssistanceStage(30)).toBe("calm");
    expect(getMathAssistanceStage(15)).toBe("hint");
    expect(getMathAssistanceStage(8)).toBe("visual");
    expect(getMathAssistanceStage(5)).toBe("urgent");
    expect(getMathAssistanceStage(0)).toBe("expired");
  });

  it("grants one grace retry outside hard mode", () => {
    expect(getRetrySeconds("easy", false)).toBe(5);
    expect(getRetrySeconds("medium", false)).toBe(3);
    expect(getRetrySeconds("hard", false)).toBe(0);
    expect(getRetrySeconds("easy", true)).toBe(0);
  });
});
