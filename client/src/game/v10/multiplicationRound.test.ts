import "../test/coverageSetup";
import { describe, expect, it } from "vitest";
import {
  MULTIPLICATION_TRACKS,
  createMultiplicationChallenge,
  evaluateMultiplicationAnswer,
} from "./multiplicationRound";

describe("V10 multiplication round", () => {
  it("creates deterministic challenges and unique answer options", () => {
    const first = createMultiplicationChallenge(7, "tables-2-5");
    expect(first).toEqual(createMultiplicationChallenge(7, "tables-2-5"));
    expect(first.options).toHaveLength(4);
    expect(new Set(first.options).size).toBe(4);
    expect(first.options).toContain(first.answer);
  });

  it("covers every configured table inside a complete cycle", () => {
    for (const track of ["tables-2-5", "tables-6-9"] as const) {
      const config = MULTIPLICATION_TRACKS[track];
      const challenges = Array.from({ length: 16 }, (_, index) => createMultiplicationChallenge(index, track));
      expect(new Set(challenges.map((challenge) => challenge.a))).toEqual(new Set([config.minimum, config.minimum + 1, config.minimum + 2, config.maximum]));
      expect(challenges.every((challenge) => challenge.b >= config.minimum && challenge.b <= config.maximum)).toBe(true);
    }
  });

  it("marks a correct first response as a precision microvictory", () => {
    const challenge = createMultiplicationChallenge(0, "tables-2-5");
    expect(evaluateMultiplicationAnswer(challenge, challenge.answer, 0)).toMatchObject({
      correct: true,
      solved: true,
      firstTry: true,
      assistance: "none",
    });
  });

  it("gives progressive help without revealing the result on the first miss", () => {
    const challenge = createMultiplicationChallenge(0, "tables-2-5");
    const firstMiss = evaluateMultiplicationAnswer(challenge, -1, 0);
    const secondMiss = evaluateMultiplicationAnswer(challenge, -1, firstMiss.nextAttempt);
    expect(firstMiss.assistance).toBe("groups");
    expect(firstMiss.feedback).not.toContain(String(challenge.answer));
    expect(secondMiss.assistance).toBe("addition");
    expect(secondMiss.feedback).toContain("+");
  });

  it("records assisted success without calling it first try", () => {
    const challenge = createMultiplicationChallenge(3, "tables-6-9");
    expect(evaluateMultiplicationAnswer(challenge, challenge.answer, 2)).toMatchObject({
      correct: true,
      solved: true,
      firstTry: false,
      assistance: "addition",
    });
  });

  it("normalizes invalid sequence and attempt counters safely", () => {
    const challenge = createMultiplicationChallenge(Number.NaN, "tables-2-5");
    expect(challenge.sequenceIndex).toBe(0);
    expect(evaluateMultiplicationAnswer(challenge, challenge.answer, Number.NaN).firstTry).toBe(true);
  });
});
