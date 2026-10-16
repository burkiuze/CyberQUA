"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/components/i18n-provider";

export function DashboardNav() {
  const { dict } = useI18n();
  const pathname = usePathname();
  const items = [
    { href: "/dashboard", label: dict.dashboard.overview, code: "00" },
    { href: "/dashboard/keys", label: dict.dashboard.keys, code: "01" },
    { href: "/dashboard/logs", label: dict.dashboard.logs, code: "02" },
    { href: "/dashboard/settings", label: dict.dashboard.settings, code: "03" },
    { href: "/playground", label: dict.dashboard.playground, code: "04" },
    { href: "/docs", label: dict.dashboard.docs, code: "05" },
  ];
  return (
    <nav className="flex overflow-x-auto border-b border-line md:flex-col md:border-b-0">
      {items.map((item) => {
        const active = item.href === "/dashboard" ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-11 shrink-0 items-center gap-3 border-line px-4 font-mono text-[12px] uppercase tracking-wider transition-colors md:border-b ${
              active ? "bg-bg-soft text-accent" : "text-fg-muted hover:text-fg"
            }`}
          >
            <span className={active ? "text-accent" : "text-fg-dim"}>{item.code}</span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
