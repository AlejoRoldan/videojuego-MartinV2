import { clamp } from './physics.mjs';

const BASELINE = 369;
const BODY_Y = 326;
const REACH_X = 96;
const REACH_Y = 72;

const lerp = (a, b, t) => a + (b - a) * t;
const point = (a, b, t) => Object.freeze({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) });
const easeOut = t => 1 - (1 - clamp(t, 0, 1)) ** 3;
const easeInOut = t => { const n = clamp(t, 0, 1); return n < .5 ? 4 * n ** 3 : 1 - (-2 * n + 2) ** 3 / 2; };

function reachableHand(scene, shot) {
  const target = shot.contact;
  if (shot.type === 'save') return target;
  const dx = target.x - scene.keeper, dy = target.y - 330;
  const distance = Math.hypot(dx / REACH_X, dy / REACH_Y);
  if (distance <= 1) {
    // Non-save outcomes never receive a visual catch, even near the body.
    const direction = Math.sign(dx) || 1;
    return { x: target.x - direction * 22, y: target.y + 12 };
  }
  return { x: scene.keeper + dx / distance, y: 330 + dy / distance };
}

function phaseAt(fraction, resultAge) {
  if (resultAge >= 700) return 'recovery';
  if (resultAge >= 180) return 'landing';
  if (fraction < .08) return 'ready';
  if (fraction < .18) return 'read';
  if (fraction < .30) return 'plant';
  if (fraction < .82) return 'dive';
  return 'contact';
}

export function keeperPose(scene, shot = null, fraction = 0, { resultAge = 0, reduced = false, time = 0 } = {}) {
  if (!scene || !Number.isFinite(scene.keeper) || !Number.isFinite(fraction) || !Number.isFinite(resultAge) || resultAge < 0) throw new RangeError('Invalid keeper animation input');
  const baseX = scene.keeper;
  const readyShift = shot || reduced ? 0 : Math.sin(time * .0024) * 2.5;
  const readyBody = { x: baseX + readyShift, y: BODY_Y };
  const readyLeft = { x: baseX - 29 + readyShift, y: 314 };
  const readyRight = { x: baseX + 29 + readyShift, y: 314 };
  const readyFeet = Object.freeze({ left: Object.freeze({ x: baseX - 15 + readyShift, y: BASELINE }), right: Object.freeze({ x: baseX + 15 + readyShift, y: BASELINE }) });
  if (!shot) return Object.freeze({ phase: 'ready', direction: 0, progress: 0, angle: 0, body: Object.freeze(readyBody), leadHand: Object.freeze(readyRight), hands: Object.freeze({ left: Object.freeze(readyLeft), right: Object.freeze(readyRight) }), feet: readyFeet });

  const f = clamp(fraction, 0, 1);
  const target = reachableHand(scene, shot);
  const direction = Math.sign(target.x - baseX) || Math.sign(shot.end.x - baseX) || 1;
  const plantedBody = { x: baseX - direction * 8, y: BODY_Y + 7 };
  const plantedLeft = { x: baseX - 32, y: 320 };
  const plantedRight = { x: baseX + 32, y: 320 };
  const plantedFeet = { left: { x: baseX - 18 - direction * 4, y: BASELINE }, right: { x: baseX + 18 - direction * 10, y: BASELINE } };
  const bodyEnd = { x: target.x - direction * 47, y: target.y + 20 };
  const trailEnd = { x: bodyEnd.x - direction * 18, y: bodyEnd.y - 14 };
  const leftEnd = direction > 0 ? trailEnd : target;
  const rightEnd = direction > 0 ? target : trailEnd;
  const feetEnd = {
    left: { x: bodyEnd.x - direction * 54 - 12, y: bodyEnd.y + 34 },
    right: { x: bodyEnd.x - direction * 40 + 12, y: bodyEnd.y + 42 },
  };
  const plant = easeInOut((f - .08) / .22);
  const dive = easeOut((f - .30) / .52);
  let body = point(readyBody, plantedBody, plant);
  let left = point(readyLeft, plantedLeft, plant);
  let right = point(readyRight, plantedRight, plant);
  let feet = { left: point(readyFeet.left, plantedFeet.left, plant), right: point(readyFeet.right, plantedFeet.right, plant) };
  body = point(body, bodyEnd, dive);
  left = point(left, leftEnd, dive);
  right = point(right, rightEnd, dive);
  feet = { left: point(feet.left, feetEnd.left, dive), right: point(feet.right, feetEnd.right, dive) };
  let angle = direction * lerp(0, Math.PI * .39, dive);

  if (resultAge >= 180) {
    const landing = easeInOut((resultAge - 180) / 420);
    const landedBody = { x: bodyEnd.x + direction * 9, y: Math.min(365, bodyEnd.y + 35) };
    body = point(bodyEnd, landedBody, landing);
    left = point(leftEnd, { x: landedBody.x - 25, y: landedBody.y + 5 }, landing);
    right = point(rightEnd, { x: landedBody.x + 25, y: landedBody.y + 5 }, landing);
    feet = { left: point(feetEnd.left, { x: landedBody.x - direction * 42, y: 374 }, landing), right: point(feetEnd.right, { x: landedBody.x - direction * 19, y: 374 }, landing) };
    angle = direction * lerp(Math.PI * .39, Math.PI * .47, landing);
  }
  if (resultAge >= 700) {
    const recovery = easeInOut((resultAge - 700) / 430);
    body = point(body, readyBody, recovery);
    left = point(left, readyLeft, recovery);
    right = point(right, readyRight, recovery);
    feet = { left: point(feet.left, readyFeet.left, recovery), right: point(feet.right, readyFeet.right, recovery) };
    angle = lerp(angle, 0, recovery);
  }
  const leadHand = direction > 0 ? right : left;
  return Object.freeze({
    phase: reduced ? (shot.type === 'save' ? 'contact' : 'ready') : phaseAt(f, resultAge),
    direction,
    progress: dive,
    angle,
    body,
    leadHand,
    hands: Object.freeze({ left, right }),
    feet: Object.freeze(feet),
  });
}
