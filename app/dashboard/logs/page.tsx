import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";
import { currentUserId } from "@/lib/session";
import { listLogs } from "@/lib/dashboard";

const ENDPOINTS = ["/url/check", "/email/check", "/password/range", "/headers", "/ip", "/secrets/scan"];
const STATUS_GROUPS = ["2xx", "4xx", "5xx"] as const;
const PAGE_SIZE = 50;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

export default async function LogsPage({ searchParams }: { searchParams: SearchParams }) {
  const { dict, locale } = await getI18n();
  const userId = await currentUserId();
  if (!userId) return null;
  const sp = await searchParams;
  const endpoint = ENDPOINTS.includes(first(sp.endpoint) ?? "") ? first(sp.endpoint)! : "";
  const statusRaw = first(sp.status) ?? "";
  const status = (STATUS_GROUPS as readonly string[]).includes(statusRaw) ? statusRaw : "";
  const page = Math.max(1, Math.min(1000, Number.parseInt(first(sp.page) ?? "1", 10) || 1));

  const base = status ? Number(status[0]) * 100 : null;
  const data = await listLogs(userId, {
    endpoint: endpoint || null,
    statusMin: base,
    statusMax: base !== null ? base + 100 : null,
    offset: (page - 1) * PAGE_SIZE,
    limit: PAGE_SIZE + 1,
  });
  const rows = data.slice(0, PAGE_SIZE);
  const hasNext = data.length > PAGE_SIZE;

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
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-2.5 text-fg-muted">{fmt.format(new Date(r.created_at))}</td>
                  <td className="px-4 py-2.5 text-fg">{r.endpoint}</td>
                  <td className={`px-4 py-2.5 ${r.status_code >= 500 ? "text-danger" : r.status_code >= 400 ? "text-warn" : "text-accent"}`}>{r.status_code}</td>
                  <td className="px-4 py-2.5 text-fg-muted">{r.latency_ms} ms</td>
                  <td className="px-4 py-2.5 text-fg-dim">
                    {r.key_name ? `${r.key_name} (${r.key_prefix}…)` : r.api_key_id ? "—" : dict.logs.playground}
                  </td>
                </tr>
              ))}
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
