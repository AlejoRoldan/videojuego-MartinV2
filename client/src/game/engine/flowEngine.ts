import type {
  FlowIntervention,
  LevelRuntimeModifiers,
  PerformanceWindow,
  ShotPerformance,
} from "./types";

export const PERFORMANCE_WINDOW_SIZE = 5;
export const FLOW_COOLDOWN_SHOTS = 3;
export const MAX_GAMEPLAY_EVENTS = 200;

export const DEFAULT_RUNTIME_MODIFIERS: LevelRuntimeModifiers = {
  keeperReachMultiplier: 1,
  targetSizeMultiplier: 1,
  assistanceLeadSeconds: 0,
  windMultiplier: 1,
  cooldownRemaining: 0,
};

export function emptyPerformanceWindow(): PerformanceWindow {
  return {
    shots: [],
    mathSuccessRate: null,
    footballSuccessRate: null,
    correctMathButNoGoalCount: 0,
    consecutiveMathErrors: 0,
    consecutiveFootballMisses: 0,
    averageResponseTimeMs: null,
    noHelpSuccessRate: null,
  };
}

function rate(successes: number, attempts: number): number | null {
  return attempts === 0 ? null : successes / attempts;
}

function countTrailing(shots: readonly ShotPerformance[], predicate: (shot: ShotPerformance) => boolean): number {
  let count = 0;
  for (let index = shots.length - 1; index >= 0; index -= 1) {
    if (!predicate(shots[index])) break;
    count += 1;
  }
  return count;
}

export function evaluatePerformanceWindow(shots: readonly ShotPerformance[]): PerformanceWindow {
  const recentShots = shots.slice(-PERFORMANCE_WINDOW_SIZE);
  if (recentShots.length === 0) return emptyPerformanceWindow();

  const mathCorrectCount = recentShots.filter((shot) => shot.mathCorrect).length;
  const footballGoals = recentShots.filter((shot) => shot.scored).length;
  const noHelpShots = recentShots.filter((shot) => !shot.usedRetry && shot.assistanceStage === "none");
  const noHelpSuccesses = noHelpShots.filter((shot) => shot.mathCorrect).length;
  const responseTimes = recentShots
    .map((shot) => shot.responseTimeMs)
    .filter((time): time is number => time !== null && Number.isFinite(time));

  return {
    shots: recentShots,
    mathSuccessRate: rate(mathCorrectCount, recentShots.length),
    footballSuccessRate: rate(footballGoals, recentShots.length),
    correctMathButNoGoalCount: recentShots.filter((shot) => shot.mathCorrect && !shot.scored).length,
    consecutiveMathErrors: countTrailing(recentShots, (shot) => !shot.mathCorrect),
    consecutiveFootballMisses: countTrailing(recentShots, (shot) => !shot.scored),
    averageResponseTimeMs: responseTimes.length === 0
      ? null
      : responseTimes.reduce((total, time) => total + time, 0) / responseTimes.length,
    noHelpSuccessRate: rate(noHelpSuccesses, noHelpShots.length),
  };
}

function intervention(
  window: PerformanceWindow,
  trigger: FlowIntervention["trigger"],
  axis: FlowIntervention["axis"],
  change: string,
  reason: string,
  modifiers: Partial<LevelRuntimeModifiers>,
  cooldownShots = 0,
): FlowIntervention {
  return {
    trigger,
    axis,
    change,
    reason,
    modifiers,
    cooldownShots,
    windowMathSuccessRate: window.mathSuccessRate ?? 0,
    windowFootballSuccessRate: window.footballSuccessRate ?? 0,
  };
}

function lastThreeAreCorrectMathFootballMisses(window: PerformanceWindow): boolean {
  const shots = window.shots.slice(-3);
  return shots.length === 3 && shots.every((shot) => shot.mathCorrect && !shot.scored);
}

export function selectFlowIntervention(
  window: PerformanceWindow,
  runtime: LevelRuntimeModifiers,
  sustainedMasteryWindows = 0,
): FlowIntervention | null {
  if (window.consecutiveMathErrors >= 2) {
    return intervention(
      window,
      "math_struggle",
      "assistance",
      "+2 s de ayuda anticipada",
      "Dos errores matemáticos consecutivos; se mantiene el mismo concepto y se adelanta la ayuda.",
      { assistanceLeadSeconds: 2 },
    );
  }

  if (lastThreeAreCorrectMathFootballMisses(window)) {
    return intervention(
      window,
      "football_struggle",
      "football",
      "-12 % de alcance del obstáculo futbolístico",
      "Tres resultados futbolísticos detenidos con matemática correcta; se ajusta solo el eje futbolístico.",
      { keeperReachMultiplier: 0.88, windMultiplier: 0.88 },
    );
  }

  if (window.footballSuccessRate !== null && window.footballSuccessRate < 0.6) {
    return intervention(
      window,
      "recovery",
      "football",
      "+15 % de margen del objetivo de recuperación",
      "La tasa total de gol está por debajo de 60 %; se ofrece un tiro de recuperación sin cambiar el concepto matemático.",
      { targetSizeMultiplier: 1.15 },
    );
  }

  if (
    window.mathSuccessRate !== null
    && window.mathSuccessRate > 0.9
    && (window.noHelpSuccessRate === null || window.noHelpSuccessRate >= 0.7)
    && sustainedMasteryWindows >= 2
    && runtime.cooldownRemaining === 0
  ) {
    return intervention(
      window,
      "sustained_mastery",
      "football",
      "+5 % de exigencia del portero",
      "Dos ventanas consecutivas superan 90 % con poco uso de ayuda; aumenta un único eje futbolístico.",
      { keeperReachMultiplier: 1.05 },
      FLOW_COOLDOWN_SHOTS,
    );
  }

  return null;
}

export function applyFlowIntervention(
  runtime: LevelRuntimeModifiers,
  selected: FlowIntervention | null,
): LevelRuntimeModifiers {
  if (!selected) return runtime;
  const next = { ...runtime };
  if (selected.axis === "assistance") {
    next.assistanceLeadSeconds = Math.max(0, runtime.assistanceLeadSeconds + (selected.modifiers.assistanceLeadSeconds ?? 0));
  } else if (selected.axis === "football") {
    if (selected.modifiers.keeperReachMultiplier !== undefined) {
      next.keeperReachMultiplier = Math.max(0.7, runtime.keeperReachMultiplier * selected.modifiers.keeperReachMultiplier);
    }
    if (selected.modifiers.targetSizeMultiplier !== undefined) {
      next.targetSizeMultiplier = Math.min(1.3, runtime.targetSizeMultiplier * selected.modifiers.targetSizeMultiplier);
    }
    if (selected.modifiers.windMultiplier !== undefined) {
      next.windMultiplier = Math.max(0.7, runtime.windMultiplier * selected.modifiers.windMultiplier);
    }
  }
  next.cooldownRemaining = Math.max(runtime.cooldownRemaining, selected.cooldownShots);
  return next;
}

export function advanceFlowCooldown(runtime: LevelRuntimeModifiers): LevelRuntimeModifiers {
  return {
    ...runtime,
    cooldownRemaining: Math.max(0, runtime.cooldownRemaining - 1),
  };
}
