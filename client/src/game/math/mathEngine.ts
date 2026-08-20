// =============================================================
// TIRO LIBRE MATEMÁTICO — Math Engine
// Genera desafíos matemáticos integrados al gameplay
// =============================================================

import type { MathChallenge, LevelConfig, Vec2 } from "../engine/types";
import { getConfiguredTimeLimit } from "../engine/gamePace";
import { coordToGoalPoint, goalPointToCoord } from "../engine/coordinates";

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function generateOptions(answer: number, count = 4, minimum = 0): number[] {
  const opts = new Set<number>([answer]);
  const deltas = [1, 2, 3, 5, 7, 10, -1, -2, -3, -5];
  let attempts = 0;
  while (opts.size < count && attempts < 80) {
    const delta = deltas[Math.floor(Math.random() * deltas.length)];
    const candidate = answer + delta;
    if (candidate >= minimum) opts.add(candidate);
    attempts++;
  }
  let offset = 1;
  while (opts.size < count) {
    const candidate = answer + offset * (answer < minimum ? 1 : 3);
    if (candidate >= minimum) opts.add(candidate);
    offset++;
  }
  return shuffle(Array.from(opts)).slice(0, count);
}

function multiplicationChallenge(
  difficulty: "easy" | "medium" | "hard",
  tableRange?: { min: number; max: number },
): MathChallenge {
  const fallbackRange = difficulty === "easy"
    ? { min: 2, max: 5 }
    : difficulty === "medium"
    ? { min: 2, max: 7 }
    : { min: 6, max: 9 };
  const range = tableRange ?? fallbackRange;
  const a = randomInt(range.min, range.max);
  const b = randomInt(range.min, range.max);
  const answer = a * b;
  return {
    type: "multiplication",
    question: `${a} × ${b} = ?`,
    answer,
    options: generateOptions(answer, 4, 0),
    timeLimit: difficulty === "easy" ? 15 : difficulty === "medium" ? 10 : 8,
    hint: `${a} grupos de ${b}`,
  };
}

function coordinateChallenge(
  difficulty: "easy" | "medium" | "hard",
  quadrants: 1 | 4
): MathChallenge {
  let x: number, y: number;
  if (quadrants === 1) {
    x = randomInt(1, 3);
    y = randomInt(1, 3);
  } else {
    x = randomInt(-3, 3);
    y = randomInt(-3, 3);
    // Zero is a valid axis coordinate; only the quadrant question excludes it below.
  }

  const templates = [
    {
      q: `¿En qué cuadrante está el punto (${x}, ${y})?`,
      a: x > 0 && y > 0 ? 1 : x < 0 && y > 0 ? 2 : x < 0 && y < 0 ? 3 : 4,
      opts: [1, 2, 3, 4],
    },
    {
      q: `Si el balón va a (${x}, ${y}), ¿cuál es su coordenada X?`,
      a: x,
        opts: generateOptions(x, 4, -3),
    },
    {
      q: `Si el balón va a (${x}, ${y}), ¿cuál es su coordenada Y?`,
      a: y,
        opts: generateOptions(y, 4, -3),
    },
  ];

  const validTemplates = x === 0 || y === 0 ? templates.slice(1) : templates;
  const t = validTemplates[randomInt(0, validTemplates.length - 1)];
  return {
    type: "coordinate",
    question: t.q,
    answer: t.a,
    options: t.opts,
    timeLimit: difficulty === "easy" ? 15 : 10,
    hint: "Recuerda: X va horizontal y Y va vertical",
  };
}

function angleChallenge(difficulty: "easy" | "medium" | "hard"): MathChallenge {
  const angles = difficulty === "easy"
    ? [0, 30, 45, 60, 90]
    : difficulty === "medium"
    ? [0, 30, 45, 60, 90, 120, 135, 150, 180]
    : [15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180];

  const angle = angles[randomInt(0, angles.length - 1)];
  const questions = [
    {
      q: `Para curvar el balón ${angle}°, ¿es mayor o menor que 90°?`,
      a: angle > 90 ? 1 : angle < 90 ? -1 : 0,
      opts: [1, -1, 0],
    },
    {
      q: `¿Cuántos grados le faltan a ${angle}° para llegar a 180°?`,
      a: 180 - angle,
      opts: generateOptions(180 - angle),
    },
  ];

  const t = questions[randomInt(0, questions.length - 1)];
  return {
    type: "angle",
    question: t.q,
    answer: t.a,
    options: t.opts,
    timeLimit: difficulty === "easy" ? 15 : 10,
    hint: "Un ángulo recto tiene 90°",
  };
}

function velocityChallenge(difficulty: "easy" | "medium" | "hard"): MathChallenge {
  const speed = randomInt(2, 10);
  const time = randomInt(2, 5);
  const distance = speed * time;

  const questions = [
    {
      q: `El balón va a ${speed} m/s durante ${time} segundos. ¿Cuántos metros recorre?`,
      a: distance,
      opts: generateOptions(distance),
    },
    {
      q: `Si el balón recorre ${distance} metros en ${time} segundos, ¿a qué velocidad va en m/s?`,
      a: speed,
      opts: generateOptions(speed),
    },
  ];

  const t = questions[randomInt(0, 1)];
  return {
    type: "velocity",
    question: t.q,
    answer: t.a,
    options: t.opts,
    timeLimit: difficulty === "hard" ? 8 : 12,
    hint: "Velocidad × Tiempo = Distancia",
  };
}

export function generateChallenge(level: LevelConfig, challengeIndex = 0): MathChallenge {
  const { concept, mathDifficulty, gridQuadrants } = level;
  const configuredType = level.challengeTypes?.length
    ? level.challengeTypes[challengeIndex % level.challengeTypes.length]
    : undefined;
  const challengeType = configuredType ?? (
    concept === "multiplication" || concept === "tactics" ? "multiplication"
      : concept === "coordinates" || concept === "cartesian" || concept === "directions" ? "coordinate"
      : concept === "angles" || concept === "trajectories" ? "angle"
      : "velocity"
  );
  let challenge: MathChallenge;

  switch (challengeType) {
    case "multiplication":
      challenge = multiplicationChallenge(mathDifficulty, level.tableRange);
      break;
    case "coordinate":
      challenge = concept === "directions"
        ? {
            type: "coordinate",
            question: "¿A qué lado de la portería quieres apuntar?",
            answer: 1,
            options: [1, 2, 3, 4],
            timeLimit: 20,
            hint: "Haz clic en la portería donde quieres que entre el balón",
          }
        : coordinateChallenge(mathDifficulty, gridQuadrants);
      break;
    case "angle":
      challenge = angleChallenge(mathDifficulty);
      break;
    case "velocity":
      challenge = velocityChallenge(mathDifficulty);
      break;
    default:
      challenge = multiplicationChallenge(mathDifficulty, level.tableRange);
      break;
  }

  return {
    ...challenge,
    timeLimit: getConfiguredTimeLimit(challenge.timeLimit),
  };
}

export function calculatePowerFromMath(
  answer: number,
  correctAnswer: number,
  timeTaken: number,
  timeLimit: number
): number {
  const mathCorrect = answer === correctAnswer;
  const timeBonus = Math.max(0, 1 - timeTaken / timeLimit);

  if (!mathCorrect) return 40 + Math.random() * 20;
  return 70 + timeBonus * 30;
}

export function updateAdaptiveDifficulty(
  currentMultiplier: number,
  recentErrors: number[],
  avgResponseTime: number,
  timeLimit: number
): { multiplier: number; hintsEnabled: boolean; targetSizeMultiplier: number } {
  const recentErrorRate = recentErrors.length === 0
    ? 0
    : recentErrors.slice(-5).filter(Boolean).length / Math.min(5, recentErrors.length);
  const isStruggling = recentErrorRate > 0.6 || avgResponseTime > timeLimit * 0.9;
  const isExcelling = recentErrorRate < 0.2 && avgResponseTime < timeLimit * 0.5;

  let multiplier = currentMultiplier;
  if (isStruggling) multiplier = Math.max(0.5, multiplier - 0.1);
  else if (isExcelling) multiplier = Math.min(1.5, multiplier + 0.05);

  return {
    multiplier,
    hintsEnabled: isStruggling,
    targetSizeMultiplier: isStruggling ? 1.3 : isExcelling ? 0.85 : 1.0,
  };
}

export function coordToGoalPosition(coord: Vec2, _gridMax: Vec2): Vec2 {
  return coordToGoalPoint(coord, 4);
}

export function goalPositionToCoord(pos: Vec2, _gridMax: Vec2): Vec2 {
  return goalPointToCoord(pos, 4);
}
