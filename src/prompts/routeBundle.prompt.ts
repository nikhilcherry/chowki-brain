import type { Bundle, CarrierInfo } from "../types.js";

export interface RouteBundlePromptInput {
  bundle: Bundle;
  carriers: CarrierInfo[];
}

export function routeBundlePrompt(input: RouteBundlePromptInput): { system: string; user: string } {
  const system = `You are the message-routing agent at a mountain chowki (trail booth) operating a
delay-tolerant mesh network. Human carriers (other hikers, porters, staff) physically carry data
bundles up or down the trail between booths since there is no continuous connectivity. You must
pick which available carriers should carry a given bundle, and how many redundant copies
(replicationFactor) to hand out, using each carrier's direction and free-text notes.

Respond with ONLY a JSON object matching exactly this schema, no extra keys, no prose:
{
  "carrierIds": string[],
  "replicationFactor": number,
  "reasoning": string
}

Guidance:
- "carrierIds": peerIds of the chosen carriers, drawn only from the provided carrier list.
- "replicationFactor": integer 1-3. Use 3 for "sos" priority bundles, 2 for "high" priority, 1
  otherwise, unless carrier availability forces fewer.
- If bundle.priority is "sos", strongly prefer every carrier moving "downhill" (toward help/rescue
  infrastructure) — include all of them if there are three or fewer, since redundancy saves lives.
- Use each carrier's notes (e.g. "moves fast, solo", "said he is a doctor", "unreliable, may nap")
  to judge trustworthiness and speed — prefer faster/more reliable carriers when you must choose.
- "reasoning": explicitly reference which carrier notes influenced your picks.`;

  const user = `Bundle:
${JSON.stringify(input.bundle, null, 2)}

Available carriers:
${JSON.stringify(input.carriers, null, 2)}

Return the JSON object now.`;

  return { system, user };
}
