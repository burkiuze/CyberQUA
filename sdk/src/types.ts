export type Locale = "tr" | "en";
export type RiskLevel = "safe" | "low" | "medium" | "high" | "critical";
export type Severity = "info" | "low" | "medium" | "high" | "critical";

export interface Meta {
  request_id: string;
  latency_ms: number;
  sources_used: string[];
  partial: boolean;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta: Meta;
}

export interface Reason {
  code: string;
  severity: Severity;
  message: string;
}

export interface UrlCheckResult {
  url: string;
  domain: string;
  risk: RiskLevel;
  score: number;
  reasons: Reason[];
  checks: {
    lookalike: { brand: string; distance: number; kind: "typosquat" | "homoglyph" | "combosquat" | "subdomain" } | null;
    domain_age_days: number | null;
    suspicious_tld: boolean;
    shortened: boolean;
    blacklisted: boolean | null;
    ip_host: boolean;
    https: boolean;
    punycode: boolean;
    suspicious_keywords: string[];
    redirect_param: boolean;
    subdomain_count: number;
    length: number;
  };
}

export interface PasswordRangeResult {
  prefix: string;
  suffixes: Array<{ suffix: string; count: number }>;
}

export interface PasswordCheckResult {
  /** 0 (very weak) – 4 (very strong) */
  score: 0 | 1 | 2 | 3 | 4;
  leaked: boolean;
  leak_count: number;
  tips: string[];
}

export interface HeaderIssue {
  header: string;
  severity: Severity;
  message: string;
}

export interface HeadersCheckResult {
  url: string;
  final_url: string;
  status: number;
  grade: "A+" | "A" | "B" | "C" | "D" | "F";
  score: number;
  checks: Record<string, unknown>;
  issues: HeaderIssue[];
  fixes: {
    missing: string[];
    vercel_json: string;
    netlify_headers: string;
    next_config: string;
    express: string;
    nginx: string;
  };
}

export interface EmailCheckResult {
  email: string;
  valid_syntax: boolean;
  disposable: boolean;
  has_mx: boolean | null;
  role_based: boolean;
  free_provider: boolean;
  did_you_mean: string | null;
  risk: RiskLevel;
  score: number;
}

export interface IpCheckResult {
  ip: string;
  version: 4 | 6;
  is_private: boolean;
  is_tor_exit: boolean | null;
  abuse_score: number | null;
  country: string | null;
  risk: RiskLevel;
  score: number;
}

export interface SecretFinding {
  rule_id: string;
  name: string;
  line: number;
  column: number;
  severity: Severity;
  masked: string;
  remediation: string;
}

export interface SecretsScanResult {
  filename: string | null;
  scanned_bytes: number;
  findings: SecretFinding[];
  summary: Record<Severity, number> & { total: number };
}
