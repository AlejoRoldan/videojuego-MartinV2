// =============================================================
// TIRO LIBRE MATEMÁTICO — Game Engine Types
// Design: Pixel Champions (Brawl Stars + Nintendo + Pokémon)
// =============================================================

export type GameScreen =
  | "home"
  | "level-select"
  | "tutorial"
  | "gameplay"
  | "victory"
  | "defeat"
  | "progress"
  | "profile"
  | "unlocks"
  | "rewards";

export type MathConcept =
  | "directions"
  | "coordinates"
  | "multiplication"
  | "cartesian"
  | "angles"
  | "trajectories"
  | "velocity"
  | "tactics";

export type MathChallengeType = "multiplication" | "coordinate" | "angle" | "velocity";
export type MathPower = "precision" | "curve" | "turbo" | "perfect" | null;

export interface Vec2 {
  x: number;
  y: number;
}

export interface BallState {
  position: Vec2;
  velocity: Vec2;
  spin: number;
  power: number;
  inFlight: boolean;
  trail: Vec2[];
}

export interface GoalZone {
  width: number;
  height: number;
  gridMin: Vec2;
  gridMax: Vec2;
}

export interface GoalkeeperState {
  position: Vec2;
  speed: number;
  direction: 1 | -1;
  diving: boolean;
  diveTarget: Vec2 | null;
}

export interface WallPlayer {
  id: number;
  position: Vec2;
  number: number;
}

export interface MathChallenge {
  type: MathChallengeType;
  question: string;
  answer: number;
  options?: number[];
  timeLimit: number;
  hint?: string;
  baseHint?: string;
  assistanceStage?: "calm" | "hint" | "visual" | "urgent";
  retryGranted?: boolean;
}

export interface ShotResult {
  scored: boolean;
  targetCoord: Vec2;
  actualCoord: Vec2;
  mathCorrect: boolean;
  powerUsed: number;
  spinUsed: number;
  savedByKeeper: boolean;
  blockedByWall: boolean;
  trajectoryPoints: Vec2[];
  bonusMultiplier: number;
}

export interface LevelConfig {
  id: number;
  name: string;
  concept: MathConcept;
  description: string;
  shotsRequired: number;
  shotsAllowed: number;
  hasKeeper: boolean;
  keeperSpeed: number;
  hasWall: boolean;
  wallCount: number;
  gridVisible: boolean;
  gridQuadrants: 1 | 4;
  mathDifficulty: "easy" | "medium" | "hard";
  timeBonus: boolean;
  wind: boolean;
  windStrength: number;
  stars: [number, number, number];
  unlockCondition: string;
  rewards: LevelReward;
}

export interface LevelReward {
  xp: number;
  coins: number;
  unlocks?: string[];
}

export interface PlayerProfile {
  name: string;
  level: number;
  xp: number;
  xpToNext: number;
  coins: number;
  stars: number;
  totalGoals: number;
  totalShots: number;
  accuracy: number;
  currentStreak: number;
  bestStreak: number;
  unlockedLevels: number[];
  completedLevels: Record<number, LevelProgress>;
  achievements: string[];
  equippedBall: string;
  equippedKit: string;
}

export interface LevelProgress {
  stars: number;
  bestScore: number;
  attempts: number;
  mathAccuracy: number;
}

export interface AdaptiveDifficulty {
  frustrationScore: number;
  avgResponseTime: number;
  recentErrors: number[];
  currentMultiplier: number;
  hintsEnabled: boolean;
  targetSizeMultiplier: number;
}

export interface GameState {
  screen: GameScreen;
  currentLevel: number | null;
  levelConfig: LevelConfig | null;
  ball: BallState;
  goalkeeper: GoalkeeperState;
  wall: WallPlayer[];
  currentChallenge: MathChallenge | null;
  shotsScored: number;
  shotsTaken: number;
  score: number;
  combo: number;
  maxCombo: number;
  timeElapsed: number;
  phase: "aiming" | "math" | "shooting" | "result" | "celebrating";
  targetCoord: Vec2 | null;
  lastShotResult: ShotResult | null;
  /** Explicit outcome of the latest math interaction for the pending shot. */
  lastMathCorrect: boolean | null;
  adaptiveDifficulty: AdaptiveDifficulty;
  particles: Particle[];
  floatingTexts: FloatingText[];
  currentMathPower: MathPower;
}

export interface Particle {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
  type: "confetti" | "star" | "spark" | "smoke" | "coin";
}

export interface FloatingText {
  id: string;
  text: string;
  x: number;
  y: number;
  color: string;
  size: "sm" | "md" | "lg" | "xl";
  life: number;
  maxLife: number;
}

export type GameAction =
  | { type: "SET_SCREEN"; screen: GameScreen }
  | { type: "START_LEVEL"; levelId: number }
  | { type: "SET_TARGET"; coord: Vec2 }
  | { type: "SUBMIT_MATH"; answer: number; timeLeft?: number; usedRetry?: boolean }
  | { type: "MATH_ASSISTANCE"; stage: "hint" | "visual" | "urgent" }
  | { type: "GRANT_MATH_RETRY"; seconds: number }
  | { type: "SHOOT" }
  | { type: "SHOT_COMPLETE"; result: ShotResult }
  | { type: "NEXT_SHOT" }
  | { type: "LEVEL_COMPLETE" }
  | { type: "LEVEL_FAILED" }
  | { type: "UPDATE_PHYSICS"; dt: number }
  | { type: "ADD_PARTICLES"; particles: Particle[] }
  | { type: "ADD_FLOATING_TEXT"; text: FloatingText }
  | { type: "TICK_PARTICLES" }
  | { type: "UPDATE_ADAPTIVE" }
  | { type: "RESET_GAME" };
