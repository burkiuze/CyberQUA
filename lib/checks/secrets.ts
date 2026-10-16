import { GENERIC_ASSIGNMENT_RULE, SECRET_RULES } from "@/lib/data/secret-rules";
import type { Locale } from "@/lib/i18n/locale";
import { t, type Severity } from "@/lib/checks/text";

export const MAX_SECRET_SCAN_BYTES = 100 * 1024;

export interface SecretFinding {
  rule_id: string;
  name: string;
  line: number;
  column: number;
  severity: Severity;
  masked: string;
  remediation: string;
}

export interface SecretScanData {
  filename: string | null;
  scanned_bytes: number;
  findings: SecretFinding[];
  summary: Record<Severity, number> & { total: number };
}

/** Shannon entropy in bits per character. */
export function shannonEntropy(value: string): number {
  if (value.length === 0) return 0;
  const counts = new Map<string, number>();
  for (const ch of value) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  let entropy = 0;
  for (const count of counts.values()) {
    const p = count / value.length;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

/**
 * Masks a secret so that it is never returned in full:
 * >= 16 chars → first 4 + **** + last 4, 8-15 chars → first 2 + **** + last 2, otherwise ****.
 */
export function maskSecret(secret: string): string {
  const value = secret.trim();
  if (value.length >= 16) return `${value.slice(0, 4)}****${value.slice(-4)}`;
  if (value.length >= 8) return `${value.slice(0, 2)}****${value.slice(-2)}`;
  return "****";
}

function lineStarts(content: string): number[] {
  const starts = [0];
  for (let i = 0; i < content.length; i++) if (content.charCodeAt(i) === 10) starts.push(i + 1);
  return starts;
}

function position(starts: number[], index: number): { line: number; column: number } {
  let lo = 0;
  let hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid]! <= index) lo = mid;
    else hi = mid - 1;
  }
  return { line: lo + 1, column: index - starts[lo]! + 1 };
}

const PLACEHOLDER_RE = /^(?:x+|\*+|your[_-]|<|\$\{|process\.env|os\.environ|env\(|example|changeme|placeholder|dummy|test|sample|xxxx)/i;

function remediation(locale: Locale, provider: string, revokeUrl: string, envVar: string): string {
  if (!provider) {
    return t(locale, {
      tr: "Bu değeri ilgili servisin panelinden hemen iptal edip yenileyin. Yeni değeri koda yazmak yerine bir ortam değişkeninde (ör. process.env.SECRET_VALUE) saklayın ve git geçmişinden temizleyin.",
      en: "Revoke and rotate this value in the issuing service right away. Store the new value in an environment variable (e.g. process.env.SECRET_VALUE) instead of code, and purge it from git history.",
    });
  }
  return t(locale, {
    tr: `Bu anahtarı ${provider} panelinden hemen iptal edip yenisini oluşturun: ${revokeUrl} . Yeni anahtarı koda yazmak yerine ${envVar} ortam değişkenine taşıyın (process.env.${envVar}) ve eski değeri git geçmişinden temizleyin.`,
    en: `Revoke this key in ${provider} immediately and issue a new one: ${revokeUrl} . Move the new key into the ${envVar} environment variable (process.env.${envVar}) instead of code and purge the old value from git history.`,
  });
}

/**
 * Scans text for leaked credentials. The content is processed in memory only:
 * it is never stored, logged or cached, and full secret values are never returned.
 */
export function scanSecrets(content: string, locale: Locale, filename: string | null = null): SecretScanData {
  const starts = lineStarts(content);
  const taken: Array<[number, number]> = [];
  const findings: SecretFinding[] = [];
  const overlaps = (s: number, e: number) => taken.some(([a, b]) => s < b && e > a);

  for (const rule of SECRET_RULES) {
    rule.regex.lastIndex = 0;
    for (const match of content.matchAll(rule.regex)) {
      const secret = match[1] ?? match[0];
      const start = (match.index ?? 0) + match[0].indexOf(secret);
      const end = start + secret.length;
      if (overlaps(start, end)) continue;
      if (rule.validate && !rule.validate(secret)) continue;
      taken.push([start, end]);
      const pos = position(starts, start);
      findings.push({
        rule_id: rule.id,
        name: rule.name,
        ...pos,
        severity: rule.severity,
        masked: maskSecret(secret),
        remediation: remediation(locale, rule.provider, rule.revokeUrl, rule.envVar),
      });
    }
  }

  const generic = GENERIC_ASSIGNMENT_RULE;
  generic.regex.lastIndex = 0;
  for (const match of content.matchAll(generic.regex)) {
    const value = match[2];
    if (!value) continue;
    const start = (match.index ?? 0) + match[0].lastIndexOf(value);
    const end = start + value.length;
    if (overlaps(start, end)) continue;
    if (PLACEHOLDER_RE.test(value)) continue;
    if (shannonEntropy(value) <= generic.minEntropy) continue;
    taken.push([start, end]);
    findings.push({
      rule_id: generic.id,
      name: generic.name,
      ...position(starts, start),
      severity: generic.severity,
      masked: maskSecret(value),
      remediation: remediation(locale, "", "", ""),
    });
  }

  findings.sort((a, b) => a.line - b.line || a.column - b.column);
  const summary = { total: findings.length, critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const f of findings) summary[f.severity]++;

  return {
    filename,
    scanned_bytes: new TextEncoder().encode(content).length,
    findings,
    summary,
  };
}
