// =============================================================
// TIRO LIBRE MATEMÁTICO — Game Context v4
// Coordinates gameplay flow, progressive math assistance, retries and Math Powers
// =============================================================

import React, { createContext, useContext, useReducer, useCallback, useRef, useEffect, useState } from "react";
import type { GameState, GameAction, Vec2 } from "./types";
import { gameReducer, initialGameState } from "./gameReducer";
import { resolveShotResult } from "./physics";
import { sounds } from "./soundSystem";
import { ASSISTANCE_THRESHOLDS, getMathAssistanceStage, getRetrySeconds, loadGamePace } from "./gamePace";

interface PlayerProfile {
  name: string; level: number; xp: number; coins: number; stars: number;
  totalGoals: number; totalShots: number; unlockedLevels: number[];
  completedLevels: Record<number, { stars: number; bestScore: number }>;
  achievements: string[];
}

const defaultProfile: PlayerProfile = {
  name: "Martín", level: 1, xp: 0, coins: 0, stars: 0, totalGoals: 0, totalShots: 0,
  unlockedLevels: [1], completedLevels: {}, achievements: [],
};

function loadProfile(): PlayerProfile {
  try {
    const saved = localStorage.getItem("tlm_profile");
    if (saved) return { ...defaultProfile, ...JSON.parse(saved) };
  } catch {}
  return defaultProfile;
}
function saveProfile(profile: PlayerProfile) { try { localStorage.setItem("tlm_profile", JSON.stringify(profile)); } catch {} }

interface GameContextValue {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
  goToScreen: (screen: GameState["screen"]) => void;
  startLevel: (levelId: number) => void;
  setTarget: (coord: Vec2) => void;
  submitMath: (answer: number, timeLeft?: number, usedRetry?: boolean) => void;
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
  const stateRef = useRef(state); stateRef.current = state;
  const shootTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mathSubmitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const assistanceTimersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const mathStartedAtRef = useRef<number | null>(null);
  const inFlightRef = useRef(false);

  const clearAssistanceTimers = useCallback(() => {
    assistanceTimersRef.current.forEach(clearTimeout);
    assistanceTimersRef.current = [];
  }, []);

  const updateProfile = useCallback((updates: Partial<PlayerProfile>) => {
    setPlayerProfile((prev) => { const next = { ...prev, ...updates }; saveProfile(next); return next; });
  }, []);
  const goToScreen = useCallback((screen: GameState["screen"]) => dispatch({ type: "SET_SCREEN", screen }), []);
  const startLevel = useCallback((levelId: number) => {
    inFlightRef.current = false; clearAssistanceTimers(); dispatch({ type: "START_LEVEL", levelId });
  }, [clearAssistanceTimers]);

  const setTarget = useCallback((coord: Vec2) => {
    dispatch({ type: "SET_TARGET", coord });
    const s = stateRef.current;
    if (s.levelConfig?.concept === "directions") setTimeout(() => dispatch({ type: "SHOOT" }), 350);
  }, []);

  const shoot = useCallback(() => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    dispatch({ type: "SHOOT" });
  }, []);

  const submitMath = useCallback((answer: number, timeLeft?: number, usedRetry?: boolean) => {
    const s = stateRef.current;
    if (answer === -999 && s.phase === "math" && s.currentChallenge) {
      const pace = loadGamePace();
      const retrySeconds = getRetrySeconds(pace, Boolean(s.currentChallenge.retryGranted));
      if (retrySeconds > 0) {
        clearAssistanceTimers();
        mathStartedAtRef.current = Date.now();
        dispatch({ type: "GRANT_MATH_RETRY", seconds: retrySeconds });
        return;
      }
    }

    const elapsedSeconds = mathStartedAtRef.current === null ? 0 : (Date.now() - mathStartedAtRef.current) / 1000;
    const derivedTimeLeft = s.currentChallenge
      ? Math.max(0, s.currentChallenge.timeLimit - elapsedSeconds)
      : undefined;
    const effectiveTimeLeft = timeLeft ?? derivedTimeLeft;

    clearAssistanceTimers();
    mathStartedAtRef.current = null;
    dispatch({ type: "SUBMIT_MATH", answer, timeLeft: effectiveTimeLeft, usedRetry: usedRetry ?? s.currentChallenge?.retryGranted ?? false });
    if (mathSubmitTimerRef.current) clearTimeout(mathSubmitTimerRef.current);
    mathSubmitTimerRef.current = setTimeout(() => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      dispatch({ type: "SHOOT" });
    }, 850);
  }, [clearAssistanceTimers]);

  useEffect(() => {
    clearAssistanceTimers();
    if (state.phase !== "math" || !state.currentChallenge) {
      mathStartedAtRef.current = null;
      return;
    }
    mathStartedAtRef.current = Date.now();
    if (state.currentChallenge.retryGranted) return;
    const timeLimit = state.currentChallenge.timeLimit;
    const initialStage = getMathAssistanceStage(timeLimit);
    if (initialStage === "hint") dispatch({ type: "MATH_ASSISTANCE", stage: "hint" });
    if (initialStage === "visual") dispatch({ type: "MATH_ASSISTANCE", stage: "visual" });
    if (initialStage === "urgent") dispatch({ type: "MATH_ASSISTANCE", stage: "urgent" });
    const scheduleStage = (stage: "hint" | "visual" | "urgent", remainingSeconds: number) => {
      if (timeLimit <= remainingSeconds) return;
      const timer = setTimeout(() => {
        const current = stateRef.current;
        if (current.phase === "math" && !current.currentChallenge?.retryGranted) dispatch({ type: "MATH_ASSISTANCE", stage });
      }, (timeLimit - remainingSeconds) * 1000);
      assistanceTimersRef.current.push(timer);
    };
    scheduleStage("hint", ASSISTANCE_THRESHOLDS.hint);
    scheduleStage("visual", ASSISTANCE_THRESHOLDS.visual);
    scheduleStage("urgent", ASSISTANCE_THRESHOLDS.urgent);
    return clearAssistanceTimers;
  }, [state.phase, state.currentChallenge?.question, state.currentChallenge?.timeLimit, state.currentChallenge?.retryGranted, clearAssistanceTimers]);

  useEffect(() => {
    if (state.phase !== "shooting" || !state.ball.inFlight || !state.targetCoord || !state.levelConfig) return;
    if (shootTimerRef.current) clearTimeout(shootTimerRef.current);
    shootTimerRef.current = setTimeout(() => {
      const s = stateRef.current;
      if (!s.targetCoord || !s.levelConfig) return;
      const mathCorrect = s.ball.power > 70;
      const result = resolveShotResult(
        s.targetCoord, mathCorrect, s.ball.power, s.ball.spin, s.goalkeeper, s.wall,
        { keeperSpeed: s.levelConfig.keeperSpeed, wind: s.levelConfig.wind, windStrength: s.levelConfig.windStrength },
        s.currentMathPower
      );
      dispatch({ type: "SHOT_COMPLETE", result });
      setPlayerProfile((prev) => {
        const next = { ...prev, totalGoals: prev.totalGoals + (result.scored ? 1 : 0), totalShots: prev.totalShots + 1 };
        saveProfile(next); return next;
      });
    }, state.currentMathPower === "perfect" ? 1500 : state.currentMathPower === "turbo" ? 900 : 1200);
    return () => { if (shootTimerRef.current) clearTimeout(shootTimerRef.current); };
  }, [state.phase, state.ball.inFlight, state.currentMathPower]);

  useEffect(() => { if (state.phase === "aiming") inFlightRef.current = false; }, [state.phase]);
  useEffect(() => {
    if (state.particles.length === 0 && state.floatingTexts.length === 0) return;
    const id = setInterval(() => dispatch({ type: "TICK_PARTICLES" }), 50);
    return () => clearInterval(id);
  }, [state.particles.length, state.floatingTexts.length]);
  useEffect(() => () => {
    clearAssistanceTimers();
    if (mathSubmitTimerRef.current) clearTimeout(mathSubmitTimerRef.current);
    if (shootTimerRef.current) clearTimeout(shootTimerRef.current);
  }, [clearAssistanceTimers]);

  const nextShot = useCallback(() => {
    const s = stateRef.current;
    if (!s.levelConfig) return;
    const { shotsScored, shotsTaken, levelConfig, score } = s;
    const isWin = shotsScored >= levelConfig.shotsRequired;
    const isLoss = shotsTaken >= levelConfig.shotsAllowed && !isWin;
    if (isWin) {
      sounds.levelComplete();
      const starsEarned = shotsTaken <= levelConfig.stars[2] ? 3 : shotsTaken <= levelConfig.stars[1] ? 2 : 1;
      const reward = levelConfig.rewards;
      setPlayerProfile((prev) => {
        const prevLevelData = prev.completedLevels[levelConfig.id];
        const prevStars = prevLevelData?.stars ?? 0;
        const newStars = Math.max(prevStars, starsEarned);
        const newUnlocked = reward.unlocks?.filter((u) => u.startsWith("level_")).map((u) => parseInt(u.replace("level_", ""))) ?? [];
        const next = {
          ...prev, xp: prev.xp + reward.xp, coins: prev.coins + reward.coins,
          stars: prev.stars + (newStars - prevStars),
          unlockedLevels: Array.from(new Set([...prev.unlockedLevels, ...newUnlocked])),
          completedLevels: { ...prev.completedLevels, [levelConfig.id]: { stars: newStars, bestScore: Math.max(score, prevLevelData?.bestScore ?? 0) } },
        };
        saveProfile(next); return next;
      });
      dispatch({ type: "LEVEL_COMPLETE" });
    } else if (isLoss) {
      sounds.levelFailed(); dispatch({ type: "LEVEL_FAILED" });
    } else dispatch({ type: "NEXT_SHOT" });
  }, []);

  const resetGame = useCallback(() => { inFlightRef.current = false; clearAssistanceTimers(); dispatch({ type: "RESET_GAME" }); }, [clearAssistanceTimers]);

  return <GameContext.Provider value={{ state, dispatch, goToScreen, startLevel, setTarget, submitMath, shoot, nextShot, resetGame, playerProfile, updateProfile }}>{children}</GameContext.Provider>;
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGame must be used within GameProvider");
  return ctx;
}
