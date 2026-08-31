// =============================================================
// TIRO LIBRE MATEMÁTICO — Progress Screen
// Design: Pixel Champions — Player stats and achievements
// =============================================================

import { motion } from "framer-motion";
import { useGame } from "../engine/GameContext";
import { LEVELS, CONCEPT_LABELS, CONCEPT_ICONS } from "../levels/levelData";
import { ArrowLeft, Star, Trophy, Target, Zap } from "lucide-react";
import { sounds } from "../engine/soundSystem";
import { MASTERY_DOMAINS, type MasteryLevel } from "../engine/mastery";

const ACHIEVEMENTS = [
  { id: "first_goal", icon: "⚽", name: "Primer Gol", desc: "Mete tu primer gol", xp: 50 },
  { id: "combo_3", icon: "🔥", name: "Tripleta", desc: "Consigue combo x3", xp: 100 },
  { id: "perfect_level", icon: "💎", name: "Perfecto", desc: "Completa un nivel sin fallar", xp: 200 },
  { id: "math_master", icon: "🧠", name: "Genio Matemático", desc: "10 respuestas correctas seguidas", xp: 150 },
  { id: "all_levels", icon: "🏆", name: "Campeón Total", desc: "Completa todos los niveles", xp: 500 },
  { id: "speed_demon", icon: "⚡", name: "Rayo", desc: "Responde en menos de 3 segundos", xp: 75 },
];

export default function ProgressScreen() {
  const { goToScreen, playerProfile } = useGame();
  const accuracy = playerProfile.totalShots > 0
    ? Math.round((playerProfile.totalGoals / playerProfile.totalShots) * 100)
    : 0;

  const xpToNext = 100 * playerProfile.level;
  const xpPct = (playerProfile.xp % xpToNext) / xpToNext * 100;

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
          onClick={() => { sounds.click(); goToScreen("home"); }}
          aria-label="Volver al inicio"
          className="w-12 h-12 rounded-xl flex items-center justify-center active:scale-95"
          style={{ background: "rgba(255,255,255,0.1)", border: "2px solid rgba(255,255,255,0.2)", touchAction: "manipulation" }}
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <h1
          className="text-2xl font-black text-white"
          style={{ fontFamily: "'Fredoka One', cursive" }}
        >
          Mi Progreso
        </h1>
      </motion.div>

      <div className="flex-1 overflow-y-auto px-4 pb-8 space-y-4">
        {/* Player card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl p-4"
          style={{
            background: "linear-gradient(135deg, rgba(255,107,53,0.2) 0%, rgba(55,66,250,0.2) 100%)",
            border: "3px solid rgba(255,107,53,0.4)",
          }}
        >
          <div className="flex items-center gap-4">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl font-black text-white"
              style={{ background: "#FF6B35", border: "3px solid #fff", boxShadow: "0 4px 0 #B84A1F" }}
            >
              {playerProfile.name[0]}
            </div>
            <div className="flex-1">
              <div className="text-white font-black text-xl" style={{ fontFamily: "'Fredoka One', cursive" }}>
                {playerProfile.name}
              </div>
              <div className="text-orange-300 font-bold text-sm">Nivel {playerProfile.level}</div>
              <div className="mt-1 h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.1)" }}>
                <div
                  className="h-full rounded-full"
                  style={{ width: `${xpPct}%`, background: "linear-gradient(90deg, #FF6B35, #FFD700)" }}
                />
              </div>
              <div className="text-white/50 text-xs mt-0.5">{playerProfile.xp % xpToNext}/{xpToNext} XP</div>
            </div>
          </div>
        </motion.div>

        {/* Stats grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-2 gap-3"
        >
          <StatCard icon="⚽" label="Goles Totales" value={playerProfile.totalGoals} color="#2ECC40" />
          <StatCard icon="🎯" label="Precisión" value={`${accuracy}%`} color="#3742FA" />
          <StatCard icon="⭐" label="Estrellas" value={playerProfile.stars} color="#FFD700" />
          <StatCard icon="🪙" label="Monedas" value={playerProfile.coins} color="#FFA502" />
        </motion.div>

        {/* Concept mastery */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="rounded-2xl p-4"
          style={{ background: "rgba(255,255,255,0.05)", border: "2px solid rgba(255,255,255,0.1)" }}
          aria-labelledby="mastery-heading"
        >
          <div id="mastery-heading" className="text-white font-black text-base mb-1" style={{ fontFamily: "'Fredoka One', cursive" }}>
            🧠 Tu dominio del balón
          </div>
          <p className="text-white/55 text-xs mb-3">Cada tiro te ayuda a descubrir qué concepto ya controlas.</p>
          <div className="space-y-3">
            {MASTERY_DOMAINS.map((domain) => {
              const mastery = playerProfile.masteryByDomain[domain];
              const recentAttempts = mastery.recentCorrect.length;
              const recentAccuracy = recentAttempts > 0
                ? Math.round((mastery.recentCorrect.filter(Boolean).length / recentAttempts) * 100)
                : 0;
              let streak = 0;
              for (let index = mastery.recentCorrect.length - 1; index >= 0 && mastery.recentCorrect[index]; index -= 1) streak += 1;
              const meta = DOMAIN_META[domain];
              return (
                <div key={domain} className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xl" aria-hidden="true">{meta.icon}</span>
                      <div className="min-w-0">
                        <div className="text-white text-sm font-black truncate">{meta.label}</div>
                        <div className="text-white/45 text-[11px]">{meta.description}</div>
                      </div>
                    </div>
                    <span className="text-xs font-black px-2 py-1 rounded-full whitespace-nowrap" style={{ color: masteryColor(mastery.level), background: `${masteryColor(mastery.level)}22` }}>
                      {MASTERY_LABELS[mastery.level]}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                    <div><div className="text-white font-black text-sm">{mastery.attempts}</div><div className="text-white/40 text-[10px]">Intentos</div></div>
                    <div><div className="text-white font-black text-sm">{recentAttempts ? `${recentAccuracy}%` : "—"}</div><div className="text-white/40 text-[10px]">Precisión reciente</div></div>
                    <div><div className="text-white font-black text-sm">{mastery.averageResponseTimeMs === null ? "—" : `${(mastery.averageResponseTimeMs / 1000).toFixed(1)} s`}</div><div className="text-white/40 text-[10px]">Tiempo medio</div></div>
                  </div>
                  <div className="text-orange-200 text-[11px] mt-2">{masteryRecommendation(mastery.level)} {streak > 0 ? `Racha actual: ${streak}.` : ""}</div>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Level progress */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-2xl p-4"
          style={{ background: "rgba(255,255,255,0.05)", border: "2px solid rgba(255,255,255,0.1)" }}
        >
          <div className="text-white font-black text-base mb-3" style={{ fontFamily: "'Fredoka One', cursive" }}>
            🗺️ Niveles Completados
          </div>
          <div className="space-y-2">
            {LEVELS.map((level) => {
              const progress = playerProfile.completedLevels[level.id];
              const stars = progress?.stars ?? 0;
              const isUnlocked = playerProfile.unlockedLevels.includes(level.id);

              return (
                <div key={level.id} className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm text-white flex-shrink-0"
                    style={{ background: isUnlocked ? "#3742FA" : "rgba(255,255,255,0.1)" }}
                  >
                    {level.id}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-white text-xs font-bold">{level.name}</span>
                      <div className="flex gap-0.5">
                        {[1, 2, 3].map((s) => (
                          <Star
                            key={s}
                            className="w-3 h-3"
                            style={{
                              fill: s <= stars ? "#FFD700" : "transparent",
                              color: s <= stars ? "#FFD700" : "rgba(255,255,255,0.2)",
                            }}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="text-white/40 text-xs">{CONCEPT_ICONS[level.concept]} {CONCEPT_LABELS[level.concept]}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Achievements */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="rounded-2xl p-4"
          style={{ background: "rgba(255,255,255,0.05)", border: "2px solid rgba(255,255,255,0.1)" }}
        >
          <div className="text-white font-black text-base mb-3" style={{ fontFamily: "'Fredoka One', cursive" }}>
            🏅 Logros
          </div>
          <div className="grid grid-cols-2 gap-2">
            {ACHIEVEMENTS.map((ach) => {
              const earned = playerProfile.achievements.includes(ach.id);
              return (
                <div
                  key={ach.id}
                  className="rounded-xl p-2 flex items-center gap-2"
                  style={{
                    background: earned ? "rgba(255,215,0,0.15)" : "rgba(255,255,255,0.03)",
                    border: `2px solid ${earned ? "#FFD700" : "rgba(255,255,255,0.08)"}`,
                    opacity: earned ? 1 : 0.5,
                  }}
                >
                  <span className="text-2xl">{ach.icon}</span>
                  <div>
                    <div className="text-white font-black text-xs leading-none">{ach.name}</div>
                    <div className="text-white/50 text-xs leading-tight mt-0.5">{ach.desc}</div>
                    <div className="text-yellow-400 text-xs font-bold">+{ach.xp} XP</div>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

const DOMAIN_META = {
  multiplication: { icon: "✖️", label: "Tablas", description: "Multiplicar con precisión" },
  coordinate: { icon: "📍", label: "Coordenadas", description: "Leer zonas de la portería" },
  angle: { icon: "📐", label: "Ángulos y trayectorias", description: "Elegir la curva del tiro" },
  velocity: { icon: "⚡", label: "Velocidad y distancia", description: "Medir fuerza y recorrido" },
} as const;

const MASTERY_LABELS: Record<MasteryLevel, string> = {
  discovering: "Descubriendo",
  practicing: "Practicando",
  mastering: "Casi dominado",
  mastered: "¡Dominado!",
};

function masteryColor(level: MasteryLevel): string {
  return level === "mastered" ? "#FFD700" : level === "mastering" ? "#7BED9F" : level === "practicing" ? "#4DD0E1" : "#B7C9E2";
}

function masteryRecommendation(level: MasteryLevel): string {
  if (level === "mastered") return "¡Listo para presumirlo en la cancha!";
  if (level === "mastering") return "Vas muy bien: practica un poco más para dominarlo.";
  if (level === "practicing") return "Practica con calma y mira cómo mejora tu precisión.";
  return "Empieza con tiros tranquilos para descubrirlo.";
}

function StatCard({ icon, label, value, color }: { icon: string; label: string; value: string | number; color: string }) {
  return (
    <div
      className="rounded-2xl p-3 text-center"
      style={{
        background: `${color}15`,
        border: `2px solid ${color}40`,
      }}
    >
      <div className="text-2xl">{icon}</div>
      <div className="font-black text-xl text-white mt-1" style={{ fontFamily: "'Fredoka One', cursive", color }}>
        {value}
      </div>
      <div className="text-white/50 text-xs">{label}</div>
    </div>
  );
}
