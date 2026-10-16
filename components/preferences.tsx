"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useI18n } from "@/components/i18n-provider";

const YEAR = 60 * 60 * 24 * 365;

function setCookie(name: string, value: string) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${value}; Path=/; Max-Age=${YEAR}; SameSite=Lax${secure}`;
}

export function LocaleSwitcher({ className = "" }: { className?: string }) {
  const { locale, dict } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const next = locale === "tr" ? "en" : "tr";
  return (
    <button
      type="button"
      disabled={pending}
      aria-label={`${dict.nav.language}: ${next.toUpperCase()}`}
      onClick={() => {
        setCookie("cq_locale", next);
        start(() => router.refresh());
      }}
      className={`inline-flex min-h-11 min-w-11 items-center justify-center font-mono text-[12px] uppercase tracking-wider text-fg-muted hover:text-accent ${className}`}
    >
      <span className={locale === "tr" ? "text-fg" : ""}>TR</span>
      <span className="px-1 text-fg-dim">/</span>
      <span className={locale === "en" ? "text-fg" : ""}>EN</span>
    </button>
  );
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { dict } = useI18n();
  const router = useRouter();
  return (
    <button
      type="button"
      aria-label={dict.nav.theme}
      title={dict.nav.theme}
      onClick={() => {
        const current = document.documentElement.dataset.theme === "light" ? "light" : "dark";
        const next = current === "light" ? "dark" : "light";
        document.documentElement.dataset.theme = next;
        setCookie("cq_theme", next);
        router.refresh();
      }}
      className={`inline-flex min-h-11 min-w-11 items-center justify-center text-fg-muted hover:text-accent ${className}`}
    >
      <svg aria-hidden viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.6">
        <circle cx="12" cy="12" r="4.5" />
        <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" />
      </svg>
    </button>
  );
}
