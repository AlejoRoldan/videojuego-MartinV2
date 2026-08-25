import { describe, expect, it, vi } from "vitest";
import {
  CAMPAIGN_PROGRESS_KEY,
  CAMPAIGN_STAGES,
  createCampaignChallenge,
  createCampaignProgress,
  getCampaignCompletionPercent,
  getCampaignTotalStars,
  getNextCampaignStage,
  getStageAimOffsetDegrees,
  isCampaignStageUnlocked,
  loadCampaignProgress,
  normalizeCampaignProgress,
  recordCampaignMatch,
  saveCampaignProgress,
  selectCampaignStage,
} from "./campaignProgress";

describe("phase 13 campaign progression", () => {
  it("defines five visibly different and increasingly distant stages", () => {
    expect(CAMPAIGN_STAGES).toHaveLength(5);
    expect(CAMPAIGN_STAGES.map((stage) => stage.name)).toEqual([
      "Cancha del barrio", "Torneo escolar", "Estadio juvenil", "Copa de la ciudad", "Gran final",
    ]);
    expect(CAMPAIGN_STAGES.map((stage) => stage.distanceM)).toEqual([16.2, 18.3, 19.5, 20.8, 22.4]);
    expect(new Set(CAMPAIGN_STAGES.map((stage) => stage.positionLabel)).size).toBe(5);
    expect(new Set(CAMPAIGN_STAGES.map((stage) => stage.theme)).size).toBe(5);
  });

  it("starts at the neighborhood pitch with later stages locked", () => {
    const progress = createCampaignProgress();
    expect(progress.currentStageId).toBe("barrio");
    expect(isCampaignStageUnlocked(progress, "barrio")).toBe(true);
    expect(isCampaignStageUnlocked(progress, "escolar")).toBe(false);
    expect(getCampaignTotalStars(progress)).toBe(0);
    expect(getCampaignCompletionPercent(progress)).toBe(0);
  });

  it("unlocks the next stage on completion and never loses best stars", () => {
    const first = recordCampaignMatch(createCampaignProgress(), "barrio", 2);
    expect(first.highestUnlockedIndex).toBe(1);
    expect(first.stages.barrio).toEqual({ bestStars: 2, matchesCompleted: 1 });
    expect(isCampaignStageUnlocked(first, "escolar")).toBe(true);

    const replay = recordCampaignMatch(first, "barrio", 1);
    expect(replay.stages.barrio).toEqual({ bestStars: 2, matchesCompleted: 2 });
    const improved = recordCampaignMatch(replay, "barrio", 3);
    expect(improved.stages.barrio?.bestStars).toBe(3);
    expect(getCampaignTotalStars(improved)).toBe(3);
    expect(getCampaignCompletionPercent(improved)).toBe(20);
  });

  it("rejects locked selections and exposes the correct next stage", () => {
    const initial = createCampaignProgress();
    expect(selectCampaignStage(initial, "gran-final").currentStageId).toBe("barrio");
    const unlocked = recordCampaignMatch(initial, "barrio", 1);
    expect(selectCampaignStage(unlocked, "escolar").currentStageId).toBe("escolar");
    expect(getNextCampaignStage("barrio")?.id).toBe("escolar");
    expect(getNextCampaignStage("gran-final")).toBeNull();
  });

  it("focuses each stage on its table and aims diagonal positions toward goal", () => {
    const tableThree = createCampaignChallenge(CAMPAIGN_STAGES[1], 3);
    expect(tableThree.a).toBe(3);
    expect(tableThree.answer).toBe(tableThree.a * tableThree.b);
    expect(createCampaignChallenge(CAMPAIGN_STAGES[4], 0).a).toBe(2);
    expect(createCampaignChallenge(CAMPAIGN_STAGES[4], 1).a).toBe(3);
    expect(getStageAimOffsetDegrees(CAMPAIGN_STAGES[1])).toBeLessThan(0);
    expect(getStageAimOffsetDegrees(CAMPAIGN_STAGES[2])).toBeGreaterThan(0);
  });

  it("persists defensively and derives unlocks from completed records", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: vi.fn((key: string) => values.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => values.set(key, value)),
    };
    const damaged = normalizeCampaignProgress({
      currentStageId: "gran-final",
      highestUnlockedIndex: -8,
      stages: { barrio: { bestStars: 99, matchesCompleted: 1 }, escolar: { bestStars: "bad", matchesCompleted: -4 } },
    });
    expect(damaged.currentStageId).toBe("escolar");
    expect(damaged.highestUnlockedIndex).toBe(1);
    expect(damaged.stages.barrio?.bestStars).toBe(3);
    expect(saveCampaignProgress(storage, damaged)).toBe(true);
    expect(storage.setItem).toHaveBeenCalledWith(CAMPAIGN_PROGRESS_KEY, expect.any(String));
    expect(loadCampaignProgress(storage)).toEqual(damaged);
    expect(loadCampaignProgress({ getItem: () => { throw new Error("blocked"); }, setItem: () => undefined })).toEqual(createCampaignProgress());
  });
});
