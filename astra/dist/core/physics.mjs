export const FIELD = Object.freeze({ width: 1100, height: 650, left: 280, right: 820, top: 192, bottom: 376, radius: 7, wallDepth: 0.64 });
export const SCENARIOS = Object.freeze([
  Object.freeze({ name: 'Barrera a la izquierda', keeper: 550, wall: 470 }),
  Object.freeze({ name: 'Barrera a la derecha', keeper: 430, wall: 635 }),
  Object.freeze({ name: 'Barrera en el centro', keeper: 680, wall: 550 }),
]);
export const DEFAULT_AIM = Object.freeze({ x: 550, y: 300, power: 50 });
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export function normalizeAim(aim) {
  if (!aim || ![aim.x, aim.y, aim.power].every(Number.isFinite)) throw new RangeError('Invalid aim');
  return { x: clamp(aim.x, FIELD.left, FIELD.right), y: clamp(aim.y, FIELD.top, FIELD.bottom), power: clamp(aim.power, 30, 100) };
}
export function insideGoal(x, y) { return Number.isFinite(x) && Number.isFinite(y) && x >= FIELD.left && x <= FIELD.right && y >= FIELD.top && y <= FIELD.bottom; }
export function pathPoint(end, t) {
  const n = clamp(t, 0, 1);
  return { x: 550 + (end.x - 550) * n, y: 584 + (end.y - 584) * n - 65 * Math.sin(Math.PI * n), r: 14 - 7 * n };
}
export function resolveShot(input, scenarioIndex) {
  const aim = normalizeAim(input);
  const scene = SCENARIOS[scenarioIndex];
  if (!scene) throw new RangeError('Invalid scenario');
  const end = { x: aim.x, y: aim.y + (aim.power < 60 ? (60 - aim.power) * 4 : aim.power > 85 ? -(aim.power - 85) * 4 : 0) };
  const point = pathPoint(end, FIELD.wallDepth);
  let type = 'goal', message = 'Encontraste un espacio libre. ¡Buena definición!', t = 1;
  // The rendered wall and collision rectangle share the same coordinates.
  if (point.x + point.r >= scene.wall - 53 && point.x - point.r <= scene.wall + 53 && point.y + point.r >= 345 && point.y - point.r <= 441) {
    type = 'wall'; message = 'Pegó en la barrera. Busca otro lado o una trayectoria más alta.'; t = FIELD.wallDepth;
  } else if (end.x - FIELD.radius <= FIELD.left || end.x + FIELD.radius >= FIELD.right || end.y - FIELD.radius <= FIELD.top || end.y + FIELD.radius >= FIELD.bottom) {
    type = 'out'; message = end.y < FIELD.top + FIELD.radius ? 'Salió alto. Baja la potencia o la altura.' : end.y > FIELD.bottom - FIELD.radius ? 'Se quedó corto. Sube la potencia o la altura.' : 'Rozó el poste y salió. Apunta un poco hacia dentro.';
  } else if (((end.x - scene.keeper) / 83) ** 2 + ((end.y - 330) / 64) ** 2 <= 1) {
    type = 'save'; message = 'El portero llegó al balón. Busca una esquina más alejada.';
  }
  // Whole ball must fit through the opening; no hidden random miss chance.
  return Object.freeze({ type, goal: type === 'goal', message, end: Object.freeze(end), stop: t, contact: Object.freeze(pathPoint(end, t)), scenario: scenarioIndex });
}
