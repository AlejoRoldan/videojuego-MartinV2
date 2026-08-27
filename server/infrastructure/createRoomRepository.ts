import fs from "node:fs";
import path from "node:path";
import { LibsqlRoomRepository } from "./libsqlRoomRepository";

export function createRoomRepositoryFromEnv(): LibsqlRoomRepository {
  const configuredUrl = process.env.DATABASE_URL?.trim();
  const localPath = path.resolve(process.cwd(), "data", "live-rooms.db");
  const url = configuredUrl || `file:${localPath}`;
  if (url.startsWith("file:")) {
    const databasePath = url.slice("file:".length);
    fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  }
  return new LibsqlRoomRepository({
    url,
    authToken: process.env.DATABASE_AUTH_TOKEN?.trim() || undefined,
  });
}
