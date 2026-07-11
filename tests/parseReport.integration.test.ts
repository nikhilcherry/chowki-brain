import { describe, expect, it } from "vitest";
import { parseReport } from "../src/functions/parseReport.js";

async function isOllamaReachable(): Promise<boolean> {
  try {
    const host = process.env.OLLAMA_HOST ?? "http://localhost:11434";
    const res = await fetch(`${host}/api/tags`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

const ollamaAvailable = await isOllamaReachable();

describe.skipIf(!ollamaAvailable)("parseReport against real Ollama", () => {
  it(
    "survives messy Hinglish input and extracts the required fixture fields",
    async () => {
      const { incident } = await parseReport({
        text: "some foreigner near the waterfall twisted his leg badly, he was alone i think, maybe 2km up",
        boothId: "booth-2"
      });

      expect(incident.kind).toBe("injury");
      expect(incident.urgency).toBe("urgent");
      expect(incident.persons).toBe(1);
      expect(incident.locationHint.toLowerCase()).toMatch(/waterfall|2\s*km/);
    },
    30000
  );
});
