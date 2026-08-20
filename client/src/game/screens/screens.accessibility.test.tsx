import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const gameContext = vi.hoisted(() => ({
  goToScreen: vi.fn(),
  startLevel: vi.fn(),
  playerProfile: {
    name: "Martín",
    level: 1,
    xp: 0,
    coins: 0,
    stars: 0,
    totalGoals: 0,
    totalShots: 0,
    unlockedLevels: [1],
    completedLevels: {},
    achievements: [],
  },
}));

vi.mock("../engine/GameContext", () => ({
  useGame: () => gameContext,
}));

import HomeScreen from "./HomeScreen";
import LevelSelectScreen from "./LevelSelectScreen";

beforeEach(() => vi.clearAllMocks());

describe("screen accessibility contracts", () => {
  it("renders the primary home actions as semantic buttons", () => {
    const html = renderToStaticMarkup(<HomeScreen />);
    expect(html).toContain("TIRO LIBRE");
    expect(html).toContain("JUGAR");
    expect(html.match(/<button/g)?.length).toBeGreaterThanOrEqual(7);
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain("Ritmo de partido");
  });

  it("announces navigation and level availability", () => {
    const html = renderToStaticMarkup(<LevelSelectScreen />);
    expect(html).toContain('aria-label="Volver al inicio"');
    expect(html).toContain('aria-label="Jugar nivel 1:');
    expect(html).toContain("bloqueado");
    expect(html).toContain("disabled");
  });
});
