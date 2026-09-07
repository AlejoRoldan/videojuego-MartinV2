import { FIELD, clamp } from './physics.mjs';

// World-space gestures are independent of CSS size and device pixel density.
export function shotFromDrag(start, end, durationMs, spin = 0) {
  if (![start?.x, start?.y, end?.x, end?.y, durationMs, spin].every(Number.isFinite)) return null;
  if (Math.hypot(start.x - 550, start.y - 584) > 110) return null;
  const up = start.y - end.y;
  if (up < 90 || durationMs < 60 || durationMs > 5000) return null;
  const power = clamp(60 + up / 30, 60, 85);
  return { x: clamp(end.x, FIELD.left, FIELD.right), y: clamp(end.y, FIELD.top, FIELD.bottom), power: Math.round(power), spin: clamp(spin, -1, 1) };
}
