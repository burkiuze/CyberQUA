import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { getI18n } from "@/lib/i18n/server";

export async function SiteFooter() {
  const { dict } = await getI18n();
  const year = new Date().getUTCFullYear();
  return (
    <footer className="border-t border-line">
      <div className="frame grid gap-10 px-4 py-12 md:grid-cols-4 md:px-6">
        <div className="md:col-span-2">
          <Logo />
          <p className="mt-3 max-w-sm text-sm text-fg-muted">{dict.footer.tagline}</p>
          <p className="mt-6 font-mono text-[11px] uppercase tracking-wider text-fg-dim">
            © {year} CyberQUA. {dict.footer.rights}
          </p>
        </div>
        <div>
          <p className="eyebrow mb-3">{dict.footer.product}</p>
          <ul className="space-y-1 text-sm">
            <li><Link className="inline-flex min-h-11 items-center text-fg-muted hover:text-accent" href="/docs">{dict.nav.docs}</Link></li>
            <li><Link className="inline-flex min-h-11 items-center text-fg-muted hover:text-accent" href="/playground">{dict.nav.playground}</Link></li>
            <li><Link className="inline-flex min-h-11 items-center text-fg-muted hover:text-accent" href="/#pricing">{dict.nav.pricing}</Link></li>
            <li><a className="inline-flex min-h-11 items-center text-fg-muted hover:text-accent" href="/api/v1/health">{dict.footer.status}</a></li>
          </ul>
        </div>
        <div>
          <p className="eyebrow mb-3">{dict.footer.legal}</p>
          <ul className="space-y-1 text-sm">
            <li><Link className="inline-flex min-h-11 items-center text-fg-muted hover:text-accent" href="/gizlilik">{dict.footer.privacy}</Link></li>
            <li><Link className="inline-flex min-h-11 items-center text-fg-muted hover:text-accent" href="/kosullar">{dict.footer.terms}</Link></li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
