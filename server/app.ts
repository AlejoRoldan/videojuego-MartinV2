import express, { type NextFunction, type Request, type Response } from "express";
import { LiveRoomStore, LiveRoomStoreError, type LiveRoomCredentials } from "./liveRoomStore";

function credentialsFrom(request: Request): LiveRoomCredentials {
  const playerId = typeof request.headers["x-player-id"] === "string" ? request.headers["x-player-id"] : "";
  const authorization = request.headers.authorization ?? "";
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1] ?? "";
  return { playerId, token };
}

function handleStoreError(response: Response, error: unknown): void {
  if (error instanceof LiveRoomStoreError) {
    response.status(error.status).json({ code: error.code, error: error.message });
    return;
  }
  response.status(500).json({ code: "internal_error", error: "No pudimos actualizar la sala." });
}

export function createApplication(store = new LiveRoomStore()) {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "4kb", strict: true }));

  app.post("/api/v11/rooms", (request, response) => {
    try {
      const result = store.createRoom(request.body?.nickname, request.body?.track);
      response.status(201).json(result);
    } catch (error) {
      handleStoreError(response, error);
    }
  });

  app.get("/api/v11/rooms/:code", (request, response) => {
    try {
      response.setHeader("Cache-Control", "no-store");
      response.json(store.getRoom(request.params.code, credentialsFrom(request)));
    } catch (error) {
      handleStoreError(response, error);
    }
  });

  app.post("/api/v11/rooms/:code", (request, response) => {
    try {
      const action = request.body?.action;
      if (action === "join") {
        response.json(store.joinRoom(request.params.code, request.body?.nickname));
        return;
      }
      const credentials = credentialsFrom(request);
      if (action === "start") {
        response.json(store.startRoom(request.params.code, credentials));
        return;
      }
      if (action === "shot") {
        response.json(store.submitShot(request.params.code, credentials, request.body));
        return;
      }
      throw new LiveRoomStoreError(400, "invalid_action", "La acción solicitada no es válida.");
    } catch (error) {
      handleStoreError(response, error);
    }
  });

  app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    if (error instanceof SyntaxError) {
      response.status(400).json({ code: "invalid_json", error: "La solicitud no contiene datos válidos." });
      return;
    }
    response.status(500).json({ code: "internal_error", error: "No pudimos procesar la solicitud." });
  });

  return app;
}
