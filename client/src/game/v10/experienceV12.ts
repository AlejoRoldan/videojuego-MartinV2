export const V12_WELCOME_SEEN_KEY = "tlm_v12_welcome_seen";

export interface WelcomeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface ClipboardWriter {
  writeText(text: string): Promise<void>;
}

export interface MatchMomentum {
  label: string;
  accent: string;
  intensity: number;
}

export function loadWelcomeSeen(storage: WelcomeStorage | null): boolean {
  if (!storage) return false;
  try {
    return storage.getItem(V12_WELCOME_SEEN_KEY) === "true";
  } catch {
    return false;
  }
}

export function saveWelcomeSeen(storage: WelcomeStorage | null): boolean {
  if (!storage) return false;
  try {
    storage.setItem(V12_WELCOME_SEEN_KEY, "true");
    return true;
  } catch {
    return false;
  }
}

export async function tryWriteClipboard(
  text: string,
  clipboard: ClipboardWriter | null | undefined,
): Promise<boolean> {
  if (!clipboard || typeof clipboard.writeText !== "function") return false;
  try {
    await clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function getMatchMomentum(shotsCompleted: number, firstTryStreak: number): MatchMomentum {
  const safeShots = Math.min(5, Math.max(0, Math.trunc(shotsCompleted)));
  const safeStreak = Math.max(0, Math.trunc(firstTryStreak));
  if (safeShots === 4) return { label: "🔥 REMATE DECISIVO", accent: "#ff7a3d", intensity: 100 };
  if (safeStreak >= 3) return { label: `⚡ RACHA MATEMÁTICA ×${safeStreak}`, accent: "#ffd166", intensity: 88 };
  if (safeStreak === 2) return { label: "🎯 DOS A LA PRIMERA", accent: "#72f2a1", intensity: 68 };
  if (safeShots >= 2) return { label: "🏟️ EL PARTIDO SUBE", accent: "#68c7ff", intensity: 52 + safeShots * 6 };
  return { label: "⚽ PRIMER SILBATAZO", accent: "#dce8e1", intensity: 30 };
}

export function createMatchShareText(input: {
  matchNumber: number;
  stars: number;
  goals: number;
  firstTryCorrect: number;
  origin: string;
}): string {
  const stars = Math.min(3, Math.max(0, Math.trunc(input.stars)));
  const goals = Math.min(5, Math.max(0, Math.trunc(input.goals)));
  const firstTryCorrect = Math.min(5, Math.max(0, Math.trunc(input.firstTryCorrect)));
  return [
    "⚽ Tiro Libre Matemático",
    `Partido ${Math.max(1, Math.trunc(input.matchNumber))}: ${"★".repeat(stars)}${"☆".repeat(3 - stars)}`,
    `${goals} goles · ${firstTryCorrect} multiplicaciones a la primera`,
    "¿Puedes superar mi partido?",
    input.origin,
  ].join("\n");
}
