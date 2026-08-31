import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";

export type LiveRoomTrack = "tables-2-5" | "tables-6-9";
export type LiveRoomStatus = "waiting" | "playing" | "completed";

export interface LiveRoomSession {
  roomCode: string;
  playerId: string;
  token: string;
}

export interface LiveRoomPlayerSnapshot {
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
  track: LiveRoomTrack;
  status: LiveRoomStatus;
  hostPlayerId: string;
  shotsPerPlayer: number;
  expiresAt: number;
  players: LiveRoomPlayerSnapshot[];
}

interface StoredPlayer extends LiveRoomPlayerSnapshot {
  token: string;
}

interface StoredRoom extends Omit<LiveRoomSnapshot, "players"> {
  players: StoredPlayer[];
}

export interface LiveRoomCredentials {
  playerId: string;
  token: string;
}

export interface LiveRoomStoreOptions {
  now?: () => number;
  ttlMs?: number;
  maxRooms?: number;
}

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const ROOM_CODE_LENGTH = 6;
const ROOM_SHOTS_PER_PLAYER = 3;
const MAX_PLAYERS = 4;
const DEFAULT_TTL_MS = 2 * 60 * 60 * 1000;
const DEFAULT_MAX_ROOMS = 1_000;

export class LiveRoomStoreError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

function createCode(): string {
  const bytes = randomBytes(ROOM_CODE_LENGTH);
  return Array.from(bytes, (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join("");
}

function sanitizeCode(value: unknown): string {
  return typeof value === "string"
    ? value.toUpperCase().replace(/[^ABCDEFGHJKMNPQRSTUVWXYZ2-9]/g, "").slice(0, ROOM_CODE_LENGTH)
    : "";
}

function sanitizeNickname(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u001F\u007F]/g, "").replace(/\s+/g, " ").trim().slice(0, 14);
}

function sanitizeTrack(value: unknown): LiveRoomTrack | null {
  return value === "tables-2-5" || value === "tables-6-9" ? value : null;
}

function safeResponseTime(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  return Math.min(120_000, Math.trunc(value));
}

function tokenMatches(expected: string, supplied: string): boolean {
  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(supplied);
  return expectedBytes.length === suppliedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes);
}

function speedBonus(responseTimeMs: number, firstTry: boolean): number {
  if (!firstTry) return 0;
  return Math.max(0, 20 - Math.floor(responseTimeMs / 1_000));
}

function publicSnapshot(room: StoredRoom): LiveRoomSnapshot {
  return {
    code: room.code,
    seed: room.seed,
    track: room.track,
    status: room.status,
    hostPlayerId: room.hostPlayerId,
    shotsPerPlayer: room.shotsPerPlayer,
    expiresAt: room.expiresAt,
    players: room.players.map(({ token: _token, ...player }) => ({ ...player })),
  };
}

function createPlayer(nickname: string, colorIndex: number): StoredPlayer {
  return {
    id: `player-${randomUUID()}`,
    token: randomBytes(32).toString("base64url"),
    nickname,
    colorIndex,
    shotsCompleted: 0,
    goals: 0,
    firstTryCorrect: 0,
    responseTimeMs: 0,
    score: 0,
  };
}

export class LiveRoomStore {
  private readonly rooms = new Map<string, StoredRoom>();
  private readonly now: () => number;
  private readonly ttlMs: number;
  private readonly maxRooms: number;

  constructor(options: LiveRoomStoreOptions = {}) {
    this.now = options.now ?? Date.now;
    this.ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
    this.maxRooms = options.maxRooms ?? DEFAULT_MAX_ROOMS;
  }

  createRoom(nicknameValue: unknown, trackValue: unknown): { session: LiveRoomSession; room: LiveRoomSnapshot } {
    this.removeExpiredRooms();
    if (this.rooms.size >= this.maxRooms) {
      throw new LiveRoomStoreError(503, "room_capacity", "Hay demasiadas salas activas. Intenta de nuevo en unos minutos.");
    }
    const nickname = sanitizeNickname(nicknameValue);
    const track = sanitizeTrack(trackValue);
    if (!nickname) throw new LiveRoomStoreError(400, "invalid_nickname", "Escribe un nombre corto para jugar.");
    if (!track) throw new LiveRoomStoreError(400, "invalid_track", "La pista matemática no es válida.");

    let code = createCode();
    for (let attempt = 0; this.rooms.has(code) && attempt < 20; attempt += 1) code = createCode();
    if (this.rooms.has(code)) throw new LiveRoomStoreError(503, "code_unavailable", "No pudimos crear un código de sala. Intenta de nuevo.");

    const host = createPlayer(nickname, 0);
    const room: StoredRoom = {
      code,
      seed: createCode(),
      track,
      status: "waiting",
      hostPlayerId: host.id,
      shotsPerPlayer: ROOM_SHOTS_PER_PLAYER,
      expiresAt: this.now() + this.ttlMs,
      players: [host],
    };
    this.rooms.set(code, room);
    return {
      session: { roomCode: code, playerId: host.id, token: host.token },
      room: publicSnapshot(room),
    };
  }

  joinRoom(codeValue: unknown, nicknameValue: unknown): { session: LiveRoomSession; room: LiveRoomSnapshot } {
    const room = this.requireRoom(codeValue);
    const nickname = sanitizeNickname(nicknameValue);
    if (!nickname) throw new LiveRoomStoreError(400, "invalid_nickname", "Escribe un nombre corto para jugar.");
    if (room.status !== "waiting") throw new LiveRoomStoreError(409, "room_started", "La sala ya comenzó.");
    if (room.players.length >= MAX_PLAYERS) throw new LiveRoomStoreError(409, "room_full", "La sala ya tiene cuatro jugadores.");
    if (room.players.some((player) => player.nickname.localeCompare(nickname, undefined, { sensitivity: "base" }) === 0)) {
      throw new LiveRoomStoreError(409, "nickname_taken", "Ese nombre ya está en la sala.");
    }
    const player = createPlayer(nickname, room.players.length);
    room.players.push(player);
    return {
      session: { roomCode: room.code, playerId: player.id, token: player.token },
      room: publicSnapshot(room),
    };
  }

  getRoom(codeValue: unknown, credentials: LiveRoomCredentials): LiveRoomSnapshot {
    const room = this.requireAuthorizedRoom(codeValue, credentials);
    return publicSnapshot(room);
  }

  startRoom(codeValue: unknown, credentials: LiveRoomCredentials): LiveRoomSnapshot {
    const room = this.requireAuthorizedRoom(codeValue, credentials);
    if (credentials.playerId !== room.hostPlayerId) {
      throw new LiveRoomStoreError(403, "host_only", "Solo el anfitrión puede iniciar la sala.");
    }
    if (room.status !== "waiting") throw new LiveRoomStoreError(409, "room_started", "La sala ya comenzó.");
    if (room.players.length < 2) throw new LiveRoomStoreError(409, "players_required", "Invita al menos a otro jugador antes de comenzar.");
    room.status = "playing";
    return publicSnapshot(room);
  }

  submitShot(
    codeValue: unknown,
    credentials: LiveRoomCredentials,
    shot: { roundIndex?: unknown; scored?: unknown; firstTry?: unknown; responseTimeMs?: unknown },
  ): LiveRoomSnapshot {
    const room = this.requireAuthorizedRoom(codeValue, credentials);
    if (room.status !== "playing") throw new LiveRoomStoreError(409, "room_not_playing", "La sala no está recibiendo remates.");
    const player = room.players.find((item) => item.id === credentials.playerId)!;
    const roundIndex = typeof shot.roundIndex === "number" && Number.isInteger(shot.roundIndex) ? shot.roundIndex : -1;
    const responseTimeMs = safeResponseTime(shot.responseTimeMs);
    if (roundIndex !== player.shotsCompleted || roundIndex < 0 || roundIndex >= room.shotsPerPlayer) {
      throw new LiveRoomStoreError(409, "round_mismatch", "Ese remate ya fue registrado o llegó fuera de orden.");
    }
    if (typeof shot.scored !== "boolean" || typeof shot.firstTry !== "boolean" || responseTimeMs === null) {
      throw new LiveRoomStoreError(400, "invalid_shot", "El resultado del remate no es válido.");
    }

    player.shotsCompleted += 1;
    player.goals += Number(shot.scored);
    player.firstTryCorrect += Number(shot.firstTry);
    player.responseTimeMs += responseTimeMs;
    player.score += Number(shot.scored) * 100 + Number(shot.firstTry) * 30 + speedBonus(responseTimeMs, shot.firstTry);
    if (room.players.every((item) => item.shotsCompleted >= room.shotsPerPlayer)) room.status = "completed";
    return publicSnapshot(room);
  }

  private requireRoom(codeValue: unknown): StoredRoom {
    const code = sanitizeCode(codeValue);
    if (code.length !== ROOM_CODE_LENGTH) throw new LiveRoomStoreError(404, "room_not_found", "No encontramos esa sala.");
    const room = this.rooms.get(code);
    if (!room || room.expiresAt <= this.now()) {
      if (room) this.rooms.delete(code);
      throw new LiveRoomStoreError(404, "room_not_found", "No encontramos esa sala o ya venció.");
    }
    return room;
  }

  private requireAuthorizedRoom(codeValue: unknown, credentials: LiveRoomCredentials): StoredRoom {
    const room = this.requireRoom(codeValue);
    const player = room.players.find((item) => item.id === credentials.playerId);
    if (!player || !tokenMatches(player.token, credentials.token)) {
      throw new LiveRoomStoreError(401, "invalid_session", "La sesión de esta sala ya no es válida.");
    }
    return room;
  }

  private removeExpiredRooms(): void {
    const now = this.now();
    this.rooms.forEach((room, code) => {
      if (room.expiresAt <= now) this.rooms.delete(code);
    });
  }
}
