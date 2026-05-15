// =============================================================
// TIRO LIBRE MATEMÁTICO — Game Reducer
// Central state machine for all game logic
// =============================================================

import type { GameState, GameAction, BallState, GoalkeeperState, Particle, FloatingText } from "./types";
import { getLevelById } from "../levels/levelData";
import { generateChallenge, updateAdaptiveDifficulty } from "../math/mathEngine";
import { resolveShotResult } from "./physics";
import { nanoid } from "nanoid";

const GRID_MAX = { x: 3, y: 3 };

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

function createFloatingText(
  text: string,
  x: number,
  y: number,
  color: string,
  size: FloatingText["size"] = "lg"
): FloatingText {
  return {
    id: nanoid(),
    text,
    x,
    y,
    color,
    size,
    life: 1,
    maxLife: 1,
  };
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
            position: {
              x: 0.2 + (i / (config.wallCount - 1 || 1)) * 0.6,
              y: 0.5,
            },
            number: Math.floor(Math.random() * 8) + 2,
          }))
        : [];

      const challenge = generateChallenge(config);

      return {
        ...state,
        screen: "gameplay",
        currentLevel: action.levelId,
        levelConfig: config,
        ball: createInitialBall(),
        goalkeeper: {
          ...createInitialKeeper(),
          speed: config.keeperSpeed,
        },
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
        particles: [],
        floatingTexts: [],
      };
    }

    case "SET_TARGET": {
      const skipMath = state.levelConfig?.concept === "directions";
      return {
        ...state,
        targetCoord: action.coord,
        // For directions: stay in aiming phase until SHOOT is dispatched
        // For others: go to math phase to show the challenge
        phase: skipMath ? "aiming" : "math",
        ball: skipMath ? { ...state.ball, power: 80 } : state.ball,
      };
    }

    case "SUBMIT_MATH": {
      if (!state.currentChallenge || !state.levelConfig) return state;
      const correct = action.answer === state.currentChallenge.answer;
      const newPower = correct ? 85 + Math.random() * 15 : 45 + Math.random() * 20;

      const newErrors = [...state.adaptiveDifficulty.recentErrors, correct ? 0 : 1];
      const adaptive = updateAdaptiveDifficulty(
        state.adaptiveDifficulty.currentMultiplier,
        newErrors,
        state.adaptiveDifficulty.avgResponseTime,
        state.currentChallenge.timeLimit
      );

      const floatingTexts = correct
        ? [createFloatingText("\u00a1CORRECTO! +PODER", 0.5, 0.5, "#7BED9F", "lg")]
        : [createFloatingText("Respuesta incorrecta", 0.5, 0.5, "#FF4757", "md")];

      return {
        ...state,
        ball: { ...state.ball, power: newPower },
        // Set to "aiming" so the SHOOT action (dispatched shortly after) can fire
        phase: "aiming",
        adaptiveDifficulty: {
          ...state.adaptiveDifficulty,
          recentErrors: newErrors,
          ...adaptive,
        },
        floatingTexts: [...state.floatingTexts, ...floatingTexts],
      };
    }

    case "SHOOT": {
      if (!state.targetCoord || !state.levelConfig) return state;
      // Only shoot from aiming or shooting phase (not from math — submitMath handles that)
      if (state.phase !== "aiming" && state.phase !== "shooting") return state;
      return {
        ...state,
        ball: { ...state.ball, inFlight: true },
        phase: "shooting",
      };
    }

    case "SHOT_COMPLETE": {
      const result = action.result;
      const newShotsScored = state.shotsScored + (result.scored ? 1 : 0);
      const newShotsTaken = state.shotsTaken + 1;
      const newCombo = result.scored ? state.combo + 1 : 0;
      const newMaxCombo = Math.max(state.maxCombo, newCombo);

      // Score calculation
      const baseScore = result.scored ? 100 : 0;
      const comboBonus = newCombo > 1 ? (newCombo - 1) * 50 : 0;
      const mathBonus = result.mathCorrect ? 25 : 0;
      const multipliedScore = Math.round(
        (baseScore + comboBonus + mathBonus) * result.bonusMultiplier
      );
      const newScore = state.score + multipliedScore;

      // Particles and floating texts
      let newParticles: Particle[] = [];
      let newFloatingTexts: FloatingText[] = [];

      if (result.scored) {
        newParticles = createConfettiParticles(0.5, 0.3, 30);
        newFloatingTexts = [
          createFloatingText("¡GOL!", 0.5, 0.3, "#FFD700", "xl"),
        ];
        if (newCombo > 1) {
          newFloatingTexts.push(
            createFloatingText(`COMBO x${newCombo}!`, 0.5, 0.45, "#FF6B35", "lg")
          );
        }
        if (result.bonusMultiplier > 1.5) {
          newFloatingTexts.push(
            createFloatingText("¡ESQUINA! BONUS", 0.5, 0.55, "#7BED9F", "md")
          );
        }
      } else if (result.savedByKeeper) {
        newFloatingTexts = [createFloatingText("¡Atajada!", 0.5, 0.3, "#FF4757", "lg")];
      } else if (result.blockedByWall) {
        newFloatingTexts = [createFloatingText("¡Bloqueado!", 0.5, 0.3, "#FF6B35", "lg")];
      } else {
        newFloatingTexts = [createFloatingText("¡Afuera!", 0.5, 0.3, "#FF4757", "md")];
      }

      if (result.mathCorrect && result.scored) {
        newParticles = [...newParticles, ...createStarParticles(0.5, 0.5)];
      }

      const newChallenge = state.levelConfig ? generateChallenge(state.levelConfig) : null;

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
      };
    }

    case "NEXT_SHOT": {
      if (!state.levelConfig) return state;

      const { shotsScored, shotsTaken, levelConfig } = state;
      const shotsLeft = levelConfig.shotsAllowed - shotsTaken;

      if (shotsScored >= levelConfig.shotsRequired) {
        return { ...state, screen: "victory" };
      }

      if (shotsLeft <= 0) {
        return { ...state, screen: "defeat" };
      }

      return {
        ...state,
        phase: "aiming",
        targetCoord: null,
        lastShotResult: null,
        ball: createInitialBall(),
        floatingTexts: [],
      };
    }

    case "LEVEL_COMPLETE":
      return { ...state, screen: "victory" };

    case "LEVEL_FAILED":
      return { ...state, screen: "defeat" };

    case "UPDATE_PHYSICS": {
      // Update goalkeeper position
      if (!state.levelConfig) return state;
      return state; // Physics handled in component with requestAnimationFrame
    }

    case "ADD_PARTICLES":
      return { ...state, particles: [...state.particles, ...action.particles] };

    case "ADD_FLOATING_TEXT":
      return { ...state, floatingTexts: [...state.floatingTexts, action.text] };

    case "TICK_PARTICLES": {
      const dt = 0.016; // ~60fps
      const updatedParticles = state.particles
        .map((p) => ({
          ...p,
          x: p.x + p.vx * dt,
          y: p.y + p.vy * dt,
          vy: p.vy + 2 * dt, // gravity
          life: p.life - dt / p.maxLife,
        }))
        .filter((p) => p.life > 0);

      const updatedTexts = state.floatingTexts
        .map((t) => ({
          ...t,
          y: t.y - 0.5 * dt,
          life: t.life - dt / (t.maxLife * 1.5),
        }))
        .filter((t) => t.life > 0);

      return {
        ...state,
        particles: updatedParticles,
        floatingTexts: updatedTexts,
      };
    }

    case "RESET_GAME":
      return { ...initialGameState };

    default:
      return state;
  }
}
