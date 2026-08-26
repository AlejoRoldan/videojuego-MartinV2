import { describe, expect, it, vi } from "vitest";
import {
  V12_WELCOME_SEEN_KEY,
  createMatchShareText,
  getMatchMomentum,
  loadWelcomeSeen,
  saveWelcomeSeen,
  tryWriteClipboard,
} from "./experienceV12";

describe("phase 12 complete experience", () => {
  it("stores the welcome only after the player chooses a mode", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: vi.fn((key: string) => values.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => values.set(key, value)),
    };

    expect(loadWelcomeSeen(storage)).toBe(false);
    expect(saveWelcomeSeen(storage)).toBe(true);
    expect(storage.setItem).toHaveBeenCalledWith(V12_WELCOME_SEEN_KEY, "true");
    expect(loadWelcomeSeen(storage)).toBe(true);
  });

  it("fails safely when browser storage is unavailable", () => {
    expect(loadWelcomeSeen(null)).toBe(false);
    expect(saveWelcomeSeen(null)).toBe(false);
    expect(loadWelcomeSeen({ getItem: () => { throw new Error("blocked"); }, setItem: () => undefined })).toBe(false);
    expect(saveWelcomeSeen({ getItem: () => null, setItem: () => { throw new Error("full"); } })).toBe(false);
  });

  it("reports clipboard success only after the browser confirms the write", async () => {
    const writeText = vi.fn(async () => undefined);
    expect(await tryWriteClipboard("reto", { writeText })).toBe(true);
    expect(writeText).toHaveBeenCalledWith("reto");
    expect(await tryWriteClipboard("reto", null)).toBe(false);
    expect(await tryWriteClipboard("reto", { writeText: async () => { throw new Error("blocked"); } })).toBe(false);
  });

  it("raises match intensity without overriding the decisive fifth shot", () => {
    expect(getMatchMomentum(0, 0)).toMatchObject({ label: "⚽ PRIMER SILBATAZO", intensity: 30 });
    expect(getMatchMomentum(2, 0).label).toBe("🏟️ EL PARTIDO SUBE");
    expect(getMatchMomentum(3, 2).label).toBe("🎯 DOS A LA PRIMERA");
    expect(getMatchMomentum(3, 4).label).toBe("⚡ RACHA MATEMÁTICA ×4");
    expect(getMatchMomentum(4, 7)).toMatchObject({ label: "🔥 REMATE DECISIVO", intensity: 100 });
  });

  it("creates a bounded result challenge without private room credentials", () => {
    const text = createMatchShareText({
      matchNumber: 0,
      stars: 8,
      goals: 99,
      firstTryCorrect: -2,
      origin: "https://game.example",
    });

    expect(text).toContain("Partido 1: ★★★");
    expect(text).toContain("5 goles · 0 multiplicaciones a la primera");
    expect(text).toContain("¿Puedes superar mi partido?");
    expect(text).toContain("https://game.example");
    expect(text).not.toContain("token");
    expect(text).not.toContain("playerId");
  });
});
