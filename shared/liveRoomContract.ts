export const LIVE_ROOM_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const LIVE_ROOM_CODE_LENGTH = 6;
export const LIVE_ROOM_MIN_PLAYERS = 2;
export const LIVE_ROOM_MAX_PLAYERS = 4;
export const LIVE_ROOM_SHOTS_PER_PLAYER = 3;
export const LIVE_ROOM_TTL_MS = 2 * 60 * 60 * 1_000;

export type LiveRoomTrack = "tables-2-5" | "tables-6-9";
export type LiveRoomStatus = "waiting" | "playing" | "completed";

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
  track: LiveRoomTrack;
  status: LiveRoomStatus;
  hostPlayerId: string;
  shotsPerPlayer: number;
  expiresAt: number;
  players: LiveRoomPlayer[];
}

export interface LiveRoomSessionResponse {
  session: LiveRoomSession;
  room: LiveRoomSnapshot;
}

export type LiveRoomActionBody =
  | { action: "join"; nickname: string }
  | { action: "start" }
  | {
      action: "shot";
      roundIndex: number;
      scored: boolean;
      firstTry: boolean;
      responseTimeMs: number;
    };

export const LIVE_ROOM_ERROR_CODES = [
  "invalid_payload",
  "session_invalid",
  "host_only",
  "room_not_found",
  "room_full",
  "room_already_started",
  "not_enough_players",
  "round_out_of_order",
  "round_conflict",
  "room_completed",
  "rate_limited",
  "internal_error",
] as const;

export type LiveRoomErrorCode = (typeof LIVE_ROOM_ERROR_CODES)[number];

export interface LiveRoomErrorResponse {
  code: LiveRoomErrorCode;
  error: string;
}
