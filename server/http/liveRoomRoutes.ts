import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import type { LiveRoomErrorResponse } from "../../shared/liveRoomContract";
import { RoomError, asRoomError } from "../rooms/roomErrors";
import {
  createRoomSchema,
  joinRoomSchema,
  roomActionSchema,
  roomCodeSchema,
  shotSchema,
  startRoomSchema,
} from "../rooms/roomSchemas";
import { RoomService, type PlayerCredential } from "../rooms/roomService";

const playerIdSchema = z.string().uuid();
const tokenSchema = z.string().min(20).max(256);

type AsyncRoute = (request: Request, response: Response, next: NextFunction) => Promise<void>;

function route(handler: AsyncRoute) {
  return (request: Request, response: Response, next: NextFunction) => {
    void handler(request, response, next).catch(next);
  };
}

function parseCredential(request: Request): PlayerCredential {
  const authorization = request.header("authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  const parsed = z.object({
    playerId: playerIdSchema,
    token: tokenSchema,
  }).safeParse({
    playerId: request.header("x-player-id"),
    token,
  });
  if (!parsed.success) throw new RoomError("session_invalid");
  return parsed.data;
}

export function createLiveRoomRouter(service: RoomService): Router {
  const router = Router();

  router.post("/", route(async (request, response) => {
    const body = createRoomSchema.safeParse(request.body);
    if (!body.success) throw new RoomError("invalid_payload");
    const result = await service.createRoom(body.data.nickname, body.data.track);
    response.status(201).json(result);
  }));

  router.get("/:code", route(async (request, response) => {
    const parsedCode = roomCodeSchema.safeParse(request.params.code);
    if (!parsedCode.success) throw new RoomError("room_not_found");
    const room = await service.getRoom(parsedCode.data, parseCredential(request));
    response.setHeader("Cache-Control", "no-store");
    response.json(room);
  }));

  router.post("/:code", route(async (request, response) => {
    const parsedCode = roomCodeSchema.safeParse(request.params.code);
    if (!parsedCode.success) throw new RoomError("room_not_found");
    const action = roomActionSchema.safeParse(request.body);
    if (!action.success) throw new RoomError("invalid_payload");

    if (action.data.action === "join") {
      const body = joinRoomSchema.parse(action.data);
      response.json(await service.joinRoom(parsedCode.data, body.nickname));
      return;
    }

    const credential = parseCredential(request);
    if (action.data.action === "start") {
      startRoomSchema.parse(action.data);
      response.json(await service.startRoom(parsedCode.data, credential));
      return;
    }

    const body = shotSchema.parse(action.data);
    response.json(await service.submitShot(parsedCode.data, credential, body));
  }));

  return router;
}

export function liveRoomErrorHandler(
  error: unknown,
  _request: Request,
  response: Response<LiveRoomErrorResponse>,
  _next: NextFunction,
): void {
  const httpStatus = typeof error === "object" && error !== null && "status" in error && typeof error.status === "number"
    ? error.status
    : null;
  if (error instanceof z.ZodError || httpStatus === 400 || httpStatus === 413) {
    const roomError = new RoomError("invalid_payload");
    response.status(httpStatus === 413 ? 413 : roomError.status).json({ code: roomError.code, error: roomError.message });
    return;
  }
  const roomError = asRoomError(error);
  if (roomError.code === "internal_error") console.error("[live-rooms] unexpected error", error);
  response.status(roomError.status).json({ code: roomError.code, error: roomError.message });
}
