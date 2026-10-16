import type { Metadata } from "next";
import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  return { title: dict.auth.forgotTitle, robots: { index: false } };
}

/**
 * Password reset is handled by Clerk's sign-in flow ("Forgot password?" → email
 * code → new password). This page explains the flow and links into it.
 */
export default async function ForgotPasswordPage() {
  const { dict } = await getI18n();
  return (
    <div className="card w-full max-w-md p-8">
      <p className="eyebrow-accent">[ {dict.auth.forgotTitle} ]</p>
      <h1 className="mt-3 text-2xl font-semibold">{dict.auth.forgotTitle}</h1>
      <p className="mt-3 text-sm leading-6 text-fg-muted">{dict.auth.forgotSubtitle}</p>
      <ol className="mt-6 space-y-2 font-mono text-[12px] text-fg-muted">
        <li><span className="text-accent">01</span> → e-mail</li>
        <li><span className="text-accent">02</span> → &quot;Forgot password?&quot; / &quot;Şifremi unuttum&quot;</li>
        <li><span className="text-accent">03</span> → code → new password</li>
      </ol>
      <Link href="/login" className="btn-primary mt-8 w-full">
        {dict.auth.forgotCta}
      </Link>
      <Link href="/login" className="btn mt-2 w-full text-fg-muted hover:text-fg">
        ← {dict.nav.login}
      </Link>
    </div>
  );
}
