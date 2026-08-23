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
export type WorldId = "tables" | "goal-map" | "ball-lab" | "stem-cup";
export type MathPower = "precision" | "curve" | "turbo" | "perfect" | null;
export type MathDomain = "multiplication" | "coordinate" | "angle" | "velocity";
export type FlowTrigger = "math_struggle" | "football_struggle" | "sustained_mastery" | "recovery";
export type FlowAxis = "assistance" | "football" | "time" | "none";

export interface LevelRuntimeModifiers {
  keeperReachMultiplier: number;
  wallReachMultiplier: number;
  targetSizeMultiplier: number;
  assistanceLeadSeconds: number;
  windMultiplier: number;
  cooldownRemaining: number;
}

export interface ShotPerformance {
  domain: MathDomain;
  mathCorrect: boolean;
  responseTimeMs: number | null;
  assistanceStage: "none" | "hint" | "visual" | "urgent";
  usedRetry: boolean;
  outcome: ShotOutcome;
  scored: boolean;
  difficulty: "easy" | "medium" | "hard";
}

export interface PerformanceWindow {
  shots: readonly ShotPerformance[];
  mathSuccessRate: number | null;
  footballSuccessRate: number | null;
  correctMathButNoGoalCount: number;
  consecutiveMathErrors: number;
  consecutiveFootballMisses: number;
  averageResponseTimeMs: number | null;
  noHelpSuccessRate: number | null;
}

export interface FlowIntervention {
  trigger: FlowTrigger;
  axis: FlowAxis;
  change: string;
  windowMathSuccessRate: number;
  windowFootballSuccessRate: number;
  cooldownShots: number;
  reason: string;
  modifiers: Partial<LevelRuntimeModifiers>;
}

export interface BaseGameplayEvent {
  id: string;
  schemaVersion: 1;
  type: string;
  occurredAt: string;
  sessionId: string;
  levelId?: number;
  worldId?: WorldId;
}

export interface MathAnsweredEvent extends BaseGameplayEvent {
  type: "math_answered";
  domain: MathDomain;
  correct: boolean;
  responseTimeMs: number;
  assistanceStage: "none" | "hint" | "visual" | "urgent";
  usedRetry: boolean;
  difficulty: "easy" | "medium" | "hard";
}

export interface ShotResolvedEvent extends BaseGameplayEvent {
  type: "shot_resolved";
  mathCorrect: boolean;
  targetCoord: Vec2;
  actualCoord: Vec2;
  outcome: ShotOutcome;
  reasonCode: string;
  mathPower: Exclude<MathPower, null> | null;
  footballDifficulty: number;
}

export interface FlowInterventionEvent extends BaseGameplayEvent {
  type: "flow_intervention";
  trigger: FlowTrigger;
  axis: FlowAxis;
  change: string;
  windowMathSuccessRate: number;
  windowFootballSuccessRate: number;
}

export type GameplayEvent = MathAnsweredEvent | ShotResolvedEvent | FlowInterventionEvent;


export interface TableRange {
  min: number;
  max: number;
}

export interface WorldConfig {
  id: WorldId;
  name: string;
  icon: string;
  description: string;
  objective: string;
  levelIds: number[];
}
export type ShotOutcome = "goal" | "saved" | "blocked" | "missed";
export type ShotReasonCode =
  | "clean_target"
  | "reduced_accuracy"
  | "wind_drift"
  | "keeper_reach"
  | "wall_block"
  | "outside_goal";

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

export interface KeeperSnapshot {
  position: Vec2;
  reach: number;
}

export interface WallSnapshot {
  position: Vec2;
  radius: number;
}

export interface WindSnapshot {
  x: number;
  y: number;
}

export interface ShotInput {
  targetCoord: Vec2;
  gridQuadrants: 1 | 4;
  mathCorrect: boolean;
  basePower: number;
  spin: number;
  mathPower: MathPower;
  keeper: KeeperSnapshot;
  wall: WallSnapshot[];
  wind: WindSnapshot;
  seed: number;
  runtimeModifiers?: LevelRuntimeModifiers;
}

export interface AppliedModifier {
  id: string;
  amount: number;
}

export interface ShotResolution {
  scored: boolean;
  targetCoord: Vec2;
  targetPoint: Vec2;
  landingPoint: Vec2;
  actualCoord: Vec2;
  mathCorrect: boolean;
  powerUsed: number;
  spinUsed: number;
  savedByKeeper: boolean;
  blockedByWall: boolean;
  trajectoryPoints: Vec2[];
  bonusMultiplier: number;
  outcome: ShotOutcome;
  reasonCode: ShotReasonCode;
  appliedModifiers: AppliedModifier[];
  input: ShotInput;
}

export type ShotResult = ShotResolution;

export interface LevelConfig {
  id: number;
  name: string;
  worldId: WorldId;
  worldName: string;
  worldIcon: string;
  worldDescription: string;
  learningObjective: string;
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
  tableRange?: TableRange;
  challengeTypes?: MathChallengeType[];
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
  schemaVersion: number;
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
  equippedBall?: string;
  equippedKit?: string;
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
  /** Ordered outcomes for the current level, used by the shot-by-shot HUD. */
  shotHistory: ShotOutcome[];
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
  /** Consecutive fast first-attempt correct answers for the Perfect streak. */
  perfectStreak: number;
  /** Monotonic event key for one Math Power reward per submitted challenge. */
  mathPowerSequence: number;
  /** Local, in-memory gameplay events; persistence belongs to Phase 5. */
  gameplayEvents: GameplayEvent[];
  /** Rolling performance window used by the Phase 4 flow engine. */
  performanceWindow: PerformanceWindow;
  /** Runtime modifiers applied to the next resolved shot. */
  runtimeModifiers: LevelRuntimeModifiers;
  /** Response duration captured for the current mathematical challenge. */
  lastMathResponseTimeMs: number | null;
  /** Decision prepared after a shot and applied by NEXT_SHOT. */
  pendingFlowIntervention: FlowIntervention | null;
  /** Number of consecutive complete windows above the mastery threshold. */
  sustainedMasteryWindows: number;
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
  | { type: "SET_SPIN"; spin: number }
  | { type: "SUBMIT_MATH"; answer: number; timeLeft?: number; usedRetry?: boolean; responseTimeMs?: number; event?: MathAnsweredEvent }
  | { type: "MATH_ASSISTANCE"; stage: "hint" | "visual" | "urgent" }
  | { type: "GRANT_MATH_RETRY"; seconds: number }
  | { type: "SHOOT"; resolution?: ShotResolution }
  | { type: "SHOT_COMPLETE"; result: ShotResult; events?: GameplayEvent[] }
  | { type: "NEXT_SHOT"; flowEvent?: FlowInterventionEvent }
  | { type: "LEVEL_COMPLETE" }
  | { type: "LEVEL_FAILED" }
  | { type: "UPDATE_PHYSICS"; dt: number }
  | { type: "ADD_PARTICLES"; particles: Particle[] }
  | { type: "ADD_FLOATING_TEXT"; text: FloatingText }
  | { type: "TICK_PARTICLES" }
  | { type: "UPDATE_ADAPTIVE" }
  | { type: "RESET_GAME" };
