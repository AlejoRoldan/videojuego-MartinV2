import { createServer, type Server } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { createApplication } from "./app";
import { LiveRoomStore } from "./liveRoomStore";

let server: Server | null = null;

afterEach(async () => {
  if (!server) return;
  await new Promise<void>((resolve, reject) => server!.close((error) => error ? reject(error) : resolve()));
  server = null;
});

async function startApi(): Promise<string> {
  server = createServer(createApplication(new LiveRoomStore()));
  await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not expose a TCP port.");
  return `http://127.0.0.1:${address.port}`;
}

describe("live room HTTP API", () => {
  it("supports create, join, authenticated start and safe snapshots", async () => {
    const baseUrl = await startApi();
    const createResponse = await fetch(`${baseUrl}/api/v11/rooms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nickname: "Martín", track: "tables-2-5" }),
    });
    expect(createResponse.status).toBe(201);
    const created = await createResponse.json() as any;

    const joinResponse = await fetch(`${baseUrl}/api/v11/rooms/${created.room.code}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "join", nickname: "Ana" }),
    });
    expect(joinResponse.ok).toBe(true);
    const joined = await joinResponse.json() as any;

    const unauthorized = await fetch(`${baseUrl}/api/v11/rooms/${created.room.code}`);
    expect(unauthorized.status).toBe(401);

    const startResponse = await fetch(`${baseUrl}/api/v11/rooms/${created.room.code}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Player-ID": created.session.playerId,
        Authorization: `Bearer ${created.session.token}`,
      },
      body: JSON.stringify({ action: "start" }),
    });
    const started = await startResponse.json() as any;
    expect(started.status).toBe("playing");
    expect(started.players).toHaveLength(2);
    expect(JSON.stringify(started)).not.toContain(created.session.token);
    expect(JSON.stringify(started)).not.toContain(joined.session.token);
  });
});
