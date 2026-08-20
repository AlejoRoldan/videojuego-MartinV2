import { LEVELS } from "../levels/levelData";

export const PROFILE_SCHEMA_VERSION = 2;

export interface ProfileLevelProgress {
  stars: number;
  bestScore: number;
  attempts?: number;
  mathAccuracy?: number;
}

export interface PlayerProfile {
  schemaVersion: number;
  name: string;
  level: number;
  xp: number;
  xpToNext: number;
  coins: number;
  stars: number;
  totalGoals: number;
  totalShots: number;
  accuracy: number;
  currentStreak: number;
  bestStreak: number;
  missionProgress: number;
  missionCompletions: number;
  unlockedLevels: number[];
  completedLevels: Record<number, ProfileLevelProgress>;
  achievements: string[];
  equippedBall?: string;
  equippedKit?: string;
}

export const DEFAULT_PROFILE: PlayerProfile = {
  schemaVersion: PROFILE_SCHEMA_VERSION,
  name: "Martín",
  level: 1,
  xp: 0,
  xpToNext: 100,
  coins: 0,
  stars: 0,
  totalGoals: 0,
  totalShots: 0,
  accuracy: 0,
  currentStreak: 0,
  bestStreak: 0,
  missionProgress: 0,
  missionCompletions: 0,
  unlockedLevels: [1],
  completedLevels: {},
  achievements: [],
  equippedBall: "default",
  equippedKit: "default",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function numberOr(value: unknown, fallback: number, minimum = 0): number {
  return typeof value === "number" && Number.isFinite(value) && value >= minimum ? value : fallback;
}

function integerOr(value: unknown, fallback: number, minimum = 0, maximum = Number.MAX_SAFE_INTEGER): number {
  const normalized = numberOr(value, fallback, minimum);
  return Math.min(maximum, Math.max(minimum, Math.round(normalized)));
}

function normalizeLevelProgress(raw: unknown): Record<number, ProfileLevelProgress> {
  if (!isRecord(raw)) return {};
  const progress: Record<number, ProfileLevelProgress> = {};
  for (const [key, value] of Object.entries(raw)) {
    const levelId = Number(key);
    if (!Number.isInteger(levelId) || !LEVELS.some((level) => level.id === levelId) || !isRecord(value)) continue;
    progress[levelId] = {
      stars: integerOr(value.stars, 0, 0, 3),
      bestScore: numberOr(value.bestScore, 0),
      attempts: integerOr(value.attempts, 0),
      mathAccuracy: Math.min(100, numberOr(value.mathAccuracy, 0)),
    };
  }
  return progress;
}

function normalizeUnlockedLevels(raw: unknown, completedLevels: Record<number, ProfileLevelProgress>): number[] {
  const fromStorage = Array.isArray(raw)
    ? raw.filter((value): value is number => Number.isInteger(value) && LEVELS.some((level) => level.id === value))
    : [];
  const unlocked = new Set<number>([1, ...fromStorage]);
  for (const levelId of Object.keys(completedLevels).map(Number)) {
    unlocked.add(levelId);
    const nextLevel = levelId + 1;
    if (LEVELS.some((level) => level.id === nextLevel)) unlocked.add(nextLevel);
  }
  return Array.from(unlocked).sort((a, b) => a - b);
}

export function migrateProfile(raw: unknown): PlayerProfile {
  if (!isRecord(raw)) {
    if (raw !== undefined) console.warn("[tlm] Perfil inválido; se usará un perfil seguro.");
    return { ...DEFAULT_PROFILE };
  }

  const hasMalformedFields =
    (raw.name !== undefined && typeof raw.name !== "string")
    || (raw.unlockedLevels !== undefined && !Array.isArray(raw.unlockedLevels))
    || (raw.completedLevels !== undefined && !isRecord(raw.completedLevels));
  if (hasMalformedFields) console.warn("[tlm] Se corrigieron campos inválidos del perfil legacy.");

  const completedLevels = normalizeLevelProgress(raw.completedLevels);
  const totalShots = integerOr(raw.totalShots, 0);
  const totalGoals = Math.min(totalShots, integerOr(raw.totalGoals, 0));
  const xp = numberOr(raw.xp, 0);
  const level = integerOr(raw.level, 1, 1);

  return {
    schemaVersion: PROFILE_SCHEMA_VERSION,
    name: typeof raw.name === "string" && raw.name.trim() ? raw.name.trim().slice(0, 24) : DEFAULT_PROFILE.name,
    level,
    xp,
    xpToNext: numberOr(raw.xpToNext, 100 * level, 1),
    coins: numberOr(raw.coins, 0),
    stars: numberOr(raw.stars, 0),
    totalGoals,
    totalShots,
    accuracy: totalShots > 0 ? Math.round((totalGoals / totalShots) * 100) : numberOr(raw.accuracy, 0),
    currentStreak: integerOr(raw.currentStreak, 0),
    bestStreak: integerOr(raw.bestStreak, 0),
    missionProgress: integerOr(raw.missionProgress, 0, 0, 2),
    missionCompletions: integerOr(raw.missionCompletions, 0),
    unlockedLevels: normalizeUnlockedLevels(raw.unlockedLevels, completedLevels),
    completedLevels,
    achievements: Array.isArray(raw.achievements)
      ? raw.achievements.filter((value): value is string => typeof value === "string")
      : [],
    equippedBall: typeof raw.equippedBall === "string" ? raw.equippedBall : DEFAULT_PROFILE.equippedBall,
    equippedKit: typeof raw.equippedKit === "string" ? raw.equippedKit : DEFAULT_PROFILE.equippedKit,
  };
}

export function loadProfile(storage: Pick<Storage, "getItem"> | null = typeof localStorage === "undefined" ? null : localStorage): PlayerProfile {
  if (!storage) return { ...DEFAULT_PROFILE };
  const saved = storage.getItem("tlm_profile");
  if (!saved) return { ...DEFAULT_PROFILE };
  try {
    return migrateProfile(JSON.parse(saved));
  } catch {
    console.warn("[tlm] No se pudo leer el perfil; se usará un perfil seguro.");
    return { ...DEFAULT_PROFILE };
  }
}

export function saveProfile(profile: PlayerProfile, storage: Pick<Storage, "setItem"> | null = typeof localStorage === "undefined" ? null : localStorage): void {
  if (!storage) return;
  try {
    storage.setItem("tlm_profile", JSON.stringify(migrateProfile(profile)));
  } catch {
    console.warn("[tlm] No se pudo guardar el perfil local.");
  }
}
