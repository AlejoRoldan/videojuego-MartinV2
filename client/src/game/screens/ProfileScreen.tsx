// =============================================================
// TIRO LIBRE MATEMÁTICO — Profile Screen v2
// Design: Pixel Champions — Player card and customization
// FIXES: All buttons use onPointerDown + touchAction:manipulation + sounds
// =============================================================

import { motion } from "framer-motion";
import { useGame } from "../engine/GameContext";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { sounds } from "../engine/soundSystem";

const PLAYER_IMG = "https://d2xsxph8kpxj0f.cloudfront.net/310519663638628604/YvKFUvGtEph4XyT2Rde5AJ/game-player-SZu757xkaDBb7ZA9f4TAtJ.webp";

const BALL_OPTIONS = [
  { id: "default", icon: "⚽", name: "Clásico", cost: 0 },
  { id: "fire", icon: "🔥", name: "Fuego", cost: 100 },
  { id: "golden", icon: "🌟", name: "Dorado", cost: 200 },
  { id: "lightning", icon: "⚡", name: "Rayo", cost: 150 },
];

export default function ProfileScreen() {
  const { goToScreen, playerProfile, updateProfile } = useGame();
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(playerProfile.name);

  const accuracy = playerProfile.totalShots > 0
    ? Math.round((playerProfile.totalGoals / playerProfile.totalShots) * 100)
    : 0;

  const xpToNext = 100 * playerProfile.level;
  const xpProgress = (playerProfile.xp % xpToNext) / xpToNext * 100;

  const handleSaveName = () => {
    if (nameInput.trim()) {
      sounds.click();
      updateProfile({ name: nameInput.trim() });
    }
    setEditingName(false);
  };

  return (
    <div
      className="relative w-full min-h-dvh flex flex-col"
      style={{ background: "linear-gradient(180deg, #1a1a2e 0%, #0f3460 100%)" }}
    >
      {/* Header */}
      <motion.div
        initial={{ y: -60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="flex items-center gap-3 px-4 pb-4"
        style={{ paddingTop: "max(24px, env(safe-area-inset-top, 24px))" }}
      >
        <button
          onPointerDown={() => { sounds.click(); goToScreen("home"); }}
          className="w-12 h-12 rounded-xl flex items-center justify-center active:scale-95"
          style={{
            background: "rgba(255,255,255,0.1)",
            border: "2px solid rgba(255,255,255,0.2)",
            touchAction: "manipulation",
          }}
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <h1
          className="text-2xl font-black text-white"
          style={{ fontFamily: "'Fredoka One', cursive" }}
        >
          Mi Perfil
        </h1>
      </motion.div>

      <div className="flex-1 overflow-y-auto px-4 pb-8 space-y-4">
        {/* Player card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl overflow-hidden"
          style={{
            background: "linear-gradient(135deg, #FF6B35 0%, #3742FA 100%)",
            border: "3px solid rgba(255,255,255,0.3)",
            boxShadow: "0 8px 30px rgba(0,0,0,0.4)",
          }}
        >
          <div className="p-5 flex items-center gap-4">
            <div className="relative">
              <img
                src={PLAYER_IMG}
                alt="Jugador"
                className="w-20 h-20 object-contain drop-shadow-lg"
              />
              <div
                className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center font-black text-xs text-white"
                style={{ background: "#FFD700", border: "2px solid #fff", fontFamily: "'Fredoka One', cursive" }}
              >
                {playerProfile.level}
              </div>
            </div>
            <div className="flex-1">
              {editingName ? (
                <div className="flex gap-2">
                  <input
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSaveName()}
                    className="flex-1 px-2 py-1 rounded-lg font-black text-lg text-white bg-transparent border-2 border-white/50 outline-none"
                    style={{ fontFamily: "'Fredoka One', cursive" }}
                    autoFocus
                    maxLength={12}
                  />
                  <button
                    onPointerDown={handleSaveName}
                    className="px-3 py-1 rounded-lg font-black text-sm text-white"
                    style={{ background: "#2ECC40", touchAction: "manipulation" }}
                  >
                    ✓
                  </button>
                </div>
              ) : (
                <div
                  className="text-2xl font-black text-white flex items-center gap-2"
                  style={{ fontFamily: "'Fredoka One', cursive", touchAction: "manipulation", cursor: "pointer" }}
                  onPointerDown={() => { sounds.click(); setEditingName(true); }}
                >
                  {playerProfile.name}
                  <span className="text-white/50 text-sm">✏️</span>
                </div>
              )}
              <div className="text-white/80 text-sm font-bold">Nivel {playerProfile.level}</div>
              <div className="mt-2 h-2 rounded-full overflow-hidden bg-white/20">
                <div
                  className="h-full rounded-full bg-white"
                  style={{ width: `${xpProgress}%` }}
                />
              </div>
              <div className="text-white/60 text-xs mt-0.5">
                {playerProfile.xp % xpToNext}/{xpToNext} XP para nivel {playerProfile.level + 1}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-3 gap-3"
        >
          {[
            { icon: "⚽", label: "Goles", value: playerProfile.totalGoals },
            { icon: "🎯", label: "Precisión", value: `${accuracy}%` },
            { icon: "⭐", label: "Estrellas", value: playerProfile.stars },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-2xl p-3 text-center"
              style={{ background: "rgba(255,255,255,0.05)", border: "2px solid rgba(255,255,255,0.1)" }}
            >
              <div className="text-2xl">{s.icon}</div>
              <div className="text-white font-black text-lg" style={{ fontFamily: "'Fredoka One', cursive" }}>
                {s.value}
              </div>
              <div className="text-white/50 text-xs">{s.label}</div>
            </div>
          ))}
        </motion.div>

        {/* Ball selection */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-2xl p-4"
          style={{ background: "rgba(255,255,255,0.05)", border: "2px solid rgba(255,255,255,0.1)" }}
        >
          <div className="text-white font-black text-base mb-3" style={{ fontFamily: "'Fredoka One', cursive" }}>
            🎱 Balón
          </div>
          <div className="grid grid-cols-4 gap-2">
            {BALL_OPTIONS.map((ball) => {
              const canAfford = playerProfile.coins >= ball.cost;
              const isSelected = (playerProfile as any).equippedBall === ball.id || ball.id === "default";
              return (
                <button
                  key={ball.id}
                  onPointerDown={() => {
                    if (canAfford) {
                      sounds.click();
                      updateProfile({ equippedBall: ball.id } as any);
                    }
                  }}
                  className="rounded-xl p-2 flex flex-col items-center gap-1 active:scale-95"
                  style={{
                    background: isSelected ? "rgba(255,107,53,0.3)" : "rgba(255,255,255,0.05)",
                    border: `2px solid ${isSelected ? "#FF6B35" : "rgba(255,255,255,0.1)"}`,
                    opacity: canAfford ? 1 : 0.5,
                    touchAction: "manipulation",
                    transition: "transform 0.1s",
                  }}
                >
                  <span className="text-2xl">{ball.icon}</span>
                  <span className="text-white text-xs font-bold">{ball.name}</span>
                  {ball.cost > 0 && (
                    <span className="text-yellow-400 text-xs">🪙{ball.cost}</span>
                  )}
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* Reset button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <button
            onPointerDown={() => {
              if (confirm("¿Resetear todo el progreso?")) {
                localStorage.removeItem("tlm_profile");
                window.location.reload();
              }
            }}
            className="w-full py-3 rounded-xl font-bold text-sm text-red-400 active:scale-95"
            style={{
              background: "rgba(255,71,87,0.1)",
              border: "2px solid rgba(255,71,87,0.3)",
              touchAction: "manipulation",
            }}
          >
            Resetear progreso
          </button>
        </motion.div>
      </div>
    </div>
  );
}
