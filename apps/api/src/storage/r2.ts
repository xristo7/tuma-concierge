/**
 * Minimal local stand-in for the R2Bucket Worker binding type, mirroring
 * db/client.ts's approach for D1: the binding only exists inside a Worker
 * (wrangler dev/deploy), so it's registered once per request from worker.ts
 * rather than imported at module-load time.
 */
export type R2Object = {
  body: ReadableStream;
  httpMetadata?: { contentType?: string };
};

export type R2Bucket = {
  put(
    key: string,
    value: ArrayBuffer | ArrayBufferView | ReadableStream | string,
    options?: { httpMetadata?: { contentType?: string } },
  ): Promise<unknown>;
  get(key: string): Promise<R2Object | null>;
  delete(key: string): Promise<void>;
};

let r2Binding: R2Bucket | null = null;

/** Called once per request from worker.ts before any route handler runs. */
export function setR2Binding(binding: R2Bucket | undefined): void {
  r2Binding = binding ?? null;
}

export function getR2Bucket(): R2Bucket {
  if (!r2Binding) {
    throw new Error(
      "No R2 binding registered (RIDER_DOCS) — file uploads require running inside the Worker (wrangler dev/deploy), not local Node dev.",
    );
  }
  return r2Binding;
}
