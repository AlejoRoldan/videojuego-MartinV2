// =============================================================
// TIRO LIBRE MATEMÁTICO — Home Screen
// Design: Pixel Champions — Bold cartoon, vibrant colors
// =============================================================

import { motion } from "framer-motion";
import { useState } from "react";
import { useGame } from "../engine/GameContext";
import { sounds } from "../engine/soundSystem";
import {
  GAME_PACE_CONFIG,
  loadGamePace,
  saveGamePace,
  type GamePace,
} from "../engine/gamePace";

const HOME_BG = "/math-stadium-hero.png";
const GAME_PACES: GamePace[] = ["easy", "medium", "match", "hard"];

export default function HomeScreen() {
  const { goToScreen, playerProfile } = useGame();
  const [gamePace, setGamePace] = useState<GamePace>(loadGamePace);

  const handleNav = (screen: Parameters<typeof goToScreen>[0]) => {
    sounds.click();
    goToScreen(screen);
  };

  const handlePaceChange = (pace: GamePace) => {
    sounds.click();
    setGamePace(pace);
    saveGamePace(pace);
  };

  return (
    <div
      className="relative w-full h-full overflow-hidden flex flex-col items-center justify-between"
      style={{ minHeight: "100dvh" }}
    >
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${HOME_BG})` }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/60" />

      <motion.div
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
        className="relative z-10 w-full flex items-center justify-between px-4 pt-4"
      >
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

        <div className="flex items-center gap-2">
          <StatBadge icon="⭐" value={playerProfile.stars} color="#FFD700" />
          <StatBadge icon="🪙" value={playerProfile.coins} color="#FFA502" />
        </div>
      </motion.div>

      <div className="relative z-10 flex flex-col items-center gap-0 mt-2">
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

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.25 }}
          className="mt-2 rounded-full px-4 py-1.5"
          style={{
            background: "rgba(5, 12, 28, 0.78)",
            border: "2px solid rgba(255,215,0,0.65)",
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
          }}
        >
          <span className="text-white text-xs font-black">Tu próximo gol empieza con una buena idea</span>
        </motion.div>
      </div>

      <motion.div
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.4, ease: [0.23, 1, 0.32, 1] }}
        className="relative z-10 w-full max-w-sm px-4 pb-6 flex flex-col gap-2"
      >
        <MissionCard progress={playerProfile.missionProgress} completions={playerProfile.missionCompletions} />

        <div
          className="rounded-2xl px-3 py-2"
          style={{
            background: "rgba(5, 12, 28, 0.82)",
            border: "2px solid rgba(255,255,255,0.2)",
            boxShadow: "0 4px 14px rgba(0,0,0,0.3)",
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-white font-black text-xs">⏱ TIEMPO PARA PENSAR</span>
            <span className="text-white/70 text-[10px]">Puedes cambiarlo cuando quieras</span>
          </div>

          <div className="grid grid-cols-4 gap-1">
            {GAME_PACES.map((pace) => {
              const selected = pace === gamePace;
              const icon = pace === "easy" ? "😌" : pace === "medium" ? "⚡" : pace === "match" ? "🏟️" : "🔥";
              return (
                <motion.button
                  key={pace}
                  whileTap={{ scale: 0.94 }}
                  onClick={() => handlePaceChange(pace)}
                  aria-pressed={selected}
                  className="rounded-xl py-2 px-1 flex flex-col items-center justify-center"
                  style={{
                    background: selected ? "#FFD700" : "rgba(255,255,255,0.1)",
                    border: selected ? "2px solid white" : "2px solid rgba(255,255,255,0.12)",
                    color: selected ? "#231900" : "white",
                    boxShadow: selected ? "0 3px 0 #B8860B" : "none",
                    touchAction: "manipulation",
                  }}
                >
                  <span className="text-lg leading-none">{icon}</span>
                  <span className="text-[10px] leading-tight font-black mt-1">{GAME_PACE_CONFIG[pace].label}</span>
                </motion.button>
              );
            })}
          </div>

          <div className="text-center text-white/75 text-[10px] mt-1.5">
            {GAME_PACE_CONFIG[gamePace].description}
          </div>
        </div>

        <motion.button
          whileTap={{ scale: 0.95 }}
          whileHover={{ scale: 1.03 }}
          onClick={() => handleNav("level-select")}
          className="w-full py-3 rounded-2xl font-black text-2xl text-white flex items-center justify-center gap-3"
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

      <FloatingMathSymbols />
    </div>
  );
}

function MissionCard({ progress, completions }: { progress: number; completions: number }) {
  const percent = Math.min(100, (progress / 3) * 100);
  return (
    <div
      aria-label={`Misión: marca tres goles. Progreso ${progress} de 3`}
      className="rounded-2xl px-3 py-2"
      style={{
        background: "linear-gradient(110deg, rgba(23, 38, 88, 0.94), rgba(10, 93, 76, 0.9))",
        border: "2px solid rgba(125, 255, 214, 0.6)",
        boxShadow: "0 5px 16px rgba(0,0,0,0.32)",
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[#7DFFD6] text-[11px] font-black tracking-wide">🎯 MISIÓN DE LA CANCHA</div>
          <div className="text-white text-xs font-bold mt-0.5">Marca 3 goles y gana +15 monedas +1 estrella</div>
        </div>
        <div className="text-white font-black text-lg" style={{ fontFamily: "'Fredoka One', cursive" }}>{progress}/3</div>
      </div>
      <div className="h-2 rounded-full overflow-hidden mt-2" style={{ background: "rgba(0,0,0,0.3)" }}>
        <motion.div animate={{ width: `${percent}%` }} transition={{ duration: 0.35 }} className="h-full rounded-full" style={{ background: "linear-gradient(90deg, #7DFFD6, #FFD166)" }} />
      </div>
      <div className="text-white/65 text-[10px] mt-1">{completions > 0 ? `Misiones completadas: ${completions}` : "Una meta corta para empezar con impulso"}</div>
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
      onClick={onClick}
      className="flex-1 py-2.5 rounded-xl font-black text-white flex flex-col items-center gap-1"
      style={{
        fontFamily: "'Fredoka One', cursive",
        background: `linear-gradient(180deg, ${color} 0%, ${color}CC 100%)`,
        border: "3px solid rgba(255,255,255,0.3)",
        boxShadow: "0 4px 0 rgba(0,0,0,0.3)",
        fontSize: "11px",
        transition: "all 0.15s cubic-bezier(0.23, 1, 0.32, 1)",
        touchAction: "manipulation",
        minHeight: "54px",
      }}
    >
      <span className="text-lg">{icon}</span>
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
