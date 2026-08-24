export const V10_MATCH_MISSION_KEY = "tlm_v10_match_mission_v1";
export const MATCH_SHOT_LIMIT = 5;
export const MATCH_GOAL_BONUS = 2;
export const MATCH_MATH_BONUS = 3;

export interface MatchShotResult {
  scored: boolean;
  firstTry: boolean;
}

export interface MatchMissionV1 {
  version: 1;
  matchNumber: number;
  shots: MatchShotResult[];
}

export interface MatchMissionSummary {
  completed: boolean;
  currentShot: number;
  goals: number;
  firstTryCorrect: number;
  goalBonusReached: boolean;
  mathBonusReached: boolean;
  stars: number;
  message: string;
}

export interface MatchMissionStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function safeMatchNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 1
    ? Math.trunc(value)
    : 1;
}

function normalizeShot(value: unknown): MatchShotResult | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.scored !== "boolean" || typeof candidate.firstTry !== "boolean") return null;
  return { scored: candidate.scored, firstTry: candidate.firstTry };
}

export function createMatchMission(matchNumber = 1): MatchMissionV1 {
  return { version: 1, matchNumber: safeMatchNumber(matchNumber), shots: [] };
}

export function normalizeMatchMission(value: unknown): MatchMissionV1 {
  const candidate = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const shots = Array.isArray(candidate.shots)
    ? candidate.shots.map(normalizeShot).filter((shot): shot is MatchShotResult => shot !== null).slice(0, MATCH_SHOT_LIMIT)
    : [];
  return { version: 1, matchNumber: safeMatchNumber(candidate.matchNumber), shots };
}

export function recordMatchShot(current: MatchMissionV1, result: MatchShotResult): MatchMissionV1 {
  const mission = normalizeMatchMission(current);
  if (mission.shots.length >= MATCH_SHOT_LIMIT) return mission;
  return { ...mission, shots: [...mission.shots, { scored: result.scored, firstTry: result.firstTry }] };
}

export function startMatchRematch(current: MatchMissionV1): MatchMissionV1 {
  const mission = normalizeMatchMission(current);
  return createMatchMission(mission.matchNumber + 1);
}

export function getMatchMissionSummary(current: MatchMissionV1): MatchMissionSummary {
  const mission = normalizeMatchMission(current);
  const goals = mission.shots.filter((shot) => shot.scored).length;
  const firstTryCorrect = mission.shots.filter((shot) => shot.firstTry).length;
  const completed = mission.shots.length === MATCH_SHOT_LIMIT;
  const goalBonusReached = goals >= MATCH_GOAL_BONUS;
  const mathBonusReached = firstTryCorrect >= MATCH_MATH_BONUS;
  const stars = completed ? 1 + Number(goalBonusReached) + Number(mathBonusReached) : 0;
  const message = !completed
    ? "Completa los cinco remates: cada intento hace avanzar el partido."
    : stars === 3
      ? "¡Partido brillante! Combinaste precisión matemática y definición."
      : stars === 2
        ? "¡Buen partido! Ya tienes una bonificación; la revancha te espera."
        : "¡Partido completado! La práctica cuenta incluso cuando el balón no entra.";
  return {
    completed,
    currentShot: completed ? MATCH_SHOT_LIMIT : mission.shots.length + 1,
    goals,
    firstTryCorrect,
    goalBonusReached,
    mathBonusReached,
    stars,
    message,
  };
}

export function loadMatchMission(storage: MatchMissionStorage | null): MatchMissionV1 {
  if (!storage) return createMatchMission();
  try {
    const raw = storage.getItem(V10_MATCH_MISSION_KEY);
    return raw ? normalizeMatchMission(JSON.parse(raw)) : createMatchMission();
  } catch {
    return createMatchMission();
  }
}

export function saveMatchMission(storage: MatchMissionStorage | null, mission: MatchMissionV1): boolean {
  if (!storage) return false;
  try {
    storage.setItem(V10_MATCH_MISSION_KEY, JSON.stringify(normalizeMatchMission(mission)));
    return true;
  } catch {
    return false;
  }
}
