#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { parseReport } from "./functions/parseReport.js";
import { judgeOverdue } from "./functions/judgeOverdue.js";
import { routeBundle } from "./functions/routeBundle.js";
import { compressForLora } from "./functions/compressForLora.js";
import type { Bundle, CarrierInfo, HikerCheckin } from "./types.js";

async function readJson<T>(path: string): Promise<T> {
  const raw = await readFile(path, "utf8");
  return JSON.parse(raw) as T;
}

function printResult(result: unknown): void {
  console.log(JSON.stringify(result, null, 2));
}

function usage(): void {
  console.error(`Usage:
  chowki-brain parse "<text>" [--booth <boothId>]
  chowki-brain judge <path-to-json>    # { "hiker": HikerCheckin, "ledgerContext": string }
  chowki-brain route <path-to-json>    # { "bundle": Bundle, "carriers": CarrierInfo[] }
  chowki-brain compress <path-to-json> # { "bundle": Bundle }`);
}

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);

  switch (command) {
    case "parse": {
      const boothFlagIndex = rest.indexOf("--booth");
      const boothId = boothFlagIndex >= 0 ? rest[boothFlagIndex + 1] ?? "cli-booth" : "cli-booth";
      const text = boothFlagIndex >= 0 ? rest.slice(0, boothFlagIndex).join(" ") : rest.join(" ");
      if (!text) {
        usage();
        process.exitCode = 1;
        return;
      }
      printResult(await parseReport({ text, boothId }));
      return;
    }
    case "judge": {
      const path = rest[0];
      if (!path) {
        usage();
        process.exitCode = 1;
        return;
      }
      const input = await readJson<{ hiker: HikerCheckin; ledgerContext: string }>(path);
      printResult(await judgeOverdue(input));
      return;
    }
    case "route": {
      const path = rest[0];
      if (!path) {
        usage();
        process.exitCode = 1;
        return;
      }
      const input = await readJson<{ bundle: Bundle; carriers: CarrierInfo[] }>(path);
      printResult(await routeBundle(input));
      return;
    }
    case "compress": {
      const path = rest[0];
      if (!path) {
        usage();
        process.exitCode = 1;
        return;
      }
      const input = await readJson<{ bundle: Bundle }>(path);
      printResult(await compressForLora({ bundle: input.bundle }));
      return;
    }
    default: {
      usage();
      process.exitCode = 1;
    }
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exitCode = 1;
});
