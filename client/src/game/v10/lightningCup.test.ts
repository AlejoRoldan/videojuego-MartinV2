import { describe, expect, it } from "vitest";
import {
  LIGHTNING_SHOTS_PER_PLAYER,
  V10_LIGHTNING_CUP_KEY,
  clearLightningCup,
  createLightningCup,
  createLightningSeed,
  createLightningShareUrl,
  getActiveLightningPlayer,
  getLightningChallenge,
  getLightningStandings,
  loadLightningCup,
  normalizeLightningCup,
  readLightningInvitation,
  recordLightningShot,
  saveLightningCup,
  type LightningCupStorage,
} from "./lightningCup";

describe("V10 lightning cup", () => {
  it("creates a safe two-player cup with short display names", () => {
    const cup = createLightningCup(["  Martín   Roldán ", ""], { seed: "ABCD23", track: "tables-2-5" });
    expect(cup).toMatchObject({ status: "playing", seed: "ABCD23", activePlayerIndex: 0, roundIndex: 0 });
    expect(cup.players.map((player) => player.name)).toEqual(["Martín Roldán", "Jugador 2"]);
    expect(getActiveLightningPlayer(cup).name).toBe("Martín Roldán");
  });

  it("uses the same multiplication challenge for every player in a round", () => {
    const cup = createLightningCup(["Martín", "Ana", "Leo"], { seed: "MIRROR", track: "tables-2-5" });
    const first = getLightningChallenge(cup);
    const afterMartín = recordLightningShot(cup, { scored: true, firstTry: true, responseTimeMs: 4_000 });
    const afterAna = recordLightningShot(afterMartín, { scored: false, firstTry: true, responseTimeMs: 5_000 });
    expect(getLightningChallenge(afterMartín)).toEqual(first);
    expect(getLightningChallenge(afterAna)).toEqual(first);
    const nextRound = recordLightningShot(afterAna, { scored: true, firstTry: false, responseTimeMs: 8_000 });
    expect(nextRound.roundIndex).toBe(1);
    expect(getLightningChallenge(nextRound).id).not.toBe(first.id);
  });

  it("rotates turns and completes after three shots per player", () => {
    let cup = createLightningCup(["Martín", "Amigo"], { seed: "TURN22" });
    for (let index = 0; index < LIGHTNING_SHOTS_PER_PLAYER * 2; index += 1) {
      cup = recordLightningShot(cup, { scored: index % 2 === 0, firstTry: true, responseTimeMs: 6_000 });
    }
    expect(cup.shots).toHaveLength(6);
    expect(cup.status).toBe("completed");
    expect(recordLightningShot(cup, { scored: true, firstTry: true, responseTimeMs: 1 })).toEqual(cup);
  });

  it("ranks goals before mathematical and speed bonuses", () => {
    let cup = createLightningCup(["Preciso", "Rápido"], { seed: "RANK22" });
    cup = recordLightningShot(cup, { scored: true, firstTry: false, responseTimeMs: 20_000 });
    cup = recordLightningShot(cup, { scored: false, firstTry: true, responseTimeMs: 1_000 });
    const standings = getLightningStandings(cup);
    expect(standings[0]).toMatchObject({ rank: 1, goals: 1, firstTryCorrect: 0 });
    expect(standings[0].player.name).toBe("Preciso");
    expect(standings[1].score).toBeGreaterThan(0);
  });

  it("creates and parses a portable invitation without personal data", () => {
    const url = createLightningShareUrl("https://example.com/juego?old=1", { seed: "ABC234", track: "tables-6-9" });
    const parsedUrl = new URL(url);
    expect(parsedUrl.searchParams.get("v10Demo")).toBe("1");
    expect(parsedUrl.searchParams.get("lightning")).toBe("ABC234");
    expect(url).not.toContain("Martín");
    expect(readLightningInvitation(parsedUrl.search)).toEqual({ seed: "ABC234", track: "tables-6-9" });
    expect(readLightningInvitation("?lightning=***")).toBeNull();
  });

  it("produces deterministic seed characters from an injectable random source", () => {
    const values = [0, 0.1, 0.2, 0.3, 0.4, 0.5];
    expect(createLightningSeed(() => values.shift() ?? 0)).toMatch(/^[A-Z2-9]{6}$/);
  });

  it("normalizes hostile or oversized stored sessions", () => {
    const normalized = normalizeLightningCup({
      seed: "bad seed!",
      track: "unknown",
      players: Array.from({ length: 7 }, (_, index) => ({ name: `  Player ${index + 1} with a very long name  ` })),
      shots: [{ playerId: "p1", roundIndex: 99, scored: true, firstTry: true, responseTimeMs: 999_999 }],
    });
    expect(normalized?.players).toHaveLength(4);
    expect(normalized?.players[0].name.length).toBeLessThanOrEqual(14);
    expect(normalized?.shots[0]).toMatchObject({ roundIndex: 2, responseTimeMs: 120_000 });
    expect(normalized?.track).toBe("tables-2-5");
  });

  it("loads, saves and clears a local cup defensively", () => {
    const values = new Map<string, string>();
    const storage: LightningCupStorage = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => { values.set(key, value); },
      removeItem: (key) => { values.delete(key); },
    };
    const cup = createLightningCup(["Martín", "Amigo"], { seed: "SAVE22" });
    expect(saveLightningCup(storage, cup)).toBe(true);
    expect(values.has(V10_LIGHTNING_CUP_KEY)).toBe(true);
    expect(loadLightningCup(storage)).toEqual(cup);
    expect(clearLightningCup(storage)).toBe(true);
    expect(loadLightningCup(storage)).toBeNull();

    const broken: LightningCupStorage = {
      getItem: () => { throw new Error("blocked"); },
      setItem: () => { throw new Error("blocked"); },
      removeItem: () => { throw new Error("blocked"); },
    };
    expect(loadLightningCup(null)).toBeNull();
    expect(loadLightningCup(broken)).toBeNull();
    expect(saveLightningCup(broken, cup)).toBe(false);
    expect(clearLightningCup(broken)).toBe(false);
  });
});
