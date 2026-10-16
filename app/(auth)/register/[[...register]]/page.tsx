import type { Metadata } from "next";
import { SignUp } from "@clerk/nextjs";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  return { title: dict.nav.register, robots: { index: false } };
}

export default async function RegisterPage() {
  const { dict } = await getI18n();
  return (
    <div className="w-full max-w-md">
      <p className="eyebrow-accent">[ {dict.nav.register} ]</p>
      <h1 className="mt-3 text-2xl font-semibold">{dict.auth.registerTitle}</h1>
      <p className="mt-2 text-sm text-fg-muted">{dict.auth.registerSubtitle}</p>
      <div className="mt-6">
        <SignUp path="/register" routing="path" signInUrl="/login" fallbackRedirectUrl="/dashboard" />
      </div>
    </div>
  );
}
