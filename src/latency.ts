export function logLatency(fnName: string, startedAtMs: number): void {
  const ms = Date.now() - startedAtMs;
  console.error(`[chowki-brain] ${fnName} took ${ms}ms`);
}
