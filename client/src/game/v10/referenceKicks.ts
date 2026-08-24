import {
  MATCH_BALL,
  REGULATION_GOAL,
  simulateShot,
  velocityFromAngles,
  type ShotPhysicsConfig,
  type ShotPhysicsResult,
  type Vec3,
} from "./shotPhysics3d";

export interface ReferenceKick {
  id: string;
  label: string;
  purpose: string;
  distanceM: number;
  speedMps: number;
  elevationDegrees: number;
  yawDegrees: number;
  sidespinRadPerSecond: number;
  windMps?: Vec3;
  expected: {
    termination: ShotPhysicsResult["termination"];
    goalMouthResult: ShotPhysicsResult["goalMouthResult"];
  };
}

export const REFERENCE_KICKS: readonly ReferenceKick[] = Object.freeze([
  {
    id: "central-18",
    label: "Central · 18 m",
    purpose: "Tiro base medido en literatura deportiva: rápido, limpio y centrado.",
    distanceM: 18.3,
    speedMps: 25,
    elevationDegrees: 17,
    yawDegrees: 0,
    sidespinRadPerSecond: 0,
    expected: { termination: "goal_plane", goalMouthResult: "goal" },
  },
  {
    id: "curve-right",
    label: "Efecto derecha",
    purpose: "Comprueba que el efecto lateral positivo curva de forma continua a la derecha.",
    distanceM: 18.3,
    speedMps: 25,
    elevationDegrees: 17,
    yawDegrees: -1.5,
    sidespinRadPerSecond: 85,
    expected: { termination: "goal_plane", goalMouthResult: "goal" },
  },
  {
    id: "curve-left",
    label: "Efecto izquierda",
    purpose: "Espejo físico del tiro con efecto a la derecha.",
    distanceM: 18.3,
    speedMps: 25,
    elevationDegrees: 17,
    yawDegrees: 1.5,
    sidespinRadPerSecond: -85,
    expected: { termination: "goal_plane", goalMouthResult: "goal" },
  },
  {
    id: "soft-short",
    label: "Suave · corto",
    purpose: "Evita que un gesto sin fuerza llegue mágicamente a portería.",
    distanceM: 24,
    speedMps: 16,
    elevationDegrees: 15,
    yawDegrees: 0,
    sidespinRadPerSecond: 0,
    expected: { termination: "ground", goalMouthResult: null },
  },
  {
    id: "too-high",
    label: "Potente · alto",
    purpose: "Un ángulo excesivo debe superar el travesaño sin corrección oculta.",
    distanceM: 18.3,
    speedMps: 27,
    elevationDegrees: 25,
    yawDegrees: 0,
    sidespinRadPerSecond: 0,
    expected: { termination: "goal_plane", goalMouthResult: "high" },
  },
  {
    id: "controlled-21",
    label: "Controlado · 21 m",
    purpose: "Valida el rango de fuerza controlada en distancia intermedia.",
    distanceM: 21,
    speedMps: 23,
    elevationDegrees: 16,
    yawDegrees: 0,
    sidespinRadPerSecond: 0,
    expected: { termination: "goal_plane", goalMouthResult: "goal" },
  },
  {
    id: "power-24",
    label: "Potente · 24 m",
    purpose: "Tiro largo que exige más velocidad, no una trayectoria artificial.",
    distanceM: 24,
    speedMps: 27,
    elevationDegrees: 15,
    yawDegrees: 0,
    sidespinRadPerSecond: 0,
    expected: { termination: "goal_plane", goalMouthResult: "goal" },
  },
  {
    id: "power-27",
    label: "Potente · 27 m",
    purpose: "Valida la progresión de distancia prevista para niveles avanzados.",
    distanceM: 27,
    speedMps: 29,
    elevationDegrees: 16,
    yawDegrees: 0,
    sidespinRadPerSecond: 0,
    expected: { termination: "goal_plane", goalMouthResult: "goal" },
  },
  {
    id: "long-30",
    label: "Largo · 30 m",
    purpose: "Límite superior jugable de la primera calibración.",
    distanceM: 30,
    speedMps: 30,
    elevationDegrees: 17,
    yawDegrees: 0,
    sidespinRadPerSecond: 0,
    expected: { termination: "goal_plane", goalMouthResult: "goal" },
  },
  {
    id: "crosswind",
    label: "Viento lateral",
    purpose: "El viento desplaza la pelota gradualmente y nunca usa azar.",
    distanceM: 21,
    speedMps: 24,
    elevationDegrees: 16,
    yawDegrees: 0,
    sidespinRadPerSecond: 0,
    windMps: { x: 4, y: 0, z: 0 },
    expected: { termination: "goal_plane", goalMouthResult: "goal" },
  },
]);

export function buildReferenceKickConfig(kick: ReferenceKick): ShotPhysicsConfig {
  return {
    initialPositionM: { x: 0, y: MATCH_BALL.radiusM, z: 0 },
    initialVelocityMps: velocityFromAngles(kick.speedMps, kick.elevationDegrees, kick.yawDegrees),
    spinRadPerSecond: { x: 0, y: kick.sidespinRadPerSecond, z: 0 },
    windMps: kick.windMps,
    goal: { ...REGULATION_GOAL, planeZM: kick.distanceM },
  };
}

export function simulateReferenceKick(kick: ReferenceKick): ShotPhysicsResult {
  return simulateShot(buildReferenceKickConfig(kick));
}
