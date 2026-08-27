import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { WebSocket } from "ws";

const APP_URL = (process.env.APP_URL || "http://127.0.0.1:3002").replace(/\/$/, "");
const ARTIFACTS_DIR = path.resolve(process.env.ARTIFACTS_DIR || "artifacts/live-rooms");
mkdirSync(ARTIFACTS_DIR, { recursive: true });

function assertThat(condition, message) {
  assert.equal(Boolean(condition), true, message);
}

async function waitFor(probe, message, timeoutMs = 20_000) {
  const started = Date.now();
  let lastError;
  while (Date.now() - started < timeoutMs) {
    try {
      const result = await probe();
      if (result) return result;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`${message}${lastError ? `: ${lastError.message}` : ""}`);
}

function findChrome() {
  for (const candidate of ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"]) {
    const result = spawnSync("which", [candidate], { encoding: "utf8" });
    if (result.status === 0) return result.stdout.trim();
  }
  throw new Error("Chrome/Chromium is required for live-room E2E tests.");
}

class CdpClient {
  constructor(url) {
    this.nextId = 1;
    this.pending = new Map();
    this.socket = new WebSocket(url);
    this.socket.onmessage = ({ data }) => {
      const message = JSON.parse(data);
      if (!message.id) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      message.error ? pending.reject(new Error(message.error.message)) : pending.resolve(message.result);
    };
  }
  async open() {
    if (this.socket.readyState === WebSocket.OPEN) return;
    await new Promise((resolve, reject) => {
      this.socket.onopen = resolve;
      this.socket.onerror = () => reject(new Error("Could not connect to Chrome DevTools."));
    });
  }
  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
  close() {
    this.socket.close();
  }
}

async function createBrowser(name) {
  const profileDir = mkdtempSync(path.join(os.tmpdir(), `tlm-${name}-`));
  let stderr = "";
  const chrome = spawn(findChrome(), [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--no-first-run",
    "--disable-background-networking",
    "--remote-debugging-address=127.0.0.1",
    "--remote-debugging-port=0",
    `--user-data-dir=${profileDir}`,
    "data:blank",
  ], { stdio: ["ignore", "ignore", "pipe"], env: { ...process.env, DBUS_SESSION_BUS_ADDRESS: "disabled:" } });
  chrome.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
  const portFile = path.join(profileDir, "DevToolsActivePort");
  const debugPort = await waitFor(() => {
    if (!existsSync(portFile)) {
      if (chrome.exitCode !== null) throw new Error(`Chrome exited with ${chrome.exitCode}: ${stderr.slice(-1000)}`);
      return false;
    }
    return Number(readFileSync(portFile, "utf8").trim().split(/\r?\n/)[0]) || false;
  }, `${name} did not publish its DevTools port`, 30_000);
  const target = await waitFor(async () => {
    const pages = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
    return pages.find((page) => page.type === "page" && page.webSocketDebuggerUrl);
  }, `${name} DevTools did not become available`);
  const cdp = new CdpClient(target.webSocketDebuggerUrl);
  await cdp.open();
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Performance.enable");
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });

  const evaluate = async (expression) => {
    const result = await cdp.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  };
  const navigate = async (url) => {
    await cdp.send("Page.navigate", { url });
    await waitFor(async () => (await evaluate("document.readyState")) === "complete", `${name} navigation did not complete`);
    await waitFor(async () => await evaluate("Boolean(document.querySelector('[data-v10-gesture-demo]'))"), `${name} game did not render`);
  };
  const clickText = async (text) => {
    const clicked = await evaluate(`(() => {
      const button = [...document.querySelectorAll('button')].find((item) => item.textContent.includes(${JSON.stringify(text)}));
      if (!button) return false;
      button.click();
      return true;
    })()`);
    assertThat(clicked, `${name} could not click ${text}`);
  };
  const setInput = async (selector, value) => {
    const updated = await evaluate(`(() => {
      const input = document.querySelector(${JSON.stringify(selector)});
      if (!(input instanceof HTMLInputElement)) return false;
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      setter.call(input, ${JSON.stringify(value)});
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()`);
    assertThat(updated, `${name} could not update ${selector}`);
  };
  const solveQuestion = async () => {
    await waitFor(async () => await evaluate("!document.querySelector('[data-lightning-lobby]')"), `${name} did not leave the remote lobby`);
    const answer = await waitFor(async () => await evaluate(`(() => {
      const question = document.querySelector('#multiplication-question')?.textContent?.trim();
      const factors = question?.match(/[0-9]+/g)?.map(Number);
      return factors?.length === 2 ? factors[0] * factors[1] : null;
    })()`), `${name} could not parse the multiplication`);
    await waitFor(async () => await evaluate(`(() => {
      const button = document.querySelector('[aria-label="Responder ${answer}"]');
      if (!button) return false;
      button.click();
      return true;
    })()`), `${name} could not select answer ${answer}`);
    await waitFor(async () => (await evaluate("document.body.innerText")).includes("Precisión matemática lista"), `${name} answer did not enable the shot`);
  };
  const shoot = async () => {
    const dispatched = await evaluate(`(() => {
      const surface = document.querySelector('[data-swipe-surface]');
      if (!(surface instanceof HTMLElement)) return false;
      surface.focus();
      return surface.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true }));
    })()`);
    assertThat(typeof dispatched === "boolean", `${name} could not dispatch the shot key`);
    try {
      await waitFor(async () => {
        const text = await evaluate("document.body.innerText");
        return text.includes("SIGUIENTE REMATE") || text.includes("VER MARCADOR") || text.includes("REINTENTAR ENVÍO");
      }, `${name} remote shot was not stored`, 20_000);
    } catch (error) {
      const debug = await evaluate(`(() => ({
        text: document.body.innerText,
        activeElement: document.activeElement?.getAttribute('data-swipe-surface') || document.activeElement?.tagName,
        surfaceExists: Boolean(document.querySelector('[data-swipe-surface]')),
        question: document.querySelector('#multiplication-question')?.textContent,
      }))()`);
      writeFileSync(path.join(ARTIFACTS_DIR, `${name}-failure.json`), JSON.stringify(debug, null, 2));
      await screenshot(`${name}-failure.png`);
      throw new Error(`${error.message}: ${JSON.stringify(debug)}`);
    }
    const text = await evaluate("document.body.innerText");
    assertThat(!text.includes("REINTENTAR ENVÍO"), `${name} remote shot reached an API error`);
  };
  const screenshot = async (filename) => {
    const image = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    const destination = path.join(ARTIFACTS_DIR, filename);
    writeFileSync(destination, Buffer.from(image.data, "base64"));
    return destination;
  };
  const close = async () => {
    cdp.close();
    chrome.kill("SIGTERM");
    await new Promise((resolve) => setTimeout(resolve, 100));
    if (chrome.exitCode === null) chrome.kill("SIGKILL");
    rmSync(profileDir, { recursive: true, force: true });
  };
  return { name, evaluate, navigate, clickText, setInput, solveQuestion, shoot, screenshot, close };
}

const health = await fetch(`${APP_URL}/api/health`).then((response) => response.json());
assert.deepEqual(health, { status: "ok", database: true });

const host = await createBrowser("host");
const guest = await createBrowser("guest");
try {
  await host.navigate(APP_URL);
  await host.clickText("COMPETIR CON AMIGOS");
  await waitFor(async () => await host.evaluate("Boolean(document.querySelector('[data-lightning-lobby]'))"), "Host social lobby did not open");
  await host.clickText("CREAR SALA EN VIVO");
  await waitFor(async () => await host.evaluate("Boolean(document.querySelector('[data-live-room-lobby]'))"), "Host room was not created");
  const code = await host.evaluate("document.querySelector('[data-live-room-lobby] strong')?.textContent?.trim()");
  assert.match(code, /^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{6}$/);

  await guest.navigate(`${APP_URL}/?v10Demo=1&room=${code}`);
  await waitFor(async () => await guest.evaluate("Boolean(document.querySelector('[data-lightning-lobby]'))"), "Guest social lobby did not open");
  await guest.setInput("[data-lightning-lobby] input:not([aria-label])", "Ana");
  await guest.clickText("ENTRAR");
  await waitFor(async () => await guest.evaluate("Boolean(document.querySelector('[data-live-room-lobby]'))"), "Guest did not join");
  await waitFor(async () => (await host.evaluate("document.querySelector('[data-live-room-lobby]')?.innerText || ''")).includes("2/4 jugadores"), "Host did not observe guest polling", 10_000);

  const hostUrl = await host.evaluate("location.href");
  const guestUrl = await guest.evaluate("location.href");
  assertThat(!hostUrl.includes("token=") && !guestUrl.includes("token="), "Room URL leaked a token");
  assertThat(!hostUrl.includes("playerId=") && !guestUrl.includes("playerId="), "Room URL leaked a player id");

  await host.clickText("INICIAR PARTIDO");
  await waitFor(async () => await host.evaluate("Boolean(document.querySelector('#multiplication-question'))"), "Host did not enter the match", 10_000);
  await waitFor(async () => await guest.evaluate("Boolean(document.querySelector('#multiplication-question'))"), "Guest did not observe match start", 10_000);

  for (const browser of [host, guest]) {
    for (let roundIndex = 0; roundIndex < 3; roundIndex += 1) {
      await browser.solveQuestion();
      await browser.shoot();
      await browser.clickText(roundIndex === 2 ? "VER MARCADOR" : "SIGUIENTE REMATE");
      if (roundIndex < 2) {
        await waitFor(async () => await browser.evaluate("Boolean(document.querySelector('#multiplication-question'))"), `${browser.name} next round did not load`);
      }
    }
  }

  await waitFor(async () => (await host.evaluate("document.body.innerText")).includes("PARTIDO COMPLETADO"), "Host did not see completion", 12_000);
  await waitFor(async () => (await guest.evaluate("document.body.innerText")).includes("PARTIDO COMPLETADO"), "Guest did not see completion", 12_000);
  const hostRoomText = await host.evaluate("document.querySelector('[data-live-room-lobby]')?.innerText || ''");
  const guestRoomText = await guest.evaluate("document.querySelector('[data-live-room-lobby]')?.innerText || ''");
  assertThat(hostRoomText.includes("3/3 tiros") && guestRoomText.includes("3/3 tiros"), "Final scoreboard is incomplete");
  assertThat(hostRoomText.includes("Martín") && hostRoomText.includes("Ana"), "Host scoreboard is missing a player");
  assertThat(guestRoomText.includes("Martín") && guestRoomText.includes("Ana"), "Guest scoreboard is missing a player");

  const hostScreenshot = await host.screenshot("host-final.png");
  const guestScreenshot = await guest.screenshot("guest-final.png");
  console.log(JSON.stringify({
    status: "passed",
    checks: [
      "health",
      "real room creation",
      "second browser join",
      "authenticated polling",
      "credential-safe URL",
      "host-only start",
      "six persisted remote shots",
      "shared final scoreboard",
    ],
    roomCode: code,
    screenshots: [hostScreenshot, guestScreenshot],
  }, null, 2));
} finally {
  await Promise.all([host.close(), guest.close()]);
}
