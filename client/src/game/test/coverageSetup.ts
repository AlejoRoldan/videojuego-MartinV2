import { mkdirSync, writeFileSync } from "node:fs";
import inspector from "node:inspector";
import path from "node:path";
import { afterAll, beforeAll } from "vitest";

const outputDir = process.env.CORE_V8_COVERAGE_DIR;
let session: inspector.Session | null = null;

function post(method: string, params: Record<string, unknown> = {}): Promise<any> {
  return new Promise((resolve, reject) => {
    session!.post(method, params, (error, result) => error ? reject(error) : resolve(result));
  });
}

if (outputDir) {
  beforeAll(async () => {
    session = new inspector.Session();
    session.connect();
    await post("Profiler.enable");
    await post("Profiler.startPreciseCoverage", { callCount: true, detailed: true });
  });

  afterAll(async () => {
    if (!session) return;
    const coverage = await post("Profiler.takePreciseCoverage");
    await post("Profiler.stopPreciseCoverage");
    session.disconnect();
    mkdirSync(outputDir, { recursive: true });
    const filename = `worker-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.json`;
    writeFileSync(path.join(outputDir, filename), JSON.stringify(coverage));
    session = null;
  });
}
