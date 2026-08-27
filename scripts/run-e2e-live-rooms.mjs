import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createServer as createNetServer } from "node:net";

async function reservePort() {
  return new Promise((resolve, reject) => {
    const probe = createNetServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      if (!address || typeof address === "string") return reject(new Error("Could not reserve an E2E port"));
      const port = address.port;
      probe.close(() => resolve(port));
    });
  });
}

const port = await reservePort();
const appUrl = `http://127.0.0.1:${port}`;
const directory = mkdtempSync(path.join(os.tmpdir(), "tlm-live-room-e2e-"));
let stderr = "";
const server = spawn(process.execPath, ["dist/index.js"], {
  env: {
    ...process.env,
    NODE_ENV: "production",
    PORT: String(port),
    DATABASE_URL: `file:${path.join(directory, "rooms.db")}`,
  },
  stdio: ["ignore", "ignore", "pipe"],
});
server.stderr.on("data", (chunk) => { stderr += chunk.toString(); });

async function waitForHealth() {
  const started = Date.now();
  while (Date.now() - started < 20_000) {
    if (server.exitCode !== null) throw new Error(`Demo server exited with ${server.exitCode}: ${stderr.slice(-2000)}`);
    try {
      const response = await fetch(`${appUrl}/api/health`);
      const body = await response.json();
      if (response.ok && body.status === "ok" && body.database === true) return;
    } catch {
      // Server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Demo server did not become healthy: ${stderr.slice(-2000)}`);
}

try {
  await waitForHealth();
  const result = spawnSync(process.execPath, ["scripts/e2e-live-rooms.mjs"], {
    env: { ...process.env, APP_URL: appUrl },
    stdio: "inherit",
  });
  if (result.status !== 0) process.exitCode = result.status ?? 1;
} finally {
  server.kill("SIGTERM");
  rmSync(directory, { recursive: true, force: true });
}
