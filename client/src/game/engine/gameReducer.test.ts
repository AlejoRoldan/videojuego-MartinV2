import "../test/coverageSetup";
import { describe, expect, it, vi, afterEach } from "vitest";
import { gameReducer, initialGameState } from "./gameReducer";
import type { ShotResult } from "./types";

afterEach(() => vi.restoreAllMocks());

function makeResult(overrides: Partial<ShotResult> = {}): ShotResult {
  return {
    scored: true,
    targetCoord: { x: 1, y: 1 },
    targetPoint: { x: 0.1666666667, y: 0.8333333333 },
    landingPoint: { x: 0.1666666667, y: 0.8333333333 },
    actualCoord: { x: 1, y: 1 },
    mathCorrect: true,
    powerUsed: 90,
    spinUsed: 0,
    savedByKeeper: false,
    blockedByWall: false,
    trajectoryPoints: [{ x: 0.5, y: 0.92 }, { x: 0.1666666667, y: 0.8333333333 }],
    bonusMultiplier: 1.5,
    outcome: "goal",
    reasonCode: "clean_target",
    appliedModifiers: [],
    input: {
      targetCoord: { x: 1, y: 1 },
      gridQuadrants: 1,
      mathCorrect: true,
      basePower: 90,
      spin: 0,
      mathPower: null,
      keeper: { position: { x: 0.5, y: 0.5 }, reach: 0.25 },
      wall: [],
      wind: { x: 0, y: 0 },
      seed: 1,
    },
    ...overrides,
  };
}

describe("game reducer", () => {
  it("starts a valid level and resets run state", () => {
    const state = gameReducer(initialGameState, { type: "START_LEVEL", levelId: 1 });
    expect(state.screen).toBe("gameplay");
    expect(state.currentLevel).toBe(1);
    expect(state.shotsTaken).toBe(0);
    expect(state.shotsScored).toBe(0);
    expect(state.shotHistory).toEqual([]);
    expect(state.phase).toBe("aiming");
    expect(state.lastMathCorrect).toBeNull();
  });

  it("creates the level-five wall at the same normalized height used by physics", () => {
    const state = gameReducer(initialGameState, { type: "START_LEVEL", levelId: 5 });
    expect(state.wall).toHaveLength(3);
    expect(state.wall.every((player) => player.position.y === 0.67)).toBe(true);
  });

  it("ignores invalid level ids", () => {
    const state = gameReducer(initialGameState, { type: "START_LEVEL", levelId: 999 });
    expect(state).toBe(initialGameState);
  });

  it("normalizes arcade spin without changing the selected target", () => {
    let state = gameReducer(initialGameState, { type: "START_LEVEL", levelId: 3 });
    state = gameReducer(state, { type: "SET_TARGET", coord: { x: 3, y: 2 } });
    state = gameReducer(state, { type: "SET_SPIN", spin: 1.8 });
    expect(state.ball.spin).toBe(1);
    expect(state.targetCoord).toEqual({ x: 3, y: 2 });
    state = gameReducer(state, { type: "SET_SPIN", spin: -0.75 });
    expect(state.ball.spin).toBe(-0.75);
  });

  it("moves non-direction levels into math phase after target selection", () => {
    let state = gameReducer(initialGameState, { type: "START_LEVEL", levelId: 3 });
    state = gameReducer(state, { type: "SET_TARGET", coord: { x: 1, y: 1 } });
    expect(state.phase).toBe("math");
    expect(state.targetCoord).toEqual({ x: 1, y: 1 });
  });

  it("lets the player refine aim after math without reopening or losing the earned power", () => {
    let state = gameReducer(initialGameState, { type: "START_LEVEL", levelId: 3 });
    state = gameReducer(state, { type: "SET_TARGET", coord: { x: 1, y: 1 } });
    state = gameReducer(state, {
      type: "SUBMIT_MATH",
      answer: state.currentChallenge!.answer,
      timeLeft: state.currentChallenge!.timeLimit,
    });
    const earnedPower = state.currentMathPower;
    const powerSequence = state.mathPowerSequence;

    state = gameReducer(state, { type: "SET_TARGET", coord: { x: 3, y: 2 } });

    expect(state.phase).toBe("aiming");
    expect(state.targetCoord).toEqual({ x: 3, y: 2 });
    expect(state.lastMathCorrect).toBe(true);
    expect(state.currentMathPower).toBe(earnedPower);
    expect(state.mathPowerSequence).toBe(powerSequence);
  });

  it("keeps direction tutorial in aiming phase", () => {
    let state = gameReducer(initialGameState, { type: "START_LEVEL", levelId: 1 });
    state = gameReducer(state, { type: "SET_TARGET", coord: { x: 1, y: 1 } });
    expect(state.phase).toBe("aiming");
    expect(state.ball.power).toBe(80);
    expect(state.lastMathCorrect).toBe(true);
  });

  it("enables a small hint without changing the math question", () => {
    let state = gameReducer(initialGameState, { type: "START_LEVEL", levelId: 3 });
    state = gameReducer(state, { type: "SET_TARGET", coord: { x: 1, y: 1 } });
    const question = state.currentChallenge?.question;
    state = gameReducer(state, { type: "MATH_ASSISTANCE", stage: "hint" });
    expect(state.adaptiveDifficulty.hintsEnabled).toBe(true);
    expect(state.currentChallenge?.question).toBe(question);
    expect(state.currentChallenge?.assistanceStage).toBe("hint");
  });

  it("strengthens the hint as assistance becomes visual and urgent", () => {
    let state = gameReducer(initialGameState, { type: "START_LEVEL", levelId: 3 });
    state = gameReducer(state, { type: "SET_TARGET", coord: { x: 1, y: 1 } });
    state = gameReducer(state, { type: "MATH_ASSISTANCE", stage: "visual" });
    expect(state.currentChallenge?.hint).toContain("Mira las opciones");
    state = gameReducer(state, { type: "MATH_ASSISTANCE", stage: "urgent" });
    expect(state.currentChallenge?.hint).toContain("estima primero");
  });

  it("grants a single retry with a new short timer and visible coaching", () => {
    let state = gameReducer(initialGameState, { type: "START_LEVEL", levelId: 3 });
    state = gameReducer(state, { type: "SET_TARGET", coord: { x: 1, y: 1 } });
    state = gameReducer(state, { type: "GRANT_MATH_RETRY", seconds: 5 });
    expect(state.phase).toBe("math");
    expect(state.currentChallenge?.retryGranted).toBe(true);
    expect(state.currentChallenge?.timeLimit).toBe(5);
    expect(state.currentChallenge?.question).toMatch(/^💡 Segunda oportunidad:/);
    expect(state.adaptiveDifficulty.hintsEnabled).toBe(true);

    const once = state;
    state = gameReducer(state, { type: "GRANT_MATH_RETRY", seconds: 5 });
    expect(state).toBe(once);
  });

  it("persists adaptive difficulty after repeated wrong answers", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    let state = gameReducer(initialGameState, { type: "START_LEVEL", levelId: 3 });
    state = gameReducer(state, { type: "SET_TARGET", coord: { x: 1, y: 1 } });
    const wrongAnswer = (state.currentChallenge?.answer ?? 1) + 999;
    for (let i = 0; i < 5; i++) {
      state = gameReducer(state, { type: "SUBMIT_MATH", answer: wrongAnswer });
    }
    expect(state.adaptiveDifficulty.currentMultiplier).toBeLessThan(1);
    expect(state.adaptiveDifficulty.hintsEnabled).toBe(true);
    expect(state.lastMathCorrect).toBe(false);
  });

  it("stores a correct math outcome independently from shot power", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    let state = gameReducer(initialGameState, { type: "START_LEVEL", levelId: 3 });
    state = gameReducer(state, { type: "SET_TARGET", coord: { x: 1, y: 1 } });
    state = gameReducer(state, {
      type: "SUBMIT_MATH",
      answer: state.currentChallenge!.answer,
      timeLeft: state.currentChallenge!.timeLimit,
    });
    expect(state.lastMathCorrect).toBe(true);
    expect(state.ball.power).toBe(85);
    expect(state.currentMathPower).toBe("perfect");
    expect(state.perfectStreak).toBe(1);
    expect(state.mathPowerSequence).toBe(1);
  });

  it("resets Perfect streak after retry and preserves it between shots", () => {
    let state = gameReducer(initialGameState, { type: "START_LEVEL", levelId: 3 });
    state = gameReducer(state, { type: "SET_TARGET", coord: { x: 1, y: 1 } });
    state = gameReducer(state, {
      type: "SUBMIT_MATH",
      answer: state.currentChallenge!.answer,
      timeLeft: state.currentChallenge!.timeLimit,
      usedRetry: true,
    });
    expect(state.perfectStreak).toBe(0);
    expect(state.currentMathPower).not.toBe("perfect");

    const next = gameReducer({ ...state, phase: "result" }, { type: "NEXT_SHOT" });
    expect(next.perfectStreak).toBe(0);
  });

  it("celebrates the five-answer Perfect milestone only once", () => {
    let state = gameReducer(initialGameState, { type: "START_LEVEL", levelId: 3 });
    state = gameReducer(state, { type: "SET_TARGET", coord: { x: 1, y: 1 } });

    for (let index = 0; index < 5; index += 1) {
      state = gameReducer(state, {
        type: "SUBMIT_MATH",
        answer: state.currentChallenge!.answer,
        timeLeft: state.currentChallenge!.timeLimit,
      });
    }

    const milestoneText = "¡RACHA PERFECTA! 5 ACERTADOS";
    expect(state.perfectStreak).toBe(5);
    expect(state.floatingTexts.filter((item) => item.text === milestoneText)).toHaveLength(1);

    state = gameReducer(state, {
      type: "SUBMIT_MATH",
      answer: state.currentChallenge!.answer,
      timeLeft: state.currentChallenge!.timeLimit,
    });
    expect(state.perfectStreak).toBe(5);
    expect(state.floatingTexts.filter((item) => item.text === milestoneText)).toHaveLength(1);
  });

  it("emits Math Power spark particles for the resolved power", () => {
    const base = gameReducer(initialGameState, { type: "START_LEVEL", levelId: 1 });
    const result = makeResult({
      input: { ...makeResult().input, mathPower: "curve" },
    });
    const state = gameReducer(base, { type: "SHOT_COMPLETE", result });
    expect(state.particles.some((particle) => particle.type === "spark" && particle.color === "#B388FF")).toBe(true);
  });

  it("awards and labels a corner bonus only for an actual resolved corner", () => {
    const base = gameReducer(initialGameState, { type: "START_LEVEL", levelId: 1 });
    const corner = gameReducer(base, { type: "SHOT_COMPLETE", result: makeResult({ bonusMultiplier: 2 }) });
    const center = gameReducer(base, {
      type: "SHOT_COMPLETE",
      result: makeResult({
        targetPoint: { x: 0.5, y: 0.5 },
        landingPoint: { x: 0.5, y: 0.5 },
        actualCoord: { x: 2, y: 2 },
        targetCoord: { x: 2, y: 2 },
        bonusMultiplier: 2,
      }),
    });

    expect(corner.floatingTexts.some((item) => item.text === "¡ESQUINA! BONUS")).toBe(true);
    expect(center.floatingTexts.some((item) => item.text === "¡ESQUINA! BONUS")).toBe(false);
    expect(corner.score).toBeGreaterThan(center.score);
  });

  it("recognizes correct mathematics even when the shot is saved", () => {
    const base = gameReducer(initialGameState, { type: "START_LEVEL", levelId: 1 });
    const result = makeResult({
      scored: false,
      savedByKeeper: true,
      outcome: "saved",
      reasonCode: "keeper_reach",
      mathCorrect: true,
      bonusMultiplier: 1,
      input: { ...makeResult().input, mathPower: "precision" },
    });
    const state = gameReducer(base, { type: "SHOT_COMPLETE", result });
    expect(state.score).toBe(25);
    expect(state.floatingTexts.some((item) => item.text.includes("Buen cálculo"))).toBe(true);
  });

  it("does not shoot without a target", () => {
    const state = gameReducer(initialGameState, { type: "SHOOT" });
    expect(state).toBe(initialGameState);
  });

  it("transitions to shooting when target and level are ready", () => {
    let state = gameReducer(initialGameState, { type: "START_LEVEL", levelId: 1 });
    state = gameReducer(state, { type: "SET_TARGET", coord: { x: 1, y: 1 } });
    state = gameReducer(state, { type: "SHOOT" });
    expect(state.phase).toBe("shooting");
    expect(state.ball.inFlight).toBe(true);
  });

  it("stores the precomputed V9 resolution before the ball animation", () => {
    let state = gameReducer(initialGameState, { type: "START_LEVEL", levelId: 1 });
    state = gameReducer(state, { type: "SET_TARGET", coord: { x: 1, y: 1 } });
    const result = makeResult({ outcome: "saved", scored: false, savedByKeeper: true, reasonCode: "keeper_reach" });
    state = gameReducer(state, { type: "SHOOT", resolution: result });
    expect(state.phase).toBe("shooting");
    expect(state.lastShotResult).toBe(result);
    expect(state.ball.trail).toEqual(result.trajectoryPoints);
  });

  it("updates score, combo, shot counts and result state after a goal", () => {
    let state = gameReducer(initialGameState, { type: "START_LEVEL", levelId: 1 });
    state = gameReducer(state, { type: "SHOT_COMPLETE", result: makeResult() });
    expect(state.shotsTaken).toBe(1);
    expect(state.shotsScored).toBe(1);
    expect(state.combo).toBe(1);
    expect(state.score).toBeGreaterThan(0);
    expect(state.phase).toBe("result");
    expect(state.shotHistory).toEqual(["goal"]);
  });

  it("preserves the real shot order for the HUD", () => {
    let state = gameReducer(initialGameState, { type: "START_LEVEL", levelId: 1 });
    state = gameReducer(state, {
      type: "SHOT_COMPLETE",
      result: makeResult({
        outcome: "saved",
        scored: false,
        savedByKeeper: true,
        reasonCode: "keeper_reach",
      }),
    });
    state = gameReducer(state, { type: "SHOT_COMPLETE", result: makeResult() });

    expect(state.shotHistory).toEqual(["saved", "goal"]);
  });

  it("uses the particle lifetime contract when ticking visual rewards", () => {
    const stateWithParticle = {
      ...initialGameState,
      particles: [{ id: "spark-1", x: 0.5, y: 0.5, vx: 0, vy: 0, color: "#FFD700", size: 5, life: 1, maxLife: 1, type: "spark" as const }],
    };
    const ticked = gameReducer(stateWithParticle, { type: "TICK_PARTICLES" });
    expect(ticked.particles[0]?.life).toBeCloseTo(0.95, 5);
    let expired = ticked;
    for (let i = 0; i < 19; i++) expired = gameReducer(expired, { type: "TICK_PARTICLES" });
    expect(expired.particles).toHaveLength(0);
  });

  it("resets combo after a missed shot", () => {
    let state = { ...initialGameState, combo: 3, maxCombo: 3 };
    state = gameReducer(state, { type: "SHOT_COMPLETE", result: makeResult({ scored: false, mathCorrect: false, bonusMultiplier: 1 }) });
    expect(state.combo).toBe(0);
    expect(state.maxCombo).toBe(3);
  });

  it("goes to victory when target goals have been reached", () => {
    const base = gameReducer(initialGameState, { type: "START_LEVEL", levelId: 1 });
    const state = gameReducer({ ...base, shotsScored: 3, shotsTaken: 3 }, { type: "NEXT_SHOT" });
    expect(state.screen).toBe("victory");
  });

  it("goes to defeat when shots are exhausted", () => {
    const base = gameReducer(initialGameState, { type: "START_LEVEL", levelId: 1 });
    const state = gameReducer({ ...base, shotsScored: 1, shotsTaken: 5 }, { type: "NEXT_SHOT" });
    expect(state.screen).toBe("defeat");
  });

  it("resets to initial state", () => {
    const dirty = { ...initialGameState, score: 999, screen: "victory" as const };
    const state = gameReducer(dirty, { type: "RESET_GAME" });
    expect(state.score).toBe(0);
    expect(state.screen).toBe("home");
    expect(state.lastMathCorrect).toBeNull();
  });
});
