"use client";

import Link from "next/link";
import { useState } from "react";
import { useI18n } from "@/components/i18n-provider";

export function MobileMenu({ links, signedIn }: { links: Array<{ href: string; label: string }>; signedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const { dict } = useI18n();
  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="mobile-nav"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex min-h-11 min-w-11 items-center justify-center font-mono text-[12px] uppercase tracking-wider text-fg"
      >
        {open ? dict.nav.close : dict.nav.menu}
      </button>
      {open ? (
        <nav id="mobile-nav" className="absolute inset-x-0 top-full border-b border-line bg-bg">
          <ul className="frame divide-y divide-line">
            {links.map((l) => (
              <li key={l.href}>
                <Link href={l.href} onClick={() => setOpen(false)} className="flex min-h-12 items-center px-4 font-mono text-sm uppercase tracking-wider text-fg-muted hover:text-accent">
                  <span className="mr-3 text-accent">→</span>
                  {l.label}
                </Link>
              </li>
            ))}
            {!signedIn ? (
              <li className="grid grid-cols-2 gap-px bg-line">
                <Link href="/login" onClick={() => setOpen(false)} className="btn bg-bg text-fg">
                  {dict.nav.login}
                </Link>
                <Link href="/register" onClick={() => setOpen(false)} className="btn-primary">
                  {dict.nav.register}
                </Link>
              </li>
            ) : null}
          </ul>
        </nav>
      ) : null}
    </div>
  );
}
