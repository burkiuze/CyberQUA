import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";
import { siteUrl } from "@/lib/env";
import { buildSnippets, ENDPOINT_SNIPPETS } from "@/lib/snippets";
import { Corners, SectionLabel } from "@/components/ui/corners";
import { CodeTabs } from "@/components/ui/code-tabs";
import { DemoChecker } from "@/components/marketing/demo-checker";
import { FeatureIcons } from "@/components/marketing/icons";

const FEATURES = [
  { key: "url", path: "POST /url/check", slug: "url-check" },
  { key: "password", path: "POST /password/range", slug: "password-range" },
  { key: "headers", path: "GET /headers", slug: "headers" },
  { key: "email", path: "POST /email/check", slug: "email-check" },
  { key: "ip", path: "GET /ip/{ip}", slug: "ip" },
  { key: "secrets", path: "POST /secrets/scan", slug: "secrets-scan" },
] as const;

const SAMPLE_RESPONSE = `{
  "success": true,
  "data": {
    "domain": "g00gle-login.xyz",
    "risk": "critical",
    "score": 91,
    "reasons": [
      { "code": "lookalike_domain", "severity": "high" },
      { "code": "new_domain", "severity": "high" },
      { "code": "suspicious_tld", "severity": "medium" }
    ]
  },
  "meta": { "latency_ms": 38, "partial": false }
}`;

export default async function HomePage() {
  const { dict } = await getI18n();
  const snippets = buildSnippets(ENDPOINT_SNIPPETS["url-check"]!, siteUrl());

  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="frame dot-grid">
          <div className="grid gap-12 px-4 pb-16 pt-14 md:px-10 md:pt-24 lg:grid-cols-[1.15fr_1fr] lg:items-center">
            <div>
              <p className="inline-flex items-center gap-2 border border-line bg-bg px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-fg-muted">
                <span aria-hidden className="h-1.5 w-1.5 bg-accent" />
                {dict.hero.badge}
              </p>
              <h1 className="mt-6 text-balance text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
                {dict.hero.title}
              </h1>
              <p className="mt-6 max-w-xl text-pretty text-base leading-7 text-fg-muted md:text-lg">{dict.hero.subtitle}</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/register" className="btn-primary">
                  {dict.hero.cta} <span aria-hidden>→</span>
                </Link>
                <Link href="/docs" className="btn-ghost">
                  {dict.hero.secondary}
                </Link>
              </div>
            </div>
            <div className="relative">
              <div className="card overflow-hidden">
                <Corners className="text-accent" />
                <div className="flex items-center justify-between border-b border-line px-3 py-2">
                  <span className="font-mono text-[11px] uppercase tracking-wider text-fg-dim">POST /api/v1/url/check</span>
                  <span className="font-mono text-[11px] text-accent">200 OK</span>
                </div>
                <pre className="overflow-x-auto p-4 font-mono text-[12px] leading-6 text-fg-muted">
                  <code>{SAMPLE_RESPONSE}</code>
                </pre>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 border-t border-line sm:grid-cols-3">
            {[
              ["1.000", dict.hero.stat1],
              ["<50 ms", dict.hero.stat2],
              ["0", dict.hero.stat3],
            ].map(([value, label], i) => (
              <div key={label} className={`bg-bg px-6 py-6 ${i > 0 ? "border-t border-line sm:border-l sm:border-t-0" : ""}`}>
                <p className="font-mono text-2xl font-semibold text-fg">{value}</p>
                <p className="mt-1 font-mono text-[11px] uppercase tracking-wider text-fg-dim">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* LIVE DEMO */}
      <section id="demo" className="section">
        <div className="frame px-4 py-16 md:px-10">
          <SectionLabel index="01">{dict.demo.label}</SectionLabel>
          <h2 className="mt-6 text-3xl font-semibold tracking-tight md:text-4xl">{dict.demo.title}</h2>
          <p className="mt-3 max-w-2xl text-fg-muted">{dict.demo.subtitle}</p>
          <div className="mt-8">
            <DemoChecker />
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="section">
        <div className="frame px-4 py-16 md:px-10">
          <SectionLabel index="02">{dict.features.label}</SectionLabel>
          <h2 className="mt-6 text-3xl font-semibold tracking-tight md:text-4xl">{dict.features.title}</h2>
          <div className="relative mt-10 grid gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
            <Corners />
            {FEATURES.map(({ key, path, slug }) => {
              const Icon = FeatureIcons[key];
              const f = dict.features[key];
              return (
                <Link key={key} href={`/docs/${slug}`} className="group flex flex-col bg-bg p-6 transition-colors hover:bg-bg-elev">
                  <span className="text-accent">
                    <Icon />
                  </span>
                  <h3 className="mt-5 text-lg font-semibold">{f.title}</h3>
                  <p className="mt-2 flex-1 text-sm leading-6 text-fg-muted">{f.desc}</p>
                  <p className="mt-6 font-mono text-[11px] uppercase tracking-wider text-fg-dim group-hover:text-accent">
                    {path} →
                  </p>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* CODE */}
      <section id="code" className="section">
        <div className="frame grid gap-10 px-4 py-16 md:px-10 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <SectionLabel index="03">{dict.code.label}</SectionLabel>
            <h2 className="mt-6 text-3xl font-semibold tracking-tight md:text-4xl">{dict.code.title}</h2>
            <p className="mt-3 text-fg-muted">{dict.code.subtitle}</p>
            <Link href="/docs/sdk" className="btn-ghost mt-8">
              SDK →
            </Link>
          </div>
          <CodeTabs
            tabs={[
              { id: "curl", label: "cURL", code: snippets.curl },
              { id: "js", label: "JavaScript", code: snippets.js },
              { id: "python", label: "Python", code: snippets.python },
              { id: "sdk", label: "SDK", code: snippets.sdk },
            ]}
          />
        </div>
      </section>

      {/* USE CASES */}
      <section id="use-cases" className="section">
        <div className="frame px-4 py-16 md:px-10">
          <SectionLabel index="04">{dict.usecases.label}</SectionLabel>
          <h2 className="mt-6 text-3xl font-semibold tracking-tight md:text-4xl">{dict.usecases.title}</h2>
          <ol className="mt-10 grid gap-px border border-line bg-line md:grid-cols-2 lg:grid-cols-3">
            {dict.usecases.items.map((item, i) => (
              <li key={item.title} className="bg-bg p-6">
                <span className="font-mono text-[11px] text-purple">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="mt-3 font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-fg-muted">{item.desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="section">
        <div className="frame px-4 py-16 md:px-10">
          <SectionLabel index="05">{dict.pricing.label}</SectionLabel>
          <h2 className="mt-6 text-3xl font-semibold tracking-tight md:text-4xl">{dict.pricing.title}</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            <div className="card p-8">
              <Corners className="text-accent" />
              <p className="eyebrow-accent">{dict.pricing.free}</p>
              <p className="mt-4 font-mono text-4xl font-semibold">
                ₺0<span className="text-base text-fg-dim">{dict.pricing.month}</span>
              </p>
              <ul className="mt-6 space-y-2 text-sm">
                {dict.pricing.freeFeatures.map((f) => (
                  <li key={f} className="flex gap-3 text-fg-muted">
                    <span className="text-accent">+</span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/register" className="btn-primary mt-8 w-full">
                {dict.pricing.freeCta}
              </Link>
            </div>
            <div className="card p-8 opacity-90">
              <p className="flex items-center gap-3">
                <span className="eyebrow text-purple">{dict.pricing.pro}</span>
                <span className="border border-purple px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-purple">
                  {dict.pricing.soon}
                </span>
              </p>
              <p className="mt-4 font-mono text-4xl font-semibold text-fg-muted">—</p>
              <ul className="mt-6 space-y-2 text-sm">
                {dict.pricing.proFeatures.map((f) => (
                  <li key={f} className="flex gap-3 text-fg-muted">
                    <span className="text-purple">+</span>
                    {f}
                  </li>
                ))}
              </ul>
              <button type="button" disabled className="btn-ghost mt-8 w-full">
                {dict.pricing.proCta}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="section">
        <div className="frame grid gap-10 px-4 py-16 md:px-10 lg:grid-cols-[1fr_2fr]">
          <div>
            <SectionLabel index="06">{dict.faq.label}</SectionLabel>
            <h2 className="mt-6 text-3xl font-semibold tracking-tight md:text-4xl">{dict.faq.title}</h2>
          </div>
          <div className="border-t border-line">
            {dict.faq.items.map((item) => (
              <details key={item.q} className="group border-b border-line">
                <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 font-medium">
                  {item.q}
                  <span aria-hidden className="font-mono text-accent transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="pb-5 text-sm leading-6 text-fg-muted">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section">
        <div className="frame dot-grid px-4 py-20 text-center md:px-10">
          <h2 className="mx-auto max-w-2xl text-balance text-3xl font-semibold tracking-tight md:text-5xl">{dict.hero.title}</h2>
          <Link href="/register" className="btn-primary mt-8">
            {dict.hero.cta} <span aria-hidden>→</span>
          </Link>
        </div>
      </section>
    </>
  );
}
