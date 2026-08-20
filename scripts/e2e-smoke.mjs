import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const APP_URL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:4173";

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
    } catch (error) { lastError = error; }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`${message}${lastError ? `: ${lastError.message}` : ""}`);
}

async function stopProcess(child, timeoutMs = 2_000) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;

  const waitForExit = () => new Promise((resolve) => child.once("exit", resolve));
  const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
  const gracefulExit = waitForExit();
  child.kill("SIGTERM");
  await Promise.race([gracefulExit, delay(timeoutMs)]);

  if (child.exitCode === null && child.signalCode === null) {
    const forcedExit = waitForExit();
    child.kill("SIGKILL");
    await Promise.race([forcedExit, delay(1_000)]);
  }
}

function findChrome() {
  for (const candidate of ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"]) {
    const result = spawnSync("which", [candidate], { encoding: "utf8" });
    if (result.status === 0) return result.stdout.trim();
  }
  throw new Error("Chrome/Chromium is required for E2E tests.");
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
      } else this.events.push(message);
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

const profileDir = mkdtempSync(path.join(os.tmpdir(), "math-powers-e2e-"));
const server = spawn("pnpm", ["preview", "--host", "127.0.0.1", "--port", "4173"], { stdio: "ignore" });
let chrome;
let cdp;
let chromeStderr = "";

try {
  await waitFor(async () => (await fetch(APP_URL)).ok, "Preview server did not start");
  chrome = spawn(findChrome(), [
    "--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage",
    "--no-first-run", "--disable-background-networking", "--remote-debugging-address=127.0.0.1",
    "--remote-debugging-port=0", `--user-data-dir=${profileDir}`, "data:blank",
  ], { stdio: ["ignore", "ignore", "pipe"] });
  chrome.stderr.on("data", (chunk) => { chromeStderr += chunk.toString(); });
  const activePortFile = path.join(profileDir, "DevToolsActivePort");
  const debugPort = await waitFor(() => {
    if (!existsSync(activePortFile)) {
      if (chrome.exitCode !== null) throw new Error(`Chrome exited with ${chrome.exitCode}: ${chromeStderr.slice(-1000)}`);
      return false;
    }
    const [port] = readFileSync(activePortFile, "utf8").trim().split(/\r?\n/);
    return Number(port) || false;
  }, "Chrome did not publish its DevTools port");
  const target = await waitFor(async () => {
    const response = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
    const pages = await response.json();
    return pages.find((page) => page.type === "page" && page.webSocketDebuggerUrl);
  }, "Chrome DevTools did not become available");

  cdp = new CdpClient(target.webSocketDebuggerUrl);
  await cdp.open();
  const evaluate = async (expression) => {
    const result = await cdp.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  };
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Performance.enable");
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await cdp.send("Page.navigate", { url: APP_URL });
  await waitFor(async () => (await evaluate("document.readyState")) === "complete", "Game did not load");

  const homeText = await evaluate("document.body.innerText");
  assert(homeText.includes("TIRO LIBRE") && homeText.includes("JUGAR"), "Home screen is not playable.");
  await evaluate(`[...document.querySelectorAll("button")].find((el) => el.textContent.includes("JUGAR")).focus()`);
  await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
  await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
  await waitFor(async () => (await evaluate("document.body.innerText")).includes("Seleccionar Nivel"), "Level selector did not open");

  const accessibilityIssues = await evaluate(`(() => {
    const buttons = [...document.querySelectorAll("button")].filter((el) => !el.disabled);
    return {
      unnamedButtons: buttons.filter((el) => !(el.getAttribute("aria-label") || el.textContent.trim())).length,
      imagesWithoutAlt: [...document.querySelectorAll("img")].filter((el) => !el.hasAttribute("alt")).length,
    };
  })()`);
  assert(accessibilityIssues.unnamedButtons === 0, "An enabled button has no accessible name.");
  assert(accessibilityIssues.imagesWithoutAlt === 0, "An image has no alt attribute.");

  await evaluate(`document.querySelector('[aria-label^="Jugar nivel 1:"]').click()`);
  await waitFor(async () => (await evaluate(`document.querySelectorAll('[aria-label^="Apuntar a coordenada"]').length`)) > 0, "Gameplay grid did not render");
  const mobileLayout = await evaluate(`({
    viewportWidth: innerWidth,
    contentWidth: document.documentElement.scrollWidth,
    gridButtons: document.querySelectorAll('[aria-label^="Apuntar a coordenada"]').length,
  })`);
  assert(mobileLayout.contentWidth <= mobileLayout.viewportWidth + 1, "Gameplay overflows the mobile viewport.");
  assert(mobileLayout.gridButtons >= 9, "Gameplay grid has too few target cells.");
  await evaluate(`document.querySelector('[aria-label^="Apuntar a coordenada"]').click()`);
  await waitFor(async () => /¡GOL!|¡Atajada!|¡Bloqueado!|¡Afuera!/.test(await evaluate("document.body.innerText")), "A complete shot did not reach its result", 8_000);
  await evaluate(`document.querySelector('[aria-label="Continuar al siguiente tiro"]').focus()`);
  await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
  await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
  await waitFor(async () => (await evaluate(`document.querySelectorAll('[aria-label^="Apuntar a coordenada"]:not([disabled])').length`)) > 0, "Keyboard could not continue to the next shot");

  const navigation = await evaluate(`(() => {
    const entry = performance.getEntriesByType("navigation")[0];
    return { duration: entry?.duration ?? 0, domContentLoaded: entry?.domContentLoadedEventEnd ?? 0 };
  })()`);
  assert(navigation.domContentLoaded < 3_000, `Mobile DOMContentLoaded exceeded 3s: ${navigation.domContentLoaded}ms.`);
  const performanceMetrics = await cdp.send("Performance.getMetrics");
  const jsHeapUsed = performanceMetrics.metrics.find((metric) => metric.name === "JSHeapUsedSize")?.value ?? 0;
  assert(jsHeapUsed < 100 * 1024 * 1024, `JavaScript heap exceeded 100MB: ${jsHeapUsed} bytes.`);
  const runtimeErrors = cdp.events.filter((event) => event.method === "Runtime.exceptionThrown");
  assert(runtimeErrors.length === 0, `Runtime exceptions detected: ${runtimeErrors.length}.`);
  console.log(JSON.stringify({ status: "passed", viewport: "390x844", navigation, jsHeapUsed, accessibilityIssues, mobileLayout }, null, 2));
} finally {
  cdp?.close();
  await stopProcess(chrome);
  await stopProcess(server);
  rmSync(profileDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
