import type { Metadata } from "next";
import { currentUserId } from "@/lib/session";
import { getI18n } from "@/lib/i18n/server";
import { Playground } from "@/components/playground/playground";
import { SessionGate } from "@/components/session-gate";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  return { title: dict.playground.title };
}

export default async function PlaygroundPage() {
  const [{ dict }, userId] = await Promise.all([getI18n(), currentUserId()]);
  return (
    <div className="frame px-4 py-10 md:px-10">
      <p className="eyebrow-accent">[ {dict.playground.title} ]</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">{dict.playground.title}</h1>
      <p className="mt-2 max-w-3xl text-fg-muted">{dict.playground.subtitle}</p>
      <div className="mt-8">
        {userId ? <Playground /> : <SessionGate />}
      </div>
    </div>
  );
}
