import { useReducedMotion } from "framer-motion";
import type { CSSProperties } from "react";

type MicrovictoryKind = "goal" | "mission" | "power" | "perfect";

interface MicrovictoryBurstProps {
  kind: MicrovictoryKind;
  eventKey: string;
}

const BURST_META: Record<MicrovictoryKind, { icon: string; label: string; accent: string; glow: string }> = {
  goal: { icon: "⚽", label: "Gol", accent: "#7BED9F", glow: "rgba(46, 204, 64, 0.7)" },
  mission: { icon: "🪙", label: "¡Misión completada! +15🪙 +1⭐", accent: "#FFD700", glow: "rgba(255, 215, 0, 0.85)" },
  power: { icon: "⚡", label: "Math Power activado", accent: "#4DD0E1", glow: "rgba(77, 208, 225, 0.8)" },
  perfect: { icon: "🔥", label: "Racha Perfecto", accent: "#FFF3A3", glow: "rgba(255, 215, 0, 0.9)" },
};

export function MicrovictoryBurst({ kind, eventKey }: MicrovictoryBurstProps) {
  const reducedMotion = useReducedMotion();
  const meta = BURST_META[kind];

  return (
    <div
      key={eventKey}
      className={`microvictory-burst microvictory-burst--${kind}${reducedMotion ? " microvictory-burst--reduced" : ""}`}
      aria-hidden="true"
      style={{
        "--burst-accent": meta.accent,
        "--burst-glow": meta.glow,
      } as CSSProperties}
    >
      <span className="microvictory-burst__halo" />
      {Array.from({ length: 8 }, (_, index) => (
        <span key={index} className={`microvictory-burst__spark microvictory-burst__spark--${index + 1}`} />
      ))}
      <span className="microvictory-burst__icon">{meta.icon}</span>
      <span className="microvictory-burst__label">{meta.label}</span>
    </div>
  );
}
