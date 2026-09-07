import test from 'node:test';
import assert from 'node:assert/strict';
import { question, validQuestion, makePlan, hint, seededRandom, label } from '../dist/core/math.mjs';
import { resolveShot, pathPoint, DEFAULT_AIM, insideGoal, FIELD } from '../dist/core/physics.mjs';
import { createMatch, currentQuestion, reduceMatch, summary, createCup, cupRanking, validateAlias } from '../dist/core/game.mjs';
import { ProfileStore, STORAGE_KEY, decode, restoreMatch, emptyProfile, cleanProfile, recordPractice } from '../dist/core/storage.mjs';
const step = (m, type, value) => reduceMatch(m, { type, value }).match;
function completedShot(m, aim = { x: 760, y: 230, power: 72 }) {
  m = step(m, 'ANSWER', currentQuestion(m).answer); m = step(m, 'AIM', aim); m = step(m, 'SHOOT'); return step(m, 'FINISH');
}
function completedMatch(config) { let m = createMatch(config); for (let i = 0; i < 5; i++) m = step(completedShot(m), 'NEXT'); return m; }
const memory = () => { const map = new Map(); return { getItem: k => map.get(k) ?? null, setItem: (k, v) => map.set(k, v) }; };

test('all supported arithmetic combinations have exactly one valid answer', () => {
  for (const mode of ['multiply', 'divide']) for (let a = 2; a <= 12; a++) for (let b = 2; b <= 12; b++) {
    const q = question(a, b, mode, () => 0);
    assert.ok(validQuestion(q)); assert.equal(q.options.filter(n => n === q.answer).length, 1);
    if (mode === 'divide') assert.equal(a * b / a, q.answer);
  }
});
test('question rejects invalid divisors, operands and modes', () => {
  for (const bad of [[0, 3, 'divide'], [2, 1.5, 'multiply'], [NaN, 2, 'divide'], [12, 13, 'multiply'], [2, 3, '<script>']]) assert.throws(() => question(...bad));
});
test('seeded plans are reproducible; mixed rounds contain both domains', () => {
  assert.deepEqual(makePlan(2, 'mixed', 9), makePlan(2, 'mixed', 9));
  assert.equal(new Set(makePlan(2, 'mixed', 9).map(p => p.question.mode)).size, 2);
  assert.equal(new Set(makePlan(0, 'multiply', 9).map(p => p.question.key)).size, 5);
});
test('review queue cannot leak multiplication into division', () => {
  const plan = makePlan(0, 'divide', 15, [question(2, 3, 'multiply'), question(7, 8, 'divide')]);
  assert.ok(plan.every(p => p.question.mode === 'divide' && p.question.a === 7));
});
test('hint explains inverse division and decomposed multiplication', () => {
  assert.match(hint(question(6, 7, 'divide')), /6 × ¿qué número\? = 42/);
  assert.match(hint(question(7, 8, 'multiply')), /7 × 5/);
  assert.equal(label(question(6, 7, 'divide')), '42 ÷ 6');
});
test('invalid plan domain cannot be injected into a match', () => {
  assert.throws(() => createMatch({ mode: 'divide', plan: makePlan(0, 'multiply', 1) }));
});
test('outside goal and nonfinite pointer input is ignored', () => {
  assert.equal(insideGoal(550, 584), false); assert.equal(insideGoal(NaN, 240), false); assert.equal(insideGoal(750, 230), true);
});
test('deterministic shot resolution never mutates aim', () => {
  const aim = Object.freeze({ x: 760, y: 230, power: 72 });
  assert.deepEqual(resolveShot(aim, 0), resolveShot(aim, 0)); assert.ok(resolveShot(aim, 0).goal);
});
test('neutral default cannot guarantee five goals across rotating scenarios', () => {
  for (let start = 0; start < 3; start++) {
    const goals = Array.from({ length: 5 }, (_, i) => resolveShot(DEFAULT_AIM, (start + i) % 3).goal).filter(Boolean).length;
    assert.ok(goals < 5);
  }
});
test('rendered contact point equals resolved collision point', () => {
  const shot = resolveShot({ x: 420, y: 330, power: 72 }, 0);
  assert.equal(shot.type, 'wall'); assert.equal(shot.stop, FIELD.wallDepth); assert.deepEqual(shot.contact, pathPoint(shot.end, shot.stop));
});
test('keeper saves reachable shots and animation ends at hands', () => {
  const shot = resolveShot({ x: 550, y: 300, power: 72 }, 0); assert.equal(shot.type, 'save'); assert.deepEqual(shot.contact, pathPoint(shot.end, 1));
});
test('whole ball must clear posts and crossbar, including tangent cases', () => {
  for (const [x, y] of [[287, 220], [813, 220], [760, 199], [760, 369]]) assert.equal(resolveShot({ x, y, power: 72 }, 0).type, 'out');
  assert.equal(resolveShot({ x: 288, y: 220, power: 72 }, 0).type, 'goal');
});
test('excessive and insufficient power have concrete out reasons', () => {
  assert.equal(resolveShot({ x: 760, y: 200, power: 100 }, 0).type, 'out');
  assert.equal(resolveShot({ x: 760, y: 350, power: 30 }, 0).type, 'out');
});
test('nonfinite aim is rejected, bounded aim is clamped', () => {
  assert.throws(() => resolveShot({ x: Infinity, y: 200, power: 72 }, 0));
  assert.equal(resolveShot({ x: 1000, y: 220, power: 72 }, 0).end.x, 820);
});
test('transition guards reject shoot before solving and duplicate answer', () => {
  const m = createMatch(); assert.equal(reduceMatch(m, { type: 'SHOOT' }).changed, false);
  const update = reduceMatch(m, { type: 'ANSWER', value: currentQuestion(m).answer });
  assert.equal(update.reward, 20); assert.equal(reduceMatch(update.match, { type: 'ANSWER', value: currentQuestion(m).answer }).reward, 0);
});
test('wrong answer, hint and correction yield 10 XP and reset streak', () => {
  let m = createMatch(); const q = currentQuestion(m); m = step(m, 'ANSWER', q.options.find(n => n !== q.answer));
  const again = reduceMatch(m, { type: 'ANSWER', value: m.wrong[0] }); assert.equal(again.changed, false);
  const correct = reduceMatch(m, { type: 'ANSWER', value: q.answer }); assert.equal(correct.reward, 10); assert.equal(correct.match.streak, 0); assert.equal(correct.record.errors, 1);
});
test('double shoot and double finish cannot duplicate goals or XP', () => {
  let m = createMatch(); m = step(m, 'ANSWER', currentQuestion(m).answer); m = step(m, 'AIM', { x: 760, y: 230, power: 72 }); m = step(m, 'SHOOT');
  assert.equal(reduceMatch(m, { type: 'SHOOT' }).changed, false);
  m = step(m, 'FINISH'); assert.equal(reduceMatch(m, { type: 'FINISH' }).reward, 0); assert.equal(m.results.length, 1);
});
test('five goals + five clean answers + single mission bonus = 235 XP', () => {
  const m = completedMatch(); assert.equal(m.phase, 'end'); assert.equal(m.xp, 235); assert.equal(summary(m).goals, 5);
  assert.equal(reduceMatch(m, { type: 'NEXT' }).reward, 0);
});
test('review and cup never award career XP', () => {
  for (const kind of ['review', 'cup']) assert.equal(completedMatch({ kind }).xp, 0);
});
test('summary deduplicates repeated errors and distinguishes assistance', () => {
  const q = question(4, 6, 'multiply'); let m = createMatch({ plan: Array.from({ length: 5 }, () => ({ question: q, scenario: 0 })) });
  for (let i = 0; i < 5; i++) { m = step(m, 'HINT'); m = step(completedShot(m), 'NEXT'); }
  assert.equal(summary(m).review.length, 1); assert.equal(summary(m).assisted, 5); assert.equal(summary(m).clean, 0);
});
test('replay restores all phases and never emits new side effects', () => {
  let m = createMatch();
  for (let i = 0; i < 5; i++) {
    assert.deepEqual(restoreMatch(m), m);
    m = step(m, 'ANSWER', currentQuestion(m).answer); assert.deepEqual(restoreMatch(m), m);
    m = step(m, 'AIM', { x: 760, y: 230, power: 72 }); m = step(m, 'SHOOT'); assert.deepEqual(restoreMatch(m), m);
    m = step(m, 'FINISH'); assert.deepEqual(restoreMatch(m), m); m = step(m, 'NEXT');
  }
  assert.deepEqual(restoreMatch(m), m);
});
test('tampered saved outcomes and XP are recomputed from input', () => {
  const m = completedMatch(); m.xp = 99999; m.results[0].outcome.type = 'wall';
  const restored = restoreMatch(m); assert.equal(restored.xp, 235); assert.equal(restored.results[0].outcome.type, 'goal');
});
test('invalid and oversized saved data cannot crash the app', () => {
  for (const bad of ['{', 'null', '[]', 'x'.repeat(170000), '{"version":9}']) assert.equal(decode(bad), null);
  assert.equal(restoreMatch({ ...createMatch(), index: -1 }), null);
});
test('profile shape rejects prototype keys, huge values and wrong-domain records', () => {
  const obj = JSON.parse('{"xp":-8,"best":99,"practice":{"__proto__":{"polluted":true}}}');
  assert.deepEqual(cleanProfile(obj), emptyProfile()); assert.equal({}.polluted, undefined);
});
test('legacy profile migrates without losing valid XP or record', () => {
  const storage = memory(); storage.setItem('gol-lab-v1', JSON.stringify({ xp: 420, best: 4 }));
  const loaded = new ProfileStore(storage).load(); assert.equal(loaded.profile.xp, 420); assert.equal(loaded.profile.best, 4);
});
test('save atomically stores profile and active match; reload does not add XP', () => {
  const storage = memory(), store = new ProfileStore(storage); const state = store.load();
  const update = reduceMatch(createMatch(), { type: 'ANSWER', value: currentQuestion(createMatch()).answer });
  state.match = update.match; state.profile.xp = update.reward;
  assert.ok(store.save(state).ok); const resumed = new ProfileStore(storage).load();
  assert.equal(resumed.profile.xp, 20); assert.equal(resumed.match.phase, 'aim');
});
test('storage failure falls back without throwing and reports failure', () => {
  const store = new ProfileStore({ getItem() { throw new Error(); }, setItem() { throw new Error(); } });
  const data = store.load(); assert.equal(store.available, false); assert.equal(store.save(data).ok, false);
});
test('stale tab cannot overwrite a newer stored revision', () => {
  const storage = memory(), a = new ProfileStore(storage), b = new ProfileStore(storage);
  const sa = a.load(), sb = b.load(); a.save(sa);
  assert.equal(b.save(sb).conflict, true);
});
test('practice counters persist clean, assisted and wrong attempts separately', () => {
  const q = question(4, 7, 'divide'); let p = recordPractice(emptyProfile(), { question: q, clean: false, helped: true, errors: 2 });
  p = recordPractice(p, { question: q, clean: true, helped: false, errors: 0 });
  assert.deepEqual([p.practice[q.key].attempts, p.practice[q.key].clean, p.practice[q.key].helped, p.practice[q.key].errors], [2, 1, 1, 2]);
});
test('aliases reject markup, control characters, duplicates and length violations', () => {
  for (const value of ['<img>', 'A', 'x'.repeat(13), '\u202eevil', 'aa\n<script>']) assert.equal(validateAlias(value), null);
  assert.throws(() => createCup(['Goal', ' goal '], 'mixed', 1)); assert.throws(() => createCup(['Goal'], 'mixed', 1));
  assert.equal(validateAlias('  Tigre  '), 'Tigre'); assert.equal(validateAlias('Águila'), 'Águila');
});
test('every cup player has identical questions and scenarios, independent state', () => {
  const cup = createCup(['Azul', 'Verde', 'Rojo', 'Oro'], 'mixed', 15);
  const a = createMatch({ kind: 'cup', mode: cup.mode, plan: cup.plan }), b = createMatch({ kind: 'cup', mode: cup.mode, plan: cup.plan });
  assert.deepEqual(a.plan, b.plan); step(a, 'HINT'); assert.equal(b.helped, false); assert.notEqual(a.plan, b.plan);
});
test('cup ranking uses goals then clean answers, with shared places for ties', () => {
  const rows = cupRanking([{ alias: 'Azul', goals: 3, clean: 5 }, { alias: 'Verde', goals: 4, clean: 2 }, { alias: 'Rojo', goals: 4, clean: 2 }]);
  assert.deepEqual(rows.map(r => r.rank), [1, 1, 3]); assert.equal(rows[0].alias, 'Verde');
});
test('saved malformed match is isolated from valid profile', () => {
  const saved = decode(JSON.stringify({ version: 2, revision: 3, profile: { xp: 120, best: 2 }, match: { phase: 'evil' } }));
  assert.equal(saved.profile.xp, 120); assert.equal(saved.match, null);
});
