import { chatJson, type Validation } from "../ollamaClient.js";
import { compressForLoraPrompt, shortenLocPrompt } from "../prompts/compressForLora.prompt.js";
import { fallbackCompressForLora, isFallbackMode } from "../fallback/fixtures.js";
import { logLatency } from "../latency.js";
import type { Bundle, TriagePacket } from "../types.js";

export interface CompressForLoraInput {
  bundle: Bundle;
}

export interface CompressForLoraOutput {
  packet: TriagePacket;
  bytes: number;
  reasoning: string;
}

export const BYTE_LIMIT = 200;

interface ModelPacket {
  packet: TriagePacket;
  reasoning: string;
}

function validatePacket(value: unknown): Validation<ModelPacket> {
  if (typeof value !== "object" || value === null) {
    return { ok: false, error: "expected a JSON object" };
  }
  const v = value as Record<string, unknown>;
  if (typeof v.k !== "string") return { ok: false, error: '"k" must be a string' };
  if (typeof v.u !== "string") return { ok: false, error: '"u" must be a string' };
  if (typeof v.p !== "number" || !Number.isFinite(v.p)) {
    return { ok: false, error: '"p" must be a number' };
  }
  if (typeof v.loc !== "string") return { ok: false, error: '"loc" must be a string' };
  if (typeof v.b !== "string") return { ok: false, error: '"b" must be a string' };
  if (typeof v.reasoning !== "string") return { ok: false, error: '"reasoning" must be a string' };
  return {
    ok: true,
    value: {
      packet: { k: v.k, u: v.u, p: v.p, loc: v.loc, b: v.b },
      reasoning: v.reasoning
    }
  };
}

/** Hard-truncates `loc` character-by-character until the packet fits, as a last resort. */
export function enforceByteLimit(
  packet: TriagePacket,
  limit: number = BYTE_LIMIT
): { packet: TriagePacket; bytes: number } {
  let candidate = packet;
  let bytes = Buffer.byteLength(JSON.stringify(candidate));
  let loc = candidate.loc;
  while (bytes > limit && loc.length > 0) {
    loc = loc.slice(0, -1);
    candidate = { ...candidate, loc };
    bytes = Buffer.byteLength(JSON.stringify(candidate));
  }
  return { packet: candidate, bytes };
}

export async function compressForLora(input: CompressForLoraInput): Promise<CompressForLoraOutput> {
  const startedAt = Date.now();
  try {
    if (isFallbackMode()) {
      return fallbackCompressForLora(input);
    }

    const { system, user } = compressForLoraPrompt(input);
    let model = await chatJson({ systemPrompt: system, userPrompt: user, validate: validatePacket });
    let bytes = Buffer.byteLength(JSON.stringify(model.packet));

    if (bytes > BYTE_LIMIT) {
      const shorten = shortenLocPrompt(model.packet, bytes, BYTE_LIMIT);
      model = await chatJson({
        systemPrompt: shorten.system,
        userPrompt: shorten.user,
        validate: validatePacket
      });
      bytes = Buffer.byteLength(JSON.stringify(model.packet));
    }

    if (bytes > BYTE_LIMIT) {
      const truncated = enforceByteLimit(model.packet, BYTE_LIMIT);
      return { packet: truncated.packet, bytes: truncated.bytes, reasoning: model.reasoning };
    }

    return { packet: model.packet, bytes, reasoning: model.reasoning };
  } finally {
    logLatency("compressForLora", startedAt);
  }
}
