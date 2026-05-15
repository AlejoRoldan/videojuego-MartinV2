// =============================================================
// TIRO LIBRE MATEMÁTICO — Gameplay Screen v3
// Design: Pixel Champions — Mobile-first, touch-optimized
// KEY FIX: Grid cells are real <button> elements with touchAction:manipulation
//          No touchAction:none on parent, no duplicate style props
// =============================================================

import { motion, AnimatePresence } from "framer-motion";
import { useGame } from "../engine/GameContext";
import { useEffect, useRef, useState, useCallback } from "react";
import { ArrowLeft, Zap, Target } from "lucide-react";
import type { Vec2 } from "../engine/types";
import { calculateTrajectory } from "../engine/physics";
import { sounds } from "../engine/soundSystem";

const GOAL_BG = "https://d2xsxph8kpxj0f.cloudfront.net/310519663638628604/YvKFUvGtEph4XyT2Rde5AJ/game-goal-net-RViiXuc5mRUX8LiFNHpi4S.webp";
const FIELD_BG = "https://d2xsxph8kpxj0f.cloudfront.net/310519663638628604/YvKFUvGtEph4XyT2Rde5AJ/game-hero-bg-CpyMAm8bnEJBphszgk5Zvp.webp";
const BALL_IMG = "https://d2xsxph8kpxj0f.cloudfront.net/310519663638628604/YvKFUvGtEph4XyT2Rde5AJ/game-ball-2LkvtN9uYqK7nNkN7H9vMM.webp";

export default function GameplayScreen() {
  const { state, goToScreen, setTarget, submitMath, nextShot, shoot } = useGame();
  const {
    levelConfig, phase, currentChallenge, shotsScored, shotsTaken,
    score, combo, targetCoord, lastShotResult, ball, goalkeeper, wall, adaptiveDifficulty
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
  const gridMin = levelConfig.gridQuadrants === 4 ? -3 : 0;
  const isDirections = levelConfig.concept === "directions";
  const range = gridMax - gridMin;

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
          if (next > 85) { next = 85; keeperDirRef.current = -1; }
          if (next < 15) { next = 15; keeperDirRef.current = 1; }
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
    }, 1800);

    return () => { if (resultTimerRef.current) clearTimeout(resultTimerRef.current); };
  }, [phase, lastShotResult]);

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

  const progressPct = Math.min(100, (shotsScored / levelConfig.shotsRequired) * 100);

  // Build grid coordinates
  const gridCoords: Vec2[] = [];
  for (let y = gridMax; y >= gridMin; y--) {
    for (let x = gridMin; x <= gridMax; x++) {
      gridCoords.push({ x, y });
    }
  }
  const cols = range + 1;
  const rows = range + 1;

  return (
    <div
      className="relative w-full flex flex-col"
      style={{ minHeight: "100dvh", background: "#0d1b2a" }}
    >
      {/* Field background */}
      <div
        className="absolute inset-0 bg-cover bg-center opacity-25"
        style={{ backgroundImage: `url(${FIELD_BG})` }}
      />

      {/* ── TOP HUD ── */}
      <div className="relative z-20 px-3 pb-2 flex-shrink-0" style={{ paddingTop: "max(12px, env(safe-area-inset-top, 12px))" }}>
        <div className="flex items-center justify-between gap-2">
          <button
            onPointerDown={() => { sounds.click(); goToScreen("level-select"); }}
            className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(255,255,255,0.12)", border: "2px solid rgba(255,255,255,0.25)", touchAction: "manipulation" }}
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div className="flex-1 text-center">
            <div className="text-white font-black text-sm leading-tight" style={{ fontFamily: "'Fredoka One', cursive" }}>
              Nivel {levelConfig.id}: {levelConfig.name}
            </div>
          </div>
          <div
            className="px-3 py-1.5 rounded-xl min-w-[60px] text-center"
            style={{ background: "rgba(255,215,0,0.15)", border: "2px solid #FFD700" }}
          >
            <span className="text-yellow-300 font-black text-sm">{score.toLocaleString()}</span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-2 flex items-center gap-2">
          <div className="flex-1 h-3 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.1)" }}>
            <motion.div
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
              className="h-full rounded-full"
              style={{ background: "linear-gradient(90deg, #2ECC40, #7BED9F)" }}
            />
          </div>
          <span className="text-white/70 text-xs font-bold whitespace-nowrap">
            {shotsScored}/{levelConfig.shotsRequired} ⚽
          </span>
        </div>

        {/* Shot dots */}
        <div className="flex items-center gap-1 mt-1.5">
          <span className="text-white/40 text-xs">Tiros:</span>
          <div className="flex gap-1 flex-wrap">
            {Array.from({ length: levelConfig.shotsAllowed }).map((_, i) => (
              <div
                key={i}
                className="w-4 h-4 rounded-full transition-all duration-300"
                style={{
                  background: i < shotsTaken
                    ? (i < shotsScored ? "#2ECC40" : "#FF4757")
                    : "rgba(255,255,255,0.2)",
                  border: "1.5px solid rgba(255,255,255,0.2)",
                }}
              />
            ))}
          </div>
          {combo > 1 && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="ml-auto px-2 py-0.5 rounded-full font-black text-xs text-white"
              style={{ background: "#FF6B35", fontFamily: "'Fredoka One', cursive" }}
            >
              COMBO x{combo}!
            </motion.div>
          )}
        </div>
      </div>

      {/* ── MAIN GAME AREA ── */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-3 gap-2 min-h-0">

        {/* Phase indicator */}
        <PhaseIndicator phase={phase} />

        {/* ── GOAL ── */}
        <div
          className="relative w-full max-w-sm select-none"
          style={{
            aspectRatio: "4/3",
            border: phase === "aiming" ? "4px solid #FFD700" : "4px solid rgba(255,255,255,0.2)",
            borderRadius: "16px",
            overflow: "hidden",
            boxShadow: phase === "aiming"
              ? "0 0 30px rgba(255,215,0,0.4), inset 0 0 20px rgba(255,215,0,0.1)"
              : "0 0 20px rgba(55,66,250,0.2)",
            transition: "border-color 0.3s, box-shadow 0.3s",
          }}
        >
          {/* Background image */}
          <img
            src={GOAL_BG}
            alt="Portería"
            className="absolute inset-0 w-full h-full object-cover"
            draggable={false}
            style={{ pointerEvents: "none" }}
          />

          {/* Cartesian grid lines (visual only) */}
          {levelConfig.gridVisible && (
            <GridLines gridMin={gridMin} gridMax={gridMax} />
          )}

          {/* Wall players */}
          {wall.map((player) => (
            <div
              key={player.id}
              className="absolute"
              style={{
                left: `${player.position.x * 100}%`,
                bottom: "20%",
                transform: "translateX(-50%)",
                zIndex: 10,
                pointerEvents: "none",
              }}
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center font-black text-sm text-white"
                style={{
                  background: "linear-gradient(180deg, #FF4757 0%, #C0392B 100%)",
                  border: "2px solid #fff",
                  boxShadow: "0 3px 8px rgba(0,0,0,0.6)",
                  fontFamily: "'Fredoka One', cursive",
                }}
              >
                {player.number}
              </div>
            </div>
          ))}

          {/* Goalkeeper */}
          {levelConfig.hasKeeper && (
            <motion.div
              className="absolute bottom-2"
              style={{ left: `${keeperX}%`, transform: "translateX(-50%)", zIndex: 10, pointerEvents: "none" }}
              animate={{ scaleX: keeperDirRef.current > 0 ? 1 : -1 }}
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-2xl"
                style={{
                  background: "linear-gradient(180deg, #FFD700 0%, #FFA502 100%)",
                  border: "3px solid #B8860B",
                  boxShadow: "0 4px 10px rgba(0,0,0,0.6)",
                }}
              >
                🧤
              </div>
            </motion.div>
          )}

          {/* Ball in flight */}
          <AnimatePresence>
            {ball.inFlight && (
              <motion.div
                className="absolute"
                style={{
                  left: `${ballPos.x}%`,
                  top: `${ballPos.y}%`,
                  transform: "translate(-50%, -50%)",
                  zIndex: 20,
                  width: 36,
                  height: 36,
                  pointerEvents: "none",
                }}
                animate={{ rotate: 360 }}
                transition={{ duration: 0.5, repeat: Infinity, ease: "linear" }}
              >
                <img src={BALL_IMG} alt="Balón" className="w-full h-full drop-shadow-lg" />
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── INTERACTIVE GRID BUTTONS (highest z-index, only during aiming) ── */}
          {phase === "aiming" && levelConfig.gridVisible && (
            <div
              className="absolute inset-0"
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${cols}, 1fr)`,
                gridTemplateRows: `repeat(${rows}, 1fr)`,
                zIndex: 30,
              }}
            >
              {gridCoords.map(({ x, y }) => {
                const isSelected = targetCoord?.x === x && targetCoord?.y === y;
                return (
                  <button
                    key={`${x},${y}`}
                    onPointerDown={() => handleCellTap(x, y)}
                    style={{
                      background: isSelected ? "rgba(255,107,53,0.45)" : "transparent",
                      border: isSelected ? "2px solid #FF6B35" : "1px solid rgba(255,255,255,0.08)",
                      touchAction: "manipulation",
                      WebkitTapHighlightColor: "transparent",
                      cursor: "crosshair",
                      position: "relative",
                    }}
                  >
                    {isSelected && (
                      <motion.div
                        animate={{ scale: [1, 1.3, 1], opacity: [0.8, 1, 0.8] }}
                        transition={{ duration: 0.6, repeat: Infinity }}
                        style={{
                          position: "absolute",
                          inset: 0,
                          background: "rgba(255,107,53,0.3)",
                          boxShadow: "inset 0 0 12px rgba(255,107,53,0.8)",
                        }}
                      />
                    )}
                    {/* Coordinate label on hover/selected */}
                    {isSelected && (
                      <div
                        style={{
                          position: "absolute",
                          inset: 0,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontFamily: "'Fredoka One', cursive",
                          fontSize: "11px",
                          fontWeight: 900,
                          color: "#FFD700",
                          textShadow: "1px 1px 3px rgba(0,0,0,1)",
                          pointerEvents: "none",
                        }}
                      >
                        ({x},{y})
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Aiming hint when no target selected */}
          {phase === "aiming" && !targetCoord && (
            <div className="absolute inset-0 flex items-center justify-center" style={{ pointerEvents: "none", zIndex: 25 }}>
              <motion.div
                animate={{ opacity: [0.6, 1, 0.6], scale: [0.95, 1.05, 0.95] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="text-center"
              >
                <Target className="w-10 h-10 mx-auto mb-2 text-yellow-400 drop-shadow-lg" />
                <div className="text-white font-black text-sm bg-black/60 px-4 py-2 rounded-full"
                  style={{ fontFamily: "'Fredoka One', cursive" }}>
                  ¡Toca donde quieres apuntar!
                </div>
              </motion.div>
            </div>
          )}

          {/* Shot result overlay */}
          <AnimatePresence>
            {lastShotResult && phase === "result" && (
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 1.5, opacity: 0 }}
                transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
                className="absolute inset-0 flex flex-col items-center justify-center"
                style={{
                  background: lastShotResult.scored
                    ? "rgba(46,204,64,0.5)"
                    : "rgba(255,71,87,0.5)",
                  backdropFilter: "blur(2px)",
                  zIndex: 40,
                  pointerEvents: "none",
                }}
              >
                <div
                  className="font-black text-white text-center px-4"
                  style={{
                    fontFamily: "'Fredoka One', cursive",
                    fontSize: "clamp(28px, 8vw, 44px)",
                    textShadow: "3px 3px 0 rgba(0,0,0,0.7)",
                  }}
                >
                  {lastShotResult.scored
                    ? "⚽ ¡GOL!"
                    : lastShotResult.savedByKeeper
                    ? "🧤 ¡Atajada!"
                    : lastShotResult.blockedByWall
                    ? "🚧 ¡Bloqueado!"
                    : "❌ ¡Afuera!"}
                </div>
                {lastShotResult.scored && combo > 1 && (
                  <motion.div
                    initial={{ y: 10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="mt-2 font-black text-yellow-300 text-xl"
                    style={{ fontFamily: "'Fredoka One', cursive" }}
                  >
                    COMBO x{combo}! 🔥
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Particles */}
          <ParticleLayer particles={state.particles} />
          <FloatingTextLayer texts={state.floatingTexts} />
        </div>

        {/* Ball below goal when aiming */}
        <AnimatePresence>
          {!ball.inFlight && phase === "aiming" && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ y: [0, -5, 0], scale: 1 }}
              exit={{ scale: 0 }}
              transition={{ y: { duration: 1.2, repeat: Infinity, ease: "easeInOut" }, scale: { duration: 0.2 } }}
              className="w-12 h-12 flex-shrink-0"
              style={{ pointerEvents: "none" }}
            >
              <img src={BALL_IMG} alt="Balón" className="w-full h-full drop-shadow-lg" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── MATH CHALLENGE PANEL ── */}
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

      {/* ── SHOOT BUTTON (shown after aiming target selected, before math) ── */}
      <AnimatePresence>
        {phase === "aiming" && targetCoord && !isDirections && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
            className="relative z-20 px-4 flex-shrink-0"
            style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom, 20px))" }}
          >
            <div
              className="rounded-2xl p-3 flex items-center justify-between gap-3"
              style={{
                background: "rgba(0,0,0,0.85)",
                border: "2px solid #3742FA",
                boxShadow: "0 0 20px rgba(55,66,250,0.4)",
              }}
            >
              <div>
                <div className="text-blue-300 text-xs font-bold">Objetivo seleccionado</div>
                <div
                  className="text-white font-black text-xl"
                  style={{ fontFamily: "'Fredoka One', cursive" }}
                >
                  ({targetCoord.x}, {targetCoord.y})
                </div>
              </div>
              <motion.button
                whileTap={{ scale: 0.92 }}
                onPointerDown={handleShoot}
                className="px-7 py-4 rounded-xl font-black text-white text-lg flex items-center gap-2"
                style={{
                  fontFamily: "'Fredoka One', cursive",
                  background: "linear-gradient(180deg, #FF6B35 0%, #E55A2B 100%)",
                  border: "3px solid rgba(255,255,255,0.3)",
                  boxShadow: "0 5px 0 #B84A1F",
                  minWidth: "120px",
                  touchAction: "manipulation",
                }}
              >
                <Zap className="w-5 h-5" />
                ¡TIRAR!
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── DIRECTIONS LEVEL: auto-shoot hint ── */}
      <AnimatePresence>
        {phase === "aiming" && targetCoord && isDirections && (
          <motion.div
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            className="relative z-20 px-4 flex-shrink-0 text-center"
            style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom, 20px))" }}
          >
            <div className="text-white/60 text-sm font-bold">
              ⚽ Disparando hacia ({targetCoord.x}, {targetCoord.y})...
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Phase Indicator ──────────────────────────────────────────
function PhaseIndicator({ phase }: { phase: string }) {
  const labels: Record<string, { text: string; color: string; icon: string }> = {
    aiming: { text: "¡Toca la portería para apuntar!", color: "#FFD700", icon: "🎯" },
    math: { text: "¡Resuelve para potenciar el tiro!", color: "#FF6B35", icon: "⚡" },
    shooting: { text: "¡Volando!", color: "#2ECC40", icon: "⚽" },
    result: { text: "Resultado", color: "#FFD700", icon: "📊" },
    celebrating: { text: "¡Celebrando!", color: "#FFD700", icon: "🎉" },
  };
  const info = labels[phase] ?? labels.aiming;

  return (
    <motion.div
      key={phase}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-2 px-4 py-1.5 rounded-full flex-shrink-0"
      style={{ background: `${info.color}22`, border: `1.5px solid ${info.color}60` }}
    >
      <span className="text-sm">{info.icon}</span>
      <span className="text-xs font-black" style={{ color: info.color, fontFamily: "'Fredoka One', cursive" }}>
        {info.text}
      </span>
    </motion.div>
  );
}

// ── Grid Lines (visual only, no pointer events) ──────────────
function GridLines({ gridMin, gridMax }: { gridMin: number; gridMax: number }) {
  const range = gridMax - gridMin;
  const lines: React.ReactNode[] = [];
  const labels: React.ReactNode[] = [];

  for (let i = gridMin; i <= gridMax; i++) {
    const pct = ((i - gridMin) / range) * 100;
    lines.push(
      <div key={`vl${i}`} className="absolute top-0 bottom-0" style={{
        left: `${pct}%`, width: i === 0 ? "2px" : "1px",
        background: i === 0 ? "rgba(55,66,250,0.95)" : "rgba(55,66,250,0.4)",
        pointerEvents: "none",
      }} />,
      <div key={`hl${i}`} className="absolute left-0 right-0" style={{
        top: `${100 - pct}%`, height: i === 0 ? "2px" : "1px",
        background: i === 0 ? "rgba(55,66,250,0.95)" : "rgba(55,66,250,0.4)",
        pointerEvents: "none",
      }} />
    );
    if (i !== 0) {
      labels.push(
        <div key={`xl${i}`} className="absolute text-blue-200 font-black select-none"
          style={{ left: `${pct}%`, bottom: "3px", transform: "translateX(-50%)", fontSize: "9px", textShadow: "1px 1px 2px rgba(0,0,0,0.9)", zIndex: 5, pointerEvents: "none" }}>
          {i}
        </div>,
        <div key={`yl${i}`} className="absolute text-blue-200 font-black select-none"
          style={{ top: `${100 - pct}%`, left: "3px", transform: "translateY(-50%)", fontSize: "9px", textShadow: "1px 1px 2px rgba(0,0,0,0.9)", zIndex: 5, pointerEvents: "none" }}>
          {i}
        </div>
      );
    }
  }

  return (
    <div className="absolute inset-0" style={{ pointerEvents: "none" }}>
      {lines}
      {labels}
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
      className="relative z-30 flex-shrink-0 rounded-t-3xl px-4 pt-4"
      style={{
        paddingBottom: "max(20px, env(safe-area-inset-bottom, 20px))",
        background: "linear-gradient(180deg, #1a1a2e 0%, #0f3460 100%)",
        border: "3px solid #3742FA",
        borderBottom: "none",
        boxShadow: "0 -8px 30px rgba(55,66,250,0.5)",
      }}
    >
      {/* Timer bar */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.1)" }}>
          <motion.div
            animate={{ width: `${timePct}%` }}
            transition={{ duration: 1, ease: "linear" }}
            className="h-full rounded-full"
            style={{ background: timeColor }}
          />
        </div>
        <span className="font-black text-sm w-7 text-right" style={{ color: timeColor, fontFamily: "'Fredoka One', cursive" }}>
          {timeLeft}
        </span>
      </div>

      {/* Label */}
      <div className="text-center mb-3">
        <div
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black"
          style={{ background: "rgba(255,107,53,0.2)", color: "#FF6B35", border: "1.5px solid #FF6B35" }}
        >
          ⚡ RESUELVE PARA POTENCIAR TU TIRO
        </div>
      </div>

      {/* Question */}
      <div
        className="text-white font-black text-center mb-4"
        style={{
          fontFamily: "'Fredoka One', cursive",
          fontSize: "clamp(22px, 6vw, 32px)",
          textShadow: "2px 2px 0 rgba(0,0,0,0.5)",
          lineHeight: 1.2,
        }}
      >
        {challenge.question}
      </div>

      {hintsEnabled && challenge.hint && (
        <div className="text-yellow-300/80 text-xs text-center mb-3 font-bold">💡 {challenge.hint}</div>
      )}

      {/* Options — large touch targets */}
      {challenge.options && (
        <div className="grid grid-cols-2 gap-3">
          {challenge.options.map((opt) => (
            <motion.button
              key={opt}
              whileTap={{ scale: 0.9 }}
              onPointerDown={() => handleAnswer(opt)}
              disabled={answered}
              className="rounded-2xl font-black text-white flex items-center justify-center"
              style={{
                fontFamily: "'Fredoka One', cursive",
                fontSize: "clamp(20px, 5vw, 28px)",
                height: "64px",
                background: answered ? "rgba(55,66,250,0.4)" : "linear-gradient(180deg, #3742FA 0%, #2C35D4 100%)",
                border: "3px solid rgba(255,255,255,0.25)",
                boxShadow: answered ? "none" : "0 5px 0 rgba(0,0,0,0.4)",
                touchAction: "manipulation",
                transition: "all 0.15s cubic-bezier(0.23, 1, 0.32, 1)",
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
    <div className="absolute inset-0 z-40 overflow-hidden" style={{ pointerEvents: "none" }}>
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-sm"
          style={{
            left: `${p.x * 100}%`,
            top: `${p.y * 100}%`,
            width: p.size,
            height: p.size,
            background: p.color,
            opacity: Math.max(0, p.life),
            transform: `rotate(${p.x * 360}deg)`,
          }}
        />
      ))}
    </div>
  );
}

// ── Floating Text Layer ──────────────────────────────────────
function FloatingTextLayer({ texts }: { texts: any[] }) {
  const sizeMap: Record<string, string> = { sm: "14px", md: "18px", lg: "26px", xl: "38px" };
  return (
    <div className="absolute inset-0 z-50 overflow-hidden" style={{ pointerEvents: "none" }}>
      {texts.map((t) => (
        <div
          key={t.id}
          className="absolute font-black text-center whitespace-nowrap"
          style={{
            left: `${t.x * 100}%`,
            top: `${t.y * 100}%`,
            transform: "translate(-50%, -50%)",
            color: t.color,
            fontSize: sizeMap[t.size] ?? "20px",
            fontFamily: "'Fredoka One', cursive",
            textShadow: "2px 2px 0 rgba(0,0,0,0.9)",
            opacity: Math.max(0, t.life),
          }}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}
