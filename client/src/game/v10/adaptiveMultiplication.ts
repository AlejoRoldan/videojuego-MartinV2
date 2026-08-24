import {
  createMultiplicationChallengeForFactors,
  MULTIPLICATION_TRACKS,
  type MultiplicationChallengeV10,
  type MultiplicationTrack,
} from "./multiplicationRound";
import {
  getMultiplicationFactKey,
  type MultiplicationFactProgress,
  type MultiplicationProgressV2,
} from "./multiplicationProgress";

export type AdaptivePracticeMode = "explore" | "reinforce" | "balance" | "challenge";

export interface AdaptiveMultiplicationSelection {
  challenge: MultiplicationChallengeV10;
  factKey: string;
  mode: AdaptivePracticeMode;
  message: string;
  priority: number;
}

interface FactCandidate {
  a: number;
  b: number;
  factKey: string;
  order: number;
  priority: number;
  stats?: MultiplicationFactProgress;
}

const MODE_MESSAGES: Record<AdaptivePracticeMode, string> = {
  explore: "Descubre una combinación nueva",
  reinforce: "Repite para volverla automática",
  balance: "Mantén fresca esta combinación",
  challenge: "Pon a prueba tu precisión",
};

export function getFactPracticeMode(stats?: MultiplicationFactProgress): AdaptivePracticeMode {
  if (!stats || stats.attempts === 0) return "explore";
  const recentAccuracy = stats.recentFirstTry.length === 0
    ? stats.firstTryCorrect / stats.attempts
    : stats.recentFirstTry.filter(Boolean).length / stats.recentFirstTry.length;
  if (recentAccuracy < 0.6) return "reinforce";
  if (stats.attempts >= 3 && recentAccuracy >= 0.8) return "challenge";
  return "balance";
}

function factPriority(
  stats: MultiplicationFactProgress | undefined,
  roundsCompleted: number,
  isLastFact: boolean,
): number {
  if (!stats || stats.attempts === 0) return 120 - (isLastFact ? 100 : 0);
  const accuracy = stats.recentFirstTry.length === 0
    ? stats.firstTryCorrect / stats.attempts
    : stats.recentFirstTry.filter(Boolean).length / stats.recentFirstTry.length;
  const spacing = Math.min(8, Math.max(0, roundsCompleted - stats.lastPlayedRound));
  const assistedRatio = stats.assistedCorrect / Math.max(1, stats.attempts);
  return (1 - accuracy) * 90 + spacing * 6 + assistedRatio * 12 - (isLastFact ? 70 : 0);
}

export function selectAdaptiveMultiplicationChallenge(
  progress: MultiplicationProgressV2,
  track: MultiplicationTrack,
): AdaptiveMultiplicationSelection {
  const trackProgress = progress.tracks[track];
  const { minimum, maximum } = MULTIPLICATION_TRACKS[track];
  const candidates: FactCandidate[] = [];
  let order = 0;
  for (let a = minimum; a <= maximum; a += 1) {
    for (let b = minimum; b <= maximum; b += 1) {
      const factKey = getMultiplicationFactKey(a, b);
      const stats = trackProgress.facts[factKey];
      candidates.push({
        a,
        b,
        factKey,
        order,
        stats,
        priority: factPriority(stats, trackProgress.roundsCompleted, factKey === trackProgress.lastFactKey),
      });
      order += 1;
    }
  }
  const rotation = trackProgress.roundsCompleted % candidates.length;
  candidates.sort((left, right) => {
    if (Math.abs(right.priority - left.priority) > 0.0001) return right.priority - left.priority;
    const leftRotated = (left.order - rotation + candidates.length) % candidates.length;
    const rightRotated = (right.order - rotation + candidates.length) % candidates.length;
    return leftRotated - rightRotated;
  });
  const selected = candidates[0];
  const mode = getFactPracticeMode(selected.stats);
  return {
    challenge: createMultiplicationChallengeForFactors(selected.a, selected.b, trackProgress.roundsCompleted, track),
    factKey: selected.factKey,
    mode,
    message: MODE_MESSAGES[mode],
    priority: Number(selected.priority.toFixed(2)),
  };
}
