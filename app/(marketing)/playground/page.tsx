import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { getI18n } from "@/lib/i18n/server";
import { Playground } from "@/components/playground/playground";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  return { title: dict.playground.title };
}

export default async function PlaygroundPage() {
  const [{ dict }, { userId }] = await Promise.all([getI18n(), auth()]);
  return (
    <div className="frame px-4 py-10 md:px-10">
      <p className="eyebrow-accent">[ {dict.playground.title} ]</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">{dict.playground.title}</h1>
      <p className="mt-2 max-w-3xl text-fg-muted">{dict.playground.subtitle}</p>
      <div className="mt-8">
        {userId ? (
          <Playground />
        ) : (
          <div className="card flex flex-col items-start gap-4 p-6">
            <p className="text-fg-muted">{dict.playground.loginRequired}</p>
            <div className="flex gap-3">
              <Link href="/login" className="btn-primary">{dict.nav.login}</Link>
              <Link href="/register" className="btn-ghost">{dict.nav.register}</Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
