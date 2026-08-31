import { AnimatePresence, motion } from "framer-motion";
import { useGame } from "../engine/GameContext";
import { MATH_POWER_META } from "../engine/mathPowers";

export default function MathPowerOverlay() {
  const { state } = useGame();
  const power = state.currentMathPower;

  if (state.screen !== "gameplay" || !power || state.phase === "math" || state.phase === "result") return null;

  const meta = MATH_POWER_META[power];
  const isPerfect = power === "perfect";

  return (
    <AnimatePresence>
      <motion.div
        key={`${power}-${state.shotsTaken}`}
        initial={{ opacity: 0, scale: 0.75, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 1.1 }}
        transition={{ type: "spring", stiffness: 320, damping: 22 }}
        style={{
          position: "fixed",
          top: "max(92px, env(safe-area-inset-top, 92px))",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 80,
          pointerEvents: "none",
          width: "min(88vw, 350px)",
          textAlign: "center",
        }}
      >
        <motion.div
          animate={isPerfect ? { scale: [1, 1.05, 1], filter: ["brightness(1)", "brightness(1.35)", "brightness(1)"] } : undefined}
          transition={isPerfect ? { duration: 0.9, repeat: Infinity } : undefined}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "9px 16px",
            borderRadius: 999,
            background: isPerfect
              ? "linear-gradient(90deg, rgba(255,107,53,.96), rgba(255,215,0,.96))"
              : "rgba(10,15,35,.92)",
            border: isPerfect ? "3px solid white" : "2px solid #FFD700",
            boxShadow: isPerfect
              ? "0 0 28px rgba(255,215,0,.85)"
              : "0 6px 20px rgba(0,0,0,.45)",
            color: "white",
            fontFamily: "'Fredoka One', cursive",
            fontWeight: 900,
          }}
        >
          <span style={{ fontSize: 24 }}>{meta.icon}</span>
          <span>{meta.shortLabel}</span>
          {isPerfect && state.phase === "shooting" && <span style={{ fontSize: 11 }}>• CÁMARA LENTA</span>}
        </motion.div>

        {state.phase === "aiming" && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              marginTop: 5,
              color: "rgba(255,255,255,.9)",
              fontSize: 11,
              fontWeight: 700,
              textShadow: "0 2px 4px rgba(0,0,0,.8)",
            }}
          >
            {meta.description}
          </motion.div>
        )}
      </motion.div>

      {isPerfect && state.phase === "shooting" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.08, 0.22, 0.08] }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, repeat: Infinity }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 60,
            pointerEvents: "none",
            background: "radial-gradient(circle at 50% 48%, rgba(255,255,255,.12), rgba(255,215,0,.18) 35%, rgba(0,0,0,.3) 100%)",
          }}
        />
      )}
    </AnimatePresence>
  );
}
