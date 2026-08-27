import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LIVE_ROOM_TTL_MS } from "../../shared/liveRoomContract";
import { LibsqlRoomRepository } from "../infrastructure/libsqlRoomRepository";
import { RoomError } from "./roomErrors";
import { RoomService } from "./roomService";

function expectRoomError(code: string) {
  return expect.objectContaining({ code });
}

describe("RoomService with libSQL", () => {
  let directory = "";
  let now = 1_800_000_000_000;
  let service: RoomService;

  beforeEach(async () => {
    directory = mkdtempSync(path.join(os.tmpdir(), "tlm-live-room-"));
    const repository = new LibsqlRoomRepository({ url: `file:${path.join(directory, "rooms.db")}` });
    service = new RoomService(repository, () => now);
    await service.initialize();
  });

  afterEach(() => {
    service.close();
    rmSync(directory, { recursive: true, force: true });
  });

  it("creates, joins and authenticates a persistent room", async () => {
    const host = await service.createRoom("Martín", "tables-2-5");
    const guest = await service.joinRoom(host.room.code, "Ana");
    expect(guest.room.players.map((player) => player.nickname).sort()).toEqual(["Ana", "Martín"]);
    await expect(service.getRoom(host.room.code, host.session)).resolves.toMatchObject({
      code: host.room.code,
      status: "waiting",
    });
    await expect(service.getRoom(host.room.code, { ...host.session, token: "x".repeat(30) }))
      .rejects.toEqual(expectRoomError("session_invalid"));
  });

  it("stores only a hash of the session token", async () => {
    const host = await service.createRoom("Martín", "tables-2-5");
    const databaseBytes = Buffer.concat(readdirSync(directory).map((filename) => readFileSync(path.join(directory, filename))));
    expect(databaseBytes.includes(Buffer.from(host.session.token))).toBe(false);
  });

  it("only lets the host start after a second player joins", async () => {
    const host = await service.createRoom("Martín", "tables-2-5");
    await expect(service.startRoom(host.room.code, host.session))
      .rejects.toEqual(expectRoomError("not_enough_players"));
    const guest = await service.joinRoom(host.room.code, "Ana");
    await expect(service.startRoom(host.room.code, guest.session))
      .rejects.toEqual(expectRoomError("host_only"));
    await expect(service.startRoom(host.room.code, host.session)).resolves.toMatchObject({ status: "playing" });
    await expect(service.startRoom(host.room.code, host.session)).resolves.toMatchObject({ status: "playing" });
  });

  it("caps rooms at four players", async () => {
    const host = await service.createRoom("Martín", "tables-2-5");
    await service.joinRoom(host.room.code, "Ana");
    await service.joinRoom(host.room.code, "Leo");
    await service.joinRoom(host.room.code, "Sofi");
    await expect(service.joinRoom(host.room.code, "Nico"))
      .rejects.toEqual(expectRoomError("room_full"));
  });

  it("enforces shot order and makes identical retries idempotent", async () => {
    const host = await service.createRoom("Martín", "tables-2-5");
    await service.joinRoom(host.room.code, "Ana");
    await service.startRoom(host.room.code, host.session);
    const shot = { roundIndex: 0, scored: true, firstTry: true, responseTimeMs: 3_000 };
    await expect(service.submitShot(host.room.code, host.session, { ...shot, roundIndex: 1 }))
      .rejects.toEqual(expectRoomError("round_out_of_order"));
    const first = await service.submitShot(host.room.code, host.session, shot);
    const repeated = await service.submitShot(host.room.code, host.session, shot);
    expect(repeated).toEqual(first);
    await expect(service.submitShot(host.room.code, host.session, { ...shot, scored: false }))
      .rejects.toEqual(expectRoomError("round_conflict"));
  });

  it("completes after every player records three shots and ranks football first", async () => {
    const host = await service.createRoom("Martín", "tables-2-5");
    const guest = await service.joinRoom(host.room.code, "Ana");
    await service.startRoom(host.room.code, host.session);
    for (let roundIndex = 0; roundIndex < 3; roundIndex += 1) {
      await service.submitShot(host.room.code, host.session, {
        roundIndex,
        scored: true,
        firstTry: true,
        responseTimeMs: 3_000,
      });
      await service.submitShot(host.room.code, guest.session, {
        roundIndex,
        scored: roundIndex < 2,
        firstTry: true,
        responseTimeMs: 2_000,
      });
    }
    const completed = await service.getRoom(host.room.code, guest.session);
    expect(completed.status).toBe("completed");
    expect(completed.players[0]).toMatchObject({ nickname: "Martín", goals: 3, shotsCompleted: 3 });
    expect(completed.players[1]).toMatchObject({ nickname: "Ana", goals: 2, shotsCompleted: 3 });
  });

  it("expires rooms after two hours", async () => {
    const host = await service.createRoom("Martín", "tables-2-5");
    now += LIVE_ROOM_TTL_MS + 1;
    await expect(service.getRoom(host.room.code, host.session))
      .rejects.toEqual(expectRoomError("room_not_found"));
  });

  it("uses safe domain errors", () => {
    const error = new RoomError("room_full");
    expect(error.status).toBe(409);
    expect(error.message).not.toContain("SQL");
  });
});
