export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export type Validation<T> = { ok: true; value: T } | { ok: false; error: string };

export interface ChatJsonOptions<T> {
  systemPrompt: string;
  userPrompt: string;
  validate: (value: unknown) => Validation<T>;
  model?: string;
  temperature?: number;
}

export class GemmaError extends Error {}

function ollamaHost(): string {
  return process.env.OLLAMA_HOST ?? "http://localhost:11434";
}

function defaultModel(): string {
  return process.env.GEMMA_MODEL ?? "gemma4:e2b";
}

function stripFences(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced?.[1] ?? trimmed;
}

async function callOllamaChat(
  messages: ChatMessage[],
  model: string,
  temperature: number
): Promise<string> {
  const res = await fetch(`${ollamaHost()}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages,
      format: "json",
      stream: false,
      options: { temperature }
    })
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new GemmaError(`Ollama chat request failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as { message?: { content?: string } };
  const content = data.message?.content;
  if (typeof content !== "string" || content.length === 0) {
    throw new GemmaError("Ollama response contained no message content");
  }
  return content;
}

function parseAndValidate<T>(raw: string, validate: (value: unknown) => Validation<T>): T {
  const stripped = stripFences(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new GemmaError(`Response was not valid JSON: ${message}. Raw: ${stripped.slice(0, 300)}`);
  }
  const result = validate(parsed);
  if (!result.ok) {
    throw new GemmaError(`Response failed schema validation: ${result.error}`);
  }
  return result.value;
}

/**
 * Sends a system+user prompt to Gemma via Ollama's chat endpoint, expecting a JSON object
 * back. On parse or schema-validation failure, re-prompts once with the concrete error so
 * the model can self-correct, then gives up.
 */
export async function chatJson<T>(opts: ChatJsonOptions<T>): Promise<T> {
  const model = opts.model ?? defaultModel();
  const temperature = opts.temperature ?? 0.2;
  const messages: ChatMessage[] = [
    { role: "system", content: opts.systemPrompt },
    { role: "user", content: opts.userPrompt }
  ];

  const firstRaw = await callOllamaChat(messages, model, temperature);
  try {
    return parseAndValidate(firstRaw, opts.validate);
  } catch (firstErr) {
    const reason = firstErr instanceof Error ? firstErr.message : String(firstErr);
    const retryMessages: ChatMessage[] = [
      ...messages,
      { role: "assistant", content: firstRaw },
      {
        role: "user",
        content: `That reply could not be used: ${reason}\nReply again with ONLY the corrected JSON object matching the required schema exactly. No prose, no markdown code fences.`
      }
    ];
    const secondRaw = await callOllamaChat(retryMessages, model, temperature);
    return parseAndValidate(secondRaw, opts.validate);
  }
}
