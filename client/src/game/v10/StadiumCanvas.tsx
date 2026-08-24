import { useCallback, useEffect, useRef } from "react";
import {
  FIELD_SCENE,
  createGameplayCamera,
  getProjectedBallRadiusPx,
  interpolateFlight,
  projectWorldPoint,
  type CameraPose,
  type ProjectedPoint,
  type Viewport,
} from "./cameraProjection";
import { MATCH_BALL, type FlightSample, type Vec3 } from "./shotPhysics3d";

interface StadiumCanvasProps {
  samples: readonly FlightSample[];
  goalDistanceM: number;
  replayToken?: number;
  progress?: number;
  onFlightComplete?: () => void;
}

interface CanvasSize extends Viewport {
  pixelRatio: number;
}

function traceProjectedPath(
  context: CanvasRenderingContext2D,
  points: readonly Vec3[],
  camera: CameraPose,
  viewport: Viewport,
  close = false,
): boolean {
  const projected = points.map((point) => projectWorldPoint(point, camera, viewport));
  if (projected.some((point) => point === null)) return false;
  context.beginPath();
  projected.forEach((point, index) => {
    const visible = point as ProjectedPoint;
    if (index === 0) context.moveTo(visible.x, visible.y);
    else context.lineTo(visible.x, visible.y);
  });
  if (close) context.closePath();
  return true;
}

function strokeWorldLine(
  context: CanvasRenderingContext2D,
  points: readonly Vec3[],
  camera: CameraPose,
  viewport: Viewport,
  color: string,
  width: number,
): void {
  if (!traceProjectedPath(context, points, camera, viewport)) return;
  context.strokeStyle = color;
  context.lineWidth = width;
  context.stroke();
}

function fillWorldPolygon(
  context: CanvasRenderingContext2D,
  points: readonly Vec3[],
  camera: CameraPose,
  viewport: Viewport,
  color: string,
): void {
  if (!traceProjectedPath(context, points, camera, viewport, true)) return;
  context.fillStyle = color;
  context.fill();
}

function drawAtmosphere(context: CanvasRenderingContext2D, viewport: Viewport): void {
  const sky = context.createLinearGradient(0, 0, 0, viewport.height * 0.62);
  sky.addColorStop(0, "#081429");
  sky.addColorStop(0.48, "#17456b");
  sky.addColorStop(1, "#f0a85d");
  context.fillStyle = sky;
  context.fillRect(0, 0, viewport.width, viewport.height);

  const glow = context.createRadialGradient(
    viewport.width * 0.72,
    viewport.height * 0.18,
    0,
    viewport.width * 0.72,
    viewport.height * 0.18,
    viewport.width * 0.45,
  );
  glow.addColorStop(0, "rgba(255,213,142,.32)");
  glow.addColorStop(1, "rgba(255,213,142,0)");
  context.fillStyle = glow;
  context.fillRect(0, 0, viewport.width, viewport.height * 0.65);

  context.fillStyle = "#101c2b";
  context.beginPath();
  context.moveTo(0, viewport.height * 0.2);
  context.lineTo(viewport.width, viewport.height * 0.24);
  context.lineTo(viewport.width, viewport.height * 0.48);
  context.lineTo(0, viewport.height * 0.47);
  context.closePath();
  context.fill();

  context.fillStyle = "#24364a";
  context.fillRect(0, viewport.height * 0.28, viewport.width, viewport.height * 0.035);
  context.fillStyle = "#0a111c";
  context.fillRect(0, viewport.height * 0.43, viewport.width, viewport.height * 0.055);

  const crowdColors = ["#f5d36c", "#d8e2ec", "#ee6a5b", "#5ca7de", "#94cc76"];
  for (let row = 0; row < 7; row += 1) {
    for (let column = 0; column < 44; column += 1) {
      const x = (column + 0.5 + (row % 2) * 0.25) / 44 * viewport.width;
      const y = viewport.height * (0.305 + row * 0.018) + Math.sin(column * 2.7 + row) * 1.8;
      context.fillStyle = crowdColors[(column * 3 + row * 2) % crowdColors.length];
      context.globalAlpha = 0.68;
      context.fillRect(x, y, 2.4, 2.4);
    }
  }
  context.globalAlpha = 1;

  context.strokeStyle = "rgba(210,230,255,.38)";
  context.lineWidth = 2;
  for (const x of [viewport.width * 0.08, viewport.width * 0.92]) {
    context.beginPath();
    context.moveTo(x, viewport.height * 0.3);
    context.lineTo(x, viewport.height * 0.075);
    context.stroke();
    context.fillStyle = "rgba(235,246,255,.82)";
    context.fillRect(x - 22, viewport.height * 0.06, 44, 8);
  }
}

function drawField(context: CanvasRenderingContext2D, viewport: Viewport, camera: CameraPose, goalDistanceM: number): void {
  const halfWidth = FIELD_SCENE.visibleWidthM / 2;
  const nearZ = -3.4;
  const farZ = goalDistanceM + FIELD_SCENE.beyondGoalM;
  fillWorldPolygon(context, [
    { x: -halfWidth, y: 0, z: nearZ },
    { x: halfWidth, y: 0, z: nearZ },
    { x: halfWidth, y: 0, z: farZ },
    { x: -halfWidth, y: 0, z: farZ },
  ], camera, viewport, "#176137");

  const stripeCount = 14;
  const stripeDepth = (farZ - nearZ) / stripeCount;
  for (let index = 0; index < stripeCount; index += 1) {
    const startZ = nearZ + index * stripeDepth;
    const endZ = startZ + stripeDepth;
    fillWorldPolygon(context, [
      { x: -halfWidth, y: 0.006, z: startZ },
      { x: halfWidth, y: 0.006, z: startZ },
      { x: halfWidth, y: 0.006, z: endZ },
      { x: -halfWidth, y: 0.006, z: endZ },
    ], camera, viewport, index % 2 === 0 ? "rgba(44,139,77,.28)" : "rgba(8,62,35,.18)");
  }

  const lineColor = "rgba(244,250,238,.9)";
  strokeWorldLine(context, [
    { x: -halfWidth, y: 0.025, z: nearZ },
    { x: -halfWidth, y: 0.025, z: farZ },
  ], camera, viewport, lineColor, 1.5);
  strokeWorldLine(context, [
    { x: halfWidth, y: 0.025, z: nearZ },
    { x: halfWidth, y: 0.025, z: farZ },
  ], camera, viewport, lineColor, 1.5);
  strokeWorldLine(context, [
    { x: -halfWidth, y: 0.025, z: goalDistanceM },
    { x: halfWidth, y: 0.025, z: goalDistanceM },
  ], camera, viewport, lineColor, 2);

  const penaltyHalfWidth = FIELD_SCENE.penaltyAreaWidthM / 2;
  const penaltyFrontZ = goalDistanceM - FIELD_SCENE.penaltyAreaDepthM;
  strokeWorldLine(context, [
    { x: -penaltyHalfWidth, y: 0.03, z: goalDistanceM },
    { x: -penaltyHalfWidth, y: 0.03, z: penaltyFrontZ },
    { x: penaltyHalfWidth, y: 0.03, z: penaltyFrontZ },
    { x: penaltyHalfWidth, y: 0.03, z: goalDistanceM },
  ], camera, viewport, lineColor, 1.7);

  const penaltySpot = projectWorldPoint({ x: 0, y: 0.035, z: goalDistanceM - FIELD_SCENE.penaltySpotDistanceM }, camera, viewport);
  if (penaltySpot) {
    context.beginPath();
    context.arc(penaltySpot.x, penaltySpot.y, Math.max(1.6, penaltySpot.pixelsPerMeter * 0.11), 0, Math.PI * 2);
    context.fillStyle = lineColor;
    context.fill();
  }
}

function drawGoal(context: CanvasRenderingContext2D, viewport: Viewport, camera: CameraPose, goalDistanceM: number): void {
  const halfWidth = 7.32 / 2;
  const height = 2.44;
  const backZ = goalDistanceM + FIELD_SCENE.goalDepthM;
  const netColor = "rgba(225,240,244,.36)";
  const postColor = "#f7fbff";

  for (let index = 0; index <= 8; index += 1) {
    const x = -halfWidth + index / 8 * halfWidth * 2;
    strokeWorldLine(context, [
      { x, y: 0, z: goalDistanceM },
      { x, y: height, z: goalDistanceM },
      { x, y: height * 0.84, z: backZ },
      { x, y: 0, z: backZ },
    ], camera, viewport, netColor, 0.8);
  }
  for (let index = 0; index <= 5; index += 1) {
    const y = index / 5 * height;
    strokeWorldLine(context, [
      { x: -halfWidth, y, z: goalDistanceM },
      { x: halfWidth, y, z: goalDistanceM },
    ], camera, viewport, netColor, 0.8);
    strokeWorldLine(context, [
      { x: -halfWidth, y: y * 0.84, z: backZ },
      { x: halfWidth, y: y * 0.84, z: backZ },
    ], camera, viewport, netColor, 0.7);
  }

  strokeWorldLine(context, [
    { x: -halfWidth, y: 0, z: goalDistanceM },
    { x: -halfWidth, y: height, z: goalDistanceM },
    { x: halfWidth, y: height, z: goalDistanceM },
    { x: halfWidth, y: 0, z: goalDistanceM },
  ], camera, viewport, "rgba(0,0,0,.45)", 6);
  strokeWorldLine(context, [
    { x: -halfWidth, y: 0, z: goalDistanceM },
    { x: -halfWidth, y: height, z: goalDistanceM },
    { x: halfWidth, y: height, z: goalDistanceM },
    { x: halfWidth, y: 0, z: goalDistanceM },
  ], camera, viewport, postColor, 3.5);
}

function drawBall(context: CanvasRenderingContext2D, viewport: Viewport, camera: CameraPose, positionM: Vec3): void {
  const projected = projectWorldPoint(positionM, camera, viewport);
  if (!projected) return;
  const radius = getProjectedBallRadiusPx(positionM, MATCH_BALL.radiusM, camera, viewport);
  const ground = projectWorldPoint({ ...positionM, y: 0.018 }, camera, viewport);
  if (ground) {
    context.save();
    context.translate(ground.x, ground.y);
    context.scale(1, 0.28);
    context.beginPath();
    context.arc(0, 0, radius * 1.45, 0, Math.PI * 2);
    context.fillStyle = "rgba(0,0,0,.34)";
    context.filter = "blur(3px)";
    context.fill();
    context.restore();
  }

  context.save();
  context.shadowColor = "rgba(255,255,255,.34)";
  context.shadowBlur = radius * 0.5;
  const ballGradient = context.createRadialGradient(
    projected.x - radius * 0.32,
    projected.y - radius * 0.4,
    radius * 0.08,
    projected.x,
    projected.y,
    radius,
  );
  ballGradient.addColorStop(0, "#ffffff");
  ballGradient.addColorStop(0.7, "#e8eceb");
  ballGradient.addColorStop(1, "#7f8987");
  context.beginPath();
  context.arc(projected.x, projected.y, radius, 0, Math.PI * 2);
  context.fillStyle = ballGradient;
  context.fill();
  context.clip();

  context.fillStyle = "#17201f";
  for (let index = 0; index < 5; index += 1) {
    const angle = -Math.PI / 2 + index * Math.PI * 2 / 5;
    context.beginPath();
    context.arc(
      projected.x + Math.cos(angle) * radius * 0.55,
      projected.y + Math.sin(angle) * radius * 0.55,
      radius * 0.2,
      0,
      Math.PI * 2,
    );
    context.fill();
  }
  context.beginPath();
  context.arc(projected.x, projected.y, radius * 0.23, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawScene(
  context: CanvasRenderingContext2D,
  viewport: Viewport,
  samples: readonly FlightSample[],
  goalDistanceM: number,
  progress: number,
): void {
  context.clearRect(0, 0, viewport.width, viewport.height);
  drawAtmosphere(context, viewport);
  const camera = createGameplayCamera(goalDistanceM, progress);
  drawField(context, viewport, camera, goalDistanceM);
  drawGoal(context, viewport, camera, goalDistanceM);
  const current = interpolateFlight(samples, progress);
  drawBall(context, viewport, camera, current.positionM);

  const vignette = context.createRadialGradient(
    viewport.width / 2,
    viewport.height * 0.55,
    viewport.width * 0.2,
    viewport.width / 2,
    viewport.height * 0.55,
    viewport.width * 0.72,
  );
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(0,5,12,.42)");
  context.fillStyle = vignette;
  context.fillRect(0, 0, viewport.width, viewport.height);
}

export default function StadiumCanvas({ samples, goalDistanceM, replayToken = 0, progress, onFlightComplete }: StadiumCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef<CanvasSize>({ width: 360, height: 500, pixelRatio: 1 });
  const progressRef = useRef(0);
  const frameRef = useRef<number | null>(null);
  const completionRef = useRef(onFlightComplete);
  completionRef.current = onFlightComplete;

  const paint = useCallback((progress: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const { width, height, pixelRatio } = sizeRef.current;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    drawScene(context, { width, height }, samples, goalDistanceM, progress);
  }, [goalDistanceM, samples]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      const width = Math.max(1, bounds.width || 360);
      const height = Math.max(1, bounds.height || 500);
      const pixelRatio = Math.min(2, window.devicePixelRatio || 1);
      sizeRef.current = { width, height, pixelRatio };
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      paint(progressRef.current);
    };
    resize();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(resize);
    observer?.observe(canvas);
    window.addEventListener("resize", resize);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", resize);
    };
  }, [paint]);

  useEffect(() => {
    if (progress === undefined) return;
    const controlledProgress = Math.max(0, Math.min(1, progress));
    progressRef.current = controlledProgress;
    paint(controlledProgress);
  }, [paint, progress]);

  useEffect(() => {
    if (progress !== undefined) return;
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    if (replayToken === 0) {
      progressRef.current = 0;
      paint(0);
      return;
    }
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    if (reduceMotion) {
      progressRef.current = 1;
      paint(1);
      completionRef.current?.();
      return;
    }
    const durationMs = Math.max(900, Math.min(1750, samples[samples.length - 1].timeSeconds * 1250));
    const start = performance.now();
    const animate = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs);
      progressRef.current = progress;
      paint(progress);
      if (progress < 1) frameRef.current = requestAnimationFrame(animate);
      else {
        frameRef.current = null;
        completionRef.current?.();
      }
    };
    frameRef.current = requestAnimationFrame(animate);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };
  }, [paint, progress, replayToken, samples]);

  return (
    <canvas
      ref={canvasRef}
      data-v10-stadium-canvas="true"
      role="img"
      aria-label="Cancha de fútbol a escala real vista desde detrás del balón"
      style={{ display: "block", width: "100%", height: "100%", touchAction: "none" }}
    />
  );
}
