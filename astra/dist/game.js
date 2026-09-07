import { LEAGUES, MODES, hint, label } from './core/math.mjs';
import { createMatch, reduceMatch, summary, currentQuestion, createCup, cupRanking } from './core/game.mjs';
import { FIELD, SCENARIOS, insideGoal } from './core/physics.mjs';
import { ProfileStore, STORAGE_KEY, recordPractice } from './core/storage.mjs';
import { createRenderer } from './render.mjs';

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
  else if (event.type === 'SHOOT') feedback = 'Balón en juego…';
  else if (event.type === 'FINISH') { feedback = m.outcome.message; tone(m.outcome.goal ? 780 : 180, .2); }
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
  if (reducedMotion.matches) { renderer.draw(match, 1); dispatch({ type: 'FINISH' }); return; }
  let start;
  function tick(now) {
    if (active() !== match || blocked) return;
    start ??= now;
    const fraction = Math.min(1, (now - start) / (1000 * match.outcome.stop));
    renderer.draw(match, fraction);
    if (fraction < 1) frame = requestAnimationFrame(tick);
    else dispatch({ type: 'FINISH' });
  }
  frame = requestAnimationFrame(tick);
}
function stat(value, description) {
  const box = node('div'); box.append(node('b', String(value)), node('span', description)); return box;
}
function render(aimOnly = false) {
  const m = active();
  const scene = SCENARIOS[m.plan[m.index].scenario];
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
  $('sceneDescription').textContent = `${scene.name}. Portero ${scene.keeper < 500 ? 'a la izquierda' : scene.keeper > 600 ? 'a la derecha' : 'en el centro'}. Busca un hueco o supera la barrera por arriba.`;
  const phaseTitle = { question: 'PREPARA LA JUGADA', aim: 'APUNTA Y DISPARA', flight: 'BALÓN EN JUEGO', result: 'REVISA TU JUGADA', end: 'FINAL DEL PARTIDO' };
  $('phaseTag').textContent = phaseTitle[m.phase];
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
  $('aimX').value = m.aim.x; $('aimY').value = m.aim.y; $('power').value = m.aim.power;
  $('aimValue').textContent = m.aim.x < 490 ? 'Izquierda' : m.aim.x > 610 ? 'Derecha' : 'Centro';
  $('heightValue').textContent = m.aim.y < 250 ? 'Alta' : m.aim.y > 325 ? 'Baja' : 'Media';
  $('powerValue').textContent = `${m.aim.power}%`;
  for (const id of ['aimX', 'aimY', 'power']) $(id).disabled = blocked || m.phase !== 'aim';
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
  for (const text of ['1. Resuelve la operación. Puedes pensar sin reloj y pedir una pista.', '2. Apunta a un hueco del arco. El toque solo actúa dentro del arco; las flechas también sirven.', '3. Elige potencia: 60–85% mantiene la altura elegida. Pulsa Disparar o espacio con el foco en la cancha.', '4. Mira la causa del resultado. Al terminar puedes repasar o pedir revancha.']) $('modalBody').append(node('p', text));
  $('modalActions').append(button('Entendido', closeDialog, 'primary'));
});
$('dismissHelp').addEventListener('click', () => { persist({ ...state, profile: { ...state.profile, tutorialSeen: true } }); render(); });
$('sound').addEventListener('click', () => { sound = !sound; $('sound').textContent = `Sonido: ${sound ? 'ON' : 'OFF'}`; $('sound').setAttribute('aria-pressed', String(sound)); tone(500); });
$('hint').addEventListener('click', () => dispatch({ type: 'HINT' }));
$('shoot').addEventListener('click', () => dispatch({ type: 'SHOOT' }));
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
for (const id of ['aimX', 'aimY', 'power']) $(id).addEventListener('input', () => dispatch({ type: 'AIM', value: { x: Number($('aimX').value), y: Number($('aimY').value), power: Number($('power').value) } }));
$('game').addEventListener('pointerdown', event => {
  if (active().phase !== 'aim') return;
  const rect = $('game').getBoundingClientRect();
  const x = (event.clientX - rect.left) / rect.width * FIELD.width;
  const y = (event.clientY - rect.top) / rect.height * FIELD.height;
  if (!insideGoal(x, y)) return;
  dispatch({ type: 'AIM', value: { x: Math.round(x), y: Math.round(y), power: active().aim.power } });
});
$('game').addEventListener('keydown', event => {
  if (active().phase !== 'aim' || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(event.key)) return;
  event.preventDefault();
  if (event.key === ' ') { dispatch({ type: 'SHOOT' }); return; }
  const a = { ...active().aim };
  if (event.key === 'ArrowLeft') a.x -= 15;
  if (event.key === 'ArrowRight') a.x += 15;
  if (event.key === 'ArrowUp') a.y -= 10;
  if (event.key === 'ArrowDown') a.y += 10;
  dispatch({ type: 'AIM', value: a });
});
window.addEventListener('storage', event => { if (event.key === STORAGE_KEY && event.newValue !== event.oldValue) conflict(); });
window.addEventListener('beforeunload', event => { if (cup && cup.phase !== 'end') { event.preventDefault(); event.returnValue = ''; } });
window.addEventListener('pagehide', () => { cancelAnimationFrame(frame); audioContext?.close().catch(() => {}); audioContext = null; });
window.addEventListener('pageshow', event => { if (event.persisted && active().phase === 'flight') animate(); });
reducedMotion.addEventListener('change', () => { if (active().phase === 'flight') animate(); });
if (!repository.available) notice('El guardado local no está disponible. Puedes jugar durante esta sesión.');
else persist();
render();
if (active().phase === 'flight') animate();
