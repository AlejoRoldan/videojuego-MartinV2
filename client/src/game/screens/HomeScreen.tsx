// =============================================================
// TIRO LIBRE MATEMÁTICO — Home Screen
// Design: Pixel Champions — Bold cartoon, vibrant colors
// =============================================================

import { motion } from "framer-motion";
import { useGame } from "../engine/GameContext";
import { sounds } from "../engine/soundSystem";

const HOME_BG = "https://d2xsxph8kpxj0f.cloudfront.net/310519663638628604/YvKFUvGtEph4XyT2Rde5AJ/game-home-bg-KNACZmxggfLAynjyvZYg3e.webp";
const PLAYER_IMG = "https://d2xsxph8kpxj0f.cloudfront.net/310519663638628604/YvKFUvGtEph4XyT2Rde5AJ/game-player-SZu757xkaDBb7ZA9f4TAtJ.webp";

export default function HomeScreen() {
  const { goToScreen, playerProfile } = useGame();

  const handleNav = (screen: Parameters<typeof goToScreen>[0]) => {
    sounds.click();
    goToScreen(screen);
  };

  return (
    <div
      className="relative w-full h-full overflow-hidden flex flex-col items-center justify-between"
      style={{ minHeight: "100dvh" }}
    >
      {/* Background */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${HOME_BG})` }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/60" />

      {/* Top HUD bar */}
      <motion.div
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
        className="relative z-10 w-full flex items-center justify-between px-4 pt-4"
      >
        {/* Player info */}
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-2xl"
          style={{
            background: "rgba(0,0,0,0.7)",
            border: "3px solid #FFD700",
            boxShadow: "0 4px 0 #B8860B",
          }}
        >
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-black"
            style={{ background: "#FF6B35", border: "2px solid #fff" }}
          >
            {playerProfile.name[0]}
          </div>
          <div>
            <div className="text-white font-black text-xs leading-none">{playerProfile.name}</div>
            <div className="text-yellow-300 font-bold text-xs">Nv. {playerProfile.level}</div>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-2">
          <StatBadge icon="⭐" value={playerProfile.stars} color="#FFD700" />
          <StatBadge icon="🪙" value={playerProfile.coins} color="#FFA502" />
        </div>
      </motion.div>

      {/* Center: Logo + Player */}
      <div className="relative z-10 flex flex-col items-center gap-0 mt-4">
        {/* Logo */}
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.23, 1, 0.32, 1] }}
          className="text-center"
        >
          <div
            className="text-5xl font-black leading-none tracking-tight"
            style={{
              fontFamily: "'Fredoka One', cursive",
              color: "#FFD700",
              textShadow: "4px 4px 0 #B8860B, 0 0 30px rgba(255,215,0,0.5)",
              WebkitTextStroke: "2px #B8860B",
            }}
          >
            TIRO LIBRE
          </div>
          <div
            className="text-3xl font-black leading-none tracking-tight"
            style={{
              fontFamily: "'Fredoka One', cursive",
              color: "#fff",
              textShadow: "3px 3px 0 #3742FA, 0 0 20px rgba(55,66,250,0.5)",
              WebkitTextStroke: "1.5px #3742FA",
            }}
          >
            MATEMÁTICO
          </div>
          {/* Stars decoration */}
          <div className="flex justify-center gap-1 mt-1">
            {[...Array(5)].map((_, i) => (
              <motion.span
                key={i}
                animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.2, 1] }}
                transition={{ duration: 2, delay: i * 0.2, repeat: Infinity }}
                className="text-yellow-400 text-lg"
              >
                ⭐
              </motion.span>
            ))}
          </div>
        </motion.div>

        {/* Player character */}
        <motion.img
          src={PLAYER_IMG}
          alt="Jugador"
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.3, ease: [0.23, 1, 0.32, 1] }}
          className="w-40 h-auto drop-shadow-2xl"
          style={{ filter: "drop-shadow(0 8px 16px rgba(0,0,0,0.5))" }}
        />
      </div>

      {/* Bottom: Buttons */}
      <motion.div
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.4, ease: [0.23, 1, 0.32, 1] }}
        className="relative z-10 w-full max-w-sm px-4 pb-8 flex flex-col gap-3"
      >
        {/* JUGAR button */}
        <motion.button
          whileTap={{ scale: 0.95 }}
          whileHover={{ scale: 1.03 }}
          onPointerDown={() => handleNav("level-select")}
          className="w-full py-4 rounded-2xl font-black text-2xl text-white flex items-center justify-center gap-3"
          style={{
            fontFamily: "'Fredoka One', cursive",
            background: "linear-gradient(180deg, #FF6B35 0%, #E55A2B 100%)",
            border: "4px solid #fff",
            boxShadow: "0 6px 0 #B84A1F, 0 8px 20px rgba(255,107,53,0.4)",
            transition: "all 0.15s cubic-bezier(0.23, 1, 0.32, 1)",
            touchAction: "manipulation",
          }}
        >
          ⚽ JUGAR
        </motion.button>

        {/* Secondary buttons */}
        <div className="flex gap-3">
          <SecondaryButton
            icon="🏆"
            label="Logros"
            onClick={() => handleNav("progress")}
            color="#3742FA"
          />
          <SecondaryButton
            icon="👤"
            label="Perfil"
            onClick={() => handleNav("profile")}
            color="#2ECC40"
          />
          <SecondaryButton
            icon="🎓"
            label="Tutorial"
            onClick={() => handleNav("tutorial")}
            color="#FFD700"
          />
        </div>
      </motion.div>

      {/* Floating math symbols decoration */}
      <FloatingMathSymbols />
    </div>
  );
}

function StatBadge({ icon, value, color }: { icon: string; value: number; color: string }) {
  return (
    <div
      className="flex items-center gap-1 px-3 py-1.5 rounded-xl"
      style={{
        background: "rgba(0,0,0,0.7)",
        border: `2px solid ${color}`,
        boxShadow: `0 3px 0 rgba(0,0,0,0.5)`,
      }}
    >
      <span className="text-sm">{icon}</span>
      <span className="text-white font-black text-sm">{value.toLocaleString()}</span>
    </div>
  );
}

function SecondaryButton({
  icon,
  label,
  onClick,
  color,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  color: string;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.93 }}
      whileHover={{ scale: 1.05 }}
      onPointerDown={onClick}
      className="flex-1 py-3 rounded-xl font-black text-white flex flex-col items-center gap-1"
      style={{
        fontFamily: "'Fredoka One', cursive",
        background: `linear-gradient(180deg, ${color} 0%, ${color}CC 100%)`,
        border: "3px solid rgba(255,255,255,0.3)",
        boxShadow: `0 4px 0 rgba(0,0,0,0.3)`,
        fontSize: "11px",
        transition: "all 0.15s cubic-bezier(0.23, 1, 0.32, 1)",
        touchAction: "manipulation",
        minHeight: "60px",
      }}
    >
      <span className="text-xl">{icon}</span>
      {label}
    </motion.button>
  );
}

function FloatingMathSymbols() {
  const symbols = ["×", "+", "÷", "=", "²", "π", "∑", "√"];
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {symbols.map((sym, i) => (
        <motion.div
          key={i}
          className="absolute font-black text-white/20 select-none"
          style={{
            fontFamily: "'Fredoka One', cursive",
            fontSize: `${20 + Math.random() * 20}px`,
            left: `${10 + (i / symbols.length) * 80}%`,
            top: `${20 + Math.sin(i) * 30}%`,
          }}
          animate={{
            y: [-10, 10, -10],
            rotate: [-5, 5, -5],
            opacity: [0.1, 0.3, 0.1],
          }}
          transition={{
            duration: 3 + i * 0.5,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          {sym}
        </motion.div>
      ))}
    </div>
  );
}
