import { MULTIPLICATION_TRACKS, type MultiplicationTrack } from "./multiplicationRound";

export const V10_MULTIPLICATION_PROGRESS_KEY = "tlm_v10_multiplication_progress_v2";
export const V10_MULTIPLICATION_PROGRESS_LEGACY_KEY = "tlm_v10_multiplication_progress_v1";
export const RECENT_MASTERY_WINDOW = 10;
export const RECENT_FACT_WINDOW = 5;
export const ADVANCED_UNLOCK_MIN_ROUNDS = 5;
export const ADVANCED_UNLOCK_ACCURACY = 0.6;
export const ADVANCED_UNLOCK_FALLBACK_ROUNDS = 8;

export type TrackMasteryLevel = "discovering" | "practicing" | "mastering" | "mastered";

export interface MultiplicationFactProgress {
  attempts: number;
  firstTryCorrect: number;
  assistedCorrect: number;
  recentFirstTry: boolean[];
  lastPlayedRound: number;
}

export interface MultiplicationTrackProgress {
  roundsCompleted: number;
  firstTryCorrect: number;
  assistedCorrect: number;
  goals: number;
  recentFirstTry: boolean[];
  mastery: TrackMasteryLevel;
  lastPlayedAt: string;
  facts: Record<string, MultiplicationFactProgress>;
  lastFactKey: string;
}

export interface MultiplicationProgressV2 {
  version: 2;
  activeTrack: MultiplicationTrack;
  advancedUnlocked: boolean;
  tracks: Record<MultiplicationTrack, MultiplicationTrackProgress>;
  updatedAt: string;
}

export interface CompletedMultiplicationRound {
  track: MultiplicationTrack;
  firstTry: boolean;
  scored: boolean;
  completedAt: string;
  factors?: { a: number; b: number };
}

export interface RecordedMultiplicationProgress {
  progress: MultiplicationProgressV2;
  justUnlockedAdvanced: boolean;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function emptyTrackProgress(): MultiplicationTrackProgress {
  return {
    roundsCompleted: 0,
    firstTryCorrect: 0,
    assistedCorrect: 0,
    goals: 0,
    recentFirstTry: [],
    mastery: "discovering",
    lastPlayedAt: "",
    facts: {},
    lastFactKey: "",
  };
}

export function createDefaultMultiplicationProgress(): MultiplicationProgressV2 {
  return {
    version: 2,
    activeTrack: "tables-2-5",
    advancedUnlocked: false,
    tracks: {
      "tables-2-5": emptyTrackProgress(),
      "tables-6-9": emptyTrackProgress(),
    },
    updatedAt: "",
  };
}

function safeInteger(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.trunc(value) : 0;
}

function recentAccuracy(track: Pick<MultiplicationTrackProgress, "recentFirstTry">): number {
  return track.recentFirstTry.length === 0
    ? 0
    : track.recentFirstTry.filter(Boolean).length / track.recentFirstTry.length;
}

export function getTrackMastery(track: Pick<MultiplicationTrackProgress, "roundsCompleted" | "recentFirstTry">): TrackMasteryLevel {
  const accuracy = recentAccuracy(track);
  if (track.roundsCompleted < 3) return "discovering";
  if (track.roundsCompleted >= 10 && track.recentFirstTry.length >= 5 && accuracy >= 0.8) return "mastered";
  if (track.roundsCompleted >= ADVANCED_UNLOCK_MIN_ROUNDS && track.recentFirstTry.length >= 5 && accuracy >= ADVANCED_UNLOCK_ACCURACY) return "mastering";
  return "practicing";
}

export function shouldUnlockAdvanced(track: Pick<MultiplicationTrackProgress, "roundsCompleted" | "recentFirstTry">): boolean {
  const performanceUnlock = track.roundsCompleted >= ADVANCED_UNLOCK_MIN_ROUNDS
    && track.recentFirstTry.length >= ADVANCED_UNLOCK_MIN_ROUNDS
    && recentAccuracy(track) >= ADVANCED_UNLOCK_ACCURACY;
  return performanceUnlock || track.roundsCompleted >= ADVANCED_UNLOCK_FALLBACK_ROUNDS;
}

export function getMultiplicationFactKey(a: number, b: number): string {
  return `${Math.trunc(a)}x${Math.trunc(b)}`;
}

function isFactInTrack(key: string, track: MultiplicationTrack): boolean {
  const match = /^(\d+)x(\d+)$/.exec(key);
  if (!match) return false;
  const { minimum, maximum } = MULTIPLICATION_TRACKS[track];
  const a = Number(match[1]);
  const b = Number(match[2]);
  return a >= minimum && a <= maximum && b >= minimum && b <= maximum;
}

function normalizeFact(raw: unknown): MultiplicationFactProgress {
  const candidate = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  const attempts = safeInteger(candidate.attempts);
  const firstTryCorrect = Math.min(attempts, safeInteger(candidate.firstTryCorrect));
  const assistedCorrect = Math.min(attempts - firstTryCorrect, safeInteger(candidate.assistedCorrect));
  const recentFirstTry = Array.isArray(candidate.recentFirstTry)
    ? candidate.recentFirstTry.filter((value): value is boolean => typeof value === "boolean").slice(-RECENT_FACT_WINDOW)
    : [];
  return {
    attempts,
    firstTryCorrect,
    assistedCorrect,
    recentFirstTry,
    lastPlayedRound: safeInteger(candidate.lastPlayedRound),
  };
}

function normalizeTrack(raw: unknown, trackId: MultiplicationTrack): MultiplicationTrackProgress {
  const candidate = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  const roundsCompleted = safeInteger(candidate.roundsCompleted);
  const firstTryCorrect = Math.min(roundsCompleted, safeInteger(candidate.firstTryCorrect));
  const assistedCorrect = Math.min(roundsCompleted - firstTryCorrect, safeInteger(candidate.assistedCorrect));
  const goals = Math.min(roundsCompleted, safeInteger(candidate.goals));
  const recentFirstTry = Array.isArray(candidate.recentFirstTry)
    ? candidate.recentFirstTry.filter((value): value is boolean => typeof value === "boolean").slice(-RECENT_MASTERY_WINDOW)
    : [];
  const rawFacts = candidate.facts && typeof candidate.facts === "object" && !Array.isArray(candidate.facts)
    ? candidate.facts as Record<string, unknown>
    : {};
  const facts = Object.fromEntries(
    Object.entries(rawFacts)
      .filter(([key]) => isFactInTrack(key, trackId))
      .map(([key, value]) => [key, normalizeFact(value)]),
  );
  const requestedLastFact = typeof candidate.lastFactKey === "string" ? candidate.lastFactKey : "";
  const track: MultiplicationTrackProgress = {
    roundsCompleted,
    firstTryCorrect,
    assistedCorrect,
    goals,
    recentFirstTry,
    mastery: "discovering",
    lastPlayedAt: typeof candidate.lastPlayedAt === "string" ? candidate.lastPlayedAt : "",
    facts,
    lastFactKey: isFactInTrack(requestedLastFact, trackId) ? requestedLastFact : "",
  };
  track.mastery = getTrackMastery(track);
  return track;
}

/** Normalizes both V1 and V2 profiles; missing fact history becomes an empty adaptive history. */
export function normalizeMultiplicationProgress(raw: unknown): MultiplicationProgressV2 {
  const candidate = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  const rawTracks = candidate.tracks && typeof candidate.tracks === "object" && !Array.isArray(candidate.tracks)
    ? candidate.tracks as Record<string, unknown>
    : {};
  const starter = normalizeTrack(rawTracks["tables-2-5"], "tables-2-5");
  const advanced = normalizeTrack(rawTracks["tables-6-9"], "tables-6-9");
  const advancedUnlocked = candidate.advancedUnlocked === true || shouldUnlockAdvanced(starter);
  const requestedTrack = candidate.activeTrack === "tables-6-9" ? "tables-6-9" : "tables-2-5";
  return {
    version: 2,
    activeTrack: requestedTrack === "tables-6-9" && !advancedUnlocked ? "tables-2-5" : requestedTrack,
    advancedUnlocked,
    tracks: { "tables-2-5": starter, "tables-6-9": advanced },
    updatedAt: typeof candidate.updatedAt === "string" ? candidate.updatedAt : "",
  };
}

export function recordCompletedMultiplicationRound(
  current: MultiplicationProgressV2,
  round: CompletedMultiplicationRound,
): RecordedMultiplicationProgress {
  const previous = normalizeMultiplicationProgress(current);
  const previousTrack = previous.tracks[round.track];
  const nextRoundNumber = previousTrack.roundsCompleted + 1;
  let facts = previousTrack.facts;
  let lastFactKey = previousTrack.lastFactKey;
  if (round.factors) {
    const factKey = getMultiplicationFactKey(round.factors.a, round.factors.b);
    if (isFactInTrack(factKey, round.track)) {
      const oldFact = facts[factKey] ?? normalizeFact(null);
      facts = {
        ...facts,
        [factKey]: {
          attempts: oldFact.attempts + 1,
          firstTryCorrect: oldFact.firstTryCorrect + (round.firstTry ? 1 : 0),
          assistedCorrect: oldFact.assistedCorrect + (round.firstTry ? 0 : 1),
          recentFirstTry: [...oldFact.recentFirstTry, round.firstTry].slice(-RECENT_FACT_WINDOW),
          lastPlayedRound: nextRoundNumber,
        },
      };
      lastFactKey = factKey;
    }
  }
  const nextTrack: MultiplicationTrackProgress = {
    roundsCompleted: nextRoundNumber,
    firstTryCorrect: previousTrack.firstTryCorrect + (round.firstTry ? 1 : 0),
    assistedCorrect: previousTrack.assistedCorrect + (round.firstTry ? 0 : 1),
    goals: previousTrack.goals + (round.scored ? 1 : 0),
    recentFirstTry: [...previousTrack.recentFirstTry, round.firstTry].slice(-RECENT_MASTERY_WINDOW),
    mastery: "discovering",
    lastPlayedAt: round.completedAt,
    facts,
    lastFactKey,
  };
  nextTrack.mastery = getTrackMastery(nextTrack);
  const tracks = { ...previous.tracks, [round.track]: nextTrack };
  const advancedUnlocked = previous.advancedUnlocked || shouldUnlockAdvanced(tracks["tables-2-5"]);
  return {
    justUnlockedAdvanced: !previous.advancedUnlocked && advancedUnlocked,
    progress: {
      version: 2,
      activeTrack: round.track,
      advancedUnlocked,
      tracks,
      updatedAt: round.completedAt,
    },
  };
}

export function getAdvancedUnlockProgress(track: Pick<MultiplicationTrackProgress, "roundsCompleted" | "recentFirstTry">): number {
  if (shouldUnlockAdvanced(track)) return 100;
  const fallbackProgress = track.roundsCompleted / ADVANCED_UNLOCK_FALLBACK_ROUNDS;
  const practiceProgress = track.roundsCompleted / ADVANCED_UNLOCK_MIN_ROUNDS;
  const accuracyProgress = track.recentFirstTry.length < ADVANCED_UNLOCK_MIN_ROUNDS
    ? track.recentFirstTry.length / ADVANCED_UNLOCK_MIN_ROUNDS
    : recentAccuracy(track) / ADVANCED_UNLOCK_ACCURACY;
  return Math.round(Math.max(fallbackProgress, Math.min(practiceProgress, accuracyProgress)) * 100);
}

export function loadMultiplicationProgress(storage: StorageLike | null): MultiplicationProgressV2 {
  if (!storage) return createDefaultMultiplicationProgress();
  try {
    const current = storage.getItem(V10_MULTIPLICATION_PROGRESS_KEY);
    if (current) return normalizeMultiplicationProgress(JSON.parse(current));
  } catch { /* try the legacy profile before falling back */ }
  try {
    const legacy = storage.getItem(V10_MULTIPLICATION_PROGRESS_LEGACY_KEY);
    return legacy ? normalizeMultiplicationProgress(JSON.parse(legacy)) : createDefaultMultiplicationProgress();
  } catch { return createDefaultMultiplicationProgress(); }
}

export function saveMultiplicationProgress(storage: StorageLike | null, progress: MultiplicationProgressV2): boolean {
  if (!storage) return false;
  try {
    storage.setItem(V10_MULTIPLICATION_PROGRESS_KEY, JSON.stringify(normalizeMultiplicationProgress(progress)));
    return true;
  } catch {
    return false;
  }
}
