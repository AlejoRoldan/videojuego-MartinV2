import "../test/coverageSetup";
import { describe, expect, it } from "vitest";
import { REGULATION_GOAL, type FlightSample, type ShotPhysicsResult } from "./shotPhysics3d";
import { createDefenseActors, resolveFootballShot } from "./footballCollisions";

function sample(timeSeconds: number, x: number, y: number, z: number): FlightSample {
  return {
    timeSeconds,
    positionM: { x, y, z },
    velocityMps: { x: x * 0.2, y: -0.4, z: 20 },
    accelerationMps2: { x: 0, y: -9.81, z: 0 },
    speedMps: 20,
  };
}

function linearResult(crossX: number, crossY: number, reachesGoal = true): ShotPhysicsResult {
  const samples = reachesGoal
    ? [sample(0, 0, 0.11, 0), sample(0.5, crossX * 0.5, crossY, 9.15), sample(0.98, crossX * 0.98, crossY, 17.88), sample(1, crossX, crossY, 18.3)]
    : [sample(0, 0, 0.11, 0), sample(0.5, 0, 0.5, 6), sample(0.8, 0, 0.11, 8)];
  const crossing = reachesGoal ? samples.at(-1)! : null;
  return {
    samples,
    termination: reachesGoal ? "goal_plane" : "ground",
    goalPlaneCrossing: crossing,
    goalMouthResult: reachesGoal
      ? crossY < 0.11 ? "grounded" : crossY > 2.33 ? "high" : Math.abs(crossX) > 3.55 ? "wide" : "goal"
      : null,
    apex: samples.reduce((highest, current) => current.positionM.y > highest.positionM.y ? current : highest),
    flightTimeSeconds: samples.at(-1)!.timeSeconds,
  };
}

describe("V10 football collision resolver", () => {
  it("continues a clean goal into the net", () => {
    const resolved = resolveFootballShot(linearResult(1.2, 1.35), "open", REGULATION_GOAL);
    expect(resolved.outcome).toBe("goal");
    expect(resolved.impactType).toBe("net");
    expect(resolved.displaySamples.at(-1)!.positionM.z).toBeGreaterThan(REGULATION_GOAL.planeZM);
  });

  it("blocks a low central shot with the regulation-distance wall", () => {
    const resolved = resolveFootballShot(linearResult(0, 1.45), "wall", REGULATION_GOAL);
    expect(resolved.outcome).toBe("blocked");
    expect(resolved.impactSample?.positionM.z).toBeCloseTo(9.15, 8);
    expect(resolved.displaySamples.at(-1)!.positionM.z).toBeLessThan(9.15);
  });

  it("lets a shot over the wall continue to the goal", () => {
    expect(resolveFootballShot(linearResult(0, 2.15), "wall", REGULATION_GOAL).outcome).toBe("goal");
  });

  it("saves a reachable shot and can be beaten at a far corner", () => {
    expect(resolveFootballShot(linearResult(0.3, 1.2), "keeper", REGULATION_GOAL).outcome).toBe("saved");
    expect(resolveFootballShot(linearResult(3.25, 2.05), "keeper", REGULATION_GOAL).outcome).toBe("goal");
  });

  it("distinguishes post, crossbar and ordinary miss", () => {
    expect(resolveFootballShot(linearResult(3.66, 1.2), "open", REGULATION_GOAL).outcome).toBe("post");
    expect(resolveFootballShot(linearResult(0.6, 2.44), "open", REGULATION_GOAL).outcome).toBe("crossbar");
    expect(resolveFootballShot(linearResult(4.2, 1.1), "open", REGULATION_GOAL).outcome).toBe("miss");
  });

  it("classifies a trajectory that never arrives as short", () => {
    expect(resolveFootballShot(linearResult(0, 0, false), "keeper", REGULATION_GOAL).outcome).toBe("short");
  });

  it("is deterministic and keeps display time strictly increasing", () => {
    const input = linearResult(0.2, 1.25);
    const first = resolveFootballShot(input, "keeper", REGULATION_GOAL);
    expect(first).toEqual(resolveFootballShot(input, "keeper", REGULATION_GOAL));
    first.displaySamples.slice(1).forEach((current, index) => {
      expect(current.timeSeconds).toBeGreaterThan(first.displaySamples[index].timeSeconds);
    });
  });

  it("creates only the selected defense", () => {
    expect(createDefenseActors("wall", linearResult(0, 1), REGULATION_GOAL).wall).toHaveLength(3);
    expect(createDefenseActors("wall", linearResult(0, 1), REGULATION_GOAL).goalkeeper).toBeNull();
    expect(createDefenseActors("keeper", linearResult(0, 1), REGULATION_GOAL).goalkeeper).not.toBeNull();
    expect(createDefenseActors("open", linearResult(0, 1), REGULATION_GOAL)).toEqual({ wall: [], goalkeeper: null });
  });
});
