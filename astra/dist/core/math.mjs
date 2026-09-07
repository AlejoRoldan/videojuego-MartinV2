export const LEAGUES = Object.freeze([
  { name: 'La cantera', stadium: 'CANCHA DE BARRIO', min: 2, max: 5, xp: 0 },
  { name: 'Liga ascenso', stadium: 'ARENA METROPOLITANA', min: 3, max: 9, xp: 180 },
  { name: 'Noche de final', stadium: 'ESTADIO DE CAMPEONES', min: 6, max: 12, xp: 420 },
]);
export const MODES = Object.freeze(['multiply', 'divide', 'mixed']);
export function seededRandom(seed) {
  let s = seed >>> 0;
  return () => { s += 0x6D2B79F5; let t = s; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
export function shuffle(values, random) {
  const out = [...values];
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}
export function question(a, b, mode, random = Math.random) {
  if (!Number.isInteger(a) || a < 2 || a > 12 || !Number.isInteger(b) || b < 2 || b > 12 || !['multiply', 'divide'].includes(mode)) throw new RangeError('Invalid question');
  const answer = mode === 'divide' ? b : a * b;
  // Finite distractor pool: constant RNGs cannot hang generation.
  const candidates = Array.from({ length: 169 }, (_, i) => i + 1).filter(n => n !== answer && Math.abs(n - answer) <= Math.max(8, a * 2));
  const options = shuffle([answer, ...shuffle(candidates, random).slice(0, 3)], random);
  return { key: `${mode}:${a}:${b}`, a, b, mode, answer, options };
}
export function makePlan(league = 0, mode = 'multiply', seed = 1, review = []) {
  if (!LEAGUES[league] || !MODES.includes(mode)) throw new RangeError('Invalid training configuration');
  const rng = seededRandom(seed);
  const l = LEAGUES[league];
  const matching = review.filter(q => validQuestion(q) && (mode === 'mixed' || q.mode === mode));
  const pool = [];
  for (let a = l.min; a <= l.max; a++) for (let b = 2; b <= 12; b++) pool.push([a, b]);
  const pairs = shuffle(pool, rng);
  return Array.from({ length: 5 }, (_, i) => {
    const source = matching.length ? matching[i % matching.length] : null;
    const [a, b] = source ? [source.a, source.b] : pairs[i];
    const domain = source?.mode || (mode === 'mixed' ? (i % 2 ? 'divide' : 'multiply') : mode);
    return { question: question(a, b, domain, rng), scenario: (seed + i) % 3 };
  });
}
export function validQuestion(q) {
  return !!q && Number.isInteger(q.a) && q.a >= 2 && q.a <= 12 && Number.isInteger(q.b) && q.b >= 2 && q.b <= 12 && ['multiply', 'divide'].includes(q.mode) && q.key === `${q.mode}:${q.a}:${q.b}` && q.answer === (q.mode === 'divide' ? q.b : q.a * q.b) && Array.isArray(q.options) && q.options.length === 4 && new Set(q.options).size === 4 && q.options.every(n => Number.isInteger(n) && n > 0 && n <= 169) && q.options.includes(q.answer);
}
export const label = q => q.mode === 'divide' ? `${q.a * q.b} ÷ ${q.a}` : `${q.a} × ${q.b}`;
export function hint(q) {
  if (q.mode === 'divide') return `Piensa al revés: ${q.a} × ¿qué número? = ${q.a * q.b}. Reparte en ${q.a} grupos iguales.`;
  if (q.b > 5) return `Descompón: (${q.a} × 5) + (${q.a} × ${q.b - 5}). Suma los dos resultados.`;
  return `Forma ${q.b} grupos de ${q.a}: ${Array(q.b).fill(q.a).join(' + ')}.`;
}
