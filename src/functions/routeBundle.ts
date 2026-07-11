import { chatJson, type Validation } from "../ollamaClient.js";
import { routeBundlePrompt } from "../prompts/routeBundle.prompt.js";
import { fallbackRouteBundle, isFallbackMode } from "../fallback/fixtures.js";
import { logLatency } from "../latency.js";
import type { Bundle, CarrierInfo } from "../types.js";

export interface RouteBundleInput {
  bundle: Bundle;
  carriers: CarrierInfo[];
}

export interface RouteBundleOutput {
  carrierIds: string[];
  replicationFactor: number;
  reasoning: string;
}

function validateRouting(
  knownPeerIds: ReadonlySet<string>
): (value: unknown) => Validation<RouteBundleOutput> {
  return (value: unknown) => {
    if (typeof value !== "object" || value === null) {
      return { ok: false, error: "expected a JSON object" };
    }
    const v = value as Record<string, unknown>;
    if (!Array.isArray(v.carrierIds) || !v.carrierIds.every((id) => typeof id === "string")) {
      return { ok: false, error: '"carrierIds" must be an array of strings' };
    }
    const unknown = v.carrierIds.filter((id) => !knownPeerIds.has(id));
    if (unknown.length > 0) {
      return {
        ok: false,
        error: `"carrierIds" contains peerIds not in the provided carrier list: ${unknown.join(", ")}`
      };
    }
    if (
      typeof v.replicationFactor !== "number" ||
      !Number.isInteger(v.replicationFactor) ||
      v.replicationFactor < 1 ||
      v.replicationFactor > 3
    ) {
      return { ok: false, error: '"replicationFactor" must be an integer between 1 and 3' };
    }
    if (typeof v.reasoning !== "string") {
      return { ok: false, error: '"reasoning" must be a string' };
    }
    return {
      ok: true,
      value: {
        carrierIds: v.carrierIds as string[],
        replicationFactor: v.replicationFactor,
        reasoning: v.reasoning
      }
    };
  };
}

export async function routeBundle(input: RouteBundleInput): Promise<RouteBundleOutput> {
  const startedAt = Date.now();
  try {
    if (isFallbackMode()) {
      return fallbackRouteBundle(input);
    }

    const knownPeerIds = new Set(input.carriers.map((c) => c.peerId));
    const { system, user } = routeBundlePrompt(input);
    return await chatJson({
      systemPrompt: system,
      userPrompt: user,
      validate: validateRouting(knownPeerIds)
    });
  } finally {
    logLatency("routeBundle", startedAt);
  }
}
