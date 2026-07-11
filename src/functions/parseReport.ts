import { chatJson, type Validation } from "../ollamaClient.js";
import { parseReportPrompt } from "../prompts/parseReport.prompt.js";
import { fallbackParseReport, isFallbackMode } from "../fallback/fixtures.js";
import { logLatency } from "../latency.js";
import type { IncidentKind, StructuredIncident, Urgency } from "../types.js";

export interface ParseReportInput {
  text: string;
  boothId: string;
}

export interface ParseReportOutput {
  incident: StructuredIncident;
  reasoning: string;
}

const KINDS: ReadonlySet<IncidentKind> = new Set([
  "injury",
  "medical",
  "lost",
  "wildlife",
  "weather",
  "other"
]);

const URGENCIES: ReadonlySet<Urgency> = new Set(["low", "moderate", "urgent", "critical"]);

interface ModelIncident {
  kind: IncidentKind;
  urgency: Urgency;
  persons: number;
  locationHint: string;
  summary: string;
  reasoning: string;
}

function validateModelIncident(value: unknown): Validation<ModelIncident> {
  if (typeof value !== "object" || value === null) {
    return { ok: false, error: "expected a JSON object" };
  }
  const v = value as Record<string, unknown>;
  if (typeof v.kind !== "string" || !KINDS.has(v.kind as IncidentKind)) {
    return { ok: false, error: `"kind" must be one of ${[...KINDS].join(", ")}` };
  }
  if (typeof v.urgency !== "string" || !URGENCIES.has(v.urgency as Urgency)) {
    return { ok: false, error: `"urgency" must be one of ${[...URGENCIES].join(", ")}` };
  }
  if (typeof v.persons !== "number" || !Number.isFinite(v.persons)) {
    return { ok: false, error: '"persons" must be a number' };
  }
  if (typeof v.locationHint !== "string") {
    return { ok: false, error: '"locationHint" must be a string' };
  }
  if (typeof v.summary !== "string") {
    return { ok: false, error: '"summary" must be a string' };
  }
  if (typeof v.reasoning !== "string") {
    return { ok: false, error: '"reasoning" must be a string' };
  }
  return {
    ok: true,
    value: {
      kind: v.kind as IncidentKind,
      urgency: v.urgency as Urgency,
      persons: v.persons,
      locationHint: v.locationHint,
      summary: v.summary,
      reasoning: v.reasoning
    }
  };
}

export async function parseReport(input: ParseReportInput): Promise<ParseReportOutput> {
  const startedAt = Date.now();
  try {
    if (isFallbackMode()) {
      return fallbackParseReport(input);
    }

    const { system, user } = parseReportPrompt(input);
    const model = await chatJson({
      systemPrompt: system,
      userPrompt: user,
      validate: validateModelIncident
    });

    const incident: StructuredIncident = {
      kind: model.kind,
      urgency: model.urgency,
      persons: model.persons,
      locationHint: model.locationHint,
      boothId: input.boothId,
      summary: model.summary
    };

    return { incident, reasoning: model.reasoning };
  } finally {
    logLatency("parseReport", startedAt);
  }
}
