import type { MathDomain } from "./types";

export const MASTERY_DOMAINS: readonly MathDomain[] = [
  "multiplication",
  "coordinate",
  "angle",
  "velocity",
];

export const MAX_MASTERY_HISTORY = 200;
export const MAX_RECENT_CORRECT = 10;

export type MasteryLevel = "discovering" | "practicing" | "mastering" | "mastered";

export interface MasteryState {
  attempts: number;
  correct: number;
  correctWithoutHelp: number;
  averageResponseTimeMs: number | null;
  recentCorrect: boolean[];
  level: MasteryLevel;
  updatedAt: string;
}

export interface MasteryHistoryEntry {
  domain: MathDomain;
  correct: boolean;
  correctWithoutHelp: boolean;
  responseTimeMs: number | null;
  occurredAt: string;
}

export type MasteryByDomain = Record<MathDomain, MasteryState>;

export interface MasteryAttempt {
  domain: MathDomain;
  correct: boolean;
  responseTimeMs: number | null;
  assistanceStage: "none" | "hint" | "visual" | "urgent";
  usedRetry: boolean;
  occurredAt: string;
}

export function emptyMasteryState(): MasteryState {
  return {
    attempts: 0,
    correct: 0,
    correctWithoutHelp: 0,
    averageResponseTimeMs: null,
    recentCorrect: [],
    level: "discovering",
    updatedAt: "",
  };
}

export function createDefaultMasteryByDomain(): MasteryByDomain {
  return MASTERY_DOMAINS.reduce((result, domain) => {
    result[domain] = emptyMasteryState();
    return result;
  }, {} as MasteryByDomain);
}

function isMathDomain(value: unknown): value is MathDomain {
  return typeof value === "string" && MASTERY_DOMAINS.includes(value as MathDomain);
}

function clampInteger(value: unknown, fallback: number, minimum = 0): number {
  return typeof value === "number" && Number.isFinite(value) && value >= minimum
    ? Math.round(value)
    : fallback;
}

function safeResponseTime(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function recentAccuracy(state: Pick<MasteryState, "recentCorrect">): number {
  return state.recentCorrect.length === 0
    ? 0
    : state.recentCorrect.filter(Boolean).length / state.recentCorrect.length;
}

export function getMasteryLevel(state: Pick<MasteryState, "attempts" | "correctWithoutHelp" | "recentCorrect">): MasteryLevel {
  const accuracy = recentAccuracy(state);
  if (state.attempts < 5) return "discovering";
  if (accuracy >= 0.9 && state.attempts >= 10 && state.correctWithoutHelp > state.attempts / 2) return "mastered";
  if (accuracy >= 0.7) return "mastering";
  return "practicing";
}

export function normalizeMasteryState(raw: unknown): MasteryState {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return emptyMasteryState();
  const candidate = raw as Record<string, unknown>;
  const attempts = clampInteger(candidate.attempts, 0);
  const correct = Math.min(attempts, clampInteger(candidate.correct, 0));
  const correctWithoutHelp = Math.min(correct, clampInteger(candidate.correctWithoutHelp, 0));
  const recentCorrect = Array.isArray(candidate.recentCorrect)
    ? candidate.recentCorrect.filter((value): value is boolean => typeof value === "boolean").slice(-MAX_RECENT_CORRECT)
    : [];
  const state: MasteryState = {
    attempts,
    correct,
    correctWithoutHelp,
    averageResponseTimeMs: safeResponseTime(candidate.averageResponseTimeMs),
    recentCorrect,
    level: "discovering",
    updatedAt: typeof candidate.updatedAt === "string" ? candidate.updatedAt : "",
  };
  return { ...state, level: getMasteryLevel(state) };
}

export function normalizeMasteryByDomain(raw: unknown): MasteryByDomain {
  const candidate = raw && typeof raw === "object" && !Array.isArray(raw)
    ? raw as Record<string, unknown>
    : {};
  return MASTERY_DOMAINS.reduce((result, domain) => {
    result[domain] = normalizeMasteryState(candidate[domain]);
    return result;
  }, {} as MasteryByDomain);
}

export function normalizeMasteryHistory(raw: unknown): MasteryHistoryEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((value): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value))
    .filter((value) => isMathDomain(value.domain) && typeof value.correct === "boolean" && typeof value.correctWithoutHelp === "boolean")
    .map((value) => ({
      domain: value.domain as MathDomain,
      correct: value.correct as boolean,
      correctWithoutHelp: value.correctWithoutHelp as boolean,
      responseTimeMs: safeResponseTime(value.responseTimeMs),
      occurredAt: typeof value.occurredAt === "string" ? value.occurredAt : "",
    }))
    .slice(-MAX_MASTERY_HISTORY);
}

export function recordMasteryAttempt(
  current: MasteryByDomain,
  history: readonly MasteryHistoryEntry[],
  attempt: MasteryAttempt,
): { masteryByDomain: MasteryByDomain; masteryHistory: MasteryHistoryEntry[] } {
  const previous = normalizeMasteryState(current[attempt.domain]);
  const responseTimeMs = safeResponseTime(attempt.responseTimeMs);
  const correctWithoutHelp = attempt.correct && !attempt.usedRetry && attempt.assistanceStage === "none";
  const nextAttempts = previous.attempts + 1;
  const nextCorrect = previous.correct + (attempt.correct ? 1 : 0);
  const nextCorrectWithoutHelp = previous.correctWithoutHelp + (correctWithoutHelp ? 1 : 0);
  const timedResponses = previous.averageResponseTimeMs === null || responseTimeMs === null
    ? null
    : ((previous.averageResponseTimeMs * previous.attempts) + responseTimeMs) / nextAttempts;
  const nextAverage = responseTimeMs === null
    ? previous.averageResponseTimeMs
    : previous.averageResponseTimeMs === null
      ? responseTimeMs
      : timedResponses;
  const nextState: MasteryState = {
    attempts: nextAttempts,
    correct: nextCorrect,
    correctWithoutHelp: nextCorrectWithoutHelp,
    averageResponseTimeMs: nextAverage,
    recentCorrect: [...previous.recentCorrect, attempt.correct].slice(-MAX_RECENT_CORRECT),
    level: "discovering",
    updatedAt: attempt.occurredAt,
  };
  nextState.level = getMasteryLevel(nextState);

  const entry: MasteryHistoryEntry = {
    domain: attempt.domain,
    correct: attempt.correct,
    correctWithoutHelp,
    responseTimeMs,
    occurredAt: attempt.occurredAt,
  };
  return {
    masteryByDomain: { ...current, [attempt.domain]: nextState },
    masteryHistory: [...history, entry].slice(-MAX_MASTERY_HISTORY),
  };
}
