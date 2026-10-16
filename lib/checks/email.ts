import { parse as parseDomain } from "tldts";
import disposableList from "@/lib/data/disposable-domains.json";
import { FREE_PROVIDERS, ROLE_ACCOUNTS, TLD_TYPOS, TYPO_TARGETS } from "@/lib/data/email-lists";
import { clampScore, levenshtein, riskLevel, type CheckResult, type RiskLevel } from "@/lib/checks/text";

const DISPOSABLE = new Set<string>(disposableList as string[]);

// Pragmatic RFC 5322 subset: dot-atom local part and a hostname with a TLD.
const LOCAL_RE = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/;
const DOMAIN_RE = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

export interface EmailCheckData {
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

export type MxLookup = (domain: string) => Promise<boolean>;

export function splitEmail(email: string): { local: string; domain: string } | null {
  const at = email.lastIndexOf("@");
  if (at <= 0 || at === email.length - 1) return null;
  return { local: email.slice(0, at), domain: email.slice(at + 1).toLowerCase() };
}

export function isValidEmailSyntax(email: string): boolean {
  if (email.length > 254) return false;
  const parts = splitEmail(email);
  if (!parts) return false;
  if (parts.local.length > 64) return false;
  return LOCAL_RE.test(parts.local) && DOMAIN_RE.test(parts.domain);
}

export function isDisposableDomain(domain: string): boolean {
  const d = domain.toLowerCase();
  if (DISPOSABLE.has(d)) return true;
  const registrable = parseDomain(d).domain;
  return !!registrable && DISPOSABLE.has(registrable);
}

export function suggestDomain(domain: string): string | null {
  const d = domain.toLowerCase();
  if (TYPO_TARGETS.includes(d) || FREE_PROVIDERS.has(d)) return null;

  let best: { domain: string; distance: number } | null = null;
  for (const target of TYPO_TARGETS) {
    const distance = levenshtein(d, target);
    if (distance > 0 && distance <= 2 && (!best || distance < best.distance)) best = { domain: target, distance };
  }
  if (best) return best.domain;

  const dot = d.lastIndexOf(".");
  if (dot > 0) {
    const name = d.slice(0, dot);
    const tld = d.slice(dot + 1);
    const fixedTld = TLD_TYPOS[tld];
    if (fixedTld) {
      const candidate = `${name}.${fixedTld}`;
      if (TYPO_TARGETS.includes(candidate)) return candidate;
      if (tld !== "co") return candidate;
    }
  }
  return null;
}

export async function checkEmail(rawEmail: string, mxLookup?: MxLookup): Promise<CheckResult<EmailCheckData>> {
  const email = rawEmail.trim();
  const sources = ["syntax", "disposable_list"];
  let partial = false;
  const validSyntax = isValidEmailSyntax(email);
  const parts = splitEmail(email);
  const domain = parts?.domain ?? "";
  const localBase = (parts?.local ?? "").toLowerCase().split("+")[0] ?? "";

  const disposable = validSyntax && isDisposableDomain(domain);
  const roleBased = validSyntax && ROLE_ACCOUNTS.has(localBase);
  const freeProvider = validSyntax && FREE_PROVIDERS.has(domain);
  const suggestion = validSyntax ? suggestDomain(domain) : null;
  const didYouMean = suggestion && parts ? `${parts.local}@${suggestion}` : null;

  let hasMx: boolean | null = null;
  if (validSyntax && mxLookup) {
    try {
      hasMx = await mxLookup(domain);
      sources.push("mx");
    } catch {
      partial = true;
    }
  }

  let score: number;
  if (!validSyntax) {
    score = 100;
  } else {
    score = 0;
    if (disposable) score += 70;
    if (hasMx === false) score += 50;
    if (didYouMean) score += 25;
    if (roleBased) score += 15;
  }
  score = clampScore(score);

  return {
    data: {
      email,
      valid_syntax: validSyntax,
      disposable,
      has_mx: hasMx,
      role_based: roleBased,
      free_provider: freeProvider,
      did_you_mean: didYouMean,
      risk: riskLevel(score),
      score,
    },
    sources,
    partial,
  };
}
