import { createClient, type Client, type InValue, type Row } from "@libsql/client";
import type { LiveRoomStatus, LiveRoomTrack } from "../../shared/liveRoomContract";
import type {
  RoomRepository,
  StoredPlayer,
  StoredRoom,
  StoredRoomAggregate,
  StoredShot,
} from "../rooms/roomRepository";

const SCHEMA = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS live_rooms (
  code TEXT PRIMARY KEY,
  seed TEXT NOT NULL,
  track TEXT NOT NULL CHECK (track IN ('tables-2-5', 'tables-6-9')),
  status TEXT NOT NULL CHECK (status IN ('waiting', 'playing', 'completed')),
  host_player_id TEXT NOT NULL,
  shots_per_player INTEGER NOT NULL DEFAULT 3 CHECK (shots_per_player = 3),
  version INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS live_players (
  id TEXT PRIMARY KEY,
  room_code TEXT NOT NULL REFERENCES live_rooms(code) ON DELETE CASCADE,
  nickname TEXT NOT NULL,
  color_index INTEGER NOT NULL CHECK (color_index BETWEEN 0 AND 3),
  token_hash TEXT NOT NULL,
  joined_at INTEGER NOT NULL,
  UNIQUE (room_code, color_index)
) STRICT;

CREATE TABLE IF NOT EXISTS live_shots (
  room_code TEXT NOT NULL REFERENCES live_rooms(code) ON DELETE CASCADE,
  player_id TEXT NOT NULL REFERENCES live_players(id) ON DELETE CASCADE,
  round_index INTEGER NOT NULL CHECK (round_index BETWEEN 0 AND 2),
  scored INTEGER NOT NULL CHECK (scored IN (0, 1)),
  first_try INTEGER NOT NULL CHECK (first_try IN (0, 1)),
  response_time_ms INTEGER NOT NULL CHECK (response_time_ms BETWEEN 0 AND 120000),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (room_code, player_id, round_index)
) STRICT;

CREATE INDEX IF NOT EXISTS live_rooms_expiry_idx ON live_rooms(expires_at);
CREATE INDEX IF NOT EXISTS live_players_room_idx ON live_players(room_code);
CREATE INDEX IF NOT EXISTS live_shots_room_idx ON live_shots(room_code);
`;

function statement(sql: string, args: InValue[] = []) {
  return { sql, args };
}

function text(row: Row, key: string): string {
  const value = row[key];
  if (typeof value !== "string") throw new Error(`Expected text column ${key}`);
  return value;
}

function integer(row: Row, key: string): number {
  const value = row[key];
  if (typeof value === "bigint") return Number(value);
  if (typeof value !== "number") throw new Error(`Expected numeric column ${key}`);
  return value;
}

function mapRoom(row: Row): StoredRoom {
  return {
    code: text(row, "code"),
    seed: text(row, "seed"),
    track: text(row, "track") as LiveRoomTrack,
    status: text(row, "status") as LiveRoomStatus,
    hostPlayerId: text(row, "host_player_id"),
    shotsPerPlayer: integer(row, "shots_per_player"),
    version: integer(row, "version"),
    createdAt: integer(row, "created_at"),
    expiresAt: integer(row, "expires_at"),
  };
}

function mapPlayer(row: Row): StoredPlayer {
  return {
    id: text(row, "id"),
    roomCode: text(row, "room_code"),
    nickname: text(row, "nickname"),
    colorIndex: integer(row, "color_index"),
    tokenHash: text(row, "token_hash"),
    joinedAt: integer(row, "joined_at"),
  };
}

function mapShot(row: Row): StoredShot {
  return {
    roomCode: text(row, "room_code"),
    playerId: text(row, "player_id"),
    roundIndex: integer(row, "round_index"),
    scored: integer(row, "scored") === 1,
    firstTry: integer(row, "first_try") === 1,
    responseTimeMs: integer(row, "response_time_ms"),
    createdAt: integer(row, "created_at"),
  };
}

function isRoomCodeConflict(error: unknown): boolean {
  return error instanceof Error && /UNIQUE constraint failed: live_rooms\.code/i.test(error.message);
}

export class LibsqlRoomRepository implements RoomRepository {
  private readonly client: Client;

  constructor(options: { url: string; authToken?: string }) {
    this.client = createClient(options);
  }

  async initialize(): Promise<void> {
    await this.client.executeMultiple(SCHEMA);
  }

  async health(): Promise<boolean> {
    const result = await this.client.execute("SELECT 1 AS ok");
    return integer(result.rows[0], "ok") === 1;
  }

  async deleteExpired(now: number): Promise<number> {
    const result = await this.client.execute(statement("DELETE FROM live_rooms WHERE expires_at <= ?", [now]));
    return result.rowsAffected;
  }

  async createRoom(room: StoredRoom, host: StoredPlayer): Promise<boolean> {
    try {
      await this.client.batch([
        statement(
          `INSERT INTO live_rooms
            (code, seed, track, status, host_player_id, shots_per_player, version, created_at, expires_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            room.code,
            room.seed,
            room.track,
            room.status,
            room.hostPlayerId ?? host.id,
            room.shotsPerPlayer,
            room.version,
            room.createdAt,
            room.expiresAt,
          ],
        ),
        statement(
          `INSERT INTO live_players
            (id, room_code, nickname, color_index, token_hash, joined_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [host.id, host.roomCode, host.nickname, host.colorIndex, host.tokenHash, host.joinedAt],
        ),
      ], "write");
      return true;
    } catch (error) {
      if (isRoomCodeConflict(error)) return false;
      throw error;
    }
  }

  async getRoom(code: string): Promise<StoredRoomAggregate | null> {
    const [roomResult, playersResult, shotsResult] = await this.client.batch([
      statement("SELECT * FROM live_rooms WHERE code = ? LIMIT 1", [code]),
      statement("SELECT * FROM live_players WHERE room_code = ? ORDER BY joined_at, id", [code]),
      statement("SELECT * FROM live_shots WHERE room_code = ? ORDER BY created_at, player_id, round_index", [code]),
    ], "read");
    const roomRow = roomResult.rows[0];
    if (!roomRow) return null;
    return {
      room: mapRoom(roomRow),
      players: playersResult.rows.map(mapPlayer),
      shots: shotsResult.rows.map(mapShot),
    };
  }

  async addPlayer(player: StoredPlayer, now: number): Promise<boolean> {
    const result = await this.client.execute(statement(
      `INSERT OR IGNORE INTO live_players
        (id, room_code, nickname, color_index, token_hash, joined_at)
       SELECT ?, ?, ?, ?, ?, ?
       WHERE EXISTS (
         SELECT 1
         FROM live_rooms AS room
         WHERE room.code = ?
           AND room.status = 'waiting'
           AND room.expires_at > ?
           AND (SELECT COUNT(*) FROM live_players WHERE room_code = room.code) < 4
       )`,
      [
        player.id,
        player.roomCode,
        player.nickname,
        player.colorIndex,
        player.tokenHash,
        player.joinedAt,
        player.roomCode,
        now,
      ],
    ));
    return result.rowsAffected === 1;
  }

  async updateRoomStatus(code: string, expected: LiveRoomStatus, next: LiveRoomStatus): Promise<boolean> {
    const result = await this.client.execute(statement(
      `UPDATE live_rooms
       SET status = ?, version = version + 1
       WHERE code = ? AND status = ?`,
      [next, code, expected],
    ));
    return result.rowsAffected === 1;
  }

  async addShot(shot: StoredShot): Promise<boolean> {
    const result = await this.client.execute(statement(
      `INSERT OR IGNORE INTO live_shots
        (room_code, player_id, round_index, scored, first_try, response_time_ms, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        shot.roomCode,
        shot.playerId,
        shot.roundIndex,
        shot.scored ? 1 : 0,
        shot.firstTry ? 1 : 0,
        shot.responseTimeMs,
        shot.createdAt,
      ],
    ));
    return result.rowsAffected === 1;
  }

  async getShot(roomCode: string, playerId: string, roundIndex: number): Promise<StoredShot | null> {
    const result = await this.client.execute(statement(
      `SELECT * FROM live_shots
       WHERE room_code = ? AND player_id = ? AND round_index = ?
       LIMIT 1`,
      [roomCode, playerId, roundIndex],
    ));
    return result.rows[0] ? mapShot(result.rows[0]) : null;
  }

  async completeRoomIfReady(code: string): Promise<boolean> {
    const result = await this.client.execute(statement(
      `UPDATE live_rooms
       SET status = 'completed', version = version + 1
       WHERE code = ?
         AND status = 'playing'
         AND (SELECT COUNT(*) FROM live_players WHERE room_code = ?) >= 2
         AND NOT EXISTS (
           SELECT 1
           FROM live_players AS player
           WHERE player.room_code = ?
             AND (
               SELECT COUNT(*)
               FROM live_shots AS shot
               WHERE shot.room_code = player.room_code AND shot.player_id = player.id
             ) < live_rooms.shots_per_player
         )`,
      [code, code, code],
    ));
    return result.rowsAffected === 1;
  }

  close(): void {
    this.client.close();
  }
}
