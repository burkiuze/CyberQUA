type Subtle = { digest(algorithm: string, data: Uint8Array): Promise<ArrayBuffer> };

async function subtle(): Promise<Subtle> {
  const g = globalThis as unknown as { crypto?: { subtle?: Subtle } };
  if (g.crypto?.subtle) return g.crypto.subtle;
  // Node 18 without the global Web Crypto object.
  // The specifier is a variable so browser bundlers never try to resolve it.
  const specifier = "node:crypto";
  const nodeCrypto = (await import(/* webpackIgnore: true */ /* @vite-ignore */ specifier)) as { webcrypto: { subtle: Subtle } };
  return nodeCrypto.webcrypto.subtle;
}

/** Uppercase hex SHA-1 of a UTF-8 string, computed on-device. */
export async function sha1Hex(text: string): Promise<string> {
  const digest = await (await subtle()).digest("SHA-1", new TextEncoder().encode(text));
  let out = "";
  for (const byte of new Uint8Array(digest)) out += byte.toString(16).padStart(2, "0");
  return out.toUpperCase();
}
