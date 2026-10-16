import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { Corners } from "@/components/ui/corners";
import { LocaleSwitcher, ThemeToggle } from "@/components/preferences";
import { getI18n } from "@/lib/i18n/server";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const { dict } = await getI18n();
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-line">
        <div className="frame flex h-16 items-center justify-between px-4 md:px-6">
          <Logo />
          <div className="flex items-center">
            <LocaleSwitcher />
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="flex-1">
        <div className="frame grid min-h-[calc(100dvh-4rem)] lg:grid-cols-2">
          <aside className="dot-grid relative hidden flex-col justify-between border-r border-line p-10 lg:flex">
            <div>
              <p className="eyebrow-accent">CYBERQUA / API</p>
              <p className="mt-6 max-w-md text-3xl font-semibold leading-tight tracking-tight">{dict.hero.title}</p>
              <p className="mt-4 max-w-md text-fg-muted">{dict.hero.subtitle}</p>
            </div>
            <div className="card p-4 font-mono text-[12px] leading-6 text-fg-muted">
              <Corners className="text-accent" />
              <p>
                <span className="text-accent">$</span> curl -H &quot;Authorization: Bearer cq_live_…&quot; \
              </p>
              <p className="pl-4">{"/api/v1/ip/185.220.101.1"}</p>
              <p className="mt-2 text-fg">{'{ "is_tor_exit": true, "risk": "medium" }'}</p>
            </div>
            <p className="font-mono text-[11px] text-fg-dim">
              <Link className="hover:text-accent" href="/gizlilik">{dict.footer.privacy}</Link>
              {"  ·  "}
              <Link className="hover:text-accent" href="/kosullar">{dict.footer.terms}</Link>
            </p>
          </aside>
          <section className="flex items-start justify-center px-4 py-10 sm:items-center">{children}</section>
        </div>
      </main>
    </div>
  );
}
