"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/components/i18n-provider";

export interface SidebarItem {
  slug: string;
  title: string;
  method?: string;
}

function Items({ items, onNavigate }: { items: SidebarItem[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <ul>
      {items.map((item) => {
        const href = item.slug === "getting-started" ? "/docs" : `/docs/${item.slug}`;
        const active = pathname === href;
        return (
          <li key={item.slug}>
            <Link
              href={href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-11 items-center gap-2 border-l-2 px-3 text-sm transition-colors ${
                active ? "border-accent bg-bg-soft text-fg" : "border-transparent text-fg-muted hover:text-fg"
              }`}
            >
              {item.method ? (
                <span className={`w-9 font-mono text-[10px] ${item.method === "GET" ? "text-purple" : "text-accent"}`}>{item.method}</span>
              ) : null}
              {item.title}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function DocsSidebar({ guides, endpoints }: { guides: SidebarItem[]; endpoints: SidebarItem[] }) {
  const { locale } = useI18n();
  const labels = locale === "tr" ? { guide: "Rehber", endpoints: "Endpoint'ler", menu: "Dokümantasyon menüsü" } : { guide: "Guide", endpoints: "Endpoints", menu: "Docs menu" };
  const content = (close?: () => void) => (
    <div className="space-y-6 py-6">
      <div>
        <p className="eyebrow mb-2 px-3">{labels.guide}</p>
        <Items items={guides} onNavigate={close} />
      </div>
      <div>
        <p className="eyebrow mb-2 px-3">{labels.endpoints}</p>
        <Items items={endpoints} onNavigate={close} />
      </div>
    </div>
  );
  return (
    <>
      <details className="group border-b border-line md:hidden">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-4 font-mono text-[12px] uppercase tracking-wider">
          {labels.menu}
          <span aria-hidden className="text-accent transition-transform group-open:rotate-45">+</span>
        </summary>
        {content()}
      </details>
      <nav className="hidden md:sticky md:top-16 md:block md:max-h-[calc(100dvh-4rem)] md:overflow-y-auto">{content()}</nav>
    </>
  );
}
