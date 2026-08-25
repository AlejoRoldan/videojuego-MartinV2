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
    await waitFor(async () => /¡GOL!|¡Atajó!|¡Barrera!|¡Al palo!|¡Travesaño!|¡Afuera!|Faltó fuerza|PARTIDO \d+ COMPLETADO|ETAPA \d+ SUPERADA/.test(await evaluate("document.body.innerText")), "Shot did not reach a result", 12_000);
  };

  await cdp.send("Page.navigate", { url: APP_URL });
  await waitFor(async () => (await evaluate("document.readyState")) === "complete", "V10 demo did not load");
  await waitFor(async () => await evaluate("Boolean(document.querySelector('[data-v10-gesture-demo]'))"), "V10 game surface was not found");
  await evaluate("localStorage.clear()");
  await reload();

  const initial = await evaluate(`(() => ({
    text: document.body.innerText,
    welcome: Boolean(document.querySelector('[data-v12-welcome]')),
    overflow: document.documentElement.scrollWidth - innerWidth,
    unnamedButtons: [...document.querySelectorAll('button')].filter((button) => !button.disabled && !(button.getAttribute('aria-label') || button.textContent.trim())).length,
  }))()`);
  assert(initial.welcome, "Phase 13 welcome did not open for a new player.");
  assert(initial.text.includes("FASE 13") && initial.text.includes("APRENDE · REMATA · COMPARTE"), "Phase 13 campaign promise is missing.");
  assert(initial.text.includes("Calcula") && initial.text.includes("Desliza") && initial.text.includes("Curva"), "Three-step tutorial is incomplete.");
  assert(initial.text.includes("JUGAR · CANCHA DEL BARRIO") && initial.text.includes("COMPETIR CON AMIGOS"), "Phase 13 mode choices are missing.");
  assert(initial.text.includes("PRIMER SILBATAZO") && initial.text.includes("TABLA DEL 2"), "Campaign learning focus is missing.");
  assert(initial.text.includes("Tiro 1/5") && initial.text.includes("0/2 GOLES"), "Initial match scoreboard is incorrect.");
  assert(initial.overflow <= 1, `Mobile layout overflows by ${initial.overflow}px.`);
  assert(initial.unnamedButtons === 0, "An enabled button has no accessible name.");

  const mapOpened = await evaluate(`(() => {
    const button = [...document.querySelectorAll('button')].find((item) => item.textContent.includes('VER MAPA Y ESTADIOS'));
    if (!button) return false;
    button.click();
    return true;
  })()`);
  assert(mapOpened, "Campaign map entry was not available.");
  const mapState = await waitFor(async () => await evaluate(`(() => {
    const map = document.querySelector('[data-campaign-map]');
    return map ? { text: map.innerText, locked: [...map.querySelectorAll('button')].filter((button) => button.disabled).length } : null;
  })()`), "Campaign map did not open.");
  assert(mapState.text.includes("Cancha del barrio") && mapState.text.includes("Gran final"), "Campaign map does not show all stadiums.");
  assert(mapState.locked >= 4, "Later campaign stages should start locked.");
  await evaluate(`document.querySelector('[aria-label="Cerrar mapa de campaña"]')?.click()`);

  const soloStarted = await evaluate(`(() => {
    const button = [...document.querySelectorAll('button')].find((item) => item.textContent.includes('JUGAR · CANCHA DEL BARRIO'));
    if (!button) return false;
    button.click();
    return localStorage.getItem('tlm_v12_welcome_seen') === 'true';
  })()`);
  assert(soloStarted, "Solo mode did not dismiss and persist the welcome choice.");
  await waitFor(async () => await evaluate("!document.querySelector('[data-v12-welcome]')"), "Welcome did not close after choosing solo play.");

  const muted = await evaluate(`(() => {
    const button = document.querySelector('[aria-label="Silenciar sonido"]');
    if (!button) return false;
    button.click();
    return localStorage.getItem('tlm_v10_sound_enabled') === 'false';
  })()`);
  assert(muted, "Sound preference could not be muted.");
  await reload();
  assert(await evaluate(`Boolean(document.querySelector('[aria-label="Activar sonido"]'))`), "Muted sound preference was not restored.");
  await evaluate(`document.querySelector('[aria-label="Activar sonido"]')?.click()`);

  await solveCurrentQuestion();
  await completeKeyboardShot();
  const firstRound = await evaluate(`JSON.parse(localStorage.getItem('tlm_v10_multiplication_progress_v2') || localStorage.getItem('tlm_v10_multiplication_progress_v1') || 'null')`);
  const firstMatchShot = await evaluate(`JSON.parse(localStorage.getItem('tlm_v10_match_mission_v1') || 'null')`);
  assert(firstRound?.tracks?.["tables-2-5"]?.roundsCompleted === 1, "Completed round was not persisted.");
  assert(firstMatchShot?.shots?.length === 1, "Completed shot was not added to the match mission.");
  await reload();
  const restoredRound = await evaluate(`JSON.parse(localStorage.getItem('tlm_v10_multiplication_progress_v2') || 'null')?.tracks?.['tables-2-5']?.roundsCompleted`);
  assert(restoredRound === 1, "Persisted multiplication progress was not restored after reload.");
  assert((await evaluate("document.body.innerText")).includes("Tiro 2/5"), "Match mission was not restored after reload.");

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
    localStorage.setItem('tlm_v13_campaign_progress_v1', JSON.stringify({
      version: 1,
      currentStageId: 'juvenil',
      highestUnlockedIndex: 2,
      stages: {
        barrio: { bestStars: 2, matchesCompleted: 1 },
        escolar: { bestStars: 1, matchesCompleted: 1 }
      }
    }));
  })()`);
  await reload();
  const campaignState = await evaluate(`({ question: document.querySelector('#multiplication-question')?.textContent?.trim(), text: document.body.innerText })`);
  assert(campaignState.question?.startsWith("4 × "), `Campaign route selected ${campaignState.question} instead of the stage's table of 4.`);
  assert(campaignState.text.includes("Estadio juvenil") && campaignState.text.includes("CUARTOS DE FINAL"), "Restored campaign stage was not explained.");

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
    return { advancedUnlocked: progress?.advancedUnlocked, announcement: document.body.innerText.includes('NUEVO RETO: TABLAS 6–9') };
  })()`);
  assert(unlocked.advancedUnlocked === true, "Performance path did not unlock tables 6–9.");
  assert(unlocked.announcement === true, "Unlock celebration was not announced.");

  const continued = await evaluate(`(() => {
    const button = [...document.querySelectorAll('button')].find((item) => item.textContent.includes('SIGUIENTE RETO'));
    if (!button) return false;
    button.click();
    return true;
  })()`);
  assert(continued, "Next challenge button was not available after the result.");
  const continuedCampaign = await waitFor(async () => await evaluate(`(() => ({
    question: document.querySelector('#multiplication-question')?.textContent?.trim(),
    campaign: JSON.parse(localStorage.getItem('tlm_v13_campaign_progress_v1') || 'null')
  }))()`), "Campaign did not render the next challenge.");
  assert(continuedCampaign.question?.startsWith("4 × "), "Current stadium lost its table focus after continuing.");
  assert(continuedCampaign.campaign?.currentStageId === "juvenil", "Campaign stage was not preserved.");

  await evaluate(`localStorage.setItem('tlm_v10_match_mission_v1', JSON.stringify({
    version: 1,
    matchNumber: 7,
    shots: [
      { scored: true, firstTry: true },
      { scored: false, firstTry: true },
      { scored: false, firstTry: false },
      { scored: false, firstTry: false }
    ]
  }))`);
  await reload();
  await solveCurrentQuestion();
  await completeKeyboardShot();
  const matchResult = await evaluate(`(() => ({
    hasSummary: Boolean(document.querySelector('[data-match-summary]')),
    text: document.body.innerText,
    mission: JSON.parse(localStorage.getItem('tlm_v10_match_mission_v1') || 'null')
  }))()`);
  assert(matchResult.hasSummary, "Five completed shots did not open the match summary.");
  assert(await evaluate(`document.querySelector('[data-stadium-celebration]')?.getAttribute('data-stadium-celebration') === 'match'`), "Match celebration was not rendered.");
  assert(matchResult.text.includes("ETAPA 3 SUPERADA") && matchResult.text.includes("NUEVO ESTADIO: COPA DE LA CIUDAD"), "Campaign completion and unlock were not announced.");
  assert(matchResult.text.includes("AVANZAR A COPA DE LA CIUDAD"), "Campaign advance action was not offered.");
  assert(matchResult.mission?.shots?.length === 5, "Final match shot was not persisted.");
  const sharedMatch = await evaluate(`(() => {
    const button = [...document.querySelectorAll('button')].find((item) => item.textContent.includes('COMPARTIR MI PARTIDO'));
    if (!button) return false;
    button.click();
    return true;
  })()`);
  assert(sharedMatch, "Completed solo match did not offer a share action.");
  await waitFor(async () => (await evaluate("document.body.innerText")).includes("Resultado copiado"), "Solo match share feedback was not shown.");
  const campaignAdvanced = await evaluate(`(() => {
    const button = [...document.querySelectorAll('button')].find((item) => item.textContent.includes('AVANZAR A COPA DE LA CIUDAD'));
    if (!button) return false;
    button.click();
    return true;
  })()`);
  assert(campaignAdvanced, "Campaign advance button was not actionable.");
  const advancedStage = await waitFor(async () => await evaluate(`(() => {
    const mission = JSON.parse(localStorage.getItem('tlm_v10_match_mission_v1') || 'null');
    const campaign = JSON.parse(localStorage.getItem('tlm_v13_campaign_progress_v1') || 'null');
    return document.body.innerText.includes('Copa de la ciudad') && document.body.innerText.includes('Tiro 1/5') && mission?.matchNumber === 8 && mission?.shots?.length === 0 && campaign?.currentStageId === 'ciudad';
  })()`), "Campaign did not open the new stadium with a fresh match.");
  assert(advancedStage === true, "Advanced campaign state is inconsistent.");

  const mainMenu = await evaluate(`(() => {
    const button = document.querySelector('[aria-label="Abrir menú principal"]');
    if (!button) return null;
    button.click();
    return true;
  })()`);
  assert(mainMenu === true, "The main menu could not be reopened.");
  await waitFor(async () => await evaluate("Boolean(document.querySelector('[data-v12-welcome]'))"), "Main menu did not reopen the welcome.");
  const socialLobby = await evaluate(`(() => {
    const button = [...document.querySelectorAll('[data-v12-welcome] button')].find((item) => item.textContent.includes('COMPETIR CON AMIGOS'));
    if (!button) return false;
    button.click();
    return true;
  })()`);
  assert(socialLobby === true, "The social play entry could not be opened from the main menu.");
  await waitFor(async () => await evaluate("Boolean(document.querySelector('[data-lightning-lobby]'))"), "Lightning cup lobby did not open.");
  const lobbyState = await evaluate(`(() => ({
    text: document.body.innerText,
    names: [...document.querySelectorAll('[data-lightning-lobby] input[aria-label^="Nombre del jugador"]')].map((input) => input.value)
  }))()`);
  assert(lobbyState.text.includes("SALA EN VIVO") && lobbyState.text.includes("INICIAR COPA POR TURNOS"), "Social play setup is incomplete.");
  assert(lobbyState.names[0] === "Martín" && lobbyState.names[1] === "Amigo 1", "Safe default player names are missing.");

  await evaluate(`(() => {
    const room = {
      code: 'M4RT2N', seed: 'MIRR22', track: 'tables-2-5', status: 'waiting',
      hostPlayerId: 'player-1', shotsPerPlayer: 3, expiresAt: Date.now() + 7200000,
      players: [{ id: 'player-1', nickname: 'Martín', colorIndex: 0, shotsCompleted: 0, goals: 0, firstTryCorrect: 0, responseTimeMs: 0, score: 0 }]
    };
    window.fetch = async () => new Response(JSON.stringify({
      session: { roomCode: room.code, playerId: 'player-1', token: 'a'.repeat(40) }, room,
      ...room
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  })()`);
  await evaluate(`[...document.querySelectorAll('button')].find((button) => button.textContent.includes('CREAR SALA EN VIVO'))?.click()`);
  await waitFor(async () => await evaluate("Boolean(document.querySelector('[data-live-room-lobby]'))"), "Remote live room did not open.");
  const liveRoomState = await evaluate(`(() => ({
    text: document.body.innerText,
    session: JSON.parse(localStorage.getItem('tlm_v11_live_room_session_v1') || 'null')
  }))()`);
  assert(liveRoomState.text.includes("M4RT2N") && liveRoomState.text.includes("ESPERANDO A UN AMIGO"), "Remote waiting room is incomplete.");
  assert(liveRoomState.session?.roomCode === "M4RT2N" && liveRoomState.session?.token?.length === 40, "Remote room session was not stored.");
  await evaluate(`[...document.querySelectorAll('button')].find((button) => button.textContent.includes('COPIAR ENLACE DE LA SALA'))?.click()`);
  const sharedRoomText = await waitFor(async () => {
    const text = await evaluate(`document.querySelector('[data-live-room-lobby]')?.innerText || ''`);
    return text.includes("room=M4RT2N") ? text : false;
  }, "Remote room share link was not shown.");
  assert(sharedRoomText.includes("room=M4RT2N") && !sharedRoomText.includes("player-1") && !sharedRoomText.includes("aaaaaaaa"), "Shared room URL leaked credentials or omitted the code.");
  await evaluate(`[...document.querySelectorAll('button')].find((button) => button.textContent.includes('SALIR DE ESTA SALA'))?.click()`);
  await waitFor(async () => await evaluate("!document.querySelector('[data-live-room-lobby]')"), "Remote room did not close cleanly.");

  await evaluate(`[...document.querySelectorAll('button')].find((button) => button.textContent.includes('INICIAR COPA POR TURNOS'))?.click()`);
  await waitFor(async () => await evaluate("Boolean(document.querySelector('[data-lightning-scoreboard]'))"), "Lightning cup did not start.");
  const mirroredQuestion = await evaluate("document.querySelector('#multiplication-question')?.textContent?.trim()");
  await solveCurrentQuestion();
  await completeKeyboardShot();
  assert(await evaluate("Boolean(document.querySelector('[data-lightning-turn-result]'))"), "Lightning turn result was not rendered.");
  assert((await evaluate("document.body.innerText")).includes("SIGUE: AMIGO 1"), "The next player was not announced.");
  await evaluate(`[...document.querySelectorAll('button')].find((button) => button.textContent.includes('SIGUE AMIGO 1'))?.click()`);
  await waitFor(async () => await evaluate("Boolean(document.querySelector('#multiplication-question'))"), "Second lightning player did not receive a question.");
  assert(await evaluate("document.querySelector('#multiplication-question')?.textContent?.trim()") === mirroredQuestion, "Players did not receive the same question in the round.");
  const storedLightningCup = await evaluate(`JSON.parse(localStorage.getItem('tlm_v10_lightning_cup_v1') || 'null')`);
  assert(storedLightningCup?.shots?.length === 1 && storedLightningCup?.activePlayerIndex === 1, "Lightning cup turn was not persisted.");

  const runtimeErrors = cdp.events.filter((event) => event.method === "Runtime.exceptionThrown");
  assert(runtimeErrors.length === 0, `Runtime exceptions detected: ${runtimeErrors.length}.`);
  const metrics = await cdp.send("Performance.getMetrics");
  const jsHeapUsed = metrics.metrics.find((metric) => metric.name === "JSHeapUsedSize")?.value ?? 0;
  assert(jsHeapUsed < 100 * 1024 * 1024, `JavaScript heap exceeded 100MB: ${jsHeapUsed} bytes.`);

  console.log(JSON.stringify({
    status: "passed",
    checks: ["phase 13 welcome", "campaign map", "locked stadiums", "three-step tutorial", "mode choice persistence", "mobile layout", "accessible buttons", "sound preference", "match scoreboard", "math answer", "keyboard shot", "round persistence", "match persistence", "reload recovery", "stage table focus", "campaign recovery", "V1 migration", "advanced unlock", "unlock announcement", "five-shot completion", "stadium celebration", "stadium unlock", "solo result sharing", "campaign advance", "main menu", "social lobby", "safe player defaults", "remote room creation", "credential-safe sharing", "remote room exit", "multiplayer turn", "mirrored question", "lightning persistence", "runtime errors", "heap budget"],
    firstRound: firstRound.tracks["tables-2-5"],
    unlocked: { ...unlocked, campaignStage: continuedCampaign.campaign.currentStageId },
    jsHeapUsed,
  }, null, 2));
} finally {
  cdp?.close();
  await stopProcess(chrome);
  await stopProcess(server);
  rmSync(profileDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
