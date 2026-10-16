"use client";

import { useState } from "react";
import { CopyButton } from "@/components/ui/copy-button";

export interface CodeTab {
  id: string;
  label: string;
  code: string;
}

export function CodeTabs({ tabs, className = "" }: { tabs: CodeTab[]; className?: string }) {
  const [active, setActive] = useState(tabs[0]?.id ?? "");
  const current = tabs.find((t) => t.id === active) ?? tabs[0];
  if (!current) return null;
  return (
    <div className={`card overflow-hidden ${className}`}>
      <div className="flex items-stretch justify-between border-b border-line">
        <div role="tablist" className="flex overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              type="button"
              aria-selected={tab.id === current.id}
              onClick={() => setActive(tab.id)}
              className={`min-h-11 border-r border-line px-4 font-mono text-[12px] uppercase tracking-wider transition-colors ${
                tab.id === current.id ? "bg-bg-soft text-accent" : "text-fg-muted hover:text-fg"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <CopyButton value={current.code} />
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-6 text-fg">
        <code>{current.code}</code>
      </pre>
    </div>
  );
}
