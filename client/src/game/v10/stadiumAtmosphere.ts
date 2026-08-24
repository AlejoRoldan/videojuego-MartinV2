import type { FootballOutcome } from "./footballCollisions";

export const V10_SOUND_PREFERENCE_KEY = "tlm_v10_sound_enabled";

export type StadiumAudioCue = "goal" | "save" | "wall" | "miss" | "unlock" | "missionComplete";
export type StadiumCelebration = "goal" | "save" | "unlock" | "match" | "none";

export interface StadiumFeedback {
  audioCue: StadiumAudioCue;
  celebration: StadiumCelebration;
  announcer: string;
}

export interface PreferenceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const OUTCOME_FEEDBACK: Record<FootballOutcome, StadiumFeedback> = {
  goal: {
    audioCue: "goal",
    celebration: "goal",
    announcer: "¡Gran definición! El estadio celebra tu remate.",
  },
  saved: {
    audioCue: "save",
    celebration: "save",
    announcer: "El arquero la leyó bien. La próxima busca el rincón contrario.",
  },
  blocked: {
    audioCue: "wall",
    celebration: "none",
    announcer: "La barrera estuvo firme. Prueba un poco más de altura o efecto.",
  },
  post: {
    audioCue: "miss",
    celebration: "none",
    announcer: "¡Por centímetros! Ese remate ya está muy cerca.",
  },
  crossbar: {
    audioCue: "miss",
    celebration: "none",
    announcer: "El travesaño salvó al arquero. Baja apenas la elevación.",
  },
  miss: {
    audioCue: "miss",
    celebration: "none",
    announcer: "Ajusta la dirección y vuelve a intentarlo en el próximo tiro.",
  },
  short: {
    audioCue: "miss",
    celebration: "none",
    announcer: "Faltó potencia. Haz un gesto más largo y decidido.",
  },
};

export function getStadiumFeedback(
  outcome: FootballOutcome,
  options: { matchCompleted?: boolean; advancedUnlocked?: boolean } = {},
): StadiumFeedback {
  if (options.matchCompleted) {
    return {
      audioCue: "missionComplete",
      celebration: "match",
      announcer: "¡Final del partido! Cada remate hizo crecer tu juego.",
    };
  }
  if (options.advancedUnlocked) {
    return {
      audioCue: "unlock",
      celebration: "unlock",
      announcer: "¡Nuevo desafío desbloqueado! Ya puedes jugar con las tablas 6–9.",
    };
  }
  return OUTCOME_FEEDBACK[outcome];
}

export function loadSoundPreference(storage: PreferenceStorage | null): boolean {
  if (!storage) return true;
  try {
    return storage.getItem(V10_SOUND_PREFERENCE_KEY) !== "false";
  } catch {
    return true;
  }
}

export function saveSoundPreference(storage: PreferenceStorage | null, enabled: boolean): boolean {
  if (!storage) return false;
  try {
    storage.setItem(V10_SOUND_PREFERENCE_KEY, String(enabled));
    return true;
  } catch {
    return false;
  }
}
