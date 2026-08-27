import { createHash, randomBytes, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import {
  LIVE_ROOM_CODE_ALPHABET,
  LIVE_ROOM_CODE_LENGTH,
  LIVE_ROOM_MAX_PLAYERS,
  LIVE_ROOM_MIN_PLAYERS,
  LIVE_ROOM_SHOTS_PER_PLAYER,
  LIVE_ROOM_TTL_MS,
  type LiveRoomPlayer,
  type LiveRoomSession,
  type LiveRoomSessionResponse,
  type LiveRoomSnapshot,
  type LiveRoomTrack,
} from "../../shared/liveRoomContract";
import { RoomError } from "./roomErrors";
import type {
  RoomRepository,
  StoredPlayer,
  StoredRoomAggregate,
  StoredShot,
} from "./roomRepository";

export interface PlayerCredential {
  playerId: string;
  token: string;
}

export interface ShotInput {
  roundIndex: number;
  scored: boolean;
  firstTry: boolean;
  responseTimeMs: number;
}

function randomCode(): string {
  return Array.from({ length: LIVE_ROOM_CODE_LENGTH }, () =>
    LIVE_ROOM_CODE_ALPHABET[randomInt(LIVE_ROOM_CODE_ALPHABET.length)],
  ).join("");
}

function createToken(): string {
  return randomBytes(32).toString("base64url");
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function tokenMatches(token: string, tokenHash: string): boolean {
  const actual = Buffer.from(hashToken(token), "hex");
  const expected = Buffer.from(tokenHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function speedBonus(shot: StoredShot): number {
  return shot.firstTry ? Math.max(0, 20 - Math.floor(shot.responseTimeMs / 1_000)) : 0;
}

function sameShot(left: StoredShot, right: ShotInput): boolean {
  return left.roundIndex === right.roundIndex
    && left.scored === right.scored
    && left.firstTry === right.firstTry
    && left.responseTimeMs === right.responseTimeMs;
}

function toPlayer(player: StoredPlayer, shots: StoredShot[]): LiveRoomPlayer {
  const ownShots = shots.filter((shot) => shot.playerId === player.id);
  const goals = ownShots.filter((shot) => shot.scored).length;
  const firstTryCorrect = ownShots.filter((shot) => shot.firstTry).length;
  const responseTimeMs = ownShots.reduce((total, shot) => total + shot.responseTimeMs, 0);
  const score = goals * 100
    + firstTryCorrect * 30
    + ownShots.reduce((total, shot) => total + speedBonus(shot), 0);
  return {
    id: player.id,
    nickname: player.nickname,
    colorIndex: player.colorIndex,
    shotsCompleted: ownShots.length,
    goals,
    firstTryCorrect,
    responseTimeMs,
    score,
  };
}

function toSnapshot(aggregate: StoredRoomAggregate): LiveRoomSnapshot {
  const players = aggregate.players
    .map((player) => toPlayer(player, aggregate.shots))
    .sort((left, right) => right.score - left.score
      || right.goals - left.goals
      || right.firstTryCorrect - left.firstTryCorrect
      || left.responseTimeMs - right.responseTimeMs
      || left.id.localeCompare(right.id));
  return {
    code: aggregate.room.code,
    seed: aggregate.room.seed,
    track: aggregate.room.track,
    status: aggregate.room.status,
    hostPlayerId: aggregate.room.hostPlayerId ?? "",
    shotsPerPlayer: aggregate.room.shotsPerPlayer,
    expiresAt: aggregate.room.expiresAt,
    players,
  };
}

export class RoomService {
  constructor(
    private readonly repository: RoomRepository,
    private readonly now: () => number = Date.now,
  ) {}

  async initialize(): Promise<void> {
    await this.repository.initialize();
    await this.repository.deleteExpired(this.now());
  }

  async health(): Promise<boolean> {
    return this.repository.health();
  }

  close(): void {
    this.repository.close();
  }

  async createRoom(nickname: string, track: LiveRoomTrack): Promise<LiveRoomSessionResponse> {
    const createdAt = this.now();
    await this.repository.deleteExpired(createdAt);
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const code = randomCode();
      const playerId = randomUUID();
      const token = createToken();
      const host: StoredPlayer = {
        id: playerId,
        roomCode: code,
        nickname,
        colorIndex: 0,
        tokenHash: hashToken(token),
        joinedAt: createdAt,
      };
      const created = await this.repository.createRoom({
        code,
        seed: randomCode(),
        track,
        status: "waiting",
        hostPlayerId: playerId,
        shotsPerPlayer: LIVE_ROOM_SHOTS_PER_PLAYER,
        version: 1,
        createdAt,
        expiresAt: createdAt + LIVE_ROOM_TTL_MS,
      }, host);
      if (!created) continue;
      const aggregate = await this.requireRoom(code);
      return {
        session: { roomCode: code, playerId, token },
        room: toSnapshot(aggregate),
      };
    }
    throw new RoomError("internal_error");
  }

  async joinRoom(code: string, nickname: string): Promise<LiveRoomSessionResponse> {
    await this.repository.deleteExpired(this.now());
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const aggregate = await this.requireRoom(code);
      if (aggregate.room.status !== "waiting") throw new RoomError("room_already_started");
      if (aggregate.players.length >= LIVE_ROOM_MAX_PLAYERS) throw new RoomError("room_full");
      const occupied = new Set(aggregate.players.map((player) => player.colorIndex));
      const colorIndex = Array.from({ length: LIVE_ROOM_MAX_PLAYERS }, (_, index) => index)
        .find((index) => !occupied.has(index));
      if (colorIndex === undefined) throw new RoomError("room_full");
      const playerId = randomUUID();
      const token = createToken();
      const joinedAt = this.now();
      const inserted = await this.repository.addPlayer({
        id: playerId,
        roomCode: code,
        nickname,
        colorIndex,
        tokenHash: hashToken(token),
        joinedAt,
      }, joinedAt);
      if (!inserted) continue;
      const updated = await this.requireRoom(code);
      return {
        session: { roomCode: code, playerId, token },
        room: toSnapshot(updated),
      };
    }
    const latest = await this.requireRoom(code);
    if (latest.players.length >= LIVE_ROOM_MAX_PLAYERS) throw new RoomError("room_full");
    throw new RoomError("internal_error");
  }

  async getRoom(code: string, credential: PlayerCredential): Promise<LiveRoomSnapshot> {
    await this.repository.deleteExpired(this.now());
    const aggregate = await this.requireRoom(code);
    this.authenticate(aggregate, credential);
    return toSnapshot(aggregate);
  }

  async startRoom(code: string, credential: PlayerCredential): Promise<LiveRoomSnapshot> {
    await this.repository.deleteExpired(this.now());
    const aggregate = await this.requireRoom(code);
    const player = this.authenticate(aggregate, credential);
    if (player.id !== aggregate.room.hostPlayerId) throw new RoomError("host_only");
    if (aggregate.room.status === "completed") throw new RoomError("room_completed");
    if (aggregate.room.status === "playing") return toSnapshot(aggregate);
    if (aggregate.players.length < LIVE_ROOM_MIN_PLAYERS) throw new RoomError("not_enough_players");
    await this.repository.updateRoomStatus(code, "waiting", "playing");
    return toSnapshot(await this.requireRoom(code));
  }

  async submitShot(code: string, credential: PlayerCredential, input: ShotInput): Promise<LiveRoomSnapshot> {
    await this.repository.deleteExpired(this.now());
    const aggregate = await this.requireRoom(code);
    const player = this.authenticate(aggregate, credential);
    if (aggregate.room.status === "completed") throw new RoomError("room_completed");
    if (aggregate.room.status !== "playing") {
      throw new RoomError("invalid_payload", "El partido todavía no comenzó.");
    }
    const ownShots = aggregate.shots.filter((shot) => shot.playerId === player.id);
    if (input.roundIndex > ownShots.length) throw new RoomError("round_out_of_order");
    if (input.roundIndex < ownShots.length) {
      const existing = await this.repository.getShot(code, player.id, input.roundIndex);
      if (existing && sameShot(existing, input)) return toSnapshot(aggregate);
      throw new RoomError("round_conflict");
    }
    const shot: StoredShot = {
      roomCode: code,
      playerId: player.id,
      roundIndex: input.roundIndex,
      scored: input.scored,
      firstTry: input.firstTry,
      responseTimeMs: input.responseTimeMs,
      createdAt: this.now(),
    };
    const inserted = await this.repository.addShot(shot);
    if (!inserted) {
      const existing = await this.repository.getShot(code, player.id, input.roundIndex);
      if (!existing || !sameShot(existing, input)) throw new RoomError("round_conflict");
    }
    await this.repository.completeRoomIfReady(code);
    return toSnapshot(await this.requireRoom(code));
  }

  private async requireRoom(code: string): Promise<StoredRoomAggregate> {
    const aggregate = await this.repository.getRoom(code);
    if (!aggregate || aggregate.room.expiresAt <= this.now()) throw new RoomError("room_not_found");
    return aggregate;
  }

  private authenticate(aggregate: StoredRoomAggregate, credential: PlayerCredential): StoredPlayer {
    const player = aggregate.players.find((candidate) => candidate.id === credential.playerId);
    if (!player || !credential.token || !tokenMatches(credential.token, player.tokenHash)) {
      throw new RoomError("session_invalid");
    }
    return player;
  }
}

export function asLiveRoomSession(credential: PlayerCredential, roomCode: string): LiveRoomSession {
  return { roomCode, playerId: credential.playerId, token: credential.token };
}
