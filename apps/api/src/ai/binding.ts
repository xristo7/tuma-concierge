/**
 * Minimal local stand-in for the Workers AI binding type, mirroring
 * storage/r2.ts's approach: the binding only exists inside a Worker
 * (wrangler dev/deploy), so it's registered once per request from
 * worker.ts rather than imported at module-load time.
 */
export type AiBinding = {
  run(model: string, payload: Record<string, unknown>): Promise<unknown>;
};

let aiBinding: AiBinding | null = null;

/** Called once per request from worker.ts before any route handler runs. */
export function setAiBinding(binding: AiBinding | undefined): void {
  aiBinding = binding ?? null;
}

export function isAiConfigured(): boolean {
  return aiBinding !== null;
}

export function getAiBinding(): AiBinding {
  if (!aiBinding) {
    throw new Error("No AI binding registered — voice transcription requires running inside the Worker (wrangler dev/deploy), not local Node dev.");
  }
  return aiBinding;
}
