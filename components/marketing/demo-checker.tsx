"use client";

import { useState } from "react";
import { useI18n } from "@/components/i18n-provider";
import { RiskBadge, ScoreMeter } from "@/components/ui/risk";

interface Reason {
  code: string;
  severity: string;
  message: string;
}

interface DemoResult {
  url: string;
  domain: string;
  risk: "safe" | "low" | "medium" | "high" | "critical";
  score: number;
  reasons: Reason[];
}

const EXAMPLES = ["https://g00gle-login.xyz/verify", "garanti.guvenli-giris.xyz", "https://bit.ly/3xyz", "https://github.com"];

export function DemoChecker() {
  const { dict, locale } = useI18n();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DemoResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [latency, setLatency] = useState<number | null>(null);

  async function run(target: string) {
    if (!target.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/demo/url-check", {
        method: "POST",
        headers: { "content-type": "application/json", "accept-language": locale },
        body: JSON.stringify({ url: target.trim() }),
      });
      const body = (await res.json()) as
        | { success: true; data: DemoResult; meta: { latency_ms: number } }
        | { success: false; error: { message: string } };
      if (body.success) {
        setResult(body.data);
        setLatency(body.meta.latency_ms);
      } else {
        setResult(null);
        setError(body.error.message);
      }
    } catch {
      setError(dict.common.error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <form
        className="flex flex-col gap-px bg-line sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          void run(url);
        }}
      >
        <label className="flex flex-1 items-center bg-bg-elev">
          <span aria-hidden className="pl-4 font-mono text-accent">$</span>
          <span className="sr-only">URL</span>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={dict.demo.placeholder}
            maxLength={2048}
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            className="min-h-14 w-full bg-transparent px-3 font-mono text-sm text-fg placeholder:text-fg-dim focus:outline-none"
          />
        </label>
        <button type="submit" disabled={loading || !url.trim()} className="btn-primary min-h-14 sm:w-44">
          {loading ? dict.demo.loading : dict.demo.submit}
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-2">
        <span className="font-mono text-[11px] uppercase tracking-wider text-fg-dim">{dict.demo.examples}</span>
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => {
              setUrl(ex);
              void run(ex);
            }}
            className="min-h-11 px-2 font-mono text-[12px] text-fg-muted hover:text-accent"
          >
            {ex.replace(/^https?:\/\//, "")}
          </button>
        ))}
      </div>

      <div className="min-h-40 border-t border-line p-4 md:p-6" aria-live="polite">
        {error ? <p className="font-mono text-sm text-danger">! {error}</p> : null}
        {!error && !result ? (
          <p className="font-mono text-sm text-fg-dim">
            {dict.demo.subtitle}
            <span className="caret ml-1 text-accent">▍</span>
          </p>
        ) : null}
        {result ? (
          <div className="grid gap-6 md:grid-cols-[220px_1fr]">
            <div>
              <p className="eyebrow mb-2">{dict.demo.score}</p>
              <ScoreMeter score={result.score} risk={result.risk} />
              <div className="mt-3 flex items-center gap-2">
                <RiskBadge risk={result.risk} label={dict.risk[result.risk]} />
                {latency !== null ? <span className="font-mono text-[11px] text-fg-dim">{latency} ms</span> : null}
              </div>
              <p className="mt-3 break-all font-mono text-xs text-fg-muted">{result.domain}</p>
            </div>
            <div>
              <p className="eyebrow mb-2">{dict.demo.reasons}</p>
              {result.reasons.length === 0 ? (
                <p className="text-sm text-fg-muted">{dict.demo.noReasons}</p>
              ) : (
                <ul className="divide-y divide-line border border-line">
                  {result.reasons.map((r) => (
                    <li key={r.code} className="flex gap-3 px-3 py-2.5 text-sm">
                      <span className={`mt-0.5 font-mono text-[11px] uppercase ${severityColor(r.severity)}`}>{r.severity}</span>
                      <span className="text-fg">{r.message}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : null}
      </div>
      <p className="border-t border-line px-4 py-2 font-mono text-[11px] text-fg-dim">{dict.demo.limit}</p>
    </div>
  );
}

function severityColor(sev: string) {
  if (sev === "critical" || sev === "high") return "text-danger";
  if (sev === "medium") return "text-warn";
  return "text-fg-muted";
}
