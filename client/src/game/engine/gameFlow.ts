import type { GameAction, MathConcept } from "./types";

export const AUTO_SHOOT_DELAY_MS = 850;

export type GameplayEventKind = "math" | "shot" | "flow";

export function createGameplayEventId(
  sessionId: string,
  levelRun: number,
  kind: GameplayEventKind,
  sequence: number,
): string {
  const safeRun = Math.max(1, Math.trunc(levelRun));
  const safeSequence = Math.max(1, Math.trunc(sequence));
  return `${sessionId}-run-${safeRun}-${kind}-${safeSequence}`;
}

/** Keeps timer math deterministic and easy to test outside React. */
export function calculateRemainingMathTime(
  timeLimit: number,
  startedAt: number | null,
  now = Date.now()
): number {
  if (startedAt === null) return timeLimit;
  return Math.max(0, timeLimit - (now - startedAt) / 1000);
}

/** Direction levels count the coordinate choice as the learning interaction. */
export function resolveMathCorrect(
  lastMathCorrect: boolean | null,
  concept: MathConcept
): boolean {
  return lastMathCorrect ?? concept === "directions";
}

interface AutoShootOptions {
  dispatch: (action: GameAction) => void;
  isInFlight: () => boolean;
  markInFlight: () => void;
  onShoot?: () => void;
  delayMs?: number;
}

/** Shared delayed transition used by GameContext after a math answer. */
export function scheduleAutoShoot({
  dispatch,
  isInFlight,
  markInFlight,
  onShoot,
  delayMs = AUTO_SHOOT_DELAY_MS,
}: AutoShootOptions): ReturnType<typeof setTimeout> {
  return setTimeout(() => {
    if (isInFlight()) return;
    if (onShoot) onShoot();
    else {
      markInFlight();
      dispatch({ type: "SHOOT" });
    }
  }, delayMs);
}
