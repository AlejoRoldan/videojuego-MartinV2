import "../test/coverageSetup";
import { describe, expect, it } from "vitest";
import { sounds } from "./soundSystem";

describe("sound system resilience", () => {
  it("keeps every gameplay cue safe when Web Audio is unavailable", () => {
    expect(() => {
      sounds.init();
      sounds.whoosh();
      sounds.kick();
      sounds.goal();
      sounds.save();
      sounds.miss();
      sounds.wall();
      sounds.correct();
      sounds.wrong();
      sounds.click();
      sounds.unlock();
      sounds.coinEarned();
      sounds.missionComplete();
    }).not.toThrow();
  });
});
