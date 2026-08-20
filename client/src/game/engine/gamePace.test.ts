import "../test/coverageSetup";
import { describe, expect, it } from "vitest";
import {
  adjustTimeLimit,
  GAME_PACE_CONFIG,
  getAssistanceThresholds,
  getAutoShootDelayMs,
  getMathAssistanceStage,
  getResultTransitionMs,
  getRetrySeconds,
  getShotAnimationDuration,
  isGamePace,
} from "./gamePace";

describe("game pace", () => {
  it("keeps the three original pace limits stable and adds a faster match floor", () => {
    expect(adjustTimeLimit(10, "easy")).toBe(30);
    expect(adjustTimeLimit(10, "medium")).toBe(20);
    expect(adjustTimeLimit(10, "match")).toBe(15);
    expect(adjustTimeLimit(10, "hard")).toBe(10);
  });

  it("preserves at least one second for invalid base timers", () => {
    expect(adjustTimeLimit(0, "easy")).toBe(1);
    expect(adjustTimeLimit(-10, "hard")).toBe(1);
  });

  it("recognizes only supported paces", () => {
    expect(isGamePace("easy")).toBe(true);
    expect(isGamePace("medium")).toBe(true);
    expect(isGamePace("match")).toBe(true);
    expect(isGamePace("hard")).toBe(true);
    expect(isGamePace("extreme")).toBe(false);
  });

  it("keeps pace multipliers ordered from relaxed to fast", () => {
    expect(GAME_PACE_CONFIG.easy.multiplier).toBeGreaterThan(GAME_PACE_CONFIG.medium.multiplier);
    expect(GAME_PACE_CONFIG.medium.multiplier).toBeGreaterThan(GAME_PACE_CONFIG.match.multiplier);
    expect(GAME_PACE_CONFIG.match.multiplier).toBeGreaterThan(GAME_PACE_CONFIG.hard.multiplier);
  });

  it("makes match mode feel faster without removing math thinking time", () => {
    expect(GAME_PACE_CONFIG.match.minimumSeconds).toBe(15);
    expect(GAME_PACE_CONFIG.match.retrySeconds).toBe(2);
    expect(getAutoShootDelayMs("match")).toBe(450);
    expect(getResultTransitionMs("match")).toBe(700);
    expect(getResultTransitionMs("match", true)).toBe(900);
    expect(getShotAnimationDuration("match", null)).toBe(432);
    expect(getShotAnimationDuration("match", "turbo")).toBe(346);
    expect(getShotAnimationDuration("match", "perfect")).toBe(528);
    expect(getShotAnimationDuration("match", "turbo")).toBeLessThan(600);
  });

  it("progresses assistance from calm to hint, visual, urgent and expired", () => {
    expect(getMathAssistanceStage(30)).toBe("calm");
    expect(getMathAssistanceStage(15)).toBe("hint");
    expect(getMathAssistanceStage(8)).toBe("visual");
    expect(getMathAssistanceStage(5)).toBe("urgent");
    expect(getMathAssistanceStage(0)).toBe("expired");
  });

  it("scales assistance thresholds to a shorter match challenge", () => {
    expect(getAssistanceThresholds(15)).toEqual({ hint: 9, visual: 5, urgent: 2 });
    expect(getMathAssistanceStage(10, 15)).toBe("calm");
    expect(getMathAssistanceStage(9, 15)).toBe("hint");
    expect(getMathAssistanceStage(5, 15)).toBe("visual");
    expect(getMathAssistanceStage(2, 15)).toBe("urgent");
  });

  it("grants one grace retry outside hard mode", () => {
    expect(getRetrySeconds("easy", false)).toBe(5);
    expect(getRetrySeconds("medium", false)).toBe(3);
    expect(getRetrySeconds("match", false)).toBe(2);
    expect(getRetrySeconds("hard", false)).toBe(0);
    expect(getRetrySeconds("easy", true)).toBe(0);
  });
});
