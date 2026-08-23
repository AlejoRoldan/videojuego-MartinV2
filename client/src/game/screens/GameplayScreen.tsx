// =============================================================
// TIRO LIBRE MATEMÁTICO — Gameplay Screen v5
// Design: Pixel Champions — FIXED VIEWPORT
// LAYOUT (100dvh total):
//   HUD:       ~18% (top bar + progress)
//   GOAL:      ~58% (dominant — portería limpia y enfocada)
//   BOTTOM:    ~24% (instrucción + botón tirar / resultado)
// KEY FIXES v6:
//   - height: 100dvh on root container (not minHeight)
//   - Goal section uses flex-grow with explicit height calc
//   - No empty space — portería fills the screen
//   - Transparent target zones preserve coordinates without a visible mesh
//   - Selected zone glows orange with a restrained ring
//   - Math panel is absolute overlay (not flex child)
//   - Shoot button is large (min 56px height) for mobile
// =============================================================

import { motion, AnimatePresence } from "framer-motion";
import { useGame } from "../engine/GameContext";
import { useEffect, useRef, useState, useCallback } from "react";
import { ArrowLeft, Zap } from "lucide-react";
import type { FloatingText, MathPower, Particle, ShotReasonCode, Vec2 } from "../engine/types";
import { createKeeperSnapshot } from "../engine/physics";
import { sounds } from "../engine/soundSystem";
import { MATH_POWER_META, PERFECT_STREAK_TARGET } from "../engine/mathPowers";
import { getResultTransitionMs, getShotAnimationDuration, loadGamePace } from "../engine/gamePace";
import { MicrovictoryBurst } from "./MicrovictoryBurst";

const GOAL_BG = "/goal-night-teen.webp";
const KEEPER_IMG = "https://d2xsxph8kpxj0f.cloudfront.net/310519663638628604/YvKFUvGtEph4XyT2Rde5AJ/goalkeeper-cartoon-guVkhrpZ7AvWXKeLYUUChv.webp";
const BALL_IMG = "https://d2xsxph8kpxj0f.cloudfront.net/310519663638628604/YvKFUvGtEph4XyT2Rde5AJ/game-ball-2LkvtN9uYqK7nNkN7H9vMM.webp";

const POWER_VISUALS: Record<Exclude<MathPower, null>, { accent: string; glow: string; trail: string }> = {
  precision: { accent: "#7BED9F", glow: "rgba(123,237,159,.75)", trail: "#7BED9F" },
  curve: { accent: "#B388FF", glow: "rgba(179,136,255,.78)", trail: "#B388FF" },
  turbo: { accent: "#4DD0E1", glow: "rgba(77,208,225,.82)", trail: "#4DD0E1" },
  perfect: { accent: "#FFD700", glow: "rgba(255,215,0,.9)", trail: "#FFF3A3" },
};

function getReasonLabel(reasonCode: ShotReasonCode): string {
  switch (reasonCode) {
    case "clean_target": return "El balón siguió la celda elegida.";
    case "reduced_accuracy": return "La respuesta incorrecta redujo la precisión.";
    case "wind_drift": return "El viento movió el balón antes de llegar.";
    case "keeper_reach": return "El punto quedó al alcance del portero.";
    case "wall_block": return "La trayectoria cruzó la zona de la barrera.";
    case "outside_goal": return "El destino terminó fuera de la portería.";
  }
}

export default function GameplayScreen() {
  const { state, goToScreen, setTarget, submitMath, nextShot, shoot, updateKeeperSnapshot, playerProfile } = useGame();
  const {
    levelConfig, phase, currentChallenge, shotsScored, shotsTaken,
    score, combo, targetCoord, lastShotResult, ball, adaptiveDifficulty,
    currentMathPower, perfectStreak, mathPowerSequence,
    runtimeModifiers, pendingFlowIntervention,
  } = state;

  const [ballPos, setBallPos] = useState({ x: 50, y: 85 });
  const [mathTimeLeft, setMathTimeLeft] = useState(15);
  const [keeperX, setKeeperX] = useState(50);
  const [shotFeedback, setShotFeedback] = useState<"flash" | "impact" | null>(null);
  const keeperXRef = useRef(50);
  const missionCompletionCueRef = useRef(playerProfile.missionCompletions);
  const flightPower = lastShotResult?.input.mathPower;
  const powerVisual = flightPower ? POWER_VISUALS[flightPower] : null;
  const missionCompletedThisShot = phase === "result"
    && Boolean(lastShotResult?.scored)
    && playerProfile.missionCompletions > missionCompletionCueRef.current;
  const burstKind = phase === "result" && lastShotResult
    ? missionCompletedThisShot
      ? "mission"
      : lastShotResult.mathCorrect && lastShotResult.input.mathPower === "perfect"
        ? "perfect"
        : lastShotResult.scored
          ? "goal"
          : lastShotResult.input.mathPower
            ? "power"
            : null
    : null;

  const animFrameRef = useRef<number>(0);
  const keeperDirRef = useRef(1);
  const lastTimeRef = useRef(0);
  const mathTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resultTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shotFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasShot = useRef(false);
  const shotCueRef = useRef<string | null>(null);
  const lastPowerCueRef = useRef(0);
  const perfectStreakCueRef = useRef(false);

  if (!levelConfig) return null;

  const gridMax = 3;
  const gridMin = levelConfig.gridQuadrants === 4 ? -3 : 1;
  const isDirections = levelConfig.concept === "directions";
  const cols = gridMax - gridMin + 1;
  const rows = gridMax - gridMin + 1;

  const progressPct = Math.min(100, (shotsScored / levelConfig.shotsRequired) * 100);
  const evaluatedKeeperX = lastShotResult?.input.keeper.position.x;
  const keeperDisplayX = phase === "shooting" || phase === "result"
    ? (evaluatedKeeperX ?? keeperX / 100) * 100
    : keeperX;
  const flowNotice = pendingFlowIntervention
    ? pendingFlowIntervention.trigger === "math_struggle"
      ? "Te damos una ayuda extra para pensar."
      : pendingFlowIntervention.trigger === "football_struggle"
        ? "Ajustamos el reto futbolístico; tu matemática sigue contando."
        : pendingFlowIntervention.trigger === "recovery"
          ? "Tiro de recuperación: mantienes el mismo concepto matemático."
          : "¡Gran dominio! El próximo tiro tendrá un reto futbolístico mayor."
    : runtimeModifiers.assistanceLeadSeconds > 0
      ? "La ayuda aparecerá un poco antes para acompañarte."
      : null;

  // Build grid coordinates: top-left = (gridMin, gridMax), bottom-right = (gridMax, gridMin)
  const gridCoords: Vec2[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = gridMin + col;
      const y = gridMax - row;
      gridCoords.push({ x, y });
    }
  }

  const clearShotFeedback = useCallback(() => {
    if (shotFeedbackTimerRef.current) clearTimeout(shotFeedbackTimerRef.current);
    shotFeedbackTimerRef.current = null;
    setShotFeedback(null);
  }, []);

  const triggerShotFeedback = useCallback((feedback: "flash" | "impact", durationMs: number) => {
    if (shotFeedbackTimerRef.current) clearTimeout(shotFeedbackTimerRef.current);
    setShotFeedback(feedback);
    shotFeedbackTimerRef.current = setTimeout(() => {
      setShotFeedback(null);
      shotFeedbackTimerRef.current = null;
    }, durationMs);
  }, []);

  // ── Init sounds on mount ─────────────────────────────────
  useEffect(() => {
    sounds.init();
    return clearShotFeedback;
  }, [clearShotFeedback]);

  // ── Reset hasShot on new phase ───────────────────────────
  useEffect(() => {
    if (phase === "aiming") {
      hasShot.current = false;
      shotCueRef.current = null;
    }
  }, [phase]);

  // ── Mission completion cue tracks the persisted reward transition. ──
  useEffect(() => {
    if (phase === "result" && playerProfile.missionCompletions > missionCompletionCueRef.current) {
      missionCompletionCueRef.current = playerProfile.missionCompletions;
    }
  }, [phase, playerProfile.missionCompletions]);

  // ── Math Power feedback ───────────────────────────────────
  useEffect(() => {
    if (perfectStreak < PERFECT_STREAK_TARGET) perfectStreakCueRef.current = false;
    if (!currentMathPower || mathPowerSequence === 0 || lastPowerCueRef.current === mathPowerSequence) return;
    lastPowerCueRef.current = mathPowerSequence;
    sounds.power(currentMathPower);
    if (perfectStreak >= PERFECT_STREAK_TARGET && !perfectStreakCueRef.current) {
      perfectStreakCueRef.current = true;
      sounds.perfectStreak();
    }
  }, [currentMathPower, mathPowerSequence, perfectStreak]);

  // ── Goalkeeper snapshot and animation ─────────────────────
  useEffect(() => {
    keeperXRef.current = 50;
    keeperDirRef.current = 1;
    setKeeperX(50);
    updateKeeperSnapshot(createKeeperSnapshot(
      { x: 0.5, y: 0.5 },
      levelConfig.keeperSpeed,
      levelConfig.hasKeeper,
    ));
  }, [levelConfig.id, levelConfig.hasKeeper, levelConfig.keeperSpeed, updateKeeperSnapshot]);

  useEffect(() => {
    if (!levelConfig.hasKeeper) return;
    if (phase !== "aiming" && phase !== "math") return;
    let animId: number;
    const speed = levelConfig.keeperSpeed;
    const animate = (time: number) => {
      const dt = Math.min((time - lastTimeRef.current) / 1000, 0.05);
      lastTimeRef.current = time;
      if (dt > 0) {
        let next = keeperXRef.current + keeperDirRef.current * speed * dt * 60;
        if (next > 82) { next = 82; keeperDirRef.current = -1; }
        if (next < 18) { next = 18; keeperDirRef.current = 1; }
        keeperXRef.current = next;
        setKeeperX(next);
        updateKeeperSnapshot(createKeeperSnapshot(
          { x: next / 100, y: 0.5 },
          levelConfig.keeperSpeed,
          levelConfig.hasKeeper,
        ));
      }
      animId = requestAnimationFrame(animate);
    };
    animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
  }, [phase, levelConfig.hasKeeper, levelConfig.keeperSpeed, updateKeeperSnapshot]);

  // ── Ball trajectory animation ────────────────────────────
  // The visual path uses the same duration as the engine timeout. This avoids
  // a slow one-point-per-frame flight that can outlive a faster match rhythm.
  useEffect(() => {
    if (phase !== "shooting" || !ball.inFlight || !lastShotResult) return;

    const shotKey = `${lastShotResult.input.seed}:${lastShotResult.targetCoord.x}:${lastShotResult.targetCoord.y}`;
    if (shotCueRef.current !== shotKey) {
      shotCueRef.current = shotKey;
      sounds.whoosh();
      sounds.kick();
      triggerShotFeedback("flash", 180);
    }

    const trajectory = lastShotResult.trajectoryPoints;
    const durationMs = getShotAnimationDuration(loadGamePace(), lastShotResult.input.mathPower);
    const startedAt = performance.now();
    const animateBall = (now: number) => {
      const progress = Math.min(1, Math.max(0, (now - startedAt) / durationMs));
      const segment = progress * (trajectory.length - 1);
      const lowerIndex = Math.floor(segment);
      const upperIndex = Math.min(trajectory.length - 1, lowerIndex + 1);
      const blend = segment - lowerIndex;
      const from = trajectory[lowerIndex];
      const to = trajectory[upperIndex];
      const point = {
        x: from.x + (to.x - from.x) * blend,
        y: from.y + (to.y - from.y) * blend,
      };
      setBallPos({ x: point.x * 100, y: point.y * 100 });
      if (progress < 1) animFrameRef.current = requestAnimationFrame(animateBall);
    };
    animFrameRef.current = requestAnimationFrame(animateBall);
    return () => { cancelAnimationFrame(animFrameRef.current); };
  }, [phase, ball.inFlight, lastShotResult, triggerShotFeedback]);

  // ── Play result sound + auto-advance ────────────────────
  useEffect(() => {
    if (phase !== "result" || !lastShotResult) return;
    triggerShotFeedback("impact", 190);
    if (lastShotResult.scored) {
      sounds.goal();
      if (combo > 1) setTimeout(() => sounds.combo(), 400);
    } else if (lastShotResult.savedByKeeper) {
      sounds.save();
    } else if (lastShotResult.blockedByWall) {
      sounds.wall();
    } else {
      sounds.miss();
    }
    resultTimerRef.current = setTimeout(() => {
      setBallPos({ x: 50, y: 85 });
      nextShot();
    }, getResultTransitionMs(loadGamePace(), lastShotResult.input.mathPower === "perfect"));
    return () => { if (resultTimerRef.current) clearTimeout(resultTimerRef.current); };
  }, [phase, lastShotResult, triggerShotFeedback]);

  // ── Manual next shot (tap on result overlay) ─────────────
  const handleNextShot = useCallback(() => {
    if (phase !== "result") return;
    if (resultTimerRef.current) {
      clearTimeout(resultTimerRef.current);
      resultTimerRef.current = null;
    }
    clearShotFeedback();
    setBallPos({ x: 50, y: 85 });
    sounds.click();
    nextShot();
  }, [phase, nextShot, clearShotFeedback]);

  // ── Math timer ───────────────────────────────────────────
  useEffect(() => {
    if (phase !== "math" || !currentChallenge) return;
    setMathTimeLeft(currentChallenge.timeLimit);
    if (mathTimerRef.current) clearInterval(mathTimerRef.current);
    mathTimerRef.current = setInterval(() => {
      setMathTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(mathTimerRef.current!);
          sounds.wrong();
          submitMath(-999);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => { if (mathTimerRef.current) clearInterval(mathTimerRef.current); };
  }, [phase, currentChallenge?.question]);

  // ── Handle grid cell tap ─────────────────────────────────
  const handleCellTap = useCallback((x: number, y: number) => {
    if (phase !== "aiming") return;
    sounds.aim();
    setTarget({ x, y });
  }, [phase, setTarget]);

  // ── Shoot button handler ─────────────────────────────────
  const handleShoot = useCallback(() => {
    if (hasShot.current) return;
    hasShot.current = true;
    sounds.click();
    const keeperSnapshot = createKeeperSnapshot(
      { x: keeperXRef.current / 100, y: 0.5 },
      levelConfig.keeperSpeed,
      levelConfig.hasKeeper,
    );
    updateKeeperSnapshot(keeperSnapshot);
    shoot(keeperSnapshot);
  }, [levelConfig.hasKeeper, levelConfig.keeperSpeed, shoot, updateKeeperSnapshot]);

  return (
    <div
      className={shotFeedback === "impact" ? "shot-microimpact" : undefined}
      style={{
        position: "fixed",
        top: 0, left: 0, right: 0, bottom: 0,
        width: "100%",
        height: "100dvh",
        display: "flex",
        flexDirection: "column",
        background: "linear-gradient(180deg, #050A18 0%, #07152A 42%, #092C32 72%, #071219 100%)",
        overflow: "hidden",
        maxWidth: "430px",
        margin: "0 auto",
      }}
    >
      {/* ── TOP HUD (fixed height ~18%) ── */}
      <div
        style={{
          flexShrink: 0,
          paddingTop: "max(8px, env(safe-area-inset-top, 8px))",
          paddingLeft: 12,
          paddingRight: 12,
          paddingBottom: 6,
          zIndex: 20,
        }}
      >
        {/* Row 1: back + level name + score */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <button
            onClick={() => { sounds.click(); goToScreen("level-select"); }}
            aria-label="Volver a seleccionar nivel"
            style={{
              width: 44, height: 44, borderRadius: 12, flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "rgba(255,255,255,0.12)",
              border: "2px solid rgba(255,255,255,0.25)",
              touchAction: "manipulation",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            <ArrowLeft style={{ width: 20, height: 20, color: "white" }} />
          </button>

          <div style={{ flex: 1, textAlign: "center" }}>
            <div style={{
              color: "white", fontFamily: "'Fredoka One', cursive",
              fontWeight: 900, fontSize: 15, lineHeight: 1.2,
            }}>
              Nv.{levelConfig.id} — {levelConfig.name}
            </div>
          </div>

          <div style={{
            padding: "6px 12px", borderRadius: 12, minWidth: 64, textAlign: "center",
            background: "rgba(255,215,0,0.15)", border: "2px solid #FFD700",
          }}>
            <span style={{ color: "#FFD700", fontFamily: "'Fredoka One', cursive", fontWeight: 900, fontSize: 15 }}>
              {score.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Row 2: shot dots + progress bar + goal count */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ display: "flex", gap: 4 }}>
            {Array.from({ length: levelConfig.shotsAllowed }).map((_, i) => (
              <div key={i} style={{
                width: 14, height: 14, borderRadius: "50%",
                background: i < shotsTaken
                  ? (i < shotsScored ? "#2ECC40" : "#FF4757")
                  : "rgba(255,255,255,0.2)",
                border: "1.5px solid rgba(255,255,255,0.3)",
                transition: "background 0.3s",
              }} />
            ))}
          </div>
          <div style={{ flex: 1, height: 10, borderRadius: 99, overflow: "hidden", background: "rgba(255,255,255,0.1)" }}>
            <motion.div
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
              style={{ height: "100%", borderRadius: 99, background: "linear-gradient(90deg, #2ECC40, #7BED9F)" }}
            />
          </div>
          <span style={{ color: "rgba(255,255,255,0.8)", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>
            {shotsScored}/{levelConfig.shotsRequired} ⚽
          </span>
        </div>

        {/* Session mission: a short goal keeps the next action meaningful. */}
        <div
          aria-label={`Misión de la cancha: ${playerProfile.missionProgress} de 3 goles`}
          style={{
            marginTop: 5,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            padding: "4px 9px",
            borderRadius: 999,
            background: "rgba(125,255,214,0.1)",
            border: "1px solid rgba(125,255,214,0.35)",
            color: "#D9FFF5",
            fontSize: 10,
            fontWeight: 900,
          }}
        >
          <span>🎯 Misión: marca 3 goles</span>
          <span style={{ color: "#7DFFD6" }}>{playerProfile.missionProgress}/3 · +15🪙 +1⭐</span>
        </div>

        {/* Combo badge */}
        <AnimatePresence>
          {combo > 1 && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              style={{
                position: "absolute", top: "max(8px, env(safe-area-inset-top, 8px))", right: 80,
                background: "#FF6B35", borderRadius: 99, padding: "2px 10px",
                fontFamily: "'Fredoka One', cursive", color: "white", fontSize: 12, fontWeight: 900,
                zIndex: 30,
              }}
            >
              🔥 COMBO x{combo}!
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── PHASE BANNER (compact) ── */}
      <div style={{ flexShrink: 0, textAlign: "center", paddingBottom: 4, zIndex: 20 }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={phase}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "3px 12px", borderRadius: 99,
              background: phase === "aiming" ? "rgba(255,215,0,0.15)"
                : phase === "math" ? "rgba(255,107,53,0.2)"
                : "rgba(46,204,64,0.2)",
              border: `1.5px solid ${phase === "aiming" ? "#FFD70060"
                : phase === "math" ? "#FF6B3560"
                : "#2ECC4060"}`,
            }}
          >
            <span style={{ fontSize: 13 }}>
              {phase === "aiming" ? "🎯" : phase === "math" ? "⚡" : phase === "shooting" ? "⚽" : "📊"}
            </span>
            <span style={{
              fontSize: 11, fontWeight: 900,
              fontFamily: "'Fredoka One', cursive",
              color: phase === "aiming" ? "#FFD700" : phase === "math" ? "#FF6B35" : "#2ECC40",
            }}>
              {phase === "aiming" ? "¡Toca la portería para apuntar!"
                : phase === "math" ? "¡Resuelve para potenciar el tiro!"
                : phase === "shooting" ? "¡Volando!"
                : "Resultado"}
            </span>
          </motion.div>
        </AnimatePresence>
      </div>

      {flowNotice && (
        <motion.div
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            alignSelf: "center",
            margin: "0 12px 4px",
            padding: "4px 10px",
            borderRadius: 99,
            background: "rgba(77,208,225,0.14)",
            border: "1px solid rgba(77,208,225,0.5)",
            color: "#BDF7FF",
            fontSize: 11,
            fontWeight: 800,
            textAlign: "center",
            zIndex: 20,
          }}
        >
          {flowNotice}
        </motion.div>
      )}

      {/* ── GOAL AREA (dominant — fills remaining space) ── */}
      <div
        style={{
          flex: "1 1 0",
          minHeight: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "4px 10px",
          zIndex: 10,
        }}
      >
        {/* Goal container — fills available height, maintains max width */}
        <div
          data-shot-keeper-x={lastShotResult ? lastShotResult.input.keeper.position.x : undefined}
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            maxWidth: 420,
            borderRadius: 14,
            overflow: "hidden",
            border: phase === "aiming"
              ? "2px solid rgba(255,215,0,0.88)"
              : phase === "shooting"
              ? "2px solid rgba(46,204,64,0.8)"
              : "2px solid rgba(159,220,232,0.28)",
            boxShadow: phase === "aiming"
              ? "0 0 22px rgba(255,215,0,0.22), inset 0 0 28px rgba(6,18,35,0.24)"
              : "0 14px 36px rgba(0,0,0,0.42), inset 0 0 28px rgba(3,12,24,0.3)",
            transition: "border-color 0.3s, box-shadow 0.3s",
          }}
        >
          {/* Goal background image */}
          <img
            src={GOAL_BG}
            alt="Portería"
            style={{
              position: "absolute", inset: 0,
              width: "100%", height: "100%",
              objectFit: "cover",
              pointerEvents: "none",
            }}
          />

          {/* Contrast veil keeps the target labels legible without adding a grid. */}
          <div style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(180deg, rgba(2,8,20,0.08) 0%, rgba(2,12,25,0.05) 45%, rgba(2,10,18,0.26) 100%)",
            pointerEvents: "none",
          }} />

          {shotFeedback === "flash" && (
            <div className="shot-flash" aria-hidden="true" />
          )}

          {/* Transparent target zones — the grid is only semantic, never a visible mesh. */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "grid",
              gridTemplateColumns: `repeat(${cols}, 1fr)`,
              gridTemplateRows: `repeat(${rows}, 1fr)`,
              gap: 0,
              padding: 0,
            }}
          >
            {gridCoords.map(({ x, y }) => {
              const isSelected = targetCoord?.x === x && targetCoord?.y === y;
              const canTap = phase === "aiming";

              return (
                <button
                  key={`${x},${y}`}
                  className="goal-target-zone"
                  onClick={() => handleCellTap(x, y)}
                  aria-label={`Apuntar a coordenada ${x}, ${y}`}
                  aria-pressed={isSelected}
                  disabled={!canTap}
                  style={{
                    position: "relative",
                    borderRadius: 12,
                    border: isSelected ? "2px solid #FF6B35" : "1px solid transparent",
                    background: isSelected
                      ? "linear-gradient(145deg, rgba(255,107,53,0.46), rgba(155,45,30,0.28))"
                      : "transparent",
                    cursor: canTap ? "pointer" : "default",
                    touchAction: "manipulation",
                    WebkitTapHighlightColor: "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "background 0.18s, border-color 0.18s, box-shadow 0.18s",
                    boxShadow: isSelected ? "0 0 18px rgba(255,107,53,0.42), inset 0 0 18px rgba(255,107,53,0.18)" : "none",
                  }}
                >
                  {/* Coordinate label — always visible */}
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      padding: "2px 4px",
                      borderRadius: 999,
                      background: isSelected ? "rgba(42,12,7,0.74)" : "rgba(2,9,20,0.38)",
                      border: isSelected ? "1px solid rgba(255,215,0,0.82)" : "1px solid rgba(255,255,255,0.14)",
                      backdropFilter: "blur(2px)",
                      fontFamily: "'Fredoka One', cursive",
                      fontSize: "clamp(7px, 1.65vw, 9px)",
                      fontWeight: 800,
                      color: isSelected ? "#FFD700" : "rgba(255,255,255,0.74)",
                      textShadow: "0 1px 4px rgba(0,0,0,0.95)",
                      lineHeight: 1,
                      pointerEvents: "none",
                      userSelect: "none",
                    }}
                  >
                    ({x},{y})
                  </span>

                  {/* Pulsing ring for selected cell */}
                  {isSelected && (
                    <motion.div
                      animate={{ scale: [1, 1.3, 1], opacity: [0.8, 0, 0.8] }}
                      transition={{ duration: 1, repeat: Infinity }}
                      style={{
                        position: "absolute",
                        inset: "8%",
                        borderRadius: 16,
                        border: "2px solid rgba(255,107,53,0.92)",
                        pointerEvents: "none",
                      }}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Goalkeeper */}
          {levelConfig.hasKeeper && (
            <motion.div
              data-keeper-visual-x={keeperDisplayX / 100}
              style={{
                position: "absolute",
                bottom: "8%",
                left: `${keeperDisplayX}%`,
                transform: "translateX(-50%)",
                zIndex: 15,
                pointerEvents: "none",
              }}
            >
              <img
                src={KEEPER_IMG}
                alt="Portero"
                style={{
                  width: 88, height: 88,
                  objectFit: "contain",
                  filter: "drop-shadow(0 5px 10px rgba(0,0,0,0.9)) saturate(1.08)",
                }}
              />
            </motion.div>
          )}

          {/* Trajectory and destination: both use the engine's resolved landing point. */}
          {ball.inFlight && lastShotResult && (
            <>
              <div className="shot-trajectory-blur" aria-hidden="true">
                {lastShotResult.trajectoryPoints.filter((_, index) => index % 2 === 0).map((point, index) => (
                  <span
                    key={`shot-trail-${index}`}
                    style={{
                      left: `${point.x * 100}%`,
                      top: `${point.y * 100}%`,
                      animationDelay: `${index * 10}ms`,
                    }}
                  />
                ))}
              </div>
              <div
                className="shot-destination-marker"
                aria-hidden="true"
                style={{
                  left: `${lastShotResult.landingPoint.x * 100}%`,
                  top: `${lastShotResult.landingPoint.y * 100}%`,
                }}
              >
                <span />
              </div>
            </>
          )}

          {/* Math Power trail — rendered from the same resolved trajectory. */}
          {ball.inFlight && lastShotResult && flightPower && powerVisual && (
            <div aria-hidden="true" style={{ position: "absolute", inset: 0, zIndex: 24, pointerEvents: "none" }}>
              {lastShotResult.trajectoryPoints.slice(0, -1).map((point, index) => (
                <motion.span
                  key={`power-trail-${index}`}
                  initial={{ opacity: 0, scale: 0.3 }}
                  animate={{ opacity: [0.15, 0.8, 0.15], scale: [0.35, 1, 0.35] }}
                  transition={{ duration: 0.7, repeat: Infinity, delay: index * 0.025 }}
                  style={{
                    position: "absolute",
                    left: `${point.x * 100}%`,
                    top: `${point.y * 100}%`,
                    width: flightPower === "perfect" ? 11 : 7,
                    height: flightPower === "perfect" ? 11 : 7,
                    borderRadius: "50%",
                    background: powerVisual.trail,
                    boxShadow: `0 0 10px ${powerVisual.glow}`,
                    transform: "translate(-50%, -50%)",
                  }}
                />
              ))}
            </div>
          )}

          {/* Ball in flight */}
          <AnimatePresence>
            {ball.inFlight && (
              <motion.div
                style={{
                  position: "absolute",
                  left: `${ballPos.x}%`,
                  top: `${ballPos.y}%`,
                  transform: "translate(-50%, -50%)",
                  zIndex: 25,
                  width: 40, height: 40,
                  pointerEvents: "none",
                }}
                animate={{ rotate: 360 }}
                transition={{ duration: lastShotResult?.input.mathPower === "turbo" ? 0.22 : 0.4, repeat: Infinity, ease: "linear" }}
              >
                {lastShotResult?.input.mathPower && (
                  <motion.span
                    aria-hidden="true"
                    animate={{ scale: [0.85, 1.2, 0.85], opacity: [0.35, 0.7, 0.35] }}
                    transition={{ duration: lastShotResult.input.mathPower === "perfect" ? 0.55 : 0.85, repeat: Infinity }}
                    style={{
                      position: "absolute", inset: -12, borderRadius: "50%",
                      background: POWER_VISUALS[lastShotResult.input.mathPower].glow,
                      boxShadow: `0 0 20px ${POWER_VISUALS[lastShotResult.input.mathPower].glow}`,
                    }}
                  />
                )}
                <img
                  src={BALL_IMG}
                  alt="Balón"
                  style={{
                    width: "100%", height: "100%",
                    filter: lastShotResult?.input.mathPower
                      ? `drop-shadow(0 0 8px ${POWER_VISUALS[lastShotResult.input.mathPower].accent}) drop-shadow(0 3px 8px rgba(0,0,0,0.9))`
                      : "drop-shadow(0 3px 8px rgba(0,0,0,0.9))",
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Shot result overlay */}
          <AnimatePresence>
            {lastShotResult && phase === "result" && (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 1.1, opacity: 0 }}
                transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                onClick={handleNextShot}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") handleNextShot();
                }}
                role="button"
                tabIndex={0}
                aria-label="Continuar al siguiente tiro"
                style={{
                  position: "absolute", inset: 0,
                  display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center",
                  background: lastShotResult.scored
                    ? "linear-gradient(180deg, rgba(46,204,64,0.85) 0%, rgba(0,100,20,0.9) 100%)"
                    : "linear-gradient(180deg, rgba(255,71,87,0.85) 0%, rgba(100,0,20,0.9) 100%)",
                  backdropFilter: "blur(6px)",
                  zIndex: 40,
                  cursor: "pointer",
                  touchAction: "manipulation",
                  gap: 12,
                }}
              >
                {burstKind && (
                  <MicrovictoryBurst
                    kind={burstKind}
                    eventKey={`${shotsTaken}-${burstKind}`}
                  />
                )}

                {/* Main result text */}
                <motion.div
                  initial={{ y: -20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.05, duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                  style={{
                    fontFamily: "'Fredoka One', cursive",
                    fontSize: "clamp(44px, 14vw, 72px)",
                    fontWeight: 900, color: "white",
                    textShadow: "4px 4px 0 rgba(0,0,0,0.5), 0 0 30px rgba(255,255,255,0.3)",
                    textAlign: "center",
                    lineHeight: 1,
                  }}
                >
                  {lastShotResult.scored ? "⚽ ¡GOL!"
                    : lastShotResult.savedByKeeper ? "🧤 ¡Atajada!"
                    : lastShotResult.blockedByWall ? "🚧 ¡Bloqueado!"
                    : "❌ ¡Afuera!"}
                </motion.div>

                <div
                  aria-live="polite"
                  style={{
                    maxWidth: "min(88vw, 340px)",
                    textAlign: "center",
                    fontFamily: "'Nunito', sans-serif",
                    fontSize: 15,
                    lineHeight: 1.35,
                    color: "rgba(255,255,255,0.95)",
                    textShadow: "1px 1px 2px rgba(0,0,0,0.7)",
                  }}
                >
                  <div>
                    Apuntaste a ({lastShotResult.targetCoord.x}, {lastShotResult.targetCoord.y}) · El balón llegó a ({lastShotResult.actualCoord.x}, {lastShotResult.actualCoord.y})
                  </div>
                  {lastShotResult.input.mathPower && (
                    <div style={{
                      margin: "10px auto 4px",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 7,
                      padding: "6px 12px",
                      borderRadius: 999,
                      background: `${POWER_VISUALS[lastShotResult.input.mathPower].accent}33`,
                      border: `1px solid ${POWER_VISUALS[lastShotResult.input.mathPower].accent}`,
                      color: POWER_VISUALS[lastShotResult.input.mathPower].accent,
                      fontWeight: 900,
                    }}>
                      {MATH_POWER_META[lastShotResult.input.mathPower].icon} {MATH_POWER_META[lastShotResult.input.mathPower].label}
                    </div>
                  )}
                  <div style={{ marginTop: 4, color: lastShotResult.mathCorrect ? "#D8FFD8" : "#FFE0E0" }}>
                    {lastShotResult.mathCorrect ? "¡Buen cálculo! El poder se conserva aunque el tiro sea detenido. " : "La respuesta incorrecta redujo la precisión. "}
                    {getReasonLabel(lastShotResult.reasonCode)}
                  </div>
                  {lastShotResult.input.mathPower && (
                    <div style={{ marginTop: 3, fontSize: 13, opacity: 0.9 }}>
                      {MATH_POWER_META[lastShotResult.input.mathPower].description}
                    </div>
                  )}
                </div>

                {lastShotResult.scored && (
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.18, type: "spring", stiffness: 350 }}
                    style={{
                      padding: "6px 14px",
                      borderRadius: 999,
                      background: "rgba(255,209,102,0.2)",
                      border: "1px solid rgba(255,209,102,0.75)",
                      color: "#FFE7A3",
                      fontSize: 13,
                      fontWeight: 900,
                    }}
                  >
                    🎯 Misión: {playerProfile.missionProgress === 0 ? "¡completada! +15 monedas +1 estrella" : `${playerProfile.missionProgress}/3 goles`}
                  </motion.div>
                )}

                {/* Combo badge */}
                {lastShotResult.scored && combo > 1 && (
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.25, type: "spring", stiffness: 400 }}
                    style={{
                      background: "#FF6B35",
                      borderRadius: 99, padding: "6px 20px",
                      fontFamily: "'Fredoka One', cursive",
                      fontSize: 22, fontWeight: 900, color: "white",
                      boxShadow: "0 4px 0 rgba(0,0,0,0.4)",
                    }}
                  >
                    🔥 COMBO x{combo}!
                  </motion.div>
                )}

                {/* Bonus multiplier */}
                {lastShotResult.scored && lastShotResult.bonusMultiplier > 1 && (
                  <motion.div
                    initial={{ y: 10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.15 }}
                    style={{
                      fontFamily: "'Fredoka One', cursive",
                      fontSize: 18, color: "#FFD700",
                      textShadow: "1px 1px 3px rgba(0,0,0,0.8)",
                    }}
                  >
                    ⭐ x{lastShotResult.bonusMultiplier} bonus!
                  </motion.div>
                )}

                {/* Tap to continue hint */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 1, 0.6, 1] }}
                  transition={{ delay: 0.5, duration: 0.8, repeat: Infinity }}
                  style={{
                    marginTop: 8,
                    fontFamily: "'Fredoka One', cursive",
                    fontSize: 14, color: "rgba(255,255,255,0.8)",
                    textShadow: "1px 1px 2px rgba(0,0,0,0.8)",
                  }}
                >
                  👆 Toca para continuar
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Particles */}
          <ParticleLayer particles={state.particles} />
          <FloatingTextLayer texts={state.floatingTexts} />
        </div>
      </div>

      {/* ── BOTTOM AREA (~24% — instruction + shoot button) ── */}
      <div
        style={{
          flexShrink: 0,
          paddingLeft: 12,
          paddingRight: 12,
          paddingTop: 8,
          paddingBottom: "max(16px, env(safe-area-inset-bottom, 16px))",
          zIndex: 20,
          minHeight: 80,
        }}
      >
        {/* No target selected: bouncing ball hint */}
        <AnimatePresence>
          {phase === "aiming" && !targetCoord && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}
            >
              <motion.img
                src={BALL_IMG}
                alt="Balón"
                style={{ width: 36, height: 36, filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.6))" }}
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
              />
              <span style={{
                fontFamily: "'Fredoka One', cursive",
                fontSize: 16, fontWeight: 900, color: "#FFD700",
                textShadow: "1px 1px 3px rgba(0,0,0,0.8)",
              }}>
                ¡Toca una celda para apuntar!
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Target selected + TIRAR button (non-directions levels) */}
        <AnimatePresence>
          {phase === "aiming" && targetCoord && !isDirections && (
            <motion.div
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 50, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                background: "rgba(0,0,0,0.85)",
                border: "2px solid #3742FA",
                borderRadius: 18,
                padding: "10px 14px",
                boxShadow: "0 0 20px rgba(55,66,250,0.4)",
              }}
            >
              <div>
                <div style={{ color: "#7B8FF7", fontSize: 11, fontWeight: 700 }}>Apuntando a</div>
                <div style={{
                  fontFamily: "'Fredoka One', cursive",
                  fontSize: 22, fontWeight: 900, color: "white",
                  lineHeight: 1,
                }}>
                  ({targetCoord.x}, {targetCoord.y})
                </div>
              </div>
              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={handleShoot}
                aria-label={`Disparar a la coordenada ${targetCoord.x}, ${targetCoord.y}`}
                style={{
                  padding: "16px 28px",
                  borderRadius: 14,
                  fontFamily: "'Fredoka One', cursive",
                  fontSize: 20, fontWeight: 900, color: "white",
                  display: "flex", alignItems: "center", gap: 8,
                  background: "linear-gradient(180deg, #FF6B35 0%, #E55A2B 100%)",
                  border: "3px solid rgba(255,255,255,0.3)",
                  boxShadow: "0 5px 0 #B84A1F",
                  touchAction: "manipulation",
                  WebkitTapHighlightColor: "transparent",
                  minWidth: 130,
                  minHeight: 56,
                }}
              >
                <Zap style={{ width: 22, height: 22 }} />
                ¡TIRAR!
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Directions level: auto-shoot feedback */}
        <AnimatePresence>
          {phase === "aiming" && targetCoord && isDirections && (
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              style={{
                textAlign: "center",
                background: "rgba(46,204,64,0.15)",
                border: "2px solid #2ECC40",
                borderRadius: 14, padding: "12px 16px",
              }}
            >
              <span style={{
                fontFamily: "'Fredoka One', cursive",
                fontSize: 17, fontWeight: 900, color: "#2ECC40",
              }}>
                ⚽ Disparando a ({targetCoord.x}, {targetCoord.y})...
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── MATH CHALLENGE PANEL (absolute overlay slides from bottom) ── */}
      <AnimatePresence>
        {phase === "math" && currentChallenge && (
          <MathPanel
            challenge={currentChallenge}
            timeLeft={mathTimeLeft}
            onAnswer={(ans) => {
              if (mathTimerRef.current) clearInterval(mathTimerRef.current);
              if (ans === currentChallenge.answer) {
                sounds.correct();
              } else {
                sounds.wrong();
              }
              submitMath(ans);
            }}
            hintsEnabled={adaptiveDifficulty.hintsEnabled}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Math Panel ───────────────────────────────────────────────
function MathPanel({
  challenge, timeLeft, onAnswer, hintsEnabled,
}: {
  challenge: { question: string; options?: number[]; answer: number; timeLimit: number; hint?: string };
  timeLeft: number;
  onAnswer: (n: number) => void;
  hintsEnabled: boolean;
}) {
  const timePct = (timeLeft / challenge.timeLimit) * 100;
  const timeColor = timePct > 50 ? "#2ECC40" : timePct > 25 ? "#FFD700" : "#FF4757";
  const [answered, setAnswered] = useState(false);

  const handleAnswer = useCallback((opt: number) => {
    if (answered) return;
    setAnswered(true);
    onAnswer(opt);
  }, [answered, onAnswer]);

  return (
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
      style={{
        position: "absolute",
        bottom: 0, left: 0, right: 0,
        zIndex: 50,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        paddingTop: 16,
        paddingLeft: 16,
        paddingRight: 16,
        paddingBottom: "max(24px, env(safe-area-inset-bottom, 24px))",
        background: "linear-gradient(180deg, #1a1a2e 0%, #0f3460 100%)",
        border: "3px solid #3742FA",
        borderBottom: "none",
        boxShadow: "0 -8px 40px rgba(55,66,250,0.6)",
      }}
    >
      {/* Handle bar */}
      <div style={{
        width: 40, height: 4, borderRadius: 99,
        background: "rgba(255,255,255,0.2)",
        margin: "0 auto 12px",
      }} />

      {/* Timer bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <div style={{ flex: 1, height: 10, borderRadius: 99, overflow: "hidden", background: "rgba(255,255,255,0.1)" }}>
          <motion.div
            animate={{ width: `${timePct}%` }}
            transition={{ duration: 1, ease: "linear" }}
            style={{ height: "100%", borderRadius: 99, background: timeColor }}
          />
        </div>
        <span style={{
          fontFamily: "'Fredoka One', cursive",
          fontSize: 16, fontWeight: 900,
          color: timeColor, width: 28, textAlign: "right",
        }}>
          {timeLeft}
        </span>
      </div>

      {/* Label */}
      <div style={{ textAlign: "center", marginBottom: 10 }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "4px 12px", borderRadius: 99,
          background: "rgba(255,107,53,0.2)",
          border: "1.5px solid #FF6B35",
          color: "#FF6B35",
          fontSize: 11, fontWeight: 900,
          fontFamily: "'Fredoka One', cursive",
        }}>
          ⚡ RESUELVE PARA POTENCIAR TU TIRO
        </div>
      </div>

      {/* Question */}
      <div style={{
        fontFamily: "'Fredoka One', cursive",
        fontSize: "clamp(26px, 8vw, 40px)",
        fontWeight: 900, color: "white",
        textAlign: "center",
        textShadow: "2px 2px 0 rgba(0,0,0,0.5)",
        lineHeight: 1.2,
        marginBottom: 10,
      }}>
        {challenge.question}
      </div>

      {hintsEnabled && challenge.hint && (
        <div style={{
          textAlign: "center", marginBottom: 10,
          color: "#FFD700", fontSize: 12, fontWeight: 700,
          opacity: 0.85,
        }}>
          💡 {challenge.hint}
        </div>
      )}

      {/* Answer options — large touch targets */}
      {challenge.options && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {challenge.options.map((opt) => (
            <motion.button
              key={opt}
              whileTap={{ scale: 0.88 }}
              onClick={() => handleAnswer(opt)}
              aria-label={`Responder ${opt}`}
              disabled={answered}
              style={{
                height: 72,
                borderRadius: 16,
                fontFamily: "'Fredoka One', cursive",
                fontSize: "clamp(24px, 7vw, 32px)",
                fontWeight: 900, color: "white",
                display: "flex", alignItems: "center", justifyContent: "center",
                background: answered ? "rgba(55,66,250,0.4)" : "linear-gradient(180deg, #3742FA 0%, #2C35D4 100%)",
                border: "3px solid rgba(255,255,255,0.25)",
                boxShadow: answered ? "none" : "0 5px 0 rgba(0,0,0,0.4)",
                touchAction: "manipulation",
                WebkitTapHighlightColor: "transparent",
                transition: "all 0.15s",
              }}
            >
              {opt}
            </motion.button>
          ))}
        </div>
      )}
    </motion.div>
  );
}

// ── Particle Layer ───────────────────────────────────────────
function ParticleLayer({ particles }: { particles: Particle[] }) {
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 40, overflow: "hidden", pointerEvents: "none" }}>
      {particles.map((p) => {
        const isCoin = p.type === "coin";
        const isStar = p.type === "star";
        const isSpark = p.type === "spark";
        return (
          <div
            key={p.id}
            style={{
              position: "absolute",
              left: `${p.x * 100}%`,
              top: `${p.y * 100}%`,
              width: p.size,
              height: p.size,
              borderRadius: isCoin || isSpark ? "50%" : isStar ? "35%" : 2,
              background: isCoin ? `radial-gradient(circle at 35% 30%, #FFF3A3 0 18%, ${p.color} 45%, #B8860B 100%)` : p.color,
              border: isCoin ? "1px solid rgba(255,255,255,0.85)" : undefined,
              clipPath: isStar ? "polygon(50% 0%, 61% 36%, 98% 36%, 68% 58%, 79% 100%, 50% 73%, 21% 100%, 32% 58%, 2% 36%, 39% 36%)" : undefined,
              opacity: Math.max(0, p.life / p.maxLife),
              transform: `rotate(${(1 - p.life) * 180}deg)`,
              boxShadow: isSpark || isCoin ? `0 0 ${Math.max(4, p.size * 1.5)}px ${p.color}` : undefined,
              pointerEvents: "none",
            }}
          />
        );
      })}
    </div>
  );
}

// ── Floating Text Layer ──────────────────────────────────────
function FloatingTextLayer({ texts }: { texts: FloatingText[] }) {
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 45, overflow: "hidden", pointerEvents: "none" }}>
      {texts.map((t) => (
        <div
          key={t.id}
          style={{
            position: "absolute",
            left: `${t.x * 100}%`,
            top: `${t.y * 100}%`,
            transform: "translate(-50%, -50%)",
            fontFamily: "'Fredoka One', cursive",
            fontSize: t.size === "xl" ? 30 : t.size === "lg" ? 24 : t.size === "md" ? 18 : 14,
            fontWeight: 900,
            color: t.color,
            textShadow: "2px 2px 0 rgba(0,0,0,0.8)",
            opacity: Math.max(0, t.life / t.maxLife),
            pointerEvents: "none",
            whiteSpace: "nowrap",
          }}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}
