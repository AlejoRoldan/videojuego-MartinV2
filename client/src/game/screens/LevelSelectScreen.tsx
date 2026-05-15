// =============================================================
// TIRO LIBRE MATEMÁTICO — Level Select Screen v2
// Design: Pixel Champions — Mobile-first, large touch targets
// =============================================================

import { motion } from "framer-motion";
import { useGame } from "../engine/GameContext";
import { LEVELS, CONCEPT_ICONS } from "../levels/levelData";
import { ArrowLeft, Lock, Star } from "lucide-react";
import { sounds } from "../engine/soundSystem";

export default function LevelSelectScreen() {
  const { goToScreen, startLevel, playerProfile } = useGame();

  return (
    <div
      className="relative w-full min-h-dvh flex flex-col"
      style={{ background: "linear-gradient(180deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)" }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-safe pt-5 pb-4">
        <button
          onPointerDown={() => { sounds.click(); goToScreen("home"); }}
          className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 active:scale-95"
          style={{
            background: "rgba(255,255,255,0.12)",
            border: "2px solid rgba(255,255,255,0.25)",
            touchAction: "manipulation",
          }}
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <div>
          <h1
            className="text-2xl font-black text-white leading-none"
            style={{ fontFamily: "'Fredoka One', cursive" }}
          >
            Seleccionar Nivel
          </h1>
          <p className="text-blue-300 text-sm font-bold mt-0.5">
            {playerProfile.stars} ⭐ · {Object.keys(playerProfile.completedLevels).length}/{LEVELS.length} completados
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-4 mb-4">
        <div className="h-3 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.1)" }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{
              width: `${(Object.keys(playerProfile.completedLevels).length / LEVELS.length) * 100}%`,
            }}
            transition={{ duration: 1, delay: 0.3, ease: [0.23, 1, 0.32, 1] }}
            className="h-full rounded-full"
            style={{ background: "linear-gradient(90deg, #FF6B35, #FFD700)" }}
          />
        </div>
      </div>

      {/* Levels list — single column on mobile for bigger cards */}
      <div className="flex-1 overflow-y-auto px-4 pb-8">
        <div className="flex flex-col gap-3">
          {LEVELS.map((level, index) => {
            const isUnlocked = playerProfile.unlockedLevels.includes(level.id);
            const progress = playerProfile.completedLevels[level.id];
            const starsEarned = progress?.stars ?? 0;

            return (
              <motion.div
                key={level.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.35, delay: index * 0.06, ease: [0.23, 1, 0.32, 1] }}
              >
                <LevelCard
                  level={level}
                  isUnlocked={isUnlocked}
                  starsEarned={starsEarned}
                  onPlay={() => {
                    sounds.click();
                    startLevel(level.id);
                  }}
                />
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function LevelCard({
  level,
  isUnlocked,
  starsEarned,
  onPlay,
}: {
  level: (typeof LEVELS)[0];
  isUnlocked: boolean;
  starsEarned: number;
  onPlay: () => void;
}) {
  const difficultyColors = {
    easy: "#2ECC40",
    medium: "#FFD700",
    hard: "#FF4757",
  };
  const difficultyLabels = { easy: "Fácil", medium: "Medio", hard: "Difícil" };

  const levelColors = [
    "#FF6B35", "#3742FA", "#2ECC40", "#FFD700",
    "#FF4757", "#7BED9F", "#A29BFE", "#FFA502",
  ];
  const cardColor = levelColors[(level.id - 1) % levelColors.length];

  return (
    <motion.button
      whileTap={isUnlocked ? { scale: 0.97 } : {}}
      onPointerDown={isUnlocked ? onPlay : undefined}
      disabled={!isUnlocked}
      className="w-full text-left rounded-2xl overflow-hidden relative flex items-center gap-4"
      style={{
        background: isUnlocked
          ? `linear-gradient(135deg, ${cardColor}22 0%, ${cardColor}11 100%)`
          : "rgba(255,255,255,0.05)",
        border: `3px solid ${isUnlocked ? cardColor : "rgba(255,255,255,0.1)"}`,
        boxShadow: isUnlocked ? `0 4px 0 ${cardColor}55, 0 8px 20px rgba(0,0,0,0.3)` : "none",
        opacity: isUnlocked ? 1 : 0.55,
        padding: "14px 16px",
        minHeight: "80px",
        touchAction: "manipulation",
      }}
    >
      {/* Level number badge */}
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center font-black text-2xl text-white flex-shrink-0"
        style={{
          background: isUnlocked ? cardColor : "rgba(255,255,255,0.15)",
          fontFamily: "'Fredoka One', cursive",
          boxShadow: isUnlocked ? `0 4px 0 rgba(0,0,0,0.3)` : "none",
        }}
      >
        {isUnlocked ? CONCEPT_ICONS[level.concept] : <Lock className="w-6 h-6 text-white/50" />}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-white/50 text-xs font-bold">Nivel {level.id}</span>
          <span
            className="text-xs font-black px-2 py-0.5 rounded-full"
            style={{
              background: `${difficultyColors[level.mathDifficulty]}22`,
              color: difficultyColors[level.mathDifficulty],
              border: `1px solid ${difficultyColors[level.mathDifficulty]}55`,
            }}
          >
            {difficultyLabels[level.mathDifficulty]}
          </span>
        </div>
        <div
          className="font-black text-white text-base leading-tight"
          style={{ fontFamily: "'Fredoka One', cursive" }}
        >
          {level.name}
        </div>
        <div className="text-white/55 text-xs mt-0.5 leading-tight truncate">
          {level.description}
        </div>
      </div>

      {/* Stars */}
      <div className="flex flex-col items-center gap-1 flex-shrink-0">
        {isUnlocked && (
          <div className="flex gap-0.5">
            {[1, 2, 3].map((s) => (
              <Star
                key={s}
                className="w-4 h-4"
                style={{
                  fill: s <= starsEarned ? "#FFD700" : "transparent",
                  color: s <= starsEarned ? "#FFD700" : "rgba(255,255,255,0.25)",
                }}
              />
            ))}
          </div>
        )}
        {isUnlocked && (
          <div
            className="px-3 py-1.5 rounded-xl font-black text-white text-sm"
            style={{
              background: cardColor,
              fontFamily: "'Fredoka One', cursive",
              boxShadow: `0 3px 0 rgba(0,0,0,0.3)`,
            }}
          >
            {starsEarned > 0 ? "Jugar" : "¡Jugar!"}
          </div>
        )}
        {!isUnlocked && (
          <Lock className="w-5 h-5 text-white/30" />
        )}
      </div>
    </motion.button>
  );
}
