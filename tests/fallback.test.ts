import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parseReport } from "../src/functions/parseReport.js";
import { judgeOverdue } from "../src/functions/judgeOverdue.js";
import { routeBundle } from "../src/functions/routeBundle.js";
import { compressForLora, BYTE_LIMIT } from "../src/functions/compressForLora.js";
import type { Bundle, CarrierInfo, HikerCheckin } from "../src/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, "..", "fixtures");

function loadFixture<T>(name: string): T {
  return JSON.parse(readFileSync(join(fixturesDir, name), "utf8")) as T;
}

describe("BRAIN_FALLBACK=1", () => {
  beforeEach(() => {
    process.env.BRAIN_FALLBACK = "1";
  });

  afterEach(() => {
    delete process.env.BRAIN_FALLBACK;
  });

  it("parseReport returns a canned but valid incident without calling Ollama", async () => {
    const result = await parseReport({ text: "irrelevant in fallback mode", boothId: "booth-9" });
    expect(result.incident.boothId).toBe("booth-9");
    expect(typeof result.incident.kind).toBe("string");
    expect(typeof result.reasoning).toBe("string");
    expect(result.reasoning.length).toBeGreaterThan(0);
  });

  it("judgeOverdue returns a canned but valid verdict without calling Ollama", async () => {
    const { hiker, ledgerContext } = loadFixture<{ hiker: HikerCheckin; ledgerContext: string }>(
      "asha.json"
    );
    const result = await judgeOverdue({ hiker, ledgerContext });
    expect(["ok", "watch", "escalate"]).toContain(result.status);
    expect(typeof result.recommendAction).toBe("string");
    expect(typeof result.reasoning).toBe("string");
  });

  it("routeBundle returns a canned but valid routing without calling Ollama", async () => {
    const { bundle, carriers } = loadFixture<{ bundle: Bundle; carriers: CarrierInfo[] }>(
      "bundle1.json"
    );
    const result = await routeBundle({ bundle, carriers });
    expect(Array.isArray(result.carrierIds)).toBe(true);
    expect(result.replicationFactor).toBeGreaterThanOrEqual(1);
    expect(result.replicationFactor).toBeLessThanOrEqual(3);
    expect(typeof result.reasoning).toBe("string");
  });

  it("compressForLora returns a canned packet within the byte limit without calling Ollama", async () => {
    const { bundle } = loadFixture<{ bundle: Bundle }>("bundle1.json");
    const result = await compressForLora({ bundle });
    expect(Buffer.byteLength(JSON.stringify(result.packet))).toBe(result.bytes);
    expect(result.bytes).toBeLessThanOrEqual(BYTE_LIMIT);
    expect(typeof result.reasoning).toBe("string");
  });
});
