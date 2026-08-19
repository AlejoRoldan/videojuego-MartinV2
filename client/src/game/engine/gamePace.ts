export type GamePace = "easy" | "medium" | "hard";

export const GAME_PACE_STORAGE_KEY = "tlm_game_pace";

export const GAME_PACE_CONFIG: Record<
  GamePace,
  { label: string; description: string; multiplier: number }
> = {
  easy: {
    label: "Fácil",
    description: "Más tiempo para pensar y disfrutar",
    multiplier: 2,
  },
  medium: {
    label: "Intermedio",
    description: "Buen equilibrio entre pensar y reaccionar",
    multiplier: 1.5,
  },
  hard: {
    label: "Difícil",
    description: "Ritmo rápido, como el juego original",
    multiplier: 1,
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
  return Math.max(1, Math.ceil(baseSeconds * GAME_PACE_CONFIG[pace].multiplier));
}

export function getConfiguredTimeLimit(baseSeconds: number): number {
  return adjustTimeLimit(baseSeconds, loadGamePace());
}
