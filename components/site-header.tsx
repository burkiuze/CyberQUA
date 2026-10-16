import Link from "next/link";
import { currentUserId } from "@/lib/session";
import { UserButton } from "@clerk/nextjs";
import { Logo } from "@/components/ui/logo";
import { LocaleSwitcher, ThemeToggle } from "@/components/preferences";
import { MobileMenu } from "@/components/mobile-menu";
import { getI18n } from "@/lib/i18n/server";

export async function SiteHeader() {
  const [{ dict }, userId] = await Promise.all([getI18n(), currentUserId()]);
  const signedIn = !!userId;
  const links = [
    { href: "/docs", label: dict.nav.docs },
    { href: "/playground", label: dict.nav.playground },
    { href: "/#pricing", label: dict.nav.pricing },
    ...(signedIn ? [{ href: "/dashboard", label: dict.nav.dashboard }] : []),
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur-md">
      <div className="frame flex h-16 items-center justify-between gap-4 px-4 md:px-6">
        <div className="flex items-center gap-8">
          <Logo />
          <nav className="hidden items-center md:flex">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="inline-flex min-h-11 items-center px-3 font-mono text-[12px] uppercase tracking-wider text-fg-muted transition-colors hover:text-fg"
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-1">
          <LocaleSwitcher />
          <ThemeToggle />
          <div className="ml-2 hidden items-center gap-2 md:flex">
            {signedIn ? (
              <>
                <Link href="/dashboard" className="btn-ghost">
                  {dict.nav.dashboard}
                </Link>
                <div className="flex min-h-11 min-w-11 items-center justify-center">
                  <UserButton />
                </div>
              </>
            ) : (
              <>
                <Link href="/login" className="btn text-fg-muted hover:text-fg">
                  {dict.nav.login}
                </Link>
                <Link href="/register" className="btn-primary">
                  {dict.nav.register}
                </Link>
              </>
            )}
          </div>
          {signedIn ? (
            <div className="flex min-h-11 min-w-11 items-center justify-center md:hidden">
              <UserButton />
            </div>
          ) : null}
          <MobileMenu links={links} signedIn={signedIn} />
        </div>
      </div>
    </header>
  );
}
