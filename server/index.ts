import express from "express";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createGameApplication } from "./app";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const application = await createGameApplication();
  const { app } = application;
  const server = createServer(app);

  const staticPath = process.env.NODE_ENV === "production"
    ? path.resolve(__dirname, "public")
    : path.resolve(__dirname, "..", "dist", "public");

  app.use(express.static(staticPath));
  app.get("*", (_request, response) => {
    response.sendFile(path.join(staticPath, "index.html"));
  });

  const port = Number(process.env.PORT || 3000);
  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });

  const shutdown = () => {
    server.close(() => {
      application.close();
      process.exit(0);
    });
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

startServer().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
