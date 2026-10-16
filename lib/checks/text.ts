import type { Locale } from "@/lib/i18n/locale";

export type Severity = "info" | "low" | "medium" | "high" | "critical";
export type RiskLevel = "safe" | "low" | "medium" | "high" | "critical";

export interface Reason {
  code: string;
  severity: Severity;
  message: string;
}

export type Bilingual = Record<Locale, string>;

export function t(locale: Locale, text: Bilingual): string {
  return text[locale];
}

export function riskLevel(score: number): RiskLevel {
  if (score >= 80) return "critical";
  if (score >= 60) return "high";
  if (score >= 40) return "medium";
  if (score >= 20) return "low";
  return "safe";
}

export function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j]! + 1, curr[j - 1]! + 1, prev[j - 1]! + cost);
    }
    prev = curr;
  }
  return prev[b.length]!;
}

/** Result envelope every check returns to the API layer. */
export interface CheckResult<T> {
  data: T;
  sources: string[];
  partial: boolean;
}
