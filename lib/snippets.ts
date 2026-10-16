export type SnippetLang = "curl" | "js" | "python" | "sdk";

export interface EndpointSnippetSpec {
  method: "GET" | "POST";
  path: string;
  body?: Record<string, unknown>;
  query?: Record<string, string>;
  sdkCall: string;
}

export const ENDPOINT_SNIPPETS: Record<string, EndpointSnippetSpec> = {
  "url-check": {
    method: "POST",
    path: "/url/check",
    body: { url: "https://g00gle-login.xyz/verify" },
    sdkCall: 'await cq.url.check("https://g00gle-login.xyz/verify")',
  },
  "password-range": {
    method: "POST",
    path: "/password/range",
    body: { sha1_prefix: "21BD1" },
    sdkCall: 'await cq.password.check("Galatasaray1905")',
  },
  headers: {
    method: "GET",
    path: "/headers",
    query: { url: "https://example.com" },
    sdkCall: 'await cq.headers.check("https://example.com")',
  },
  "email-check": {
    method: "POST",
    path: "/email/check",
    body: { email: "ali@tempmail.com" },
    sdkCall: 'await cq.email.check("ali@tempmail.com")',
  },
  ip: {
    method: "GET",
    path: "/ip/185.220.101.1",
    sdkCall: 'await cq.ip.check("185.220.101.1")',
  },
  "secrets-scan": {
    method: "POST",
    path: "/secrets/scan",
    body: { content: 'const key = "AKIA...";', filename: "config.js" },
    sdkCall: "await cq.secrets.scan(sourceCode, { filename: \"config.js\" })",
  },
};

export function buildSnippets(spec: EndpointSnippetSpec, baseUrl: string): Record<SnippetLang, string> {
  const qs = spec.query ? `?${new URLSearchParams(spec.query).toString()}` : "";
  const url = `${baseUrl}/api/v1${spec.path}${qs}`;
  const bodyJson = spec.body ? JSON.stringify(spec.body) : null;
  const bodyPretty = spec.body ? JSON.stringify(spec.body, null, 2) : null;

  const curl = [
    `curl ${spec.method === "GET" ? "" : "-X POST "}"${url}" \\`,
    `  -H "Authorization: Bearer $CYBERQUA_API_KEY"${bodyJson ? " \\" : ""}`,
    ...(bodyJson ? [`  -H "Content-Type: application/json" \\`, `  -d '${bodyJson.replace(/'/g, "'\\''")}'`] : []),
  ].join("\n");

  const js = [
    `const res = await fetch("${url}", {`,
    `  method: "${spec.method}",`,
    "  headers: {",
    "    Authorization: `Bearer ${process.env.CYBERQUA_API_KEY}`,",
    ...(bodyJson ? ['    "Content-Type": "application/json",'] : []),
    "  },",
    ...(bodyPretty ? [`  body: JSON.stringify(${bodyPretty.replace(/\n/g, "\n  ")}),`] : []),
    "});",
    "const { success, data, error } = await res.json();",
  ].join("\n");

  const pyBody = spec.body
    ? `,\n    json=${JSON.stringify(spec.body).replace(/\btrue\b/g, "True").replace(/\bfalse\b/g, "False").replace(/\bnull\b/g, "None")}`
    : "";
  const python = [
    "import os, requests",
    "",
    `res = requests.${spec.method === "GET" ? "get" : "post"}(`,
    `    "${url}",`,
    `    headers={"Authorization": f"Bearer {os.environ['CYBERQUA_API_KEY']}"}${pyBody},`,
    "    timeout=10,",
    ")",
    "print(res.json())",
  ].join("\n");

  const sdk = [
    'import { CyberQUA } from "cyberqua";',
    "",
    "const cq = new CyberQUA({ apiKey: process.env.CYBERQUA_API_KEY });",
    `const result = ${spec.sdkCall};`,
  ].join("\n");

  return { curl, js, python, sdk };
}
