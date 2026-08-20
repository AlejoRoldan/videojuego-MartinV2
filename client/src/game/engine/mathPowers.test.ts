import "../test/coverageSetup";
import { describe, expect, it } from "vitest";
import { getMathPowerModifiers, selectMathPower } from "./mathPowers";

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
});
