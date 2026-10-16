import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";
import { requireUserId } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/server";

const ENDPOINTS = ["/url/check", "/email/check", "/password/range", "/headers", "/ip", "/secrets/scan"];
const STATUS_GROUPS = ["2xx", "4xx", "5xx"] as const;
const PAGE_SIZE = 50;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

export default async function LogsPage({ searchParams }: { searchParams: SearchParams }) {
  const { dict, locale } = await getI18n();
  const userId = await requireUserId();
  const sp = await searchParams;
  const endpoint = ENDPOINTS.includes(first(sp.endpoint) ?? "") ? first(sp.endpoint)! : "";
  const statusRaw = first(sp.status) ?? "";
  const status = (STATUS_GROUPS as readonly string[]).includes(statusRaw) ? statusRaw : "";
  const page = Math.max(1, Math.min(1000, Number.parseInt(first(sp.page) ?? "1", 10) || 1));

  let query = supabaseAdmin()
    .from("usage_logs")
    .select("id, endpoint, status_code, latency_ms, created_at, api_key_id, api_keys(name, key_prefix)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  if (endpoint) query = query.eq("endpoint", endpoint);
  if (status) {
    const base = Number(status[0]) * 100;
    query = query.gte("status_code", base).lt("status_code", base + 100);
  }
  const { data } = await query;
  const rows = (data ?? []).slice(0, PAGE_SIZE);
  const hasNext = (data ?? []).length > PAGE_SIZE;

  const fmt = new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-US", { dateStyle: "short", timeStyle: "medium" });
  const href = (p: number) => {
    const params = new URLSearchParams();
    if (endpoint) params.set("endpoint", endpoint);
    if (status) params.set("status", status);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return `/dashboard/logs${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow-accent">[ {dict.dashboard.logs} ]</p>
        <h1 className="mt-2 text-2xl font-semibold">{dict.logs.title}</h1>
        <p className="mt-2 text-sm text-fg-muted">{dict.logs.subtitle}</p>
      </div>

      <form method="get" className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="block flex-1">
          <span className="eyebrow mb-2 block">{dict.logs.endpoint}</span>
          <select name="endpoint" defaultValue={endpoint} className="input">
            <option value="">{dict.logs.all}</option>
            {ENDPOINTS.map((e) => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
        </label>
        <label className="block sm:w-40">
          <span className="eyebrow mb-2 block">{dict.logs.status}</span>
          <select name="status" defaultValue={status} className="input">
            <option value="">{dict.logs.all}</option>
            {STATUS_GROUPS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
        <button type="submit" className="btn-ghost">{dict.logs.filter}</button>
      </form>

      {rows.length === 0 ? (
        <p className="border border-line p-6 text-fg-muted">{dict.logs.empty}</p>
      ) : (
        <div className="overflow-x-auto border border-line">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-bg-soft">
              <tr className="font-mono text-[11px] uppercase tracking-wider text-fg-dim">
                <th className="px-4 py-3 font-normal">{dict.logs.time}</th>
                <th className="px-4 py-3 font-normal">{dict.logs.endpoint}</th>
                <th className="px-4 py-3 font-normal">{dict.logs.status}</th>
                <th className="px-4 py-3 font-normal">{dict.logs.latency}</th>
                <th className="px-4 py-3 font-normal">{dict.logs.source}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line font-mono text-[12px]">
              {rows.map((r) => {
                const key = (Array.isArray(r.api_keys) ? r.api_keys[0] : r.api_keys) as { name: string; key_prefix: string } | null;
                const code = r.status_code as number;
                return (
                  <tr key={r.id as number}>
                    <td className="px-4 py-2.5 text-fg-muted">{fmt.format(new Date(r.created_at as string))}</td>
                    <td className="px-4 py-2.5 text-fg">{r.endpoint as string}</td>
                    <td className={`px-4 py-2.5 ${code >= 500 ? "text-danger" : code >= 400 ? "text-warn" : "text-accent"}`}>{code}</td>
                    <td className="px-4 py-2.5 text-fg-muted">{r.latency_ms as number} ms</td>
                    <td className="px-4 py-2.5 text-fg-dim">{key ? `${key.name} (${key.key_prefix}…)` : r.api_key_id ? "—" : dict.logs.playground}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex justify-between">
        {page > 1 ? <Link className="btn-ghost" href={href(page - 1)}>← {dict.logs.prev}</Link> : <span />}
        {hasNext ? <Link className="btn-ghost" href={href(page + 1)}>{dict.logs.next} →</Link> : null}
      </div>
    </div>
  );
}
