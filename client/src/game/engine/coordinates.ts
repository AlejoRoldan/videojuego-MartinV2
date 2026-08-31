import type { Vec2 } from "./types";

export type GridQuadrants = 1 | 4;

export interface GridBounds {
  min: number;
  max: number;
  size: number;
}

export function getGridBounds(gridQuadrants: GridQuadrants): GridBounds {
  const min = gridQuadrants === 4 ? -3 : 1;
  const max = 3;
  return { min, max, size: max - min + 1 };
}

function clampUnit(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/**
 * Converts a coordinate cell to its normalized visual center.
 * The normalized Y axis grows downwards because it is consumed by the DOM.
 */
export function coordToGoalPoint(coord: Vec2, gridQuadrants: GridQuadrants): Vec2 {
  const { min, size } = getGridBounds(gridQuadrants);
  return {
    x: (coord.x - min + 0.5) / size,
    y: 1 - (coord.y - min + 0.5) / size,
  };
}

/**
 * Converts a normalized visual point back to the nearest represented grid cell.
 */
export function goalPointToCoord(point: Vec2, gridQuadrants: GridQuadrants): Vec2 {
  const { min, size } = getGridBounds(gridQuadrants);
  const xIndex = Math.min(size - 1, Math.floor(clampUnit(point.x) * size));
  const yIndex = Math.min(size - 1, Math.floor(clampUnit(1 - point.y) * size));
  return {
    x: min + xIndex,
    y: min + yIndex,
  };
}

export function clampGoalPoint(point: Vec2, padding = 0.02): Vec2 {
  return {
    x: Math.max(padding, Math.min(1 - padding, point.x)),
    y: Math.max(padding, Math.min(1 - padding, point.y)),
  };
}

export function isInsideGoal(point: Vec2): boolean {
  return point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1;
}
