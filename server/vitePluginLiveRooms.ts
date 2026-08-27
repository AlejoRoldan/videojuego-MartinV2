import type { Plugin } from "vite";
import { createGameApplication } from "./app";

export function liveRoomsApiPlugin(): Plugin {
  return {
    name: "live-rooms-api",
    async configureServer(server) {
      const application = await createGameApplication();
      server.middlewares.use(application.app);
      server.httpServer?.once("close", () => application.close());
    },
  };
}
