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

export interface Vec2 {
  x: number;
  y: number;
}

export interface BallState {
  position: Vec2;
  velocity: Vec2;
  spin: number; // -1 to 1 (left/right curve)
  power: number; // 0 to 100
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
  position: Vec2; // -1 to 1 normalized within goal
  speed: number;
  direction: 1 | -1;
  diving: boolean;
  diveTarget: Vec2 | null;
}

export interface WallPlayer {
  id: number;
  position: Vec2; // normalized 0-1 within wall area
  number: number; // the multiplier number shown on them
}

export interface MathChallenge {
  type: "multiplication" | "coordinate" | "angle" | "velocity";
  question: string;
  answer: number;
  options?: number[]; // for multiple choice
  timeLimit: number; // seconds
  hint?: string;
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
  shotsRequired: number; // shots to win
  shotsAllowed: number; // total shots before game over
  hasKeeper: boolean;
  keeperSpeed: number; // 0-1
  hasWall: boolean;
  wallCount: number;
  gridVisible: boolean;
  gridQuadrants: 1 | 4; // 1 = first quadrant only, 4 = all quadrants
  mathDifficulty: "easy" | "medium" | "hard";
  timeBonus: boolean;
  wind: boolean;
  windStrength: number;
  stars: [number, number, number]; // shots needed for 1, 2, 3 stars
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
  frustrationScore: number; // 0-100
  avgResponseTime: number; // seconds
  recentErrors: number[];
  currentMultiplier: number; // 0.5 to 1.5 difficulty multiplier
  hintsEnabled: boolean;
  targetSizeMultiplier: number; // 0.5 to 1.5
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
  adaptiveDifficulty: AdaptiveDifficulty;
  particles: Particle[];
  floatingTexts: FloatingText[];
}

export interface Particle {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number; // 0-1
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
  | { type: "SUBMIT_MATH"; answer: number }
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
