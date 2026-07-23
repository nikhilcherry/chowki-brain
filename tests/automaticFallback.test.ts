import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parseReport } from "../src/functions/parseReport.js";
import { judgeOverdue } from "../src/functions/judgeOverdue.js";
import { routeBundle } from "../src/functions/routeBundle.js";
import type { Bundle, CarrierInfo, HikerCheckin } from "../src/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, "..", "fixtures");

function loadFixture<T>(name: string): T {
  return JSON.parse(readFileSync(join(fixturesDir, name), "utf8")) as T;
}

// These do NOT set BRAIN_FALLBACK -- they point OLLAMA_HOST at a port
// nothing listens on, so chatJson's live call genuinely fails (connection
// refused), exercising the automatic catch-and-fall-back-to-rules path
// rather than the explicit fallback-mode short-circuit tests/fallback.test.ts
// already covers. Before this fix, each of these threw instead of
// returning a canned result -- silently dropping the candidate/report/
// bundle one layer up.
describe("automatic fallback when Ollama is unreachable (no BRAIN_FALLBACK)", () => {
  beforeEach(() => {
    process.env.OLLAMA_HOST = "http://127.0.0.1:1";
  });

  afterEach(() => {
    delete process.env.OLLAMA_HOST;
  });

  it("parseReport falls back instead of throwing", async () => {
    const result = await parseReport({ text: "irrelevant, Ollama is unreachable", boothId: "booth-9" });
    expect(result.incident.boothId).toBe("booth-9");
    expect(result.reasoning).toMatch(/fallback/i);
  });

  it("judgeOverdue falls back instead of throwing", async () => {
    const { hiker, ledgerContext } = loadFixture<{ hiker: HikerCheckin; ledgerContext: string }>(
      "asha.json"
    );
    const result = await judgeOverdue({ hiker, ledgerContext });
    expect(["ok", "watch", "escalate"]).toContain(result.status);
    expect(result.reasoning).toMatch(/fallback/i);
  });

  it("routeBundle falls back instead of throwing", async () => {
    const { bundle, carriers } = loadFixture<{ bundle: Bundle; carriers: CarrierInfo[] }>(
      "bundle1.json"
    );
    const result = await routeBundle({ bundle, carriers });
    expect(Array.isArray(result.carrierIds)).toBe(true);
    expect(result.reasoning).toMatch(/fallback/i);
  });
});
