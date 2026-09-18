/**
 * A recorded upload's `file.type` isn't always the bare MIME type an
 * allowlist expects. Chrome/Edge's `MediaRecorder`, when constructed
 * without an explicit `mimeType` option (every voice recorder in this
 * codebase does this), defaults to something like
 * `"audio/webm;codecs=opus"` — a real, valid MIME type, just not the exact
 * string `"audio/webm"` an allowlist built with `Set.has()` was checking
 * for. Every recording from an affected browser was rejected as
 * "unsupported_file_type" before it ever reached size or content checks.
 *
 * The fix is to compare (and derive a file extension from) the type
 * without its parameters, while still storing the browser's original,
 * more specific type as the object's Content-Type — codec information is
 * genuinely useful to whatever plays the file back later.
 */

export function baseMimeType(type: string): string {
  return type.split(";")[0].trim().toLowerCase();
}

/** A short, filesystem-safe extension for a MIME type — falls back when the
 * subtype isn't a plain alphanumeric token (as it wouldn't be if a caller
 * forgot to strip parameters first). */
export function extensionForMime(type: string, fallback: string): string {
  const base = baseMimeType(type);
  if (base === "application/pdf") return "pdf";
  const subtype = base.split("/")[1];
  return subtype && /^[a-z0-9]+$/.test(subtype) ? subtype : fallback;
}
