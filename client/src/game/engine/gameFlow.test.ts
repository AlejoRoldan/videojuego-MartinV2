import "../test/coverageSetup";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AUTO_SHOOT_DELAY_MS,
  calculateRemainingMathTime,
  createGameplayEventId,
  resolveMathCorrect,
  scheduleAutoShoot,
} from "./gameFlow";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("GameContext coordination", () => {
  it("derives remaining time from the moment the challenge started", () => {
    expect(calculateRemainingMathTime(20, 1_000, 6_500)).toBe(14.5);
    expect(calculateRemainingMathTime(5, 1_000, 9_000)).toBe(0);
    expect(calculateRemainingMathTime(20, null, 6_500)).toBe(20);
  });

  it("keeps math correctness explicit and supports direction levels", () => {
    expect(resolveMathCorrect(true, "multiplication")).toBe(true);
    expect(resolveMathCorrect(false, "multiplication")).toBe(false);
    expect(resolveMathCorrect(null, "directions")).toBe(true);
    expect(resolveMathCorrect(null, "coordinates")).toBe(false);
  });

  it("keeps event ids unique when shot counters restart in a new level", () => {
    const firstLevel = createGameplayEventId("session-test", 1, "math", 1);
    const secondLevel = createGameplayEventId("session-test", 2, "math", 1);
    const secondLevelShot = createGameplayEventId("session-test", 2, "shot", 1);

    expect(new Set([firstLevel, secondLevel, secondLevelShot]).size).toBe(3);
    expect(secondLevel).toContain("run-2-math-1");
  });

  it("auto-shoots once after the feedback delay", () => {
    vi.useFakeTimers();
    const dispatch = vi.fn();
    let inFlight = false;
    scheduleAutoShoot({
      dispatch,
      isInFlight: () => inFlight,
      markInFlight: () => { inFlight = true; },
    });

    vi.advanceTimersByTime(AUTO_SHOOT_DELAY_MS - 1);
    expect(dispatch).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(dispatch).toHaveBeenCalledOnce();
    expect(dispatch).toHaveBeenCalledWith({ type: "SHOOT" });
    expect(inFlight).toBe(true);
  });

  it("uses the snapshot-aware shoot callback once without fallback dispatch", () => {
    vi.useFakeTimers();
    const dispatch = vi.fn();
    const markInFlight = vi.fn();
    const onShoot = vi.fn();
    scheduleAutoShoot({
      dispatch,
      isInFlight: () => false,
      markInFlight,
      onShoot,
      delayMs: 100,
    });

    vi.advanceTimersByTime(99);
    expect(onShoot).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onShoot).toHaveBeenCalledOnce();
    expect(markInFlight).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("does not dispatch a duplicate shot while the ball is in flight", () => {
    vi.useFakeTimers();
    const dispatch = vi.fn();
    scheduleAutoShoot({
      dispatch,
      isInFlight: () => true,
      markInFlight: vi.fn(),
    });
    vi.runAllTimers();
    expect(dispatch).not.toHaveBeenCalled();
  });
});
