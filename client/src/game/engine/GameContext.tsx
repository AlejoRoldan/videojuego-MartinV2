// =============================================================
// TIRO LIBRE MATEMÁTICO — Game Context v2
// FIXES: shoot flow race condition, sound triggers, state sync
// =============================================================

import React, { createContext, useContext, useReducer, useCallback, useRef, useEffect, useState } from "react";
import type { GameState, GameAction, Vec2 } from "./types";
import { gameReducer, initialGameState } from "./gameReducer";
import { resolveShotResult } from "./physics";
import { sounds } from "./soundSystem";

interface PlayerProfile {
  name: string;
  level: number;
  xp: number;
  coins: number;
  stars: number;
  totalGoals: number;
  totalShots: number;
  unlockedLevels: number[];
  completedLevels: Record<number, { stars: number; bestScore: number }>;
  achievements: string[];
}

const defaultProfile: PlayerProfile = {
  name: "Martín",
  level: 1,
  xp: 0,
  coins: 0,
  stars: 0,
  totalGoals: 0,
  totalShots: 0,
  unlockedLevels: [1],
  completedLevels: {},
  achievements: [],
};

function loadProfile(): PlayerProfile {
  try {
    const saved = localStorage.getItem("tlm_profile");
    if (saved) return { ...defaultProfile, ...JSON.parse(saved) };
  } catch {}
  return defaultProfile;
}

function saveProfile(profile: PlayerProfile) {
  try {
    localStorage.setItem("tlm_profile", JSON.stringify(profile));
  } catch {}
}

interface GameContextValue {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
  goToScreen: (screen: GameState["screen"]) => void;
  startLevel: (levelId: number) => void;
  setTarget: (coord: Vec2) => void;
  submitMath: (answer: number) => void;
  shoot: () => void;
  nextShot: () => void;
  resetGame: () => void;
  playerProfile: PlayerProfile;
  updateProfile: (updates: Partial<PlayerProfile>) => void;
}

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(gameReducer, initialGameState);
  const [playerProfile, setPlayerProfile] = useState<PlayerProfile>(loadProfile);

  // Always-current ref to state — avoids stale closure bugs
  const stateRef = useRef(state);
  stateRef.current = state;

  const shootTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mathSubmitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef(false);

  const updateProfile = useCallback((updates: Partial<PlayerProfile>) => {
    setPlayerProfile((prev) => {
      const next = { ...prev, ...updates };
      saveProfile(next);
      return next;
    });
  }, []);

  const goToScreen = useCallback((screen: GameState["screen"]) => {
    dispatch({ type: "SET_SCREEN", screen });
  }, []);

  const startLevel = useCallback((levelId: number) => {
    inFlightRef.current = false;
    dispatch({ type: "START_LEVEL", levelId });
  }, []);

  // setTarget: records the aiming coordinate.
  // For "directions" concept: immediately triggers shoot after short delay.
  // For other concepts: transitions to "math" phase.
  const setTarget = useCallback((coord: Vec2) => {
    dispatch({ type: "SET_TARGET", coord });
    const s = stateRef.current;
    if (s.levelConfig?.concept === "directions") {
      setTimeout(() => {
        dispatch({ type: "SHOOT" });
      }, 350);
    }
  }, []);

  // shoot: transitions ball to inFlight.
  // The useEffect below watches for inFlight and resolves the shot.
  const shoot = useCallback(() => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    dispatch({ type: "SHOOT" });
  }, []);

  // submitMath: records math answer, then triggers shoot after animation delay
  const submitMath = useCallback((answer: number) => {
    dispatch({ type: "SUBMIT_MATH", answer });
    if (mathSubmitTimerRef.current) clearTimeout(mathSubmitTimerRef.current);
    mathSubmitTimerRef.current = setTimeout(() => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      dispatch({ type: "SHOOT" });
    }, 500);
  }, []);

  // Resolve shot when ball enters flight
  useEffect(() => {
    if (state.phase !== "shooting" || !state.ball.inFlight) return;
    if (!state.targetCoord || !state.levelConfig) return;

    if (shootTimerRef.current) clearTimeout(shootTimerRef.current);

    // Wait for ball animation to play (~1.2s) then resolve
    shootTimerRef.current = setTimeout(() => {
      const s = stateRef.current;
      if (!s.targetCoord || !s.levelConfig) return;

      // Determine if math was answered correctly based on power
      // Power > 70 = correct answer was given
      const mathCorrect = s.ball.power > 70;

      const result = resolveShotResult(
        s.targetCoord,
        mathCorrect,
        s.ball.power,
        s.ball.spin,
        s.goalkeeper,
        s.wall,
        {
          keeperSpeed: s.levelConfig.keeperSpeed,
          wind: s.levelConfig.wind,
          windStrength: s.levelConfig.windStrength,
        }
      );

      dispatch({ type: "SHOT_COMPLETE", result });

      // Update player stats
      setPlayerProfile((prev) => {
        const next = {
          ...prev,
          totalGoals: prev.totalGoals + (result.scored ? 1 : 0),
          totalShots: prev.totalShots + 1,
        };
        saveProfile(next);
        return next;
      });
    }, 1200);

    return () => {
      if (shootTimerRef.current) clearTimeout(shootTimerRef.current);
    };
  }, [state.phase, state.ball.inFlight]);

  // Reset inFlightRef when phase returns to aiming
  useEffect(() => {
    if (state.phase === "aiming") {
      inFlightRef.current = false;
    }
  }, [state.phase]);

  // Particle tick loop
  useEffect(() => {
    if (state.particles.length === 0 && state.floatingTexts.length === 0) return;
    const id = setInterval(() => {
      dispatch({ type: "TICK_PARTICLES" });
    }, 50);
    return () => clearInterval(id);
  }, [state.particles.length, state.floatingTexts.length]);

  const nextShot = useCallback(() => {
    const s = stateRef.current;
    if (!s.levelConfig) return;

    const { shotsScored, shotsTaken, levelConfig, score } = s;
    const isWin = shotsScored >= levelConfig.shotsRequired;
    const isLoss = shotsTaken >= levelConfig.shotsAllowed && !isWin;

    if (isWin) {
      sounds.levelComplete();
      const shotsUsed = shotsTaken;
      const starsEarned =
        shotsUsed <= levelConfig.stars[2] ? 3
        : shotsUsed <= levelConfig.stars[1] ? 2
        : 1;

      const reward = levelConfig.rewards;

      setPlayerProfile((prev) => {
        const prevLevelData = prev.completedLevels[levelConfig.id];
        const prevStars = prevLevelData?.stars ?? 0;
        const newStars = Math.max(prevStars, starsEarned);
        const starDiff = newStars - prevStars;

        const newUnlocked = reward.unlocks
          ?.filter((u) => u.startsWith("level_"))
          .map((u) => parseInt(u.replace("level_", ""))) ?? [];

        const next = {
          ...prev,
          xp: prev.xp + reward.xp,
          coins: prev.coins + reward.coins,
          stars: prev.stars + starDiff,
          unlockedLevels: Array.from(new Set([...prev.unlockedLevels, ...newUnlocked])),
          completedLevels: {
            ...prev.completedLevels,
            [levelConfig.id]: {
              stars: newStars,
              bestScore: Math.max(score, prevLevelData?.bestScore ?? 0),
            },
          },
        };
        saveProfile(next);
        return next;
      });

      dispatch({ type: "LEVEL_COMPLETE" });
    } else if (isLoss) {
      sounds.levelFailed();
      dispatch({ type: "LEVEL_FAILED" });
    } else {
      dispatch({ type: "NEXT_SHOT" });
    }
  }, []);

  const resetGame = useCallback(() => {
    inFlightRef.current = false;
    dispatch({ type: "RESET_GAME" });
  }, []);

  return (
    <GameContext.Provider
      value={{
        state,
        dispatch,
        goToScreen,
        startLevel,
        setTarget,
        submitMath,
        shoot,
        nextShot,
        resetGame,
        playerProfile,
        updateProfile,
      }}
    >
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGame must be used within GameProvider");
  return ctx;
}
