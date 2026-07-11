import type { Bundle, CarrierInfo, StructuredIncident, TriagePacket } from "../types.js";

export function isFallbackMode(): boolean {
  return process.env.BRAIN_FALLBACK === "1";
}

export function fallbackParseReport(input: { text: string; boothId: string }): {
  incident: StructuredIncident;
  reasoning: string;
} {
  return {
    incident: {
      kind: "other",
      urgency: "moderate",
      persons: 1,
      locationHint: "unknown (fallback mode)",
      boothId: input.boothId,
      summary: "Fallback canned response: no model was called."
    },
    reasoning: "BRAIN_FALLBACK=1 — returned a canned incident without calling Ollama."
  };
}

export function fallbackJudgeOverdue(): {
  status: "ok" | "watch" | "escalate";
  recommendAction: string;
  reasoning: string;
} {
  return {
    status: "watch",
    recommendAction: "Radio the next booth to confirm hiker's last known position.",
    reasoning: "BRAIN_FALLBACK=1 — returned a canned watch verdict without calling Ollama."
  };
}

export function fallbackRouteBundle(input: { bundle: Bundle; carriers: CarrierInfo[] }): {
  carrierIds: string[];
  replicationFactor: number;
  reasoning: string;
} {
  const carrierIds = input.carriers.slice(0, 2).map((c) => c.peerId);
  return {
    carrierIds,
    replicationFactor: Math.min(2, Math.max(1, carrierIds.length)),
    reasoning: "BRAIN_FALLBACK=1 — picked the first available carriers without calling Ollama."
  };
}

export function fallbackCompressForLora(input: { bundle: any }): {
  packet: TriagePacket;
  bytes: number;
  reasoning: string;
} {
  const bundleId = input.bundle.bundleId || input.bundle.id || "unknown-bundle";
  const packet: TriagePacket = {
    k: "oth",
    u: "mod",
    p: 1,
    loc: "unk",
    b: bundleId.slice(0, 12)
  };
  return {
    packet,
    bytes: Buffer.byteLength(JSON.stringify(packet)),
    reasoning: "BRAIN_FALLBACK=1 — returned a canned packet without calling Ollama."
  };
}
