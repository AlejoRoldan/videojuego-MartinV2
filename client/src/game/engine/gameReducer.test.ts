import { describe, expect, it, vi, afterEach } from "vitest";
import { gameReducer, initialGameState } from "./gameReducer";
import type { ShotResult } from "./types";

afterEach(() => vi.restoreAllMocks());

function makeResult(overrides: Partial<ShotResult> = {}): ShotResult {
  return {
    scored: true,
    targetCoord: { x: 1, y: 1 },
    actualCoord: { x: 1, y: 1 },
    mathCorrect: true,
    powerUsed: 90,
    spinUsed: 0,
    savedByKeeper: false,
    blockedByWall: false,
    trajectoryPoints: [],
    bonusMultiplier: 1.5,
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
    expect(state.phase).toBe("aiming");
    expect(state.lastMathCorrect).toBeNull();
  });

  it("ignores invalid level ids", () => {
    const state = gameReducer(initialGameState, { type: "START_LEVEL", levelId: 999 });
    expect(state).toBe(initialGameState);
  });

  it("moves non-direction levels into math phase after target selection", () => {
    let state = gameReducer(initialGameState, { type: "START_LEVEL", levelId: 3 });
    state = gameReducer(state, { type: "SET_TARGET", coord: { x: 1, y: 1 } });
    expect(state.phase).toBe("math");
    expect(state.targetCoord).toEqual({ x: 1, y: 1 });
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

  it("updates score, combo, shot counts and result state after a goal", () => {
    let state = gameReducer(initialGameState, { type: "START_LEVEL", levelId: 1 });
    state = gameReducer(state, { type: "SHOT_COMPLETE", result: makeResult() });
    expect(state.shotsTaken).toBe(1);
    expect(state.shotsScored).toBe(1);
    expect(state.combo).toBe(1);
    expect(state.score).toBeGreaterThan(0);
    expect(state.phase).toBe("result");
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
