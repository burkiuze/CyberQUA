export const UPSTREAM_TIMEOUT_MS = 5000;

export class UpstreamError extends Error {
  constructor(
    public readonly source: string,
    message: string,
  ) {
    super(message);
    this.name = "UpstreamError";
  }
}

/** fetch with a hard timeout. Never follows the response body unless the caller reads it. */
export async function fetchWithTimeout(
  input: string,
  init: RequestInit = {},
  timeoutMs = UPSTREAM_TIMEOUT_MS,
): Promise<Response> {
  const signal = AbortSignal.timeout(timeoutMs);
  return fetch(input, { ...init, signal, cache: "no-store" });
}

export async function withTimeout<T>(promise: Promise<T>, timeoutMs = UPSTREAM_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("timeout")), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
