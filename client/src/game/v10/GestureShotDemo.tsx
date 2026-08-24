import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { sounds } from "../engine/soundSystem";
import StadiumCanvas from "./StadiumCanvas";
import {
  resolveFootballShot,
  type DefenseMode,
  type FootballOutcome,
  type ResolvedFootballShot,
} from "./footballCollisions";
import { continueFlightWithSpin, createInteractiveShotConfig } from "./midFlightSpin";
import { selectAdaptiveMultiplicationChallenge, type AdaptivePracticeMode } from "./adaptiveMultiplication";
import {
  MATCH_GOAL_BONUS,
  MATCH_MATH_BONUS,
  MATCH_SHOT_LIMIT,
  createMatchMission,
  getMatchMissionSummary,
  loadMatchMission,
  recordMatchShot,
  saveMatchMission,
  startMatchRematch,
  type MatchMissionV1,
} from "./matchMission";
import {
  createDefaultMultiplicationProgress,
  getAdvancedUnlockProgress,
  loadMultiplicationProgress,
  recordCompletedMultiplicationRound,
  saveMultiplicationProgress,
  type MultiplicationProgressV2,
  type TrackMasteryLevel,
} from "./multiplicationProgress";
import {
  MULTIPLICATION_TRACKS,
  evaluateMultiplicationAnswer,
  type MultiplicationTrack,
} from "./multiplicationRound";
import { curveFromSwipe, getForceBand, launchFromSwipe, type GesturePoint, type LaunchGesture } from "./shotGesture";
import { simulateShot, type ShotPhysicsConfig, type ShotPhysicsResult } from "./shotPhysics3d";
import {
  getStadiumFeedback,
  loadSoundPreference,
  saveSoundPreference,
  type StadiumAudioCue,
  type StadiumFeedback,
} from "./stadiumAtmosphere";
import {
  LIGHTNING_MAX_PLAYERS,
  LIGHTNING_SHOTS_PER_PLAYER,
  clearLightningCup,
  createLightningCup,
  createLightningSeed,
  createLightningShareUrl,
  getActiveLightningPlayer,
  getLightningChallenge,
  getLightningStandings,
  loadLightningCup,
  readLightningInvitation,
  recordLightningShot,
  saveLightningCup,
  type LightningCupV1,
  type LightningInvitation,
} from "./lightningCup";
import {
  LIVE_ROOM_PLAYER_COLORS,
  clearLiveRoomSession,
  createLiveRoomShareUrl,
  createRemoteLiveRoom,
  fetchRemoteLiveRoom,
  getLiveRoomChallenge,
  joinRemoteLiveRoom,
  loadLiveRoomSession,
  readLiveRoomInvitation,
  saveLiveRoomSession,
  sanitizeLiveRoomCode,
  startRemoteLiveRoom,
  submitRemoteLiveShot,
  type LiveRoomSession,
  type LiveRoomSnapshot,
} from "./liveRoom";

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
const CELEBRATION_PIECES = Array.from({ length: 14 }, (_, index) => ({
  left: `${5 + ((index * 31) % 90)}%`,
  delay: `${(index % 5) * 70}ms`,
  color: ["#ffd166", "#72f2a1", "#ff7a3d", "#68c7ff"][index % 4],
}));

const MASTERY_LABELS: Record<TrackMasteryLevel, string> = {
  discovering: "Descubriendo",
  practicing: "Practicando",
  mastering: "Dominando",
  mastered: "Dominada",
};

const ADAPTIVE_MODE_LABELS: Record<AdaptivePracticeMode, string> = {
  explore: "Explorando",
  reinforce: "Reforzando",
  balance: "Equilibrando",
  challenge: "Desafío",
};

function getBrowserStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

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

function playStadiumCue(cue: StadiumAudioCue, enabled: boolean) {
  if (!enabled) return;
  if (cue === "goal") sounds.goal();
  else if (cue === "save") sounds.save();
  else if (cue === "wall") sounds.wall();
  else if (cue === "unlock") sounds.unlock();
  else if (cue === "missionComplete") sounds.missionComplete();
  else sounds.miss();
}

export default function GestureShotDemo() {
  const initialPhysicsResult = useMemo(() => simulateShot(DEFAULT_CONFIG), []);
  const initialResolved = useMemo(() => resolveFootballShot(initialPhysicsResult, "open", DEFAULT_CONFIG.goal), [initialPhysicsResult]);
  const [resolvedShot, setResolvedShot] = useState<ResolvedFootballShot>(initialResolved);
  const [defenseMode, setDefenseMode] = useState<DefenseMode>("open");
  const [savedProgress, setSavedProgress] = useState<MultiplicationProgressV2>(() => createDefaultMultiplicationProgress());
  const [matchMission, setMatchMission] = useState<MatchMissionV1>(() => createMatchMission());
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [stadiumFeedback, setStadiumFeedback] = useState<StadiumFeedback | null>(null);
  const [lightningCup, setLightningCup] = useState<LightningCupV1 | null>(null);
  const [socialOpen, setSocialOpen] = useState(false);
  const [playerNames, setPlayerNames] = useState(["Martín", "Amigo 1"]);
  const [invitation, setInvitation] = useState<LightningInvitation | null>(null);
  const [shareUrl, setShareUrl] = useState("");
  const [liveSession, setLiveSession] = useState<LiveRoomSession | null>(null);
  const [liveRoom, setLiveRoom] = useState<LiveRoomSnapshot | null>(null);
  const [liveRoomCode, setLiveRoomCode] = useState("");
  const [liveBusy, setLiveBusy] = useState(false);
  const [liveError, setLiveError] = useState("");
  const [remoteSubmitState, setRemoteSubmitState] = useState<"idle" | "submitting" | "saved" | "error">("idle");
  const [tableTrack, setTableTrack] = useState<MultiplicationTrack>("tables-2-5");
  const adaptiveSelection = useMemo(
    () => selectAdaptiveMultiplicationChallenge(savedProgress, tableTrack),
    [savedProgress, tableTrack],
  );
  const challenge = useMemo(() => {
    if (liveRoom && liveSession && liveRoom.status !== "waiting") return getLiveRoomChallenge(liveRoom, liveSession.playerId);
    if (lightningCup) return getLightningChallenge(lightningCup);
    return adaptiveSelection.challenge;
  }, [adaptiveSelection.challenge, lightningCup, liveRoom, liveSession]);
  const [mathSolved, setMathSolved] = useState(false);
  const [mathAttempts, setMathAttempts] = useState(0);
  const [mathFeedback, setMathFeedback] = useState("Resuelve para habilitar el remate");
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [firstTryStreak, setFirstTryStreak] = useState(0);
  const [roundFirstTry, setRoundFirstTry] = useState<boolean | null>(null);
  const [justUnlockedAdvanced, setJustUnlockedAdvanced] = useState(false);
  const [phase, setPhase] = useState<DemoPhase>("ready");
  const [progress, setProgress] = useState(0);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [launch, setLaunch] = useState<LaunchGesture | null>(null);
  const [spinApplied, setSpinApplied] = useState<"left" | "right" | null>(null);
  const [hint, setHint] = useState("Resuelve la multiplicación para habilitar el tiro");
  const frameRef = useRef<number | null>(null);
  const physicsResultRef = useRef<ShotPhysicsResult>(initialPhysicsResult);
  const resolvedRef = useRef<ResolvedFootballShot>(initialResolved);
  const configRef = useRef<ShotPhysicsConfig>(DEFAULT_CONFIG);
  const soundEnabledRef = useRef(true);
  const questionStartedAtRef = useRef(0);
  const mathResponseTimeMsRef = useRef(0);
  const pendingRemoteShotRef = useRef<{ roundIndex: number; scored: boolean; firstTry: boolean; responseTimeMs: number } | null>(null);
  const previousLiveStatusRef = useRef<LiveRoomSnapshot["status"] | null>(null);
  const elapsedPhysicsSecondsRef = useRef(0);
  const lastFrameMsRef = useRef(0);

  const stopAnimation = () => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
  };

  useEffect(() => stopAnimation, []);

  useEffect(() => {
    const storage = getBrowserStorage();
    const loaded = loadMultiplicationProgress(storage);
    setSavedProgress(loaded);
    setTableTrack(loaded.activeTrack);
    const loadedMission = loadMatchMission(storage);
    const resumableMission = getMatchMissionSummary(loadedMission).completed
      ? startMatchRematch(loadedMission)
      : loadedMission;
    setMatchMission(resumableMission);
    if (resumableMission !== loadedMission) saveMatchMission(storage, resumableMission);
    const loadedSoundPreference = loadSoundPreference(storage);
    soundEnabledRef.current = loadedSoundPreference;
    setSoundEnabled(loadedSoundPreference);
    const incomingInvitation = readLightningInvitation(window.location.search);
    setInvitation(incomingInvitation);
    const incomingRoomCode = readLiveRoomInvitation(window.location.search);
    setLiveRoomCode(incomingRoomCode);
    const storedLiveSession = loadLiveRoomSession(storage);
    if (storedLiveSession) {
      setLiveSession(storedLiveSession);
      setLiveRoomCode(storedLiveSession.roomCode);
      setSocialOpen(true);
    }
    const storedCup = loadLightningCup(storage);
    if (!storedLiveSession && storedCup?.status === "playing") {
      setLightningCup(storedCup);
      setTableTrack(storedCup.track);
      setDefenseMode("keeper");
      questionStartedAtRef.current = performance.now();
    } else if (!storedLiveSession && incomingInvitation) {
      setTableTrack(incomingInvitation.track);
      setSocialOpen(true);
    } else if (!storedLiveSession && incomingRoomCode) {
      setSocialOpen(true);
    }
  }, []);

  useEffect(() => {
    if (!liveSession) return;
    let cancelled = false;
    const synchronize = async () => {
      try {
        const room = await fetchRemoteLiveRoom(liveSession);
        if (!cancelled) {
          setLiveRoom(room);
          setLiveError("");
        }
      } catch (error) {
        if (!cancelled) setLiveError(error instanceof Error ? error.message : "No pudimos actualizar la sala.");
      }
    };
    void synchronize();
    const interval = window.setInterval(synchronize, 2_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [liveSession]);

  const saveRemoteShot = async () => {
    if (!liveSession || !pendingRemoteShotRef.current) return;
    setRemoteSubmitState("submitting");
    try {
      const room = await submitRemoteLiveShot(liveSession, pendingRemoteShotRef.current);
      pendingRemoteShotRef.current = null;
      setLiveRoom(room);
      setRemoteSubmitState("saved");
      const feedback = getStadiumFeedback(resolvedRef.current.outcome, {
        matchCompleted: room.status === "completed",
        advancedUnlocked: false,
      });
      setStadiumFeedback(feedback);
      playStadiumCue(feedback.audioCue, soundEnabledRef.current);
      const player = room.players.find((item) => item.id === liveSession.playerId);
      setHint(room.status === "completed"
        ? "¡Sala completada! El marcador final está listo"
        : (player?.shotsCompleted ?? 0) >= room.shotsPerPlayer
          ? "Terminaste tus remates · espera al resto del equipo"
          : "Resultado guardado en la sala · prepara el siguiente remate");
    } catch (error) {
      setRemoteSubmitState("error");
      setLiveError(error instanceof Error ? error.message : "No pudimos guardar el remate.");
      setHint("No se guardó el remate · toca reintentar");
    }
  };

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
      if (liveRoom?.status === "playing" && liveSession) {
        const player = liveRoom.players.find((item) => item.id === liveSession.playerId);
        pendingRemoteShotRef.current = {
          roundIndex: player?.shotsCompleted ?? 0,
          scored: resolvedRef.current.outcome === "goal",
          firstTry: roundFirstTry === true,
          responseTimeMs: mathResponseTimeMsRef.current,
        };
        const feedback = getStadiumFeedback(resolvedRef.current.outcome);
        setStadiumFeedback(feedback);
        setPhase("result");
        setHint("Guardando el remate en la sala…");
        void saveRemoteShot();
        return;
      }
      if (lightningCup?.status === "playing") {
        const updatedCup = recordLightningShot(lightningCup, {
          scored: resolvedRef.current.outcome === "goal",
          firstTry: roundFirstTry === true,
          responseTimeMs: mathResponseTimeMsRef.current,
        });
        setLightningCup(updatedCup);
        saveLightningCup(getBrowserStorage(), updatedCup);
        const feedback = getStadiumFeedback(resolvedRef.current.outcome, {
          matchCompleted: updatedCup.status === "completed",
          advancedUnlocked: false,
        });
        setStadiumFeedback(feedback);
        playStadiumCue(feedback.audioCue, soundEnabledRef.current);
        setPhase("result");
        setHint(updatedCup.status === "completed"
          ? "¡Copa completada! Mira el podio relámpago"
          : `Turno terminado · sigue ${getActiveLightningPlayer(updatedCup).name}`);
        return;
      }
      const recorded = recordCompletedMultiplicationRound(savedProgress, {
        track: tableTrack,
        firstTry: roundFirstTry === true,
        scored: resolvedRef.current.outcome === "goal",
        completedAt: new Date().toISOString(),
        factors: { a: challenge.a, b: challenge.b },
      });
      setSavedProgress(recorded.progress);
      saveMultiplicationProgress(getBrowserStorage(), recorded.progress);
      const updatedMission = recordMatchShot(matchMission, {
        scored: resolvedRef.current.outcome === "goal",
        firstTry: roundFirstTry === true,
      });
      setMatchMission(updatedMission);
      saveMatchMission(getBrowserStorage(), updatedMission);
      const feedback = getStadiumFeedback(resolvedRef.current.outcome, {
        matchCompleted: getMatchMissionSummary(updatedMission).completed,
        advancedUnlocked: recorded.justUnlockedAdvanced,
      });
      setStadiumFeedback(feedback);
      playStadiumCue(feedback.audioCue, soundEnabledRef.current);
      setJustUnlockedAdvanced(recorded.justUnlockedAdvanced);
      setPhase("result");
      setHint(recorded.justUnlockedAdvanced ? "¡Tablas 6–9 desbloqueadas por tu progreso!" : "Observa el resultado de tu gesto");
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
    setStadiumFeedback(null);
    setHint("¡Ahora desliza a un lado para darle efecto!");
    if (soundEnabled) {
      sounds.init();
      sounds.kick();
      sounds.whoosh();
    }
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

  const restorePhysicalPreview = (mode: DefenseMode) => {
    stopAnimation();
    const nextResolved = resolveFootballShot(initialPhysicsResult, mode, DEFAULT_CONFIG.goal);
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
    setStadiumFeedback(null);
  };

  const nextChallenge = () => {
    if (soundEnabled) sounds.click();
    restorePhysicalPreview(defenseMode);
    setMathSolved(false);
    setMathAttempts(0);
    setSelectedAnswer(null);
    setRoundFirstTry(null);
    setMathFeedback("Resuelve para habilitar el remate");
    setHint(justUnlockedAdvanced
      ? "¡Tablas 6–9 desbloqueadas por tu progreso!"
      : "Resuelve la multiplicación para habilitar el tiro");
    setJustUnlockedAdvanced(false);
  };

  const prepareLightningTurn = (cup: LightningCupV1) => {
    restorePhysicalPreview("keeper");
    setDefenseMode("keeper");
    setTableTrack(cup.track);
    setMathSolved(false);
    setMathAttempts(0);
    setSelectedAnswer(null);
    setRoundFirstTry(null);
    setJustUnlockedAdvanced(false);
    setMathFeedback("Resuelve para habilitar el remate");
    mathResponseTimeMsRef.current = 0;
    questionStartedAtRef.current = performance.now();
    setHint(`⚡ Turno de ${getActiveLightningPlayer(cup).name} · calcula y remata`);
  };

  const prepareRemoteTurn = (room: LiveRoomSnapshot) => {
    if (!liveSession) return;
    const player = room.players.find((item) => item.id === liveSession.playerId);
    if (!player || player.shotsCompleted >= room.shotsPerPlayer || room.status !== "playing") {
      setSocialOpen(true);
      return;
    }
    restorePhysicalPreview("keeper");
    setDefenseMode("keeper");
    setTableTrack(room.track);
    setMathSolved(false);
    setMathAttempts(0);
    setSelectedAnswer(null);
    setRoundFirstTry(null);
    setJustUnlockedAdvanced(false);
    setMathFeedback("Resuelve para habilitar el remate");
    setRemoteSubmitState("idle");
    setLiveError("");
    mathResponseTimeMsRef.current = 0;
    questionStartedAtRef.current = performance.now();
    setSocialOpen(false);
    setHint(`📡 ${player.nickname} · remate ${player.shotsCompleted + 1} de ${room.shotsPerPlayer}`);
  };

  const enterRemoteRoom = (session: LiveRoomSession, room: LiveRoomSnapshot) => {
    clearLightningCup(getBrowserStorage());
    setLightningCup(null);
    setLiveSession(session);
    setLiveRoom(room);
    setLiveRoomCode(room.code);
    setTableTrack(room.track);
    setShareUrl("");
    saveLiveRoomSession(getBrowserStorage(), session);
    setSocialOpen(true);
  };

  const createLiveRoom = async () => {
    if (liveBusy) return;
    setLiveBusy(true);
    setLiveError("");
    try {
      const result = await createRemoteLiveRoom(playerNames[0] || "Martín", tableTrack);
      enterRemoteRoom(result.session, result.room);
    } catch (error) {
      setLiveError(error instanceof Error ? error.message : "No pudimos crear la sala.");
    } finally {
      setLiveBusy(false);
    }
  };

  const joinLiveRoom = async () => {
    if (liveBusy) return;
    const code = sanitizeLiveRoomCode(liveRoomCode);
    if (code.length !== 6) {
      setLiveError("Escribe el código de seis caracteres.");
      return;
    }
    setLiveBusy(true);
    setLiveError("");
    try {
      const result = await joinRemoteLiveRoom(code, playerNames[0] || "Jugador");
      enterRemoteRoom(result.session, result.room);
    } catch (error) {
      setLiveError(error instanceof Error ? error.message : "No pudimos entrar a la sala.");
    } finally {
      setLiveBusy(false);
    }
  };

  const startLiveRoom = async () => {
    if (!liveSession || liveBusy) return;
    setLiveBusy(true);
    setLiveError("");
    try {
      setLiveRoom(await startRemoteLiveRoom(liveSession));
    } catch (error) {
      setLiveError(error instanceof Error ? error.message : "No pudimos iniciar la sala.");
    } finally {
      setLiveBusy(false);
    }
  };

  const shareLiveRoom = async () => {
    if (!liveRoom) return;
    const url = createLiveRoomShareUrl(window.location.href, liveRoom.code);
    setShareUrl(url);
    try {
      await navigator.clipboard?.writeText(url);
    } catch {
      // The URL remains visible and selectable.
    }
  };

  const leaveLiveRoom = () => {
    clearLiveRoomSession(getBrowserStorage());
    setLiveSession(null);
    setLiveRoom(null);
    setLiveRoomCode("");
    setLiveError("");
    setShareUrl("");
    setRemoteSubmitState("idle");
    pendingRemoteShotRef.current = null;
    previousLiveStatusRef.current = null;
    restorePhysicalPreview("open");
    setDefenseMode("open");
    setSocialOpen(true);
    const url = new URL(window.location.href);
    url.searchParams.delete("room");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  };

  const continueRemoteRoom = () => {
    if (remoteSubmitState === "error") {
      void saveRemoteShot();
      return;
    }
    if (!liveRoom || !liveSession) return;
    const player = liveRoom.players.find((item) => item.id === liveSession.playerId);
    if (liveRoom.status === "completed" || (player?.shotsCompleted ?? 0) >= liveRoom.shotsPerPlayer) {
      setSocialOpen(true);
      return;
    }
    prepareRemoteTurn(liveRoom);
  };

  useEffect(() => {
    const status = liveRoom?.status ?? null;
    const previous = previousLiveStatusRef.current;
    previousLiveStatusRef.current = status;
    const transitionTimer = window.setTimeout(() => {
      if (liveRoom && liveSession && status === "playing" && (previous === null || previous === "waiting")) {
        prepareRemoteTurn(liveRoom);
      }
      if (liveRoom && status === "completed") setSocialOpen(true);
    }, 0);
    return () => window.clearTimeout(transitionTimer);
    // Room objects refresh every two seconds; status and player identity are the transition signals.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveRoom?.status, liveSession?.playerId]);

  const startLightningCup = (names: readonly string[], seed?: string) => {
    if (soundEnabled) sounds.click();
    const cup = createLightningCup(names, { seed, track: invitation?.track ?? tableTrack });
    setLightningCup(cup);
    saveLightningCup(getBrowserStorage(), cup);
    setSocialOpen(false);
    setShareUrl("");
    prepareLightningTurn(cup);
  };

  const changePlayerCount = (count: number) => {
    const safeCount = Math.min(LIGHTNING_MAX_PLAYERS, Math.max(2, count));
    setPlayerNames((current) => Array.from({ length: safeCount }, (_, index) => current[index] ?? `Amigo ${index}`));
  };

  const updatePlayerName = (index: number, name: string) => {
    setPlayerNames((current) => current.map((value, itemIndex) => itemIndex === index ? name : value));
  };

  const createSharedChallenge = async () => {
    const nextInvitation = { seed: createLightningSeed(), track: tableTrack } satisfies LightningInvitation;
    const url = createLightningShareUrl(window.location.href, nextInvitation);
    setShareUrl(url);
    try {
      await navigator.clipboard?.writeText(url);
    } catch {
      // The visible URL remains selectable when clipboard access is unavailable.
    }
  };

  const continueLightningCup = () => {
    if (!lightningCup || lightningCup.status === "completed") return;
    if (soundEnabled) sounds.click();
    prepareLightningTurn(lightningCup);
  };

  const abandonLightningCup = () => {
    clearLightningCup(getBrowserStorage());
    setLightningCup(null);
    setInvitation(null);
    setShareUrl("");
    setSocialOpen(true);
    restorePhysicalPreview("open");
    setDefenseMode("open");
    const url = new URL(window.location.href);
    url.searchParams.delete("lightning");
    url.searchParams.delete("track");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  };

  const copyLightningResult = async () => {
    if (!lightningCup) return;
    const standings = getLightningStandings(lightningCup);
    const result = [
      "⚡ Copa relámpago · Tiro Libre Matemático",
      ...standings.map((standing) => `${standing.rank}. ${standing.player.name}: ${standing.score} pts · ${standing.goals} goles · ${standing.firstTryCorrect} a la primera`),
      window.location.origin,
    ].join("\n");
    try {
      await navigator.clipboard?.writeText(result);
      setShareUrl("Resultado copiado · listo para enviarlo al grupo");
    } catch {
      setShareUrl(result);
    }
  };

  const startRematch = () => {
    const nextMission = startMatchRematch(matchMission);
    setMatchMission(nextMission);
    saveMatchMission(getBrowserStorage(), nextMission);
    setFirstTryStreak(0);
    nextChallenge();
    setHint("Nueva misión: completa cinco remates y busca las dos bonificaciones");
  };

  const toggleSound = () => {
    const nextEnabled = !soundEnabled;
    if (nextEnabled) {
      sounds.init();
      sounds.click();
    } else {
      sounds.click();
    }
    soundEnabledRef.current = nextEnabled;
    setSoundEnabled(nextEnabled);
    saveSoundPreference(getBrowserStorage(), nextEnabled);
  };

  const selectTableTrack = (track: MultiplicationTrack) => {
    if (phase === "flight" || lightningCup || liveRoom) return;
    if (track === "tables-6-9" && !savedProgress.advancedUnlocked) {
      setMathFeedback("Completa el camino de tablas 2–5 para desbloquear este reto");
      setHint("Las tablas 6–9 todavía están bloqueadas");
      return;
    }
    const nextProgress = { ...savedProgress, activeTrack: track };
    setSavedProgress(nextProgress);
    saveMultiplicationProgress(getBrowserStorage(), nextProgress);
    restorePhysicalPreview(defenseMode);
    setTableTrack(track);
    setMathSolved(false);
    setMathAttempts(0);
    setSelectedAnswer(null);
    setRoundFirstTry(null);
    setFirstTryStreak(0);
    setMathFeedback("Resuelve para habilitar el remate");
    setHint(`Comienza con ${MULTIPLICATION_TRACKS[track].label.toLowerCase()}`);
  };

  const answerMath = (answer: number) => {
    if (mathSolved || phase !== "ready") return;
    const evaluation = evaluateMultiplicationAnswer(challenge, answer, mathAttempts);
    setSelectedAnswer(answer);
    setMathAttempts(evaluation.nextAttempt);
    setMathFeedback(evaluation.feedback);
    if (evaluation.correct) {
      if (soundEnabled) sounds.correct();
      mathResponseTimeMsRef.current = questionStartedAtRef.current > 0
        ? Math.max(0, performance.now() - questionStartedAtRef.current)
        : 0;
      setMathSolved(true);
      setRoundFirstTry(evaluation.firstTry);
      setFirstTryStreak((current) => evaluation.firstTry ? current + 1 : 0);
      setHint(`${challenge.a} × ${challenge.b} = ${challenge.answer} · 🎯 Precisión lista`);
    } else {
      if (soundEnabled) sounds.wrong();
      setFirstTryStreak(0);
      setHint("Casi: usa la ayuda y vuelve a intentarlo");
    }
  };

  const selectDefense = (mode: DefenseMode) => {
    if (phase !== "ready" || lightningCup || liveRoom) return;
    if (soundEnabled) sounds.click();
    restorePhysicalPreview(mode);
    setDefenseMode(mode);
    setHint(mathSolved
      ? mode === "wall" ? "Precisión lista: supera la barrera" : mode === "keeper" ? "Precisión lista: busca un rincón" : "Precisión lista: desliza hacia el arco"
      : "Resuelve la multiplicación para habilitar el tiro");
  };

  const leaveDemo = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("v10Demo");
    window.location.assign(`${url.pathname}${url.search}${url.hash}`);
  };

  const beginGesture = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (phase === "result" || (phase === "flight" && spinApplied)) return;
    if (phase === "ready" && !mathSolved) {
      setHint("Primero resuelve la multiplicación");
      return;
    }
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
  const currentTrackProgress = savedProgress.tracks[tableTrack];
  const unlockProgress = getAdvancedUnlockProgress(savedProgress.tracks["tables-2-5"]);
  const matchSummary = getMatchMissionSummary(matchMission);
  const lightningStandings = lightningCup ? getLightningStandings(lightningCup) : [];
  const activeLightningPlayer = lightningCup ? getActiveLightningPlayer(lightningCup) : null;
  const activeLightningStanding = activeLightningPlayer
    ? lightningStandings.find((standing) => standing.player.id === activeLightningPlayer.id)
    : null;
  const myLivePlayer = liveRoom && liveSession
    ? liveRoom.players.find((player) => player.id === liveSession.playerId) ?? null
    : null;
  const liveRank = myLivePlayer && liveRoom
    ? liveRoom.players.findIndex((player) => player.id === myLivePlayer.id) + 1
    : 0;
  const isLiveHost = Boolean(liveRoom && liveSession && liveRoom.hostPlayerId === liveSession.playerId);

  return (
    <main
      data-v10-gesture-demo="true"
      style={{ position: "fixed", inset: 0, width: "100%", minHeight: "100dvh", overflow: "hidden", background: "#06111a", color: "white", fontFamily: "Nunito, sans-serif" }}
    >
      <div style={{ width: "100%", height: "100dvh", maxWidth: 560, margin: "0 auto", position: "relative", overflow: "hidden", background: "#0d3824" }}>
        <StadiumCanvas samples={resolvedShot.displaySamples} goalDistanceM={GOAL_DISTANCE_M} actors={resolvedShot.actors} progress={progress} />
        <div aria-hidden="true" style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "linear-gradient(180deg, rgba(1,8,18,.72) 0%, transparent 24%, transparent 63%, rgba(1,8,16,.9) 100%)" }} />

        {stadiumFeedback && stadiumFeedback.celebration !== "none" && (
          <div className={`stadium-celebration stadium-celebration--${stadiumFeedback.celebration}`} data-stadium-celebration={stadiumFeedback.celebration} aria-hidden="true">
            <div className="stadium-celebration__pulse" />
            {stadiumFeedback.celebration !== "save" && CELEBRATION_PIECES.map((piece, index) => (
              <span
                key={`${piece.left}-${index}`}
                className="stadium-celebration__piece"
                style={{ left: piece.left, background: piece.color, animationDelay: piece.delay }}
              />
            ))}
          </div>
        )}

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
            if ((event.key === "Enter" || event.key === " ") && phase === "ready" && mathSolved) {
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
              if (liveRoom) continueRemoteRoom();
              else if (lightningCup) {
                if (lightningCup.status === "completed") setSocialOpen(true);
                else continueLightningCup();
              } else if (matchSummary.completed) startRematch();
              else nextChallenge();
            }
          }}
          style={{ position: "absolute", inset: 0, zIndex: 6, touchAction: "none", outline: "none", cursor: phase === "ready" && mathSolved ? "grab" : phase === "flight" && !spinApplied ? "ew-resize" : "default" }}
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
            <div style={{ color: "#ffd166", fontSize: 11, fontWeight: 950, letterSpacing: 1.25 }}>CAMINO AL 10 · FASE 11</div>
            <h1 style={{ margin: "2px 0 0", fontSize: "clamp(20px, 5.4vw, 28px)", lineHeight: 1, textShadow: "0 2px 10px #000" }}>{liveRoom ? "Sala relámpago" : lightningCup ? "Copa relámpago" : "Juega con tu equipo"}</h1>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <button onClick={() => setSocialOpen(true)} disabled={phase === "flight"} aria-label="Abrir juegos con amigos" style={{ width: 42, height: 42, borderRadius: 13, border: lightningCup || liveRoom ? "2px solid #ffd166" : "1px solid rgba(255,255,255,.34)", background: lightningCup || liveRoom ? "rgba(255,209,102,.2)" : "rgba(4,15,25,.68)", color: "white", fontSize: 18, fontWeight: 900, backdropFilter: "blur(8px)", pointerEvents: "auto" }}>{liveRoom ? "📡" : "⚡"}</button>
            <button onClick={toggleSound} aria-pressed={soundEnabled} aria-label={soundEnabled ? "Silenciar sonido" : "Activar sonido"} style={{ width: 42, height: 42, borderRadius: 13, border: "1px solid rgba(255,255,255,.34)", background: "rgba(4,15,25,.68)", color: "white", fontSize: 18, fontWeight: 900, backdropFilter: "blur(8px)", pointerEvents: "auto" }}>{soundEnabled ? "🔊" : "🔇"}</button>
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

        {liveRoom && myLivePlayer ? (
          <div data-live-room-scoreboard="true" aria-label={`Sala ${liveRoom.code}: ${myLivePlayer.nickname}, remate ${Math.min(liveRoom.shotsPerPlayer, myLivePlayer.shotsCompleted + 1)} de ${liveRoom.shotsPerPlayer}`} style={{ position: "absolute", top: "18.5%", left: 14, right: 14, zIndex: 11, display: "grid", gridTemplateColumns: "1.25fr 1fr 1fr", gap: 6, pointerEvents: "none" }}>
            <span style={{ padding: "6px 7px", borderRadius: 11, background: "rgba(3,14,23,.84)", border: `1px solid ${LIVE_ROOM_PLAYER_COLORS[myLivePlayer.colorIndex] ?? "#72f2a1"}`, color: LIVE_ROOM_PLAYER_COLORS[myLivePlayer.colorIndex] ?? "#72f2a1", textAlign: "center", fontSize: 10, fontWeight: 950, backdropFilter: "blur(8px)" }}>📡 {myLivePlayer.nickname.toUpperCase()}</span>
            <span style={{ padding: "6px 7px", borderRadius: 11, background: "rgba(3,14,23,.78)", border: "1px solid rgba(255,255,255,.24)", textAlign: "center", fontSize: 10, fontWeight: 950, backdropFilter: "blur(8px)" }}>TIRO {myLivePlayer.shotsCompleted}/{liveRoom.shotsPerPlayer}</span>
            <span style={{ padding: "6px 7px", borderRadius: 11, background: "rgba(3,14,23,.78)", border: "1px solid rgba(255,255,255,.24)", textAlign: "center", fontSize: 10, fontWeight: 950, backdropFilter: "blur(8px)" }}>#{liveRank || "–"} · {myLivePlayer.score} PTS</span>
          </div>
        ) : lightningCup && activeLightningPlayer ? (
          <div data-lightning-scoreboard="true" aria-label={`Copa relámpago: turno de ${activeLightningPlayer.name}, ronda ${lightningCup.roundIndex + 1} de ${LIGHTNING_SHOTS_PER_PLAYER}`} style={{ position: "absolute", top: "18.5%", left: 14, right: 14, zIndex: 11, display: "grid", gridTemplateColumns: "1.25fr 1fr 1fr", gap: 6, pointerEvents: "none" }}>
            <span style={{ padding: "6px 7px", borderRadius: 11, background: "rgba(3,14,23,.84)", border: `1px solid ${activeLightningPlayer.color}`, color: activeLightningPlayer.color, textAlign: "center", fontSize: 10, fontWeight: 950, backdropFilter: "blur(8px)" }}>⚡ {activeLightningPlayer.name.toUpperCase()}</span>
            <span style={{ padding: "6px 7px", borderRadius: 11, background: "rgba(3,14,23,.78)", border: "1px solid rgba(255,255,255,.24)", textAlign: "center", fontSize: 10, fontWeight: 950, backdropFilter: "blur(8px)" }}>RONDA {lightningCup.roundIndex + 1}/{LIGHTNING_SHOTS_PER_PLAYER}</span>
            <span style={{ padding: "6px 7px", borderRadius: 11, background: "rgba(3,14,23,.78)", border: "1px solid rgba(255,255,255,.24)", textAlign: "center", fontSize: 10, fontWeight: 950, backdropFilter: "blur(8px)" }}>{activeLightningStanding?.score ?? 0} PTS</span>
          </div>
        ) : (
          <div data-match-scoreboard="true" aria-label={`Partido ${matchMission.matchNumber}: ${matchSummary.goals} goles y ${matchSummary.firstTryCorrect} respuestas al primer intento`} style={{ position: "absolute", top: "18.5%", left: 14, right: 14, zIndex: 11, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, pointerEvents: "none" }}>
            <span style={{ padding: "6px 7px", borderRadius: 11, background: "rgba(3,14,23,.78)", border: `1px solid ${matchSummary.goalBonusReached ? "#72f2a1" : "rgba(255,255,255,.24)"}`, textAlign: "center", fontSize: 10, fontWeight: 950, backdropFilter: "blur(8px)" }}>⚽ {matchSummary.goals}/{MATCH_GOAL_BONUS} GOLES</span>
            <span style={{ padding: "6px 7px", borderRadius: 11, background: "rgba(3,14,23,.78)", border: `1px solid ${matchSummary.mathBonusReached ? "#ffd166" : "rgba(255,255,255,.24)"}`, textAlign: "center", fontSize: 10, fontWeight: 950, backdropFilter: "blur(8px)" }}>🎯 {matchSummary.firstTryCorrect}/{MATCH_MATH_BONUS} PRIMERA</span>
            <span style={{ padding: "6px 7px", borderRadius: 11, background: "rgba(3,14,23,.78)", border: "1px solid rgba(255,255,255,.24)", textAlign: "center", fontSize: 10, fontWeight: 950, backdropFilter: "blur(8px)" }}>Tiro {matchSummary.currentShot}/{MATCH_SHOT_LIMIT} · PARTIDO {matchMission.matchNumber}</span>
          </div>
        )}

        <div role="group" aria-label="Defensa del tiro" style={{ position: "absolute", top: "23%", left: 14, right: 14, zIndex: 11, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, padding: 4, borderRadius: 15, background: "rgba(3,14,23,.72)", border: "1px solid rgba(255,255,255,.24)", backdropFilter: "blur(9px)", pointerEvents: "auto" }}>
          {DEFENSE_OPTIONS.map((option) => {
            const selected = defenseMode === option.mode;
            return (
              <button
                key={option.mode}
                type="button"
                aria-pressed={selected}
                disabled={phase !== "ready" || Boolean(lightningCup) || Boolean(liveRoom)}
                onClick={() => selectDefense(option.mode)}
                style={{ minHeight: 38, border: selected ? "2px solid #ffd166" : "1px solid rgba(255,255,255,.2)", borderRadius: 11, background: selected ? "rgba(255,189,89,.2)" : "rgba(255,255,255,.07)", color: selected ? "#ffe5a3" : "#e7f0eb", fontSize: 11, fontWeight: 950, opacity: phase !== "ready" && !selected ? 0.46 : 1, pointerEvents: "auto" }}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        {phase === "ready" && !mathSolved && (
          <section data-v10-multiplication-challenge="true" aria-labelledby="multiplication-question" style={{ position: "absolute", top: "31%", left: 14, right: 14, zIndex: 12, padding: "13px 14px 14px", borderRadius: 20, background: "rgba(3,13,22,.9)", border: "2px solid rgba(114,242,161,.62)", boxShadow: "0 12px 34px rgba(0,0,0,.34)", backdropFilter: "blur(12px)", pointerEvents: "auto" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 9 }}>
              <span style={{ color: "#72f2a1", fontSize: 10, fontWeight: 950, letterSpacing: 1.1 }}>{liveRoom ? "SALA EN VIVO · RETO ESPEJO" : lightningCup ? "COPA JUSTA · MISMA PREGUNTA" : "ACADEMIA DE TABLAS · ADAPTATIVA"}</span>
              <span style={{ color: "#d6e7df", fontSize: 10, fontWeight: 900 }}>{liveRoom ? `SALA ${liveRoom.code}` : lightningCup ? `CÓDIGO ${lightningCup.seed}` : `${MASTERY_LABELS[currentTrackProgress.mastery]} · ${currentTrackProgress.roundsCompleted} retos`}</span>
            </div>
            <div aria-label={liveRoom || lightningCup ? "Regla de equidad: todos reciben la misma pregunta de la ronda" : `Modo adaptativo: ${ADAPTIVE_MODE_LABELS[adaptiveSelection.mode]}`} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, margin: "-2px 0 9px", color: "#ffe4a1", fontSize: 10, fontWeight: 900 }}>
              <span>⚡ {liveRoom && myLivePlayer ? `Remate ${myLivePlayer.shotsCompleted + 1} de ${liveRoom.shotsPerPlayer}` : lightningCup ? `Ronda ${lightningCup.roundIndex + 1} de ${LIGHTNING_SHOTS_PER_PLAYER}` : ADAPTIVE_MODE_LABELS[adaptiveSelection.mode]}</span>
              <span aria-hidden="true">·</span>
              <span>{liveRoom || lightningCup ? "La precisión decide" : adaptiveSelection.message}</span>
            </div>
            <div role="group" aria-label="Rango de tablas" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5, marginBottom: 10 }}>
              {(Object.keys(MULTIPLICATION_TRACKS) as MultiplicationTrack[]).map((track) => {
                const selected = tableTrack === track;
                const locked = track === "tables-6-9" && !savedProgress.advancedUnlocked;
                return (
                  <button key={track} type="button" disabled={Boolean(lightningCup) || Boolean(liveRoom)} aria-pressed={selected} aria-disabled={locked || Boolean(lightningCup) || Boolean(liveRoom)} onClick={() => selectTableTrack(track)} style={{ minHeight: 31, border: selected ? "2px solid #72f2a1" : "1px solid rgba(255,255,255,.2)", borderRadius: 10, background: selected ? "rgba(114,242,161,.16)" : "rgba(255,255,255,.06)", color: selected ? "#a6f8c2" : locked ? "#91a099" : "#d6e2dc", fontSize: 11, fontWeight: 950, opacity: locked ? 0.7 : 1 }}>
                    {locked ? "🔒 " : ""}{MULTIPLICATION_TRACKS[track].label}
                  </button>
                );
              })}
            </div>
            {!liveRoom && !lightningCup && !savedProgress.advancedUnlocked && (
              <div aria-label={`Progreso para desbloquear tablas 6 a 9: ${unlockProgress}%`} style={{ margin: "0 1px 10px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 4, color: "#b9cbc2", fontSize: 9, fontWeight: 900 }}>
                  <span>CAMINO A TABLAS 6–9</span><span>{unlockProgress}%</span>
                </div>
                <div style={{ height: 5, borderRadius: 99, overflow: "hidden", background: "rgba(255,255,255,.12)" }}>
                  <div style={{ width: `${unlockProgress}%`, height: "100%", borderRadius: 99, background: "linear-gradient(90deg, #72f2a1, #ffd166)", transition: "width .2s ease" }} />
                </div>
              </div>
            )}
            <h2 id="multiplication-question" style={{ margin: "2px 0 11px", textAlign: "center", fontSize: "clamp(30px, 9vw, 42px)", lineHeight: 1, letterSpacing: 1, textShadow: "0 2px 10px #000" }}>{challenge.question}</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
              {challenge.options.map((answer) => {
                const wasWrong = selectedAnswer === answer && answer !== challenge.answer;
                return (
                  <button key={answer} type="button" onClick={() => answerMath(answer)} aria-label={`Responder ${answer}`} style={{ minHeight: 47, borderRadius: 13, border: wasWrong ? "2px solid #ff8b8b" : "2px solid rgba(255,255,255,.28)", background: wasWrong ? "rgba(255,90,90,.2)" : "linear-gradient(180deg, rgba(255,255,255,.15), rgba(255,255,255,.07))", color: "white", fontSize: 21, fontWeight: 950, boxShadow: "0 3px 0 rgba(0,0,0,.28)" }}>
                    {answer}
                  </button>
                );
              })}
            </div>
            <p aria-live="polite" style={{ minHeight: 18, margin: "10px 0 0", color: mathAttempts > 0 ? "#ffd9a0" : "#cfe0d8", textAlign: "center", fontSize: 12, fontWeight: 850 }}>{mathFeedback}</p>
          </section>
        )}

        {phase === "ready" && mathSolved && !drag && (
          <div aria-hidden="true" style={{ position: "absolute", left: "50%", bottom: "22%", width: 76, height: 76, transform: "translate(-50%, 50%)", borderRadius: "50%", border: "2px solid rgba(255,189,89,.9)", boxShadow: "0 0 22px rgba(255,189,89,.42)", zIndex: 5, animation: "pulse-glow 1.4s ease-in-out infinite", pointerEvents: "none" }} />
        )}

        {phase === "result" && !liveRoom && !lightningCup && !matchSummary.completed && (
          <section role="status" style={{ position: "absolute", top: "29%", left: "50%", transform: "translateX(-50%)", zIndex: 10, width: "min(82%, 360px)", padding: "15px 18px", textAlign: "center", borderRadius: 19, background: "rgba(3,13,20,.82)", border: `2px solid ${resultCopy.accent}`, boxShadow: `0 0 30px ${resultCopy.accent}44`, backdropFilter: "blur(10px)", pointerEvents: "none" }}>
            <strong style={{ display: "block", color: resultCopy.accent, fontSize: 30, lineHeight: 1 }}>{resultCopy.title}</strong>
            <span style={{ display: "block", marginTop: 6, fontSize: 14 }}>{resultCopy.detail}</span>
            {stadiumFeedback && <span style={{ display: "block", marginTop: 8, color: "#ffe5a3", fontSize: 11, fontWeight: 900 }}>🎙️ {stadiumFeedback.announcer}</span>}
            <span style={{ display: "block", marginTop: 8, color: "#c9d9d1", fontSize: 11, fontWeight: 900 }}>Tablas: {MASTERY_LABELS[currentTrackProgress.mastery]} · Racha {firstTryStreak}</span>
            {justUnlockedAdvanced && <span style={{ display: "block", marginTop: 8, color: "#ffd166", fontSize: 12, fontWeight: 950 }}>🔓 NUEVO RETO: TABLAS 6–9</span>}
          </section>
        )}

        {phase === "result" && !liveRoom && !lightningCup && matchSummary.completed && (
          <section data-match-summary="true" role="status" style={{ position: "absolute", top: "27%", left: "50%", transform: "translateX(-50%)", zIndex: 12, width: "min(86%, 380px)", padding: "18px 18px 17px", textAlign: "center", borderRadius: 22, background: "rgba(3,13,20,.94)", border: "2px solid #ffd166", boxShadow: "0 0 38px rgba(255,209,102,.32)", backdropFilter: "blur(12px)", pointerEvents: "none" }}>
            <span style={{ display: "block", color: "#72f2a1", fontSize: 10, fontWeight: 950, letterSpacing: 1.35 }}>PARTIDO {matchMission.matchNumber} COMPLETADO</span>
            <strong style={{ display: "block", marginTop: 5, color: "#ffd166", fontSize: 31, lineHeight: 1 }} aria-label={`${matchSummary.stars} de 3 estrellas`}>{"★".repeat(matchSummary.stars)}<span style={{ color: "rgba(255,255,255,.24)" }}>{"★".repeat(3 - matchSummary.stars)}</span></strong>
            <span style={{ display: "block", marginTop: 9, fontSize: 14, fontWeight: 900 }}>{matchSummary.message}</span>
            {stadiumFeedback && <span style={{ display: "block", marginTop: 8, color: "#ffe5a3", fontSize: 11, fontWeight: 900 }}>🎙️ {stadiumFeedback.announcer}</span>}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 13 }}>
              <span style={{ padding: 9, borderRadius: 12, background: matchSummary.goalBonusReached ? "rgba(114,242,161,.15)" : "rgba(255,255,255,.07)", border: `1px solid ${matchSummary.goalBonusReached ? "#72f2a1" : "rgba(255,255,255,.16)"}`, fontSize: 11, fontWeight: 950 }}>⚽ {matchSummary.goals} GOLES<br /><small>{matchSummary.goalBonusReached ? "BONUS LOGRADO" : `META ${MATCH_GOAL_BONUS}`}</small></span>
              <span style={{ padding: 9, borderRadius: 12, background: matchSummary.mathBonusReached ? "rgba(255,209,102,.15)" : "rgba(255,255,255,.07)", border: `1px solid ${matchSummary.mathBonusReached ? "#ffd166" : "rgba(255,255,255,.16)"}`, fontSize: 11, fontWeight: 950 }}>🎯 {matchSummary.firstTryCorrect} A LA PRIMERA<br /><small>{matchSummary.mathBonusReached ? "BONUS LOGRADO" : `META ${MATCH_MATH_BONUS}`}</small></span>
            </div>
          </section>
        )}

        {phase === "result" && liveRoom && myLivePlayer && (
          <section data-live-room-result="true" role="status" style={{ position: "absolute", top: "27%", left: "50%", transform: "translateX(-50%)", zIndex: 12, width: "min(86%, 380px)", padding: "17px 18px", textAlign: "center", borderRadius: 22, background: "rgba(3,13,20,.94)", border: `2px solid ${remoteSubmitState === "error" ? "#ff8b8b" : resultCopy.accent}`, boxShadow: `0 0 34px ${resultCopy.accent}44`, backdropFilter: "blur(12px)", pointerEvents: "none" }}>
            <span style={{ display: "block", color: LIVE_ROOM_PLAYER_COLORS[myLivePlayer.colorIndex] ?? "#72f2a1", fontSize: 10, fontWeight: 950, letterSpacing: 1.25 }}>SALA {liveRoom.code} · {myLivePlayer.nickname.toUpperCase()}</span>
            <strong style={{ display: "block", marginTop: 6, color: resultCopy.accent, fontSize: 30, lineHeight: 1 }}>{resultCopy.title}</strong>
            <span style={{ display: "block", marginTop: 7, fontSize: 13 }}>{resultCopy.detail}</span>
            <span style={{ display: "block", marginTop: 10, color: remoteSubmitState === "error" ? "#ffc1c1" : "#ffe5a3", fontSize: 11, fontWeight: 950 }}>{remoteSubmitState === "submitting" ? "📡 Guardando en el marcador…" : remoteSubmitState === "error" ? `⚠ ${liveError}` : `✓ Marcador actualizado · ${myLivePlayer.score} puntos`}</span>
          </section>
        )}

        {phase === "result" && lightningCup && lightningCup.status === "playing" && (
          <section data-lightning-turn-result="true" role="status" style={{ position: "absolute", top: "28%", left: "50%", transform: "translateX(-50%)", zIndex: 12, width: "min(86%, 380px)", padding: "17px 18px", textAlign: "center", borderRadius: 22, background: "rgba(3,13,20,.94)", border: `2px solid ${resultCopy.accent}`, boxShadow: `0 0 34px ${resultCopy.accent}44`, backdropFilter: "blur(12px)", pointerEvents: "none" }}>
            <span style={{ display: "block", color: activeLightningPlayer?.color ?? "#ffd166", fontSize: 10, fontWeight: 950, letterSpacing: 1.25 }}>TURNO DE {lightningCup.players[(lightningCup.activePlayerIndex - 1 + lightningCup.players.length) % lightningCup.players.length]?.name.toUpperCase()}</span>
            <strong style={{ display: "block", marginTop: 6, color: resultCopy.accent, fontSize: 30, lineHeight: 1 }}>{resultCopy.title}</strong>
            <span style={{ display: "block", marginTop: 7, fontSize: 13 }}>{resultCopy.detail}</span>
            <span style={{ display: "block", marginTop: 10, color: "#ffe5a3", fontSize: 12, fontWeight: 950 }}>SIGUE: {activeLightningPlayer?.name.toUpperCase()}</span>
          </section>
        )}

        {phase === "result" && lightningCup && lightningCup.status === "completed" && (
          <section data-lightning-podium="true" role="status" style={{ position: "absolute", top: "25%", left: "50%", transform: "translateX(-50%)", zIndex: 13, width: "min(89%, 400px)", padding: "18px", textAlign: "center", borderRadius: 23, background: "rgba(3,13,20,.96)", border: "2px solid #ffd166", boxShadow: "0 0 42px rgba(255,209,102,.34)", backdropFilter: "blur(12px)", pointerEvents: "auto" }}>
            <span style={{ display: "block", color: "#72f2a1", fontSize: 10, fontWeight: 950, letterSpacing: 1.35 }}>COPA RELÁMPAGO COMPLETADA</span>
            <strong style={{ display: "block", marginTop: 5, color: "#ffd166", fontSize: 26, lineHeight: 1.1 }}>🏆 PODIO DEL EQUIPO</strong>
            <div style={{ display: "grid", gap: 7, marginTop: 13 }}>
              {lightningStandings.map((standing) => (
                <div key={standing.player.id} style={{ display: "grid", gridTemplateColumns: "34px 1fr auto", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 13, background: standing.rank === 1 ? "rgba(255,209,102,.16)" : "rgba(255,255,255,.07)", border: `1px solid ${standing.rank === 1 ? "#ffd166" : "rgba(255,255,255,.16)"}`, textAlign: "left" }}>
                  <span style={{ fontSize: 18, fontWeight: 950 }}>{standing.rank === 1 ? "🥇" : standing.rank === 2 ? "🥈" : standing.rank === 3 ? "🥉" : "4"}</span>
                  <span style={{ color: standing.player.color, fontSize: 12, fontWeight: 950 }}>{standing.player.name}<small style={{ display: "block", marginTop: 2, color: "#c8d8d0", fontSize: 9 }}>⚽ {standing.goals} · 🎯 {standing.firstTryCorrect}</small></span>
                  <strong style={{ color: "white", fontSize: 14 }}>{standing.score} pts</strong>
                </div>
              ))}
            </div>
            <button onClick={copyLightningResult} style={{ width: "100%", minHeight: 40, marginTop: 11, borderRadius: 12, border: "1px solid rgba(255,255,255,.3)", background: "rgba(104,199,255,.16)", color: "#bfe6ff", fontSize: 11, fontWeight: 950 }}>COMPARTIR RESULTADO</button>
            {shareUrl && <p aria-live="polite" style={{ margin: "8px 0 0", color: "#d7e8df", fontSize: 10, overflowWrap: "anywhere" }}>{shareUrl}</p>}
          </section>
        )}

        {socialOpen && (
          <section data-social-lobby="true" data-lightning-lobby="true" role="dialog" aria-modal="true" aria-labelledby="lightning-title" style={{ position: "absolute", inset: 0, zIndex: 30, display: "grid", alignContent: "center", padding: "max(20px, env(safe-area-inset-top, 20px)) 16px max(20px, env(safe-area-inset-bottom, 20px))", background: "linear-gradient(180deg, rgba(2,8,17,.92), rgba(3,18,24,.97))", backdropFilter: "blur(14px)", pointerEvents: "auto", overflowY: "auto" }}>
            <div style={{ width: "100%", maxWidth: 430, margin: "0 auto", padding: "19px", borderRadius: 25, border: "2px solid rgba(255,209,102,.72)", background: "rgba(7,29,35,.96)", boxShadow: "0 20px 70px rgba(0,0,0,.48)" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <span style={{ color: "#72f2a1", fontSize: 10, fontWeight: 950, letterSpacing: 1.3 }}>FASE 11 · SALAS REMOTAS SEGURAS</span>
                  <h2 id="lightning-title" style={{ margin: "4px 0 0", color: "#ffd166", fontSize: 27, lineHeight: 1 }}>{liveRoom ? "📡 Sala relámpago" : "⚡ Juega con amigos"}</h2>
                </div>
                <button type="button" onClick={() => setSocialOpen(false)} aria-label="Cerrar juegos con amigos" style={{ width: 40, height: 40, flex: "0 0 auto", borderRadius: 12, border: "1px solid rgba(255,255,255,.3)", background: "rgba(255,255,255,.08)", color: "white", fontSize: 22, fontWeight: 950 }}>×</button>
              </div>

              {liveRoom ? (
                <div data-live-room-lobby="true" style={{ marginTop: 16 }}>
                  <div style={{ padding: "13px", borderRadius: 16, background: "rgba(104,199,255,.1)", border: "1px solid rgba(104,199,255,.42)", textAlign: "center" }}>
                    <span style={{ display: "block", color: "#bfe7ff", fontSize: 10, fontWeight: 950 }}>{liveRoom.status === "waiting" ? "SALA LISTA PARA INVITAR" : liveRoom.status === "playing" ? "PARTIDO EN CURSO" : "PARTIDO COMPLETADO"}</span>
                    <strong style={{ display: "block", marginTop: 4, color: "white", fontSize: 27, letterSpacing: 4 }}>{liveRoom.code}</strong>
                    <small style={{ color: "#c8d9e2" }}>{liveRoom.players.length}/4 jugadores · tres remates · mismas multiplicaciones</small>
                  </div>
                  <button type="button" onClick={shareLiveRoom} style={{ width: "100%", minHeight: 43, marginTop: 10, borderRadius: 13, border: "1px solid rgba(104,199,255,.5)", background: "rgba(104,199,255,.12)", color: "#bfe7ff", fontSize: 12, fontWeight: 950 }}>🔗 COPIAR ENLACE DE LA SALA</button>
                  {shareUrl && <p aria-live="polite" style={{ margin: "8px 0 0", padding: 9, borderRadius: 10, background: "rgba(0,0,0,.22)", color: "#d7e8df", fontSize: 10, overflowWrap: "anywhere" }}>Enlace listo: {shareUrl}</p>}
                  <div aria-label="Marcador de la sala" style={{ display: "grid", gap: 7, marginTop: 12 }}>
                    {liveRoom.players.map((player, index) => (
                      <div key={player.id} style={{ display: "grid", gridTemplateColumns: "30px 1fr auto", alignItems: "center", gap: 8, padding: "9px 10px", borderRadius: 13, background: player.id === liveSession?.playerId ? "rgba(255,209,102,.12)" : "rgba(255,255,255,.07)", border: `1px solid ${player.id === liveSession?.playerId ? "#ffd166" : "rgba(255,255,255,.14)"}` }}>
                        <span style={{ color: "#dce8e2", fontWeight: 950 }}>{index + 1}</span>
                        <span style={{ color: LIVE_ROOM_PLAYER_COLORS[player.colorIndex] ?? "white", fontSize: 12, fontWeight: 950 }}>{player.nickname}{player.id === liveRoom.hostPlayerId ? " · anfitrión" : ""}<small style={{ display: "block", marginTop: 2, color: "#aebfb7", fontSize: 9 }}>⚽ {player.goals} · 🎯 {player.firstTryCorrect} · {player.shotsCompleted}/{liveRoom.shotsPerPlayer} tiros</small></span>
                        <strong style={{ fontSize: 12 }}>{player.score} pts</strong>
                      </div>
                    ))}
                  </div>
                  {liveRoom.status === "waiting" && isLiveHost && (
                    <button type="button" onClick={startLiveRoom} disabled={liveBusy || liveRoom.players.length < 2} style={{ width: "100%", minHeight: 51, marginTop: 13, borderRadius: 15, border: "2px solid rgba(255,255,255,.38)", background: liveRoom.players.length < 2 ? "rgba(255,255,255,.12)" : "linear-gradient(180deg, #32bd68, #168746)", color: liveRoom.players.length < 2 ? "#aab8b1" : "white", fontSize: 15, fontWeight: 950 }}>{liveBusy ? "INICIANDO…" : liveRoom.players.length < 2 ? "ESPERANDO A UN AMIGO" : "INICIAR PARTIDO"}</button>
                  )}
                  {liveRoom.status === "waiting" && !isLiveHost && <p style={{ margin: "12px 0 0", color: "#ffe5a3", fontSize: 11, fontWeight: 900, textAlign: "center" }}>Esperando a que el anfitrión inicie el partido…</p>}
                  {liveRoom.status === "playing" && myLivePlayer && myLivePlayer.shotsCompleted < liveRoom.shotsPerPlayer && (
                    <button type="button" onClick={() => prepareRemoteTurn(liveRoom)} style={{ width: "100%", minHeight: 49, marginTop: 13, borderRadius: 14, border: "2px solid rgba(255,255,255,.35)", background: "linear-gradient(180deg, #ff7a3d, #dd451f)", color: "white", fontSize: 15, fontWeight: 950 }}>VOLVER A MIS REMATES</button>
                  )}
                  {liveRoom.status === "playing" && myLivePlayer && myLivePlayer.shotsCompleted >= liveRoom.shotsPerPlayer && <p style={{ margin: "12px 0 0", color: "#ffe5a3", fontSize: 11, fontWeight: 900, textAlign: "center" }}>Tus remates terminaron. El marcador se actualiza mientras esperas al equipo.</p>}
                  {liveRoom.status === "completed" && <p style={{ margin: "12px 0 0", color: "#72f2a1", fontSize: 12, fontWeight: 950, textAlign: "center" }}>🏆 {liveRoom.players[0]?.nickname} encabeza el marcador final</p>}
                  {liveError && <p role="alert" style={{ margin: "10px 0 0", color: "#ffc1c1", fontSize: 11, fontWeight: 900, textAlign: "center" }}>⚠ {liveError}</p>}
                  <button type="button" onClick={leaveLiveRoom} style={{ width: "100%", minHeight: 39, marginTop: 10, borderRadius: 12, border: "1px solid rgba(255,139,139,.4)", background: "rgba(255,90,90,.08)", color: "#ffc1c1", fontSize: 11, fontWeight: 900 }}>SALIR DE ESTA SALA</button>
                  <p style={{ margin: "10px 2px 0", color: "#9fb3aa", fontSize: 9, lineHeight: 1.4, textAlign: "center" }}>Sin chat, cuentas ni ubicación. La sala caduca automáticamente en dos horas.</p>
                </div>
              ) : lightningCup ? (
                <div style={{ marginTop: 16 }}>
                  <p style={{ margin: "0 0 12px", color: "#d4e3dc", fontSize: 12, lineHeight: 1.45 }}>Copa {lightningCup.seed} · {lightningCup.players.length} jugador{lightningCup.players.length === 1 ? "" : "es"} · tres remates por persona.</p>
                  <div style={{ display: "grid", gap: 7 }}>
                    {lightningStandings.map((standing) => (
                      <div key={standing.player.id} style={{ display: "grid", gridTemplateColumns: "28px 1fr auto", alignItems: "center", gap: 8, padding: "9px 10px", borderRadius: 13, background: "rgba(255,255,255,.07)", border: `1px solid ${standing.player.id === activeLightningPlayer?.id && lightningCup.status === "playing" ? standing.player.color : "rgba(255,255,255,.14)"}` }}>
                        <span style={{ fontWeight: 950 }}>{standing.rank}</span>
                        <span style={{ color: standing.player.color, fontSize: 12, fontWeight: 950 }}>{standing.player.name}</span>
                        <span style={{ fontSize: 11, fontWeight: 950 }}>{standing.score} pts</span>
                      </div>
                    ))}
                  </div>
                  <button type="button" onClick={() => setSocialOpen(false)} style={{ width: "100%", minHeight: 48, marginTop: 13, borderRadius: 14, border: "2px solid rgba(255,255,255,.35)", background: "linear-gradient(180deg, #ff7a3d, #dd451f)", color: "white", fontSize: 15, fontWeight: 950 }}>{lightningCup.status === "completed" ? "VOLVER AL PODIO" : `CONTINUAR TURNO DE ${activeLightningPlayer?.name.toUpperCase()}`}</button>
                  <button type="button" onClick={abandonLightningCup} style={{ width: "100%", minHeight: 39, marginTop: 8, borderRadius: 12, border: "1px solid rgba(255,139,139,.4)", background: "rgba(255,90,90,.08)", color: "#ffc1c1", fontSize: 11, fontWeight: 900 }}>ABANDONAR ESTA COPA</button>
                </div>
              ) : invitation ? (
                <div style={{ marginTop: 17 }}>
                  <div style={{ padding: "13px", borderRadius: 16, background: "rgba(104,199,255,.1)", border: "1px solid rgba(104,199,255,.42)", textAlign: "center" }}>
                    <span style={{ display: "block", color: "#bfe7ff", fontSize: 10, fontWeight: 950 }}>TE INVITARON AL RETO</span>
                    <strong style={{ display: "block", marginTop: 4, color: "white", fontSize: 24, letterSpacing: 3 }}>{invitation.seed}</strong>
                    <small style={{ color: "#c8d9e2" }}>Tres preguntas y tres remates · mismas condiciones para todos</small>
                  </div>
                  <label style={{ display: "grid", gap: 5, marginTop: 13, color: "#dce8e2", fontSize: 11, fontWeight: 900 }}>
                    Tu nombre o apodo
                    <input value={playerNames[0] ?? ""} onChange={(event) => updatePlayerName(0, event.target.value)} maxLength={14} autoComplete="off" style={{ minHeight: 44, borderRadius: 12, border: "1px solid rgba(255,255,255,.28)", background: "rgba(255,255,255,.08)", color: "white", padding: "0 12px", fontSize: 15, fontWeight: 900, outline: "none" }} />
                  </label>
                  <button type="button" onClick={() => startLightningCup([playerNames[0] || "Jugador"], invitation.seed)} style={{ width: "100%", minHeight: 51, marginTop: 13, borderRadius: 15, border: "2px solid rgba(255,255,255,.38)", background: "linear-gradient(180deg, #32bd68, #168746)", color: "white", fontSize: 16, fontWeight: 950, boxShadow: "0 5px 0 #0b5630" }}>ACEPTAR RETO</button>
                </div>
              ) : (
                <div style={{ marginTop: 15 }}>
                  <div style={{ padding: 13, borderRadius: 17, background: "rgba(104,199,255,.09)", border: "1px solid rgba(104,199,255,.38)" }}>
                    <span style={{ display: "block", color: "#72f2a1", fontSize: 10, fontWeight: 950, letterSpacing: 1.1 }}>SALA EN VIVO · CADA UNO DESDE SU DISPOSITIVO</span>
                    <label style={{ display: "grid", gap: 5, marginTop: 10, color: "#dce8e2", fontSize: 10, fontWeight: 900 }}>
                      Tu nombre o apodo
                      <input value={playerNames[0] ?? ""} onChange={(event) => updatePlayerName(0, event.target.value)} maxLength={14} autoComplete="off" style={{ minHeight: 42, borderRadius: 11, border: "1px solid rgba(255,255,255,.28)", background: "rgba(255,255,255,.08)", color: "white", padding: "0 11px", fontSize: 14, fontWeight: 900, outline: "none" }} />
                    </label>
                    <button type="button" onClick={createLiveRoom} disabled={liveBusy} style={{ width: "100%", minHeight: 47, marginTop: 10, borderRadius: 14, border: "2px solid rgba(255,255,255,.36)", background: "linear-gradient(180deg, #32bd68, #168746)", color: "white", fontSize: 14, fontWeight: 950 }}>{liveBusy ? "CONECTANDO…" : "CREAR SALA EN VIVO"}</button>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 7, marginTop: 9 }}>
                      <input aria-label="Código de la sala" value={liveRoomCode} onChange={(event) => setLiveRoomCode(sanitizeLiveRoomCode(event.target.value))} onKeyDown={(event) => { if (event.key === "Enter") void joinLiveRoom(); }} maxLength={6} autoComplete="off" inputMode="text" placeholder="CÓDIGO" style={{ minWidth: 0, minHeight: 43, borderRadius: 11, border: "1px solid rgba(104,199,255,.55)", background: "rgba(0,0,0,.22)", color: "white", padding: "0 11px", fontSize: 16, fontWeight: 950, letterSpacing: 2, textTransform: "uppercase", outline: "none" }} />
                      <button type="button" onClick={joinLiveRoom} disabled={liveBusy || liveRoomCode.length !== 6} style={{ minWidth: 91, minHeight: 43, borderRadius: 11, border: "1px solid rgba(104,199,255,.55)", background: liveRoomCode.length === 6 ? "rgba(104,199,255,.22)" : "rgba(255,255,255,.08)", color: liveRoomCode.length === 6 ? "#dff4ff" : "#879891", fontSize: 12, fontWeight: 950 }}>ENTRAR</button>
                    </div>
                    {liveError && <p role="alert" style={{ margin: "9px 0 0", color: "#ffc1c1", fontSize: 10, fontWeight: 900 }}>⚠ {liveError}</p>}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 8, margin: "14px 0 12px", color: "#91a69c", fontSize: 9, fontWeight: 900 }}><span style={{ height: 1, background: "rgba(255,255,255,.15)" }} /><span>O JUEGUEN EN UN SOLO DISPOSITIVO</span><span style={{ height: 1, background: "rgba(255,255,255,.15)" }} /></div>
                  <p style={{ margin: "0 0 12px", color: "#d4e3dc", fontSize: 12, lineHeight: 1.45 }}>Todos reciben la misma multiplicación en cada ronda. Ganan los goles, la precisión matemática y un pequeño bono por agilidad.</p>
                  <div role="group" aria-label="Cantidad de jugadores" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 7 }}>
                    {[2, 3, 4].map((count) => (
                      <button key={count} type="button" aria-pressed={playerNames.length === count} onClick={() => changePlayerCount(count)} style={{ minHeight: 39, borderRadius: 12, border: playerNames.length === count ? "2px solid #72f2a1" : "1px solid rgba(255,255,255,.22)", background: playerNames.length === count ? "rgba(114,242,161,.14)" : "rgba(255,255,255,.06)", color: "white", fontSize: 12, fontWeight: 950 }}>{count} JUGADORES</button>
                    ))}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: playerNames.length > 2 ? "1fr 1fr" : "1fr", gap: 7, marginTop: 10 }}>
                    {playerNames.map((name, index) => (
                      <label key={index} style={{ display: "grid", gap: 4, color: "#cfe0d8", fontSize: 9, fontWeight: 900 }}>
                        JUGADOR {index + 1}
                        <input aria-label={`Nombre del jugador ${index + 1}`} value={name} onChange={(event) => updatePlayerName(index, event.target.value)} maxLength={14} autoComplete="off" style={{ minHeight: 41, borderRadius: 11, border: `1px solid ${["#72f2a1", "#ffd166", "#68c7ff", "#c89bff"][index]}`, background: "rgba(255,255,255,.07)", color: "white", padding: "0 10px", fontSize: 13, fontWeight: 900, outline: "none" }} />
                      </label>
                    ))}
                  </div>
                  <button type="button" onClick={() => startLightningCup(playerNames)} style={{ width: "100%", minHeight: 51, marginTop: 13, borderRadius: 15, border: "2px solid rgba(255,255,255,.38)", background: "linear-gradient(180deg, #ff7a3d, #dd451f)", color: "white", fontSize: 16, fontWeight: 950, boxShadow: "0 5px 0 #972c16" }}>INICIAR COPA POR TURNOS</button>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 8, margin: "13px 0", color: "#91a69c", fontSize: 9, fontWeight: 900 }}><span style={{ height: 1, background: "rgba(255,255,255,.15)" }} /><span>RETO ASÍNCRONO POR ENLACE</span><span style={{ height: 1, background: "rgba(255,255,255,.15)" }} /></div>
                  <button type="button" onClick={createSharedChallenge} style={{ width: "100%", minHeight: 44, borderRadius: 13, border: "1px solid rgba(104,199,255,.5)", background: "rgba(104,199,255,.12)", color: "#bfe7ff", fontSize: 13, fontWeight: 950 }}>🔗 CREAR RETO POR ENLACE</button>
                  {shareUrl && <p aria-live="polite" style={{ margin: "9px 0 0", padding: 9, borderRadius: 10, background: "rgba(0,0,0,.22)", color: "#d7e8df", fontSize: 10, overflowWrap: "anywhere" }}>Enlace copiado: {shareUrl}</p>}
                  <p style={{ margin: "11px 2px 0", color: "#9fb3aa", fontSize: 9, lineHeight: 1.4, textAlign: "center" }}>Sin chat, cuentas ni apellidos. Usa solo nombres o apodos acordados con un adulto.</p>
                </div>
              )}
            </div>
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
            liveRoom ? (
              <button onClick={continueRemoteRoom} disabled={remoteSubmitState === "submitting"} style={{ minHeight: 56, borderRadius: 17, border: "3px solid rgba(255,255,255,.4)", background: remoteSubmitState === "error" ? "linear-gradient(180deg, #d65f5f, #9f3232)" : liveRoom.status === "completed" || (myLivePlayer?.shotsCompleted ?? 0) >= liveRoom.shotsPerPlayer ? "linear-gradient(180deg, #32bd68, #168746)" : "linear-gradient(180deg, #ff7a3d, #e64921)", color: "white", fontSize: 17, fontWeight: 950, boxShadow: "0 6px 0 rgba(0,0,0,.35)", pointerEvents: "auto", opacity: remoteSubmitState === "submitting" ? .74 : 1 }}>{remoteSubmitState === "submitting" ? "GUARDANDO…" : remoteSubmitState === "error" ? "REINTENTAR ENVÍO" : liveRoom.status === "completed" || (myLivePlayer?.shotsCompleted ?? 0) >= liveRoom.shotsPerPlayer ? "VER MARCADOR" : "SIGUIENTE REMATE"}</button>
            ) : lightningCup ? (
              <button onClick={lightningCup.status === "completed" ? abandonLightningCup : continueLightningCup} style={{ minHeight: 56, borderRadius: 17, border: "3px solid rgba(255,255,255,.4)", background: lightningCup.status === "completed" ? "linear-gradient(180deg, #32bd68, #168746)" : "linear-gradient(180deg, #ff7a3d, #e64921)", color: "white", fontSize: 18, fontWeight: 950, boxShadow: lightningCup.status === "completed" ? "0 6px 0 #0b5630" : "0 6px 0 #9e2d17", pointerEvents: "auto" }}>{lightningCup.status === "completed" ? "NUEVA COPA" : `SIGUE ${activeLightningPlayer?.name.toUpperCase()}`}</button>
            ) : (
              <button onClick={matchSummary.completed ? startRematch : nextChallenge} style={{ minHeight: 56, borderRadius: 17, border: "3px solid rgba(255,255,255,.4)", background: matchSummary.completed ? "linear-gradient(180deg, #32bd68, #168746)" : "linear-gradient(180deg, #ff7a3d, #e64921)", color: "white", fontSize: 19, fontWeight: 950, boxShadow: matchSummary.completed ? "0 6px 0 #0b5630" : "0 6px 0 #9e2d17", pointerEvents: "auto" }}>{matchSummary.completed ? "JUGAR REVANCHA" : "SIGUIENTE RETO"}</button>
            )
          ) : (
            <p style={{ margin: 0, textAlign: "center", color: "rgba(225,238,230,.78)", fontSize: 11, fontWeight: 800 }}>
              {phase === "ready" ? mathSolved ? "Precisión matemática lista · ahora manda tu gesto" : "Primero calcula · luego remata" : spinApplied ? "El efecto ya fue aplicado" : "Un segundo gesto lateral curva la pelota"}
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
