import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";

const baseUrl = (process.env.APP_URL || "http://127.0.0.1:3002").replace(/\/$/, "");

async function request(path, init = {}) {
  const response = await fetch(`${baseUrl}${path}`, init);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${response.status} ${JSON.stringify(body)}`);
  return body;
}

function headers(session) {
  return {
    "Content-Type": "application/json",
    "X-Player-ID": session.playerId,
    Authorization: `Bearer ${session.token}`,
  };
}

const host = await request("/api/v11/rooms", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ nickname: "Martín", track: "tables-2-5" }),
});
assert.equal(host.room.players.length, 1);
assert.equal(host.room.status, "waiting");

const guest = await request(`/api/v11/rooms/${host.room.code}`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ action: "join", nickname: "Ana" }),
});
assert.equal(guest.room.players.length, 2);

const started = await request(`/api/v11/rooms/${host.room.code}`, {
  method: "POST",
  headers: headers(host.session),
  body: JSON.stringify({ action: "start" }),
});
assert.equal(started.status, "playing");

for (let roundIndex = 0; roundIndex < 3; roundIndex += 1) {
  await request(`/api/v11/rooms/${host.room.code}`, {
    method: "POST",
    headers: headers(host.session),
    body: JSON.stringify({ action: "shot", roundIndex, scored: true, firstTry: true, responseTimeMs: 3_000 + roundIndex * 100 }),
  });
  await request(`/api/v11/rooms/${host.room.code}`, {
    method: "POST",
    headers: headers(guest.session),
    body: JSON.stringify({ action: "shot", roundIndex, scored: roundIndex < 2, firstTry: true, responseTimeMs: 4_000 + roundIndex * 100 }),
  });
}

const finalHost = await request(`/api/v11/rooms/${host.room.code}`, { headers: headers(host.session) });
const finalGuest = await request(`/api/v11/rooms/${host.room.code}`, { headers: headers(guest.session) });
assert.deepEqual(finalGuest, finalHost);
assert.equal(finalHost.status, "completed");
assert.equal(finalHost.players.length, 2);
assert.equal(finalHost.players[0].nickname, "Martín");
assert.deepEqual(finalHost.players.map((player) => player.shotsCompleted), [3, 3]);

if (process.env.SESSION_OUTPUT) {
  writeFileSync(process.env.SESSION_OUTPUT, JSON.stringify({ roomCode: finalHost.code, host: host.session, guest: guest.session }, null, 2));
}

console.log(JSON.stringify({
  status: "passed",
  roomCode: finalHost.code,
  players: finalHost.players.map(({ nickname, goals, score, shotsCompleted }) => ({ nickname, goals, score, shotsCompleted })),
}, null, 2));
