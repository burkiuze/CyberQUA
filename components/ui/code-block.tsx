import { CopyButton } from "@/components/ui/copy-button";

export function CodeBlock({ code, title, className = "" }: { code: string; title?: string; className?: string }) {
  return (
    <div className={`card overflow-hidden ${className}`}>
      <div className="flex items-center justify-between border-b border-line pl-3">
        <div className="flex items-center gap-2">
          <span aria-hidden className="flex gap-1.5">
            <span className="h-2 w-2 bg-line-strong" />
            <span className="h-2 w-2 bg-line-strong" />
            <span className="h-2 w-2 bg-line-strong" />
          </span>
          {title ? <span className="ml-2 font-mono text-[11px] uppercase tracking-wider text-fg-dim">{title}</span> : null}
        </div>
        <CopyButton value={code} />
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-6 text-fg">
        <code>{code}</code>
      </pre>
    </div>
  );
}
