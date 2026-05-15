// =============================================================
// TIRO LIBRE MATEMÁTICO — Victory Screen
// Design: Pixel Champions — Epic celebration
// =============================================================

import { motion } from "framer-motion";
import { useGame } from "../engine/GameContext";
import { sounds } from "../engine/soundSystem";
import { useEffect, useState } from "react";

export default function VictoryScreen() {
  const { state, goToScreen, startLevel, playerProfile } = useGame();
  const { levelConfig, shotsScored, shotsTaken, score, maxCombo } = state;
  const [starsShown, setStarsShown] = useState(0);

  if (!levelConfig) return null;

  const shotsUsed = shotsTaken;
  const starsEarned =
    shotsUsed <= levelConfig.stars[2] ? 3 : shotsUsed <= levelConfig.stars[1] ? 2 : 1;

  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setStarsShown(i);
      if (i >= starsEarned) clearInterval(interval);
    }, 400);
    return () => clearInterval(interval);
  }, [starsEarned]);

  const nextLevelId = levelConfig.id + 1;
  const hasNextLevel = nextLevelId <= 8;
  const isNextUnlocked = playerProfile.unlockedLevels.includes(nextLevelId);

  return (
    <div
      className="relative w-full min-h-dvh flex flex-col items-center justify-center overflow-hidden"
      style={{ background: "linear-gradient(180deg, #0f3460 0%, #1a1a2e 100%)" }}
    >
      {/* Confetti background */}
      <ConfettiBackground />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center gap-6 px-6 py-8 w-full max-w-sm">
        {/* Victory text */}
        <motion.div
          initial={{ scale: 0, rotate: -10 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
          className="text-center"
        >
          <div className="text-6xl mb-2">🏆</div>
          <div
            className="text-4xl font-black text-yellow-400"
            style={{
              fontFamily: "'Fredoka One', cursive",
              textShadow: "4px 4px 0 #B8860B",
            }}
          >
            ¡VICTORIA!
          </div>
          <div className="text-white/70 text-sm font-bold mt-1">
            Nivel {levelConfig.id}: {levelConfig.name}
          </div>
        </motion.div>

        {/* Stars */}
        <div className="flex gap-4">
          {[1, 2, 3].map((s) => (
            <motion.div
              key={s}
              initial={{ scale: 0, y: -20 }}
              animate={starsShown >= s ? { scale: 1, y: 0 } : { scale: 0, y: -20 }}
              transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
              className="text-5xl"
            >
              {s <= starsEarned ? "⭐" : "☆"}
            </motion.div>
          ))}
        </div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="w-full rounded-2xl p-4 grid grid-cols-3 gap-3"
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "2px solid rgba(255,255,255,0.1)",
          }}
        >
          <StatItem label="Puntos" value={score.toLocaleString()} icon="🎯" />
          <StatItem label="Goles" value={`${shotsScored}/${levelConfig.shotsRequired}`} icon="⚽" />
          <StatItem label="Combo" value={`x${maxCombo}`} icon="🔥" />
        </motion.div>

        {/* Rewards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.0 }}
          className="flex gap-3"
        >
          <RewardBadge icon="⭐" label="XP" value={`+${levelConfig.rewards.xp}`} color="#FFD700" />
          <RewardBadge icon="🪙" label="Monedas" value={`+${levelConfig.rewards.coins}`} color="#FFA502" />
        </motion.div>

        {/* Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2 }}
          className="w-full flex flex-col gap-3"
        >
          {hasNextLevel && isNextUnlocked && (
            <GameButton
              onClick={() => { sounds.click(); startLevel(nextLevelId); }}
              color="#FF6B35"
              shadow="#B84A1F"
            >
              ▶ Siguiente Nivel
            </GameButton>
          )}
          <GameButton
            onClick={() => { sounds.click(); startLevel(levelConfig.id); }}
            color="#3742FA"
            shadow="#2C35D4"
          >
            🔄 Repetir
          </GameButton>
          <GameButton
            onClick={() => { sounds.click(); goToScreen("level-select"); }}
            color="rgba(255,255,255,0.1)"
            shadow="rgba(0,0,0,0.3)"
            textColor="rgba(255,255,255,0.7)"
            border="rgba(255,255,255,0.2)"
          >
            📋 Niveles
          </GameButton>
        </motion.div>
      </div>
    </div>
  );
}

function StatItem({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="text-center">
      <div className="text-xl">{icon}</div>
      <div className="text-white font-black text-lg" style={{ fontFamily: "'Fredoka One', cursive" }}>{value}</div>
      <div className="text-white/50 text-xs">{label}</div>
    </div>
  );
}

function RewardBadge({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  return (
    <div
      className="flex items-center gap-2 px-4 py-2 rounded-xl"
      style={{ background: `${color}22`, border: `2px solid ${color}` }}
    >
      <span className="text-xl">{icon}</span>
      <div>
        <div className="text-white/60 text-xs">{label}</div>
        <div className="font-black text-sm" style={{ color }}>{value}</div>
      </div>
    </div>
  );
}

function GameButton({
  children,
  onClick,
  color,
  shadow,
  textColor = "#fff",
  border = "rgba(255,255,255,0.3)",
}: {
  children: React.ReactNode;
  onClick: () => void;
  color: string;
  shadow: string;
  textColor?: string;
  border?: string;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      whileHover={{ scale: 1.02 }}
      onPointerDown={onClick}
      className="w-full py-4 rounded-2xl font-black text-lg"
      style={{
        fontFamily: "'Fredoka One', cursive",
        background: color,
        color: textColor,
        border: `3px solid ${border}`,
        boxShadow: `0 5px 0 ${shadow}`,
        transition: "all 0.15s cubic-bezier(0.23, 1, 0.32, 1)",
        touchAction: "manipulation",
      }}
    >
      {children}
    </motion.button>
  );
}

function ConfettiBackground() {
  const colors = ["#FF6B35", "#FFD700", "#2ECC40", "#3742FA", "#FF4757", "#7BED9F"];
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {Array.from({ length: 30 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-sm"
          style={{
            width: 8 + Math.random() * 8,
            height: 8 + Math.random() * 8,
            background: colors[i % colors.length],
            left: `${Math.random() * 100}%`,
            top: -20,
          }}
          animate={{
            y: ["0vh", "110vh"],
            rotate: [0, 360 * (Math.random() > 0.5 ? 1 : -1)],
            x: [0, (Math.random() - 0.5) * 100],
          }}
          transition={{
            duration: 2 + Math.random() * 3,
            delay: Math.random() * 2,
            repeat: Infinity,
            ease: "linear",
          }}
        />
      ))}
    </div>
  );
}
