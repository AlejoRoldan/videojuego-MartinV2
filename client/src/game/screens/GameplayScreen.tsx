// =============================================================
// TIRO LIBRE MATEMÁTICO — Gameplay Screen v5
// Design: Pixel Champions — FIXED VIEWPORT
// LAYOUT (100dvh total):
//   HUD:       ~18% (top bar + progress)
//   GOAL:      ~58% (dominant — portería con cuadrícula)
//   BOTTOM:    ~24% (instrucción + botón tirar / resultado)
// KEY FIXES v5:
//   - height: 100dvh on root container (not minHeight)
//   - Goal section uses flex-grow with explicit height calc
//   - No empty space — portería fills the screen
//   - Coordinates always visible inside each cell
//   - Selected cell glows orange with pulsing ring
//   - Math panel is absolute overlay (not flex child)
//   - Shoot button is large (min 56px height) for mobile
// =============================================================

import { motion, AnimatePresence } from "framer-motion";
import { useGame } from "../engine/GameContext";
import { useEffect, useRef, useState, useCallback } from "react";
import { ArrowLeft, Zap } from "lucide-react";
import type { Vec2 } from "../engine/types";
import { calculateTrajectory } from "../engine/physics";
import { sounds } from "../engine/soundSystem";

const GOAL_BG = "https://d2xsxph8kpxj0f.cloudfront.net/310519663638628604/YvKFUvGtEph4XyT2Rde5AJ/goal-net-clean-j5wwxUVd6hJxVWmqCsmLXa.webp";
const KEEPER_IMG = "https://d2xsxph8kpxj0f.cloudfront.net/310519663638628604/YvKFUvGtEph4XyT2Rde5AJ/goalkeeper-cartoon-guVkhrpZ7AvWXKeLYUUChv.webp";
const BALL_IMG = "https://d2xsxph8kpxj0f.cloudfront.net/310519663638628604/YvKFUvGtEph4XyT2Rde5AJ/game-ball-2LkvtN9uYqK7nNkN7H9vMM.webp";

export default function GameplayScreen() {
  const { state, goToScreen, setTarget, submitMath, nextShot, shoot } = useGame();
  const {
    levelConfig, phase, currentChallenge, shotsScored, shotsTaken,
    score, combo, targetCoord, lastShotResult, ball, adaptiveDifficulty
  } = state;

  const [ballPos, setBallPos] = useState({ x: 50, y: 85 });
  const [mathTimeLeft, setMathTimeLeft] = useState(15);
  const [keeperX, setKeeperX] = useState(50);

  const animFrameRef = useRef<number>(0);
  const keeperDirRef = useRef(1);
  const lastTimeRef = useRef(0);
  const mathTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resultTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasShot = useRef(false);

  if (!levelConfig) return null;

  const gridMax = 3;
  const gridMin = levelConfig.gridQuadrants === 4 ? -3 : 1;
  const isDirections = levelConfig.concept === "directions";
  const cols = gridMax - gridMin + 1;
  const rows = gridMax - gridMin + 1;

  const progressPct = Math.min(100, (shotsScored / levelConfig.shotsRequired) * 100);

  // Build grid coordinates: top-left = (gridMin, gridMax), bottom-right = (gridMax, gridMin)
  const gridCoords: Vec2[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = gridMin + col;
      const y = gridMax - row;
      gridCoords.push({ x, y });
    }
  }

  // ── Init sounds on mount ─────────────────────────────────
  useEffect(() => {
    sounds.init();
  }, []);

  // ── Reset hasShot on new phase ───────────────────────────
  useEffect(() => {
    if (phase === "aiming") {
      hasShot.current = false;
    }
  }, [phase]);

  // ── Goalkeeper animation ─────────────────────────────────
  useEffect(() => {
    if (!levelConfig.hasKeeper) return;
    if (phase !== "aiming" && phase !== "math") return;
    let animId: number;
    const speed = levelConfig.keeperSpeed;
    const animate = (time: number) => {
      const dt = Math.min((time - lastTimeRef.current) / 1000, 0.05);
      lastTimeRef.current = time;
      if (dt > 0) {
        setKeeperX((prev) => {
          let next = prev + keeperDirRef.current * speed * dt * 60;
          if (next > 82) { next = 82; keeperDirRef.current = -1; }
          if (next < 18) { next = 18; keeperDirRef.current = 1; }
          return next;
        });
      }
      animId = requestAnimationFrame(animate);
    };
    animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
  }, [phase, levelConfig.hasKeeper, levelConfig.keeperSpeed]);

  // ── Ball trajectory animation ────────────────────────────
  useEffect(() => {
    if (phase !== "shooting" || !ball.inFlight || !state.targetCoord) return;
    sounds.kick();
    const normalizedX = state.targetCoord.x / gridMax;
    const normalizedY = state.targetCoord.y / gridMax;
    const traj = calculateTrajectory({
      power: ball.power,
      targetX: normalizedX,
      targetY: normalizedY,
      spin: ball.spin,
      wind: levelConfig.wind ? (Math.random() - 0.5) * levelConfig.windStrength * 2 : 0,
    });
    let idx = 0;
    const animateBall = () => {
      if (idx >= traj.length) return;
      const pt = traj[idx];
      setBallPos({ x: pt.x * 100, y: pt.y * 100 });
      idx++;
      animFrameRef.current = requestAnimationFrame(animateBall);
    };
    animFrameRef.current = requestAnimationFrame(animateBall);
    return () => { cancelAnimationFrame(animFrameRef.current); };
  }, [phase, ball.inFlight]);

  // ── Play result sound + auto-advance ────────────────────
  useEffect(() => {
    if (phase !== "result" || !lastShotResult) return;
    if (lastShotResult.scored) {
      sounds.goal();
      if (combo > 1) setTimeout(() => sounds.combo(), 400);
    } else if (lastShotResult.savedByKeeper) {
      sounds.save();
    } else {
      sounds.miss();
    }
    resultTimerRef.current = setTimeout(() => {
      setBallPos({ x: 50, y: 85 });
      nextShot();
    }, 2500);
    return () => { if (resultTimerRef.current) clearTimeout(resultTimerRef.current); };
  }, [phase, lastShotResult]);

  // ── Manual next shot (tap on result overlay) ─────────────
  const handleNextShot = useCallback(() => {
    if (phase !== "result") return;
    if (resultTimerRef.current) {
      clearTimeout(resultTimerRef.current);
      resultTimerRef.current = null;
    }
    setBallPos({ x: 50, y: 85 });
    sounds.click();
    nextShot();
  }, [phase, nextShot]);

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
    shoot();
  }, [shoot]);

  return (
    <div
      style={{
        position: "fixed",
        top: 0, left: 0, right: 0, bottom: 0,
        width: "100%",
        height: "100dvh",
        display: "flex",
        flexDirection: "column",
        background: "linear-gradient(180deg, #0f2d0f 0%, #0a1f0a 35%, #0d1b2a 65%, #080e1a 100%)",
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
            onPointerDown={() => { sounds.click(); goToScreen("level-select"); }}
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
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            maxWidth: 420,
            borderRadius: 18,
            overflow: "hidden",
            border: phase === "aiming"
              ? "4px solid #FFD700"
              : phase === "shooting"
              ? "4px solid #2ECC40"
              : "4px solid rgba(255,255,255,0.15)",
            boxShadow: phase === "aiming"
              ? "0 0 32px rgba(255,215,0,0.5), inset 0 0 20px rgba(255,215,0,0.1)"
              : "0 0 20px rgba(0,0,0,0.5)",
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

          {/* Light overlay to keep cells visible over the bright goal image */}
          <div style={{
            position: "absolute", inset: 0,
            background: "rgba(0,0,0,0.15)",
            pointerEvents: "none",
          }} />

          {/* Axis labels — Y axis (left side) */}
          {gridCoords.filter(c => c.x === gridMin).map((c) => {
            const cellH = 100 / rows;
            const rowIdx = gridMax - c.y;
            const topPct = rowIdx * cellH + cellH / 2;
            return (
              <div
                key={`y-${c.y}`}
                style={{
                  position: "absolute",
                  left: 3,
                  top: `${topPct}%`,
                  transform: "translateY(-50%)",
                  color: "rgba(255,255,255,0.6)",
                  fontSize: 9,
                  fontWeight: 900,
                  fontFamily: "'Fredoka One', cursive",
                  pointerEvents: "none",
                  zIndex: 5,
                  lineHeight: 1,
                }}
              >
                {c.y}
              </div>
            );
          })}

          {/* Axis labels — X axis (bottom) */}
          {gridCoords.filter(c => c.y === gridMin).map((c) => {
            const cellW = 100 / cols;
            const colIdx = c.x - gridMin;
            const leftPct = colIdx * cellW + cellW / 2;
            return (
              <div
                key={`x-${c.x}`}
                style={{
                  position: "absolute",
                  bottom: 3,
                  left: `${leftPct}%`,
                  transform: "translateX(-50%)",
                  color: "rgba(255,255,255,0.6)",
                  fontSize: 9,
                  fontWeight: 900,
                  fontFamily: "'Fredoka One', cursive",
                  pointerEvents: "none",
                  zIndex: 5,
                  lineHeight: 1,
                }}
              >
                {c.x}
              </div>
            );
          })}

          {/* Grid cells — absolute positioned to fill the goal */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "grid",
              gridTemplateColumns: `repeat(${cols}, 1fr)`,
              gridTemplateRows: `repeat(${rows}, 1fr)`,
              gap: 2,
              padding: 2,
            }}
          >
            {gridCoords.map(({ x, y }) => {
              const isSelected = targetCoord?.x === x && targetCoord?.y === y;
              const canTap = phase === "aiming";

              return (
                <button
                  key={`${x},${y}`}
                  onPointerDown={() => handleCellTap(x, y)}
                  disabled={!canTap}
                  style={{
                    position: "relative",
                    borderRadius: 6,
                    border: isSelected
                      ? "3px solid #FF6B35"
                      : "2px solid rgba(255,255,255,0.55)",
                    background: isSelected
                      ? "rgba(255,107,53,0.55)"
                      : canTap
                      ? "rgba(0,0,0,0.25)"
                      : "rgba(0,0,0,0.1)",
                    cursor: canTap ? "pointer" : "default",
                    touchAction: "manipulation",
                    WebkitTapHighlightColor: "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "background 0.15s, border-color 0.15s",
                    boxShadow: isSelected ? "0 0 12px rgba(255,107,53,0.6), inset 0 0 8px rgba(255,107,53,0.3)" : "none",
                  }}
                >
                  {/* Coordinate label — always visible */}
                  <span
                    style={{
                      fontFamily: "'Fredoka One', cursive",
                      fontSize: "clamp(10px, 2.8vw, 16px)",
                      fontWeight: 900,
                      color: isSelected ? "#FFD700" : "white",
                      textShadow: "0 0 6px rgba(0,0,0,1), 1px 1px 0 rgba(0,0,0,1), -1px -1px 0 rgba(0,0,0,1)",
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
                        inset: -4,
                        borderRadius: 10,
                        border: "3px solid #FF6B35",
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
              style={{
                position: "absolute",
                bottom: "8%",
                left: `${keeperX}%`,
                transform: "translateX(-50%)",
                zIndex: 15,
                pointerEvents: "none",
              }}
            >
              <img
                src={KEEPER_IMG}
                alt="Portero"
                style={{
                  width: 56, height: 56,
                  objectFit: "contain",
                  filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.8))",
                }}
              />
            </motion.div>
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
                transition={{ duration: 0.4, repeat: Infinity, ease: "linear" }}
              >
                <img src={BALL_IMG} alt="Balón" style={{ width: "100%", height: "100%", filter: "drop-shadow(0 3px 8px rgba(0,0,0,0.9))" }} />
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
                onPointerDown={handleNextShot}
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
                  fontSize: 28, fontWeight: 900, color: "white",
                  lineHeight: 1,
                }}>
                  ({targetCoord.x}, {targetCoord.y})
                </div>
              </div>
              <motion.button
                whileTap={{ scale: 0.92 }}
                onPointerDown={handleShoot}
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
              onPointerDown={() => handleAnswer(opt)}
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
function ParticleLayer({ particles }: { particles: any[] }) {
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 40, overflow: "hidden", pointerEvents: "none" }}>
      {particles.map((p) => (
        <div
          key={p.id}
          style={{
            position: "absolute",
            left: `${p.x * 100}%`,
            top: `${p.y * 100}%`,
            width: p.size,
            height: p.size,
            borderRadius: 2,
            background: p.color,
            opacity: Math.max(0, p.life / 60),
            transform: `rotate(${p.rotation}deg)`,
            pointerEvents: "none",
          }}
        />
      ))}
    </div>
  );
}

// ── Floating Text Layer ──────────────────────────────────────
function FloatingTextLayer({ texts }: { texts: any[] }) {
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
            fontSize: t.size || 18,
            fontWeight: 900,
            color: t.color || "#FFD700",
            textShadow: "2px 2px 0 rgba(0,0,0,0.8)",
            opacity: Math.max(0, t.life / 90),
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
