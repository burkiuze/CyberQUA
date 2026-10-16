import { ApiError } from "@/lib/api/errors";

/**
 * Reads a JSON body while enforcing a hard byte limit. The stream is aborted
 * as soon as the limit is crossed, so oversized bodies are never buffered.
 */
export async function readJsonBody(req: Request, maxBytes: number): Promise<unknown> {
  const declared = req.headers.get("content-length");
  if (declared && Number(declared) > maxBytes) throw new ApiError("payload_too_large");
  if (!req.body) throw new ApiError("invalid_request", [{ field: "(body)", message: "JSON body required" }]);

  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw new ApiError("payload_too_large");
    }
    chunks.push(value);
  }
  const buffer = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const text = new TextDecoder().decode(buffer);
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ApiError("invalid_request", [{ field: "(body)", message: "Body must be valid JSON" }]);
  }
}
