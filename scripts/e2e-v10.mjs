import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const EXTERNAL_APP_URL = process.env.E2E_V10_BASE_URL;
const APP_URL = EXTERNAL_APP_URL ?? "http://127.0.0.1:4175/?v10Demo=1";

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

function findChrome() {
  for (const candidate of ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"]) {
    const result = spawnSync("which", [candidate], { encoding: "utf8" });
    if (result.status === 0) return result.stdout.trim();
  }
  throw new Error("Chrome/Chromium is required for V10 E2E tests.");
}

async function stopProcess(child, timeoutMs = 2_000) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise((resolve) => child.once("exit", resolve));
  child.kill("SIGTERM");
  await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, timeoutMs))]);
  if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
}

class CdpClient {
  constructor(url) {
    this.nextId = 1;
    this.pending = new Map();
    this.events = [];
    this.socket = new WebSocket(url);
    this.socket.onmessage = ({ data }) => {
      const message = JSON.parse(data);
      if (!message.id) {
        this.events.push(message);
        return;
      }
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

  close() { this.socket.close(); }
}

const profileDir = mkdtempSync(path.join(os.tmpdir(), "tlm-v10-e2e-"));
let chrome;
let cdp;
let server;
let chromeStderr = "";

try {
  if (!EXTERNAL_APP_URL) {
    server = spawn("pnpm", ["preview", "--host", "127.0.0.1", "--port", "4175"], { stdio: "ignore" });
    await waitFor(async () => (await fetch(APP_URL)).ok, "V10 preview server did not start");
  }
  chrome = spawn(findChrome(), [
    "--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage",
    "--no-first-run", "--disable-background-networking", "--remote-debugging-address=127.0.0.1",
    "--remote-debugging-port=0", `--user-data-dir=${profileDir}`, "data:blank",
  ], { stdio: ["ignore", "ignore", "pipe"], env: { ...process.env, DBUS_SESSION_BUS_ADDRESS: "disabled:" } });
  chrome.stderr.on("data", (chunk) => { chromeStderr += chunk.toString(); });

  const portFile = path.join(profileDir, "DevToolsActivePort");
  const debugPort = await waitFor(() => {
    if (!existsSync(portFile)) {
      if (chrome.exitCode !== null) throw new Error(`Chrome exited with ${chrome.exitCode}: ${chromeStderr.slice(-1000)}`);
      return false;
    }
    return Number(readFileSync(portFile, "utf8").trim().split(/\r?\n/)[0]) || false;
  }, "Chrome did not publish its DevTools port", 30_000);
  const target = await waitFor(async () => {
    const pages = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
    return pages.find((page) => page.type === "page" && page.webSocketDebuggerUrl);
  }, "Chrome DevTools did not become available");

  cdp = new CdpClient(target.webSocketDebuggerUrl);
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
  const reload = async () => {
    await cdp.send("Page.reload", { ignoreCache: true });
    await waitFor(async () => (await evaluate("document.readyState")) === "complete", "Demo reload did not finish");
    await waitFor(async () => await evaluate("Boolean(document.querySelector('[data-v10-gesture-demo]'))"), "V10 demo did not render after reload");
  };
  const solveCurrentQuestion = async () => {
    const answer = await waitFor(async () => await evaluate(`(() => {
      const question = document.querySelector("#multiplication-question")?.textContent?.trim();
      const factors = question?.match(/[0-9]+/g)?.map(Number);
      return factors?.length === 2 ? factors[0] * factors[1] : null;
    })()`), "Could not parse the current multiplication question.");
    const clicked = await evaluate(`(() => {
      const button = document.querySelector('[aria-label="Responder ${answer}"]');
      if (!button) return false;
      button.click();
      return true;
    })()`);
    assert(clicked, `The correct answer button (${answer}) was not available.`);
    await waitFor(async () => (await evaluate("document.body.innerText")).includes("Precisión matemática lista"), "Correct answer did not enable the shot");
  };
  const completeKeyboardShot = async () => {
    await evaluate(`document.querySelector('[data-swipe-surface]')?.focus()`);
    const key = { key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 };
    await cdp.send("Input.dispatchKeyEvent", { type: "rawKeyDown", ...key });
    await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", ...key });
    await waitFor(async () => /¡GOL!|¡Atajó!|¡Barrera!|¡Al palo!|¡Travesaño!|¡Afuera!|Faltó fuerza/.test(await evaluate("document.body.innerText")), "Shot did not reach a result", 12_000);
  };

  await cdp.send("Page.navigate", { url: APP_URL });
  await waitFor(async () => (await evaluate("document.readyState")) === "complete", "V10 demo did not load");
  await waitFor(async () => await evaluate("Boolean(document.querySelector('[data-v10-gesture-demo]'))"), "V10 game surface was not found");
  await evaluate("localStorage.clear()");
  await reload();

  const initial = await evaluate(`(() => ({
    text: document.body.innerText,
    locked: [...document.querySelectorAll('button')].some((button) => button.textContent.includes('🔒') && button.textContent.includes('Tablas 6')),
    overflow: document.documentElement.scrollWidth - innerWidth,
    unnamedButtons: [...document.querySelectorAll('button')].filter((button) => !button.disabled && !(button.getAttribute('aria-label') || button.textContent.trim())).length,
  }))()`);
  assert(initial.text.includes("ACADEMIA DE TABLAS"), "Multiplication academy is missing.");
  assert(initial.locked, "Advanced multiplication tables should start locked.");
  assert(initial.overflow <= 1, `Mobile layout overflows by ${initial.overflow}px.`);
  assert(initial.unnamedButtons === 0, "An enabled button has no accessible name.");

  await solveCurrentQuestion();
  await completeKeyboardShot();
  const firstRound = await evaluate(`JSON.parse(localStorage.getItem('tlm_v10_multiplication_progress_v2') || localStorage.getItem('tlm_v10_multiplication_progress_v1') || 'null')`);
  assert(firstRound?.tracks?.["tables-2-5"]?.roundsCompleted === 1, "Completed round was not persisted.");
  await reload();
  assert((await evaluate("document.body.innerText")).includes("1 retos"), "Persisted progress was not restored after reload.");

  await evaluate(`(() => {
    const facts = {};
    let order = 1;
    for (let a = 2; a <= 5; a += 1) {
      for (let b = 2; b <= 5; b += 1) {
        const weak = a === 4 && b === 5;
        facts[a + 'x' + b] = { attempts: weak ? 2 : 1, firstTryCorrect: weak ? 0 : 1, assistedCorrect: weak ? 2 : 0, recentFirstTry: weak ? [false, false] : [true], lastPlayedRound: order };
        order += 1;
      }
    }
    localStorage.setItem('tlm_v10_multiplication_progress_v2', JSON.stringify({
      version: 2,
      activeTrack: 'tables-2-5',
      advancedUnlocked: true,
      tracks: {
        'tables-2-5': { roundsCompleted: 17, firstTryCorrect: 15, assistedCorrect: 2, goals: 5, recentFirstTry: [true, true, false, false, true], mastery: 'mastering', lastPlayedAt: '2026-08-24T00:00:00.000Z', facts, lastFactKey: '5x5' },
        'tables-6-9': { roundsCompleted: 0, firstTryCorrect: 0, assistedCorrect: 0, goals: 0, recentFirstTry: [], mastery: 'discovering', lastPlayedAt: '', facts: {}, lastFactKey: '' }
      },
      updatedAt: '2026-08-24T00:00:00.000Z'
    }));
  })()`);
  await reload();
  const adaptiveState = await evaluate(`({ question: document.querySelector('#multiplication-question')?.textContent?.trim(), text: document.body.innerText })`);
  assert(adaptiveState.question === "4 × 5 = ?", `Adaptive route selected ${adaptiveState.question} instead of the seeded reinforcement fact.`);
  assert(adaptiveState.text.includes("Reforzando"), "Adaptive reinforcement mode was not explained.");

  await evaluate(`localStorage.removeItem('tlm_v10_multiplication_progress_v2'); localStorage.setItem('tlm_v10_multiplication_progress_v1', JSON.stringify({
    version: 1,
    activeTrack: 'tables-2-5',
    advancedUnlocked: false,
    tracks: {
      'tables-2-5': { roundsCompleted: 4, firstTryCorrect: 3, assistedCorrect: 1, goals: 2, recentFirstTry: [true, true, true, false], mastery: 'practicing', lastPlayedAt: '2026-08-24T00:00:00.000Z' },
      'tables-6-9': { roundsCompleted: 0, firstTryCorrect: 0, assistedCorrect: 0, goals: 0, recentFirstTry: [], mastery: 'discovering', lastPlayedAt: '' }
    },
    updatedAt: '2026-08-24T00:00:00.000Z'
  }))`);
  await reload();
  await solveCurrentQuestion();
  await completeKeyboardShot();
  const unlocked = await evaluate(`(() => {
    const progress = JSON.parse(localStorage.getItem('tlm_v10_multiplication_progress_v2') || localStorage.getItem('tlm_v10_multiplication_progress_v1') || 'null');
    const button = [...document.querySelectorAll('button')].find((item) => item.textContent.includes('Tablas 6'));
    return { advancedUnlocked: progress?.advancedUnlocked, lockedText: button?.textContent.includes('🔒'), announcement: document.body.innerText.includes('NUEVO RETO: TABLAS 6–9') };
  })()`);
  assert(unlocked.advancedUnlocked === true, "Performance path did not unlock tables 6–9.");
  assert(unlocked.lockedText === false, "Advanced track remained visually locked.");
  assert(unlocked.announcement === true, "Unlock celebration was not announced.");

  const runtimeErrors = cdp.events.filter((event) => event.method === "Runtime.exceptionThrown");
  assert(runtimeErrors.length === 0, `Runtime exceptions detected: ${runtimeErrors.length}.`);
  const metrics = await cdp.send("Performance.getMetrics");
  const jsHeapUsed = metrics.metrics.find((metric) => metric.name === "JSHeapUsedSize")?.value ?? 0;
  assert(jsHeapUsed < 100 * 1024 * 1024, `JavaScript heap exceeded 100MB: ${jsHeapUsed} bytes.`);

  console.log(JSON.stringify({
    status: "passed",
    checks: ["mobile layout", "accessible buttons", "math answer", "keyboard shot", "round persistence", "reload recovery", "adaptive reinforcement", "V1 migration", "advanced unlock", "unlock announcement", "runtime errors", "heap budget"],
    firstRound: firstRound.tracks["tables-2-5"],
    unlocked,
    jsHeapUsed,
  }, null, 2));
} finally {
  cdp?.close();
  await stopProcess(chrome);
  await stopProcess(server);
  rmSync(profileDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
