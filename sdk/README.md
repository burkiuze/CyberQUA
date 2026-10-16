# cyberqua

Official TypeScript SDK for the **CyberQUA** security API — *"Güvenliği sen yazma, CyberQUA'ya sor."*

- Zero dependencies, ESM + CJS, full TypeScript types
- Node.js 18+ and modern browsers (uses `fetch` and Web Crypto)
- Password checks are **k-anonymous**: the password is hashed on-device and only 5 hex characters of its SHA-1 hash are sent
- Automatic retries on `429` / `503` honouring `Retry-After`

## Kurulum / Installation

```bash
npm install cyberqua
```

```ts
import { CyberQUA } from "cyberqua";

const cq = new CyberQUA({ apiKey: process.env.CYBERQUA_API_KEY });
```

| Option       | Type              | Default                 | Description |
|--------------|-------------------|-------------------------|-------------|
| `apiKey`     | `string`          | —                       | `cq_live_…` (server) or `cq_pub_…` (browser, allowed origins only) |
| `baseUrl`    | `string`          | `https://cyberqua.dev`  | Your CyberQUA deployment |
| `timeout`    | `number` (ms)     | `10000`                 | Per-request timeout |
| `locale`     | `"tr" \| "en"`    | `"tr"`                  | Language of error messages and password tips |
| `maxRetries` | `number`          | `2`                     | Retries on 429 (except `quota_exceeded`) and 503 |
| `fetch`      | `typeof fetch`    | `globalThis.fetch`      | Custom fetch implementation |

> Gizli anahtarları (`cq_live_`) asla tarayıcıda kullanmayın. SDK bunu tarayıcıda tespit ederse hata fırlatır.
> Never use secret keys (`cq_live_`) in a browser — the SDK throws if it detects one.

## Metotlar / Methods

### `cq.url.check(url)`

Phishing / lookalike risk of a link. The link itself is **never opened**.

```ts
const r = await cq.url.check("https://g00gle-login.xyz/verify");
// { domain: "g00gle-login.xyz", risk: "critical", score: 91, reasons: [...], checks: {...} }
if (r.risk === "high" || r.risk === "critical") blockMessage();
```

### `cq.password.check(password)`

```ts
const r = await cq.password.check("Galatasaray1905");
// { score: 0, leaked: true, leak_count: 1234, tips: ["Bu şifre veri sızıntılarında görülmüş…", …] }
```

How it works:

1. The password is hashed with SHA-1 **on the device**.
2. Only the first 5 characters are sent to `/password/range`.
3. The returned list (padded with decoys) is searched **on the device** for the remaining 35 characters.
4. Strength (`score` 0–4) is computed **on the device**: length, character variety, keyboard runs (`qwerty`, `123456`), repeats and a Turkish dictionary (galatasaray, fenerbahce, besiktas, trabzonspor, 1905, 1907, 1903, 1967, şifre, parola, common names, cities…).

Also available: `cq.password.range(prefix)` (raw range) and `cq.password.strength(password)` (offline only).

### `cq.headers.check(url)` *(secret keys only)*

```ts
const r = await cq.headers.check("https://example.com");
console.log(r.grade, r.score);       // "B", 78
console.log(r.fixes.next_config);    // ready-to-paste next.config.js headers()
```

### `cq.email.check(email)`

```ts
const r = await cq.email.check("ali@gmial.com");
// { valid_syntax: true, disposable: false, has_mx: false, did_you_mean: "ali@gmail.com", risk: "high", … }
```

### `cq.ip.check(ip)` *(secret keys only)*

```ts
const r = await cq.ip.check("185.220.101.1");
// { version: 4, is_private: false, is_tor_exit: true, abuse_score: 100, country: "DE", risk: "critical", … }
if (r.is_tor_exit) requireTwoFactor();
```

### `cq.secrets.scan(content, { filename? })` *(secret keys only)*

Scans up to 100 KB of text. The content is never stored, logged or cached and full secret values are never returned.

```ts
import { readFile } from "node:fs/promises";

const code = await readFile("config.js", "utf8");
const { findings } = await cq.secrets.scan(code, { filename: "config.js" });
for (const f of findings) console.log(`${f.line}:${f.column} ${f.name} ${f.masked}\n  → ${f.remediation}`);
if (findings.length) process.exit(1); // fail CI
```

### `cq.shield(options?)` — local security headers

Adds security headers **without calling the API**.

```ts
// Express
import express from "express";
const app = express();
app.use(cq.shield());               // or: import { shield } from "cyberqua"; app.use(shield.express());
```

```js
// next.config.js
const { shield } = require("cyberqua");
module.exports = {
  async headers() {
    return [{ source: "/(.*)", headers: shield.nextHeaders() }];
  },
};
```

```ts
// Next.js proxy/middleware
import { NextResponse } from "next/server";
import { shield } from "cyberqua";

export function proxy() {
  const res = NextResponse.next();
  shield.apply(res.headers);
  return res;
}
```

Options: `contentSecurityPolicy` (string or `false`), `hstsMaxAge` (number or `false`), `hstsPreload`, `frameOptions`, `referrerPolicy`, `permissionsPolicy`, `crossOriginOpenerPolicy`, `extra`.

## Hata yönetimi / Error handling

Every failure throws a `CyberQUAError` with `code`, `status`, `message`, `requestId` and `details`.

```ts
import { CyberQUAError } from "cyberqua";

try {
  await cq.url.check("https://example.com");
} catch (err) {
  if (err instanceof CyberQUAError) {
    if (err.code === "quota_exceeded") notifyBilling();
    console.error(err.code, err.status, err.message, err.requestId);
  }
}
```

Codes: `missing_api_key`, `invalid_api_key`, `revoked_api_key`, `secret_key_in_browser`, `origin_not_allowed`, `endpoint_not_allowed`, `invalid_request`, `payload_too_large`, `rate_limited`, `quota_exceeded`, `upstream_unavailable`, `internal_error`, plus client-side `timeout` and `network_error`.

## License

Apache-2.0
