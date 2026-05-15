// =============================================================
// TIRO LIBRE MATEMÁTICO — Tutorial Screen v2
// Design: Pixel Champions — Fun, visual, step-by-step
// FIXES: sounds, touch targets, safe-area padding
// =============================================================

import { motion, AnimatePresence } from "framer-motion";
import { useGame } from "../engine/GameContext";
import { sounds } from "../engine/soundSystem";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";

const STEPS = [
  {
    icon: "🎯",
    title: "Apunta a la Portería",
    desc: "Toca en la portería donde quieres que entre el balón. Verás una cuadrícula con números — ¡esas son las coordenadas!",
    tip: "Las coordenadas son como una dirección: (X, Y). X va de izquierda a derecha, Y va de abajo hacia arriba.",
    color: "#3742FA",
  },
  {
    icon: "✖️",
    title: "Resuelve la Multiplicación",
    desc: "Antes de tirar, aparecerá una multiplicación. ¡Resuélvela rápido! Si aciertas, tu tiro tendrá más potencia.",
    tip: "Responder en menos de 5 segundos te da el 100% de potencia. ¡La velocidad importa!",
    color: "#FF6B35",
  },
  {
    icon: "⚽",
    title: "¡A Tirar!",
    desc: "El balón volará hacia donde apuntaste. Si resolviste bien la matemática, irá con más fuerza y será más difícil de atajar.",
    tip: "Los tiros a las esquinas son más difíciles de atajar. ¡Apunta a (3,3) o (-3,3)!",
    color: "#2ECC40",
  },
  {
    icon: "🧤",
    title: "El Portero",
    desc: "El portero se mueve de lado a lado. Apunta al lado contrario de donde está para tener más probabilidad de meter gol.",
    tip: "En niveles avanzados, el portero es más rápido. ¡Necesitarás más potencia para vencerlo!",
    color: "#FFD700",
  },
  {
    icon: "📐",
    title: "El Plano Cartesiano",
    desc: "La portería tiene una cuadrícula. El centro es (0,0). Los números positivos van a la derecha y arriba, los negativos a la izquierda y abajo.",
    tip: "Cuadrante I: (+,+) | Cuadrante II: (-,+) | Cuadrante III: (-,-) | Cuadrante IV: (+,-)",
    color: "#A29BFE",
  },
  {
    icon: "🔥",
    title: "¡Combos y Puntos!",
    desc: "Si metes goles seguidos, activas un COMBO que multiplica tus puntos. ¡Intenta no fallar para acumular el combo más alto!",
    tip: "Combo x2 = doble puntos. Combo x3 = triple puntos. ¡Sé consistente!",
    color: "#FF4757",
  },
];

export default function TutorialScreen() {
  const { goToScreen } = useGame();
  const [step, setStep] = useState(0);

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const goNext = () => {
    sounds.click();
    if (isLast) goToScreen("level-select");
    else setStep(step + 1);
  };

  const goPrev = () => {
    sounds.click();
    setStep(step - 1);
  };

  const goStep = (i: number) => {
    sounds.click();
    setStep(i);
  };

  return (
    <div
      className="relative w-full min-h-dvh flex flex-col"
      style={{ background: "linear-gradient(180deg, #1a1a2e 0%, #0f3460 100%)" }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pb-4" style={{ paddingTop: "max(24px, env(safe-area-inset-top, 24px))" }}>
        <button
          onPointerDown={() => { sounds.click(); goToScreen("home"); }}
          className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 active:scale-95"
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
          Tutorial
        </h1>
        <div className="ml-auto text-white/50 text-sm font-bold">
          {step + 1}/{STEPS.length}
        </div>
      </div>

      {/* Step dots */}
      <div className="flex justify-center gap-2 px-4 mb-4">
        {STEPS.map((_, i) => (
          <button
            key={i}
            onPointerDown={() => goStep(i)}
            className="rounded-full transition-all duration-300"
            style={{
              width: i === step ? 24 : 10,
              height: 10,
              background: i === step ? current.color : "rgba(255,255,255,0.2)",
              touchAction: "manipulation",
              minWidth: 10,
            }}
          />
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
            className="w-full max-w-sm flex flex-col items-center gap-5"
          >
            {/* Icon */}
            <motion.div
              animate={{ scale: [1, 1.1, 1], rotate: [-5, 5, -5] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="text-8xl"
            >
              {current.icon}
            </motion.div>

            {/* Title */}
            <div
              className="text-3xl font-black text-center"
              style={{
                fontFamily: "'Fredoka One', cursive",
                color: current.color,
                textShadow: `3px 3px 0 rgba(0,0,0,0.5)`,
              }}
            >
              {current.title}
            </div>

            {/* Description */}
            <div
              className="rounded-2xl p-4 text-center w-full"
              style={{
                background: `${current.color}15`,
                border: `3px solid ${current.color}40`,
              }}
            >
              <p className="text-white text-base font-bold leading-relaxed">
                {current.desc}
              </p>
            </div>

            {/* Tip */}
            <div
              className="rounded-xl p-3 w-full"
              style={{ background: "rgba(255,215,0,0.1)", border: "2px solid rgba(255,215,0,0.3)" }}
            >
              <div className="text-yellow-400 text-xs font-black mb-1">💡 DATO CLAVE</div>
              <div className="text-white/80 text-sm">{current.tip}</div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <div
        className="px-4 flex gap-3"
        style={{ paddingBottom: "max(32px, env(safe-area-inset-bottom, 32px))" }}
      >
        {step > 0 && (
          <motion.button
            whileTap={{ scale: 0.95 }}
            onPointerDown={goPrev}
            className="flex-1 rounded-2xl font-black text-white/70 flex items-center justify-center gap-2"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "2px solid rgba(255,255,255,0.1)",
              height: "56px",
              touchAction: "manipulation",
            }}
          >
            <ArrowLeft className="w-4 h-4" />
            Anterior
          </motion.button>
        )}
        <motion.button
          whileTap={{ scale: 0.95 }}
          onPointerDown={goNext}
          className="flex-1 rounded-2xl font-black text-white flex items-center justify-center gap-2"
          style={{
            fontFamily: "'Fredoka One', cursive",
            background: `linear-gradient(180deg, ${current.color} 0%, ${current.color}CC 100%)`,
            border: "3px solid rgba(255,255,255,0.3)",
            boxShadow: `0 4px 0 rgba(0,0,0,0.3)`,
            height: "56px",
            touchAction: "manipulation",
          }}
        >
          {isLast ? (
            <>
              <Check className="w-5 h-5" />
              ¡A Jugar!
            </>
          ) : (
            <>
              Siguiente
              <ArrowRight className="w-5 h-5" />
            </>
          )}
        </motion.button>
      </div>
    </div>
  );
}
