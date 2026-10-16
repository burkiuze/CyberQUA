import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";

const isProtectedPage = createRouteMatcher(["/dashboard(.*)"]);
const isInternalApi = createRouteMatcher(["/api/internal(.*)"]);

const clerkProxy = clerkMiddleware(
  async (auth, req) => {
    if (isInternalApi(req)) {
      const { userId } = await auth();
      if (!userId) {
        return NextResponse.json(
          { success: false, error: { code: "unauthorized", message: "Unauthorized" } },
          { status: 401 },
        );
      }
      return;
    }
    if (isProtectedPage(req)) {
      await auth.protect();
    }
  },
  {
    signInUrl: "/login",
    signUpUrl: "/register",
    // Nonce-based strict CSP ('strict-dynamic'); Clerk merges its own required sources.
    contentSecurityPolicy: {
      strict: true,
      directives: {
        "object-src": ["none"],
        "base-uri": ["self"],
        "frame-ancestors": ["none"],
        "form-action": ["self"],
        "img-src": ["self", "data:", "https://img.clerk.com"],
        "font-src": ["self"],
        "upgrade-insecure-requests": [],
      },
    },
  },
);

/**
 * Until CLERK_SECRET_KEY is configured the public pages (home, docs, legal)
 * keep working; session-only areas answer with a clear "not configured" state.
 */
export default function proxy(req: NextRequest, event: NextFetchEvent) {
  if (!process.env.CLERK_SECRET_KEY) {
    if (isInternalApi(req)) {
      return NextResponse.json(
        { success: false, error: { code: "auth_not_configured", message: "Authentication is not configured yet." } },
        { status: 503 },
      );
    }
    if (isProtectedPage(req)) return NextResponse.redirect(new URL("/login", req.url));
    return NextResponse.next();
  }
  return clerkProxy(req, event);
}

export const config = {
  matcher: [
    // Pages (skip Next internals and static files)
    "/((?!_next|api/|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Internal session APIs only — the public /api/v1 routes authenticate with API keys.
    "/api/internal/(.*)",
  ],
};
