"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useI18n } from "@/components/i18n-provider";

const axis = { stroke: "var(--fg-dim)", fontSize: 11, fontFamily: "var(--font-jetbrains)" };

export function RequestsChart({ data }: { data: Array<{ day: string; requests: number; errors: number }> }) {
  const { dict } = useI18n();
  const rows = data.map((d) => ({ ...d, ok: d.requests - d.errors, label: d.day.slice(5) }));
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid stroke="var(--line)" vertical={false} />
          <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={{ stroke: "var(--line)" }} interval="preserveStartEnd" minTickGap={16} />
          <YAxis tick={axis} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip
            cursor={{ fill: "var(--accent-soft)" }}
            contentStyle={{
              background: "var(--bg-elev)",
              border: "1px solid var(--line-strong)",
              borderRadius: 0,
              fontFamily: "var(--font-jetbrains)",
              fontSize: 12,
              color: "var(--fg)",
            }}
          />
          <Bar dataKey="ok" stackId="a" name={dict.dashboard.requests} fill="var(--accent)" />
          <Bar dataKey="errors" stackId="a" name={dict.dashboard.errors} fill="var(--danger)" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
