import {
  createMultiplicationChallenge,
  type MultiplicationChallengeV10,
  type MultiplicationTrack,
} from "./multiplicationRound";

export const V10_LIGHTNING_CUP_KEY = "tlm_v10_lightning_cup_v1";
export const LIGHTNING_SHOTS_PER_PLAYER = 3;
export const LIGHTNING_MIN_PLAYERS = 1;
export const LIGHTNING_MAX_PLAYERS = 4;

export interface LightningCupPlayer {
  id: string;
  name: string;
  color: string;
}

export interface LightningCupShot {
  playerId: string;
  roundIndex: number;
  scored: boolean;
  firstTry: boolean;
  responseTimeMs: number;
}

export interface LightningCupV1 {
  version: 1;
  seed: string;
  track: MultiplicationTrack;
  status: "playing" | "completed";
  players: LightningCupPlayer[];
  activePlayerIndex: number;
  roundIndex: number;
  shots: LightningCupShot[];
}

export interface LightningCupStanding {
  player: LightningCupPlayer;
  rank: number;
  goals: number;
  firstTryCorrect: number;
  responseTimeMs: number;
  score: number;
}

export interface LightningInvitation {
  seed: string;
  track: MultiplicationTrack;
}

export interface LightningCupStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

const PLAYER_COLORS = ["#72f2a1", "#ffd166", "#68c7ff", "#c89bff"];
const SEED_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function sanitizeSeed(value: unknown): string {
  if (typeof value !== "string") return "MARTIN";
  const normalized = value.toUpperCase().replace(/[^A-Z2-9]/g, "").slice(0, 8);
  return normalized.length >= 4 ? normalized : "MARTIN";
}

function sanitizeTrack(value: unknown): MultiplicationTrack {
  return value === "tables-6-9" ? "tables-6-9" : "tables-2-5";
}

function sanitizeName(value: unknown, index: number): string {
  if (typeof value !== "string") return `Jugador ${index + 1}`;
  const normalized = value.replace(/\s+/g, " ").trim().slice(0, 14);
  return normalized || `Jugador ${index + 1}`;
}

function safeInteger(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.trunc(value))
    : fallback;
}

function normalizeShot(value: unknown, players: LightningCupPlayer[]): LightningCupShot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  const playerId = typeof candidate.playerId === "string" ? candidate.playerId : "";
  if (!players.some((player) => player.id === playerId)) return null;
  if (typeof candidate.scored !== "boolean" || typeof candidate.firstTry !== "boolean") return null;
  return {
    playerId,
    roundIndex: Math.min(LIGHTNING_SHOTS_PER_PLAYER - 1, safeInteger(candidate.roundIndex)),
    scored: candidate.scored,
    firstTry: candidate.firstTry,
    responseTimeMs: Math.min(120_000, safeInteger(candidate.responseTimeMs)),
  };
}

function seedHash(seed: string): number {
  let hash = 2166136261;
  for (const character of seed) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function speedBonus(responseTimeMs: number, firstTry: boolean): number {
  if (!firstTry) return 0;
  return Math.max(0, 20 - Math.floor(Math.max(0, responseTimeMs) / 1000));
}

export function createLightningSeed(random: () => number = Math.random): string {
  return Array.from({ length: 6 }, () => {
    const rawSample = random();
    const sample = Number.isFinite(rawSample) ? rawSample : 0;
    const index = Math.min(SEED_ALPHABET.length - 1, Math.max(0, Math.floor(sample * SEED_ALPHABET.length)));
    return SEED_ALPHABET[index];
  }).join("");
}

export function createLightningCup(
  names: readonly string[],
  options: { seed?: string; track?: MultiplicationTrack } = {},
): LightningCupV1 {
  const selectedNames = names.slice(0, LIGHTNING_MAX_PLAYERS);
  const safeNames = selectedNames.length >= LIGHTNING_MIN_PLAYERS ? selectedNames : ["Jugador 1"];
  return {
    version: 1,
    seed: sanitizeSeed(options.seed ?? createLightningSeed()),
    track: sanitizeTrack(options.track),
    status: "playing",
    players: safeNames.map((name, index) => ({
      id: `p${index + 1}`,
      name: sanitizeName(name, index),
      color: PLAYER_COLORS[index],
    })),
    activePlayerIndex: 0,
    roundIndex: 0,
    shots: [],
  };
}

export function normalizeLightningCup(value: unknown): LightningCupV1 | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  if (!Array.isArray(candidate.players)) return null;
  const players = candidate.players.slice(0, LIGHTNING_MAX_PLAYERS).map((value, index) => {
    const player = value && typeof value === "object" && !Array.isArray(value)
      ? value as Record<string, unknown>
      : {};
    return {
      id: `p${index + 1}`,
      name: sanitizeName(player.name, index),
      color: PLAYER_COLORS[index],
    };
  });
  if (players.length < LIGHTNING_MIN_PLAYERS) return null;
  const maximumShots = players.length * LIGHTNING_SHOTS_PER_PLAYER;
  const shots = Array.isArray(candidate.shots)
    ? candidate.shots.map((shot) => normalizeShot(shot, players)).filter((shot): shot is LightningCupShot => shot !== null).slice(0, maximumShots)
    : [];
  const completed = shots.length >= maximumShots;
  const calculatedIndex = completed ? Math.max(0, players.length - 1) : shots.length % players.length;
  const calculatedRound = completed
    ? LIGHTNING_SHOTS_PER_PLAYER - 1
    : Math.floor(shots.length / players.length);
  return {
    version: 1,
    seed: sanitizeSeed(candidate.seed),
    track: sanitizeTrack(candidate.track),
    status: completed ? "completed" : "playing",
    players,
    activePlayerIndex: calculatedIndex,
    roundIndex: calculatedRound,
    shots,
  };
}

export function getActiveLightningPlayer(cup: LightningCupV1): LightningCupPlayer {
  const normalized = normalizeLightningCup(cup) ?? createLightningCup(["Jugador 1"], { seed: "MARTIN" });
  return normalized.players[Math.min(normalized.activePlayerIndex, normalized.players.length - 1)];
}

export function getLightningChallenge(cup: LightningCupV1): MultiplicationChallengeV10 {
  const normalized = normalizeLightningCup(cup) ?? createLightningCup(["Jugador 1"], { seed: "MARTIN" });
  const sequenceIndex = (seedHash(normalized.seed) + normalized.roundIndex) % 10_000;
  return createMultiplicationChallenge(sequenceIndex, normalized.track);
}

export function recordLightningShot(
  current: LightningCupV1,
  result: Pick<LightningCupShot, "scored" | "firstTry" | "responseTimeMs">,
): LightningCupV1 {
  const cup = normalizeLightningCup(current);
  if (!cup || cup.status === "completed") return cup ?? createLightningCup(["Jugador 1"], { seed: "MARTIN" });
  const activePlayer = getActiveLightningPlayer(cup);
  const shots = [...cup.shots, {
    playerId: activePlayer.id,
    roundIndex: cup.roundIndex,
    scored: Boolean(result.scored),
    firstTry: Boolean(result.firstTry),
    responseTimeMs: Math.min(120_000, safeInteger(result.responseTimeMs)),
  }];
  return normalizeLightningCup({ ...cup, shots }) ?? cup;
}

export function getLightningStandings(cup: LightningCupV1): LightningCupStanding[] {
  const normalized = normalizeLightningCup(cup);
  if (!normalized) return [];
  const standings = normalized.players.map((player) => {
    const shots = normalized.shots.filter((shot) => shot.playerId === player.id);
    const goals = shots.filter((shot) => shot.scored).length;
    const firstTryCorrect = shots.filter((shot) => shot.firstTry).length;
    const responseTimeMs = shots.reduce((total, shot) => total + shot.responseTimeMs, 0);
    const score = goals * 100
      + firstTryCorrect * 30
      + shots.reduce((total, shot) => total + speedBonus(shot.responseTimeMs, shot.firstTry), 0);
    return { player, rank: 0, goals, firstTryCorrect, responseTimeMs, score };
  });
  standings.sort((left, right) => right.score - left.score
    || right.goals - left.goals
    || right.firstTryCorrect - left.firstTryCorrect
    || left.responseTimeMs - right.responseTimeMs
    || left.player.id.localeCompare(right.player.id));
  return standings.map((standing, index) => ({ ...standing, rank: index + 1 }));
}

export function createLightningShareUrl(baseUrl: string, invitation: LightningInvitation): string {
  const url = new URL(baseUrl);
  url.searchParams.set("v10Demo", "1");
  url.searchParams.set("lightning", sanitizeSeed(invitation.seed));
  url.searchParams.set("track", sanitizeTrack(invitation.track));
  return url.toString();
}

export function readLightningInvitation(search: string): LightningInvitation | null {
  try {
    const params = new URLSearchParams(search);
    const rawSeed = params.get("lightning");
    if (!rawSeed || !/^[A-Z2-9]{4,8}$/i.test(rawSeed)) return null;
    return { seed: sanitizeSeed(rawSeed), track: sanitizeTrack(params.get("track")) };
  } catch {
    return null;
  }
}

export function loadLightningCup(storage: LightningCupStorage | null): LightningCupV1 | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(V10_LIGHTNING_CUP_KEY);
    return raw ? normalizeLightningCup(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function saveLightningCup(storage: LightningCupStorage | null, cup: LightningCupV1): boolean {
  if (!storage) return false;
  const normalized = normalizeLightningCup(cup);
  if (!normalized) return false;
  try {
    storage.setItem(V10_LIGHTNING_CUP_KEY, JSON.stringify(normalized));
    return true;
  } catch {
    return false;
  }
}

export function clearLightningCup(storage: LightningCupStorage | null): boolean {
  if (!storage?.removeItem) return false;
  try {
    storage.removeItem(V10_LIGHTNING_CUP_KEY);
    return true;
  } catch {
    return false;
  }
}
