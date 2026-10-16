import { NextResponse, type NextRequest } from "next/server";

/** Clerk Frontend API host from the publishable key (pk_test_/pk_live_ + base64("host$")). */
function clerkFrontendApi(): string | null {
  const pk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";
  const m = /^pk_(?:test|live)_([A-Za-z0-9+/=_-]+)$/.exec(pk);
  if (!m) return null;
  try {
    const host = atob(m[1]!).replace(/\$$/, "");
    return /^[a-z0-9.-]+$/i.test(host) ? host : null;
  } catch {
    return null;
  }
}

function buildCsp(nonce: string): string {
  const fapi = clerkFrontendApi();
  const clerk = fapi ? `https://${fapi}` : "";
  const isDev = process.env.NODE_ENV === "development";
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    // 'strict-dynamic' lets the nonce'd Clerk loader pull in clerk-js / clerk-ui.
    "script-src": ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", ...(isDev ? ["'unsafe-eval'"] : [])],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "https://img.clerk.com"],
    "font-src": ["'self'"],
    "connect-src": ["'self'", clerk, "https://clerk-telemetry.com", "https://*.clerk-telemetry.com"].filter(Boolean),
    "frame-src": ["'self'", "https://challenges.cloudflare.com", clerk].filter(Boolean),
    "worker-src": ["'self'", "blob:"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };
  return [
    ...Object.entries(directives).map(([k, v]) => `${k} ${v.join(" ")}`),
    "upgrade-insecure-requests",
  ].join("; ");
}

/** Adds a per-request nonce and a strict Content-Security-Policy to every page. */
export function proxy(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const csp = buildCsp(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", csp);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("content-security-policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!_next|api/|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
