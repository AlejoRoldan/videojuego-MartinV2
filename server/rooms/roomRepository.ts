import type { LiveRoomStatus, LiveRoomTrack } from "../../shared/liveRoomContract";

export interface StoredRoom {
  code: string;
  seed: string;
  track: LiveRoomTrack;
  status: LiveRoomStatus;
  hostPlayerId: string | null;
  shotsPerPlayer: number;
  version: number;
  createdAt: number;
  expiresAt: number;
}

export interface StoredPlayer {
  id: string;
  roomCode: string;
  nickname: string;
  colorIndex: number;
  tokenHash: string;
  joinedAt: number;
}

export interface StoredShot {
  roomCode: string;
  playerId: string;
  roundIndex: number;
  scored: boolean;
  firstTry: boolean;
  responseTimeMs: number;
  createdAt: number;
}

export interface StoredRoomAggregate {
  room: StoredRoom;
  players: StoredPlayer[];
  shots: StoredShot[];
}

export interface RoomRepository {
  initialize(): Promise<void>;
  health(): Promise<boolean>;
  deleteExpired(now: number): Promise<number>;
  createRoom(room: StoredRoom, host: StoredPlayer): Promise<boolean>;
  getRoom(code: string): Promise<StoredRoomAggregate | null>;
  addPlayer(player: StoredPlayer, now: number): Promise<boolean>;
  updateRoomStatus(code: string, expected: LiveRoomStatus, next: LiveRoomStatus): Promise<boolean>;
  addShot(shot: StoredShot): Promise<boolean>;
  getShot(roomCode: string, playerId: string, roundIndex: number): Promise<StoredShot | null>;
  completeRoomIfReady(code: string): Promise<boolean>;
  close(): void;
}
