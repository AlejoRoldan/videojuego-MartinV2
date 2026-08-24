import "../test/coverageSetup";
import { describe, expect, it } from "vitest";
import { continueFlightWithSpin, createInteractiveShotConfig } from "./midFlightSpin";
import { magnitude, simulateShot } from "./shotPhysics3d";

describe("V10 in-flight spin", () => {
  const config = createInteractiveShotConfig(25, 17, 0, 18.3);
  const straight = simulateShot(config);

  it("continues from the exact visible sample without teleporting", () => {
    const continuation = continueFlightWithSpin(straight, 0.35, 90, config);
    const appliedIndex = continuation.result.samples.findIndex((sample) => sample.timeSeconds === continuation.appliedAt.timeSeconds);
    expect(appliedIndex).toBeGreaterThan(0);
    expect(continuation.result.samples[appliedIndex].positionM).toEqual(continuation.appliedAt.positionM);
    expect(continuation.result.samples[appliedIndex - 1].timeSeconds).toBeLessThan(continuation.appliedAt.timeSeconds);
  });

  it("curves equal spin gestures to mirrored sides", () => {
    const right = continueFlightWithSpin(straight, 0.3, 90, config).result;
    const left = continueFlightWithSpin(straight, 0.3, -90, config).result;
    expect(right.goalPlaneCrossing!.positionM.x).toBeCloseTo(-left.goalPlaneCrossing!.positionM.x, 7);
    expect(right.goalPlaneCrossing!.positionM.x).toBeGreaterThan(0);
  });

  it("preserves an exact goal-plane crossing and increasing sample times", () => {
    const result = continueFlightWithSpin(straight, 0.5, 75, config).result;
    expect(result.goalPlaneCrossing?.positionM.z).toBe(18.3);
    expect(result.samples.every((sample, index) => index === 0 || sample.timeSeconds > result.samples[index - 1].timeSeconds)).toBe(true);
    expect(result.flightTimeSeconds).toBe(result.samples.at(-1)?.timeSeconds);
  });

  it("builds an SI-unit launch with the requested speed", () => {
    const interactive = createInteractiveShotConfig(27, 15, 4, 24);
    expect(magnitude(interactive.initialVelocityMps)).toBeCloseTo(27, 9);
    expect(interactive.goal.planeZM).toBe(24);
    expect(interactive.spinRadPerSecond).toEqual({ x: 0, y: 0, z: 0 });
  });

  it("is deterministic and rejects invalid spin", () => {
    expect(continueFlightWithSpin(straight, 0.4, 82, config)).toEqual(continueFlightWithSpin(straight, 0.4, 82, config));
    expect(() => continueFlightWithSpin(straight, 0.4, Number.NaN, config)).toThrow(RangeError);
    expect(() => continueFlightWithSpin({ ...straight, samples: [straight.samples[0]] }, 0.4, 80, config)).toThrow(RangeError);
  });
});
