import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const baseUrl = (process.env.APP_URL || "http://127.0.0.1:3002").replace(/\/$/, "");
const sessionPath = process.env.SESSION_INPUT;
if (!sessionPath) throw new Error("SESSION_INPUT is required");
const saved = JSON.parse(readFileSync(sessionPath, "utf8"));

const response = await fetch(`${baseUrl}/api/v11/rooms/${saved.roomCode}`, {
  headers: {
    "X-Player-ID": saved.host.playerId,
    Authorization: `Bearer ${saved.host.token}`,
  },
});
const room = await response.json();
assert.equal(response.status, 200);
assert.equal(room.code, saved.roomCode);
assert.equal(room.status, "completed");
assert.deepEqual(room.players.map((player) => player.shotsCompleted), [3, 3]);
console.log(JSON.stringify({ status: "passed", persistedRoom: room.code, roomStatus: room.status }, null, 2));
