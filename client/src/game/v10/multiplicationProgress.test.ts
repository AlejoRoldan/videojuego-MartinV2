import "../test/coverageSetup";
import { describe, expect, it } from "vitest";
import {
  ADVANCED_UNLOCK_FALLBACK_ROUNDS,
  ADVANCED_UNLOCK_MIN_ROUNDS,
  V10_MULTIPLICATION_PROGRESS_LEGACY_KEY,
  V10_MULTIPLICATION_PROGRESS_KEY,
  createDefaultMultiplicationProgress,
  getAdvancedUnlockProgress,
  getTrackMastery,
  loadMultiplicationProgress,
  normalizeMultiplicationProgress,
  recordCompletedMultiplicationRound,
  saveMultiplicationProgress,
  shouldUnlockAdvanced,
  type MultiplicationProgressV2,
  type StorageLike,
} from "./multiplicationProgress";

function recordStarter(progress: MultiplicationProgressV2, firstTry: boolean, index: number) {
  return recordCompletedMultiplicationRound(progress, {
    track: "tables-2-5",
    firstTry,
    scored: index % 2 === 0,
    completedAt: `2026-08-24T00:00:0${index}.000Z`,
    factors: { a: 2 + (index % 4), b: 3 },
  });
}

describe("V10 multiplication progress", () => {
  it("starts safely in tables 2–5 with advanced tables locked", () => {
    const progress = createDefaultMultiplicationProgress();
    expect(progress.activeTrack).toBe("tables-2-5");
    expect(progress.advancedUnlocked).toBe(false);
    expect(progress.version).toBe(2);
    expect(progress.tracks["tables-2-5"].mastery).toBe("discovering");
    expect(progress.tracks["tables-2-5"].facts).toEqual({});
  });

  it("records first-try, assisted and football outcomes independently", () => {
    const first = recordStarter(createDefaultMultiplicationProgress(), true, 0).progress;
    const second = recordStarter(first, false, 1).progress;
    expect(second.tracks["tables-2-5"]).toMatchObject({
      roundsCompleted: 2,
      firstTryCorrect: 1,
      assistedCorrect: 1,
      goals: 1,
      recentFirstTry: [true, false],
    });
    expect(second.tracks["tables-2-5"].facts["2x3"]).toMatchObject({ attempts: 1, firstTryCorrect: 1 });
    expect(second.tracks["tables-2-5"].facts["3x3"]).toMatchObject({ attempts: 1, assistedCorrect: 1 });
  });

  it("unlocks tables 6–9 after five rounds with at least 60% first-try accuracy", () => {
    let progress = createDefaultMultiplicationProgress();
    const outcomes = [true, true, false, true, false];
    let lastUnlock = false;
    outcomes.forEach((firstTry, index) => {
      const recorded = recordStarter(progress, firstTry, index);
      progress = recorded.progress;
      lastUnlock = recorded.justUnlockedAdvanced;
    });
    expect(progress.tracks["tables-2-5"].roundsCompleted).toBe(ADVANCED_UNLOCK_MIN_ROUNDS);
    expect(progress.advancedUnlocked).toBe(true);
    expect(lastUnlock).toBe(true);
    expect(getAdvancedUnlockProgress(progress.tracks["tables-2-5"])).toBe(100);
  });

  it("also unlocks after enough persistence when first attempts are difficult", () => {
    let progress = createDefaultMultiplicationProgress();
    for (let index = 0; index < ADVANCED_UNLOCK_FALLBACK_ROUNDS; index += 1) {
      progress = recordStarter(progress, false, index).progress;
    }
    expect(progress.advancedUnlocked).toBe(true);
    expect(shouldUnlockAdvanced(progress.tracks["tables-2-5"])).toBe(true);
  });

  it("distinguishes discovering, practicing, mastering and mastered", () => {
    expect(getTrackMastery({ roundsCompleted: 0, recentFirstTry: [] })).toBe("discovering");
    expect(getTrackMastery({ roundsCompleted: 3, recentFirstTry: [true, false, false] })).toBe("practicing");
    expect(getTrackMastery({ roundsCompleted: 5, recentFirstTry: [true, true, true, false, false] })).toBe("mastering");
    expect(getTrackMastery({ roundsCompleted: 10, recentFirstTry: [true, true, true, true, false] })).toBe("mastered");
  });

  it("normalizes malformed or exaggerated persisted fields", () => {
    const normalized = normalizeMultiplicationProgress({
      activeTrack: "tables-6-9",
      advancedUnlocked: false,
      tracks: { "tables-2-5": { roundsCompleted: 2, firstTryCorrect: 99, assistedCorrect: 99, goals: 99, recentFirstTry: [true, "bad"] } },
    });
    expect(normalized.activeTrack).toBe("tables-2-5");
    expect(normalized.tracks["tables-2-5"]).toMatchObject({ roundsCompleted: 2, firstTryCorrect: 2, assistedCorrect: 0, goals: 2, recentFirstTry: [true] });
  });

  it("saves and loads the normalized V2 profile", () => {
    const values = new Map<string, string>();
    const storage: StorageLike = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => { values.set(key, value); },
    };
    const progress = recordStarter(createDefaultMultiplicationProgress(), true, 0).progress;
    expect(saveMultiplicationProgress(storage, progress)).toBe(true);
    expect(values.has(V10_MULTIPLICATION_PROGRESS_KEY)).toBe(true);
    expect(loadMultiplicationProgress(storage)).toEqual(progress);
  });

  it("migrates a V1 profile without losing aggregate mastery", () => {
    const values = new Map<string, string>();
    values.set(V10_MULTIPLICATION_PROGRESS_LEGACY_KEY, JSON.stringify({
      version: 1,
      activeTrack: "tables-2-5",
      tracks: {
        "tables-2-5": { roundsCompleted: 4, firstTryCorrect: 3, assistedCorrect: 1, goals: 2, recentFirstTry: [true, true, true, false] },
      },
    }));
    const storage: StorageLike = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => { values.set(key, value); },
    };
    const migrated = loadMultiplicationProgress(storage);
    expect(migrated.version).toBe(2);
    expect(migrated.tracks["tables-2-5"]).toMatchObject({ roundsCompleted: 4, firstTryCorrect: 3, assistedCorrect: 1 });
    expect(migrated.tracks["tables-2-5"].facts).toEqual({});
  });

  it("recovers a valid V1 profile when the newer payload is malformed", () => {
    const values = new Map<string, string>([
      [V10_MULTIPLICATION_PROGRESS_KEY, "{"],
      [V10_MULTIPLICATION_PROGRESS_LEGACY_KEY, JSON.stringify({ version: 1, tracks: { "tables-2-5": { roundsCompleted: 2, firstTryCorrect: 1 } } })],
    ]);
    const storage: StorageLike = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => { values.set(key, value); },
    };
    expect(loadMultiplicationProgress(storage).tracks["tables-2-5"]).toMatchObject({ roundsCompleted: 2, firstTryCorrect: 1 });
  });

  it("falls back safely when storage is absent, malformed or unavailable", () => {
    const broken: StorageLike = {
      getItem: () => { throw new Error("blocked"); },
      setItem: () => { throw new Error("blocked"); },
    };
    const malformed: StorageLike = { getItem: () => "{", setItem: () => undefined };
    expect(loadMultiplicationProgress(null)).toEqual(createDefaultMultiplicationProgress());
    expect(loadMultiplicationProgress(broken)).toEqual(createDefaultMultiplicationProgress());
    expect(loadMultiplicationProgress(malformed)).toEqual(createDefaultMultiplicationProgress());
    expect(saveMultiplicationProgress(null, createDefaultMultiplicationProgress())).toBe(false);
    expect(saveMultiplicationProgress(broken, createDefaultMultiplicationProgress())).toBe(false);
  });

  it("reports partial unlock progress before either unlock rule is complete", () => {
    const track = { roundsCompleted: 2, recentFirstTry: [true, false] };
    expect(getAdvancedUnlockProgress(track)).toBeGreaterThan(0);
    expect(getAdvancedUnlockProgress(track)).toBeLessThan(100);
  });

  it("rejects malformed and out-of-range fact histories", () => {
    const normalized = normalizeMultiplicationProgress({
      tracks: {
        "tables-2-5": {
          roundsCompleted: 3,
          facts: {
            "2x5": { attempts: 2, firstTryCorrect: 99, assistedCorrect: 99, recentFirstTry: [true, "bad", false], lastPlayedRound: -3 },
            "9x9": { attempts: 9 },
            bad: { attempts: 9 },
          },
          lastFactKey: "9x9",
        },
      },
    });
    expect(normalized.tracks["tables-2-5"].facts).toEqual({
      "2x5": { attempts: 2, firstTryCorrect: 2, assistedCorrect: 0, recentFirstTry: [true, false], lastPlayedRound: 0 },
    });
    expect(normalized.tracks["tables-2-5"].lastFactKey).toBe("");
  });
});
