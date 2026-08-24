import {
  createLightningCup,
  getLightningChallenge,
  recordLightningShot,
} from "./lightningCup";
import type { MultiplicationChallengeV10, MultiplicationTrack } from "./multiplicationRound";

export const V11_LIVE_ROOM_SESSION_KEY = "tlm_v11_live_room_session_v1";
export const LIVE_ROOM_PLAYER_COLORS = ["#72f2a1", "#ffd166", "#68c7ff", "#c89bff"] as const;

export interface LiveRoomSession {
  roomCode: string;
  playerId: string;
  token: string;
}

export interface LiveRoomPlayer {
  id: string;
  nickname: string;
  colorIndex: number;
  shotsCompleted: number;
  goals: number;
  firstTryCorrect: number;
  responseTimeMs: number;
  score: number;
}

export interface LiveRoomSnapshot {
  code: string;
  seed: string;
  track: MultiplicationTrack;
  status: "waiting" | "playing" | "completed";
  hostPlayerId: string;
  shotsPerPlayer: number;
  expiresAt: number;
  players: LiveRoomPlayer[];
}

export interface LiveRoomStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

interface SessionResponse {
  session: LiveRoomSession;
  room: LiveRoomSnapshot;
}

export class LiveRoomRequestError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

export function sanitizeLiveRoomCode(value: unknown): string {
  return typeof value === "string"
    ? value.toUpperCase().replace(/[^ABCDEFGHJKMNPQRSTUVWXYZ2-9]/g, "").slice(0, 6)
    : "";
}

export function readLiveRoomInvitation(search: string): string {
  try {
    return sanitizeLiveRoomCode(new URLSearchParams(search).get("room"));
  } catch {
    return "";
  }
}

export function createLiveRoomShareUrl(baseUrl: string, code: string): string {
  const url = new URL(baseUrl);
  url.searchParams.set("v10Demo", "1");
  url.searchParams.set("room", sanitizeLiveRoomCode(code));
  url.searchParams.delete("lightning");
  url.searchParams.delete("track");
  return url.toString();
}

export function getLiveRoomChallenge(room: LiveRoomSnapshot, playerId: string): MultiplicationChallengeV10 {
  const player = room.players.find((item) => item.id === playerId);
  let cup = createLightningCup([player?.nickname ?? "Jugador"], { seed: room.seed, track: room.track });
  const completed = Math.min(room.shotsPerPlayer - 1, Math.max(0, player?.shotsCompleted ?? 0));
  for (let round = 0; round < completed; round += 1) {
    cup = recordLightningShot(cup, { scored: false, firstTry: false, responseTimeMs: 0 });
  }
  return getLightningChallenge(cup);
}

export function loadLiveRoomSession(storage: LiveRoomStorage | null): LiveRoomSession | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(V11_LIVE_ROOM_SESSION_KEY);
    if (!raw) return null;
    const candidate = JSON.parse(raw) as Partial<LiveRoomSession>;
    const roomCode = sanitizeLiveRoomCode(candidate.roomCode);
    if (roomCode.length !== 6 || typeof candidate.playerId !== "string" || typeof candidate.token !== "string") return null;
    if (!candidate.playerId || candidate.token.length < 20) return null;
    return { roomCode, playerId: candidate.playerId, token: candidate.token };
  } catch {
    return null;
  }
}

export function saveLiveRoomSession(storage: LiveRoomStorage | null, session: LiveRoomSession): boolean {
  if (!storage) return false;
  try {
    storage.setItem(V11_LIVE_ROOM_SESSION_KEY, JSON.stringify(session));
    return true;
  } catch {
    return false;
  }
}

export function clearLiveRoomSession(storage: LiveRoomStorage | null): boolean {
  if (!storage) return false;
  try {
    storage.removeItem(V11_LIVE_ROOM_SESSION_KEY);
    return true;
  } catch {
    return false;
  }
}

async function requestJson<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = await response.json().catch(() => ({})) as { error?: string; code?: string } & T;
  if (!response.ok) throw new LiveRoomRequestError(body.code ?? "request_failed", body.error ?? "No pudimos actualizar la sala.");
  return body;
}

function sessionHeaders(session: LiveRoomSession): HeadersInit {
  return {
    "Content-Type": "application/json",
    "X-Player-ID": session.playerId,
    Authorization: `Bearer ${session.token}`,
  };
}

export async function createRemoteLiveRoom(nickname: string, track: MultiplicationTrack): Promise<SessionResponse> {
  return requestJson<SessionResponse>("/api/v11/rooms", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nickname, track }),
  });
}

export async function joinRemoteLiveRoom(code: string, nickname: string): Promise<SessionResponse> {
  const roomCode = sanitizeLiveRoomCode(code);
  return requestJson<SessionResponse>(`/api/v11/rooms/${roomCode}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "join", nickname }),
  });
}

export async function fetchRemoteLiveRoom(session: LiveRoomSession): Promise<LiveRoomSnapshot> {
  return requestJson<LiveRoomSnapshot>(`/api/v11/rooms/${session.roomCode}`, {
    method: "GET",
    headers: sessionHeaders(session),
    cache: "no-store",
  });
}

export async function startRemoteLiveRoom(session: LiveRoomSession): Promise<LiveRoomSnapshot> {
  return requestJson<LiveRoomSnapshot>(`/api/v11/rooms/${session.roomCode}`, {
    method: "POST",
    headers: sessionHeaders(session),
    body: JSON.stringify({ action: "start" }),
  });
}

export async function submitRemoteLiveShot(
  session: LiveRoomSession,
  shot: { roundIndex: number; scored: boolean; firstTry: boolean; responseTimeMs: number },
): Promise<LiveRoomSnapshot> {
  return requestJson<LiveRoomSnapshot>(`/api/v11/rooms/${session.roomCode}`, {
    method: "POST",
    headers: sessionHeaders(session),
    body: JSON.stringify({ action: "shot", ...shot }),
  });
}
