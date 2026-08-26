import "../test/coverageSetup";
import { describe, expect, it } from "vitest";
import {
  getMathPowerModifiers,
  isPerfectStreakComplete,
  PERFECT_STREAK_TARGET,
  selectMathPower,
  updatePerfectStreak,
} from "./mathPowers";

describe("Math Powers", () => {
  it("awards Perfect Shot for a fast correct first attempt", () => {
    expect(selectMathPower("multiplication", 18, 30, false)).toBe("perfect");
    expect(selectMathPower("angle", 20, 30, false)).toBe("perfect");
  });

  it("does not award Perfect Shot after a retry", () => {
    expect(selectMathPower("angle", 5, 5, true)).toBe("curve");
  });

  it("maps math concepts to useful football powers", () => {
    expect(selectMathPower("multiplication", 5, 30)).toBe("precision");
    expect(selectMathPower("angle", 5, 30)).toBe("curve");
    expect(selectMathPower("coordinate", 5, 30)).toBe("turbo");
    expect(selectMathPower("velocity", 5, 30)).toBe("turbo");
  });

  it("makes precision meaningfully reduce shot noise", () => {
    expect(getMathPowerModifiers("precision").accuracyNoiseMultiplier).toBeLessThan(0.5);
  });

  it("gives curve a strong automatic spin", () => {
    expect(getMathPowerModifiers("curve").autoSpin).toBeGreaterThan(0.5);
  });

  it("gives turbo more power and faster animation intent", () => {
    const turbo = getMathPowerModifiers("turbo");
    expect(turbo.powerBonus).toBeGreaterThan(0);
    expect(turbo.animationSpeed).toBeGreaterThan(1);
  });

  it("makes Perfect Shot the strongest combined reward", () => {
    const perfect = getMathPowerModifiers("perfect");
    expect(perfect.accuracyNoiseMultiplier).toBe(0);
    expect(perfect.powerBonus).toBeGreaterThan(getMathPowerModifiers("turbo").powerBonus);
    expect(perfect.arcBoost).toBeGreaterThan(1);
    expect(perfect.animationSpeed).toBeLessThan(1);
  });

  it("starts a Perfect streak on the first fast, correct answer", () => {
    expect(PERFECT_STREAK_TARGET).toBe(5);
    expect(updatePerfectStreak(0, true, 18, 30)).toBe(1);
    expect(isPerfectStreakComplete(1)).toBe(false);
  });

  it("completes exactly five consecutive Perfect answers and remains capped", () => {
    const streak = Array.from({ length: PERFECT_STREAK_TARGET }).reduce(
      (current) => updatePerfectStreak(current, true, 18, 30),
      0,
    );

    expect(streak).toBe(PERFECT_STREAK_TARGET);
    expect(isPerfectStreakComplete(streak)).toBe(true);
    expect(updatePerfectStreak(streak, true, 18, 30)).toBe(PERFECT_STREAK_TARGET);
  });

  it.each([
    ["slow answer", 17, 30, false],
    ["incorrect answer", 18, 30, false],
    ["retry", 18, 30, true],
  ])("resets the streak after a %s", (_label, timeLeft, timeLimit, usedRetry) => {
    const correct = _label !== "incorrect answer";
    expect(updatePerfectStreak(4, correct, timeLeft, timeLimit, usedRetry)).toBe(0);
  });

  it("resets on timeout and invalid timing instead of producing an invalid value", () => {
    expect(updatePerfectStreak(4, true, undefined, 30)).toBe(0);
    expect(updatePerfectStreak(4, true, 0, 0)).toBe(0);
    expect(updatePerfectStreak(Number.NaN, true, 18, 30)).toBe(1);
    expect(updatePerfectStreak(-10, true, 18, 30)).toBe(1);
    expect(Number.isFinite(updatePerfectStreak(4, true, Number.NaN, 30))).toBe(true);
  });

  it("preserves a valid streak between tiros without a hidden reset", () => {
    const first = updatePerfectStreak(0, true, 20, 30);
    const second = updatePerfectStreak(first, true, 20, 30);
    const third = updatePerfectStreak(second, true, 20, 30);

    expect([first, second, third]).toEqual([1, 2, 3]);
  });
});
