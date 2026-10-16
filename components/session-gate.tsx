"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { useI18n } from "@/components/i18n-provider";

const ATTEMPT_KEY = "cq_session_refresh";

/**
 * Rendered when the server could not verify a session cookie. Clerk session
 * tokens are short-lived (~60 s); if the browser is signed in we refresh the
 * token cookie and re-render, otherwise we send the user to /login.
 */
export function SessionGate() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { dict, locale } = useI18n();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.replace(`/login?redirect_url=${encodeURIComponent(pathname)}`);
      return;
    }
    let attempts = 0;
    try {
      attempts = Number(sessionStorage.getItem(ATTEMPT_KEY) ?? "0");
    } catch {
      attempts = 0;
    }
    if (attempts >= 3) {
      setFailed(true);
      return;
    }
    try {
      sessionStorage.setItem(ATTEMPT_KEY, String(attempts + 1));
    } catch {
      // ignore
    }
    void getToken({ skipCache: true }).then(() => router.refresh());
  }, [isLoaded, isSignedIn, getToken, router, pathname]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
      {failed ? (
        <>
          <p className="text-fg-muted">
            {locale === "tr" ? "Oturum doğrulanamadı. Lütfen tekrar giriş yap." : "Your session could not be verified. Please sign in again."}
          </p>
          <a href="/login" className="btn-primary">
            {dict.nav.login}
          </a>
        </>
      ) : (
        <p className="font-mono text-sm text-fg-dim">
          {dict.common.loading}
          <span className="caret ml-1 text-accent">▍</span>
        </p>
      )}
    </div>
  );
}

/** Clears the refresh counter once the server has verified the session. */
export function SessionOk() {
  useEffect(() => {
    try {
      sessionStorage.removeItem(ATTEMPT_KEY);
    } catch {
      // ignore
    }
  }, []);
  return null;
}
