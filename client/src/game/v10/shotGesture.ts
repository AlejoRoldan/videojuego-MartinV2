export interface GesturePoint {
  x: number;
  y: number;
  timeMs: number;
}

export interface GestureViewport {
  width: number;
  height: number;
}

export interface LaunchGesture {
  valid: boolean;
  speedMps: number;
  elevationDegrees: number;
  yawDegrees: number;
  force: number;
  reason: "ready" | "too_short" | "must_swipe_up";
}

export interface CurveGesture {
  valid: boolean;
  sidespinRadPerSecond: number;
  strength: number;
  direction: "left" | "right" | "none";
}

const MIN_SWIPE_DISTANCE = 0.1;
const MIN_UPWARD_DISTANCE = 0.075;
const MIN_CURVE_DISTANCE = 0.045;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function validateViewport(viewport: GestureViewport): void {
  if (![viewport.width, viewport.height].every((value) => Number.isFinite(value) && value > 0)) {
    throw new RangeError("gesture viewport must have positive finite dimensions");
  }
}

function normalizedGesture(start: GesturePoint, end: GesturePoint, viewport: GestureViewport) {
  validateViewport(viewport);
  const dx = (end.x - start.x) / viewport.width;
  const upward = (start.y - end.y) / viewport.height;
  const distance = Math.hypot(dx, upward);
  const durationSeconds = clamp((end.timeMs - start.timeMs) / 1000, 0.06, 1.2);
  return { dx, upward, distance, durationSeconds, velocity: distance / durationSeconds };
}

/** Maps the first swipe to a continuous, screen-size-independent launch. */
export function launchFromSwipe(start: GesturePoint, end: GesturePoint, viewport: GestureViewport): LaunchGesture {
  const gesture = normalizedGesture(start, end, viewport);
  if (gesture.distance < MIN_SWIPE_DISTANCE) {
    return { valid: false, speedMps: 16, elevationDegrees: 12, yawDegrees: 0, force: 0, reason: "too_short" };
  }
  if (gesture.upward < MIN_UPWARD_DISTANCE) {
    return { valid: false, speedMps: 16, elevationDegrees: 12, yawDegrees: 0, force: 0, reason: "must_swipe_up" };
  }

  const force = clamp((gesture.velocity - 0.32) / 1.75, 0, 1);
  const verticalShare = clamp(gesture.upward / gesture.distance, 0, 1);
  return {
    valid: true,
    speedMps: 16 + force * 14,
    elevationDegrees: clamp(7 + verticalShare * 6 + gesture.upward * 5, 10, 22),
    yawDegrees: clamp(gesture.dx * 25, -11.5, 11.5),
    force,
    reason: "ready",
  };
}

/** Maps a horizontal in-flight swipe to sidespin in radians per second. */
export function curveFromSwipe(start: GesturePoint, end: GesturePoint, viewport: GestureViewport): CurveGesture {
  const gesture = normalizedGesture(start, end, viewport);
  const horizontalDistance = Math.abs(gesture.dx);
  if (horizontalDistance < MIN_CURVE_DISTANCE) {
    return { valid: false, sidespinRadPerSecond: 0, strength: 0, direction: "none" };
  }
  const horizontalVelocity = horizontalDistance / gesture.durationSeconds;
  const strength = clamp(horizontalDistance * 1.45 + horizontalVelocity * 0.19, 0, 1);
  const direction = gesture.dx > 0 ? "right" : "left";
  return {
    valid: true,
    sidespinRadPerSecond: (direction === "right" ? 1 : -1) * (32 + strength * 88),
    strength,
    direction,
  };
}

export function getForceBand(speedMps: number): "soft" | "controlled" | "powerful" {
  if (speedMps < 20) return "soft";
  if (speedMps < 25) return "controlled";
  return "powerful";
}
