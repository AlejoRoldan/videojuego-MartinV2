import { makePlan, validQuestion, MODES, LEAGUES } from './math.mjs';
import { DEFAULT_AIM, normalizeAim, resolveShot } from './physics.mjs';
export function createMatch({ league = 0, mode = 'multiply', seed = 1, kind = 'career', review = [], plan } = {}) {
  if (!LEAGUES[league] || !MODES.includes(mode) || !['career', 'review', 'cup'].includes(kind)) throw new RangeError('Invalid match');
  const selected = plan || makePlan(league, mode, seed, review);
  if (selected.length !== 5 || selected.some(p => !validQuestion(p.question) || (mode !== 'mixed' && p.question.mode !== mode) || !Number.isInteger(p.scenario) || p.scenario < 0 || p.scenario > 2)) throw new RangeError('Invalid plan');
  return { kind, league, mode, plan: structuredClone(selected), index: 0, phase: 'question', wrong: [], helped: false, streak: 0, aim: { ...DEFAULT_AIM }, results: [], questionAwards: [], xp: 0, bonus: false, outcome: null, lastFeedback: '' };
}
export function currentQuestion(match) { return match.plan[match.index].question; }
export function reduceMatch(original, event) {
  const m = structuredClone(original);
  let reward = 0, record = null, changed = true;
  const q = currentQuestion(m);
  switch (event.type) {
    case 'HINT':
      if (m.phase !== 'question' || m.helped) return { match: original, reward, record, changed: false };
      m.helped = true; m.streak = 0; break;
    case 'ANSWER':
      if (m.phase !== 'question' || !q.options.includes(event.value) || m.wrong.includes(event.value)) return { match: original, reward, record, changed: false };
      if (event.value !== q.answer) { m.wrong.push(event.value); m.helped = true; m.streak = 0; }
      else {
        const clean = !m.helped && m.wrong.length === 0;
        m.streak = clean ? m.streak + 1 : 0;
        if (!m.questionAwards.includes(m.index)) { reward = clean ? 20 : 10; m.questionAwards.push(m.index); }
        record = { question: q, clean, helped: !clean, errors: m.wrong.length };
        m.phase = 'aim';
      }
      break;
    case 'AIM':
      if (m.phase !== 'aim') return { match: original, reward, record, changed: false };
      m.aim = normalizeAim(event.value); break;
    case 'SHOOT':
      if (m.phase !== 'aim') return { match: original, reward, record, changed: false };
      m.outcome = resolveShot(m.aim, m.plan[m.index].scenario); m.phase = 'flight'; break;
    case 'FINISH':
      if (m.phase !== 'flight' || m.results.length !== m.index) return { match: original, reward, record, changed: false };
      m.results.push({ question: q, clean: !m.helped && !m.wrong.length, helped: m.helped, errors: m.wrong.length, aim: { ...m.aim }, outcome: m.outcome });
      reward = m.outcome.goal ? 15 : 0; m.phase = 'result'; break;
    case 'NEXT':
      if (m.phase !== 'result') return { match: original, reward, record, changed: false };
      if (m.index === 4) {
        m.phase = 'end';
        if (!m.bonus && m.results.filter(r => r.outcome.goal).length >= 3) reward = 60;
        m.bonus = true;
      } else {
        m.index++; m.phase = 'question'; m.wrong = []; m.helped = false; m.aim = { ...DEFAULT_AIM }; m.outcome = null;
      }
      break;
    default: changed = false;
  }
  if (m.kind !== 'career') reward = 0;
  m.xp += reward;
  return { match: m, reward, record, changed };
}
export function summary(m) {
  const errors = new Map();
  for (const r of m.results) if (!r.clean) errors.set(r.question.key, r.question);
  return { goals: m.results.filter(r => r.outcome.goal).length, clean: m.results.filter(r => r.clean).length, assisted: m.results.filter(r => !r.clean).length, review: [...errors.values()] };
}
export function validateAlias(value) {
  if (typeof value !== 'string') return null;
  const alias = value.normalize('NFKC').trim().replace(/\s+/gu, ' ');
  return /^[\p{L}\p{N} _-]{2,12}$/u.test(alias) ? alias : null;
}
export function createCup(aliases, mode, seed) {
  const names = aliases.map(validateAlias);
  if (names.length < 2 || names.length > 4 || names.some(n => !n) || new Set(names.map(n => n.toLocaleLowerCase('es'))).size !== names.length) throw new RangeError('Usa 2–4 apodos distintos, de 2–12 letras o números.');
  return { aliases: names, mode, plan: makePlan(0, mode, seed), turn: 0, scores: [], phase: 'handoff' };
}
export function cupRanking(scores) {
  const rows = [...scores].sort((a, b) => b.goals - a.goals || b.clean - a.clean);
  let rank = 1;
  return rows.map((row, i) => { if (i && (row.goals !== rows[i - 1].goals || row.clean !== rows[i - 1].clean)) rank = i + 1; return { ...row, rank }; });
}
