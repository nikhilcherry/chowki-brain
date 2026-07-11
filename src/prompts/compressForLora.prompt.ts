import type { Bundle, TriagePacket } from "../types.js";

export interface CompressForLoraPromptInput {
  bundle: Bundle;
}

const SCHEMA_BLOCK = `{
  "k": string,
  "u": string,
  "p": number,
  "loc": string,
  "b": string,
  "reasoning": string
}`;

export function compressForLoraPrompt(input: CompressForLoraPromptInput): { system: string; user: string } {
  const system = `You are the LoRa-compression agent at a mountain chowki (trail booth). LoRa radio
bandwidth is extremely limited, so you must compress a data bundle into a tiny "triage packet"
whose serialized JSON is at most 200 bytes. Use short codes, not full words.

Respond with ONLY a JSON object matching exactly this schema, no extra keys, no prose:
${SCHEMA_BLOCK}

Field meaning:
- "k": short kind code (e.g. "inj", "med", "lost", "wild", "wx", "chk", "sos", "oth").
- "u": short urgency code (e.g. "lo", "mod", "urg", "crit").
- "p": integer number of persons affected.
- "loc": the shortest location hint that still lets a rescuer navigate (landmark + distance).
  Abbreviate aggressively (e.g. "wtrfall+2km", "N.ridge~1.5km"). This is the field you should
  shrink first if the packet is too large.
- "b": short bundle/booth identifier.
- "reasoning": briefly explain your abbreviation choices.

The ENTIRE serialized JSON object EXCLUDING "reasoning" must be 200 bytes or fewer when you
imagine k/u/p/loc/b alone. Be terse.`;

  const user = `Bundle:
${JSON.stringify(input.bundle, null, 2)}

Return the JSON object now.`;

  return { system, user };
}

export function shortenLocPrompt(
  packet: TriagePacket,
  currentBytes: number,
  limit: number
): { system: string; user: string } {
  const system = `You are the LoRa-compression agent at a mountain chowki. You must shrink an
existing triage packet's "loc" field ONLY (keep k, u, p, b unchanged unless they are typos) so
that the packet's serialized JSON fits within ${limit} bytes total.

Respond with ONLY a JSON object matching exactly this schema, no extra keys, no prose:
${SCHEMA_BLOCK}`;

  const user = `Current packet (${currentBytes} bytes, over the ${limit} byte limit):
${JSON.stringify(packet)}

Shorten "loc" further and return the corrected JSON object now.`;

  return { system, user };
}
