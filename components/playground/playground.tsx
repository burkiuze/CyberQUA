"use client";

import { useState } from "react";
import { useI18n } from "@/components/i18n-provider";
import { JsonView } from "@/components/ui/json-view";

type EndpointId = "url.check" | "email.check" | "password.range" | "headers" | "ip" | "secrets.scan";

interface FieldDef {
  name: string;
  label: string;
  placeholder: string;
  multiline?: boolean;
  secret?: boolean;
}

const ENDPOINTS: Array<{ id: EndpointId; label: string; fields: FieldDef[] }> = [
  { id: "url.check", label: "POST /url/check", fields: [{ name: "url", label: "url", placeholder: "https://g00gle-login.xyz/verify" }] },
  { id: "email.check", label: "POST /email/check", fields: [{ name: "email", label: "email", placeholder: "ali@gmial.com" }] },
  { id: "password.range", label: "POST /password/range", fields: [{ name: "password", label: "password", placeholder: "Galatasaray1905", secret: true }] },
  { id: "headers", label: "GET /headers", fields: [{ name: "url", label: "url", placeholder: "https://example.com" }] },
  { id: "ip", label: "GET /ip/{ip}", fields: [{ name: "ip", label: "ip", placeholder: "185.220.101.1" }] },
  {
    id: "secrets.scan",
    label: "POST /secrets/scan",
    fields: [
      { name: "content", label: "content", placeholder: 'const AWS_KEY = "AKIAIOSFODNN7EXAMPLE";', multiline: true },
      { name: "filename", label: "filename", placeholder: "config.js" },
    ],
  },
];

async function sha1Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}

export function Playground() {
  const { dict, locale } = useI18n();
  const [endpoint, setEndpoint] = useState<EndpointId>("url.check");
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<{ status: number; body: unknown } | null>(null);
  const [localNote, setLocalNote] = useState<string | null>(null);
  const def = ENDPOINTS.find((e) => e.id === endpoint)!;

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setLocalNote(null);
    try {
      let input: Record<string, string> = {};
      let fullHash: string | null = null;
      if (endpoint === "password.range") {
        fullHash = await sha1Hex(values.password ?? "");
        input = { sha1_prefix: fullHash.slice(0, 5) };
      } else {
        for (const f of def.fields) {
          const v = values[f.name] ?? "";
          if (v.trim() !== "") input[f.name] = v;
        }
      }
      const res = await fetch("/api/internal/playground", {
        method: "POST",
        headers: { "content-type": "application/json", "accept-language": locale },
        body: JSON.stringify({ endpoint, input }),
      });
      const body = (await res.json()) as { success: boolean; data?: { suffixes?: Array<{ suffix: string; count: number }> } };
      setResponse({ status: res.status, body });
      if (fullHash && body.success && body.data?.suffixes) {
        const hit = body.data.suffixes.find((s) => s.suffix === fullHash!.slice(5));
        setLocalNote(
          hit
            ? locale === "tr"
              ? `⚠ Bu şifre ${hit.count.toLocaleString("tr-TR")} kez sızıntılarda görülmüş (karşılaştırma tarayıcında yapıldı).`
              : `⚠ This password appeared ${hit.count.toLocaleString("en-US")} times in breaches (compared in your browser).`
            : locale === "tr"
              ? "✓ Bu şifre bilinen sızıntılarda bulunamadı (karşılaştırma tarayıcında yapıldı)."
              : "✓ This password was not found in known breaches (compared in your browser).",
        );
      }
    } catch {
      setResponse({ status: 0, body: { success: false, error: { message: dict.common.error } } });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form onSubmit={send} className="card space-y-4 p-5">
        <label className="block">
          <span className="eyebrow mb-2 block">{dict.playground.endpoint}</span>
          <select
            className="input"
            value={endpoint}
            onChange={(e) => {
              setEndpoint(e.target.value as EndpointId);
              setValues({});
              setResponse(null);
              setLocalNote(null);
            }}
          >
            {ENDPOINTS.map((ep) => (
              <option key={ep.id} value={ep.id}>
                {ep.label}
              </option>
            ))}
          </select>
        </label>
        {def.fields.map((f) => (
          <label key={f.name} className="block">
            <span className="eyebrow mb-2 block">{f.secret ? dict.playground.password : f.label}</span>
            {f.multiline ? (
              <textarea
                className="input min-h-48 py-2"
                value={values[f.name] ?? ""}
                placeholder={f.placeholder}
                spellCheck={false}
                onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
              />
            ) : (
              <input
                className="input"
                type={f.secret ? "password" : "text"}
                autoComplete={f.secret ? "off" : undefined}
                value={values[f.name] ?? ""}
                placeholder={f.placeholder}
                spellCheck={false}
                onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
              />
            )}
          </label>
        ))}
        {endpoint === "password.range" ? <p className="text-xs text-fg-dim">{dict.playground.passwordNote}</p> : null}
        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? dict.playground.sending : dict.playground.send}
        </button>
      </form>

      <div className="card min-h-80 overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-4 py-2">
          <span className="eyebrow">{dict.playground.response}</span>
          {response ? (
            <span className={`font-mono text-[12px] ${response.status >= 400 || response.status === 0 ? "text-danger" : "text-accent"}`}>
              {response.status || "ERR"}
            </span>
          ) : null}
        </div>
        {localNote ? <p className="border-b border-line px-4 py-3 text-sm text-fg">{localNote}</p> : null}
        {response ? <JsonView value={response.body} /> : <p className="p-4 font-mono text-sm text-fg-dim">{dict.playground.empty}</p>}
      </div>
    </div>
  );
}
