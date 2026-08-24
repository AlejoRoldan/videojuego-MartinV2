import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "react",
  },
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "client/src") },
  },
  test: {
    include: ["client/src/game/**/*.test.{ts,tsx}"],
    environment: "node",
  },
});
