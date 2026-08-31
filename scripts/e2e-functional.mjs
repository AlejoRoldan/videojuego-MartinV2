import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const APP_URL = process.env.E2E_FUNCTIONAL_BASE_URL ?? "http://127.0.0.1:4174/?legacy=1";
const EVIDENCE_DIR = process.env.QA_EVIDENCE_DIR
  ? path.resolve(process.env.QA_EVIDENCE_DIR)
  : null;

if (EVIDENCE_DIR) mkdirSync(EVIDENCE_DIR, { recursive: true });

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
  const captureScreenshot = async (name) => {
    if (!EVIDENCE_DIR) return;
    const { data } = await cdp.send("Page.captureScreenshot", {
      format: "png",
      fromSurface: true,
      captureBeyondViewport: false,
    });
    writeFileSync(path.join(EVIDENCE_DIR, `${name}.png`), Buffer.from(data, "base64"));
  };
  const pressEnter = async () => {
    const key = { key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 };
    await cdp.send("Input.dispatchKeyEvent", { type: "rawKeyDown", ...key });
    await cdp.send("Input.dispatchKeyEvent", { type: "char", ...key, text: "\r", unmodifiedText: "\r" });
    await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", ...key });
  };
  const pressControlKey = async (key, code, virtualKeyCode) => {
    const event = { key, code, windowsVirtualKeyCode: virtualKeyCode, nativeVirtualKeyCode: virtualKeyCode };
    await cdp.send("Input.dispatchKeyEvent", { type: "rawKeyDown", ...event });
    await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", ...event });
  };
  const reload = async () => {
    await cdp.send("Page.reload");
    await waitFor(async () => (await evaluate("document.readyState")) === "complete", "Reload did not finish");
    await waitFor(
      async () => (await evaluate("document.body.innerText")).includes("JUGAR"),
      "Lazy home screen did not restore after reload",
    );
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

  const homeText = await waitFor(async () => {
    const text = await evaluate("document.body.innerText");
    return text.includes("TIRO LIBRE") && text.includes("JUGAR") ? text : false;
  }, "Home screen did not finish loading");
  assert(homeText.includes("TIRO LIBRE") && homeText.includes("JUGAR"), "Home screen is not playable.");
  assert(["Apunta", "Resuelve", "Dispara"].every((step) => homeText.includes(step)), "Home does not explain the three-step game loop.");
  await captureScreenshot("01-home-390x844");
  await clickButtonContaining("Ritmo de\npartido");
  assert(await evaluate("localStorage.getItem('tlm_game_pace')") === "match", "Ritmo de partido was not persisted.");
  await evaluate(`[...document.querySelectorAll("button")].find((el) => el.textContent.includes("JUGAR")).focus()`);
  await pressEnter();
  await waitFor(async () => (await evaluate("document.body.innerText")).includes("Seleccionar Nivel"), "Level selector did not open.");

  await evaluate(`localStorage.setItem("tlm_profile", JSON.stringify({ schemaVersion: 2, unlockedLevels: [1, 2, 5] }))`);
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
  await captureScreenshot("02-level-start-390x844");

  let functionalShotIndex = 0;
  const playFunctionalShot = async (label, desiredSpin) => {
    functionalShotIndex += 1;
    const capturePrimaryShot = functionalShotIndex === 1;
    const selector = `[aria-label="${label}"]`;
    const keeperBefore = await evaluate(`(() => {
      const image = document.querySelector('img[alt="Portero"]');
      const keeper = image?.parentElement;
      if (!keeper) return null;
      const rect = keeper.getBoundingClientRect();
      return { centerX: rect.left + rect.width / 2, left: keeper.style.left };
    })()`);
    await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
    await waitFor(async () => (await evaluate(`document.querySelectorAll('[aria-label^="Responder "]').length`)) > 0, "Math challenge did not render.");
    if (capturePrimaryShot) await captureScreenshot("03-math-challenge-390x844");
    await solveMultiplication();
    await waitFor(async () => Boolean(await evaluate(`Boolean(document.querySelector('[data-spin-control="true"]'))`)), "Spin control did not render after math.");
    await evaluate(`document.querySelector('[data-spin-control="true"]').focus()`);
    await pressControlKey("End", "End", 35);
    await waitFor(
      async () => Number(await evaluate(`document.querySelector('[data-selected-spin]')?.dataset.selectedSpin`)) === 1,
      "End did not move the spin control to its maximum.",
    );
    await pressControlKey("Home", "Home", 36);
    await waitFor(
      async () => Number(await evaluate(`document.querySelector('[data-selected-spin]')?.dataset.selectedSpin`)) === -1,
      "Home did not move the spin control to its minimum.",
    );
    await pressControlKey("ArrowRight", "ArrowRight", 39);
    await waitFor(
      async () => Number(await evaluate(`document.querySelector('[data-selected-spin]')?.dataset.selectedSpin`)) === -0.9,
      "ArrowRight did not adjust the spin control.",
    );
    await evaluate(`(() => {
      const input = document.querySelector('[data-spin-control="true"]');
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
      setValue.call(input, ${JSON.stringify(desiredSpin)});
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    })()`);
    await waitFor(
      async () => Number(await evaluate(`document.querySelector('[data-selected-spin]')?.dataset.selectedSpin`)) === desiredSpin,
      "Selected spin did not reach game state.",
    );
    let powerObserved = false;
    const destination = await waitFor(async () => await evaluate(`(() => {
      const power = /PRECISIÓN|CURVA|TURBO|PERFECTO|PODER|PERFECTA/i.test(document.body.innerText);
      const marker = document.querySelector('.goal-target-zone[aria-pressed="true"]');
      if (power) window.__tlmPowerObserved = true;
      if (!marker) return null;
      const rect = marker.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, power };
    })()`), "Shot destination marker did not render.", 6_000);
    powerObserved = Boolean(destination.power) || Boolean(await evaluate("window.__tlmPowerObserved === true"));
    if (capturePrimaryShot) await captureScreenshot("04-math-power-curve-390x844");
    await evaluate(`document.querySelector('[aria-label^="Disparar a la coordenada"]')?.click()`);
    const flightLayers = await waitFor(async () => await evaluate(`(() => {
      const powerTrail = document.querySelector('.shot-power-trail');
      const velocityCore = document.querySelector('.shot-velocity-core');
      const trajectoryBlur = document.querySelector('.shot-trajectory-blur');
      if (!powerTrail || !velocityCore || !trajectoryBlur) return null;
      return {
        powerTrailPoints: powerTrail.querySelector('polyline')?.getAttribute('points')?.length ?? 0,
        velocityCore: true,
        trajectoryBlurDots: trajectoryBlur.querySelectorAll('span').length,
      };
    })()`), "Shot visual flight layers did not render.", 6_000);
    if (capturePrimaryShot) await captureScreenshot("05-flight-390x844");
    const keeperDuring = await waitFor(async () => await evaluate(`(() => {
      const marker = document.querySelector('.shot-destination-marker');
      const image = document.querySelector('img[alt="Portero"]');
      const keeper = image?.parentElement;
      if (!marker || !keeper) return null;
      const rect = keeper.getBoundingClientRect();
      const visualX = Number(keeper.dataset.keeperVisualX);
      const visualY = Number(keeper.dataset.keeperVisualY);
      const snapshotX = Number(document.querySelector('[data-shot-keeper-x]')?.dataset.shotKeeperX);
      const snapshotY = Number(document.querySelector('[data-shot-keeper-y]')?.dataset.shotKeeperY);
      const shotSpin = Number(document.querySelector('[data-shot-spin]')?.dataset.shotSpin);
      return { centerX: rect.left + rect.width / 2, centerY: rect.top + rect.height / 2, left: keeper.style.left, top: keeper.style.top, visualX, visualY, snapshotX, snapshotY, shotSpin };
    })()`), "Keeper snapshot position was not visible during flight.", 6_000);
    assert(keeperBefore && keeperDuring, "Keeper position could not be measured.");
    assert(Number.isFinite(keeperDuring.visualX) && Number.isFinite(keeperDuring.snapshotX), `Keeper snapshot data was not exposed during flight: ${JSON.stringify(keeperDuring)}.`);
    assert(Math.abs(keeperDuring.visualX - keeperDuring.snapshotX) <= 0.001, `Keeper visual and physical snapshots diverged: ${keeperDuring.visualX} != ${keeperDuring.snapshotX}.`);
    assert(Number.isFinite(keeperDuring.visualY) && Number.isFinite(keeperDuring.snapshotY), `Keeper vertical snapshot data was not exposed during flight: ${JSON.stringify(keeperDuring)}.`);
    assert(Math.abs(keeperDuring.visualY - keeperDuring.snapshotY) <= 0.001, `Keeper visual and physical Y snapshots diverged: ${keeperDuring.visualY} != ${keeperDuring.snapshotY}.`);
    assert(Math.abs(keeperDuring.shotSpin - desiredSpin) <= 0.001, `Selected spin was not persisted in the shot: ${keeperDuring.shotSpin} != ${desiredSpin}.`);
    const trailDots = await waitFor(async () => {
      const count = await evaluate(`document.querySelectorAll('.shot-trajectory-blur span').length`);
      return count > 0 ? count : false;
    }, "Shot trajectory blur did not render.", 6_000);
    const impactObserved = await waitFor(
      async () => Boolean(await evaluate("Boolean(document.querySelector('.shot-microimpact') && document.querySelector('.shot-impact-burst'))")),
      "Shot microimpact did not render.",
      6_000,
    );
    if (capturePrimaryShot) await captureScreenshot("06-impact-390x844");
    await waitFor(
      async () => /¡GOL!|¡Atajada!|¡Bloqueado!|¡Afuera!/.test(await evaluate("document.body.innerText")),
      "Shot did not reach a result.",
      8_000,
    );
    if (capturePrimaryShot) await captureScreenshot("07-result-390x844");
    return { destination, trailDots, flightLayers, impactObserved, powerObserved, keeperBefore, keeperDuring };

  };

  const firstShot = await playFunctionalShot(coordinateLabels[0], 0.8);
  assert(firstShot.trailDots > 0, "First shot trajectory blur was not observed during flight.");
  await evaluate(`document.querySelector('[aria-label="Continuar al siguiente tiro"]').focus()`);
  await pressEnter();
  await waitFor(async () => (await evaluate(`document.querySelectorAll('[aria-label^="Apuntar a coordenada"]:not([disabled])').length`)) > 0, "Next shot did not unlock.");

  const secondShot = await playFunctionalShot(coordinateLabels.at(-1), -0.8);
  const aimDistance = Math.hypot(firstShot.destination.x - secondShot.destination.x, firstShot.destination.y - secondShot.destination.y);
  assert(aimDistance > 24, `Different aim cells collapsed to nearly the same visual destination: ${aimDistance.toFixed(1)}px.`);
  assert(secondShot.trailDots > 0, "Second shot trajectory blur was not observed during flight.");
  assert(firstShot.powerObserved && secondShot.powerObserved, "Math Power feedback was not observed for both shots.");
  await evaluate(`document.querySelector('[aria-label="Continuar al siguiente tiro"]').focus()`);
  await pressEnter();
  await waitFor(async () => (await evaluate(`document.querySelectorAll('[aria-label^="Apuntar a coordenada"]:not([disabled])').length`)) > 0, "Second shot did not unlock the next attempt.");
  await evaluate(`document.querySelector('[aria-label="Volver a seleccionar nivel"]').click()`);
  await waitFor(async () => (await evaluate("document.body.innerText")).includes("Seleccionar Nivel"), "Could not open level selector for wall verification.");
  await evaluate(`document.querySelector('[aria-label^="Jugar nivel 5:"]').click()`);
  await waitFor(async () => (await evaluate(`document.querySelectorAll('[aria-label^="Apuntar a coordenada"]:not([disabled])').length`)) >= 49, "Level 5 gameplay did not render for wall verification.");
  const wallPreviewState = await evaluate(`(() => ({
    container: Boolean(document.querySelector('[data-free-kick-wall="true"]')),
    players: document.querySelectorAll('[data-wall-player]').length,
  }))()`);
  assert(wallPreviewState.container && wallPreviewState.players >= 3, `Level 5 free-kick wall did not render: ${JSON.stringify(wallPreviewState)}.`);
  const masteryAfterShots = await evaluate(`(() => {
    const profile = JSON.parse(localStorage.getItem("tlm_profile") || "{}");
    return profile.masteryByDomain || {};
  })()`);
  assert(Object.values(masteryAfterShots).some((domain) => domain && domain.attempts >= 2), "Persistent mastery did not record the functional shots.");

  await evaluate(`localStorage.setItem("tlm_profile", JSON.stringify({ schemaVersion: 2, name: "Martín", missionProgress: 2, missionCompletions: 0, unlockedLevels: [1, 2, 5] }))`);
  await reload();
  await clickButtonContaining("Ritmo de\npartido");
  await evaluate(`[...document.querySelectorAll("button")].find((el) => el.textContent.includes("JUGAR")).focus()`);
  await pressEnter();
  await waitFor(async () => (await evaluate("document.body.innerText")).includes("Seleccionar Nivel"), "Level selector did not open for mission flow.");
  await evaluate(`document.querySelector('[aria-label^="Jugar nivel 5:"]').click()`);
  const wallState = await waitFor(async () => await evaluate(`(() => {
    const players = [...document.querySelectorAll("[data-wall-player]")];
    if (players.length !== 3) return null;
    return players.map((player) => ({
      x: Number(player.dataset.wallX),
      y: Number(player.dataset.wallY),
      radius: Number(player.dataset.wallRadius),
      width: player.getBoundingClientRect().width,
      height: player.getBoundingClientRect().height,
    }));
  })()`), "Level 5 did not render its three-player wall.");
  assert(wallState.every((player) => Number.isFinite(player.x) && Number.isFinite(player.y) && player.radius > 0 && player.width > 0 && player.height > 0), `The visible wall is not aligned with physics data: ${JSON.stringify(wallState)}.`);
  await evaluate(`document.querySelector('[aria-label="Volver a seleccionar nivel"]').click()`);
  await waitFor(async () => (await evaluate("document.body.innerText")).includes("Seleccionar Nivel"), "Could not return from the wall level.");
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

  await evaluate(`document.querySelector('[aria-label="Volver a seleccionar nivel"]').click()`);
  await waitFor(async () => (await evaluate("document.body.innerText")).includes("Seleccionar Nivel"), "Could not return to level select.");
  await evaluate(`document.querySelector('[aria-label="Volver al inicio"]').click()`);
  await waitFor(async () => (await evaluate("document.body.innerText")).includes("TIRO LIBRE"), "Could not return to home.");
  await clickButtonContaining("Logros");
  await waitFor(async () => (await evaluate("document.body.innerText")).includes("Mi Progreso"), "Progress screen did not open.");
  const progressState = await evaluate(`(() => {
    const text = document.body.innerText;
    return {
      hasMasteryHeading: text.includes("Tu dominio del balón"),
      hasTables: text.includes("Tablas"),
      hasCoordinates: text.includes("Coordenadas"),
      hasAngles: text.includes("Ángulos y trayectorias"),
      hasVelocity: text.includes("Velocidad y distancia"),
    };
  })()`);
  assert(Object.values(progressState).every(Boolean), "Progress screen is missing one or more persistent concept domains.");
  await evaluate(`document.querySelector('[aria-label="Volver al inicio"]').click()`);
  await waitFor(async () => (await evaluate("document.body.innerText")).includes("TIRO LIBRE"), "Could not return home before reset.");
  await clickButtonContaining("Perfil");
  await waitFor(async () => (await evaluate("document.body.innerText")).includes("Mi Perfil"), "Profile screen did not open.");
  await evaluate(`window.confirm = () => true; [...document.querySelectorAll("button")].find((button) => button.textContent.includes("Resetear progreso"))?.click()`);
  await waitFor(async () => (await evaluate("document.body.innerText")).includes("⚽ JUGAR"), "Confirmed reset did not return to home.");
  const resetState = await evaluate(`({ profile: localStorage.getItem("tlm_profile"), pace: localStorage.getItem("tlm_game_pace") })`);
  assert(resetState.profile === null && resetState.pace === null, `Confirmed reset left V9 storage keys behind: ${JSON.stringify(resetState)}.`);
  await cdp.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  await reload();
  await waitFor(async () => (await evaluate("document.body.innerText")).includes("⚽ JUGAR"), "Reduced-motion reload did not return home.");
  const reducedMotion = await evaluate(`(() => {
    const probe = document.createElement("div");
    probe.className = "shot-microimpact";
    document.body.appendChild(probe);
    const style = getComputedStyle(probe);
    const result = { animationName: style.animationName, animationDuration: style.animationDuration, transitionDuration: style.transitionDuration };
    probe.remove();
    return result;
  })()`);
  assert(reducedMotion.animationName === "none", `Reduced-motion impact animation remained active: ${JSON.stringify(reducedMotion)}.`);

  const accessibilityIssues = await evaluate(`(() => {
    const liveTexts = [...document.querySelectorAll("[aria-live]")].map((el) => el.textContent.trim()).filter(Boolean);
    return {
      unnamedButtons: [...document.querySelectorAll("button")].filter((el) => !el.disabled && !(el.getAttribute("aria-label") || el.textContent.trim())).length,
      imagesWithoutAlt: [...document.querySelectorAll("img")].filter((el) => !el.hasAttribute("alt")).length,
      duplicateLiveAnnouncements: liveTexts.length - new Set(liveTexts).size,
      viewportWidth: innerWidth,
      contentWidth: document.documentElement.scrollWidth,
    };
  })()`);
  assert(accessibilityIssues.unnamedButtons === 0, "An enabled button has no accessible name.");
  assert(accessibilityIssues.imagesWithoutAlt === 0, "An image has no alt attribute.");
  assert(accessibilityIssues.duplicateLiveAnnouncements === 0, "Duplicate aria-live announcements were detected.");
  assert(accessibilityIssues.contentWidth <= accessibilityIssues.viewportWidth + 1, "Functional flow overflows the mobile viewport.");
  const performanceMetrics = await cdp.send("Performance.getMetrics");
  const jsHeapUsed = performanceMetrics.metrics.find((metric) => metric.name === "JSHeapUsedSize")?.value ?? 0;
  const runtimeErrors = cdp.events.filter((event) => event.method === "Runtime.exceptionThrown");
  assert(runtimeErrors.length === 0, `Runtime exceptions detected: ${runtimeErrors.length}.`);
  console.log(JSON.stringify({ status: "passed", checks: ["pace persistence", "level navigation", "keeper scale", "keeper snapshot", "math answer", "math power", "shot trail", "shot visual layers", "shot impact burst", "shot destination separation", "shot result", "next shot", "visible level 5 wall", "mastery persistence", "mission reward", "progress domains", "confirmed reset", "reduced motion", "accessibility"], firstShot, secondShot, aimDistance, wallState, masteryAfterShots, missionState, progressState, resetState, reducedMotion, accessibilityIssues, jsHeapUsed }, null, 2));
} finally {
  cdp?.close();
  await stopProcess(chrome);
  await stopProcess(server);
  rmSync(profileDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
