import { useMemo, useState } from "react";
import { REFERENCE_KICKS, simulateReferenceKick } from "./referenceKicks";
import StadiumCanvas from "./StadiumCanvas";

type PreviewPhase = "ready" | "flight" | "result";

function getForceLabel(speedMps: number): string {
  if (speedMps < 20) return "Tiro suave";
  if (speedMps < 25) return "Tiro controlado";
  return "Tiro potente";
}

function getSpinLabel(sidespinRadPerSecond: number): string {
  if (Math.abs(sidespinRadPerSecond) < 1) return "Sin efecto";
  return sidespinRadPerSecond > 0 ? "Curva a la derecha" : "Curva a la izquierda";
}

function getResultCopy(result: ReturnType<typeof simulateReferenceKick>): { title: string; detail: string; accent: string } {
  if (result.goalMouthResult === "goal") {
    return { title: "¡GOL!", detail: "La pelota entró respetando fuerza, ángulo y efecto.", accent: "#79f2a4" };
  }
  if (result.goalMouthResult === "high") {
    return { title: "Por arriba", detail: "El ángulo levantó la pelota sobre el travesaño.", accent: "#ffd166" };
  }
  if (result.goalMouthResult === "wide") {
    return { title: "Desviado", detail: "La curva llevó la pelota fuera de los postes.", accent: "#ff9f68" };
  }
  return { title: "Le faltó fuerza", detail: "La pelota tocó el césped antes de llegar al arco.", accent: "#ff8b8b" };
}

export default function V10FieldPreview() {
  const [referenceId, setReferenceId] = useState(REFERENCE_KICKS[0].id);
  const [replayToken, setReplayToken] = useState(0);
  const [phase, setPhase] = useState<PreviewPhase>("ready");
  const reference = REFERENCE_KICKS.find((kick) => kick.id === referenceId) ?? REFERENCE_KICKS[0];
  const result = useMemo(() => simulateReferenceKick(reference), [reference]);
  const resultCopy = getResultCopy(result);

  const selectKick = (id: string) => {
    setReferenceId(id);
    setReplayToken(0);
    setPhase("ready");
  };

  const shoot = () => {
    if (phase === "flight") return;
    setPhase("flight");
    setReplayToken((current) => current + 1);
  };

  const leavePreview = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("v10Preview");
    window.location.assign(`${url.pathname}${url.search}${url.hash}`);
  };

  return (
    <main
      data-v10-field-preview="true"
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        minHeight: "100dvh",
        overflow: "hidden",
        background: "#07121c",
        color: "white",
        fontFamily: "Nunito, sans-serif",
      }}
    >
      <div style={{ width: "100%", height: "100dvh", maxWidth: 560, margin: "0 auto", position: "relative", overflow: "hidden", background: "#0d3824" }}>
        <StadiumCanvas
          samples={result.samples}
          goalDistanceM={reference.distanceM}
          replayToken={replayToken}
          onFlightComplete={() => setPhase("result")}
        />

        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background: "linear-gradient(180deg, rgba(1,8,18,.68) 0%, transparent 23%, transparent 62%, rgba(1,8,16,.88) 100%)",
          }}
        />

        <header
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 5,
            padding: "max(14px, env(safe-area-inset-top, 14px)) 16px 12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div>
            <div style={{ color: "#ffd166", fontSize: 11, fontWeight: 950, letterSpacing: 1.3 }}>CAMINO AL 10 · FASE 2</div>
            <h1 style={{ margin: "2px 0 0", fontSize: "clamp(21px, 6vw, 29px)", lineHeight: 1, textShadow: "0 2px 10px #000" }}>Cancha V10</h1>
          </div>
          <button
            onClick={leavePreview}
            aria-label="Cerrar vista V10 y volver al juego"
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,.35)",
              background: "rgba(4,15,25,.58)",
              color: "white",
              fontSize: 22,
              fontWeight: 900,
              backdropFilter: "blur(8px)",
            }}
          >
            ×
          </button>
        </header>

        <section
          aria-label="Condiciones del tiro"
          style={{
            position: "absolute",
            top: "max(80px, calc(env(safe-area-inset-top, 0px) + 70px))",
            left: 14,
            right: 14,
            zIndex: 5,
            display: "flex",
            gap: 7,
            flexWrap: "wrap",
            pointerEvents: "none",
          }}
        >
          {[`${reference.distanceM} m`, getForceLabel(reference.speedMps), getSpinLabel(reference.sidespinRadPerSecond)].map((label) => (
            <span
              key={label}
              style={{
                padding: "5px 9px",
                borderRadius: 999,
                background: "rgba(3,14,23,.58)",
                border: "1px solid rgba(255,255,255,.28)",
                fontSize: 11,
                fontWeight: 900,
                textShadow: "0 1px 3px #000",
                backdropFilter: "blur(7px)",
              }}
            >
              {label}
            </span>
          ))}
        </section>

        {phase === "result" && (
          <section
            role="status"
            aria-live="polite"
            style={{
              position: "absolute",
              top: "19%",
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 6,
              width: "min(82%, 360px)",
              padding: "13px 16px",
              textAlign: "center",
              borderRadius: 18,
              background: "rgba(3,13,20,.78)",
              border: `2px solid ${resultCopy.accent}`,
              boxShadow: `0 0 28px ${resultCopy.accent}44`,
              backdropFilter: "blur(10px)",
            }}
          >
            <strong style={{ display: "block", color: resultCopy.accent, fontSize: 27, lineHeight: 1 }}>{resultCopy.title}</strong>
            <span style={{ display: "block", marginTop: 5, color: "#eef7f2", fontSize: 13 }}>{resultCopy.detail}</span>
          </section>
        )}

        <section
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 7,
            padding: "14px 16px max(18px, env(safe-area-inset-bottom, 18px))",
            display: "grid",
            gap: 11,
          }}
        >
          <label style={{ display: "grid", gap: 5, fontSize: 11, fontWeight: 900, color: "#d7e7de" }}>
            ESCENARIO DE CALIBRACIÓN
            <select
              value={referenceId}
              disabled={phase === "flight"}
              onChange={(event) => selectKick(event.target.value)}
              style={{
                width: "100%",
                minHeight: 44,
                padding: "0 12px",
                borderRadius: 13,
                border: "1px solid rgba(255,255,255,.28)",
                background: "rgba(5,19,27,.88)",
                color: "white",
                fontSize: 15,
                fontWeight: 900,
                backdropFilter: "blur(9px)",
              }}
            >
              {REFERENCE_KICKS.map((kick) => <option key={kick.id} value={kick.id}>{kick.label}</option>)}
            </select>
          </label>

          <button
            onClick={shoot}
            disabled={phase === "flight"}
            aria-label={phase === "result" ? "Repetir el tiro" : "Disparar el tiro de prueba"}
            style={{
              minHeight: 58,
              borderRadius: 17,
              border: "3px solid rgba(255,255,255,.42)",
              background: phase === "flight"
                ? "linear-gradient(180deg, #506158, #344139)"
                : "linear-gradient(180deg, #ff7a3d, #e64921)",
              color: "white",
              fontSize: 20,
              fontWeight: 950,
              letterSpacing: 0.5,
              boxShadow: phase === "flight" ? "none" : "0 6px 0 #9e2d17, 0 12px 28px rgba(0,0,0,.35)",
              textShadow: "0 2px 3px rgba(0,0,0,.4)",
            }}
          >
            {phase === "flight" ? "BALÓN EN VUELO…" : phase === "result" ? "REPETIR TIRO" : "DISPARAR"}
          </button>
          <p style={{ margin: 0, textAlign: "center", color: "rgba(225,238,230,.72)", fontSize: 11 }}>
            Vista de validación visual · escala real · vuelo físico
          </p>
        </section>
      </div>
    </main>
  );
}
