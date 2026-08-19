export type GamePace = "easy" | "medium" | "hard";
export type MathAssistanceStage = "calm" | "hint" | "visual" | "urgent" | "expired";

export const GAME_PACE_STORAGE_KEY = "tlm_game_pace";

export const ASSISTANCE_THRESHOLDS = {
  hint: 15,
  visual: 8,
  urgent: 5,
} as const;

export const GAME_PACE_CONFIG: Record<
  GamePace,
  { label: string; description: string; multiplier: number; minimumSeconds: number; retrySeconds: number }
> = {
  easy: {
    label: "Fácil",
    description: "Más tiempo para pensar y disfrutar",
    multiplier: 2,
    minimumSeconds: 30,
    retrySeconds: 5,
  },
  medium: {
    label: "Intermedio",
    description: "Buen equilibrio entre pensar y reaccionar",
    multiplier: 1.5,
    minimumSeconds: 20,
    retrySeconds: 3,
  },
  hard: {
    label: "Difícil",
    description: "Ritmo rápido, como el juego original",
    multiplier: 1,
    minimumSeconds: 1,
    retrySeconds: 0,
  },
};

export function isGamePace(value: unknown): value is GamePace {
  return value === "easy" || value === "medium" || value === "hard";
}

export function loadGamePace(): GamePace {
  try {
    if (typeof localStorage === "undefined") return "easy";
    const saved = localStorage.getItem(GAME_PACE_STORAGE_KEY);
    return isGamePace(saved) ? saved : "easy";
  } catch {
    return "easy";
  }
}

export function saveGamePace(pace: GamePace): void {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(GAME_PACE_STORAGE_KEY, pace);
    }
  } catch {
    // The game can continue even if browser storage is unavailable.
  }
}

export function adjustTimeLimit(baseSeconds: number, pace: GamePace): number {
  if (!Number.isFinite(baseSeconds) || baseSeconds <= 0) return 1;
  const config = GAME_PACE_CONFIG[pace];
  return Math.max(config.minimumSeconds, Math.ceil(baseSeconds * config.multiplier));
}

export function getConfiguredTimeLimit(baseSeconds: number): number {
  return adjustTimeLimit(baseSeconds, loadGamePace());
}

export function getMathAssistanceStage(timeLeft: number): MathAssistanceStage {
  if (timeLeft <= 0) return "expired";
  if (timeLeft <= ASSISTANCE_THRESHOLDS.urgent) return "urgent";
  if (timeLeft <= ASSISTANCE_THRESHOLDS.visual) return "visual";
  if (timeLeft <= ASSISTANCE_THRESHOLDS.hint) return "hint";
  return "calm";
}

export function getRetrySeconds(pace: GamePace, retryAlreadyGranted: boolean): number {
  if (retryAlreadyGranted) return 0;
  return GAME_PACE_CONFIG[pace].retrySeconds;
}
