import { clamp } from './physics.mjs';

export const CHARGE_MIN = 30;
export const CHARGE_MAX = 100;
export const CHARGE_DURATION_MS = 1200;

// Charging is time-based but resolution remains deterministic: the released
// value is stored in ShotInput and is the only power value used by physics.
export function chargePower(elapsedMs) {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) throw new RangeError('Invalid charge time');
  const progress = clamp(elapsedMs / CHARGE_DURATION_MS, 0, 1);
  return Math.round(CHARGE_MIN + (CHARGE_MAX - CHARGE_MIN) * progress);
}

// Mathematics changes the size of the precision window, never the result.
// A clean answer rewards learning with more execution tolerance.
export function perfectWindow(match) {
  if (!match || !Array.isArray(match.wrong)) throw new TypeError('Invalid match');
  if (match.wrong.length) return Object.freeze({ min: 76, max: 82, kind: 'narrow' });
  if (match.helped) return Object.freeze({ min: 73, max: 85, kind: 'assisted' });
  return Object.freeze({ min: 68, max: 88, kind: 'clean' });
}

export function powerGrade(power, window) {
  if (!Number.isFinite(power) || !window || !Number.isFinite(window.min) || !Number.isFinite(window.max)) throw new RangeError('Invalid power grade');
  if (power < 60) return 'low';
  if (power >= window.min && power <= window.max) return 'perfect';
  if (power > 90) return 'over';
  return 'controlled';
}
