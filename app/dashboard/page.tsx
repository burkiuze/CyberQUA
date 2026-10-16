import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";
import { ensureProfile, requireUserId } from "@/lib/auth";
import { getMonthlyUsage, getUsageSummary } from "@/lib/dashboard";
import { planLimits } from "@/lib/plans";
import { Corners } from "@/components/ui/corners";
import { RequestsChart } from "@/components/dashboard/charts";

export default async function DashboardPage() {
  const { dict, locale } = await getI18n();
  const userId = await requireUserId();
  const [profile, summary, used] = await Promise.all([ensureProfile(userId), getUsageSummary(userId), getMonthlyUsage(userId)]);
  const limits = planLimits(profile.plan);
  const pct = Math.min(100, Math.round((used / limits.monthlyQuota) * 100));
  const errorRate = summary.total > 0 ? (summary.errors / summary.total) * 100 : 0;
  const nf = new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-US");
  const maxEndpoint = Math.max(1, ...summary.endpoints.map((e) => e.requests));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow-accent">[ {dict.dashboard.overview} ]</p>
          <h1 className="mt-2 text-2xl font-semibold">{profile.display_name ?? dict.dashboard.overview}</h1>
        </div>
        <span className="border border-line px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-fg-muted">
          {dict.dashboard.plan}: <span className="text-accent">{profile.plan}</span>
        </span>
      </div>

      <div className="card p-6">
        <Corners className="text-accent" />
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="eyebrow">{dict.dashboard.thisMonth}</p>
          <p className="font-mono text-sm text-fg-muted">
            <span className="text-2xl font-semibold text-fg">{nf.format(used)}</span> / {nf.format(limits.monthlyQuota)}
          </p>
        </div>
        <div className="mt-4 flex gap-[3px]" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={dict.dashboard.quota}>
          {Array.from({ length: 40 }, (_, i) => (
            <span
              key={i}
              className="h-4 flex-1"
              style={{ background: i < Math.round(pct / 2.5) ? (pct >= 90 ? "var(--danger)" : "var(--accent)") : "var(--line)" }}
            />
          ))}
        </div>
        <p className="mt-2 font-mono text-[11px] text-fg-dim">{pct}%</p>
      </div>

      <div className="grid gap-px border border-line bg-line sm:grid-cols-3">
        {[
          [dict.dashboard.requests30, nf.format(summary.total)],
          [dict.dashboard.errorRate, `${errorRate.toFixed(1)}%`],
          [dict.dashboard.avgLatency, `${nf.format(summary.avg_latency_ms)} ms`],
        ].map(([label, value]) => (
          <div key={label} className="bg-bg p-5">
            <p className="eyebrow">{label}</p>
            <p className="mt-2 font-mono text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </div>

      {summary.total === 0 ? (
        <div className="card flex flex-col items-start gap-4 p-6">
          <p className="text-fg-muted">{dict.dashboard.noData}</p>
          <Link href="/dashboard/keys" className="btn-primary">
            {dict.dashboard.createFirst} →
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
          <div className="card p-5">
            <p className="eyebrow mb-4">{dict.dashboard.requests30}</p>
            <RequestsChart data={summary.daily} />
          </div>
          <div className="card p-5">
            <p className="eyebrow mb-4">{dict.dashboard.endpointDist}</p>
            <ul className="space-y-3">
              {summary.endpoints.map((e) => (
                <li key={e.endpoint}>
                  <div className="flex justify-between font-mono text-[12px]">
                    <span className="text-fg">{e.endpoint}</span>
                    <span className="text-fg-muted">{nf.format(e.requests)}</span>
                  </div>
                  <div className="mt-1 h-2 bg-line">
                    <div className="h-2 bg-purple" style={{ width: `${(e.requests / maxEndpoint) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
