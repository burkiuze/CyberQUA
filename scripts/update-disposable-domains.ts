/**
 * Refreshes lib/data/disposable-domains.json from the open source
 * disposable-email-domains project (CC0).
 *
 *   npm run update:disposable
 */
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const SOURCE =
  "https://raw.githubusercontent.com/disposable-email-domains/disposable-email-domains/main/disposable_email_blocklist.conf";
const OUTPUT = fileURLToPath(new URL("../lib/data/disposable-domains.json", import.meta.url));
const DOMAIN_RE = /^(?=.{3,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

async function main() {
  const res = await fetch(SOURCE, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
  const text = await res.text();
  const domains = [
    ...new Set(
      text
        .split(/\r?\n/)
        .map((line) => line.trim().toLowerCase())
        .filter((line) => line.length > 0 && !line.startsWith("#") && DOMAIN_RE.test(line)),
    ),
  ].sort();
  if (domains.length < 1000) throw new Error(`Suspiciously small list (${domains.length}); refusing to overwrite.`);
  await writeFile(OUTPUT, JSON.stringify(domains) + "\n", "utf8");
  console.log(`Wrote ${domains.length} domains to ${OUTPUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
