"use client";

import Link from "next/link";
import { UserButton, useAuth } from "@clerk/nextjs";
import { useI18n } from "@/components/i18n-provider";

export function HeaderAuth() {
  const { isLoaded, isSignedIn } = useAuth();
  const { dict } = useI18n();
  if (!isLoaded) return <span className="hidden min-h-11 w-40 md:block" aria-hidden />;
  if (isSignedIn) {
    return (
      <div className="flex items-center gap-2">
        <Link href="/dashboard" className="btn-ghost hidden md:inline-flex">
          {dict.nav.dashboard}
        </Link>
        <div className="flex min-h-11 min-w-11 items-center justify-center">
          <UserButton />
        </div>
      </div>
    );
  }
  return (
    <div className="hidden items-center gap-2 md:flex">
      <Link href="/login" className="btn text-fg-muted hover:text-fg">
        {dict.nav.login}
      </Link>
      <Link href="/register" className="btn-primary">
        {dict.nav.register}
      </Link>
    </div>
  );
}
