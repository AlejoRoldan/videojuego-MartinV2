import { LEAGUES, MODES, hint, label } from './core/math.mjs';
import { createMatch, reduceMatch, summary, currentQuestion, createCup, cupRanking } from './core/game.mjs';
import { FIELD, insideGoal } from './core/physics.mjs';
import { describeScenario, scenarioForMatch } from './core/scenarios.mjs';
import { ProfileStore, STORAGE_KEY, recordPractice } from './core/storage.mjs';
import { createRenderer } from './render.mjs';
import { shotFromDrag } from './core/gesture.mjs';
import { CHARGE_MIN, CHARGE_MAX, chargePower, perfectWindow, powerGrade } from './core/power.mjs';

const $ = id => document.getElementById(id);
const seed = () => crypto.getRandomValues(new Uint32Array(1))[0];
const node = (tag, text, className) => {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
};
const button = (text, handler, className = 'tab') => {
  const element = node('button', text, className); element.type = 'button'; element.addEventListener('click', handler); return element;
};
let storage;
try { storage = window.localStorage; } catch { storage = { getItem() { throw new Error('unavailable'); }, setItem() { throw new Error('unavailable'); } }; }
const repository = new ProfileStore(storage);
let state = repository.load();
state.match ||= createMatch({ seed: seed() });
let cup = null, cupMatch = null, blocked = false, frame = 0, sound = false, audioContext;
let drag = null, charge = null, visualFrame = 0, lastPaint = 0, resultAt = -10000;
let dialogCancel = null;
let dialogPurpose = '', feedback = '', lastPhase = '', restoreFocus = null;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const renderer = createRenderer($('game'));
const active = () => cupMatch || state.match;

function notice(text) { $('storageNotice').textContent = text; $('storageNotice').hidden = !text; }
function conflict() {
  blocked = true; cancelAnimationFrame(frame);
  notice('El progreso cambió en otra pestaña. Recarga esta página para continuar con la versión guardada.');
  render();
}
function persist(next = state) {
  if (blocked) return false;
  const saved = repository.save(next);
  if (saved.conflict) { conflict(); return false; }
  state = next;
  if (!saved.ok) notice('No se pudo guardar en este navegador. Puedes jugar, pero esta sesión puede perderse al cerrar.');
  else notice('');
  return true;
}
function tone(frequency, duration = .14) {
  if (!sound) return;
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    audioContext.resume().catch(() => {});
    const oscillator = audioContext.createOscillator(), gain = audioContext.createGain();
    oscillator.connect(gain); gain.connect(audioContext.destination); oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(.045, audioContext.currentTime); gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + duration);
    oscillator.start(); oscillator.stop(audioContext.currentTime + duration); oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  } catch { sound = false; $('sound').textContent = 'Sonido no disponible'; $('sound').setAttribute('aria-pressed', 'false'); }
}
function dispatch(event) {
  if (blocked) return;
  const before = active(), update = reduceMatch(before, event);
  if (!update.changed) return;
  if (cupMatch) cupMatch = update.match;
  else if (event.type === 'AIM') state = { ...state, match: update.match };
  else {
    let profile = state.profile;
    if (update.record) profile = recordPractice(profile, update.record);
    profile = { ...profile, xp: Math.min(1000000, profile.xp + update.reward) };
    if (update.match.phase === 'end' && update.match.kind === 'career') profile.best = Math.max(profile.best, summary(update.match).goals);
    if (!persist({ ...state, profile, match: update.match })) return;
  }
  const m = active(), q = currentQuestion(m);
  if (event.type === 'HINT') feedback = hint(q);
  else if (event.type === 'ANSWER') {
    feedback = m.phase === 'question' ? `Casi. ${hint(q)}` : `¡Correcto! ${label(q)} = ${q.answer}.${update.reward ? ` +${update.reward} XP.` : ''}`;
    tone(m.phase === 'question' ? 180 : 580);
  } else if (event.type === 'NEXT') feedback = '';
  else if (event.type === 'SHOOT') { feedback = 'Balón en juego…'; stadiumSound('kick'); }
  else if (event.type === 'FINISH') { resultAt = performance.now(); feedback = m.outcome.message; stadiumSound(m.outcome.goal ? 'goal' : m.outcome.type); }
  render(event.type === 'AIM');
  if (event.type === 'SHOOT') animate();
  if (m.phase !== before.phase && ['aim', 'result'].includes(m.phase)) {
    if (m.phase === 'aim') { $('game').focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: 'instant' }); }
    else $('resultTitle').focus({ preventScroll: true });
  }
}
function animate() {
  cancelAnimationFrame(frame);
  const match = active();
  if (match.phase !== 'flight' || blocked) return;
  if (reducedMotion.matches) { renderer.draw(match, 1, {reduced:true}); dispatch({type:'FINISH'}); return; }
  let start;
  const flightMs = (1150 - match.aim.power * 4) * match.outcome.stop;
  function tick(now) {
    if (active() !== match || blocked) return;
    start ??= now;
    const elapsed = now - start;
    const fraction = Math.min(1, Math.max(0, elapsed - 280) / flightMs);
    renderer.draw(match, fraction, {time:now, windup:Math.min(1,elapsed/280)});
    if (fraction < 1) frame = requestAnimationFrame(tick);
    else dispatch({type:'FINISH'});
  }
  frame = requestAnimationFrame(tick);
}
function ambient(now) {
  if (now-lastPaint >= 33 && !document.hidden && !blocked && !$('modal').open && active().phase !== 'flight') {
    lastPaint=now;
    const m=active();
    renderer.draw(m, ['result','end'].includes(m.phase)?1:0, {time:now,resultAge:now-resultAt,reduced:reducedMotion.matches});
  }
  visualFrame=requestAnimationFrame(ambient);
}
function stadiumSound(type) {
  if (!sound) return;
  tone(type==='kick'?90:type==='goal'?520:145, .18);
  try {
    const duration=type==='goal'?1.6:type==='kick'?.12:.28;
    const buffer=audioContext.createBuffer(1,Math.floor(audioContext.sampleRate*duration),audioContext.sampleRate);
    const samples=buffer.getChannelData(0);
    for(let i=0;i<samples.length;i++)samples[i]=(Math.random()*2-1)*Math.sin(Math.PI*i/samples.length);
    const source=audioContext.createBufferSource(),filter=audioContext.createBiquadFilter(),gain=audioContext.createGain();
    source.buffer=buffer;filter.type='lowpass';filter.frequency.value=type==='goal'?1700:700;gain.gain.value=type==='goal'?.10:.15;
    source.connect(filter);filter.connect(gain);gain.connect(audioContext.destination);source.start();
    source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};
    if(type==='goal'){tone(660,.45);tone(780,.65);}
  } catch { /* Audio is optional; gameplay remains available. */ }
}
function stat(value, description) {
  const box = node('div'); box.append(node('b', String(value)), node('span', description)); return box;
}
function render(aimOnly = false) {
  const m = active();
  const scene = scenarioForMatch(m);
  if (aimOnly) { renderAim(m); renderer.draw(m); return; }
  document.body.dataset.phase = m.phase;
  $('playerName').textContent = cup ? cup.aliases[cup.turn] || 'Copa con amigos' : 'Tu carrera';
  $('rank').textContent = cup ? 'Copa local · por turnos' : `Nivel ${1 + Math.floor(state.profile.xp / 100)} · ${m.kind === 'review' ? 'Repaso' : LEAGUES[m.league].name}`;
  $('xp').textContent = cup ? 'Sin XP de carrera' : `${state.profile.xp} XP`;
  $('stadium').textContent = LEAGUES[m.league].stadium;
  $('leagueTitle').textContent = cup ? `Turno ${cup.turn + 1} de ${cup.aliases.length}` : m.kind === 'review' ? 'Repaso de operaciones' : LEAGUES[m.league].name;
  const totals = summary(m);
  $('goals').textContent = totals.goals;
  $('shotLabel').textContent = m.phase === 'end' ? 'PARTIDO TERMINADO' : `TIRO ${m.index + 1} DE 5`;
  $('dots').replaceChildren(...Array.from({ length: 5 }, (_, i) => {
    const dot = node('i', undefined, i < m.results.length ? m.results[i].outcome.goal ? 'goal' : 'miss' : i === m.index ? 'current' : '');
    dot.setAttribute('aria-label', i < m.results.length ? `Tiro ${i + 1}: ${m.results[i].outcome.goal ? 'gol' : 'fallo'}` : `Tiro ${i + 1}: pendiente`); return dot;
  }));
  $('streak').textContent = `Racha de cálculo: ${m.streak}`;
  $('best').textContent = cup ? 'Mismas jugadas para todos' : `Récord: ${state.profile.best} goles`;
  $('sceneDescription').textContent = describeScenario(scene);
  const phaseTitle = { question: 'PREPARA LA JUGADA', aim: 'APUNTA Y DISPARA', flight: 'BALÓN EN JUEGO', result: 'REVISA TU JUGADA', end: 'FINAL DEL PARTIDO' };
  $('phaseTag').textContent = m.index === 4 && m.phase === 'aim' ? 'ÚLTIMO TIRO · HAZLO CONTAR' : phaseTitle[m.phase];
  $('gestureHint').hidden = m.phase !== 'aim';
  $('shotStyle').textContent = m.phase === 'result' && m.outcome.goal ? (Math.abs(m.aim.spin || 0) > .4 ? 'GOL CON EFECTO' : m.outcome.end.y < 250 ? 'A LA ESCUADRA' : 'BUENA DEFINICIÓN') : '';
  document.body.dataset.outcome = m.phase === 'result' ? m.outcome.type : '';
  $('stepNo').textContent = m.phase === 'question' ? '01' : m.phase === 'aim' ? '02' : '03';
  $('stepSmall').textContent = phaseTitle[m.phase];
  $('stepTitle').textContent = m.phase === 'question' ? 'Resuelve y prepara el tiro' : m.phase === 'aim' ? 'Busca un hueco' : m.phase === 'end' ? 'Tu partido, en números' : 'Una jugada más';
  for (const [id, phases] of [['questionPanel', ['question']], ['aimPanel', ['aim']], ['flightPanel', ['flight']], ['resultPanel', ['result', 'end']]]) $(id).hidden = !phases.includes(m.phase);
  $('feedback').textContent = feedback;
  $('celebration').textContent = m.phase === 'result' ? ({ goal: '¡GOLAZO!', save: '¡ATAJADA!', wall: 'BARRERA', out: 'FUERA' })[m.outcome.type] : m.phase === 'end' ? totals.goals >= 3 ? 'MISIÓN CUMPLIDA' : 'SIGUE ENTRENANDO' : '';
  $('missionLabel').textContent = cup ? 'COPA LOCAL' : m.kind === 'review' ? 'OBJETIVO DEL REPASO' : 'OBJETIVO DEL PARTIDO';
  $('missionText').textContent = cup ? 'Goles, luego aciertos sin ayuda' : m.kind === 'review' ? 'Entiende y vuelve a intentarlo' : 'Marca 3 goles en 5 tiros';
  $('missionReward').textContent = m.kind === 'career' ? '+60 XP al conseguirlo' : 'Esta ronda no suma XP a la carrera';
  const q = currentQuestion(m);
  $('equation').textContent = `${label(q)} = ?`;
  if (m.phase === 'question') {
    const focusedAnswer = document.activeElement?.dataset.answer;
    $('answers').replaceChildren(...q.options.map(value => {
      const option = button(String(value), () => dispatch({ type: 'ANSWER', value }));
      option.dataset.answer = String(value); option.setAttribute('aria-label', `Responder ${value}`);
      option.disabled = m.wrong.includes(value) || blocked; return option;
    }));
    if (focusedAnswer) document.querySelector(`[data-answer="${Number(focusedAnswer)}"]:not(:disabled)`)?.focus({ preventScroll: true });
  }
  $('hint').disabled = blocked || m.helped;
  $('hint').textContent = m.helped ? 'Pista activada' : 'Dame una pista';
  document.querySelectorAll('[data-mode]').forEach(b => { b.setAttribute('aria-pressed', String(b.dataset.mode === m.mode)); b.classList.toggle('active', b.dataset.mode === m.mode); b.disabled = !!cup || m.kind === 'review' || blocked; });
  renderAim(m);
  if (['result', 'end'].includes(m.phase)) {
    $('resultTitle').textContent = m.phase === 'end' ? totals.goals >= 3 ? '¡Objetivo cumplido!' : 'Buen entrenamiento.' : m.outcome.goal ? 'Así se define.' : 'Ajusta la próxima jugada.';
    $('resultText').textContent = m.phase === 'end' ? `${totals.goals} goles de 5.${m.kind === 'career' ? ` +${m.xp} XP en el partido.` : ''} ${totals.review.length ? 'Hay operaciones para repasar.' : 'Todo resuelto sin ayuda. ¡Gran trabajo!'}` : m.outcome.message;
    $('summaryStats').replaceChildren(); $('reviewList').replaceChildren();
    if (m.phase === 'end') {
      const card = node('div', undefined, 'scorecard'); card.append(stat(`${totals.clean}/5`, 'Sin ayuda'), stat(totals.assisted, 'Con ayuda'));
      $('summaryStats').append(card);
      totals.review.slice(0, 3).forEach(q => $('reviewList').append(node('li', `${label(q)} = ${q.answer}`)));
    }
    $('next').textContent = m.phase === 'end' ? cup ? 'CONTINUAR COPA →' : 'JUGAR OTRO PARTIDO →' : m.index === 4 ? 'VER RESULTADO →' : 'SIGUIENTE TIRO →';
    $('review').hidden = m.phase !== 'end' || !totals.review.length || !!cup;
  }
  $('intro').hidden = state.profile.tutorialSeen || m.phase !== 'question' || !!cup;
  $('journey').hidden = !!cup;
  const nextLeague = LEAGUES.find(l => state.profile.xp < l.xp);
  $('progressText').textContent = nextLeague ? `${nextLeague.xp - state.profile.xp} XP para ${nextLeague.name}` : 'Todas las ligas desbloqueadas. Mejora tu récord.';
  $('leagues').replaceChildren(...LEAGUES.map((l, i) => {
    const item = button('', () => changeTraining(i, m.mode), `league ${i === m.league ? 'active' : ''}`);
    item.append(node('small', state.profile.xp < l.xp ? `BLOQUEADA · ${l.xp} XP` : i === m.league ? 'ESTÁS AQUÍ' : 'DISPONIBLE'), node('b', l.name), node('p', `Tablas del ${l.min} al ${l.max} · Divisiones exactas`));
    item.disabled = state.profile.xp < l.xp || m.phase === 'flight' || blocked; return item;
  }));
  for (const id of ['shoot', 'next', 'review', 'cup', 'career', 'practice']) $(id).disabled = blocked || (m.phase === 'flight' && id !== 'shoot');
  $('shoot').disabled = blocked || m.phase !== 'aim';
  if (m.phase !== 'flight') renderer.draw(m, ['result', 'end'].includes(m.phase) ? 1 : 0);
  if (lastPhase !== m.phase) lastPhase = m.phase;
}
function renderAim(m) {
  $('aimX').value = m.aim.x; $('aimY').value = m.aim.y;
  $('aimValue').textContent = m.aim.x < 490 ? 'Izquierda' : m.aim.x > 610 ? 'Derecha' : 'Centro';
  $('heightValue').textContent = m.aim.y < 250 ? 'Alta' : m.aim.y > 325 ? 'Baja' : 'Media';
  $('spin').value = m.aim.spin || 0;
  $('spinValue').textContent = !m.aim.spin ? 'Recto' : m.aim.spin < 0 ? 'Izquierda' : 'Derecha';
  for (const id of ['aimX', 'aimY', 'spin']) $(id).disabled = blocked || m.phase !== 'aim';
  renderPower(m.aim.power, m);
}
function meterPosition(power) { return (power - CHARGE_MIN) / (CHARGE_MAX - CHARGE_MIN) * 100; }
function renderPower(power, match, charging = false) {
  const window = perfectWindow(match), grade = powerGrade(power, window);
  const position = meterPosition(power), start = meterPosition(window.min), end = meterPosition(window.max);
  $('powerValue').textContent = `${power}%`;
  $('powerFill').style.width = `${position}%`;
  $('powerNeedle').style.left = `${position}%`;
  $('perfectZone').style.left = `${start}%`;
  $('perfectZone').style.width = `${end - start}%`;
  $('powerMeter').setAttribute('aria-valuenow', String(power));
  $('powerMeter').setAttribute('aria-valuetext', `${power} por ciento, ${grade === 'perfect' ? 'zona perfecta' : grade === 'low' ? 'potencia baja' : grade === 'over' ? 'sobrepotencia' : 'potencia controlada'}`);
  $('powerControl').dataset.grade = grade;
  $('shoot').textContent = charging ? `SUELTA · ${power}%` : 'MANTÉN PARA CARGAR';
  $('shoot').classList.toggle('charging', charging);
}
function cancelCharge() {
  if (!charge) return;
  cancelAnimationFrame(charge.frame);
  charge = null;
  $('shoot').classList.remove('charging');
  if (active().phase === 'aim') renderPower(active().aim.power, active());
}
function startCharge(source, pointerId = null) {
  const m = active();
  if (charge || blocked || m.phase !== 'aim') return false;
  charge = { source, pointerId, startedAt: performance.now(), value: CHARGE_MIN, frame: 0 };
  const tick = now => {
    if (!charge || active().phase !== 'aim' || blocked) { cancelCharge(); return; }
    charge.value = chargePower(now - charge.startedAt);
    renderPower(charge.value, active(), true);
    charge.frame = requestAnimationFrame(tick);
  };
  renderPower(CHARGE_MIN, m, true);
  charge.frame = requestAnimationFrame(tick);
  return true;
}
function releaseCharge(source, pointerId = null) {
  if (!charge || charge.source !== source || (charge.pointerId !== null && charge.pointerId !== pointerId)) return false;
  const value = charge.value;
  cancelAnimationFrame(charge.frame);
  charge = null;
  const m = active(), grade = powerGrade(value, perfectWindow(m));
  dispatch({ type: 'AIM', value: { ...m.aim, power: value } });
  feedback = grade === 'perfect' ? `Potencia perfecta: ${value}%.` : grade === 'low' ? `Potencia baja: ${value}%.` : grade === 'over' ? `Sobrepotencia: ${value}%.` : `Potencia controlada: ${value}%.`;
  dispatch({ type: 'SHOOT' });
  return true;
}
function openDialog(title, purpose = 'normal') {
  if ($('modal').open) $('modal').close();
  restoreFocus = document.activeElement;
  document.body.toggleAttribute('data-private-turn', purpose === 'handoff');
  dialogCancel = null; dialogPurpose = purpose; $('modalTitle').textContent = title; $('modalBody').replaceChildren(); $('modalActions').replaceChildren();
  $('modal').showModal();
}
function closeDialog() { document.body.removeAttribute('data-private-turn'); $('modal').close(); dialogPurpose = ''; restoreFocus?.focus?.({ preventScroll: true }); }
function confirmAction(title, text, action, onCancel = () => {}) {
  openDialog(title); dialogCancel = onCancel; $('modalBody').append(node('p', text));
  $('modalActions').append(button('Seguir jugando', () => { closeDialog(); onCancel(); }), button('Confirmar', () => { closeDialog(); action(); }, 'primary'));
}
function abandonThen(action) {
  if (cup) { confirmAction('¿Salir de la copa?', 'Se descartarán los turnos, resultados y apodos de esta copa.', () => { cup = null; cupMatch = null; feedback = ''; action(); }, () => { if (cup?.phase === 'handoff') showHandoff(); else if (cup?.phase === 'end') showCupResults(); }); return; }
  const m = state.match;
  if (m.phase !== 'end' && (m.index > 0 || m.phase !== 'question' || m.helped || m.wrong.length)) confirmAction('¿Empezar otro partido?', 'Conservarás el XP ganado. El partido y su resumen actual se descartarán.', action);
  else action();
}
function changeTraining(league, mode) {
  if (blocked || !LEAGUES[league] || !MODES.includes(mode) || state.profile.xp < LEAGUES[league].xp) return;
  abandonThen(() => {
    if (persist({ ...state, match: createMatch({ league, mode, seed: seed() }) })) { feedback = ''; render(); }
  });
}
function startReview(questions, mode = state.match.mode) {
  const filtered = questions.filter(q => mode === 'mixed' || q.mode === mode);
  if (!filtered.length) return;
  closeDialog();
  abandonThen(() => { if (persist({ ...state, match: createMatch({ league: state.match.league, mode, seed: seed(), kind: 'review', review: filtered }) })) { feedback = 'Repaso: practica sin presión y sin sumar XP.'; render(); } });
}
function showPractice() {
  openDialog('Mi práctica');
  $('modalBody').append(node('p', 'El cálculo y los goles cuentan cosas distintas. Aquí ves tus operaciones practicadas en este navegador.'));
  const select = node('select'); select.id = 'practiceMode';
  for (const [value, text] of [['mixed', 'Todas'], ['multiply', 'Multiplicación'], ['divide', 'División']]) { const option = node('option', text); option.value = value; select.append(option); }
  const filterLabel = node('label', 'Tipo de operación'); filterLabel.htmlFor = select.id; $('modalBody').append(filterLabel, select);
  const list = node('div'); $('modalBody').append(list);
  const update = () => {
    const entries = Object.values(state.profile.practice).filter(e => select.value === 'mixed' || e.question.mode === select.value).sort((a, b) => b.helped / b.attempts - a.helped / a.attempts);
    list.replaceChildren(); $('modalActions').replaceChildren();
    if (!entries.length) list.append(node('p', 'Todavía no hay operaciones de este tipo. Juega un partido para empezar.'));
    for (const e of entries.slice(0, 12)) {
      const row = node('div', undefined, 'practice-item'); row.append(node('b', `${label(e.question)} · En práctica`), node('p', `${e.attempts} rondas · ${e.clean} sin ayuda · ${e.helped} con ayuda · ${e.errors} errores`)); list.append(row);
    }
    if (entries.length > 12) list.append(node('p', `Mostrando 12 de ${entries.length}, priorizadas por uso de ayuda.`));
    const needs = entries.filter(e => e.helped > 0).map(e => e.question);
    if (needs.length) $('modalActions').append(button('Repasar operaciones', () => startReview(needs, select.value), 'primary'));
    else if (entries.length) list.append(node('p', 'Todo resuelto sin ayuda. Puedes jugar otro partido.'));
  };
  select.addEventListener('change', update); update();
}
function showCupSetup() {
  openDialog('Copa con amigos');
  $('modalBody').append(node('p', 'De 2 a 4 jugadores, por turnos en este dispositivo. Todos reciben las mismas cinco operaciones y escenarios. Sin XP de carrera.'));
  const inputs = [];
  for (let i = 0; i < 4; i++) {
    const input = node('input'); input.id = `alias${i}`; input.maxLength = 12; input.autocomplete = 'off'; input.placeholder = i < 2 ? 'Apodo' : 'Opcional'; input.spellcheck = false;
    const l = node('label', `Jugador ${i + 1}${i > 1 ? ' (opcional)' : ''}`); l.htmlFor = input.id; $('modalBody').append(l, input); inputs.push(input);
  }
  const mode = node('select'); mode.id = 'cupMode';
  for (const [value, title] of [['multiply', 'Multiplicación'], ['divide', 'División'], ['mixed', 'Mixto']]) { const option = node('option', title); option.value = value; mode.append(option); }
  const l = node('label', 'Operaciones'); l.htmlFor = mode.id; $('modalBody').append(l, mode);
  const error = node('p', '', 'dialog-error'); error.setAttribute('role', 'alert'); $('modalBody').append(error);
  $('modalActions').append(button('CREAR COPA', () => {
    try {
      if (!inputs[0].value.trim() || !inputs[1].value.trim()) throw new Error('Escribe al menos los apodos de los jugadores 1 y 2.');
      cup = createCup(inputs.map(i => i.value).filter(x => x.trim()), mode.value, seed());
      inputs.forEach(i => { i.value = ''; }); closeDialog(); showHandoff();
    } catch (e) { error.textContent = e.message; }
  }, 'primary'));
  inputs[0].focus();
}
function showHandoff() {
  cup.phase = 'handoff'; cupMatch = null;
  openDialog(`Turno de ${cup.aliases[cup.turn]}`, 'handoff');
  $('modalBody').append(node('p', 'Pasa el dispositivo. Tendrás cinco tiros. Pulsa cuando estés listo; la partida anterior no aparecerá en tu turno.'));
  $('modalActions').append(button('ESTOY LISTO', () => {
    cupMatch = createMatch({ mode: cup.mode, kind: 'cup', plan: cup.plan }); cup.phase = 'playing'; feedback = ''; closeDialog(); render(); window.scrollTo({ top: 0, behavior: 'instant' });
  }, 'primary'));
}
function finishCupTurn() {
  if (!cup || cup.phase !== 'playing' || cupMatch?.phase !== 'end') return;
  const totals = summary(cupMatch);
  cup.scores.push({ alias: cup.aliases[cup.turn], goals: totals.goals, clean: totals.clean });
  cupMatch = null;
  if (++cup.turn < cup.aliases.length) showHandoff();
  else { cup.phase = 'end'; showCupResults(); }
}
function showCupResults() {
  openDialog('Resultado de la copa', 'cupResults');
  const rankings = cupRanking(cup.scores), winners = rankings.filter(r => r.rank === 1);
  $('modalBody').append(node('p', winners.length > 1 ? `¡Empate! ${winners.map(r => r.alias).join(' y ')} comparten el primer puesto.` : `¡${winners[0].alias} gana la copa!`));
  const table = node('table'), caption = node('caption', 'Goles primero; después, aciertos sin ayuda.'), head = node('thead'), hr = node('tr');
  ['Puesto', 'Apodo', 'Goles', 'Sin ayuda'].forEach(t => { const th = node('th', t); th.scope = 'col'; hr.append(th); }); head.append(hr);
  const body = node('tbody'); rankings.forEach(r => { const row = node('tr'); [r.rank, r.alias, r.goals, r.clean].forEach(v => row.append(node('td', String(v)))); body.append(row); });
  table.append(caption, head, body); $('modalBody').append(table);
  $('modalActions').append(button('Cerrar copa', () => { cup = null; cupMatch = null; closeDialog(); feedback = ''; render(); }), button('REVANCHA', () => { cup = createCup(cup.aliases, cup.mode, seed()); closeDialog(); showHandoff(); }, 'primary'));
}
async function share() {
  openDialog('Comparte GOL LAB');
  const url = new URL(location.pathname, location.origin).href;
  $('modalBody').append(node('p', 'Envía este enlace a tus amigos. Si pide acceso, el propietario debe habilitarlo antes de la prueba. Compartir el enlace no cambia los permisos.'));
  const a = node('a', url, 'share-link'); a.href = url; $('modalBody').append(a);
  const status = node('p'); status.setAttribute('role', 'status'); $('modalBody').append(status);
  $('modalActions').append(button('Copiar enlace', async () => {
    try { await navigator.clipboard.writeText(url); status.textContent = 'Enlace copiado.'; }
    catch { status.textContent = 'No se pudo copiar automáticamente. Mantén pulsado o selecciona el enlace de arriba.'; }
  }, 'primary'));
}
$('help').addEventListener('click', () => {
  openDialog('Resuelve, apunta y dispara');
  for (const text of ['1. Resuelve la operación. Puedes pensar sin reloj y pedir una pista.', '2. Arrastra desde el balón hasta un rincón o toca el arco para definir el destino.', '3. Ajusta altura y efecto. Después mantén pulsado Disparar y suelta dentro de la zona verde. Con teclado: flechas para apuntar y mantener/soltar espacio para cargar.', '4. Tu cálculo amplía la zona perfecta. Mira la causa del resultado y vuelve a intentarlo.']) $('modalBody').append(node('p', text));
  $('modalActions').append(button('Entendido', closeDialog, 'primary'));
});
$('dismissHelp').addEventListener('click', () => { persist({ ...state, profile: { ...state.profile, tutorialSeen: true } }); render(); });
$('sound').addEventListener('click', () => { sound = !sound; $('sound').textContent = `Sonido: ${sound ? 'ON' : 'OFF'}`; $('sound').setAttribute('aria-pressed', String(sound)); tone(500); });
$('hint').addEventListener('click', () => dispatch({ type: 'HINT' }));
$('shoot').addEventListener('pointerdown', event => {
  if (!event.isPrimary || event.button !== 0) return;
  event.preventDefault();
  if (startCharge('button', event.pointerId)) $('shoot').setPointerCapture(event.pointerId);
});
$('shoot').addEventListener('pointerup', event => { event.preventDefault(); releaseCharge('button', event.pointerId); });
$('shoot').addEventListener('pointercancel', cancelCharge);
$('shoot').addEventListener('lostpointercapture', () => { if (charge?.source === 'button') cancelCharge(); });
$('shoot').addEventListener('keydown', event => {
  if (![' ', 'Enter'].includes(event.key) || event.repeat) return;
  event.preventDefault(); startCharge('button-key');
});
$('shoot').addEventListener('keyup', event => {
  if (![' ', 'Enter'].includes(event.key)) return;
  event.preventDefault(); releaseCharge('button-key');
});
$('shoot').addEventListener('click', event => event.preventDefault());
$('next').addEventListener('click', () => {
  if (active().phase !== 'end') dispatch({ type: 'NEXT' });
  else if (cup) finishCupTurn();
  else changeTraining(state.match.league, state.match.mode);
});
$('review').addEventListener('click', () => startReview(summary(state.match).review));
$('career').addEventListener('click', () => changeTraining(state.match.league, state.match.mode));
$('cup').addEventListener('click', () => {
  if (cup) abandonThen(showCupSetup);
  else showCupSetup(); // Career match is suspended and resumes after the cup.
});
$('practice').addEventListener('click', () => { if (!cup) showPractice(); else feedback = 'La práctica de carrera estará disponible al cerrar la copa.'; render(); });
$('share').addEventListener('click', share);
$('closeModal').addEventListener('click', () => {
  if (['handoff', 'cupResults'].includes(dialogPurpose)) abandonThen(() => { closeDialog(); render(); });
  else { const cancel = dialogCancel; closeDialog(); cancel?.(); }
});
$('modal').addEventListener('cancel', e => { e.preventDefault(); $('closeModal').click(); });
for (const b of document.querySelectorAll('[data-mode]')) b.addEventListener('click', () => { if (b.dataset.mode !== state.match.mode) changeTraining(state.match.league, b.dataset.mode); });
for (const id of ['aimX', 'aimY', 'spin']) $(id).addEventListener('input', () => dispatch({ type: 'AIM', value: { x: Number($('aimX').value), y: Number($('aimY').value), power: active().aim.power, spin: Number($('spin').value) } }));
function pointerPoint(event) {
  const r=$('game').getBoundingClientRect();
  return {x:(event.clientX-r.left)/r.width*FIELD.width,y:(event.clientY-r.top)/r.height*FIELD.height};
}
$('game').addEventListener('pointerdown', event => {
  if (active().phase !== 'aim' || blocked || drag || !event.isPrimary || event.button !== 0) return;
  const point=pointerPoint(event);
  if (Math.hypot(point.x-550,point.y-584)<110) {
    event.preventDefault();drag={start:point,end:point,time:performance.now(),id:event.pointerId};
    $('game').setPointerCapture(event.pointerId);$('gestureHint').textContent='SUELTA PARA FIJAR LA DIRECCIÓN';
  } else if (insideGoal(point.x,point.y)) dispatch({type:'AIM',value:{...active().aim,x:Math.round(point.x),y:Math.round(point.y)}});
});
$('game').addEventListener('pointermove',event=>{
  if (!drag || drag.id!==event.pointerId || active().phase!=='aim') return;
  drag.end=pointerPoint(event);
  const aim=shotFromDrag(drag.start,drag.end,Math.max(60,performance.now()-drag.time),active().aim.spin||0);
  if(aim)dispatch({type:'AIM',value:{...aim,power:active().aim.power}});
});
function cancelDrag(){drag=null;$('gestureHint').textContent='ARRASTRA EL BALÓN PARA APUNTAR';}
$('game').addEventListener('pointerup',event=>{
  if(!drag||drag.id!==event.pointerId)return;
  const aim=shotFromDrag(drag.start,pointerPoint(event),performance.now()-drag.time,active().aim.spin||0);
  cancelDrag();
  if(aim){dispatch({type:'AIM',value:{...aim,power:active().aim.power}});feedback='Dirección lista. Mantén pulsado para cargar el remate.';render();}
});
$('game').addEventListener('pointercancel',cancelDrag);
$('game').addEventListener('lostpointercapture',cancelDrag);
$('game').addEventListener('keydown', event => {
  if (active().phase !== 'aim' || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(event.key)) return;
  event.preventDefault();
  if (event.key === ' ') { if (!event.repeat) startCharge('canvas-key'); return; }
  const a = { ...active().aim };
  if (event.key === 'ArrowLeft') a.x -= 15;
  if (event.key === 'ArrowRight') a.x += 15;
  if (event.key === 'ArrowUp') a.y -= 10;
  if (event.key === 'ArrowDown') a.y += 10;
  dispatch({ type: 'AIM', value: a });
});
$('game').addEventListener('keyup', event => {
  if (event.key !== ' ') return;
  event.preventDefault(); releaseCharge('canvas-key');
});
window.addEventListener('storage', event => { if (event.key === STORAGE_KEY && event.newValue !== event.oldValue) conflict(); });
window.addEventListener('beforeunload', event => { if (cup && cup.phase !== 'end') { event.preventDefault(); event.returnValue = ''; } });
window.addEventListener('pagehide', () => { cancelAnimationFrame(frame); cancelAnimationFrame(visualFrame); audioContext?.close().catch(() => {}); audioContext = null; });
window.addEventListener('pageshow', event => { if(event.persisted){cancelAnimationFrame(visualFrame);visualFrame=requestAnimationFrame(ambient);if(active().phase==='flight')animate();} });
reducedMotion.addEventListener('change', () => { if (active().phase === 'flight') animate(); });
if (!repository.available) notice('El guardado local no está disponible. Puedes jugar durante esta sesión.');
else persist();
render();
if (active().phase === 'flight') animate();

visualFrame=requestAnimationFrame(ambient);
