import "../test/coverageSetup";
import { describe, expect, it, vi } from "vitest";
import {
  calculateTrajectory,
  createKeeperSnapshot,
  isCornerGoalPoint,
  KEEPER_GOAL_Y,
  resolveShot,
  resolveShotResult,
  WALL_PLAYER_RADIUS,
} from "./physics";
import { coordToGoalPoint, goalPointToCoord } from "./coordinates";
import { DEFAULT_RUNTIME_MODIFIERS } from "./flowEngine";
import type { ShotInput } from "./types";

function makeInput(overrides: Partial<ShotInput> = {}): ShotInput {
  return {
    targetCoord: { x: 2, y: 2 },
    gridQuadrants: 1,
    mathCorrect: true,
    basePower: 100,
    spin: 0,
    mathPower: null,
    keeper: { position: { x: 0.98, y: 0.08 }, reach: 0.04 },
    wall: [],
    wind: { x: 0, y: 0 },
    seed: 42,
    ...overrides,
  };
}

describe("V9 shot fairness and determinism", () => {
  it("PHY-01 ends a correct unobstructed shot in the selected cell", () => {
    const result = resolveShot(makeInput({ targetCoord: { x: 1, y: 1 } }));

    expect(result.outcome).toBe("goal");
    expect(result.actualCoord).toEqual({ x: 1, y: 1 });
    expect(result.trajectoryPoints.at(-1)).toEqual(result.landingPoint);
  });

  it("PHY-13 keeps different aim cells physically distinct", () => {
    const left = resolveShot(makeInput({
      targetCoord: { x: 1, y: 3 },
      keeper: { position: { x: 0.5, y: 0.5 }, reach: 0.01 },
      seed: 7,
    }));
    const right = resolveShot(makeInput({
      targetCoord: { x: 3, y: 1 },
      keeper: { position: { x: 0.5, y: 0.5 }, reach: 0.01 },
      seed: 7,
    }));

    expect(left.outcome).toBe("goal");
    expect(right.outcome).toBe("goal");
    expect(left.actualCoord).toEqual({ x: 1, y: 3 });
    expect(right.actualCoord).toEqual({ x: 3, y: 1 });
    expect(left.landingPoint.x).toBeLessThan(right.landingPoint.x);
    expect(left.landingPoint.y).toBeLessThan(right.landingPoint.y);
    expect(left.trajectoryPoints[30].x).not.toBeCloseTo(right.trajectoryPoints[30].x, 2);
    expect(left.trajectoryPoints.at(-1)).not.toEqual(right.trajectoryPoints.at(-1));
  });

  it("PHY-02 saves a centered shot deterministically when the keeper reaches it", () => {
    const result = resolveShot(makeInput({
      keeper: { position: { x: 0.5, y: 0.5 }, reach: 0.3 },
    }));

    expect(result.outcome).toBe("saved");
    expect(result.reasonCode).toBe("keeper_reach");
    expect(result.mathCorrect).toBe(true);
  });

  it("PHY-03 persists the captured keeper snapshot and evaluates that exact position", () => {
    const captured = createKeeperSnapshot({ x: 0.98, y: 0.08 }, 0.3);
    const result = resolveShotResult(
      { x: 2, y: 2 },
      true,
      100,
      0,
      {
        position: { x: 0.5, y: 0.5 },
        speed: 0.3,
        direction: 1,
        diving: false,
        diveTarget: null,
      },
      [],
      { keeperSpeed: 0.3, hasKeeper: true, wind: false, windStrength: 0, gridQuadrants: 1 },
      null,
      42,
      undefined,
      captured,
    );

    expect(result.input.keeper).toEqual(captured);
    expect(result.outcome).toBe("goal");
    expect(result.savedByKeeper).toBe(false);
  });

  it("PHY-04 keeps a centered captured keeper snapshot deterministic and saveable", () => {
    const captured = createKeeperSnapshot({ x: 0.5, y: 0.5 }, 0.3);
    const result = resolveShotResult(
      { x: 2, y: 2 },
      true,
      100,
      0,
      {
        position: { x: 0.98, y: 0.08 },
        speed: 0.3,
        direction: -1,
        diving: false,
        diveTarget: null,
      },
      [],
      { keeperSpeed: 0.3, hasKeeper: true, wind: false, windStrength: 0, gridQuadrants: 1 },
      null,
      42,
      undefined,
      captured,
    );

    expect(result.input.keeper).toEqual(captured);
    expect(result.outcome).toBe("saved");
    expect(result.reasonCode).toBe("keeper_reach");
  });

  it("keeps corner detection independent from Math Power bonuses", () => {
    expect(isCornerGoalPoint({ x: 0.1, y: 0.1 })).toBe(true);
    expect(isCornerGoalPoint({ x: 0.9, y: 0.9 })).toBe(true);
    expect(isCornerGoalPoint({ x: 0.5, y: 0.5 })).toBe(false);
    expect(isCornerGoalPoint({ x: 0.9, y: 0.5 })).toBe(false);
  });

  it("uses the shared wall radius in the legacy adapter", () => {
    const result = resolveShotResult(
      { x: 1, y: 1 },
      true,
      100,
      0,
      { position: { x: 0.95, y: KEEPER_GOAL_Y }, speed: 0, direction: 1, diving: false, diveTarget: null },
      [{ id: 1, position: { x: 0.2, y: 0.67 }, number: 4 }],
      { keeperSpeed: 0, hasKeeper: false, wind: false, windStrength: 0, gridQuadrants: 1 },
    );

    expect(result.input.wall[0]?.radius).toBe(WALL_PLAYER_RADIUS);
  });

  it("PHY-05 scores a high corner against a slow central keeper", () => {
    const result = resolveShot(makeInput({
      targetCoord: { x: 3, y: 3 },
      keeper: { position: { x: 0.5, y: 0.5 }, reach: 0.1 },
    }));

    expect(result.outcome).toBe("goal");
    expect(result.actualCoord).toEqual({ x: 3, y: 3 });
  });

  it("PHY-04 returns identical points and outcome for the same inputs 100 times", () => {
    const input = makeInput({ targetCoord: { x: 3, y: 2 }, wind: { x: -0.03, y: 0.01 }, seed: 2029 });
    const results = Array.from({ length: 100 }, () => resolveShot(input));

    expect(new Set(results.map((result) => JSON.stringify(result))).size).toBe(1);
  });

  it("PHY-05 keeps incorrect-answer drift bounded and actualCoord coherent", () => {
    const input = makeInput({ mathCorrect: false, basePower: 20, seed: 17 });
    const result = resolveShot(input);
    const targetPoint = coordToGoalPoint(input.targetCoord, input.gridQuadrants);
    const drift = Math.hypot(result.landingPoint.x - targetPoint.x, result.landingPoint.y - targetPoint.y);

    expect(drift).toBeLessThanOrEqual(0.15);
    expect(result.actualCoord).toEqual(goalPointToCoord(result.landingPoint, input.gridQuadrants));
    expect(result.reasonCode).toBe("reduced_accuracy");
  });

  it("PHY-06 uses the evaluated wind destination as the final trajectory point", () => {
    const result = resolveShot(makeInput({
      targetCoord: { x: 3, y: 2 },
      wind: { x: -0.05, y: 0.02 },
    }));

    expect(result.reasonCode).toBe("wind_drift");
    expect(result.trajectoryPoints.at(-1)).toEqual(result.landingPoint);
    expect(result.landingPoint.x).toBeCloseTo(result.targetPoint.x - 0.05);
    expect(result.landingPoint.y).toBeCloseTo(result.targetPoint.y + 0.02);
  });

  it("PHY-07 blocks a low shot aligned with a wall without hidden probability", () => {
    const result = resolveShot(makeInput({
      targetCoord: { x: 2, y: 1 },
      wall: [{ position: { x: 0.5, y: 0.8333333333 }, radius: 0.14 }],
    }));

    expect(result.outcome).toBe("blocked");
    expect(result.reasonCode).toBe("wall_block");
  });

  it("shrinks the physical wall when flow assistance reduces its visible reach", () => {
    const input = makeInput({
      targetCoord: { x: 2, y: 1 },
      wall: [{ position: { x: 0.5, y: 0.6983333333 }, radius: 0.14 }],
    });
    const blocked = resolveShot(input);
    const assisted = resolveShot({
      ...input,
      runtimeModifiers: { ...DEFAULT_RUNTIME_MODIFIERS, wallReachMultiplier: 0.7 },
    });

    expect(blocked.outcome).toBe("blocked");
    expect(assisted.outcome).toBe("goal");
    expect(assisted.appliedModifiers).toContainEqual({ id: "flow:wall-reach", amount: 0.7 });
  });

  it("PHY-08 does not block a high shot over the wall", () => {
    const result = resolveShot(makeInput({
      targetCoord: { x: 2, y: 3 },
      wall: [{ position: { x: 0.5, y: 0.1666666667 }, radius: 0.14 }],
    }));

    expect(result.outcome).toBe("goal");
    expect(result.blockedByWall).toBe(false);
  });

  it("PHY-09 round-trips every one-quadrant cell", () => {
    for (let x = 1; x <= 3; x++) {
      for (let y = 1; y <= 3; y++) {
        expect(goalPointToCoord(coordToGoalPoint({ x, y }, 1), 1)).toEqual({ x, y });
      }
    }
  });

  it("PHY-10 round-trips four-quadrant boundaries and center", () => {
    const coordinates = [
      { x: -3, y: -3 },
      { x: -3, y: 3 },
      { x: 3, y: -3 },
      { x: 3, y: 3 },
      { x: 0, y: 0 },
    ];

    for (const coord of coordinates) {
      expect(goalPointToCoord(coordToGoalPoint(coord, 4), 4)).toEqual(coord);
    }
  });

  it("PHY-11 persists selected spin and bends the trajectory deterministically", () => {
    const neutral = resolveShot(makeInput({ spin: 0, targetCoord: { x: 3, y: 2 } }));
    const curved = resolveShot(makeInput({ spin: 0.8, targetCoord: { x: 3, y: 2 } }));

    expect(curved.input.spin).toBe(0.8);
    expect(curved.spinUsed).toBe(0.8);
    expect(curved.trajectoryPoints.at(30)?.x).toBeGreaterThan(neutral.trajectoryPoints.at(30)?.x ?? 0);
    expect(resolveShot(makeInput({ spin: 0.8, targetCoord: { x: 3, y: 2 } }))).toEqual(curved);
  });

  it("never calls Math.random while resolving a shot", () => {
    const random = vi.spyOn(Math, "random").mockImplementation(() => {
      throw new Error("Math.random must not decide a shot outcome");
    });

    expect(() => resolveShot(makeInput({ mathCorrect: false }))).not.toThrow();
    expect(random).not.toHaveBeenCalled();
    random.mockRestore();
  });

  it("keeps legacy trajectory calls bounded", () => {
    const points = calculateTrajectory({ power: 80, targetX: 0.5, targetY: 0.8, spin: 0.2, wind: 0.1 });
    expect(points).toHaveLength(61);
    expect(points.at(-1)?.x).toBeGreaterThanOrEqual(0.02);
    expect(points.at(-1)?.x).toBeLessThanOrEqual(0.98);
  });
});
