// =============================================================
// TIRO LIBRE MATEMÁTICO — Defeat Screen
// Design: Pixel Champions — Encouraging, not punishing
// =============================================================

import { motion } from "framer-motion";
import { useGame } from "../engine/GameContext";
import { sounds } from "../engine/soundSystem";

export default function DefeatScreen() {
  const { state, goToScreen, startLevel } = useGame();
  const { levelConfig, shotsScored, shotsTaken } = state;

  if (!levelConfig) return null;

  const encouragements = [
    "¡Casi lo logras! Inténtalo de nuevo.",
    "¡Los campeones no se rinden!",
    "¡Cada intento te hace más fuerte!",
    "¡La próxima vez será tuya!",
    "¡Sigue practicando, eres increíble!",
  ];
  const msg = encouragements[Math.floor(Math.random() * encouragements.length)];

  return (
    <div
      className="relative w-full min-h-dvh flex flex-col items-center justify-center overflow-hidden"
      style={{ background: "linear-gradient(180deg, #1a0a0a 0%, #1a1a2e 100%)" }}
    >
      <div className="relative z-10 flex flex-col items-center gap-6 px-6 py-8 w-full max-w-sm">
        {/* Emoji */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
          className="text-7xl"
        >
          😤
        </motion.div>

        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-center"
        >
          <div
            className="text-3xl font-black text-red-400"
            style={{ fontFamily: "'Fredoka One', cursive", textShadow: "3px 3px 0 #8B0000" }}
          >
            ¡Sigue Intentando!
          </div>
          <div className="text-white/70 text-sm mt-2 font-bold">{msg}</div>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="w-full rounded-2xl p-4"
          style={{ background: "rgba(255,255,255,0.05)", border: "2px solid rgba(255,255,255,0.1)" }}
        >
          <div className="text-center text-white/60 text-sm mb-2">Tu progreso</div>
          <div className="flex justify-around">
            <div className="text-center">
              <div className="text-green-400 font-black text-2xl" style={{ fontFamily: "'Fredoka One', cursive" }}>
                {shotsScored}
              </div>
              <div className="text-white/50 text-xs">Goles</div>
            </div>
            <div className="text-center">
              <div className="text-white font-black text-2xl" style={{ fontFamily: "'Fredoka One', cursive" }}>
                {levelConfig.shotsRequired}
              </div>
              <div className="text-white/50 text-xs">Necesitabas</div>
            </div>
          </div>
          {/* Progress bar */}
          <div className="mt-3 h-3 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.1)" }}>
            <div
              className="h-full rounded-full"
              style={{
                width: `${(shotsScored / levelConfig.shotsRequired) * 100}%`,
                background: "linear-gradient(90deg, #FF6B35, #FFD700)",
              }}
            />
          </div>
          <div className="text-center text-white/40 text-xs mt-1">
            {shotsScored}/{levelConfig.shotsRequired} goles
          </div>
        </motion.div>

        {/* Tip */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="w-full rounded-xl p-3"
          style={{ background: "rgba(55,66,250,0.2)", border: "2px solid rgba(55,66,250,0.4)" }}
        >
          <div className="text-blue-300 text-xs font-bold mb-1">💡 Consejo</div>
          <div className="text-white/70 text-xs">
            Responde las multiplicaciones rápido para tener más potencia en tu tiro.
          </div>
        </motion.div>

        {/* Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="w-full flex flex-col gap-3"
        >
          <motion.button
            whileTap={{ scale: 0.95 }}
            onPointerDown={() => { sounds.click(); startLevel(levelConfig.id); }}
            className="w-full py-4 rounded-2xl font-black text-xl text-white"
            style={{
              fontFamily: "'Fredoka One', cursive",
              background: "linear-gradient(180deg, #FF6B35 0%, #E55A2B 100%)",
              border: "3px solid rgba(255,255,255,0.3)",
              boxShadow: "0 5px 0 #B84A1F",
              touchAction: "manipulation",
            }}
          >
            🔄 ¡Intentar de Nuevo!
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onPointerDown={() => { sounds.click(); goToScreen("level-select"); }}
            className="w-full py-4 rounded-2xl font-black text-base text-white/70"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "2px solid rgba(255,255,255,0.1)",
              touchAction: "manipulation",
            }}
          >
            📋 Elegir Nivel
          </motion.button>
        </motion.div>
      </div>
    </div>
  );
}
