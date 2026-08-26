export type MultiplicationTrack = "tables-2-5" | "tables-6-9";
export type MultiplicationAssistance = "none" | "groups" | "addition";

export interface MultiplicationChallengeV10 {
  id: string;
  track: MultiplicationTrack;
  sequenceIndex: number;
  a: number;
  b: number;
  answer: number;
  options: number[];
  question: string;
}

export interface MultiplicationEvaluation {
  correct: boolean;
  solved: boolean;
  firstTry: boolean;
  nextAttempt: number;
  assistance: MultiplicationAssistance;
  feedback: string;
}

export const MULTIPLICATION_TRACKS = Object.freeze({
  "tables-2-5": { minimum: 2, maximum: 5, label: "Tablas 2–5" },
  "tables-6-9": { minimum: 6, maximum: 9, label: "Tablas 6–9" },
} satisfies Record<MultiplicationTrack, { minimum: number; maximum: number; label: string }>);

function rotate<T>(values: readonly T[], amount: number): T[] {
  if (values.length === 0) return [];
  const offset = ((amount % values.length) + values.length) % values.length;
  return [...values.slice(offset), ...values.slice(0, offset)];
}

function createOptions(answer: number, a: number, b: number, sequenceIndex: number): number[] {
  const candidates = [
    answer,
    answer - a,
    answer + a,
    answer - b,
    answer + b,
    answer - 1,
    answer + 1,
    answer + 2,
  ];
  const unique = candidates.filter((value, index) => value >= 0 && candidates.indexOf(value) === index).slice(0, 4);
  let offset = 3;
  while (unique.length < 4) {
    const candidate = answer + offset;
    if (!unique.includes(candidate)) unique.push(candidate);
    offset += 1;
  }
  return rotate(unique, sequenceIndex % unique.length);
}

/** Builds a challenge for an exact fact while keeping distractors deterministic. */
export function createMultiplicationChallengeForFactors(
  a: number,
  b: number,
  sequenceIndex: number,
  track: MultiplicationTrack,
): MultiplicationChallengeV10 {
  const safeIndex = Number.isFinite(sequenceIndex) ? Math.max(0, Math.trunc(sequenceIndex)) : 0;
  const range = MULTIPLICATION_TRACKS[track];
  const safeA = Number.isFinite(a) ? Math.min(range.maximum, Math.max(range.minimum, Math.trunc(a))) : range.minimum;
  const safeB = Number.isFinite(b) ? Math.min(range.maximum, Math.max(range.minimum, Math.trunc(b))) : range.minimum;
  const answer = safeA * safeB;
  return {
    id: `${track}-${safeA}x${safeB}-${safeIndex}`,
    track,
    sequenceIndex: safeIndex,
    a: safeA,
    b: safeB,
    answer,
    options: createOptions(answer, safeA, safeB, safeIndex),
    question: `${safeA} × ${safeB} = ?`,
  };
}

/** Produces a repeatable 16-challenge cycle for each table track. */
export function createMultiplicationChallenge(
  sequenceIndex: number,
  track: MultiplicationTrack,
): MultiplicationChallengeV10 {
  const safeIndex = Number.isFinite(sequenceIndex) ? Math.max(0, Math.trunc(sequenceIndex)) : 0;
  const range = MULTIPLICATION_TRACKS[track];
  const span = range.maximum - range.minimum + 1;
  const cycleIndex = safeIndex % (span * span);
  const a = range.minimum + cycleIndex % span;
  const b = range.minimum + (Math.floor(cycleIndex / span) + cycleIndex * 2 + 1) % span;
  return createMultiplicationChallengeForFactors(a, b, safeIndex, track);
}

function repeatedAddition(challenge: MultiplicationChallengeV10): string {
  return Array.from({ length: challenge.a }, () => String(challenge.b)).join(" + ");
}

/** Evaluates without timers or randomness; help becomes more concrete after each miss. */
export function evaluateMultiplicationAnswer(
  challenge: MultiplicationChallengeV10,
  selectedAnswer: number,
  currentAttempt: number,
): MultiplicationEvaluation {
  const safeAttempt = Number.isFinite(currentAttempt) ? Math.max(0, Math.trunc(currentAttempt)) : 0;
  if (selectedAnswer === challenge.answer) {
    return {
      correct: true,
      solved: true,
      firstTry: safeAttempt === 0,
      nextAttempt: safeAttempt + 1,
      assistance: safeAttempt === 0 ? "none" : safeAttempt === 1 ? "groups" : "addition",
      feedback: safeAttempt === 0 ? "¡Exacto! Precisión habilitada." : "¡Lo encontraste! Ahora viene el remate.",
    };
  }
  const assistance: MultiplicationAssistance = safeAttempt === 0 ? "groups" : "addition";
  return {
    correct: false,
    solved: false,
    firstTry: false,
    nextAttempt: safeAttempt + 1,
    assistance,
    feedback: assistance === "groups"
      ? `Piensa en ${challenge.a} grupos de ${challenge.b}.`
      : `${challenge.a} × ${challenge.b} es ${repeatedAddition(challenge)}.`,
  };
}
