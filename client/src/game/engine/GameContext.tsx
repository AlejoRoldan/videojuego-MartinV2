// =============================================================
// TIRO LIBRE MATEMÁTICO — Game Context v4
// Coordinates gameplay flow, progressive math assistance, retries and Math Powers
// =============================================================

import React, { createContext, useContext, useReducer, useCallback, useRef, useEffect, useState } from "react";
import type {
  GameState,
  GameAction,
  Vec2,
  KeeperSnapshot,
  FlowInterventionEvent,
  MathAnsweredEvent,
  ShotResolvedEvent,
} from "./types";
import { gameReducer, initialGameState } from "./gameReducer";
import { getLevelById } from "../levels/levelData";
import { createKeeperSnapshot, KEEPER_GOAL_Y, resolveShotResult } from "./physics";
import { sounds } from "./soundSystem";
import {
  getAssistanceThresholds,
  getAutoShootDelayMs,
  getInitialAssistanceStage,
  getRetrySeconds,
  getShotAnimationDuration,
  loadGamePace,
} from "./gamePace";
import { calculateRemainingMathTime, createGameplayEventId, resolveMathCorrect, scheduleAutoShoot } from "./gameFlow";
import { DEFAULT_PROFILE, loadProfile, saveProfile, type PlayerProfile } from "./profileMigration";
import { recordMasteryAttempt } from "./mastery";

interface GameContextValue {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
  goToScreen: (screen: GameState["screen"]) => void;
  startLevel: (levelId: number) => void;
  setTarget: (coord: Vec2) => void;
  setSpin: (spin: number) => void;
  submitMath: (answer: number, timeLeft?: number, usedRetry?: boolean) => void;
  shoot: (keeperSnapshot?: KeeperSnapshot) => void;
  updateKeeperSnapshot: (snapshot: KeeperSnapshot) => void;
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
  const directionShootTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const assistanceTimersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const mathStartedAtRef = useRef<number | null>(null);
  const inFlightRef = useRef(false);
  const keeperSnapshotRef = useRef<KeeperSnapshot>(createKeeperSnapshot({ x: 0.5, y: KEEPER_GOAL_Y }, 0.3));
  const sessionIdRef = useRef(`session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  const levelRunRef = useRef(0);

  const clearAssistanceTimers = useCallback(() => {
    assistanceTimersRef.current.forEach(clearTimeout);
    assistanceTimersRef.current = [];
  }, []);

  const updateProfile = useCallback((updates: Partial<PlayerProfile>) => {
    setPlayerProfile((prev) => {
      const next = { ...DEFAULT_PROFILE, ...prev, ...updates };
      saveProfile(next);
      return next;
    });
  }, []);
  const goToScreen = useCallback((screen: GameState["screen"]) => dispatch({ type: "SET_SCREEN", screen }), []);
  const startLevel = useCallback((levelId: number) => {
    inFlightRef.current = false;
    clearAssistanceTimers();
    if (directionShootTimerRef.current) clearTimeout(directionShootTimerRef.current);
    const config = getLevelById(levelId);
    if (config) {
      levelRunRef.current += 1;
      keeperSnapshotRef.current = createKeeperSnapshot(
        { x: 0.5, y: KEEPER_GOAL_Y },
        config.keeperSpeed,
        config.hasKeeper,
      );
    }
    dispatch({ type: "START_LEVEL", levelId });
  }, [clearAssistanceTimers]);

  const updateKeeperSnapshot = useCallback((snapshot: KeeperSnapshot) => {
    keeperSnapshotRef.current = {
      position: {
        x: Math.max(0, Math.min(1, snapshot.position.x)),
        y: Math.max(0, Math.min(1, snapshot.position.y)),
      },
      reach: Math.max(0, snapshot.reach),
    };
  }, []);

  const resolveCurrentShot = useCallback((keeperSnapshot?: KeeperSnapshot) => {
    if (inFlightRef.current) return;
    const s = stateRef.current;
    if (!s.targetCoord || !s.levelConfig) return;
    const mathCorrect = resolveMathCorrect(s.lastMathCorrect, s.levelConfig.concept);
    const result = resolveShotResult(
      s.targetCoord,
      mathCorrect,
      s.ball.power,
      s.ball.spin,
      s.goalkeeper,
      s.wall,
      {
        keeperSpeed: s.levelConfig.keeperSpeed,
        hasKeeper: s.levelConfig.hasKeeper,
        wind: s.levelConfig.wind,
        windStrength: s.levelConfig.windStrength,
        gridQuadrants: s.levelConfig.gridQuadrants,
      },
      s.currentMathPower,
      s.shotsTaken + 1,
      s.runtimeModifiers,
      keeperSnapshot ?? keeperSnapshotRef.current,
    );
    inFlightRef.current = true;
    dispatch({ type: "SHOOT", resolution: result });
  }, []);

  const setSpin = useCallback((spin: number) => {
    dispatch({ type: "SET_SPIN", spin });
  }, []);

  const setTarget = useCallback((coord: Vec2) => {
    dispatch({ type: "SET_TARGET", coord });
    const s = stateRef.current;
    if (s.levelConfig?.concept === "directions") {
      if (directionShootTimerRef.current) clearTimeout(directionShootTimerRef.current);
      directionShootTimerRef.current = scheduleAutoShoot({
        dispatch,
        isInFlight: () => inFlightRef.current,
        markInFlight: () => { inFlightRef.current = true; },
        onShoot: resolveCurrentShot,
        delayMs: 350,
      });
    }
  }, [resolveCurrentShot]);

  const shoot = useCallback((keeperSnapshot?: KeeperSnapshot) => {
    resolveCurrentShot(keeperSnapshot);
  }, [resolveCurrentShot]);

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

    const derivedTimeLeft = s.currentChallenge
      ? calculateRemainingMathTime(s.currentChallenge.timeLimit, mathStartedAtRef.current)
      : undefined;
    const effectiveTimeLeft = timeLeft ?? derivedTimeLeft;
    const responseTimeMs = s.currentChallenge && effectiveTimeLeft !== undefined
      ? Math.max(0, (s.currentChallenge.timeLimit - effectiveTimeLeft) * 1000)
      : 0;
    const assistanceStage = s.currentChallenge?.assistanceStage;
    const mathEvent: MathAnsweredEvent = {
      id: createGameplayEventId(sessionIdRef.current, levelRunRef.current, "math", s.shotsTaken + 1),
      schemaVersion: 1,
      type: "math_answered",
      occurredAt: new Date().toISOString(),
      sessionId: sessionIdRef.current,
      levelId: s.currentLevel ?? undefined,
      worldId: s.levelConfig?.worldId,
      domain: s.currentChallenge?.type ?? "multiplication",
      correct: answer === s.currentChallenge?.answer,
      responseTimeMs,
      assistanceStage: assistanceStage === "hint" || assistanceStage === "visual" || assistanceStage === "urgent" ? assistanceStage : "none",
      usedRetry: usedRetry ?? s.currentChallenge?.retryGranted ?? false,
      difficulty: s.levelConfig?.mathDifficulty ?? "easy",
    };

    clearAssistanceTimers();
    mathStartedAtRef.current = null;
    dispatch({ type: "SUBMIT_MATH", answer, timeLeft: effectiveTimeLeft, responseTimeMs, usedRetry: usedRetry ?? s.currentChallenge?.retryGranted ?? false, event: mathEvent });
    if (mathSubmitTimerRef.current) clearTimeout(mathSubmitTimerRef.current);
    mathSubmitTimerRef.current = null;

    // Arcade levels return to aiming after the math boost so the player can
    // choose spin and commit the shot manually. Direction levels keep their
    // compact auto-shot flow because the target itself is the answer.
    if (s.levelConfig?.concept === "directions") {
      mathSubmitTimerRef.current = scheduleAutoShoot({
        dispatch,
        isInFlight: () => inFlightRef.current,
        markInFlight: () => { inFlightRef.current = true; },
        onShoot: resolveCurrentShot,
        delayMs: getAutoShootDelayMs(loadGamePace()),
      });
    }
  }, [clearAssistanceTimers, resolveCurrentShot]);

  useEffect(() => {
    clearAssistanceTimers();
    if (state.phase !== "math" || !state.currentChallenge) {
      mathStartedAtRef.current = null;
      return;
    }
    mathStartedAtRef.current = Date.now();
    if (state.currentChallenge.retryGranted) return;
    const timeLimit = state.currentChallenge.timeLimit;
    const assistanceLeadSeconds = state.runtimeModifiers.assistanceLeadSeconds;
    const initialStage = getInitialAssistanceStage(timeLimit, assistanceLeadSeconds);
    const assistanceThresholds = getAssistanceThresholds(timeLimit);
    if (initialStage === "hint") dispatch({ type: "MATH_ASSISTANCE", stage: "hint" });
    if (initialStage === "visual") dispatch({ type: "MATH_ASSISTANCE", stage: "visual" });
    if (initialStage === "urgent") dispatch({ type: "MATH_ASSISTANCE", stage: "urgent" });
    const scheduleStage = (stage: "hint" | "visual" | "urgent", remainingSeconds: number) => {
      const effectiveRemainingSeconds = remainingSeconds + assistanceLeadSeconds;
      if (timeLimit <= effectiveRemainingSeconds) return;
      const timer = setTimeout(() => {
        const current = stateRef.current;
        if (current.phase === "math" && !current.currentChallenge?.retryGranted) dispatch({ type: "MATH_ASSISTANCE", stage });
      }, (timeLimit - effectiveRemainingSeconds) * 1000);
      assistanceTimersRef.current.push(timer);
    };
    scheduleStage("hint", assistanceThresholds.hint);
    scheduleStage("visual", assistanceThresholds.visual);
    scheduleStage("urgent", assistanceThresholds.urgent);
    return clearAssistanceTimers;
  }, [state.phase, state.currentChallenge?.question, state.currentChallenge?.timeLimit, state.currentChallenge?.retryGranted, state.runtimeModifiers.assistanceLeadSeconds, clearAssistanceTimers]);

  useEffect(() => {
    if (state.phase !== "shooting" || !state.ball.inFlight || !state.lastShotResult) return;
    if (shootTimerRef.current) clearTimeout(shootTimerRef.current);
    const result = state.lastShotResult;
    const animationDuration = getShotAnimationDuration(loadGamePace(), result.input.mathPower);
    const shotEvent: ShotResolvedEvent = {
      id: createGameplayEventId(sessionIdRef.current, levelRunRef.current, "shot", state.shotsTaken + 1),
      schemaVersion: 1,
      type: "shot_resolved",
      occurredAt: new Date().toISOString(),
      sessionId: sessionIdRef.current,
      levelId: state.currentLevel ?? undefined,
      worldId: state.levelConfig?.worldId,
      mathCorrect: result.mathCorrect,
      targetCoord: result.targetCoord,
      actualCoord: result.actualCoord,
      outcome: result.outcome,
      reasonCode: result.reasonCode,
      mathPower: result.input.mathPower,
      footballDifficulty: result.input.keeper.reach,
    };
    shootTimerRef.current = setTimeout(() => {
      dispatch({ type: "SHOT_COMPLETE", result, events: [shotEvent] });
      const scored = result.scored ? 1 : 0;
      const missionComplete = scored === 1 && playerProfile.missionProgress === 2;
      if (missionComplete) {
        sounds.coinEarned();
        sounds.missionComplete();
      }
      const masteryAttempt = state.currentChallenge && state.lastMathResponseTimeMs !== null
        ? {
          domain: state.currentChallenge.type,
          correct: result.mathCorrect,
          responseTimeMs: state.lastMathResponseTimeMs,
          assistanceStage: state.currentChallenge.assistanceStage === "hint"
            || state.currentChallenge.assistanceStage === "visual"
            || state.currentChallenge.assistanceStage === "urgent"
            ? state.currentChallenge.assistanceStage
            : "none" as const,
          usedRetry: Boolean(state.currentChallenge.retryGranted),
          occurredAt: shotEvent.occurredAt,
        }
        : null;
      setPlayerProfile((prev) => {
        const nextMissionProgress = (prev.missionProgress + scored) % 3;
        const mastery = masteryAttempt
          ? recordMasteryAttempt(prev.masteryByDomain, prev.masteryHistory, masteryAttempt)
          : { masteryByDomain: prev.masteryByDomain, masteryHistory: prev.masteryHistory };
        const next = {
          ...prev,
          totalGoals: prev.totalGoals + scored,
          totalShots: prev.totalShots + 1,
          missionProgress: nextMissionProgress,
          missionCompletions: prev.missionCompletions + (missionComplete ? 1 : 0),
          coins: prev.coins + (missionComplete ? 15 : 0),
          stars: prev.stars + (missionComplete ? 1 : 0),
          masteryByDomain: mastery.masteryByDomain,
          masteryHistory: mastery.masteryHistory,
        };
        saveProfile(next); return next;
      });
    }, animationDuration);
    return () => { if (shootTimerRef.current) clearTimeout(shootTimerRef.current); };
  }, [state.phase, state.ball.inFlight, state.lastShotResult]);

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
    if (directionShootTimerRef.current) clearTimeout(directionShootTimerRef.current);
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
    } else {
      const intervention = s.pendingFlowIntervention;
      const flowEvent: FlowInterventionEvent | undefined = intervention
        ? {
          id: createGameplayEventId(sessionIdRef.current, levelRunRef.current, "flow", s.shotsTaken),
          schemaVersion: 1,
          type: "flow_intervention",
          occurredAt: new Date().toISOString(),
          sessionId: sessionIdRef.current,
          levelId: s.currentLevel ?? undefined,
          worldId: s.levelConfig?.worldId,
          trigger: intervention.trigger,
          axis: intervention.axis,
          change: intervention.change,
          windowMathSuccessRate: intervention.windowMathSuccessRate,
          windowFootballSuccessRate: intervention.windowFootballSuccessRate,
        }
        : undefined;
      dispatch({ type: "NEXT_SHOT", flowEvent });
    }
  }, []);

  const resetGame = useCallback(() => {
    inFlightRef.current = false;
    clearAssistanceTimers();
    if (directionShootTimerRef.current) clearTimeout(directionShootTimerRef.current);
    dispatch({ type: "RESET_GAME" });
  }, [clearAssistanceTimers]);

  return <GameContext.Provider value={{ state, dispatch, goToScreen, startLevel, setTarget, setSpin, submitMath, shoot, updateKeeperSnapshot, nextShot, resetGame, playerProfile, updateProfile }}>{children}</GameContext.Provider>;
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGame must be used within GameProvider");
  return ctx;
}
