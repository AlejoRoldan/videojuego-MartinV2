import { describe, expect, it } from "vitest";
import {
  V10_SOUND_PREFERENCE_KEY,
  getStadiumFeedback,
  loadSoundPreference,
  saveSoundPreference,
  type PreferenceStorage,
} from "./stadiumAtmosphere";

describe("V10 stadium atmosphere", () => {
  it("celebrates a goal without changing its result", () => {
    expect(getStadiumFeedback("goal")).toEqual({
      audioCue: "goal",
      celebration: "goal",
      announcer: "¡Gran definición! El estadio celebra tu remate.",
    });
  });

  it("gives the keeper a supportive reaction after a save", () => {
    expect(getStadiumFeedback("saved")).toMatchObject({ audioCue: "save", celebration: "save" });
    expect(getStadiumFeedback("saved").announcer).toContain("rincón contrario");
  });

  it.each(["blocked", "post", "crossbar", "miss", "short"] as const)("maps %s to restrained feedback", (outcome) => {
    const feedback = getStadiumFeedback(outcome);
    expect(feedback.announcer.length).toBeGreaterThan(20);
    expect(feedback.celebration).toBe("none");
  });

  it("prioritizes the match fanfare over an individual outcome", () => {
    expect(getStadiumFeedback("saved", { matchCompleted: true })).toMatchObject({
      audioCue: "missionComplete",
      celebration: "match",
    });
  });

  it("announces an advanced-table unlock between ordinary shots", () => {
    expect(getStadiumFeedback("miss", { advancedUnlocked: true })).toMatchObject({
      audioCue: "unlock",
      celebration: "unlock",
    });
  });

  it("keeps sound enabled by default and persists an explicit choice", () => {
    const values = new Map<string, string>();
    const storage: PreferenceStorage = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => { values.set(key, value); },
    };
    expect(loadSoundPreference(storage)).toBe(true);
    expect(saveSoundPreference(storage, false)).toBe(true);
    expect(values.get(V10_SOUND_PREFERENCE_KEY)).toBe("false");
    expect(loadSoundPreference(storage)).toBe(false);
  });

  it("falls back safely when preference storage is unavailable", () => {
    const broken: PreferenceStorage = {
      getItem: () => { throw new Error("blocked"); },
      setItem: () => { throw new Error("blocked"); },
    };
    expect(loadSoundPreference(null)).toBe(true);
    expect(loadSoundPreference(broken)).toBe(true);
    expect(saveSoundPreference(null, false)).toBe(false);
    expect(saveSoundPreference(broken, false)).toBe(false);
  });
});
