import { useMemo, useState } from "react";
import { REFERENCE_KICKS, buildReferenceKickConfig } from "./referenceKicks";
import { simulateShot, velocityFromAngles, type FlightSample } from "./shotPhysics3d";

const VIEW_WIDTH = 360;
const VIEW_HEIGHT = 210;
const PADDING = 24;

function linePath(samples: FlightSample[], project: (sample: FlightSample) => [number, number]): string {
  return samples.map((sample, index) => {
    const [x, y] = project(sample);
    return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ");
}

function Slider({ label, value, min, max, step, unit, onChange }: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (value: number) => void;
}) {
  return (
    <label style={{ display: "grid", gap: 6, fontWeight: 800 }}>
      <span style={{ display: "flex", justifyContent: "space-between" }}>
        {label}<output>{value} {unit}</output>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        style={{ width: "100%", accentColor: "#ffd43b" }}
      />
    </label>
  );
}

function Projection({ title, path, goal }: { title: string; path: string; goal: "side" | "top" }) {
  return (
    <figure style={{ margin: 0, background: "#0b301d", border: "1px solid #ffffff2b", borderRadius: 14, overflow: "hidden" }}>
      <figcaption style={{ padding: "10px 12px 0", fontSize: 13, fontWeight: 900, color: "#c9f7d8" }}>{title}</figcaption>
      <svg viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`} role="img" aria-label={title} style={{ display: "block", width: "100%" }}>
        <defs>
          <linearGradient id={`grass-${goal}`} x1="0" x2="0" y1="0" y2="1">
            <stop stopColor="#176b3a" />
            <stop offset="1" stopColor="#0b3b23" />
          </linearGradient>
        </defs>
        <rect width={VIEW_WIDTH} height={VIEW_HEIGHT} fill={`url(#grass-${goal})`} />
        <line x1={PADDING} y1={VIEW_HEIGHT - PADDING} x2={VIEW_WIDTH - PADDING} y2={VIEW_HEIGHT - PADDING} stroke="#ffffff80" strokeWidth="2" />
        {goal === "side" ? (
          <path d={`M${VIEW_WIDTH - PADDING} ${VIEW_HEIGHT - PADDING}V${VIEW_HEIGHT - PADDING - 54}h8`} fill="none" stroke="white" strokeWidth="4" />
        ) : (
          <line x1={VIEW_WIDTH - PADDING} y1={PADDING} x2={VIEW_WIDTH - PADDING} y2={VIEW_HEIGHT - PADDING} stroke="white" strokeWidth="4" />
        )}
        <path d={path} fill="none" stroke="#ffd43b" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={PADDING} cy={VIEW_HEIGHT - PADDING} r="5" fill="white" />
      </svg>
    </figure>
  );
}

export default function ShotPhysicsLab() {
  const [referenceId, setReferenceId] = useState(REFERENCE_KICKS[0].id);
  const reference = REFERENCE_KICKS.find((kick) => kick.id === referenceId) ?? REFERENCE_KICKS[0];
  const [speedMps, setSpeedMps] = useState(reference.speedMps);
  const [elevationDegrees, setElevationDegrees] = useState(reference.elevationDegrees);
  const [sidespinRadPerSecond, setSidespinRadPerSecond] = useState(reference.sidespinRadPerSecond);

  const selectReference = (id: string) => {
    const next = REFERENCE_KICKS.find((kick) => kick.id === id) ?? REFERENCE_KICKS[0];
    setReferenceId(next.id);
    setSpeedMps(next.speedMps);
    setElevationDegrees(next.elevationDegrees);
    setSidespinRadPerSecond(next.sidespinRadPerSecond);
  };

  const result = useMemo(() => {
    const config = buildReferenceKickConfig(reference);
    return simulateShot({
      ...config,
      initialVelocityMps: velocityFromAngles(speedMps, elevationDegrees, reference.yawDegrees),
      spinRadPerSecond: { x: 0, y: sidespinRadPerSecond, z: 0 },
    });
  }, [reference, speedMps, elevationDegrees, sidespinRadPerSecond]);

  const sidePath = linePath(result.samples, (sample) => [
    PADDING + sample.positionM.z / reference.distanceM * (VIEW_WIDTH - PADDING * 2),
    VIEW_HEIGHT - PADDING - sample.positionM.y / 7 * (VIEW_HEIGHT - PADDING * 2),
  ]);
  const topPath = linePath(result.samples, (sample) => [
    PADDING + sample.positionM.z / reference.distanceM * (VIEW_WIDTH - PADDING * 2),
    VIEW_HEIGHT / 2 - sample.positionM.x / 5 * (VIEW_HEIGHT - PADDING * 2),
  ]);
  const crossing = result.goalPlaneCrossing;
  const statusLabels = { goal: "GOL", wide: "FUERA", high: "ALTO", grounded: "RASO", null: "NO LLEGÓ" } as const;
  const status = statusLabels[String(result.goalMouthResult) as keyof typeof statusLabels];

  return (
    <main style={{ minHeight: "100dvh", color: "white", background: "#081a12", padding: "24px 16px 48px", fontFamily: "Nunito, sans-serif", userSelect: "text" }}>
      <div style={{ maxWidth: 980, margin: "0 auto", display: "grid", gap: 18 }}>
        <header>
          <p style={{ margin: 0, color: "#ffd43b", fontWeight: 900, letterSpacing: 1 }}>V10 · FASE 1</p>
          <h1 style={{ margin: "4px 0", fontSize: "clamp(26px, 5vw, 42px)" }}>Laboratorio de física del tiro</h1>
          <p style={{ margin: 0, color: "#b7c9bf" }}>Herramienta temporal de calibración. No aparece en la experiencia de Martín.</p>
        </header>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
          <div style={{ display: "grid", gap: 16, padding: 18, borderRadius: 16, background: "#10281c", border: "1px solid #ffffff24" }}>
            <label style={{ display: "grid", gap: 6, fontWeight: 800 }}>
              Tiro de referencia
              <select value={referenceId} onChange={(event) => selectReference(event.target.value)} style={{ borderRadius: 10, padding: 10, color: "white", background: "#193b29", border: "1px solid #ffffff38" }}>
                {REFERENCE_KICKS.map((kick) => <option value={kick.id} key={kick.id}>{kick.label}</option>)}
              </select>
            </label>
            <p style={{ margin: 0, minHeight: 44, color: "#b7c9bf" }}>{reference.purpose}</p>
            <Slider label="Velocidad" value={speedMps} min={14} max={32} step={0.5} unit="m/s" onChange={setSpeedMps} />
            <Slider label="Elevación" value={elevationDegrees} min={8} max={30} step={0.5} unit="°" onChange={setElevationDegrees} />
            <Slider label="Efecto lateral" value={sidespinRadPerSecond} min={-120} max={120} step={5} unit="rad/s" onChange={setSidespinRadPerSecond} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10, alignContent: "start" }}>
            {[
              ["Resultado", status],
              ["Distancia", `${reference.distanceM} m`],
              ["Tiempo", `${result.flightTimeSeconds.toFixed(2)} s`],
              ["Altura máxima", `${result.apex.positionM.y.toFixed(2)} m`],
              ["Altura al arco", crossing ? `${crossing.positionM.y.toFixed(2)} m` : "—"],
              ["Desvío lateral", crossing ? `${crossing.positionM.x.toFixed(2)} m` : "—"],
            ].map(([label, value]) => (
              <div key={label} style={{ padding: 14, borderRadius: 14, background: "#10281c", border: "1px solid #ffffff24" }}>
                <div style={{ color: "#a9bcb1", fontSize: 12 }}>{label}</div>
                <strong style={{ display: "block", marginTop: 4, color: label === "Resultado" ? "#ffd43b" : "white", fontSize: 20 }}>{value}</strong>
              </div>
            ))}
          </div>
        </section>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 14 }}>
          <Projection title="Vista lateral · altura y distancia reales" path={sidePath} goal="side" />
          <Projection title="Vista superior · curva lateral" path={topPath} goal="top" />
        </section>

        <footer style={{ color: "#8fa69a", fontSize: 13 }}>
          Modelo determinista a 120 Hz · balón 0,43 kg · radio 0,11 m · arco 7,32 × 2,44 m · gravedad, arrastre y efecto Magnus.
        </footer>
      </div>
    </main>
  );
}
