export type GamePace = "easy" | "medium" | "match" | "hard";
export type MathAssistanceStage = "calm" | "hint" | "visual" | "urgent" | "expired";

export const GAME_PACE_STORAGE_KEY = "tlm_game_pace";

export const ASSISTANCE_THRESHOLDS = {
  hint: 15,
  visual: 8,
  urgent: 5,
} as const;

export const ASSISTANCE_RATIOS = {
  hint: 0.55,
  visual: 0.30,
  urgent: 0.12,
} as const;

export interface GamePaceConfig {
  label: string;
  description: string;
  multiplier: number;
  minimumSeconds: number;
  retrySeconds: number;
  resultTransitionMs: number;
  perfectResultTransitionMs: number;
  autoShootDelayMs: number;
  shotAnimationMultiplier: number;
}

export const GAME_PACE_CONFIG: Record<GamePace, GamePaceConfig> = {
  easy: {
    label: "Fácil",
    description: "Más tiempo para pensar y disfrutar",
    multiplier: 2,
    minimumSeconds: 30,
    retrySeconds: 5,
    resultTransitionMs: 1800,
    perfectResultTransitionMs: 2200,
    autoShootDelayMs: 850,
    shotAnimationMultiplier: 1,
  },
  medium: {
    label: "Intermedio",
    description: "Buen equilibrio entre pensar y reaccionar",
    multiplier: 1.5,
    minimumSeconds: 20,
    retrySeconds: 3,
    resultTransitionMs: 1500,
    perfectResultTransitionMs: 1900,
    autoShootDelayMs: 650,
    shotAnimationMultiplier: 0.88,
  },
  match: {
    label: "Ritmo de partido",
    description: "Más acción, sin quitarte tiempo para pensar",
    multiplier: 1.25,
    minimumSeconds: 15,
    retrySeconds: 2,
    resultTransitionMs: 700,
    perfectResultTransitionMs: 900,
    autoShootDelayMs: 450,
    // The match shot should feel like a decisive kick, not a slow slideshow.
    // Direct kick: the ball reaches the selected target before the pause can feel slow.
    shotAnimationMultiplier: 0.48,
  },
  hard: {
    label: "Difícil",
    description: "Ritmo rápido, como el juego original",
    multiplier: 1,
    minimumSeconds: 1,
    retrySeconds: 0,
    resultTransitionMs: 900,
    perfectResultTransitionMs: 1200,
    autoShootDelayMs: 300,
    shotAnimationMultiplier: 0.66,
  },
};

export function getAssistanceThresholds(timeLimit: number): {
  hint: number;
  visual: number;
  urgent: number;
} {
  const safeTimeLimit = Math.max(1, timeLimit);
  return {
    hint: Math.max(3, Math.ceil(safeTimeLimit * ASSISTANCE_RATIOS.hint)),
    visual: Math.max(2, Math.ceil(safeTimeLimit * ASSISTANCE_RATIOS.visual)),
    urgent: Math.max(1, Math.ceil(safeTimeLimit * ASSISTANCE_RATIOS.urgent)),
  };
}

export function getResultTransitionMs(pace: GamePace, perfect = false): number {
  const config = GAME_PACE_CONFIG[pace];
  return perfect ? config.perfectResultTransitionMs : config.resultTransitionMs;
}

export function getAutoShootDelayMs(pace: GamePace): number {
  return GAME_PACE_CONFIG[pace].autoShootDelayMs;
}

export function getShotAnimationDuration(
  pace: GamePace,
  mathPower: "precision" | "curve" | "turbo" | "perfect" | null | undefined,
): number {
  const baseDuration = mathPower === "perfect" ? 1100 : mathPower === "turbo" ? 720 : 900;
  return Math.round(baseDuration * GAME_PACE_CONFIG[pace].shotAnimationMultiplier);
}

function isSupportedPace(value: unknown): value is GamePace {
  return value === "easy" || value === "medium" || value === "match" || value === "hard";
}

export function isGamePace(value: unknown): value is GamePace {
  return isSupportedPace(value);
}

export function loadGamePace(): GamePace {
  try {
    if (typeof localStorage === "undefined") return "easy";
    const saved = localStorage.getItem(GAME_PACE_STORAGE_KEY);
    return isSupportedPace(saved) ? saved : "easy";
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

export function getMathAssistanceStage(timeLeft: number, timeLimit?: number): MathAssistanceStage {
  if (timeLeft <= 0) return "expired";
  const thresholds = timeLimit === undefined ? ASSISTANCE_THRESHOLDS : getAssistanceThresholds(timeLimit);
  if (timeLeft <= thresholds.urgent) return "urgent";
  if (timeLeft <= thresholds.visual) return "visual";
  if (timeLeft <= thresholds.hint) return "hint";
  return "calm";
}

export function getRetrySeconds(pace: GamePace, retryAlreadyGranted: boolean): number {
  if (retryAlreadyGranted) return 0;
  return GAME_PACE_CONFIG[pace].retrySeconds;
}
