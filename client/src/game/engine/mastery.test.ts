import { describe, expect, it } from "vitest";
import {
  MAX_MASTERY_HISTORY,
  MAX_RECENT_CORRECT,
  createDefaultMasteryByDomain,
  emptyMasteryState,
  getMasteryLevel,
  normalizeMasteryByDomain,
  normalizeMasteryHistory,
  recordMasteryAttempt,
} from "./mastery";

function attempt(overrides: Partial<Parameters<typeof recordMasteryAttempt>[2]> = {}) {
  return {
    domain: "multiplication" as const,
    correct: true,
    responseTimeMs: 1_000,
    assistanceStage: "none" as const,
    usedRetry: false,
    occurredAt: "2026-08-23T12:00:00.000Z",
    ...overrides,
  };
}

describe("persistent mastery by math domain", () => {
  it("starts every supported domain in discovering", () => {
    const mastery = createDefaultMasteryByDomain();
    expect(Object.keys(mastery)).toEqual(["multiplication", "coordinate", "angle", "velocity"]);
    expect(mastery.multiplication).toEqual(emptyMasteryState());
  });

  it("transitions from discovering to practicing after five low-accuracy attempts", () => {
    let current = createDefaultMasteryByDomain();
    let history = [];
    for (let index = 0; index < 5; index += 1) {
      const result = recordMasteryAttempt(current, history, attempt({ correct: index === 0, occurredAt: `2026-08-23T12:00:0${index}.000Z` }));
      current = result.masteryByDomain;
      history = result.masteryHistory;
    }
    expect(current.multiplication.attempts).toBe(5);
    expect(current.multiplication.correct).toBe(1);
    expect(current.multiplication.level).toBe("practicing");
  });

  it("transitions to mastering at 70 percent recent accuracy", () => {
    let current = createDefaultMasteryByDomain();
    let history = [];
    for (let index = 0; index < 10; index += 1) {
      const result = recordMasteryAttempt(current, history, attempt({ correct: index >= 3, occurredAt: `2026-08-23T12:01:${String(index).padStart(2, "0")}.000Z` }));
      current = result.masteryByDomain;
      history = result.masteryHistory;
    }
    expect(current.multiplication.recentCorrect).toHaveLength(MAX_RECENT_CORRECT);
    expect(current.multiplication.level).toBe("mastering");
  });

  it("transitions to mastered at 90 percent with ten attempts and majority without help", () => {
    let current = createDefaultMasteryByDomain();
    let history = [];
    for (let index = 0; index < 10; index += 1) {
      const result = recordMasteryAttempt(current, history, attempt({
        correct: index !== 0,
        responseTimeMs: 500 + index * 10,
        occurredAt: `2026-08-23T12:02:${String(index).padStart(2, "0")}.000Z`,
      }));
      current = result.masteryByDomain;
      history = result.masteryHistory;
    }
    expect(current.multiplication.correct).toBe(9);
    expect(current.multiplication.correctWithoutHelp).toBe(9);
    expect(current.multiplication.averageResponseTimeMs).toBeCloseTo(545);
    expect(current.multiplication.level).toBe("mastered");
  });

  it("does not count retry or visible assistance as correct without help", () => {
    const result = recordMasteryAttempt(
      createDefaultMasteryByDomain(),
      [],
      attempt({ assistanceStage: "hint", usedRetry: true }),
    );
    expect(result.masteryByDomain.multiplication.correct).toBe(1);
    expect(result.masteryByDomain.multiplication.correctWithoutHelp).toBe(0);
    expect(result.masteryHistory[0]?.correctWithoutHelp).toBe(false);
  });

  it("keeps independent domains and caps detailed history at 200 entries", () => {
    let current = createDefaultMasteryByDomain();
    let history = [];
    for (let index = 0; index < MAX_MASTERY_HISTORY + 4; index += 1) {
      const domain = (index % 2 === 0 ? "coordinate" : "velocity") as const;
      const result = recordMasteryAttempt(current, history, attempt({
        domain,
        correct: index % 3 !== 0,
        occurredAt: `2026-08-23T12:03:${String(index % 60).padStart(2, "0")}.000Z`,
      }));
      current = result.masteryByDomain;
      history = result.masteryHistory;
    }
    expect(history).toHaveLength(MAX_MASTERY_HISTORY);
    expect(current.coordinate.attempts).toBe(102);
    expect(current.velocity.attempts).toBe(102);
    expect(current.multiplication.attempts).toBe(0);
  });

  it("normalizes corrupt mastery fields and derives levels from safe values", () => {
    const mastery = normalizeMasteryByDomain({
      multiplication: {
        attempts: 10,
        correct: 99,
        correctWithoutHelp: 8,
        averageResponseTimeMs: -1,
        recentCorrect: [true, "bad", false, true],
        level: "mastered",
        updatedAt: "2026-08-23T12:00:00.000Z",
      },
      coordinate: null,
    });
    const history = normalizeMasteryHistory([
      { domain: "multiplication", correct: true, correctWithoutHelp: true, responseTimeMs: 100, occurredAt: "ok" },
      { domain: "unknown", correct: true, correctWithoutHelp: true },
      null,
    ]);

    expect(mastery.multiplication.correct).toBe(10);
    expect(mastery.multiplication.correctWithoutHelp).toBe(8);
    expect(mastery.multiplication.averageResponseTimeMs).toBeNull();
    expect(mastery.multiplication.recentCorrect).toEqual([true, false, true]);
    expect(mastery.multiplication.level).toBe("practicing");
    expect(mastery.coordinate).toEqual(emptyMasteryState());
    expect(history).toHaveLength(1);
  });

  it("uses the documented transition rule for direct state evaluation", () => {
    expect(getMasteryLevel({ attempts: 4, correctWithoutHelp: 4, recentCorrect: [true, true, true, true] })).toBe("discovering");
    expect(getMasteryLevel({ attempts: 5, correctWithoutHelp: 2, recentCorrect: [true, false, true, false, false] })).toBe("practicing");
    expect(getMasteryLevel({ attempts: 5, correctWithoutHelp: 4, recentCorrect: [true, true, true, true, false] })).toBe("mastering");
  });
});

