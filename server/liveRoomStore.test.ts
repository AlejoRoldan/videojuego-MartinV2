import { describe, expect, it } from "vitest";
import { LiveRoomStore, LiveRoomStoreError } from "./liveRoomStore";

describe("live room server store", () => {
  it("creates a private host session without exposing its token in the room", () => {
    const store = new LiveRoomStore();
    const created = store.createRoom(" Martín ", "tables-2-5");

    expect(created.session.roomCode).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    expect(created.session.token.length).toBeGreaterThanOrEqual(20);
    expect(created.room).toMatchObject({ status: "waiting", track: "tables-2-5", shotsPerPlayer: 3 });
    expect(created.room.hostPlayerId).toBe(created.session.playerId);
    expect(JSON.stringify(created.room)).not.toContain(created.session.token);
  });

  it("requires the host and two players before starting", () => {
    const store = new LiveRoomStore();
    const host = store.createRoom("Martín", "tables-2-5");
    expect(() => store.startRoom(host.room.code, host.session)).toThrowError(LiveRoomStoreError);

    const guest = store.joinRoom(host.room.code, "Ana");
    expect(() => store.startRoom(host.room.code, guest.session)).toThrowError(/Solo el anfitrión/);
    expect(store.startRoom(host.room.code, host.session).status).toBe("playing");
    expect(() => store.joinRoom(host.room.code, "Leo")).toThrowError(/ya comenzó/);
  });

  it("records ordered shots, applies bounded scoring and completes after everyone finishes", () => {
    const store = new LiveRoomStore();
    const host = store.createRoom("Martín", "tables-6-9");
    const guest = store.joinRoom(host.room.code, "Ana");
    store.startRoom(host.room.code, host.session);

    expect(() => store.submitShot(host.room.code, host.session, {
      roundIndex: 1,
      scored: true,
      firstTry: true,
      responseTimeMs: 1_000,
    })).toThrowError(/fuera de orden/);

    for (const session of [host.session, guest.session]) {
      for (let roundIndex = 0; roundIndex < 3; roundIndex += 1) {
        store.submitShot(host.room.code, session, {
          roundIndex,
          scored: roundIndex !== 1,
          firstTry: true,
          responseTimeMs: 999_999,
        });
      }
    }

    const completed = store.getRoom(host.room.code, host.session);
    expect(completed.status).toBe("completed");
    expect(completed.players.every((player) => player.shotsCompleted === 3)).toBe(true);
    expect(completed.players.every((player) => player.responseTimeMs === 360_000)).toBe(true);
    expect(completed.players.every((player) => player.score === 290)).toBe(true);
  });

  it("expires rooms and rejects invalid credentials without exposing internals", () => {
    let now = 10_000;
    const store = new LiveRoomStore({ now: () => now, ttlMs: 1_000 });
    const host = store.createRoom("Martín", "tables-2-5");
    expect(() => store.getRoom(host.room.code, { ...host.session, token: "wrong" })).toThrowError(/sesión/);
    now += 1_001;
    expect(() => store.getRoom(host.room.code, host.session)).toThrowError(/venció/);
  });
});
