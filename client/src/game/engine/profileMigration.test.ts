import "../test/coverageSetup";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_PROFILE,
  PROFILE_SCHEMA_VERSION,
  PROFILE_STORAGE_KEY,
  V9_STORAGE_KEYS,
  loadProfile,
  migrateProfile,
  resetStoredProgress,
  saveProfile,
} from "./profileMigration";

function createStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
}

afterEach(() => vi.restoreAllMocks());

describe("profile migration and persistence", () => {
  it("migrates a legacy V1 profile without losing progress or unlocks", () => {
    const legacy = {
      schemaVersion: 1,
      name: " Martín ",
      level: 4,
      xp: 385,
      xpToNext: 400,
      coins: 90,
      stars: 7,
      totalGoals: 18,
      totalShots: 24,
      accuracy: 10,
      currentStreak: 3,
      bestStreak: 8,
      unlockedLevels: [1, 2, 999, "3"],
      completedLevels: {
        2: { stars: 3, bestScore: 920, attempts: 4, mathAccuracy: 87 },
        999: { stars: 3, bestScore: 9999 },
      },
      achievements: ["first_goal", 7, "perfect"],
      equippedBall: "fire",
    };

    const migrated = migrateProfile(legacy);

    expect(migrated.schemaVersion).toBe(PROFILE_SCHEMA_VERSION);
    expect(migrated.name).toBe("Martín");
    expect(migrated.totalGoals).toBe(18);
    expect(migrated.totalShots).toBe(24);
    expect(migrated.accuracy).toBe(75);
    expect(migrated.completedLevels).toEqual({
      2: { stars: 3, bestScore: 920, attempts: 4, mathAccuracy: 87 },
    });
    expect(migrated.unlockedLevels).toEqual([1, 2, 3]);
    expect(migrated.achievements).toEqual(["first_goal", "perfect"]);
    expect(migrated.equippedBall).toBe("fire");
    expect(migrated.equippedKit).toBe(DEFAULT_PROFILE.equippedKit);
  });

  it("is idempotent and preserves the maximum completed level on repeated migration", () => {
    const legacy = {
      schemaVersion: 1,
      totalShots: 100,
      totalGoals: 120,
      unlockedLevels: [1, 2],
      completedLevels: { 3: { stars: 2, bestScore: 1_500 } },
    };

    const once = migrateProfile(legacy);
    const twice = migrateProfile(once);

    expect(twice).toEqual(once);
    expect(twice.totalGoals).toBe(100);
    expect(twice.unlockedLevels).toContain(4);
    expect(twice.completedLevels[3]).toEqual({ stars: 2, bestScore: 1_500, attempts: 0, mathAccuracy: 0 });
  });

  it("returns safe values for null, partial and malformed profile data", () => {
    const malformed = migrateProfile({
      name: 42,
      level: -4,
      xp: Number.NaN,
      totalShots: -10,
      totalGoals: 9,
      unlockedLevels: "not-an-array",
      completedLevels: [],
      achievements: { bad: true },
    });

    expect(migrateProfile(null)).toEqual(DEFAULT_PROFILE);
    expect(malformed.schemaVersion).toBe(PROFILE_SCHEMA_VERSION);
    expect(malformed.name).toBe(DEFAULT_PROFILE.name);
    expect(malformed.level).toBe(1);
    expect(malformed.totalShots).toBe(0);
    expect(malformed.totalGoals).toBe(0);
    expect(malformed.unlockedLevels).toEqual([1]);
    expect(malformed.completedLevels).toEqual({});
    expect(malformed.achievements).toEqual([]);
    expect(Number.isFinite(malformed.xp)).toBe(true);
  });

  it("loads, normalizes and saves profiles through a storage adapter", () => {
    const storage = createStorage({
      [PROFILE_STORAGE_KEY]: JSON.stringify({ schemaVersion: 1, name: "M", totalShots: 2, totalGoals: 1 }),
    });

    const loaded = loadProfile(storage);
    saveProfile({ ...loaded, coins: 42 }, storage);
    const saved = JSON.parse(storage.values.get(PROFILE_STORAGE_KEY) ?? "{}");

    expect(loaded.accuracy).toBe(50);
    expect(saved.schemaVersion).toBe(PROFILE_SCHEMA_VERSION);
    expect(saved.coins).toBe(42);
  });

  it("falls back to an in-memory safe profile when storage read or write fails", () => {
    const brokenRead = {
      getItem: () => { throw new Error("read failed"); },
    };
    const brokenWrite = {
      setItem: () => { throw new Error("write failed"); },
    };

    expect(loadProfile(brokenRead)).toEqual(DEFAULT_PROFILE);
    expect(() => saveProfile(DEFAULT_PROFILE, brokenWrite)).not.toThrow();
  });

  it("clears every V9 storage key while preserving unrelated preferences", () => {
    const storage = createStorage({
      tlm_profile: "profile",
      tlm_game_pace: "match",
      theme: "dark",
    });

    resetStoredProgress(storage);

    expect(V9_STORAGE_KEYS).toEqual(["tlm_profile", "tlm_game_pace"]);
    expect(storage.values.has("tlm_profile")).toBe(false);
    expect(storage.values.has("tlm_game_pace")).toBe(false);
    expect(storage.values.get("theme")).toBe("dark");
  });

  it("attempts every key even when one storage deletion fails", () => {
    const removed: string[] = [];
    const storage = {
      removeItem: (key: string) => {
        removed.push(key);
        if (key === "tlm_profile") throw new Error("quota");
      },
    };

    expect(() => resetStoredProgress(storage)).not.toThrow();
    expect(removed).toEqual([...V9_STORAGE_KEYS]);
  });
});
