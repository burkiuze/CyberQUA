"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/i18n-provider";
import { CopyButton } from "@/components/ui/copy-button";

export interface KeyRow {
  id: string;
  name: string;
  type: "secret" | "publishable";
  key_prefix: string;
  allowed_origins: string[];
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

interface ApiErrorBody {
  success: false;
  error: { code: string; message: string; details?: Array<{ field: string; message: string }> };
}

export function KeysManager({ initialKeys, maxKeys }: { initialKeys: KeyRow[]; maxKeys: number }) {
  const { dict, locale } = useI18n();
  const router = useRouter();
  const [keys, setKeys] = useState(initialKeys);
  const [name, setName] = useState("");
  const [type, setType] = useState<"secret" | "publishable">("secret");
  const [origins, setOrigins] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const active = keys.filter((k) => !k.revoked_at).length;
  const fmt = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString(locale === "tr" ? "tr-TR" : "en-US", { dateStyle: "medium", timeStyle: "short" }) : dict.keys.never;

  function describe(body: ApiErrorBody) {
    const details = body.error.details?.map((d) => `${d.field}: ${d.message}`).join("; ");
    return details ? `${body.error.message} (${details})` : body.error.message;
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/internal/keys", {
        method: "POST",
        headers: { "content-type": "application/json", "accept-language": locale },
        body: JSON.stringify({
          name,
          type,
          allowed_origins: type === "publishable" ? origins.split(/\s+/).map((o) => o.trim()).filter(Boolean) : [],
        }),
      });
      const body = (await res.json()) as { key: string; record: KeyRow } | ApiErrorBody;
      if (!res.ok || "success" in body) {
        setError(describe(body as ApiErrorBody));
        return;
      }
      setKeys((prev) => [body.record, ...prev]);
      setNewKey(body.key);
      setName("");
      setOrigins("");
      router.refresh();
    } catch {
      setError(dict.common.error);
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/internal/keys?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: { "accept-language": locale },
      });
      if (!res.ok) {
        setError(describe((await res.json()) as ApiErrorBody));
        return;
      }
      setKeys((prev) => prev.map((k) => (k.id === id ? { ...k, revoked_at: new Date().toISOString() } : k)));
      setConfirmId(null);
    } catch {
      setError(dict.common.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <form onSubmit={create} className="card space-y-4 p-5">
        <p className="eyebrow-accent">{dict.keys.create}</p>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="eyebrow mb-2 block">{dict.keys.name}</span>
            <input className="input" required maxLength={50} value={name} onChange={(e) => setName(e.target.value)} placeholder={dict.keys.namePlaceholder} />
          </label>
          <fieldset>
            <legend className="eyebrow mb-2 block">{dict.keys.type}</legend>
            <div className="grid grid-cols-2 gap-px border border-line-strong bg-line-strong">
              {(["secret", "publishable"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={type === t}
                  onClick={() => setType(t)}
                  className={`min-h-11 px-2 font-mono text-[12px] uppercase tracking-wider ${type === t ? "bg-accent text-accent-ink" : "bg-bg-elev text-fg-muted hover:text-fg"}`}
                >
                  {t === "secret" ? dict.keys.secret : dict.keys.publishable}
                </button>
              ))}
            </div>
          </fieldset>
        </div>
        {type === "publishable" ? (
          <label className="block">
            <span className="eyebrow mb-2 block">{dict.keys.origins}</span>
            <textarea
              className="input min-h-24 py-2"
              required
              value={origins}
              onChange={(e) => setOrigins(e.target.value)}
              placeholder={"https://example.com\nhttps://*.example.com"}
            />
            <span className="mt-1 block text-xs text-fg-dim">{dict.keys.originsHelp}</span>
          </label>
        ) : null}
        {error ? <p className="font-mono text-sm text-danger">! {error}</p> : null}
        <div className="flex flex-wrap items-center gap-4">
          <button type="submit" className="btn-primary" disabled={busy || active >= maxKeys || !name.trim()}>
            {busy ? dict.keys.creating : dict.keys.create}
          </button>
          <span className="font-mono text-[12px] text-fg-dim">
            {active}/{maxKeys} {dict.keys.active.toLowerCase()}
          </span>
          {active >= maxKeys ? <span className="text-sm text-warn">{dict.keys.limit}</span> : null}
        </div>
      </form>

      {newKey ? (
        <div role="dialog" aria-modal="true" aria-labelledby="new-key-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="card w-full max-w-lg p-6">
            <h2 id="new-key-title" className="text-lg font-semibold">{dict.keys.newKeyTitle}</h2>
            <p className="mt-2 border-l-2 border-warn pl-3 text-sm text-warn">{dict.keys.newKeyWarning}</p>
            <div className="mt-4 flex items-center border border-line-strong bg-bg">
              <code className="flex-1 overflow-x-auto whitespace-nowrap px-3 py-3 font-mono text-sm text-accent">{newKey}</code>
              <CopyButton value={newKey} className="border-l border-line-strong" />
            </div>
            <button type="button" className="btn-primary mt-6 w-full" onClick={() => setNewKey(null)}>
              {dict.keys.done}
            </button>
          </div>
        </div>
      ) : null}

      {confirmId ? (
        <div role="alertdialog" aria-modal="true" aria-labelledby="revoke-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="card w-full max-w-md p-6">
            <h2 id="revoke-title" className="text-lg font-semibold">{dict.keys.revokeTitle}</h2>
            <p className="mt-2 text-sm text-fg-muted">{dict.keys.revokeBody}</p>
            <p className="mt-3 font-mono text-sm text-fg">{keys.find((k) => k.id === confirmId)?.key_prefix}…</p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button type="button" className="btn-ghost" onClick={() => setConfirmId(null)} disabled={busy}>
                {dict.keys.cancel}
              </button>
              <button type="button" className="btn-danger" onClick={() => void revoke(confirmId)} disabled={busy}>
                {dict.keys.confirm}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {keys.length === 0 ? (
        <p className="text-fg-muted">{dict.keys.empty}</p>
      ) : (
        <div className="overflow-x-auto border border-line">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-bg-soft">
              <tr className="font-mono text-[11px] uppercase tracking-wider text-fg-dim">
                <th className="px-4 py-3 font-normal">{dict.keys.name}</th>
                <th className="px-4 py-3 font-normal">{dict.keys.type}</th>
                <th className="px-4 py-3 font-normal">{dict.keys.prefix}</th>
                <th className="px-4 py-3 font-normal">{dict.keys.created}</th>
                <th className="px-4 py-3 font-normal">{dict.keys.lastUsed}</th>
                <th className="px-4 py-3 font-normal">{dict.keys.status}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {keys.map((k) => (
                <tr key={k.id} className={k.revoked_at ? "opacity-50" : ""}>
                  <td className="px-4 py-3">
                    <p className="font-medium">{k.name}</p>
                    {k.allowed_origins.length > 0 ? <p className="mt-1 font-mono text-[11px] text-fg-dim">{k.allowed_origins.join(", ")}</p> : null}
                  </td>
                  <td className="px-4 py-3 font-mono text-[12px] text-fg-muted">{k.type === "secret" ? dict.keys.secret : dict.keys.publishable}</td>
                  <td className="px-4 py-3 font-mono text-[12px] text-accent">{k.key_prefix}…</td>
                  <td className="px-4 py-3 text-fg-muted">{fmt(k.created_at)}</td>
                  <td className="px-4 py-3 text-fg-muted">{fmt(k.last_used_at)}</td>
                  <td className="px-4 py-3 font-mono text-[11px] uppercase">
                    {k.revoked_at ? <span className="text-danger">{dict.keys.revoked}</span> : <span className="text-accent">{dict.keys.active}</span>}
                  </td>
                  <td className="px-2 py-1 text-right">
                    {!k.revoked_at ? (
                      <button type="button" className="min-h-11 px-3 font-mono text-[12px] uppercase tracking-wider text-danger hover:underline" onClick={() => setConfirmId(k.id)}>
                        {dict.keys.revoke}
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
