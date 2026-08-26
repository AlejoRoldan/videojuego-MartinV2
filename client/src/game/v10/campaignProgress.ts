import type { DefenseMode } from "./footballCollisions";
import { createMultiplicationChallengeForFactors, type MultiplicationChallengeV10 } from "./multiplicationRound";

export const CAMPAIGN_PROGRESS_KEY = "tlm_v13_campaign_progress_v1";

export type CampaignStageId = "barrio" | "escolar" | "juvenil" | "ciudad" | "gran-final";
export type StadiumThemeId = "sunset" | "school" | "night" | "city" | "final";

export interface CampaignStage {
  id: CampaignStageId;
  number: number;
  name: string;
  competition: string;
  tableLabel: string;
  focusFactors: readonly number[];
  distanceM: number;
  startXM: number;
  positionLabel: string;
  defense: DefenseMode;
  defenseLabel: string;
  technicalSkill: string;
  objective: string;
  accent: string;
  theme: StadiumThemeId;
}

export interface CampaignStageRecord {
  bestStars: number;
  matchesCompleted: number;
}

export interface CampaignProgressV1 {
  version: 1;
  currentStageId: CampaignStageId;
  highestUnlockedIndex: number;
  stages: Partial<Record<CampaignStageId, CampaignStageRecord>>;
}

export interface CampaignStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const CAMPAIGN_STAGES: readonly CampaignStage[] = Object.freeze([
  { id: "barrio", number: 1, name: "Cancha del barrio", competition: "Primer silbatazo", tableLabel: "Tabla del 2", focusFactors: [2], distanceM: 16.2, startXM: 0, positionLabel: "Frontal", defense: "open", defenseLabel: "Arco libre", technicalSkill: "Control de fuerza", objective: "Encuentra la fuerza justa y completa tu primer partido.", accent: "#72f2a1", theme: "sunset" },
  { id: "escolar", number: 2, name: "Torneo escolar", competition: "Fase de grupos", tableLabel: "Tabla del 3", focusFactors: [3], distanceM: 18.3, startXM: 1.7, positionLabel: "Diagonal derecha", defense: "keeper", defenseLabel: "Arquero juvenil", technicalSkill: "Dirección", objective: "Apunta lejos del arquero desde un nuevo ángulo.", accent: "#68c7ff", theme: "school" },
  { id: "juvenil", number: 3, name: "Estadio juvenil", competition: "Cuartos de final", tableLabel: "Tabla del 4", focusFactors: [4], distanceM: 19.5, startXM: -2.1, positionLabel: "Diagonal izquierda", defense: "wall", defenseLabel: "Barrera de tres", technicalSkill: "Altura", objective: "Supera la barrera combinando altura y potencia.", accent: "#c89bff", theme: "night" },
  { id: "ciudad", number: 4, name: "Copa de la ciudad", competition: "Semifinal", tableLabel: "Tabla del 5", focusFactors: [5], distanceM: 20.8, startXM: 2.5, positionLabel: "Ángulo cerrado", defense: "keeper", defenseLabel: "Arquero experto", technicalSkill: "Curva", objective: "Usa el segundo gesto para llevar el balón al rincón.", accent: "#ff9f68", theme: "city" },
  { id: "gran-final", number: 5, name: "Gran final", competition: "Partido por la copa", tableLabel: "Tablas 2–5", focusFactors: [2, 3, 4, 5], distanceM: 22.4, startXM: -2.8, positionLabel: "Larga distancia", defense: "wall", defenseLabel: "Barrera decisiva", technicalSkill: "Dominio total", objective: "Combina cálculo, fuerza, dirección y curva para levantar la copa.", accent: "#ffd166", theme: "final" },
]);

function clampStars(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(3, Math.max(0, Math.trunc(value))) : 0;
}

function clampMatches(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
}

export function createCampaignProgress(): CampaignProgressV1 {
  return { version: 1, currentStageId: "barrio", highestUnlockedIndex: 0, stages: {} };
}

export function normalizeCampaignProgress(value: unknown): CampaignProgressV1 {
  const candidate = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const rawStages = candidate.stages && typeof candidate.stages === "object" && !Array.isArray(candidate.stages)
    ? candidate.stages as Record<string, unknown>
    : {};
  const stages: CampaignProgressV1["stages"] = {};
  CAMPAIGN_STAGES.forEach((stage) => {
    const record = rawStages[stage.id];
    if (!record || typeof record !== "object" || Array.isArray(record)) return;
    const values = record as Record<string, unknown>;
    const bestStars = clampStars(values.bestStars);
    const matchesCompleted = clampMatches(values.matchesCompleted);
    if (bestStars > 0 || matchesCompleted > 0) stages[stage.id] = { bestStars, matchesCompleted };
  });
  const derivedUnlocked = Math.min(CAMPAIGN_STAGES.length - 1, Math.max(0, ...Object.entries(stages).map(([id, record]) => {
    const index = CAMPAIGN_STAGES.findIndex((stage) => stage.id === id);
    return record && record.matchesCompleted > 0 ? index + 1 : 0;
  })));
  const requestedUnlocked = typeof candidate.highestUnlockedIndex === "number" && Number.isFinite(candidate.highestUnlockedIndex)
    ? Math.min(CAMPAIGN_STAGES.length - 1, Math.max(0, Math.trunc(candidate.highestUnlockedIndex)))
    : 0;
  const highestUnlockedIndex = Math.max(derivedUnlocked, requestedUnlocked);
  const requestedId = typeof candidate.currentStageId === "string" ? candidate.currentStageId : "";
  const requestedIndex = CAMPAIGN_STAGES.findIndex((stage) => stage.id === requestedId);
  const currentStageId = requestedIndex >= 0 && requestedIndex <= highestUnlockedIndex
    ? CAMPAIGN_STAGES[requestedIndex].id
    : CAMPAIGN_STAGES[highestUnlockedIndex].id;
  return { version: 1, currentStageId, highestUnlockedIndex, stages };
}

export function loadCampaignProgress(storage: CampaignStorage | null): CampaignProgressV1 {
  if (!storage) return createCampaignProgress();
  try {
    const raw = storage.getItem(CAMPAIGN_PROGRESS_KEY);
    return raw ? normalizeCampaignProgress(JSON.parse(raw)) : createCampaignProgress();
  } catch {
    return createCampaignProgress();
  }
}

export function saveCampaignProgress(storage: CampaignStorage | null, progress: CampaignProgressV1): boolean {
  if (!storage) return false;
  try {
    storage.setItem(CAMPAIGN_PROGRESS_KEY, JSON.stringify(normalizeCampaignProgress(progress)));
    return true;
  } catch {
    return false;
  }
}

export function getCampaignStage(stageId: CampaignStageId): CampaignStage {
  return CAMPAIGN_STAGES.find((stage) => stage.id === stageId) ?? CAMPAIGN_STAGES[0];
}

export function getCampaignTotalStars(progress: CampaignProgressV1): number {
  const normalized = normalizeCampaignProgress(progress);
  return CAMPAIGN_STAGES.reduce((total, stage) => total + (normalized.stages[stage.id]?.bestStars ?? 0), 0);
}

export function getCampaignCompletionPercent(progress: CampaignProgressV1): number {
  return Math.round(getCampaignTotalStars(progress) / (CAMPAIGN_STAGES.length * 3) * 100);
}

export function isCampaignStageUnlocked(progress: CampaignProgressV1, stageId: CampaignStageId): boolean {
  const index = CAMPAIGN_STAGES.findIndex((stage) => stage.id === stageId);
  return index >= 0 && index <= normalizeCampaignProgress(progress).highestUnlockedIndex;
}

export function selectCampaignStage(progress: CampaignProgressV1, stageId: CampaignStageId): CampaignProgressV1 {
  const normalized = normalizeCampaignProgress(progress);
  return isCampaignStageUnlocked(normalized, stageId) ? { ...normalized, currentStageId: stageId } : normalized;
}

export function recordCampaignMatch(progress: CampaignProgressV1, stageId: CampaignStageId, stars: number): CampaignProgressV1 {
  const normalized = normalizeCampaignProgress(progress);
  const stageIndex = CAMPAIGN_STAGES.findIndex((stage) => stage.id === stageId);
  if (stageIndex < 0 || stageIndex > normalized.highestUnlockedIndex) return normalized;
  const previous = normalized.stages[stageId] ?? { bestStars: 0, matchesCompleted: 0 };
  return {
    ...normalized,
    highestUnlockedIndex: Math.min(CAMPAIGN_STAGES.length - 1, Math.max(normalized.highestUnlockedIndex, stageIndex + 1)),
    stages: {
      ...normalized.stages,
      [stageId]: { bestStars: Math.max(previous.bestStars, clampStars(stars)), matchesCompleted: previous.matchesCompleted + 1 },
    },
  };
}

export function getNextCampaignStage(stageId: CampaignStageId): CampaignStage | null {
  const index = CAMPAIGN_STAGES.findIndex((stage) => stage.id === stageId);
  return index >= 0 ? CAMPAIGN_STAGES[index + 1] ?? null : null;
}

export function createCampaignChallenge(stage: CampaignStage, sequenceIndex: number): MultiplicationChallengeV10 {
  const safeIndex = Number.isFinite(sequenceIndex) ? Math.max(0, Math.trunc(sequenceIndex)) : 0;
  const factor = stage.focusFactors[safeIndex % stage.focusFactors.length] ?? 2;
  const partner = 2 + Math.floor(safeIndex / stage.focusFactors.length) % 4;
  return createMultiplicationChallengeForFactors(factor, partner, safeIndex, "tables-2-5");
}

export function getStageAimOffsetDegrees(stage: CampaignStage): number {
  return Math.atan2(-stage.startXM, stage.distanceM) * 180 / Math.PI;
}

