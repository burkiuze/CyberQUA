import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { DashboardNav } from "@/components/dashboard/nav";
import { ensureProfile, requireUserId } from "@/lib/auth";

export const metadata: Metadata = { robots: { index: false } };

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const userId = await requireUserId();
  await ensureProfile(userId);
  return (
    <>
      <SiteHeader />
      <div className="frame grid min-h-[calc(100dvh-4rem)] md:grid-cols-[220px_1fr]">
        <aside className="border-line md:border-r">
          <div className="md:sticky md:top-16">
            <DashboardNav />
          </div>
        </aside>
        <main className="min-w-0 px-4 py-8 md:px-8">{children}</main>
      </div>
    </>
  );
}
