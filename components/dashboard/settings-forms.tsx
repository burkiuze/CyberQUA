"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import { useI18n } from "@/components/i18n-provider";
import type { Locale } from "@/lib/i18n/locale";

export function LanguageForm({ current }: { current: Locale }) {
  const { dict, locale } = useI18n();
  const router = useRouter();
  const [value, setValue] = useState<Locale>(current);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  return (
    <form
      className="flex flex-col gap-3 sm:flex-row sm:items-end"
      onSubmit={async (e) => {
        e.preventDefault();
        setState("saving");
        const res = await fetch("/api/internal/settings", {
          method: "POST",
          headers: { "content-type": "application/json", "accept-language": locale },
          body: JSON.stringify({ locale: value }),
        }).catch(() => null);
        setState(res?.ok ? "saved" : "error");
        if (res?.ok) router.refresh();
      }}
    >
      <label className="block flex-1">
        <span className="eyebrow mb-2 block">{dict.settings.language}</span>
        <select className="input" value={value} onChange={(e) => setValue(e.target.value as Locale)}>
          <option value="tr">Türkçe</option>
          <option value="en">English</option>
        </select>
      </label>
      <button type="submit" className="btn-primary" disabled={state === "saving"}>
        {state === "saved" ? dict.settings.saved : dict.settings.save}
      </button>
      {state === "error" ? <span className="text-sm text-danger">{dict.common.error}</span> : null}
    </form>
  );
}

export function DeleteAccount() {
  const { dict, locale } = useI18n();
  const { signOut } = useClerk();
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (confirm !== dict.settings.deleteWord) return;
        setBusy(true);
        setError(null);
        const res = await fetch("/api/internal/account", {
          method: "DELETE",
          headers: { "accept-language": locale },
        }).catch(() => null);
        if (res?.ok) {
          await signOut({ redirectUrl: "/" });
          return;
        }
        setBusy(false);
        setError(dict.common.error);
      }}
    >
      <label className="block">
        <span className="eyebrow mb-2 block">{dict.settings.deleteConfirmLabel}</span>
        <input className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
      </label>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <button type="submit" className="btn-danger" disabled={busy || confirm !== dict.settings.deleteWord}>
        {busy ? dict.settings.deleting : dict.settings.deleteButton}
      </button>
    </form>
  );
}
