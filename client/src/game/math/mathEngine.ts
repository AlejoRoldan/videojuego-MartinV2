// =============================================================
// TIRO LIBRE MATEMÁTICO — Math Engine
// Genera desafíos matemáticos integrados al gameplay
// =============================================================

import type { MathChallenge, LevelConfig, Vec2 } from "../engine/types";

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

function generateOptions(answer: number, count = 4): number[] {
  const opts = new Set<number>([answer]);
  const deltas = [1, 2, 3, 5, 7, 10, -1, -2, -3, -5];
  let attempts = 0;
  while (opts.size < count && attempts < 50) {
    const delta = deltas[Math.floor(Math.random() * deltas.length)];
    const candidate = answer + delta;
    if (candidate > 0) opts.add(candidate);
    attempts++;
  }
  // fill if needed
  while (opts.size < count) {
    opts.add(answer + opts.size * 3);
  }
  return shuffle(Array.from(opts)).slice(0, count);
}

// ── Multiplication Challenges ────────────────────────────────
function multiplicationChallenge(difficulty: "easy" | "medium" | "hard"): MathChallenge {
  let a: number, b: number;
  if (difficulty === "easy") {
    a = randomInt(2, 5);
    b = randomInt(2, 5);
  } else if (difficulty === "medium") {
    a = randomInt(2, 7);
    b = randomInt(2, 7);
  } else {
    a = randomInt(6, 9);
    b = randomInt(6, 9);
  }
  const answer = a * b;
  return {
    type: "multiplication",
    question: `${a} × ${b} = ?`,
    answer,
    options: generateOptions(answer),
    timeLimit: difficulty === "easy" ? 15 : difficulty === "medium" ? 10 : 8,
    hint: `${a} grupos de ${b}`,
  };
}

// ── Coordinate Challenges ────────────────────────────────────
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
    if (x === 0) x = 1;
    if (y === 0) y = 1;
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
      opts: generateOptions(x),
    },
    {
      q: `Si el balón va a (${x}, ${y}), ¿cuál es su coordenada Y?`,
      a: y,
      opts: generateOptions(y),
    },
  ];

  const t = templates[randomInt(0, templates.length - 1)];
  return {
    type: "coordinate",
    question: t.q,
    answer: t.a,
    options: t.opts,
    timeLimit: difficulty === "easy" ? 15 : 10,
    hint: `Recuerda: (X va horizontal, Y va vertical)`,
  };
}

// ── Angle Challenges ─────────────────────────────────────────
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
    hint: `Un ángulo recto tiene 90°`,
  };
}

// ── Velocity Challenges ──────────────────────────────────────
function velocityChallenge(difficulty: "easy" | "medium" | "hard"): MathChallenge {
  const speed = randomInt(5, 20) * 5;
  const time = randomInt(2, 5);
  const distance = speed * time;

  const questions = [
    {
      q: `El balón va a ${speed} km/h durante ${time} segundos. ¿Cuántos metros recorre? (1 seg = 1 metro aquí)`,
      a: distance,
      opts: generateOptions(distance),
    },
    {
      q: `Si el balón recorre ${distance} metros en ${time} segundos, ¿a qué velocidad va?`,
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
    hint: `Velocidad × Tiempo = Distancia`,
  };
}

// ── Main Generator ───────────────────────────────────────────
export function generateChallenge(level: LevelConfig): MathChallenge {
  const { concept, mathDifficulty, gridQuadrants } = level;

  switch (concept) {
    case "multiplication":
    case "tactics":
      return multiplicationChallenge(mathDifficulty);

    case "coordinates":
    case "cartesian":
      return coordinateChallenge(mathDifficulty, gridQuadrants);

    case "angles":
      return angleChallenge(mathDifficulty);

    case "velocity":
      return velocityChallenge(mathDifficulty);

    case "directions":
      // Very simple: just pick a direction
      return {
        type: "coordinate",
        question: "¿A qué lado de la portería quieres apuntar?",
        answer: 1,
        options: [1, 2, 3, 4],
        timeLimit: 20,
        hint: "Haz clic en la portería donde quieres que entre el balón",
      };

    case "trajectories":
      // Mix of multiplication and angles
      return Math.random() > 0.5
        ? multiplicationChallenge(mathDifficulty)
        : angleChallenge(mathDifficulty);

    default:
      return multiplicationChallenge(mathDifficulty);
  }
}

// ── Power Calculator ─────────────────────────────────────────
export function calculatePowerFromMath(
  answer: number,
  correctAnswer: number,
  timeTaken: number,
  timeLimit: number
): number {
  const mathCorrect = answer === correctAnswer;
  const timeBonus = Math.max(0, 1 - timeTaken / timeLimit);

  if (!mathCorrect) return 40 + Math.random() * 20; // 40-60% power on wrong answer
  return 70 + timeBonus * 30; // 70-100% power on correct answer
}

// ── Adaptive Difficulty ──────────────────────────────────────
export function updateAdaptiveDifficulty(
  currentMultiplier: number,
  recentErrors: number[],
  avgResponseTime: number,
  timeLimit: number
): { multiplier: number; hintsEnabled: boolean; targetSizeMultiplier: number } {
  const recentErrorRate =
    recentErrors.slice(-5).filter(Boolean).length / Math.min(5, recentErrors.length);
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

// ── Coordinate to Goal Position ──────────────────────────────
export function coordToGoalPosition(coord: Vec2, gridMax: Vec2): Vec2 {
  // Normalize coord to 0-1 range within goal
  return {
    x: (coord.x + gridMax.x) / (gridMax.x * 2),
    y: (coord.y + gridMax.y) / (gridMax.y * 2),
  };
}

export function goalPositionToCoord(pos: Vec2, gridMax: Vec2): Vec2 {
  return {
    x: Math.round(pos.x * gridMax.x * 2 - gridMax.x),
    y: Math.round(pos.y * gridMax.y * 2 - gridMax.y),
  };
}
