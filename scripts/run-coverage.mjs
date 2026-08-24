import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const root = process.cwd();
const rawDir = path.join(root, ".coverage", "v8");
const reportDir = path.join(root, "coverage");
const functionThreshold = Number(process.env.COVERAGE_FUNCTION_THRESHOLD ?? 75);
const coreModules = new Set([
  "coordinates.ts",
  "flowEngine.ts",
  "gameFlow.ts",
  "gamePace.ts",
  "gameReducer.ts",
  "mastery.ts",
  "mathPowers.ts",
  "physics.ts",
  "profileMigration.ts",
  "shotPhysics3d.ts",
  "mathEngine.ts",
]);
const minimumModules = Number(process.env.COVERAGE_MIN_MODULES ?? coreModules.size);

rmSync(rawDir, { recursive: true, force: true });
mkdirSync(rawDir, { recursive: true });

const vitestEntry = path.join(root, "node_modules", "vitest", "vitest.mjs");
const vitestArgs = [vitestEntry, "run"];
if (process.env.COVERAGE_VITEST_CONFIG) {
  vitestArgs.push("--config", process.env.COVERAGE_VITEST_CONFIG);
}
const run = spawnSync(process.execPath, vitestArgs, {
  cwd: root,
  env: { ...process.env, CORE_V8_COVERAGE_DIR: rawDir },
  stdio: "inherit",
});
if (run.status !== 0) process.exit(run.status ?? 1);

const functions = new Map();
const modules = new Set();
for (const file of readdirSync(rawDir).filter((name) => name.endsWith(".json"))) {
  const payload = JSON.parse(readFileSync(path.join(rawDir, file), "utf8"));
  for (const script of payload.result ?? []) {
    const url = String(script.url ?? "").replace(/[?#].*$/, "");
    if (!url.includes("/client/src/game/") || url.includes(".test.")) continue;
    if (!coreModules.has(path.basename(url))) continue;
    modules.add(url);
    for (const fn of script.functions ?? []) {
      const range = fn.ranges?.[0];
      if (!range) continue;
      const key = `${url}:${fn.functionName}:${range.startOffset}:${range.endOffset}`;
      const covered = fn.ranges.some((item) => item.count > 0);
      functions.set(key, Boolean(functions.get(key)) || covered);
    }
  }
}

const totalFunctions = functions.size;
const coveredFunctions = [...functions.values()].filter(Boolean).length;
const functionCoverage = totalFunctions === 0 ? 0 : (coveredFunctions / totalFunctions) * 100;
const summary = {
  provider: "Node.js V8 precise coverage",
  scope: "client/src/game/{engine,math,v10}",
  modules: modules.size,
  functions: { covered: coveredFunctions, total: totalFunctions, percent: Number(functionCoverage.toFixed(2)) },
  thresholds: { minimumModules, functions: functionThreshold },
};

mkdirSync(reportDir, { recursive: true });
writeFileSync(path.join(reportDir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
console.log(`Core function coverage: ${summary.functions.percent}% (${coveredFunctions}/${totalFunctions}) across ${modules.size} modules.`);
if (modules.size < minimumModules || functionCoverage < functionThreshold) {
  console.error(`Coverage gate failed: require >= ${minimumModules} modules and >= ${functionThreshold}% function coverage.`);
  process.exit(1);
}
