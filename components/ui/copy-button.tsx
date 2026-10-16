"use client";

import { useState } from "react";
import { useI18n } from "@/components/i18n-provider";

export function CopyButton({ value, className = "" }: { value: string; className?: string }) {
  const { dict } = useI18n();
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        } catch {
          setCopied(false);
        }
      }}
      className={`inline-flex min-h-11 min-w-11 items-center justify-center px-3 font-mono text-[11px] uppercase tracking-wider text-fg-muted hover:text-accent ${className}`}
      aria-label={dict.common.copy}
    >
      {copied ? dict.common.copied : dict.common.copy}
    </button>
  );
}
