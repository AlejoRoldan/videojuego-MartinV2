import type { MathChallengeType, MathPower } from "./types";

/** Number of consecutive fast, correct, first-attempt answers needed for the milestone. */
export const PERFECT_STREAK_TARGET = 5;
const PERFECT_RESPONSE_RATIO = 0.6;

/**
 * Updates the Perfect streak using only the submitted challenge outcome.
 *
 * The helper is deliberately pure: no timers, storage, audio or UI state are
 * consulted. Invalid timing inputs fail closed and reset the streak.
 */
export function updatePerfectStreak(
  currentStreak: number,
  correct: boolean,
  timeLeft: number | undefined,
  timeLimit: number,
  usedRetry = false,
): number {
  const normalizedStreak = Number.isFinite(currentStreak)
    ? Math.max(0, Math.min(PERFECT_STREAK_TARGET, Math.trunc(currentStreak)))
    : 0;
  const responseRatio = timeLeft === undefined || !Number.isFinite(timeLeft) || !Number.isFinite(timeLimit) || timeLimit <= 0
    ? 0
    : Math.max(0, Math.min(1, timeLeft / timeLimit));
  const isPerfectAnswer = correct && !usedRetry && responseRatio >= PERFECT_RESPONSE_RATIO;

  return isPerfectAnswer
    ? Math.min(PERFECT_STREAK_TARGET, normalizedStreak + 1)
    : 0;
}

/** Returns true only when the complete five-answer Perfect milestone is reached. */
export function isPerfectStreakComplete(streak: number): boolean {
  return Number.isFinite(streak) && streak >= PERFECT_STREAK_TARGET;
}

export interface MathPowerModifiers {
  accuracyNoiseMultiplier: number;
  powerBonus: number;
  autoSpin: number;
  arcBoost: number;
  animationSpeed: number;
  scoreBonus: number;
}

export const MATH_POWER_META: Record<Exclude<MathPower, null>, {
  label: string;
  shortLabel: string;
  icon: string;
  description: string;
}> = {
  precision: {
    label: "Precisión matemática",
    shortLabel: "PRECISIÓN",
    icon: "🎯",
    description: "El balón viaja con mucha menos desviación.",
  },
  curve: {
    label: "Curva científica",
    shortLabel: "CURVA",
    icon: "🌀",
    description: "El balón gana una curva especial para superar la barrera.",
  },
  turbo: {
    label: "Turbo vectorial",
    shortLabel: "TURBO",
    icon: "⚡",
    description: "El disparo sale más rápido y con potencia extra.",
  },
  perfect: {
    label: "Tiro perfecto",
    shortLabel: "PERFECTO",
    icon: "✨",
    description: "Máxima precisión, potencia y una trayectoria especial en cámara lenta.",
  },
};

const NONE: MathPowerModifiers = {
  accuracyNoiseMultiplier: 1,
  powerBonus: 0,
  autoSpin: 0,
  arcBoost: 1,
  animationSpeed: 1,
  scoreBonus: 0,
};

export function selectMathPower(
  challengeType: MathChallengeType,
  timeLeft: number | undefined,
  timeLimit: number,
  usedRetry = false
): MathPower {
  const responseRatio = timeLeft === undefined || timeLimit <= 0
    ? 0
    : Math.max(0, Math.min(1, timeLeft / timeLimit));

  // A quick, correct first attempt earns the most satisfying reward.
  if (!usedRetry && responseRatio >= 0.6) return "perfect";

  switch (challengeType) {
    case "angle":
      return "curve";
    case "coordinate":
    case "velocity":
      return "turbo";
    case "multiplication":
    default:
      return "precision";
  }
}

export function getMathPowerModifiers(power: MathPower): MathPowerModifiers {
  switch (power) {
    case "precision":
      return {
        ...NONE,
        accuracyNoiseMultiplier: 0.25,
        scoreBonus: 0.1,
      };
    case "curve":
      return {
        ...NONE,
        accuracyNoiseMultiplier: 0.7,
        autoSpin: 0.85,
        arcBoost: 1.08,
        scoreBonus: 0.15,
      };
    case "turbo":
      return {
        ...NONE,
        accuracyNoiseMultiplier: 0.7,
        powerBonus: 15,
        animationSpeed: 1.7,
        scoreBonus: 0.15,
      };
    case "perfect":
      return {
        accuracyNoiseMultiplier: 0,
        powerBonus: 25,
        autoSpin: 0.35,
        arcBoost: 1.35,
        animationSpeed: 0.55,
        scoreBonus: 0.5,
      };
    default:
      return NONE;
  }
}
