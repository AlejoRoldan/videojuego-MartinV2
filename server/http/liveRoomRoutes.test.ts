import { createServer, type Server } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createGameApplication, type GameApplication } from "../app";
import { LibsqlRoomRepository } from "../infrastructure/libsqlRoomRepository";

async function listen(server: Server): Promise<number> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") return reject(new Error("Missing test port"));
      resolve(address.port);
    });
  });
}

async function stop(server: Server): Promise<void> {
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

describe("live room HTTP API", () => {
  let directory = "";
  let application: GameApplication;
  let server: Server;
  let baseUrl = "";

  beforeEach(async () => {
    directory = mkdtempSync(path.join(os.tmpdir(), "tlm-live-room-http-"));
    application = await createGameApplication({
      repository: new LibsqlRoomRepository({ url: `file:${path.join(directory, "rooms.db")}` }),
    });
    server = createServer(application.app);
    baseUrl = `http://127.0.0.1:${await listen(server)}`;
  });

  afterEach(async () => {
    await stop(server);
    application.close();
    rmSync(directory, { recursive: true, force: true });
  });

  async function json(pathname: string, init: RequestInit = {}) {
    const response = await fetch(`${baseUrl}${pathname}`, init);
    return { response, body: await response.json() };
  }

  it("reports database health", async () => {
    const { response, body } = await json("/api/health");
    expect(response.status).toBe(200);
    expect(body).toEqual({ status: "ok", database: true });
  });

  it("rejects invalid creation payloads with safe JSON", async () => {
    const { response, body } = await json("/api/v11/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nickname: "<script>", track: "tables-100" }),
    });
    expect(response.status).toBe(400);
    expect(body).toEqual({ code: "invalid_payload", error: "Revisa el nombre o los datos enviados." });
  });

  it("handles malformed and oversized JSON without leaking internals", async () => {
    const malformed = await json("/api/v11/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{",
    });
    expect(malformed.response.status).toBe(400);
    expect(malformed.body.code).toBe("invalid_payload");

    const oversized = await json("/api/v11/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nickname: "A".repeat(5_000), track: "tables-2-5" }),
    });
    expect(oversized.response.status).toBe(413);
    expect(oversized.body).toEqual({ code: "invalid_payload", error: "Revisa el nombre o los datos enviados." });
  });

  it("creates, joins, protects and starts a room over HTTP", async () => {
    const created = await json("/api/v11/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nickname: "Martín", track: "tables-2-5" }),
    });
    expect(created.response.status).toBe(201);
    const code = created.body.room.code;

    const anonymous = await json(`/api/v11/rooms/${code}`);
    expect(anonymous.response.status).toBe(401);
    expect(anonymous.body.code).toBe("session_invalid");

    const joined = await json(`/api/v11/rooms/${code}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "join", nickname: "Ana" }),
    });
    expect(joined.response.status).toBe(200);
    expect(joined.body.room.players).toHaveLength(2);

    const started = await json(`/api/v11/rooms/${code}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Player-ID": created.body.session.playerId,
        Authorization: `Bearer ${created.body.session.token}`,
      },
      body: JSON.stringify({ action: "start" }),
    });
    expect(started.response.status).toBe(200);
    expect(started.body.status).toBe("playing");
    expect(started.response.headers.get("x-content-type-options")).toBe("nosniff");
  });
});
