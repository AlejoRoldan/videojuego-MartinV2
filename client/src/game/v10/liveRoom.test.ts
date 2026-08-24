import { afterEach, describe, expect, it, vi } from "vitest";
import {
  V11_LIVE_ROOM_SESSION_KEY,
  clearLiveRoomSession,
  createLiveRoomShareUrl,
  createRemoteLiveRoom,
  getLiveRoomChallenge,
  joinRemoteLiveRoom,
  loadLiveRoomSession,
  readLiveRoomInvitation,
  sanitizeLiveRoomCode,
  saveLiveRoomSession,
  type LiveRoomSnapshot,
  type LiveRoomStorage,
} from "./liveRoom";

const room: LiveRoomSnapshot = {
  code: "M4RT2N",
  seed: "MIRR22",
  track: "tables-2-5",
  status: "playing",
  hostPlayerId: "player-1",
  shotsPerPlayer: 3,
  expiresAt: 2_000_000_000_000,
  players: [
    { id: "player-1", nickname: "Martín", colorIndex: 0, shotsCompleted: 0, goals: 0, firstTryCorrect: 0, responseTimeMs: 0, score: 0 },
    { id: "player-2", nickname: "Ana", colorIndex: 1, shotsCompleted: 0, goals: 0, firstTryCorrect: 0, responseTimeMs: 0, score: 0 },
  ],
};

afterEach(() => vi.unstubAllGlobals());

describe("V11 live rooms", () => {
  it("normalizes six-character room codes and rejects ambiguous symbols", () => {
    expect(sanitizeLiveRoomCode(" m4-rt2n! ")).toBe("M4RT2N");
    expect(sanitizeLiveRoomCode("O0I1L")).toBe("");
    expect(readLiveRoomInvitation("?room=m4rt2n&token=secret")).toBe("M4RT2N");
  });

  it("creates a share URL without names, player ids or session tokens", () => {
    const shared = new URL(createLiveRoomShareUrl("https://example.com/juego?lightning=OLD22&track=tables-6-9", room.code));
    expect(shared.searchParams.get("room")).toBe("M4RT2N");
    expect(shared.searchParams.get("v10Demo")).toBe("1");
    expect(shared.searchParams.has("lightning")).toBe(false);
    expect(shared.searchParams.has("track")).toBe(false);
    expect(shared.toString()).not.toContain("Martín");
    expect(shared.toString()).not.toContain("player-1");
  });

  it("gives every player the same mirrored multiplication for the same round", () => {
    expect(getLiveRoomChallenge(room, "player-1")).toEqual(getLiveRoomChallenge(room, "player-2"));
    const nextRound = {
      ...room,
      players: room.players.map((player) => ({ ...player, shotsCompleted: 1 })),
    };
    expect(getLiveRoomChallenge(nextRound, "player-1").id).not.toBe(getLiveRoomChallenge(room, "player-1").id);
    expect(getLiveRoomChallenge(nextRound, "player-1")).toEqual(getLiveRoomChallenge(nextRound, "player-2"));
  });

  it("stores and clears only the local room credential defensively", () => {
    const values = new Map<string, string>();
    const storage: LiveRoomStorage = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => { values.set(key, value); },
      removeItem: (key) => { values.delete(key); },
    };
    const session = { roomCode: room.code, playerId: "player-1", token: "a".repeat(40) };
    expect(saveLiveRoomSession(storage, session)).toBe(true);
    expect(values.has(V11_LIVE_ROOM_SESSION_KEY)).toBe(true);
    expect(loadLiveRoomSession(storage)).toEqual(session);
    expect(clearLiveRoomSession(storage)).toBe(true);
    expect(loadLiveRoomSession(storage)).toBeNull();

    const blocked: LiveRoomStorage = {
      getItem: () => { throw new Error("blocked"); },
      setItem: () => { throw new Error("blocked"); },
      removeItem: () => { throw new Error("blocked"); },
    };
    expect(loadLiveRoomSession(blocked)).toBeNull();
    expect(saveLiveRoomSession(blocked, session)).toBe(false);
    expect(clearLiveRoomSession(blocked)).toBe(false);
  });

  it("creates and joins rooms through the public API contract", async () => {
    const session = { roomCode: room.code, playerId: "player-1", token: "a".repeat(40) };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ session, room }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(createRemoteLiveRoom("Martín", "tables-2-5")).resolves.toEqual({ session, room });
    await expect(joinRemoteLiveRoom("m4rt2n", "Ana")).resolves.toEqual({ session, room });
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/v11/rooms", expect.objectContaining({ method: "POST" }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/v11/rooms/M4RT2N", expect.objectContaining({ method: "POST" }));
    expect(String(fetchMock.mock.calls[0][1]?.body)).toContain('"nickname":"Martín"');
  });

  it("surfaces safe API failures without leaking response details", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ code: "room_full", error: "La sala ya tiene cuatro jugadores." }),
    }));
    await expect(joinRemoteLiveRoom(room.code, "Leo")).rejects.toMatchObject({
      code: "room_full",
      message: "La sala ya tiene cuatro jugadores.",
    });
  });
});
