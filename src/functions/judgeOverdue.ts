import { chatJson, type Validation } from "../ollamaClient.js";
import { judgeOverduePrompt } from "../prompts/judgeOverdue.prompt.js";
import { fallbackJudgeOverdue, isFallbackMode } from "../fallback/fixtures.js";
import { logLatency } from "../latency.js";
import type { HikerCheckin } from "../types.js";

export interface JudgeOverdueInput {
  hiker: HikerCheckin;
  ledgerContext: string;
}

export type OverdueStatus = "ok" | "watch" | "escalate" | "defer_to_human";

export interface JudgeOverdueOutput {
  status: OverdueStatus;
  recommendAction: string;
  reasoning: string;
}

const STATUSES: ReadonlySet<OverdueStatus> = new Set(["ok", "watch", "escalate", "defer_to_human"]);

function validateVerdict(value: unknown): Validation<JudgeOverdueOutput> {
  if (typeof value !== "object" || value === null) {
    return { ok: false, error: "expected a JSON object" };
  }
  const v = value as Record<string, unknown>;
  if (typeof v.status !== "string" || !STATUSES.has(v.status as OverdueStatus)) {
    return { ok: false, error: `"status" must be one of ${[...STATUSES].join(", ")}` };
  }
  if (typeof v.recommendAction !== "string") {
    return { ok: false, error: '"recommendAction" must be a string' };
  }
  if (typeof v.reasoning !== "string") {
    return { ok: false, error: '"reasoning" must be a string' };
  }
  return {
    ok: true,
    value: {
      status: v.status as OverdueStatus,
      recommendAction: v.recommendAction,
      reasoning: v.reasoning
    }
  };
}

export async function judgeOverdue(input: JudgeOverdueInput): Promise<JudgeOverdueOutput> {
  const startedAt = Date.now();
  try {
    if (isFallbackMode()) {
      return fallbackJudgeOverdue();
    }

    const { system, user } = judgeOverduePrompt(input);
    return await chatJson({
      systemPrompt: system,
      userPrompt: user,
      validate: validateVerdict
    });
  } finally {
    logLatency("judgeOverdue", startedAt);
  }
}
