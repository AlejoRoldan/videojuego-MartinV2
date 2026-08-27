import express, { type Express, type NextFunction, type Request, type Response } from "express";
import { createRoomRepositoryFromEnv } from "./infrastructure/createRoomRepository";
import { createLiveRoomRouter, liveRoomErrorHandler } from "./http/liveRoomRoutes";
import type { RoomRepository } from "./rooms/roomRepository";
import { RoomService } from "./rooms/roomService";

interface RateBucket {
  count: number;
  resetAt: number;
}

function createRateLimiter(options: { windowMs: number; maximum: number }) {
  const buckets = new Map<string, RateBucket>();
  return (request: Request, response: Response, next: NextFunction) => {
    const now = Date.now();
    const key = request.ip || request.socket.remoteAddress || "unknown";
    const current = buckets.get(key);
    const bucket = !current || current.resetAt <= now
      ? { count: 0, resetAt: now + options.windowMs }
      : current;
    bucket.count += 1;
    buckets.set(key, bucket);
    response.setHeader("RateLimit-Limit", String(options.maximum));
    response.setHeader("RateLimit-Remaining", String(Math.max(0, options.maximum - bucket.count)));
    response.setHeader("RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1_000)));
    if (bucket.count > options.maximum) {
      response.status(429).json({ code: "rate_limited", error: "Espera unos segundos e inténtalo de nuevo." });
      return;
    }
    if (buckets.size > 5_000) {
      buckets.forEach((value, candidate) => {
        if (value.resetAt <= now) buckets.delete(candidate);
      });
    }
    next();
  };
}

export interface GameApplication {
  app: Express;
  roomService: RoomService;
  close(): void;
}

export async function createGameApplication(options: {
  repository?: RoomRepository;
  now?: () => number;
} = {}): Promise<GameApplication> {
  const repository = options.repository ?? createRoomRepositoryFromEnv();
  const roomService = new RoomService(repository, options.now);
  await roomService.initialize();

  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use((_request, response, next) => {
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    next();
  });
  app.use(express.json({ limit: "4kb", strict: true }));

  app.get("/api/health", async (_request, response, next) => {
    try {
      const database = await roomService.health();
      response.status(database ? 200 : 503).json({ status: database ? "ok" : "degraded", database });
    } catch (error) {
      next(error);
    }
  });

  app.use(
    "/api/v11/rooms",
    createRateLimiter({ windowMs: 60_000, maximum: 120 }),
    createLiveRoomRouter(roomService),
  );
  app.use(liveRoomErrorHandler);

  return {
    app,
    roomService,
    close: () => roomService.close(),
  };
}
