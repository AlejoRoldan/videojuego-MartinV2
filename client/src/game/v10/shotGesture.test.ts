import "../test/coverageSetup";
import { describe, expect, it } from "vitest";
import { curveFromSwipe, getForceBand, launchFromSwipe } from "./shotGesture";

const viewport = { width: 400, height: 600 };

describe("V10 swipe controls", () => {
  it("rejects taps and downward swipes", () => {
    expect(launchFromSwipe({ x: 200, y: 500, timeMs: 0 }, { x: 202, y: 490, timeMs: 150 }, viewport).reason).toBe("too_short");
    expect(launchFromSwipe({ x: 200, y: 400, timeMs: 0 }, { x: 250, y: 520, timeMs: 200 }, viewport).reason).toBe("must_swipe_up");
  });

  it("maps faster swipes to stronger shots", () => {
    const slow = launchFromSwipe({ x: 200, y: 520, timeMs: 0 }, { x: 200, y: 250, timeMs: 800 }, viewport);
    const fast = launchFromSwipe({ x: 200, y: 520, timeMs: 0 }, { x: 200, y: 250, timeMs: 220 }, viewport);
    expect(slow.valid).toBe(true);
    expect(fast.speedMps).toBeGreaterThan(slow.speedMps);
    expect(fast.force).toBeGreaterThan(slow.force);
  });

  it("maps lateral launch motion to symmetric yaw", () => {
    const right = launchFromSwipe({ x: 200, y: 520, timeMs: 0 }, { x: 300, y: 250, timeMs: 330 }, viewport);
    const left = launchFromSwipe({ x: 200, y: 520, timeMs: 0 }, { x: 100, y: 250, timeMs: 330 }, viewport);
    expect(right.yawDegrees).toBeCloseTo(-left.yawDegrees, 8);
    expect(right.speedMps).toBeCloseTo(left.speedMps, 8);
  });

  it("uses verticality for elevation without exceeding the playable range", () => {
    const diagonal = launchFromSwipe({ x: 200, y: 520, timeMs: 0 }, { x: 340, y: 300, timeMs: 300 }, viewport);
    const vertical = launchFromSwipe({ x: 200, y: 520, timeMs: 0 }, { x: 200, y: 180, timeMs: 300 }, viewport);
    expect(vertical.elevationDegrees).toBeGreaterThan(diagonal.elevationDegrees);
    expect(vertical.elevationDegrees).toBeLessThanOrEqual(24);
  });

  it("maps opposite in-flight swipes to opposite spin", () => {
    const right = curveFromSwipe({ x: 180, y: 300, timeMs: 0 }, { x: 310, y: 300, timeMs: 180 }, viewport);
    const left = curveFromSwipe({ x: 220, y: 300, timeMs: 0 }, { x: 90, y: 300, timeMs: 180 }, viewport);
    expect(right.direction).toBe("right");
    expect(left.direction).toBe("left");
    expect(right.sidespinRadPerSecond).toBeCloseTo(-left.sidespinRadPerSecond, 8);
  });

  it("rejects accidental tiny curve gestures", () => {
    expect(curveFromSwipe({ x: 200, y: 300, timeMs: 0 }, { x: 208, y: 302, timeMs: 120 }, viewport)).toEqual({
      valid: false,
      sidespinRadPerSecond: 0,
      strength: 0,
      direction: "none",
    });
  });

  it("keeps force labels aligned with the calibrated physics ranges", () => {
    expect(getForceBand(18)).toBe("soft");
    expect(getForceBand(22)).toBe("controlled");
    expect(getForceBand(28)).toBe("powerful");
  });

  it("rejects invalid viewport dimensions", () => {
    expect(() => launchFromSwipe({ x: 0, y: 1, timeMs: 0 }, { x: 1, y: 0, timeMs: 10 }, { width: 0, height: 100 })).toThrow(RangeError);
  });
});
