// =============================================================
// TIRO LIBRE MATEMÁTICO — Game Reducer
// Central state machine for all game logic
// =============================================================

import type {
  GameState,
  GameAction,
  BallState,
  GoalkeeperState,
  Particle,
  FloatingText,
  GameplayEvent,
  ShotPerformance,
  MathPower,
} from "./types";
import { getLevelById } from "../levels/levelData";
import { generateChallenge, updateAdaptiveDifficulty } from "../math/mathEngine";
import {
  isPerfectStreakComplete,
  MATH_POWER_META,
  selectMathPower,
  updatePerfectStreak,
} from "./mathPowers";
import { nanoid } from "nanoid";
import {
  advanceFlowCooldown,
  applyFlowIntervention,
  DEFAULT_RUNTIME_MODIFIERS,
  emptyPerformanceWindow,
  evaluatePerformanceWindow,
  MAX_GAMEPLAY_EVENTS,
  selectFlowIntervention,
} from "./flowEngine";

function createInitialBall(): BallState {
  return {
    position: { x: 0.5, y: 0.85 },
    velocity: { x: 0, y: 0 },
    spin: 0,
    power: 75,
    inFlight: false,
    trail: [],
  };
}

function createInitialKeeper(): GoalkeeperState {
  return {
    position: { x: 0.5, y: 0.5 },
    speed: 0.3,
    direction: 1,
    diving: false,
    diveTarget: null,
  };
}

function createConfettiParticles(x: number, y: number, count = 20): Particle[] {
  const colors = ["#FF6B35", "#FFD700", "#2ECC40", "#3742FA", "#FF4757", "#7BED9F"];
  return Array.from({ length: count }, () => ({
    id: nanoid(),
    x,
    y,
    vx: (Math.random() - 0.5) * 4,
    vy: -(Math.random() * 3 + 1),
    color: colors[Math.floor(Math.random() * colors.length)],
    size: Math.random() * 8 + 4,
    life: 1,
    maxLife: 1,
    type: "confetti" as const,
  }));
}

function createStarParticles(x: number, y: number): Particle[] {
  return Array.from({ length: 8 }, (_, i) => ({
    id: nanoid(),
    x,
    y,
    vx: Math.cos((i / 8) * Math.PI * 2) * 2,
    vy: Math.sin((i / 8) * Math.PI * 2) * 2,
    color: "#FFD700",
    size: 12,
    life: 1,
    maxLife: 1,
    type: "star" as const,
  }));
}

function createPowerParticles(x: number, y: number, power: Exclude<MathPower, null>): Particle[] {
  const colors: Record<Exclude<MathPower, null>, string> = {
    precision: "#7BED9F",
    curve: "#B388FF",
    turbo: "#4DD0E1",
    perfect: "#FFF3A3",
  };
  const count = power === "perfect" ? 18 : 12;
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2;
    const speed = power === "turbo" ? 2.7 : power === "perfect" ? 2.2 : 1.8;
    return {
      id: nanoid(),
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      color: colors[power],
      size: power === "perfect" ? 7 : 5,
      life: 1,
      maxLife: power === "perfect" ? 0.8 : 0.65,
      type: "spark" as const,
    };
  });
}

export function appendGameplayEvents(current: GameplayEvent[], incoming: GameplayEvent[] = []): GameplayEvent[] {
  return [...current, ...incoming].slice(-MAX_GAMEPLAY_EVENTS);
}

function createFloatingText(
  text: string,
  x: number,
  y: number,
  color: string,
  size: FloatingText["size"] = "lg"
): FloatingText {
  return { id: nanoid(), text, x, y, color, size, life: 1, maxLife: 1 };
}

export const initialGameState: GameState = {
  screen: "home",
  currentLevel: null,
  levelConfig: null,
  ball: createInitialBall(),
  goalkeeper: createInitialKeeper(),
  wall: [],
  currentChallenge: null,
  shotsScored: 0,
  shotsTaken: 0,
  score: 0,
  combo: 0,
  maxCombo: 0,
  timeElapsed: 0,
  phase: "aiming",
  targetCoord: null,
  lastShotResult: null,
  lastMathCorrect: null,
  adaptiveDifficulty: {
    frustrationScore: 0,
    avgResponseTime: 5,
    recentErrors: [],
    currentMultiplier: 1.0,
    hintsEnabled: false,
    targetSizeMultiplier: 1.0,
  },
  particles: [],
  floatingTexts: [],
  currentMathPower: null,
  perfectStreak: 0,
  mathPowerSequence: 0,
  gameplayEvents: [],
  performanceWindow: emptyPerformanceWindow(),
  runtimeModifiers: { ...DEFAULT_RUNTIME_MODIFIERS },
  lastMathResponseTimeMs: null,
  pendingFlowIntervention: null,
  sustainedMasteryWindows: 0,
};

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "SET_SCREEN":
      return { ...state, screen: action.screen };

    case "START_LEVEL": {
      const config = getLevelById(action.levelId);
      if (!config) return state;
      const wall = config.hasWall
        ? Array.from({ length: config.wallCount }, (_, i) => ({
            id: i,
            position: { x: 0.2 + (i / (config.wallCount - 1 || 1)) * 0.6, y: 0.5 },
            number: Math.floor(Math.random() * 8) + 2,
          }))
        : [];
      const challenge = generateChallenge(config, 0);
      return {
        ...state,
        screen: "gameplay",
        currentLevel: action.levelId,
        levelConfig: config,
        ball: createInitialBall(),
        goalkeeper: { ...createInitialKeeper(), speed: config.keeperSpeed },
        wall,
        currentChallenge: challenge,
        shotsScored: 0,
        shotsTaken: 0,
        score: 0,
        combo: 0,
        maxCombo: 0,
        timeElapsed: 0,
        phase: "aiming",
        targetCoord: null,
        lastShotResult: null,
        lastMathCorrect: null,
        adaptiveDifficulty: { ...state.adaptiveDifficulty, hintsEnabled: false },
        particles: [],
        floatingTexts: [],
        currentMathPower: null,
        perfectStreak: 0,
        mathPowerSequence: 0,
        gameplayEvents: state.gameplayEvents,
        performanceWindow: emptyPerformanceWindow(),
        runtimeModifiers: { ...DEFAULT_RUNTIME_MODIFIERS },
        pendingFlowIntervention: null,
        sustainedMasteryWindows: 0,
        lastMathResponseTimeMs: null,
      };
    }

    case "SET_TARGET": {
      const skipMath = state.levelConfig?.concept === "directions";
      return {
        ...state,
        targetCoord: action.coord,
        phase: skipMath ? "aiming" : "math",
        ball: skipMath ? { ...state.ball, power: 80 } : state.ball,
        adaptiveDifficulty: { ...state.adaptiveDifficulty, hintsEnabled: false },
        currentMathPower: null,
        lastMathCorrect: skipMath ? true : null,
        lastMathResponseTimeMs: null,
      };
    }

    case "SUBMIT_MATH": {
      if (!state.currentChallenge || !state.levelConfig) return state;
      const correct = action.answer === state.currentChallenge.answer;
      const usedRetry = action.usedRetry ?? state.currentChallenge.retryGranted ?? false;
      const responseTimeMs = action.responseTimeMs
        ?? (action.timeLeft === undefined
          ? null
          : Math.max(0, (state.currentChallenge.timeLimit - action.timeLeft) * 1000));
      const newPower = correct ? 85 : 45;
      const mathPower = correct
        ? selectMathPower(
            state.currentChallenge.type,
            action.timeLeft,
            state.currentChallenge.timeLimit,
            usedRetry
          )
        : null;
      const nextPerfectStreak = updatePerfectStreak(
        state.perfectStreak,
        correct,
        action.timeLeft,
        state.currentChallenge.timeLimit,
        usedRetry,
      );
      const completedPerfectStreak = isPerfectStreakComplete(nextPerfectStreak)
        && state.perfectStreak < nextPerfectStreak;

      const newErrors = [...state.adaptiveDifficulty.recentErrors, correct ? 0 : 1];
      const adaptive = updateAdaptiveDifficulty(
        state.adaptiveDifficulty.currentMultiplier,
        newErrors,
        state.adaptiveDifficulty.avgResponseTime,
        state.currentChallenge.timeLimit
      );

      const floatingTexts = correct && mathPower
        ? [createFloatingText(`${MATH_POWER_META[mathPower].icon} ${MATH_POWER_META[mathPower].label}`, 0.5, 0.48, "#FFD700", "lg")]
        : correct
          ? [createFloatingText("¡CORRECTO! +PODER", 0.5, 0.5, "#7BED9F", "lg")]
          : [createFloatingText("Respuesta incorrecta", 0.5, 0.5, "#FF4757", "md")];
      if (completedPerfectStreak) {
        floatingTexts.push(createFloatingText("¡RACHA PERFECTA! 5 ACERTADOS", 0.5, 0.38, "#FFD700", "xl"));
      }

      return {
        ...state,
        ball: { ...state.ball, power: newPower },
        phase: "aiming",
        adaptiveDifficulty: {
          ...state.adaptiveDifficulty,
          recentErrors: newErrors,
          currentMultiplier: adaptive.multiplier,
          hintsEnabled: adaptive.hintsEnabled,
          targetSizeMultiplier: adaptive.targetSizeMultiplier,
        },
        floatingTexts: [...state.floatingTexts, ...floatingTexts],
        currentMathPower: mathPower,
        perfectStreak: nextPerfectStreak,
        mathPowerSequence: state.mathPowerSequence + (correct ? 1 : 0),
        lastMathCorrect: correct,
        lastMathResponseTimeMs: responseTimeMs,
        gameplayEvents: appendGameplayEvents(state.gameplayEvents, action.event ? [action.event] : []),
      };
    }

    case "MATH_ASSISTANCE": {
      if (!state.currentChallenge || state.phase !== "math") return state;
      const baseHint = state.currentChallenge.baseHint ?? state.currentChallenge.hint ?? "Mira con calma la operación";
      const hint = action.stage === "hint"
        ? baseHint
        : action.stage === "visual"
          ? `👀 ${baseHint}. Mira las opciones y descarta las que no pueden ser.`
          : `⭐ ${baseHint}. Tómate un segundo: estima primero y luego elige.`;
      return {
        ...state,
        currentChallenge: { ...state.currentChallenge, baseHint, hint, assistanceStage: action.stage },
        adaptiveDifficulty: { ...state.adaptiveDifficulty, hintsEnabled: true },
      };
    }

    case "GRANT_MATH_RETRY": {
      if (!state.currentChallenge || state.phase !== "math" || state.currentChallenge.retryGranted) return state;
      const originalQuestion = state.currentChallenge.question.replace(/^💡 Segunda oportunidad: /, "");
      const baseHint = state.currentChallenge.baseHint ?? state.currentChallenge.hint ?? "Piensa paso a paso";
      return {
        ...state,
        currentChallenge: {
          ...state.currentChallenge,
          question: `💡 Segunda oportunidad: ${originalQuestion}`,
          timeLimit: Math.max(1, action.seconds),
          baseHint,
          hint: `Sin presión: ${baseHint}`,
          assistanceStage: "urgent",
          retryGranted: true,
        },
        adaptiveDifficulty: { ...state.adaptiveDifficulty, hintsEnabled: true },
      };
    }

    case "SHOOT":
      if (!state.targetCoord || !state.levelConfig) return state;
      if (state.phase !== "aiming" && state.phase !== "shooting") return state;
      return {
        ...state,
        ball: {
          ...state.ball,
          inFlight: true,
          position: action.resolution?.trajectoryPoints[0] ?? state.ball.position,
          trail: action.resolution?.trajectoryPoints ?? state.ball.trail,
        },
        lastShotResult: action.resolution ?? state.lastShotResult,
        phase: "shooting",
      };

    case "SHOT_COMPLETE": {
      const result = action.result;
      const newShotsScored = state.shotsScored + (result.scored ? 1 : 0);
      const newShotsTaken = state.shotsTaken + 1;
      const newCombo = result.scored ? state.combo + 1 : 0;
      const newMaxCombo = Math.max(state.maxCombo, newCombo);
      const baseScore = result.scored ? 100 : 0;
      const comboBonus = newCombo > 1 ? (newCombo - 1) * 50 : 0;
      const mathBonus = result.mathCorrect ? 25 : 0;
      const multipliedScore = Math.round((baseScore + comboBonus + mathBonus) * result.bonusMultiplier);
      const newScore = state.score + multipliedScore;

      let newParticles: Particle[] = [];
      let newFloatingTexts: FloatingText[] = [];
      if (result.scored) {
        newParticles = createConfettiParticles(0.5, 0.3, state.currentMathPower === "perfect" ? 50 : 30);
        newFloatingTexts = [createFloatingText("¡GOL!", 0.5, 0.3, "#FFD700", "xl")];
        if (newCombo > 1) newFloatingTexts.push(createFloatingText(`COMBO x${newCombo}!`, 0.5, 0.45, "#FF6B35", "lg"));
        if (result.bonusMultiplier > 1.5) newFloatingTexts.push(createFloatingText("¡ESQUINA! BONUS", 0.5, 0.55, "#7BED9F", "md"));
      } else if (result.savedByKeeper) {
        newFloatingTexts = [createFloatingText("¡Atajada!", 0.5, 0.3, "#FF4757", "lg")];
      } else if (result.blockedByWall) {
        newFloatingTexts = [createFloatingText("¡Bloqueado!", 0.5, 0.3, "#FF6B35", "lg")];
      } else {
        newFloatingTexts = [createFloatingText("¡Afuera!", 0.5, 0.3, "#FF4757", "md")];
      }
      if (result.mathCorrect && result.scored) newParticles = [...newParticles, ...createStarParticles(0.5, 0.5)];
      if (result.input.mathPower) newParticles = [...newParticles, ...createPowerParticles(0.5, 0.4, result.input.mathPower)];
      if (result.mathCorrect && !result.scored) {
        newFloatingTexts.push(createFloatingText("¡Buen cálculo! El poder contó aunque el tiro fue detenido.", 0.5, 0.52, "#D8FFD8", "md"));
      }
      const shotPerformance: ShotPerformance = {
        domain: state.currentChallenge?.type ?? "multiplication",
        mathCorrect: result.mathCorrect,
        responseTimeMs: state.lastMathResponseTimeMs,
        assistanceStage: state.currentChallenge?.assistanceStage === "calm" || !state.currentChallenge?.assistanceStage
          ? "none"
          : state.currentChallenge.assistanceStage,
        usedRetry: state.currentChallenge?.retryGranted ?? false,
        outcome: result.outcome,
        scored: result.scored,
        difficulty: state.levelConfig?.mathDifficulty ?? "easy",
      };
      const performanceWindow = evaluatePerformanceWindow([
        ...state.performanceWindow.shots,
        shotPerformance,
      ]);
      const nextSustainedMasteryWindows = performanceWindow.shots.length === 5
        && (performanceWindow.mathSuccessRate ?? 0) > 0.9
        && (performanceWindow.noHelpSuccessRate ?? 0) >= 0.7
        ? state.sustainedMasteryWindows + 1
        : performanceWindow.shots.length === 5 ? 0 : state.sustainedMasteryWindows;
      const pendingFlowIntervention = selectFlowIntervention(
        performanceWindow,
        state.runtimeModifiers,
        nextSustainedMasteryWindows,
      );
      const newChallenge = state.levelConfig ? generateChallenge(state.levelConfig, newShotsTaken) : null;
      return {
        ...state,
        shotsScored: newShotsScored,
        shotsTaken: newShotsTaken,
        score: newScore,
        combo: newCombo,
        maxCombo: newMaxCombo,
        lastShotResult: result,
        phase: "result",
        ball: { ...state.ball, inFlight: false },
        currentChallenge: newChallenge,
        particles: [...state.particles, ...newParticles],
        floatingTexts: [...state.floatingTexts, ...newFloatingTexts],
        gameplayEvents: appendGameplayEvents(state.gameplayEvents, action.events),
        performanceWindow,
        pendingFlowIntervention,
        sustainedMasteryWindows: nextSustainedMasteryWindows,
      };
    }

    case "NEXT_SHOT": {
      if (!state.levelConfig) return state;
      const { shotsScored, shotsTaken, levelConfig } = state;
      const cooledRuntime = advanceFlowCooldown(state.runtimeModifiers);
      const nextRuntime = applyFlowIntervention(cooledRuntime, state.pendingFlowIntervention);
      const shotsLeft = levelConfig.shotsAllowed - shotsTaken;
      if (shotsScored >= levelConfig.shotsRequired) return { ...state, screen: "victory" };
      if (shotsLeft <= 0) return { ...state, screen: "defeat" };
      return {
        ...state,
        phase: "aiming",
        targetCoord: null,
        lastShotResult: null,
        lastMathCorrect: null,
        ball: createInitialBall(),
        adaptiveDifficulty: { ...state.adaptiveDifficulty, hintsEnabled: false },
        floatingTexts: [],
        currentMathPower: null,
        perfectStreak: state.perfectStreak,
        mathPowerSequence: state.mathPowerSequence,
        runtimeModifiers: nextRuntime,
        pendingFlowIntervention: null,
        lastMathResponseTimeMs: null,
        gameplayEvents: appendGameplayEvents(state.gameplayEvents, action.flowEvent ? [action.flowEvent] : []),
      };
    }

    case "LEVEL_COMPLETE": return { ...state, screen: "victory" };
    case "LEVEL_FAILED": return { ...state, screen: "defeat" };
    case "UPDATE_PHYSICS": return state;
    case "ADD_PARTICLES": return { ...state, particles: [...state.particles, ...action.particles] };
    case "ADD_FLOATING_TEXT": return { ...state, floatingTexts: [...state.floatingTexts, action.text] };

    case "TICK_PARTICLES": {
      // The reducer ticks every 50 ms; keeping dt aligned makes visual rewards short and predictable.
      const dt = 0.05;
      const updatedParticles = state.particles
        .map((p) => ({ ...p, x: p.x + p.vx * dt, y: p.y + p.vy * dt, vy: p.vy + 2 * dt, life: p.life - dt / p.maxLife }))
        .filter((p) => p.life > 0);
      const updatedTexts = state.floatingTexts
        .map((t) => ({ ...t, y: t.y - 0.5 * dt, life: t.life - dt / (t.maxLife * 1.5) }))
        .filter((t) => t.life > 0);
      return { ...state, particles: updatedParticles, floatingTexts: updatedTexts };
    }

    case "RESET_GAME": return { ...initialGameState };
    default: return state;
  }
}
