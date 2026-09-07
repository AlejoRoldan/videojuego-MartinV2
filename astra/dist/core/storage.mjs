import { createMatch, currentQuestion, reduceMatch } from './game.mjs';
import { validQuestion, MODES } from './math.mjs';
export const STORAGE_KEY = 'gol-lab-v2';
const MAX_BYTES = 160000;
const integer = (n, min = 0, max = 1000000) => Number.isSafeInteger(n) && n >= min && n <= max;
export function emptyProfile() { return { xp: 0, best: 0, practice: {}, tutorialSeen: false }; }
export function cleanProfile(input) {
  const profile = emptyProfile();
  if (!input || typeof input !== 'object') return profile;
  profile.xp = integer(input.xp) ? input.xp : 0;
  profile.best = integer(input.best, 0, 5) ? input.best : 0;
  profile.tutorialSeen = input.tutorialSeen === true;
  if (input.practice && typeof input.practice === 'object') {
    for (const [key, entry] of Object.entries(input.practice).slice(0, 242)) {
      if (!/^(multiply|divide):([2-9]|1[0-2]):([2-9]|1[0-2])$/.test(key) || !entry || !validQuestion(entry.question)) continue;
      if (entry.question.key !== key || !integer(entry.attempts, 1) || !integer(entry.clean, 0, entry.attempts) || !integer(entry.helped, 0, entry.attempts) || !integer(entry.errors)) continue;
      profile.practice[key] = { question: entry.question, attempts: entry.attempts, clean: entry.clean, helped: entry.helped, errors: entry.errors };
    }
  }
  return profile;
}
export function recordPractice(profile, record) {
  const next = structuredClone(profile);
  const old = next.practice[record.question.key] || { attempts: 0, clean: 0, helped: 0, errors: 0 };
  next.practice[record.question.key] = {
    question: record.question,
    attempts: Math.min(1000000, old.attempts + 1),
    clean: Math.min(1000000, old.clean + (record.clean ? 1 : 0)),
    helped: Math.min(1000000, old.helped + (record.helped ? 1 : 0)),
    errors: Math.min(1000000, old.errors + record.errors),
  };
  return next;
}
// Rebuild saved matches through the reducer, rather than trusting saved outcomes,
// rewards, award ledgers, arbitrary strings or object prototypes.
export function restoreMatch(raw) {
  try {
    if (!raw || !['career', 'review'].includes(raw.kind) || !integer(raw.league, 0, 2) || !MODES.includes(raw.mode) || !integer(raw.index, 0, 4)) return null;
    if (!Array.isArray(raw.results) || raw.results.length > 5 || !Array.isArray(raw.plan) || raw.plan.length !== 5) return null;
    if (!['question', 'aim', 'flight', 'result', 'end'].includes(raw.phase)) return null;
    let m = createMatch({ kind: raw.kind, league: raw.league, mode: raw.mode, plan: raw.plan });
    const step = event => { m = reduceMatch(m, event).match; };
    for (let i = 0; i < raw.results.length; i++) {
      const r = raw.results[i];
      if (!r || typeof r.clean !== 'boolean' || !integer(r.errors, 0, 3) || !r.aim) return null;
      const q = currentQuestion(m);
      if (!r.clean) {
        for (const wrong of q.options.filter(n => n !== q.answer).slice(0, r.errors)) step({ type: 'ANSWER', value: wrong });
        step({ type: 'HINT' });
      } else if (r.errors) return null;
      step({ type: 'ANSWER', value: q.answer }); step({ type: 'AIM', value: r.aim }); step({ type: 'SHOOT' }); step({ type: 'FINISH' });
      if (i < raw.results.length - 1 || raw.phase !== 'result') step({ type: 'NEXT' });
    }
    if (raw.phase === 'end' || raw.phase === 'result') return m.phase === raw.phase && m.index === raw.index ? m : null;
    if (m.phase !== 'question' || m.index !== raw.index || !Array.isArray(raw.wrong) || raw.wrong.length > 3) return null;
    const q = currentQuestion(m);
    if (new Set(raw.wrong).size !== raw.wrong.length || raw.wrong.some(n => n === q.answer || !q.options.includes(n))) return null;
    for (const n of raw.wrong) step({ type: 'ANSWER', value: n });
    if (raw.helped) step({ type: 'HINT' });
    if (raw.phase !== 'question') { step({ type: 'ANSWER', value: q.answer }); step({ type: 'AIM', value: raw.aim }); }
    if (raw.phase === 'flight') step({ type: 'SHOOT' });
    return m;
  } catch { return null; }
}
export function decode(raw) {
  if (!raw || raw.length > MAX_BYTES) return null;
  try {
    const obj = JSON.parse(raw);
    if (obj?.version !== 2 || !integer(obj.revision, 0, Number.MAX_SAFE_INTEGER)) return null;
    return { version: 2, revision: obj.revision, profile: cleanProfile(obj.profile), match: restoreMatch(obj.match) };
  } catch { return null; }
}
export class ProfileStore {
  constructor(storage) { this.storage = storage; this.revision = 0; this.available = true; }
  load() {
    try {
      const data = decode(this.storage.getItem(STORAGE_KEY));
      if (data) { this.revision = data.revision; return data; }
      const legacyRaw = this.storage.getItem('gol-lab-v1');
      const legacy = legacyRaw && legacyRaw.length < 1000 ? JSON.parse(legacyRaw) : null;
      return { version: 2, revision: 0, profile: cleanProfile(legacy), match: null };
    } catch { this.available = false; return { version: 2, revision: 0, profile: emptyProfile(), match: null }; }
  }
  save(data) {
    try {
      const current = decode(this.storage.getItem(STORAGE_KEY));
      if (current && current.revision !== this.revision) return { ok: false, conflict: true };
      const next = { version: 2, revision: this.revision + 1, profile: data.profile, match: data.match };
      const serialized = JSON.stringify(next);
      if (serialized.length > MAX_BYTES) throw new RangeError('Storage limit');
      this.storage.setItem(STORAGE_KEY, serialized);
      this.revision = next.revision; this.available = true;
      return { ok: true };
    } catch { this.available = false; return { ok: false, conflict: false }; }
  }
}
