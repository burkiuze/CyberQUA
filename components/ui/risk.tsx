type Risk = "safe" | "low" | "medium" | "high" | "critical";

const COLORS: Record<Risk, string> = {
  safe: "var(--ok)",
  low: "var(--accent)",
  medium: "var(--warn)",
  high: "var(--danger)",
  critical: "var(--danger)",
};

export function RiskBadge({ risk, label }: { risk: Risk; label: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 border px-2 py-1 font-mono text-[11px] uppercase tracking-wider"
      style={{ borderColor: COLORS[risk], color: COLORS[risk] }}
    >
      <span aria-hidden className="h-1.5 w-1.5" style={{ background: COLORS[risk] }} />
      {label}
    </span>
  );
}

/** Segmented score bar (20 cells), e2b-style. */
export function ScoreMeter({ score, risk }: { score: number; risk: Risk }) {
  const filled = Math.round(score / 5);
  return (
    <div>
      <div className="flex items-end gap-2">
        <span className="font-mono text-5xl font-semibold leading-none" style={{ color: COLORS[risk] }}>
          {score}
        </span>
        <span className="pb-1 font-mono text-sm text-fg-dim">/100</span>
      </div>
      <div className="mt-3 flex gap-[3px]" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={score}>
        {Array.from({ length: 20 }, (_, i) => (
          <span key={i} className="h-3 flex-1" style={{ background: i < filled ? COLORS[risk] : "var(--line)" }} />
        ))}
      </div>
    </div>
  );
}
