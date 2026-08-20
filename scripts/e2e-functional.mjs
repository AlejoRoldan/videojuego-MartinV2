import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const APP_URL = process.env.E2E_FUNCTIONAL_BASE_URL ?? "http://127.0.0.1:4174";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function waitFor(check, message, timeoutMs = 15_000) {
  const startedAt = Date.now();
  let lastError;
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const value = await check();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 80));
  }
  throw new Error(`${message}${lastError ? `: ${lastError.message}` : ""}`);
}

async function stopProcess(child, timeoutMs = 2_000) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const waitForExit = () => new Promise((resolve) => child.once("exit", resolve));
  const gracefulExit = waitForExit();
  child.kill("SIGTERM");
  await Promise.race([gracefulExit, new Promise((resolve) => setTimeout(resolve, timeoutMs))]);
  if (child.exitCode === null && child.signalCode === null) {
    const forcedExit = waitForExit();
    child.kill("SIGKILL");
    await Promise.race([forcedExit, new Promise((resolve) => setTimeout(resolve, 1_000))]);
  }
}

function findChrome() {
  for (const candidate of ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"]) {
    const result = spawnSync("which", [candidate], { encoding: "utf8" });
    if (result.status === 0) return result.stdout.trim();
  }
  throw new Error("Chrome/Chromium is required for functional E2E tests.");
}

class CdpClient {
  constructor(url) {
    this.nextId = 1;
    this.pending = new Map();
    this.events = [];
    this.socket = new WebSocket(url);
    this.socket.onmessage = ({ data }) => {
      const message = JSON.parse(data);
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        message.error ? pending.reject(new Error(message.error.message)) : pending.resolve(message.result);
      } else {
        this.events.push(message);
      }
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
  close() { this.socket.close(); }
}

const profileDir = mkdtempSync(path.join(os.tmpdir(), "tlm-functional-e2e-"));
const server = spawn("pnpm", ["preview", "--host", "127.0.0.1", "--port", "4174"], { stdio: "ignore" });
let chrome;
let cdp;
let chromeStderr = "";

try {
  await waitFor(async () => (await fetch(APP_URL)).ok, "Preview server did not start");
  chrome = spawn(findChrome(), [
    "--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage",
    "--no-first-run", "--disable-background-networking", "--remote-debugging-address=127.0.0.1",
    "--remote-debugging-port=0", `--user-data-dir=${profileDir}`, "data:blank",
  ], { stdio: ["ignore", "ignore", "pipe"], env: { ...process.env, DBUS_SESSION_BUS_ADDRESS: "disabled:" } });
  chrome.stderr.on("data", (chunk) => { chromeStderr += chunk.toString(); });

  const activePortFile = path.join(profileDir, "DevToolsActivePort");
  const debugPort = await waitFor(() => {
    if (!existsSync(activePortFile)) {
      if (chrome.exitCode !== null) throw new Error(`Chrome exited with ${chrome.exitCode}: ${chromeStderr.slice(-1000)}`);
      return false;
    }
    const [port] = readFileSync(activePortFile, "utf8").trim().split(/\r?\n/);
    return Number(port) || false;
  }, "Chrome did not publish its DevTools port", 30_000);
  const target = await waitFor(async () => {
    const pages = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
    return pages.find((page) => page.type === "page" && page.webSocketDebuggerUrl);
  }, "Chrome DevTools did not become available");

  cdp = new CdpClient(target.webSocketDebuggerUrl);
  await cdp.open();
  const evaluate = async (expression) => {
    const result = await cdp.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  };
  const pressEnter = async () => {
    const key = { key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 };
    await cdp.send("Input.dispatchKeyEvent", { type: "rawKeyDown", ...key });
    await cdp.send("Input.dispatchKeyEvent", { type: "char", ...key, text: "\r", unmodifiedText: "\r" });
    await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", ...key });
  };
  const reload = async () => {
    await cdp.send("Page.reload");
    await waitFor(async () => (await evaluate("document.readyState")) === "complete", "Reload did not finish");
  };
  const clickButtonContaining = async (text) => {
    const normalizedText = text.replace(/\s+/g, " ").trim();
    const clicked = await evaluate(`(() => {
      const needle = ${JSON.stringify(normalizedText)};
      const button = [...document.querySelectorAll("button")].find((el) => el.textContent.replace(/\\s+/g, " ").includes(needle));
      if (!button) return false;
      button.click();
      return true;
    })()`);
    if (!clicked) {
      const buttons = await evaluate(`JSON.stringify([...document.querySelectorAll("button")].map((el) => ({ text: el.textContent, label: el.getAttribute("aria-label"), pressed: el.getAttribute("aria-pressed") })))`);
      throw new Error(`Button containing ${text} was not found. Buttons: ${buttons}`);
    }
  };
  const solveMultiplication = async () => {
    const correctOption = await evaluate(`(() => {
      const question = [...document.body.innerText.split("\\n")].map((line) => line.trim()).find((line) => /^\\d+ × \\d+ = \\?$/.test(line));
      if (!question) return null;
      const [, left, right] = question.match(/^(\\d+) × (\\d+) = \\?$/);
      return Number(left) * Number(right);
    })()`);
    assert(Number.isFinite(correctOption), "Could not parse the multiplication challenge.");
    await evaluate(`document.querySelector('[aria-label="Responder ${correctOption}"]').click()`);
  };

  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Performance.enable");
  await cdp.send("Page.bringToFront");
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await cdp.send("Page.navigate", { url: APP_URL });
  await waitFor(async () => (await evaluate("document.readyState")) === "complete", "Game did not load");

  const homeText = await evaluate("document.body.innerText");
  assert(homeText.includes("TIRO LIBRE") && homeText.includes("JUGAR"), "Home screen is not playable.");
  await clickButtonContaining("Ritmo de\npartido");
  assert(await evaluate("localStorage.getItem('tlm_game_pace')") === "match", "Ritmo de partido was not persisted.");
  await evaluate(`[...document.querySelectorAll("button")].find((el) => el.textContent.includes("JUGAR")).focus()`);
  await pressEnter();
  await waitFor(async () => (await evaluate("document.body.innerText")).includes("Seleccionar Nivel"), "Level selector did not open.");

  await evaluate(`localStorage.setItem("tlm_profile", JSON.stringify({ schemaVersion: 2, unlockedLevels: [1, 2] }))`);
  await reload();
  await clickButtonContaining("Ritmo de\npartido");
  await evaluate(`[...document.querySelectorAll("button")].find((el) => el.textContent.includes("JUGAR")).focus()`);
  await pressEnter();
  await waitFor(async () => (await evaluate("document.body.innerText")).includes("Seleccionar Nivel"), "Level selector did not restore.");

  await evaluate(`document.querySelector('[aria-label^="Jugar nivel 2:"]').click()`);
  await waitFor(async () => (await evaluate(`document.querySelectorAll('[aria-label^="Apuntar a coordenada"]:not([disabled])').length`)) >= 9, "Level 2 gameplay did not render.");
  const keeperSize = await evaluate(`document.querySelector('img[alt="Portero"]')?.getBoundingClientRect().width ?? 0`);
  assert(keeperSize >= 86, `Goalkeeper visual size is too small: ${keeperSize}px.`);
  const coordinateLabels = await evaluate(`[...document.querySelectorAll('[aria-label^="Apuntar a coordenada"]:not([disabled])')].map((el) => el.getAttribute('aria-label'))`);
  assert(coordinateLabels.length >= 9, "The full aim grid is not available.");

  const playFunctionalShot = async (label) => {
    const selector = `[aria-label="${label}"]`;
    await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
    await waitFor(async () => (await evaluate(`document.querySelectorAll('[aria-label^="Responder "]').length`)) > 0, "Math challenge did not render.");
    await solveMultiplication();
    const destination = await waitFor(async () => await evaluate(`(() => {
      const marker = document.querySelector('.shot-destination-marker');
      if (!marker) return null;
      const rect = marker.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    })()`), "Shot destination marker did not render.", 6_000);
    const trailDots = await waitFor(async () => {
      const count = await evaluate(`document.querySelectorAll('.shot-trajectory-blur span').length`);
      return count > 0 ? count : false;
    }, "Shot trajectory blur did not render.", 6_000);
    let impactObserved = false;
    let resultSeenAt = 0;
    await waitFor(async () => {
      const snapshot = await evaluate(`({ impact: Boolean(document.querySelector('.shot-microimpact')), result: /¡GOL!|¡Atajada!|¡Bloqueado!|¡Afuera!/.test(document.body.innerText) })`);
      impactObserved ||= snapshot.impact;
      if (snapshot.result && resultSeenAt === 0) resultSeenAt = Date.now();
      return snapshot.result && impactObserved && Date.now() - resultSeenAt <= 260;
    }, "Shot did not reach a result with visible microimpact.", 8_000);
    return { destination, trailDots, impactObserved };
  };

  const firstShot = await playFunctionalShot(coordinateLabels[0]);
  assert(firstShot.trailDots > 0, "First shot trajectory blur was not observed during flight.");
  await evaluate(`document.querySelector('[aria-label="Continuar al siguiente tiro"]').focus()`);
  await pressEnter();
  await waitFor(async () => (await evaluate(`document.querySelectorAll('[aria-label^="Apuntar a coordenada"]:not([disabled])').length`)) > 0, "Next shot did not unlock.");

  const secondShot = await playFunctionalShot(coordinateLabels.at(-1));
  const aimDistance = Math.hypot(firstShot.destination.x - secondShot.destination.x, firstShot.destination.y - secondShot.destination.y);
  assert(aimDistance > 24, `Different aim cells collapsed to nearly the same visual destination: ${aimDistance.toFixed(1)}px.`);
  assert(secondShot.trailDots > 0, "Second shot trajectory blur was not observed during flight.");
  await evaluate(`document.querySelector('[aria-label="Continuar al siguiente tiro"]').focus()`);
  await pressEnter();
  await waitFor(async () => (await evaluate(`document.querySelectorAll('[aria-label^="Apuntar a coordenada"]:not([disabled])').length`)) > 0, "Second shot did not unlock the next attempt.");

  await evaluate(`localStorage.setItem("tlm_profile", JSON.stringify({ schemaVersion: 2, name: "Martín", missionProgress: 2, missionCompletions: 0, unlockedLevels: [1, 2] }))`);
  await reload();
  await clickButtonContaining("Ritmo de\npartido");
  await evaluate(`[...document.querySelectorAll("button")].find((el) => el.textContent.includes("JUGAR")).focus()`);
  await pressEnter();
  await waitFor(async () => (await evaluate("document.body.innerText")).includes("Seleccionar Nivel"), "Level selector did not open for mission flow.");
  await evaluate(`document.querySelector('[aria-label^="Jugar nivel 1:"]').click()`);
  await waitFor(async () => (await evaluate(`document.querySelectorAll('[aria-label^="Apuntar a coordenada"]:not([disabled])').length`)) >= 9, "Level 1 gameplay did not render.");
  await evaluate(`document.querySelector('[aria-label^="Apuntar a coordenada"]').click()`);
  await waitFor(async () => /¡GOL!/.test(await evaluate("document.body.innerText")), "Deterministic Level 1 shot did not score.", 8_000);
  const missionState = await evaluate(`(() => {
    const profile = JSON.parse(localStorage.getItem("tlm_profile") || "{}");
    return { rewardVisible: document.body.innerText.includes("+15") && document.body.innerText.includes("+1"), missionProgress: profile.missionProgress, missionCompletions: profile.missionCompletions, coins: profile.coins, stars: profile.stars };
  })()`);
  assert(missionState.rewardVisible, "Mission reward burst was not visible.");
  assert(missionState.missionProgress === 0 && missionState.missionCompletions === 1, "Mission profile was not completed and reset.");
  assert(missionState.coins >= 15 && missionState.stars >= 1, "Mission reward was not persisted.");

  const accessibilityIssues = await evaluate(`(() => ({
    unnamedButtons: [...document.querySelectorAll("button")].filter((el) => !el.disabled && !(el.getAttribute("aria-label") || el.textContent.trim())).length,
    imagesWithoutAlt: [...document.querySelectorAll("img")].filter((el) => !el.hasAttribute("alt")).length,
    viewportWidth: innerWidth,
    contentWidth: document.documentElement.scrollWidth,
  }))()`);
  assert(accessibilityIssues.unnamedButtons === 0, "An enabled button has no accessible name.");
  assert(accessibilityIssues.imagesWithoutAlt === 0, "An image has no alt attribute.");
  assert(accessibilityIssues.contentWidth <= accessibilityIssues.viewportWidth + 1, "Functional flow overflows the mobile viewport.");
  const performanceMetrics = await cdp.send("Performance.getMetrics");
  const jsHeapUsed = performanceMetrics.metrics.find((metric) => metric.name === "JSHeapUsedSize")?.value ?? 0;
  const runtimeErrors = cdp.events.filter((event) => event.method === "Runtime.exceptionThrown");
  assert(runtimeErrors.length === 0, `Runtime exceptions detected: ${runtimeErrors.length}.`);
  console.log(JSON.stringify({ status: "passed", checks: ["pace persistence", "level navigation", "keeper scale", "math answer", "shot trail", "shot destination separation", "shot result", "next shot", "mission reward", "accessibility"], firstShot, secondShot, aimDistance, missionState, accessibilityIssues, jsHeapUsed }, null, 2));
} finally {
  cdp?.close();
  await stopProcess(chrome);
  await stopProcess(server);
  rmSync(profileDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
