import "../test/coverageSetup";
import { describe, expect, it } from "vitest";
import { FIELD_SCENE, createGameplayCamera, getProjectedBallRadiusPx, interpolateFlight, projectWorldPoint } from "./cameraProjection";
import { MATCH_BALL, simulateShot, velocityFromAngles, type FlightSample } from "./shotPhysics3d";

const viewport = { width: 400, height: 600 };
const camera = createGameplayCamera(18.3);

function sample(timeSeconds: number, x: number): FlightSample {
  return {
    timeSeconds,
    positionM: { x, y: timeSeconds, z: timeSeconds * 10 },
    velocityMps: { x, y: 1, z: 10 },
    accelerationMps2: { x: 0, y: -9.81, z: 0 },
    speedMps: Math.hypot(x, 1, 10),
  };
}

describe("V10 gameplay camera", () => {
  it("uses a realistic visible field and regulation penalty area", () => {
    expect(FIELD_SCENE.visibleWidthM).toBe(45);
    expect(FIELD_SCENE.penaltyAreaWidthM).toBe(40.32);
    expect(FIELD_SCENE.penaltyAreaDepthM).toBe(16.5);
    expect(FIELD_SCENE.penaltySpotDistanceM).toBe(11);
  });

  it("projects the camera target at the center of the viewport", () => {
    const point = projectWorldPoint(camera.targetM, camera, viewport);
    expect(point?.x).toBeCloseTo(viewport.width / 2, 8);
    expect(point?.y).toBeCloseTo(viewport.height / 2, 8);
  });

  it("keeps left and right points visually symmetric", () => {
    const left = projectWorldPoint({ x: -3, y: 1, z: 18.3 }, camera, viewport)!;
    const right = projectWorldPoint({ x: 3, y: 1, z: 18.3 }, camera, viewport)!;
    expect(left.x + right.x).toBeCloseTo(viewport.width, 8);
    expect(right.x).toBeGreaterThan(left.x);
    expect(left.y).toBeCloseTo(right.y, 8);
  });

  it("renders a farther ball smaller", () => {
    const near = getProjectedBallRadiusPx({ x: 0, y: MATCH_BALL.radiusM, z: 0 }, MATCH_BALL.radiusM, camera, viewport);
    const far = getProjectedBallRadiusPx({ x: 0, y: 1, z: 18 }, MATCH_BALL.radiusM, camera, viewport);
    expect(near).toBeGreaterThan(far);
    expect(far).toBeGreaterThanOrEqual(2.8);
  });

  it("moves the camera gently forward during flight", () => {
    const start = createGameplayCamera(24, 0);
    const finish = createGameplayCamera(24, 1);
    expect(finish.positionM.z).toBeGreaterThan(start.positionM.z);
    expect(finish.verticalFovDegrees).toBeLessThan(start.verticalFovDegrees);
  });

  it("does not project points behind the camera", () => {
    expect(projectWorldPoint({ x: 0, y: 1, z: -20 }, camera, viewport)).toBeNull();
  });

  it("interpolates physical samples by simulation time", () => {
    const samples = [sample(0, 0), sample(0.25, 1), sample(1, 4)];
    expect(interpolateFlight(samples, 0)).toBe(samples[0]);
    expect(interpolateFlight(samples, 1)).toBe(samples[2]);
    expect(interpolateFlight(samples, 0.5).positionM.x).toBeCloseTo(2, 8);
    expect(interpolateFlight(samples, 0.5).timeSeconds).toBeCloseTo(0.5, 8);
  });

  it("projects every sample in a calibrated central shot", () => {
    const result = simulateShot({
      initialPositionM: { x: 0, y: MATCH_BALL.radiusM, z: 0 },
      initialVelocityMps: velocityFromAngles(25, 17),
      spinRadPerSecond: { x: 0, y: 0, z: 0 },
      goal: { widthM: 7.32, heightM: 2.44, planeZM: 18.3 },
    });
    expect(result.samples.every((flightSample) => projectWorldPoint(flightSample.positionM, camera, viewport) !== null)).toBe(true);
  });

  it("rejects invalid camera and viewport inputs", () => {
    expect(() => createGameplayCamera(0)).toThrow(RangeError);
    expect(() => projectWorldPoint({ x: 0, y: 0, z: 0 }, camera, { width: 0, height: 10 })).toThrow(RangeError);
    expect(() => getProjectedBallRadiusPx({ x: 0, y: 0, z: 0 }, 0, camera, viewport)).toThrow(RangeError);
    expect(() => interpolateFlight([], 0.5)).toThrow(RangeError);
  });
});
