import type { ReactNode } from "react";

/** Syntax-coloured JSON rendered as React elements (no HTML injection). */
export function JsonView({ value }: { value: unknown }) {
  return (
    <pre className="overflow-x-auto p-4 font-mono text-[12.5px] leading-6">
      <code>{render(value, 0)}</code>
    </pre>
  );
}

function render(value: unknown, depth: number): ReactNode {
  const pad = "  ".repeat(depth);
  const padIn = "  ".repeat(depth + 1);
  if (value === null) return <span className="text-purple">null</span>;
  if (typeof value === "boolean") return <span className="text-purple">{String(value)}</span>;
  if (typeof value === "number") return <span className="text-warn">{value}</span>;
  if (typeof value === "string") return <span className="text-accent">{JSON.stringify(value)}</span>;
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-fg-muted">[]</span>;
    return (
      <>
        <span className="text-fg-muted">[</span>
        {"\n"}
        {value.map((item, i) => (
          <span key={i}>
            {padIn}
            {render(item, depth + 1)}
            {i < value.length - 1 ? <span className="text-fg-muted">,</span> : null}
            {"\n"}
          </span>
        ))}
        {pad}
        <span className="text-fg-muted">]</span>
      </>
    );
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return <span className="text-fg-muted">{"{}"}</span>;
    return (
      <>
        <span className="text-fg-muted">{"{"}</span>
        {"\n"}
        {entries.map(([k, v], i) => (
          <span key={k}>
            {padIn}
            <span className="text-fg">{JSON.stringify(k)}</span>
            <span className="text-fg-muted">: </span>
            {render(v, depth + 1)}
            {i < entries.length - 1 ? <span className="text-fg-muted">,</span> : null}
            {"\n"}
          </span>
        ))}
        {pad}
        <span className="text-fg-muted">{"}"}</span>
      </>
    );
  }
  return <span>{String(value)}</span>;
}
