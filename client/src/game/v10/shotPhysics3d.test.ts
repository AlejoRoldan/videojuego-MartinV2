import "../test/coverageSetup";
import { describe, expect, it } from "vitest";
import {
  MATCH_BALL,
  REGULATION_GOAL,
  calculateAcceleration,
  classifyGoalMouth,
  simulateShot,
  velocityFromAngles,
  type BallSpecification,
  type FlightSample,
  type ShotPhysicsConfig,
} from "./shotPhysics3d";
import { REFERENCE_KICKS, buildReferenceKickConfig, simulateReferenceKick } from "./referenceKicks";

const baseConfig: ShotPhysicsConfig = {
  initialPositionM: { x: 0, y: MATCH_BALL.radiusM, z: 0 },
  initialVelocityMps: velocityFromAngles(25, 17),
  spinRadPerSecond: { x: 0, y: 0, z: 0 },
  goal: REGULATION_GOAL,
};

function crossingSample(x: number, y: number): FlightSample {
  return {
    timeSeconds: 1,
    positionM: { x, y, z: REGULATION_GOAL.planeZM },
    velocityMps: { x: 0, y: 0, z: 20 },
    accelerationMps2: { x: 0, y: -9.81, z: 0 },
    speedMps: 20,
  };
}

describe("V10 metric shot physics", () => {
  it("is exactly deterministic for the same input", () => {
    expect(simulateShot(baseConfig)).toEqual(simulateShot(baseConfig));
  });

  it("uses a fixed 120 Hz step until the interpolated final sample", () => {
    const result = simulateShot(baseConfig);
    for (let index = 1; index < result.samples.length - 1; index += 1) {
      expect(result.samples[index].timeSeconds - result.samples[index - 1].timeSeconds).toBeCloseTo(1 / 120, 10);
    }
    expect(result.goalPlaneCrossing?.positionM.z).toBe(REGULATION_GOAL.planeZM);
  });

  it("turns launch speed, elevation and yaw into physical velocity", () => {
    const velocity = velocityFromAngles(20, 30, 0);
    expect(velocity.x).toBeCloseTo(0, 10);
    expect(velocity.y).toBeCloseTo(10, 10);
    expect(velocity.z).toBeCloseTo(10 * Math.sqrt(3), 10);
  });

  it("applies gravity even when the ball is stationary relative to the air", () => {
    expect(calculateAcceleration({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 })).toEqual({
      x: 0,
      y: -9.81,
      z: 0,
    });
  });

  it("uses aerodynamic drag to reduce arrival speed", () => {
    const noDragBall: BallSpecification = { ...MATCH_BALL, dragCoefficient: 0, maxLiftCoefficient: 0 };
    const realistic = simulateShot(baseConfig);
    const vacuum = simulateShot({ ...baseConfig, ball: noDragBall });
    expect(realistic.samples.at(-1)!.speedMps).toBeLessThan(vacuum.samples.at(-1)!.speedMps);
  });

  it("mirrors equal and opposite side spin", () => {
    const right = simulateShot({ ...baseConfig, spinRadPerSecond: { x: 0, y: 90, z: 0 } });
    const left = simulateShot({ ...baseConfig, spinRadPerSecond: { x: 0, y: -90, z: 0 } });
    expect(right.goalPlaneCrossing!.positionM.x).toBeCloseTo(-left.goalPlaneCrossing!.positionM.x, 8);
    expect(right.goalPlaneCrossing!.positionM.y).toBeCloseTo(left.goalPlaneCrossing!.positionM.y, 8);
  });

  it("lets a stronger launch travel farther before touching the ground", () => {
    const goal = { ...REGULATION_GOAL, planeZM: 100 };
    const soft = simulateShot({ ...baseConfig, goal, initialVelocityMps: velocityFromAngles(16, 15) });
    const strong = simulateShot({ ...baseConfig, goal, initialVelocityMps: velocityFromAngles(27, 15) });
    expect(strong.samples.at(-1)!.positionM.z).toBeGreaterThan(soft.samples.at(-1)!.positionM.z);
  });

  it("models wind as a gradual physical displacement", () => {
    const calm = simulateShot(baseConfig);
    const windy = simulateShot({ ...baseConfig, windMps: { x: 4, y: 0, z: 0 } });
    expect(windy.goalPlaneCrossing!.positionM.x).toBeGreaterThan(calm.goalPlaneCrossing!.positionM.x);
  });

  it("classifies the usable goal mouth using the complete ball radius", () => {
    expect(classifyGoalMouth(crossingSample(0, 1), REGULATION_GOAL)).toBe("goal");
    expect(classifyGoalMouth(crossingSample(4, 1), REGULATION_GOAL)).toBe("wide");
    expect(classifyGoalMouth(crossingSample(0, 2.4), REGULATION_GOAL)).toBe("high");
    expect(classifyGoalMouth(crossingSample(0, 0.05), REGULATION_GOAL)).toBe("grounded");
  });

  it("keeps all ten reference kicks inside their calibrated outcome", () => {
    expect(REFERENCE_KICKS).toHaveLength(10);
    for (const kick of REFERENCE_KICKS) {
      const result = simulateReferenceKick(kick);
      expect(result.termination, kick.id).toBe(kick.expected.termination);
      expect(result.goalMouthResult, kick.id).toBe(kick.expected.goalMouthResult);
      expect(buildReferenceKickConfig(kick).goal.planeZM).toBe(kick.distanceM);
    }
  });

  it("rejects invalid physical inputs instead of producing NaN trajectories", () => {
    expect(() => simulateShot({ ...baseConfig, fixedStepSeconds: 0 })).toThrow(RangeError);
    expect(() => simulateShot({ ...baseConfig, initialVelocityMps: { x: Number.NaN, y: 0, z: 1 } })).toThrow(RangeError);
    expect(() => velocityFromAngles(-1, 10)).toThrow(RangeError);
  });
});
