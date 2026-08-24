import "../test/coverageSetup";
import { describe, expect, it } from "vitest";
import { getFactPracticeMode, selectAdaptiveMultiplicationChallenge } from "./adaptiveMultiplication";
import {
  createDefaultMultiplicationProgress,
  getMultiplicationFactKey,
  recordCompletedMultiplicationRound,
  type MultiplicationProgressV2,
} from "./multiplicationProgress";

function recordFact(
  progress: MultiplicationProgressV2,
  a: number,
  b: number,
  firstTry: boolean,
  index: number,
): MultiplicationProgressV2 {
  return recordCompletedMultiplicationRound(progress, {
    track: "tables-2-5",
    firstTry,
    scored: false,
    completedAt: `2026-08-24T00:${String(index).padStart(2, "0")}:00.000Z`,
    factors: { a, b },
  }).progress;
}

describe("V10 adaptive multiplication", () => {
  it("starts by exploring an unseen fact", () => {
    const selected = selectAdaptiveMultiplicationChallenge(createDefaultMultiplicationProgress(), "tables-2-5");
    expect(selected.mode).toBe("explore");
    expect(selected.challenge.a).toBeGreaterThanOrEqual(2);
    expect(selected.challenge.b).toBeLessThanOrEqual(5);
  });

  it("avoids immediately repeating the same fact when alternatives are unseen", () => {
    const start = createDefaultMultiplicationProgress();
    const first = selectAdaptiveMultiplicationChallenge(start, "tables-2-5");
    const progressed = recordFact(start, first.challenge.a, first.challenge.b, true, 0);
    const second = selectAdaptiveMultiplicationChallenge(progressed, "tables-2-5");
    expect(second.factKey).not.toBe(first.factKey);
  });

  it("prioritizes a fact that needs reinforcement after the full set was seen", () => {
    let progress = createDefaultMultiplicationProgress();
    let index = 0;
    for (let a = 2; a <= 5; a += 1) {
      for (let b = 2; b <= 5; b += 1) {
        progress = recordFact(progress, a, b, !(a === 4 && b === 5), index);
        index += 1;
      }
    }
    const selection = selectAdaptiveMultiplicationChallenge(progress, "tables-2-5");
    expect(selection.factKey).toBe(getMultiplicationFactKey(4, 5));
    expect(selection.mode).toBe("reinforce");
  });

  it("distinguishes reinforcement, balance and challenge modes", () => {
    expect(getFactPracticeMode({ attempts: 2, firstTryCorrect: 0, assistedCorrect: 2, recentFirstTry: [false, false], lastPlayedRound: 2 })).toBe("reinforce");
    expect(getFactPracticeMode({ attempts: 2, firstTryCorrect: 1, assistedCorrect: 1, recentFirstTry: [true, true], lastPlayedRound: 2 })).toBe("balance");
    expect(getFactPracticeMode({ attempts: 3, firstTryCorrect: 3, assistedCorrect: 0, recentFirstTry: [true, true, true], lastPlayedRound: 3 })).toBe("challenge");
  });

  it("is deterministic for the same persisted profile", () => {
    const progress = recordFact(createDefaultMultiplicationProgress(), 2, 2, false, 0);
    expect(selectAdaptiveMultiplicationChallenge(progress, "tables-2-5"))
      .toEqual(selectAdaptiveMultiplicationChallenge(progress, "tables-2-5"));
  });
});
