import type { ReactNode } from "react";
import type { DocBlock, DocPage } from "@/lib/docs/content";
import type { Locale } from "@/lib/i18n/locale";
import { CodeBlock } from "@/components/ui/code-block";
import { CodeTabs } from "@/components/ui/code-tabs";
import { buildSnippets, ENDPOINT_SNIPPETS } from "@/lib/snippets";

/** Renders `inline code` segments from plain text without injecting HTML. */
function inline(text: string): ReactNode[] {
  return text.split(/(`[^`]+`)/g).map((part, i) =>
    part.startsWith("`") && part.endsWith("`") ? <code key={i}>{part.slice(1, -1)}</code> : <span key={i}>{part}</span>,
  );
}

function Block({ block, locale, baseUrl }: { block: DocBlock; locale: Locale; baseUrl: string }) {
  switch (block.t) {
    case "h2":
      return <h2>{block.text[locale]}</h2>;
    case "p":
      return <p>{inline(block.text[locale])}</p>;
    case "ul":
      return (
        <ul>
          {block.items.map((item, i) => (
            <li key={i}>{inline(item[locale])}</li>
          ))}
        </ul>
      );
    case "code":
      return <CodeBlock code={block.code} title={block.title} className="my-5" />;
    case "callout":
      return (
        <div className={`my-5 border-l-2 p-4 text-sm leading-6 ${block.tone === "warn" ? "border-warn bg-bg-soft text-fg" : "border-accent bg-accent-soft text-fg"}`}>
          {inline(block.text[locale])}
        </div>
      );
    case "table":
      return (
        <div className="my-5 overflow-x-auto border border-line">
          <table className="w-full text-left text-sm">
            <thead className="bg-bg-soft">
              <tr>
                {block.head.map((h, i) => (
                  <th key={i} className="px-4 py-2.5 font-mono text-[11px] font-normal uppercase tracking-wider text-fg-dim">
                    {h[locale]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {block.rows.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, c) => (
                    <td key={c} className={`px-4 py-2.5 align-top ${c === 0 ? "font-mono text-[12px] text-fg" : "text-fg-muted"}`}>
                      {inline(typeof cell === "string" ? cell : cell[locale])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "snippets": {
      const spec = ENDPOINT_SNIPPETS[block.endpoint];
      if (!spec) return null;
      const s = buildSnippets(spec, baseUrl);
      return (
        <CodeTabs
          className="my-5"
          tabs={[
            { id: "curl", label: "cURL", code: s.curl },
            { id: "js", label: "JavaScript", code: s.js },
            { id: "python", label: "Python", code: s.python },
            { id: "sdk", label: "SDK", code: s.sdk },
          ]}
        />
      );
    }
  }
}

export function DocRenderer({ page, locale, baseUrl }: { page: DocPage; locale: Locale; baseUrl: string }) {
  return (
    <article className="prose-cq max-w-3xl">
      <p className="eyebrow-accent">{page.group === "endpoint" ? "API v1" : "Docs"}</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-fg md:text-4xl">{page.title[locale]}</h1>
      {page.method && page.path ? (
        <p className="mt-4 inline-flex items-center border border-line font-mono text-[13px]">
          <span className={`border-r border-line px-3 py-1.5 ${page.method === "GET" ? "text-purple" : "text-accent"}`}>{page.method}</span>
          <span className="px-3 py-1.5 text-fg">/api/v1{page.path}</span>
        </p>
      ) : null}
      <p className="text-lg">{page.summary[locale]}</p>
      {page.blocks.map((block, i) => (
        <Block key={i} block={block} locale={locale} baseUrl={baseUrl} />
      ))}
    </article>
  );
}
