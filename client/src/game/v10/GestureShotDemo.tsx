import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import StadiumCanvas from "./StadiumCanvas";
import {
  resolveFootballShot,
  type DefenseMode,
  type FootballOutcome,
  type ResolvedFootballShot,
} from "./footballCollisions";
import { continueFlightWithSpin, createInteractiveShotConfig } from "./midFlightSpin";
import { curveFromSwipe, getForceBand, launchFromSwipe, type GesturePoint, type LaunchGesture } from "./shotGesture";
import { simulateShot, type ShotPhysicsConfig, type ShotPhysicsResult } from "./shotPhysics3d";

type DemoPhase = "ready" | "flight" | "result";

interface DragState {
  pointerId: number;
  mode: "launch" | "curve";
  start: GesturePoint;
  current: GesturePoint;
  viewport: { width: number; height: number };
}

const GOAL_DISTANCE_M = 18.3;
const DEFAULT_CONFIG = createInteractiveShotConfig(24, 17, 0, GOAL_DISTANCE_M);

function getResultCopy(outcome: FootballOutcome) {
  if (outcome === "goal") return { title: "¡GOL!", detail: "La red frenó el balón como en un remate real.", accent: "#72f2a1" };
  if (outcome === "saved") return { title: "¡Atajó!", detail: "Busca un rincón más lejano del arquero.", accent: "#68c7ff" };
  if (outcome === "blocked") return { title: "¡Barrera!", detail: "Dale más altura o curva el tiro alrededor.", accent: "#ffd166" };
  if (outcome === "post") return { title: "¡Al palo!", detail: "Faltaron centímetros: ajusta la dirección.", accent: "#ffbd59" };
  if (outcome === "crossbar") return { title: "¡Travesaño!", detail: "Reduce un poco la elevación del gesto.", accent: "#ffbd59" };
  if (outcome === "miss") return { title: "¡Afuera!", detail: "Reduce la dirección lateral o la altura.", accent: "#ff9f68" };
  return { title: "Faltó fuerza", detail: "Desliza más rápido hacia el arco.", accent: "#ff8b8b" };
}

const DEFENSE_OPTIONS: { mode: DefenseMode; label: string }[] = [
  { mode: "open", label: "Arco libre" },
  { mode: "wall", label: "Barrera" },
  { mode: "keeper", label: "Arquero" },
];

function getForceCopy(launch: LaunchGesture | null): string {
  if (!launch) return "Sin patear";
  const band = getForceBand(launch.speedMps);
  return band === "soft" ? "Suave" : band === "controlled" ? "Controlado" : "Potente";
}

function localPoint(event: ReactPointerEvent<HTMLDivElement>): GesturePoint {
  const bounds = event.currentTarget.getBoundingClientRect();
  return { x: event.clientX - bounds.left, y: event.clientY - bounds.top, timeMs: performance.now() };
}

export default function GestureShotDemo() {
  const initialPhysicsResult = useMemo(() => simulateShot(DEFAULT_CONFIG), []);
  const initialResolved = useMemo(() => resolveFootballShot(initialPhysicsResult, "open", DEFAULT_CONFIG.goal), [initialPhysicsResult]);
  const [resolvedShot, setResolvedShot] = useState<ResolvedFootballShot>(initialResolved);
  const [defenseMode, setDefenseMode] = useState<DefenseMode>("open");
  const [phase, setPhase] = useState<DemoPhase>("ready");
  const [progress, setProgress] = useState(0);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [launch, setLaunch] = useState<LaunchGesture | null>(null);
  const [spinApplied, setSpinApplied] = useState<"left" | "right" | null>(null);
  const [hint, setHint] = useState("Desliza el balón hacia el arco");
  const frameRef = useRef<number | null>(null);
  const physicsResultRef = useRef<ShotPhysicsResult>(initialPhysicsResult);
  const resolvedRef = useRef<ResolvedFootballShot>(initialResolved);
  const configRef = useRef<ShotPhysicsConfig>(DEFAULT_CONFIG);
  const elapsedPhysicsSecondsRef = useRef(0);
  const lastFrameMsRef = useRef(0);

  const stopAnimation = () => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
  };

  useEffect(() => stopAnimation, []);

  const animate = (now: number) => {
    const deltaSeconds = Math.min(0.05, Math.max(0, (now - lastFrameMsRef.current) / 1000));
    lastFrameMsRef.current = now;
    elapsedPhysicsSecondsRef.current += deltaSeconds / 1.22;
    const totalSeconds = resolvedRef.current.flightTimeSeconds;
    const nextProgress = Math.min(1, elapsedPhysicsSecondsRef.current / totalSeconds);
    setProgress(nextProgress);
    if (nextProgress < 1) {
      frameRef.current = requestAnimationFrame(animate);
    } else {
      frameRef.current = null;
      setPhase("result");
      setHint("Observa el resultado de tu gesto");
    }
  };

  const startFlight = (nextPhysicsResult: ShotPhysicsResult, config: ShotPhysicsConfig, nextLaunch: LaunchGesture) => {
    stopAnimation();
    const nextResolved = resolveFootballShot(nextPhysicsResult, defenseMode, config.goal);
    physicsResultRef.current = nextPhysicsResult;
    resolvedRef.current = nextResolved;
    configRef.current = config;
    elapsedPhysicsSecondsRef.current = 0;
    setResolvedShot(nextResolved);
    setLaunch(nextLaunch);
    setSpinApplied(null);
    setProgress(0);
    setPhase("flight");
    setHint("¡Ahora desliza a un lado para darle efecto!");
    lastFrameMsRef.current = performance.now();
    frameRef.current = requestAnimationFrame(animate);
  };

  const applySpin = (sidespinRadPerSecond: number, direction: "left" | "right") => {
    if (spinApplied || phase !== "flight") return;
    const currentResult = physicsResultRef.current;
    const currentProgress = elapsedPhysicsSecondsRef.current / currentResult.flightTimeSeconds;
    if (currentProgress > 0.88) {
      setHint("El balón ya está llegando: aplica el efecto un poco antes");
      return;
    }
    const continuation = continueFlightWithSpin(currentResult, currentProgress, sidespinRadPerSecond, configRef.current);
    const nextResolved = resolveFootballShot(continuation.result, defenseMode, configRef.current.goal);
    physicsResultRef.current = continuation.result;
    resolvedRef.current = nextResolved;
    setResolvedShot(nextResolved);
    setProgress(Math.min(1, elapsedPhysicsSecondsRef.current / nextResolved.flightTimeSeconds));
    setSpinApplied(direction);
    setHint(direction === "right" ? "Efecto aplicado hacia la derecha" : "Efecto aplicado hacia la izquierda");
  };

  const reset = () => {
    stopAnimation();
    const nextResolved = resolveFootballShot(initialPhysicsResult, defenseMode, DEFAULT_CONFIG.goal);
    physicsResultRef.current = initialPhysicsResult;
    resolvedRef.current = nextResolved;
    configRef.current = DEFAULT_CONFIG;
    elapsedPhysicsSecondsRef.current = 0;
    setResolvedShot(nextResolved);
    setPhase("ready");
    setProgress(0);
    setDrag(null);
    setLaunch(null);
    setSpinApplied(null);
    setHint("Desliza el balón hacia el arco");
  };

  const selectDefense = (mode: DefenseMode) => {
    if (phase === "flight") return;
    stopAnimation();
    const nextResolved = resolveFootballShot(initialPhysicsResult, mode, DEFAULT_CONFIG.goal);
    physicsResultRef.current = initialPhysicsResult;
    resolvedRef.current = nextResolved;
    configRef.current = DEFAULT_CONFIG;
    elapsedPhysicsSecondsRef.current = 0;
    setDefenseMode(mode);
    setResolvedShot(nextResolved);
    setPhase("ready");
    setProgress(0);
    setDrag(null);
    setLaunch(null);
    setSpinApplied(null);
    setHint(mode === "wall" ? "Supera la barrera con altura o efecto" : mode === "keeper" ? "Busca un rincón fuera de su alcance" : "Desliza el balón hacia el arco");
  };

  const leaveDemo = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("v10Demo");
    window.location.assign(`${url.pathname}${url.search}${url.hash}`);
  };

  const beginGesture = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (phase === "result" || (phase === "flight" && spinApplied)) return;
    const point = localPoint(event);
    const bounds = event.currentTarget.getBoundingClientRect();
    if (phase === "ready" && point.y < bounds.height * 0.48) {
      setHint("Empieza el gesto desde la parte baja, cerca del balón");
      return;
    }
    if (phase === "flight" && progress > 0.88) {
      setHint("El efecto debe aplicarse antes de que llegue al arco");
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({
      pointerId: event.pointerId,
      mode: phase === "ready" ? "launch" : "curve",
      start: point,
      current: point,
      viewport: { width: bounds.width, height: bounds.height },
    });
  };

  const updateGesture = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const point = localPoint(event);
    setDrag((current) => current ? { ...current, current: point } : null);
  };

  const finishGesture = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const end = localPoint(event);
    const bounds = event.currentTarget.getBoundingClientRect();
    const viewport = { width: bounds.width, height: bounds.height };
    if (drag.mode === "launch") {
      const mapped = launchFromSwipe(drag.start, end, viewport);
      if (!mapped.valid) {
        setHint(mapped.reason === "must_swipe_up" ? "Desliza hacia arriba para levantar el balón" : "Haz un gesto un poco más largo");
      } else {
        const config = createInteractiveShotConfig(mapped.speedMps, mapped.elevationDegrees, mapped.yawDegrees, GOAL_DISTANCE_M);
        startFlight(simulateShot(config), config, mapped);
      }
    } else {
      const mapped = curveFromSwipe(drag.start, end, viewport);
      if (!mapped.valid) setHint("Para dar efecto, desliza claramente a un lado");
      else applySpin(mapped.sidespinRadPerSecond, mapped.direction as "left" | "right");
    }
    setDrag(null);
  };

  const cancelGesture = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (drag?.pointerId === event.pointerId) setDrag(null);
  };

  const launchPreview = drag?.mode === "launch"
    ? launchFromSwipe(drag.start, drag.current, drag.viewport)
    : null;
  const forcePercent = launchPreview?.valid ? Math.round(launchPreview.force * 100) : launch ? Math.round(launch.force * 100) : 0;
  const resultCopy = getResultCopy(resolvedShot.outcome);
  const gestureColor = drag?.mode === "curve" ? "#c89bff" : "#ffbd59";

  return (
    <main
      data-v10-gesture-demo="true"
      style={{ position: "fixed", inset: 0, width: "100%", minHeight: "100dvh", overflow: "hidden", background: "#06111a", color: "white", fontFamily: "Nunito, sans-serif" }}
    >
      <div style={{ width: "100%", height: "100dvh", maxWidth: 560, margin: "0 auto", position: "relative", overflow: "hidden", background: "#0d3824" }}>
        <StadiumCanvas samples={resolvedShot.displaySamples} goalDistanceM={GOAL_DISTANCE_M} actors={resolvedShot.actors} progress={progress} />
        <div aria-hidden="true" style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "linear-gradient(180deg, rgba(1,8,18,.72) 0%, transparent 24%, transparent 63%, rgba(1,8,16,.9) 100%)" }} />

        <div
          data-swipe-surface="true"
          role="application"
          tabIndex={0}
          aria-label="Control del tiro: desliza hacia arriba para patear y, durante el vuelo, desliza horizontalmente para aplicar efecto"
          onPointerDown={beginGesture}
          onPointerMove={updateGesture}
          onPointerUp={finishGesture}
          onPointerCancel={cancelGesture}
          onKeyDown={(event) => {
            if ((event.key === "Enter" || event.key === " ") && phase === "ready") {
              event.preventDefault();
              const keyboardLaunch = launchFromSwipe(
                { x: 200, y: 520, timeMs: 0 },
                { x: 200, y: 230, timeMs: 360 },
                { width: 400, height: 600 },
              );
              const config = createInteractiveShotConfig(keyboardLaunch.speedMps, keyboardLaunch.elevationDegrees, keyboardLaunch.yawDegrees, GOAL_DISTANCE_M);
              startFlight(simulateShot(config), config, keyboardLaunch);
            } else if (phase === "flight" && event.key === "ArrowLeft") {
              event.preventDefault();
              applySpin(-88, "left");
            } else if (phase === "flight" && event.key === "ArrowRight") {
              event.preventDefault();
              applySpin(88, "right");
            } else if ((event.key === "Enter" || event.key === " ") && phase === "result") {
              event.preventDefault();
              reset();
            }
          }}
          style={{ position: "absolute", inset: 0, zIndex: 6, touchAction: "none", outline: "none", cursor: phase === "ready" ? "grab" : phase === "flight" && !spinApplied ? "ew-resize" : "default" }}
        />

        {drag && (
          <svg aria-hidden="true" viewBox={`0 0 ${drag.viewport.width} ${drag.viewport.height}`} preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 8, pointerEvents: "none" }}>
            <defs>
              <marker id="gesture-arrow" markerWidth="8" markerHeight="8" refX="5" refY="3" orient="auto">
                <path d="M0,0 L0,6 L6,3 z" fill={gestureColor} />
              </marker>
            </defs>
            <line x1={drag.start.x} y1={drag.start.y} x2={drag.current.x} y2={drag.current.y} stroke="rgba(0,0,0,.45)" strokeWidth="10" strokeLinecap="round" />
            <line x1={drag.start.x} y1={drag.start.y} x2={drag.current.x} y2={drag.current.y} stroke={gestureColor} strokeWidth="5" strokeLinecap="round" markerEnd="url(#gesture-arrow)" />
            <circle cx={drag.start.x} cy={drag.start.y} r="12" fill="none" stroke={gestureColor} strokeWidth="3" />
          </svg>
        )}

        <header style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 10, padding: "max(14px, env(safe-area-inset-top, 14px)) 16px 10px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, pointerEvents: "none" }}>
          <div>
            <div style={{ color: "#ffd166", fontSize: 11, fontWeight: 950, letterSpacing: 1.25 }}>CAMINO AL 10 · FASE 4</div>
            <h1 style={{ margin: "2px 0 0", fontSize: "clamp(22px, 6vw, 30px)", lineHeight: 1, textShadow: "0 2px 10px #000" }}>Supera la defensa</h1>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ padding: "7px 10px", borderRadius: 999, background: "rgba(4,15,25,.62)", border: "1px solid rgba(255,255,255,.3)", fontSize: 12, fontWeight: 900, backdropFilter: "blur(7px)" }}>18 m</span>
            <button onClick={leaveDemo} aria-label="Cerrar demo V10 y volver al juego" style={{ width: 42, height: 42, borderRadius: 13, border: "1px solid rgba(255,255,255,.34)", background: "rgba(4,15,25,.68)", color: "white", fontSize: 22, fontWeight: 900, backdropFilter: "blur(8px)", pointerEvents: "auto" }}>×</button>
          </div>
        </header>

        <section aria-live="polite" style={{ position: "absolute", top: "12%", left: 14, right: 14, zIndex: 10, display: "grid", justifyItems: "center", gap: 8, pointerEvents: "none" }}>
          <div style={{ maxWidth: 390, padding: "8px 13px", borderRadius: 999, background: "rgba(3,14,23,.68)", border: `1px solid ${spinApplied ? "#c89bff" : "rgba(255,255,255,.32)"}`, color: spinApplied ? "#ead9ff" : "#f4f8f5", fontSize: 13, fontWeight: 900, textAlign: "center", textShadow: "0 1px 3px #000", backdropFilter: "blur(8px)" }}>
            {hint}
          </div>
          {phase !== "ready" && (
            <div style={{ display: "flex", gap: 6 }}>
              <span style={{ padding: "4px 8px", borderRadius: 999, background: "rgba(0,0,0,.5)", fontSize: 11, fontWeight: 900 }}>Fuerza: {getForceCopy(launch)}</span>
              <span style={{ padding: "4px 8px", borderRadius: 999, background: "rgba(0,0,0,.5)", fontSize: 11, fontWeight: 900 }}>{spinApplied ? `Efecto ${spinApplied === "right" ? "derecho" : "izquierdo"}` : "Sin efecto"}</span>
            </div>
          )}
        </section>

        <div role="group" aria-label="Defensa del tiro" style={{ position: "absolute", top: "18.5%", left: 14, right: 14, zIndex: 11, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, padding: 4, borderRadius: 15, background: "rgba(3,14,23,.72)", border: "1px solid rgba(255,255,255,.24)", backdropFilter: "blur(9px)", pointerEvents: "auto" }}>
          {DEFENSE_OPTIONS.map((option) => {
            const selected = defenseMode === option.mode;
            return (
              <button
                key={option.mode}
                type="button"
                aria-pressed={selected}
                disabled={phase === "flight"}
                onClick={() => selectDefense(option.mode)}
                style={{ minHeight: 38, border: selected ? "2px solid #ffd166" : "1px solid rgba(255,255,255,.2)", borderRadius: 11, background: selected ? "rgba(255,189,89,.2)" : "rgba(255,255,255,.07)", color: selected ? "#ffe5a3" : "#e7f0eb", fontSize: 11, fontWeight: 950, opacity: phase === "flight" && !selected ? 0.46 : 1, pointerEvents: "auto" }}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        {phase === "ready" && !drag && (
          <div aria-hidden="true" style={{ position: "absolute", left: "50%", bottom: "22%", width: 76, height: 76, transform: "translate(-50%, 50%)", borderRadius: "50%", border: "2px solid rgba(255,189,89,.9)", boxShadow: "0 0 22px rgba(255,189,89,.42)", zIndex: 5, animation: "pulse-glow 1.4s ease-in-out infinite", pointerEvents: "none" }} />
        )}

        {phase === "result" && (
          <section role="status" style={{ position: "absolute", top: "29%", left: "50%", transform: "translateX(-50%)", zIndex: 10, width: "min(82%, 360px)", padding: "15px 18px", textAlign: "center", borderRadius: 19, background: "rgba(3,13,20,.82)", border: `2px solid ${resultCopy.accent}`, boxShadow: `0 0 30px ${resultCopy.accent}44`, backdropFilter: "blur(10px)", pointerEvents: "none" }}>
            <strong style={{ display: "block", color: resultCopy.accent, fontSize: 30, lineHeight: 1 }}>{resultCopy.title}</strong>
            <span style={{ display: "block", marginTop: 6, fontSize: 14 }}>{resultCopy.detail}</span>
          </section>
        )}

        <section style={{ position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 11, padding: "12px 16px max(18px, env(safe-area-inset-bottom, 18px))", display: "grid", gap: 9, pointerEvents: "none" }}>
          <div style={{ padding: "11px 13px", borderRadius: 16, background: "rgba(3,14,23,.74)", border: "1px solid rgba(255,255,255,.24)", backdropFilter: "blur(9px)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 950, letterSpacing: 0.7 }}>FUERZA DEL GESTO</span>
              <span style={{ color: forcePercent >= 65 ? "#ffbd59" : "#dce8e1", fontSize: 12, fontWeight: 900 }}>{forcePercent}%</span>
            </div>
            <div style={{ height: 9, borderRadius: 99, overflow: "hidden", background: "rgba(255,255,255,.14)" }}>
              <div style={{ height: "100%", width: `${forcePercent}%`, borderRadius: 99, background: "linear-gradient(90deg, #72f2a1, #ffd166, #ff7b45)", transition: "width 80ms linear" }} />
            </div>
          </div>
          {phase === "result" ? (
            <button onClick={reset} style={{ minHeight: 56, borderRadius: 17, border: "3px solid rgba(255,255,255,.4)", background: "linear-gradient(180deg, #ff7a3d, #e64921)", color: "white", fontSize: 19, fontWeight: 950, boxShadow: "0 6px 0 #9e2d17", pointerEvents: "auto" }}>PROBAR OTRO TIRO</button>
          ) : (
            <p style={{ margin: 0, textAlign: "center", color: "rgba(225,238,230,.78)", fontSize: 11, fontWeight: 800 }}>
              {phase === "ready" ? "La rapidez controla la fuerza · la dirección controla el destino" : spinApplied ? "El efecto ya fue aplicado" : "Un segundo gesto lateral curva la pelota"}
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
