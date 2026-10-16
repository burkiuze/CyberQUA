import { domainToUnicode } from "node:url";
import { parse as parseDomain } from "tldts";
import { BRANDS, REDIRECT_PARAMS, SUSPICIOUS_KEYWORDS, SUSPICIOUS_TLDS, URL_SHORTENERS, type Brand } from "@/lib/data/brands";
import type { Locale } from "@/lib/i18n/locale";
import { clampScore, levenshtein, riskLevel, t, type CheckResult, type Reason, type RiskLevel, type Severity } from "@/lib/checks/text";

/* -------------------------------------------------------------------------- */
/*                               Homoglyphs                                   */
/* -------------------------------------------------------------------------- */

const CONFUSABLES: Record<string, string> = {
  // Cyrillic
  "а": "a", "в": "b", "е": "e", "ё": "e", "к": "k", "м": "m", "н": "h", "о": "o", "р": "p", "с": "c", "т": "t",
  "у": "y", "х": "x", "ѕ": "s", "і": "i", "ї": "i", "ј": "j", "ԁ": "d", "һ": "h", "ӏ": "l", "ԛ": "q", "ԝ": "w",
  "ɡ": "g", "ո": "n", "ս": "u", "ց": "g", "ı": "i",
  // Greek
  "α": "a", "β": "b", "ε": "e", "ι": "i", "κ": "k", "ν": "v", "ο": "o", "ρ": "p", "τ": "t", "υ": "u", "χ": "x",
  // Latin lookalikes / accents
  "à": "a", "á": "a", "â": "a", "ä": "a", "å": "a", "ã": "a", "ç": "c", "è": "e", "é": "e", "ê": "e", "ë": "e",
  "ì": "i", "í": "i", "î": "i", "ï": "i", "ğ": "g", "ñ": "n", "ò": "o", "ó": "o", "ô": "o", "ö": "o", "õ": "o",
  "ş": "s", "ù": "u", "ú": "u", "û": "u", "ü": "u", "ý": "y", "ÿ": "y", "ł": "l", "ß": "ss",
};

/**
 * Produces normalised spellings of a label: Unicode confusables are mapped to
 * ASCII, then digit/letter substitutions (0→o, 1→l|i, 3→e, 4→a, 5→s, rn→m, vv→w).
 */
export function homoglyphVariants(label: string): string[] {
  const unicode = label.toLowerCase().normalize("NFKC");
  let base = "";
  for (const ch of unicode) base += CONFUSABLES[ch] ?? ch;
  base = base.replace(/0/g, "o").replace(/3/g, "e").replace(/4/g, "a").replace(/5/g, "s").replace(/\$/g, "s").replace(/@/g, "a");
  const variants = new Set<string>();
  for (const one of ["l", "i"]) {
    const v = base.replace(/1/g, one).replace(/!/g, "i").replace(/\|/g, "l");
    variants.add(v);
    variants.add(v.replace(/rn/g, "m").replace(/vv/g, "w").replace(/cl/g, "d"));
  }
  return [...variants];
}

/** Tokens of a label split on hyphens, plus the hyphen-less form. */
function tokensOf(label: string): string[] {
  const parts = label.split("-").filter(Boolean);
  const joined = parts.join("");
  return [...new Set([...parts, joined])];
}

function maxDistanceFor(token: string): number {
  if (token.length >= 8) return 2;
  if (token.length >= 5) return 1;
  return 0;
}

function isOfficialDomain(registrable: string | null, brand: Brand): boolean {
  return !!registrable && brand.domains.includes(registrable);
}

function isAnyOfficialDomain(registrable: string | null): Brand | null {
  if (!registrable) return null;
  return BRANDS.find((b) => b.domains.includes(registrable)) ?? null;
}

export type LookalikeKind = "typosquat" | "homoglyph" | "combosquat" | "subdomain";

export interface LookalikeMatch {
  brand: string;
  brand_name: string;
  distance: number;
  kind: LookalikeKind;
  matched: string;
}

/** Detects brand impersonation in the registrable domain and in subdomains. */
export function detectLookalike(hostname: string): LookalikeMatch | null {
  const parsed = parseDomain(hostname);
  if (parsed.isIp || !parsed.domain) return null;
  if (isAnyOfficialDomain(parsed.domain)) return null;

  const labelAscii = parsed.domainWithoutSuffix ?? "";
  const labelUnicode = domainToUnicode(labelAscii) || labelAscii;
  const tokens = tokensOf(labelUnicode);
  let best: LookalikeMatch | null = null;

  const consider = (match: LookalikeMatch) => {
    const rank = (m: LookalikeMatch) => ({ homoglyph: 0, typosquat: 1, combosquat: 2, subdomain: 3 })[m.kind];
    if (!best || rank(match) < rank(best) || (rank(match) === rank(best) && match.distance < best.distance)) best = match;
  };

  for (const brand of BRANDS) {
    if (isOfficialDomain(parsed.domain, brand)) continue;
    for (const brandToken of brand.tokens) {
      for (const token of tokens) {
        if (token === brandToken) {
          // Brand used verbatim in a non-official domain (google-login.xyz).
          const tokenIsWholeLabel = token === labelUnicode;
          consider({
            brand: brand.id,
            brand_name: brand.name,
            distance: 0,
            kind: tokenIsWholeLabel ? "typosquat" : "combosquat",
            matched: token,
          });
          continue;
        }
        const variants = homoglyphVariants(token);
        if (variants.includes(brandToken)) {
          consider({
            brand: brand.id,
            brand_name: brand.name,
            distance: Math.max(1, levenshtein(token, brandToken)),
            kind: "homoglyph",
            matched: token,
          });
          continue;
        }
        const limit = maxDistanceFor(brandToken);
        if (limit > 0 && Math.abs(token.length - brandToken.length) <= limit) {
          const distance = Math.min(...variants.map((v) => levenshtein(v, brandToken)), levenshtein(token, brandToken));
          if (distance >= 1 && distance <= limit) {
            consider({ brand: brand.id, brand_name: brand.name, distance, kind: "typosquat", matched: token });
          }
        }
        // Brand embedded inside a longer token, e.g. "paypalsecure".
        if (brandToken.length >= 5 && token.length > brandToken.length && variants.some((v) => v.includes(brandToken))) {
          consider({ brand: brand.id, brand_name: brand.name, distance: 0, kind: "combosquat", matched: token });
        }
      }
    }
  }
  if (best) return best;

  // Brand inside a subdomain of an unrelated domain (garanti.guvenli-giris.xyz).
  const subLabels = (parsed.subdomain ?? "").split(".").filter(Boolean);
  for (const sub of subLabels) {
    const subTokens = tokensOf(domainToUnicode(sub) || sub);
    for (const brand of BRANDS) {
      for (const brandToken of brand.tokens) {
        if (brandToken.length < 3) continue;
        for (const token of subTokens) {
          if (token === "www") continue;
          const variants = homoglyphVariants(token);
          if (token === brandToken || variants.includes(brandToken) || (brandToken.length >= 5 && variants.some((v) => v.includes(brandToken)))) {
            return { brand: brand.id, brand_name: brand.name, distance: levenshtein(token, brandToken), kind: "subdomain", matched: sub };
          }
        }
      }
    }
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/*                               Heuristics                                   */
/* -------------------------------------------------------------------------- */

export interface UrlChecks {
  lookalike: { brand: string; distance: number; kind: LookalikeKind } | null;
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
}

export interface UrlCheckData {
  url: string;
  domain: string;
  risk: RiskLevel;
  score: number;
  reasons: Reason[];
  checks: UrlChecks;
}

interface Finding {
  code: string;
  severity: Severity;
  weight: number;
  message: string;
}

/** Normalises user input into a URL. Accepts bare domains by assuming http. */
export function normalizeUrlInput(input: string): URL | null {
  const trimmed = input.trim();
  if (!trimmed || trimmed.length > 2048) return null;
  const candidates = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? [trimmed] : [`http://${trimmed}`];
  for (const c of candidates) {
    try {
      const url = new URL(c);
      if ((url.protocol === "http:" || url.protocol === "https:") && url.hostname) return url;
    } catch {
      // try next
    }
  }
  return null;
}

export interface HeuristicResult {
  url: URL;
  domain: string;
  registrable: string | null;
  findings: Finding[];
  checks: UrlChecks;
}

export function analyzeUrlHeuristics(rawUrl: string, locale: Locale): HeuristicResult | null {
  const url = normalizeUrlInput(rawUrl);
  if (!url) return null;
  const hostname = url.hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "").toLowerCase();
  const parsed = parseDomain(hostname);
  const registrable = parsed.domain;
  const domain = registrable ?? hostname;
  const findings: Finding[] = [];
  const add = (code: string, severity: Severity, weight: number, message: string) =>
    findings.push({ code, severity, weight, message });

  const ipHost = !!parsed.isIp;
  if (ipHost) {
    add("ip_host", "high", 25, t(locale, {
      tr: "Link bir domain yerine doğrudan IP adresi kullanıyor.",
      en: "The link uses a raw IP address instead of a domain name.",
    }));
  }

  const https = url.protocol === "https:";
  if (!https) {
    add("no_https", "low", 10, t(locale, {
      tr: "Bağlantı şifrelenmemiş (HTTP).",
      en: "The connection is not encrypted (HTTP).",
    }));
  }

  const lookalike = ipHost ? null : detectLookalike(hostname);
  if (lookalike) {
    const brand = lookalike.brand_name;
    if (lookalike.kind === "subdomain") {
      add("brand_in_subdomain", "high", 40, t(locale, {
        tr: `'${brand}' markası alakasız bir domainin alt alan adında kullanılıyor (${domain}).`,
        en: `The '${brand}' brand appears in a subdomain of an unrelated domain (${domain}).`,
      }));
    } else if (lookalike.kind === "combosquat") {
      add("brand_in_domain", "high", 35, t(locale, {
        tr: `Domain '${brand}' markasını içeriyor ancak markaya ait değil.`,
        en: `The domain contains the '${brand}' brand but is not owned by it.`,
      }));
    } else {
      add("lookalike_domain", "high", 50, t(locale, {
        tr: `Bu domain '${brand}' markasını taklit ediyor olabilir.`,
        en: `This domain may be impersonating '${brand}'.`,
      }));
    }
  }

  const punycode = hostname.split(".").some((l) => l.startsWith("xn--"));
  if (punycode) {
    add("punycode_domain", lookalike ? "high" : "medium", lookalike ? 15 : 10, t(locale, {
      tr: `Domain uluslararası karakterler içeriyor (${domainToUnicode(hostname)}); harf taklidi için sık kullanılır.`,
      en: `The domain contains international characters (${domainToUnicode(hostname)}), often used for letter spoofing.`,
    }));
  }

  const tld = parsed.publicSuffix ?? "";
  const lastLabel = tld.split(".").pop() ?? "";
  const suspiciousTld = SUSPICIOUS_TLDS.has(lastLabel);
  if (suspiciousTld) {
    add("suspicious_tld", "medium", 15, t(locale, {
      tr: `'.${lastLabel}' uzantısı oltalama kampanyalarında sık kullanılıyor.`,
      en: `The '.${lastLabel}' TLD is frequently used in phishing campaigns.`,
    }));
  }

  const shortened = URL_SHORTENERS.has(hostname) || (!!registrable && URL_SHORTENERS.has(registrable));
  if (shortened) {
    add("url_shortener", "medium", 15, t(locale, {
      tr: "Bu bir URL kısaltıcı. Gerçek hedef görünmüyor.",
      en: "This is a URL shortener. The real destination is hidden.",
    }));
  }

  if (url.username || url.password || rawUrl.includes("@")) {
    add("at_sign", "medium", 20, t(locale, {
      tr: "URL '@' işareti içeriyor; gerçek hedef gizlenmiş olabilir.",
      en: "The URL contains an '@' sign, which can hide the real destination.",
    }));
  }

  const subdomainCount = (parsed.subdomain ?? "").split(".").filter(Boolean).length;
  if (subdomainCount > 4) {
    add("many_subdomains", "low", 10, t(locale, {
      tr: `Çok fazla alt alan adı var (${subdomainCount}).`,
      en: `Too many subdomain levels (${subdomainCount}).`,
    }));
  }

  const length = url.toString().length;
  if (length >= 100) {
    add("long_url", "low", 5, t(locale, {
      tr: `URL alışılmadık derecede uzun (${length} karakter).`,
      en: `The URL is unusually long (${length} characters).`,
    }));
  }

  const redirectParam = [...url.searchParams.keys()].some((k) => REDIRECT_PARAMS.includes(k.toLowerCase()));
  if (redirectParam) {
    add("redirect_param", "low", 10, t(locale, {
      tr: "URL başka bir adrese yönlendirme parametresi içeriyor.",
      en: "The URL contains a redirect parameter pointing elsewhere.",
    }));
  }

  if (url.port && url.port !== "80" && url.port !== "443") {
    add("non_standard_port", "low", 10, t(locale, {
      tr: `Standart olmayan port kullanılıyor (${url.port}).`,
      en: `A non-standard port is used (${url.port}).`,
    }));
  }

  const official = isAnyOfficialDomain(registrable);
  const haystack = `${hostname}${url.pathname}`.toLowerCase();
  const keywords = official ? [] : SUSPICIOUS_KEYWORDS.filter((k) => haystack.includes(k));
  if (keywords.length > 0) {
    add("suspicious_keywords", "medium", Math.min(20, keywords.length * 10), t(locale, {
      tr: `Şüpheli kelimeler içeriyor: ${keywords.join(", ")}.`,
      en: `Contains suspicious keywords: ${keywords.join(", ")}.`,
    }));
  }

  return {
    url,
    domain,
    registrable,
    findings,
    checks: {
      lookalike: lookalike ? { brand: lookalike.brand, distance: lookalike.distance, kind: lookalike.kind } : null,
      domain_age_days: null,
      suspicious_tld: suspiciousTld,
      shortened,
      blacklisted: null,
      ip_host: ipHost,
      https,
      punycode,
      suspicious_keywords: keywords,
      redirect_param: redirectParam,
      subdomain_count: subdomainCount,
      length,
    },
  };
}

/* -------------------------------------------------------------------------- */
/*                        External reputation sources                         */
/* -------------------------------------------------------------------------- */

export type DomainAgeLookup = (domain: string) => Promise<{ registeredAt: Date | null }>;

export interface BlacklistSource {
  name: string;
  /** Returns true when listed, false when clean. Throws on upstream failure. */
  check: (url: string) => Promise<boolean>;
}

export interface UrlCheckDeps {
  domainAge?: DomainAgeLookup;
  blacklists?: BlacklistSource[];
  now?: Date;
}

const SEVERITY_ORDER: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };

export async function checkUrl(rawUrl: string, locale: Locale, deps: UrlCheckDeps = {}): Promise<CheckResult<UrlCheckData> | null> {
  const heuristics = analyzeUrlHeuristics(rawUrl, locale);
  if (!heuristics) return null;
  const { url, domain, registrable, findings, checks } = heuristics;
  const sources = ["heuristics"];
  let partial = false;

  const tasks: Promise<void>[] = [];

  if (deps.domainAge && registrable && !checks.ip_host) {
    const lookup = deps.domainAge;
    tasks.push(
      (async () => {
        try {
          const { registeredAt } = await lookup(registrable);
          sources.push("rdap");
          if (registeredAt) {
            const now = deps.now ?? new Date();
            const days = Math.max(0, Math.floor((now.getTime() - registeredAt.getTime()) / 86_400_000));
            checks.domain_age_days = days;
            if (days < 30) {
              findings.push({
                code: "new_domain",
                severity: "high",
                weight: days < 7 ? 35 : 30,
                message: t(locale, {
                  tr: `Domain ${days} gün önce kaydedilmiş.`,
                  en: `The domain was registered ${days} day${days === 1 ? "" : "s"} ago.`,
                }),
              });
            }
          }
        } catch {
          partial = true;
        }
      })(),
    );
  }

  const blacklistHits: string[] = [];
  let blacklistRan = false;
  for (const source of deps.blacklists ?? []) {
    tasks.push(
      (async () => {
        try {
          const listed = await source.check(url.toString());
          blacklistRan = true;
          sources.push(source.name);
          if (listed) blacklistHits.push(source.name);
        } catch {
          partial = true;
        }
      })(),
    );
  }

  await Promise.all(tasks);

  if (blacklistRan) {
    checks.blacklisted = blacklistHits.length > 0;
  }
  if (blacklistHits.length > 0) {
    findings.push({
      code: "blacklisted",
      severity: "critical",
      weight: 0,
      message: t(locale, {
        tr: `Bu link kara listede: ${blacklistHits.join(", ")}.`,
        en: `This link is blacklisted by: ${blacklistHits.join(", ")}.`,
      }),
    });
  }

  let score = clampScore(findings.reduce((sum, f) => sum + f.weight, 0));
  if (blacklistHits.length > 0) score = Math.max(score, 95 + Math.min(5, blacklistHits.length - 1));

  findings.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || b.weight - a.weight);

  return {
    data: {
      url: url.toString(),
      domain,
      risk: riskLevel(score),
      score,
      reasons: findings.map(({ code, severity, message }) => ({ code, severity, message })),
      checks,
    },
    sources,
    partial,
  };
}
