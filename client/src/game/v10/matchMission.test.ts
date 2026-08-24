import { describe, expect, it } from "vitest";
import {
  MATCH_SHOT_LIMIT,
  V10_MATCH_MISSION_KEY,
  createMatchMission,
  getMatchMissionSummary,
  loadMatchMission,
  normalizeMatchMission,
  recordMatchShot,
  saveMatchMission,
  startMatchRematch,
  type MatchMissionStorage,
} from "./matchMission";

describe("V10 match missions", () => {
  it("starts a five-shot match without inventing results", () => {
    const mission = createMatchMission();
    expect(mission).toEqual({ version: 1, matchNumber: 1, shots: [] });
    expect(getMatchMissionSummary(mission)).toMatchObject({ completed: false, currentShot: 1, goals: 0, stars: 0 });
  });

  it("records football and mathematics independently", () => {
    let mission = createMatchMission();
    mission = recordMatchShot(mission, { scored: false, firstTry: true });
    mission = recordMatchShot(mission, { scored: true, firstTry: false });
    expect(getMatchMissionSummary(mission)).toMatchObject({ currentShot: 3, goals: 1, firstTryCorrect: 1 });
  });

  it("always awards completion and treats other stars as optional bonuses", () => {
    let mission = createMatchMission();
    for (let shot = 0; shot < MATCH_SHOT_LIMIT; shot += 1) {
      mission = recordMatchShot(mission, { scored: shot < 2, firstTry: shot < 3 });
    }
    expect(getMatchMissionSummary(mission)).toMatchObject({ completed: true, stars: 3, goalBonusReached: true, mathBonusReached: true });
  });

  it("does not append results after the match is complete", () => {
    let mission = createMatchMission();
    for (let shot = 0; shot < MATCH_SHOT_LIMIT + 2; shot += 1) {
      mission = recordMatchShot(mission, { scored: true, firstTry: true });
    }
    expect(mission.shots).toHaveLength(MATCH_SHOT_LIMIT);
  });

  it("starts a clean rematch without erasing the match sequence", () => {
    const rematch = startMatchRematch({ version: 1, matchNumber: 4, shots: [{ scored: true, firstTry: true }] });
    expect(rematch).toEqual({ version: 1, matchNumber: 5, shots: [] });
  });

  it("normalizes malformed or oversized stored sessions", () => {
    const normalized = normalizeMatchMission({
      matchNumber: -4,
      shots: [
        { scored: true, firstTry: false },
        { scored: "yes", firstTry: true },
        ...Array.from({ length: 8 }, () => ({ scored: false, firstTry: false })),
      ],
    });
    expect(normalized.matchNumber).toBe(1);
    expect(normalized.shots).toHaveLength(MATCH_SHOT_LIMIT);
  });

  it("loads and saves a local session", () => {
    const values = new Map<string, string>();
    const storage: MatchMissionStorage = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => { values.set(key, value); },
    };
    const mission = recordMatchShot(createMatchMission(2), { scored: true, firstTry: true });
    expect(saveMatchMission(storage, mission)).toBe(true);
    expect(values.has(V10_MATCH_MISSION_KEY)).toBe(true);
    expect(loadMatchMission(storage)).toEqual(mission);
  });

  it("fails safely when browser storage is unavailable or corrupt", () => {
    const broken: MatchMissionStorage = {
      getItem: () => { throw new Error("blocked"); },
      setItem: () => { throw new Error("blocked"); },
    };
    expect(loadMatchMission(null)).toEqual(createMatchMission());
    expect(loadMatchMission({ getItem: () => "{", setItem: () => undefined })).toEqual(createMatchMission());
    expect(saveMatchMission(null, createMatchMission())).toBe(false);
    expect(saveMatchMission(broken, createMatchMission())).toBe(false);
  });
});
