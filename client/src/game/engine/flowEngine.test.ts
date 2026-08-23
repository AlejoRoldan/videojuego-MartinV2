import "../test/coverageSetup";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_RUNTIME_MODIFIERS,
  FLOW_COOLDOWN_SHOTS,
  MAX_ASSISTANCE_LEAD_SECONDS,
  MAX_GAMEPLAY_EVENTS,
  PERFORMANCE_WINDOW_SIZE,
  advanceFlowCooldown,
  applyFlowIntervention,
  emptyPerformanceWindow,
  evaluatePerformanceWindow,
  selectFlowIntervention,
} from "./flowEngine";
import type { MathDomain, ShotPerformance } from "./types";

function shot(overrides: Partial<ShotPerformance> = {}): ShotPerformance {
  return {
    domain: "multiplication",
    mathCorrect: true,
    responseTimeMs: 1_200,
    assistanceStage: "none",
    usedRetry: false,
    outcome: "goal",
    scored: true,
    difficulty: "medium",
    ...overrides,
  };
}

function windowFrom(shots: ShotPerformance[]) {
  return evaluatePerformanceWindow(shots);
}

function expectFiniteWindow(window: ReturnType<typeof evaluatePerformanceWindow>) {
  for (const value of [
    window.mathSuccessRate,
    window.footballSuccessRate,
    window.averageResponseTimeMs,
    window.noHelpSuccessRate,
  ]) {
    if (value !== null) expect(Number.isFinite(value)).toBe(true);
  }
}

describe("V9 flow engine contracts", () => {
  it("FLW-01 gives early math assistance after two consecutive math errors", () => {
    const performance = windowFrom([
      shot({ mathCorrect: false, outcome: "missed", scored: false }),
      shot({ mathCorrect: false, outcome: "missed", scored: false }),
    ]);

    const selected = selectFlowIntervention(performance, DEFAULT_RUNTIME_MODIFIERS);

    expect(selected?.trigger).toBe("math_struggle");
    expect(selected?.axis).toBe("assistance");
    expect(selected?.modifiers).toEqual({ assistanceLeadSeconds: 2 });
    expect(selected?.modifiers.keeperReachMultiplier).toBeUndefined();
    expect(performance.shots.every((item) => item.domain === "multiplication")).toBe(true);
  });

  it("FLW-02 reduces only football difficulty after three correct-math football failures", () => {
    const performance = windowFrom([
      shot({ outcome: "saved", scored: false }),
      shot({ outcome: "saved", scored: false }),
      shot({ outcome: "saved", scored: false }),
    ]);

    const selected = selectFlowIntervention(performance, DEFAULT_RUNTIME_MODIFIERS);

    expect(selected?.trigger).toBe("football_struggle");
    expect(selected?.axis).toBe("football");
    expect(selected?.modifiers).toEqual({ keeperReachMultiplier: 0.88 });
    expect(selected?.modifiers.assistanceLeadSeconds).toBeUndefined();
    expect(Object.keys(selected?.modifiers ?? {})).toHaveLength(1);
  });

  it("reduces the dominant football obstacle instead of always changing the keeper", () => {
    const blocked = windowFrom(Array.from({ length: 3 }, () => shot({ outcome: "blocked", scored: false })));
    const missed = windowFrom(Array.from({ length: 3 }, () => shot({ outcome: "missed", scored: false })));

    expect(selectFlowIntervention(blocked, DEFAULT_RUNTIME_MODIFIERS)?.modifiers).toEqual({ wallReachMultiplier: 0.88 });
    expect(selectFlowIntervention(missed, DEFAULT_RUNTIME_MODIFIERS)?.modifiers).toEqual({ targetSizeMultiplier: 1.15 });
  });

  it("FLW-03 leaves an isolated math error unchanged", () => {
    const performance = windowFrom([shot({ mathCorrect: false })]);

    expect(performance.consecutiveMathErrors).toBe(1);
    expect(selectFlowIntervention(performance, DEFAULT_RUNTIME_MODIFIERS)).toBeNull();
  });

  it("FLW-04 raises only one football axis after two mastery windows", () => {
    const performance = windowFrom(Array.from({ length: PERFORMANCE_WINDOW_SIZE }, () => shot()));
    const selected = selectFlowIntervention(performance, DEFAULT_RUNTIME_MODIFIERS, 2);

    expect(selected?.trigger).toBe("sustained_mastery");
    expect(selected?.axis).toBe("football");
    expect(selected?.modifiers).toEqual({ keeperReachMultiplier: 1.05 });
    expect(Object.keys(selected?.modifiers ?? {})).toHaveLength(1);
    expect(selected?.cooldownShots).toBe(FLOW_COOLDOWN_SHOTS);
  });

  it("FLW-05 blocks another mastery increase during cooldown", () => {
    const performance = windowFrom(Array.from({ length: PERFORMANCE_WINDOW_SIZE }, () => shot()));
    const runtime = { ...DEFAULT_RUNTIME_MODIFIERS, cooldownRemaining: 2 };

    expect(selectFlowIntervention(performance, runtime, 2)).toBeNull();
  });

  it("FLW-06 keeps configuration stable for a 70–85 percent window", () => {
    const performance = windowFrom([
      shot(),
      shot(),
      shot(),
      shot(),
      shot({ mathCorrect: false }),
    ]);

    expect(performance.mathSuccessRate).toBe(0.8);
    expect(selectFlowIntervention(performance, DEFAULT_RUNTIME_MODIFIERS)).toBeNull();
  });

  it("FLW-07 returns valid null-safe metrics for empty and incomplete windows", () => {
    const empty = emptyPerformanceWindow();
    const incomplete = windowFrom([shot({ responseTimeMs: null, outcome: "missed", scored: false })]);

    expect(empty.shots).toEqual([]);
    expect(empty.mathSuccessRate).toBeNull();
    expect(empty.footballSuccessRate).toBeNull();
    expect(empty.averageResponseTimeMs).toBeNull();
    expectFiniteWindow(empty);
    expectFiniteWindow(incomplete);
    expect(selectFlowIntervention(empty, DEFAULT_RUNTIME_MODIFIERS)).toBeNull();
    expect(selectFlowIntervention(incomplete, DEFAULT_RUNTIME_MODIFIERS)).toBeNull();
  });

  it("waits for a complete five-shot window before offering rate-based recovery", () => {
    const fourMixedMisses = windowFrom([
      shot({ outcome: "missed", scored: false }),
      shot(),
      shot({ outcome: "missed", scored: false }),
      shot(),
    ]);
    const fiveMixedMisses = windowFrom([
      ...fourMixedMisses.shots,
      shot({ outcome: "missed", scored: false }),
    ]);

    expect(selectFlowIntervention(fourMixedMisses, DEFAULT_RUNTIME_MODIFIERS)).toBeNull();
    expect(selectFlowIntervention(fiveMixedMisses, DEFAULT_RUNTIME_MODIFIERS)?.trigger).toBe("recovery");
  });

  it("keeps rolling windows bounded and applies interventions without mutating the input", () => {
    const domains: MathDomain[] = ["multiplication", "coordinate", "angle", "velocity"];
    const performance = evaluatePerformanceWindow(
      Array.from({ length: PERFORMANCE_WINDOW_SIZE + 3 }, (_, index) => shot({ domain: domains[index % domains.length] })),
    );
    const runtime = { ...DEFAULT_RUNTIME_MODIFIERS };
    const selected = selectFlowIntervention(
      windowFrom([
        shot({ outcome: "saved", scored: false }),
        shot({ outcome: "saved", scored: false }),
        shot({ outcome: "saved", scored: false }),
      ]),
      runtime,
    );
    const next = applyFlowIntervention(runtime, selected);

    expect(performance.shots).toHaveLength(PERFORMANCE_WINDOW_SIZE);
    expect(runtime).toEqual(DEFAULT_RUNTIME_MODIFIERS);
    expect(next.keeperReachMultiplier).toBeCloseTo(0.88);
    expect(next.windMultiplier).toBe(1);
    expect(next.assistanceLeadSeconds).toBe(0);
  });

  it("clamps repeated football adjustments and counts down cooldown safely", () => {
    let runtime = { ...DEFAULT_RUNTIME_MODIFIERS, cooldownRemaining: FLOW_COOLDOWN_SHOTS };
    const selected = {
      trigger: "football_struggle" as const,
      axis: "football" as const,
      change: "test",
      reason: "test",
      modifiers: { keeperReachMultiplier: 0.88, wallReachMultiplier: 0.88, targetSizeMultiplier: 1.15, windMultiplier: 0.88 },
      cooldownShots: FLOW_COOLDOWN_SHOTS,
      windowMathSuccessRate: 1,
      windowFootballSuccessRate: 0,
    };

    for (let index = 0; index < 20; index += 1) runtime = applyFlowIntervention(runtime, selected);
    expect(runtime.keeperReachMultiplier).toBeGreaterThanOrEqual(0.7);
    expect(runtime.wallReachMultiplier).toBeGreaterThanOrEqual(0.7);
    expect(runtime.targetSizeMultiplier).toBeLessThanOrEqual(1.3);
    expect(runtime.windMultiplier).toBeGreaterThanOrEqual(0.7);
    expect(advanceFlowCooldown(runtime).cooldownRemaining).toBe(FLOW_COOLDOWN_SHOTS - 1);
    expect(advanceFlowCooldown({ ...runtime, cooldownRemaining: 0 }).cooldownRemaining).toBe(0);
    expect(MAX_GAMEPLAY_EVENTS).toBe(200);
  });

  it("caps repeated assistance so help cannot grow without bound", () => {
    let runtime = { ...DEFAULT_RUNTIME_MODIFIERS };
    const selected = {
      trigger: "math_struggle" as const,
      axis: "assistance" as const,
      change: "test",
      reason: "test",
      modifiers: { assistanceLeadSeconds: 2 },
      cooldownShots: 0,
      windowMathSuccessRate: 0,
      windowFootballSuccessRate: 0,
    };

    for (let index = 0; index < 20; index += 1) runtime = applyFlowIntervention(runtime, selected);
    expect(runtime.assistanceLeadSeconds).toBe(MAX_ASSISTANCE_LEAD_SECONDS);
  });
});
