import type { Locale } from "@/lib/i18n/locale";

export type Bi = Record<Locale, string>;

export type DocBlock =
  | { t: "h2"; text: Bi }
  | { t: "p"; text: Bi }
  | { t: "ul"; items: Bi[] }
  | { t: "code"; code: string; title?: string }
  | { t: "table"; head: Bi[]; rows: Array<Array<string | Bi>> }
  | { t: "snippets"; endpoint: string }
  | { t: "callout"; text: Bi; tone?: "info" | "warn" };

export interface DocPage {
  slug: string;
  group: "guide" | "endpoint";
  method?: "GET" | "POST";
  path?: string;
  title: Bi;
  summary: Bi;
  blocks: DocBlock[];
}

const bi = (tr: string, en: string): Bi => ({ tr, en });

const PARAM_HEAD = [bi("Alan", "Field"), bi("Tür", "Type"), bi("Zorunlu", "Required"), bi("Açıklama", "Description")];
const YES = bi("Evet", "Yes");
const NO = bi("Hayır", "No");

export const DOC_PAGES: DocPage[] = [
  {
    slug: "getting-started",
    group: "guide",
    title: bi("Başlangıç", "Getting started"),
    summary: bi("CyberQUA'ya ilk isteğini 2 dakikada at.", "Send your first CyberQUA request in 2 minutes."),
    blocks: [
      { t: "p", text: bi(
        "CyberQUA, güvenlik kontrollerini tek bir HTTP isteğiyle yapmanı sağlayan bir REST API'dir. Tüm istekler `https://<site>/api/v1` altına gider ve JSON döner.",
        "CyberQUA is a REST API that lets you run security checks with a single HTTP request. Every request goes to `https://<site>/api/v1` and returns JSON.",
      ) },
      { t: "h2", text: bi("1. Hesap oluştur", "1. Create an account") },
      { t: "p", text: bi("E-posta, Google, GitHub veya GitLab ile kayıt ol. E-posta doğrulaması zorunludur.", "Sign up with email, Google, GitHub or GitLab. Email verification is required.") },
      { t: "h2", text: bi("2. API anahtarı al", "2. Get an API key") },
      { t: "p", text: bi(
        "Panelde Anahtarlar sayfasından bir gizli anahtar (`cq_live_…`) oluştur. Anahtar sadece bir kez gösterilir; hemen bir ortam değişkenine kaydet.",
        "Create a secret key (`cq_live_…`) on the Keys page of the dashboard. It is shown only once; store it in an environment variable right away.",
      ) },
      { t: "code", title: ".env", code: "CYBERQUA_API_KEY=cq_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" },
      { t: "h2", text: bi("3. İlk isteği at", "3. Send your first request") },
      { t: "snippets", endpoint: "url-check" },
      { t: "h2", text: bi("Yanıt formatı", "Response format") },
      { t: "code", title: "200 OK", code: `{
  "success": true,
  "data": { "...": "..." },
  "meta": {
    "request_id": "req_8f2K1xQ9wLmZ3vB7nT4a",
    "latency_ms": 38,
    "sources_used": ["heuristics", "rdap"],
    "partial": false
  }
}` },
      { t: "p", text: bi(
        "`meta.sources_used` hangi kontrollerin çalıştığını gösterir. Bir dış servis yanıt vermezse endpoint çökmez; o kontrol atlanır ve `meta.partial` `true` olur.",
        "`meta.sources_used` lists which checks ran. If an upstream service fails the endpoint does not crash; that check is skipped and `meta.partial` becomes `true`.",
      ) },
    ],
  },
  {
    slug: "authentication",
    group: "guide",
    title: bi("Kimlik doğrulama", "Authentication"),
    summary: bi("Bearer token ile kimlik doğrulama.", "Bearer token authentication."),
    blocks: [
      { t: "p", text: bi("Her isteğe `Authorization` header'ı ekle:", "Add the `Authorization` header to every request:") },
      { t: "code", code: "Authorization: Bearer cq_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" },
      { t: "ul", items: [
        bi("Anahtar formatı: `^cq_(live|pub)_[A-Za-z0-9]{32}$`.", "Key format: `^cq_(live|pub)_[A-Za-z0-9]{32}$`."),
        bi("Anahtarın kendisi hiçbir zaman saklanmaz; sadece SHA-256 hash'i ve ilk 12 karakteri tutulur.", "The key itself is never stored; only its SHA-256 hash and first 12 characters are kept."),
        bi("İptal edilen anahtarlar anında `401 revoked_api_key` döner.", "Revoked keys immediately return `401 revoked_api_key`."),
        bi("Hata mesajları `Accept-Language` header'ına göre Türkçe (varsayılan) veya İngilizce döner.", "Error messages follow the `Accept-Language` header: Turkish (default) or English."),
      ] },
      { t: "callout", tone: "warn", text: bi(
        "Gizli anahtarları asla istemci koduna, mobil uygulamaya veya git deposuna koyma. Sızdıysa panelden hemen iptal et.",
        "Never put secret keys in client code, mobile apps or git repositories. If one leaks, revoke it from the dashboard immediately.",
      ) },
    ],
  },
  {
    slug: "key-types",
    group: "guide",
    title: bi("Anahtar türleri", "Key types"),
    summary: bi("Gizli ve açık anahtarların farkı.", "Secret vs publishable keys."),
    blocks: [
      { t: "table", head: [bi("Özellik", "Property"), bi("Gizli (cq_live_)", "Secret (cq_live_)"), bi("Açık (cq_pub_)", "Publishable (cq_pub_)")], rows: [
        [bi("Nerede", "Where"), bi("Sadece sunucu", "Server only"), bi("Tarayıcı", "Browser")],
        [bi("CORS", "CORS"), bi("Kapalı. Origin header'ı varsa 403 secret_key_in_browser", "Disabled. Any Origin header → 403 secret_key_in_browser"), bi("Sadece izinli domainler", "Allowed origins only")],
        [bi("Endpoint'ler", "Endpoints"), bi("Hepsi", "All"), "/url/check, /email/check, /password/range"],
        [bi("Rate limit (Ücretsiz)", "Rate limit (Free)"), bi("30 / dk", "30 / min"), bi("10 / dk", "10 / min")],
      ] },
      { t: "p", text: bi(
        "Açık anahtar oluştururken izinli origin'leri tanımla: `https://example.com` veya alt alan adları için `https://*.example.com`. Origin header'ı listede olmayan istekler `403 origin_not_allowed` alır.",
        "When creating a publishable key, define allowed origins: `https://example.com`, or `https://*.example.com` for subdomains. Requests whose Origin is not listed get `403 origin_not_allowed`.",
      ) },
      { t: "p", text: bi("Kullanıcı başına en fazla 5 aktif anahtar olabilir.", "Each user can have at most 5 active keys.") },
    ],
  },
  {
    slug: "rate-limits",
    group: "guide",
    title: bi("Rate limit ve kota", "Rate limits & quota"),
    summary: bi("Dakikalık limit ve aylık kota.", "Per-minute limits and monthly quota."),
    blocks: [
      { t: "table", head: [bi("Plan", "Plan"), bi("Aylık kota", "Monthly quota"), bi("Gizli anahtar", "Secret key"), bi("Açık anahtar", "Publishable key")], rows: [
        [bi("Ücretsiz", "Free"), "1.000", bi("30 / dk", "30 / min"), bi("10 / dk", "10 / min")],
        [bi("Pro (yakında)", "Pro (soon)"), "50.000", bi("300 / dk", "300 / min"), bi("100 / dk", "100 / min")],
      ] },
      { t: "p", text: bi("Rate limit anahtar başına kayan pencere (sliding window) ile uygulanır. Her yanıtta şu header'lar bulunur:", "Rate limits are applied per key with a sliding window. Every response includes:") },
      { t: "code", code: "X-Request-Id: req_…\nX-RateLimit-Limit: 30\nX-RateLimit-Remaining: 29\nX-RateLimit-Reset: 1760600000" },
      { t: "p", text: bi(
        "Limit aşıldığında `429 rate_limited` ve `Retry-After` (saniye) döner. Aylık kota dolduğunda `429 quota_exceeded` döner; kota her ayın başında (UTC) sıfırlanır.",
        "When exceeded you get `429 rate_limited` with `Retry-After` (seconds). When the monthly quota is used up you get `429 quota_exceeded`; quotas reset at the start of each month (UTC).",
      ) },
    ],
  },
  {
    slug: "errors",
    group: "guide",
    title: bi("Hata kodları", "Error codes"),
    summary: bi("Tüm hata kodları ve anlamları.", "All error codes and their meaning."),
    blocks: [
      { t: "code", title: "4xx / 5xx", code: `{
  "success": false,
  "error": { "code": "rate_limited", "message": "Dakikalık istek sınırı aşıldı…" },
  "meta": { "request_id": "req_…" }
}` },
      { t: "table", head: [bi("Kod", "Code"), bi("HTTP", "HTTP"), bi("Açıklama", "Description")], rows: [
        ["missing_api_key", "401", bi("Authorization header'ı yok.", "Authorization header missing.")],
        ["invalid_api_key", "401", bi("Format hatalı veya anahtar bulunamadı.", "Malformed or unknown key.")],
        ["revoked_api_key", "401", bi("Anahtar iptal edilmiş.", "Key was revoked.")],
        ["secret_key_in_browser", "403", bi("Gizli anahtar Origin header'ı ile kullanıldı.", "Secret key used with an Origin header.")],
        ["origin_not_allowed", "403", bi("Origin, açık anahtarın listesinde değil.", "Origin not allowed for this publishable key.")],
        ["endpoint_not_allowed", "403", bi("Açık anahtar bu endpoint'e erişemez.", "Publishable key cannot call this endpoint.")],
        ["invalid_request", "400", bi("Girdi doğrulaması başarısız. `error.details` hatalı alanları listeler.", "Validation failed. `error.details` lists the invalid fields.")],
        ["payload_too_large", "413", bi("Gövde boyut sınırı aşıldı.", "Body size limit exceeded.")],
        ["rate_limited", "429", bi("Dakikalık limit aşıldı.", "Per-minute limit exceeded.")],
        ["quota_exceeded", "429", bi("Aylık kota doldu.", "Monthly quota exhausted.")],
        ["upstream_unavailable", "503", bi("Gerekli dış servis yanıt vermedi.", "A required upstream did not respond.")],
        ["internal_error", "500", bi("Beklenmeyen hata.", "Unexpected error.")],
      ] },
    ],
  },
  {
    slug: "sdk",
    group: "guide",
    title: bi("SDK", "SDK"),
    summary: bi("Resmi TypeScript SDK'sı: cyberqua.", "Official TypeScript SDK: cyberqua."),
    blocks: [
      { t: "code", title: "npm", code: "npm install cyberqua" },
      { t: "p", text: bi("Sıfır bağımlılık; Node 18+ ve tarayıcıda çalışır (fetch + Web Crypto). ESM ve CJS çıktısı vardır.", "Zero dependencies; runs on Node 18+ and in browsers (fetch + Web Crypto). Ships ESM and CJS.") },
      { t: "code", title: "TypeScript", code: `import { CyberQUA, CyberQUAError } from "cyberqua";

const cq = new CyberQUA({ apiKey: process.env.CYBERQUA_API_KEY, timeout: 10_000 });

await cq.url.check("https://g00gle-login.xyz");
await cq.password.check("Galatasaray1905"); // { score, leaked, leak_count, tips }
await cq.headers.check("https://example.com");
await cq.email.check("ali@tempmail.com");
await cq.ip.check("185.220.101.1");
await cq.secrets.scan(sourceCode, { filename: "config.js" });

try {
  await cq.url.check("not a url");
} catch (err) {
  if (err instanceof CyberQUAError) console.log(err.code, err.status, err.message);
}` },
      { t: "h2", text: bi("Yeniden deneme", "Retries") },
      { t: "p", text: bi("429 ve 503 yanıtlarında `Retry-After` header'ına uyarak en fazla 2 kez otomatik yeniden dener.", "On 429 and 503 it retries up to 2 times, honouring `Retry-After`.") },
      { t: "h2", text: bi("cq.shield() — yerel güvenlik header'ları", "cq.shield() — local security headers") },
      { t: "p", text: bi("API'ye istek atmadan Express ve Next.js için güvenlik header'larını ekleyen yerel bir middleware.", "A local middleware that adds security headers for Express and Next.js without calling the API.") },
      { t: "code", title: "Express", code: `import express from "express";
import { shield } from "cyberqua";

const app = express();
app.use(shield.express());` },
      { t: "code", title: "Next.js — next.config.js", code: `const { shield } = require("cyberqua");

module.exports = {
  async headers() {
    return [{ source: "/(.*)", headers: shield.nextHeaders() }];
  },
};` },
    ],
  },
  {
    slug: "url-check",
    group: "endpoint",
    method: "POST",
    path: "/url/check",
    title: bi("Link risk analizi", "Link risk analysis"),
    summary: bi("Bir linkin oltalama olma riskini puanlar.", "Scores how likely a link is phishing."),
    blocks: [
      { t: "callout", text: bi(
        "Bu endpoint verilen URL'ye asla istek atmaz ve sayfayı açmaz. Sadece URL'nin kendisi ve dış itibar kaynakları (RDAP, URLhaus, Google Web Risk) analiz edilir.",
        "This endpoint never requests or opens the given URL. Only the URL itself and external reputation sources (RDAP, URLhaus, Google Web Risk) are analysed.",
      ) },
      { t: "h2", text: bi("Parametreler", "Parameters") },
      { t: "table", head: PARAM_HEAD, rows: [["url", "string", YES, bi("Kontrol edilecek link (en fazla 2048 karakter). Şema yoksa http:// varsayılır.", "Link to check (max 2048 chars). http:// is assumed when no scheme is given.")]] },
      { t: "h2", text: bi("Kontroller", "Checks") },
      { t: "ul", items: [
        bi("Taklit domain: Levenshtein 1-2, homoglyph (0→o, 1→l, rn→m, vv→w, Kiril harfleri, punycode) ve marka içeren alt alan adları.", "Lookalikes: Levenshtein 1-2, homoglyphs (0→o, 1→l, rn→m, vv→w, Cyrillic, punycode) and brand names in subdomains."),
        bi("Şüpheli kelimeler, riskli TLD'ler, URL kısaltıcılar, @ işareti, 4'ten fazla alt alan adı, 100+ karakter, yönlendirme parametreleri.", "Suspicious keywords, risky TLDs, URL shorteners, @ signs, >4 subdomains, 100+ chars, redirect parameters."),
        bi("Domain yaşı (RDAP, 24 saat önbellek): 30 günden yeni domainler riskli.", "Domain age (RDAP, cached 24h): domains younger than 30 days are risky."),
        bi("Kara liste: URLhaus ve Google Web Risk (anahtar tanımlıysa). Kara listede olmak puanı 95+ yapar.", "Blacklists: URLhaus and Google Web Risk (when configured). Being listed forces a 95+ score."),
      ] },
      { t: "table", head: [bi("Seviye", "Level"), bi("Puan", "Score")], rows: [["safe", "0-19"], ["low", "20-39"], ["medium", "40-59"], ["high", "60-79"], ["critical", "80-100"]] },
      { t: "h2", text: bi("Örnek", "Example") },
      { t: "snippets", endpoint: "url-check" },
      { t: "code", title: "200 OK", code: `{
  "success": true,
  "data": {
    "url": "https://g00gle-login.xyz/verify",
    "domain": "g00gle-login.xyz",
    "risk": "critical",
    "score": 91,
    "reasons": [
      { "code": "lookalike_domain", "severity": "high", "message": "Bu domain 'Google' markasını taklit ediyor olabilir." },
      { "code": "new_domain", "severity": "high", "message": "Domain 4 gün önce kaydedilmiş." },
      { "code": "suspicious_tld", "severity": "medium", "message": "'.xyz' uzantısı oltalama kampanyalarında sık kullanılıyor." }
    ],
    "checks": {
      "lookalike": { "brand": "google", "distance": 2, "kind": "homoglyph" },
      "domain_age_days": 4,
      "suspicious_tld": true,
      "shortened": false,
      "blacklisted": null
    }
  },
  "meta": { "request_id": "req_…", "latency_ms": 212, "sources_used": ["heuristics", "rdap"], "partial": false }
}` },
    ],
  },
  {
    slug: "password-range",
    group: "endpoint",
    method: "POST",
    path: "/password/range",
    title: bi("Şifre sızıntısı (k-anonymity)", "Password leaks (k-anonymity)"),
    summary: bi("Şifreyi göndermeden sızıntı kontrolü.", "Leak checks without sending the password."),
    blocks: [
      { t: "callout", tone: "warn", text: bi(
        "Bu endpoint şifreyi veya tam hash'i ASLA almaz. Sadece SHA-1 hash'inin ilk 5 karakterini gönderirsin.",
        "This endpoint NEVER receives the password or its full hash. You only send the first 5 characters of the SHA-1 hash.",
      ) },
      { t: "h2", text: bi("Neden karşılaştırma istemcide yapılıyor?", "Why is the comparison done client-side?") },
      { t: "p", text: bi(
        "k-anonymity modelinde sunucu, aynı 5 karakterle başlayan yüzlerce hash'in listesini döner. Hangisinin senin şifren olduğunu sadece sen bilirsin. Karşılaştırmayı ve şifre gücü hesabını cihazda yapmak, şifrenin ya da tam hash'in CyberQUA dahil hiçbir sunucuya ulaşmamasını garanti eder. Yanıtlar ayrıca `Add-Padding` ile doldurulur; böylece yanıt boyutundan bile bilgi sızmaz.",
        "In the k-anonymity model the server returns hundreds of hashes sharing the same 5-character prefix. Only you know which one is yours. Doing the comparison and strength estimation on-device guarantees the password or its full hash never reaches any server, including CyberQUA. Responses are also padded (`Add-Padding`) so not even the response size leaks information.",
      ) },
      { t: "h2", text: bi("Parametreler", "Parameters") },
      { t: "table", head: PARAM_HEAD, rows: [["sha1_prefix", "string", YES, bi("SHA-1 hash'inin ilk 5 hex karakteri (büyük harf).", "First 5 hex characters of the SHA-1 hash (uppercase).")]] },
      { t: "h2", text: bi("Örnek", "Example") },
      { t: "snippets", endpoint: "password-range" },
      { t: "code", title: "200 OK", code: `{
  "success": true,
  "data": {
    "prefix": "21BD1",
    "suffixes": [
      { "suffix": "0018A45C4D1DEF81644B54AB7F969B88D65", "count": 3 }
    ]
  },
  "meta": { "request_id": "req_…", "latency_ms": 41, "sources_used": ["pwnedpasswords"], "partial": false }
}` },
      { t: "p", text: bi("Sonuç 24 saat önbelleklenir. SDK'daki `cq.password.check()` tüm akışı senin için yapar.", "Results are cached for 24 hours. `cq.password.check()` in the SDK does the whole flow for you.") },
    ],
  },
  {
    slug: "headers",
    group: "endpoint",
    method: "GET",
    path: "/headers?url=…",
    title: bi("Güvenlik header denetimi", "Security header audit"),
    summary: bi("Bir sitenin güvenlik header'larını A+–F notlar.", "Grades a site's security headers A+–F."),
    blocks: [
      { t: "p", text: bi("Sadece gizli anahtarlarla kullanılabilir. Sonuç URL başına 10 dakika önbelleklenir.", "Secret keys only. Results are cached per URL for 10 minutes.") },
      { t: "h2", text: bi("SSRF koruması", "SSRF protection") },
      { t: "ul", items: [
        bi("Sadece http/https ve 80/443 portları.", "Only http/https and ports 80/443."),
        bi("Çözülen IP'lerden herhangi biri özel/ayrılmış aralıktaysa (127/8, 10/8, 172.16/12, 192.168/16, 169.254/16, 100.64/10, 0/8, 224/4, ::1, fc00::/7, fe80::/10, IPv4-mapped IPv6) istek reddedilir.", "If any resolved IP is private/reserved (127/8, 10/8, 172.16/12, 192.168/16, 169.254/16, 100.64/10, 0/8, 224/4, ::1, fc00::/7, fe80::/10, IPv4-mapped IPv6) the request is rejected."),
        bi("Bağlantı doğrulanmış IP'ye sabitlenir (DNS rebinding imkansız). 2130706433, 0x7f000001, 0177.0.0.1 gibi alternatif yazımlar yakalanır.", "The connection is pinned to the validated IP (no DNS rebinding). Alternative notations like 2130706433, 0x7f000001, 0177.0.0.1 are caught."),
        bi("En fazla 3 yönlendirme; her hedef aynı kontrollerden geçer. 5 sn timeout. Yanıt gövdesi okunmaz.", "At most 3 redirects, each re-validated. 5 s timeout. The response body is never read."),
      ] },
      { t: "h2", text: bi("Puanlama", "Scoring") },
      { t: "table", head: [bi("Kontrol", "Check"), bi("Puan", "Points")], rows: [
        ["Strict-Transport-Security (max-age ≥ 31536000, includeSubDomains, preload)", "20"],
        [bi("Content-Security-Policy (unsafe-inline, unsafe-eval, * zayıflıkları)", "Content-Security-Policy (unsafe-inline, unsafe-eval, * weaknesses)"), "25"],
        [bi("Clickjacking (X-Frame-Options / frame-ancestors)", "Clickjacking (X-Frame-Options / frame-ancestors)"), "10"],
        ["X-Content-Type-Options: nosniff", "10"],
        ["Referrer-Policy / Permissions-Policy / Cross-Origin-Opener-Policy", "5 / 5 / 5"],
        [bi("Bilgi sızıntısı (Server sürümü, X-Powered-By)", "Information leak (Server version, X-Powered-By)"), "5"],
        [bi("Çerezler (Secure, HttpOnly, SameSite)", "Cookies (Secure, HttpOnly, SameSite)"), "5"],
        [bi("HTTP → HTTPS yönlendirme", "HTTP → HTTPS redirect"), "5"],
        [bi("TLS sertifikası (14 günden az kaldıysa uyarı)", "TLS certificate (warning under 14 days)"), "5"],
      ] },
      { t: "p", text: bi("Not: A+ (95+ ve kritik bulgu yok), A (85+), B (70+), C (55+), D (40+), F. `fixes` alanı eksik header'lar için vercel.json, Netlify _headers, next.config.js, Express ve Nginx yapılandırmaları içerir.", "Grade: A+ (95+ and no critical issue), A (85+), B (70+), C (55+), D (40+), F. The `fixes` field contains vercel.json, Netlify _headers, next.config.js, Express and Nginx configs for missing headers.") },
      { t: "h2", text: bi("Örnek", "Example") },
      { t: "snippets", endpoint: "headers" },
      { t: "code", title: "200 OK", code: `{
  "success": true,
  "data": {
    "url": "https://example.com/",
    "final_url": "https://example.com/",
    "status": 200,
    "grade": "C",
    "score": 58,
    "checks": { "hsts": { "present": true, "max_age": 31536000, "include_subdomains": false, "preload": false }, "...": "..." },
    "issues": [ { "header": "Content-Security-Policy", "severity": "high", "message": "…" } ],
    "fixes": { "missing": ["Content-Security-Policy"], "vercel_json": "…", "netlify_headers": "…", "next_config": "…", "express": "…", "nginx": "…" }
  },
  "meta": { "request_id": "req_…", "latency_ms": 640, "sources_used": ["http_headers", "tls"], "partial": false }
}` },
    ],
  },
  {
    slug: "email-check",
    group: "endpoint",
    method: "POST",
    path: "/email/check",
    title: bi("E-posta doğrulama", "Email validation"),
    summary: bi("Geçici e-posta, MX ve yazım hatası kontrolü.", "Disposable, MX and typo checks."),
    blocks: [
      { t: "h2", text: bi("Parametreler", "Parameters") },
      { t: "table", head: PARAM_HEAD, rows: [["email", "string", YES, bi("Kontrol edilecek adres.", "Address to check.")]] },
      { t: "ul", items: [
        bi("Söz dizimi, geçici e-posta domaini (açık kaynak disposable-email-domains listesi), MX kaydı (1 saat önbellek).", "Syntax, disposable domain (open source disposable-email-domains list), MX record (cached 1h)."),
        bi("Rol adresi (admin, info, support, noreply…), ücretsiz sağlayıcı (gmail, outlook, yandex, proton…).", "Role address (admin, info, support, noreply…), free provider (gmail, outlook, yandex, proton…)."),
        bi("Yazım hatası önerisi: gmial.com → gmail.com.", "Typo suggestion: gmial.com → gmail.com."),
      ] },
      { t: "snippets", endpoint: "email-check" },
      { t: "code", title: "200 OK", code: `{
  "success": true,
  "data": {
    "email": "ali@gmial.com",
    "valid_syntax": true,
    "disposable": false,
    "has_mx": false,
    "role_based": false,
    "free_provider": false,
    "did_you_mean": "ali@gmail.com",
    "risk": "high",
    "score": 75
  },
  "meta": { "request_id": "req_…", "latency_ms": 22, "sources_used": ["syntax", "disposable_list", "mx"], "partial": false }
}` },
    ],
  },
  {
    slug: "ip",
    group: "endpoint",
    method: "GET",
    path: "/ip/{ip}",
    title: bi("IP itibarı", "IP reputation"),
    summary: bi("Tor çıkışı, özel aralık ve kötüye kullanım puanı.", "Tor exits, private ranges and abuse score."),
    blocks: [
      { t: "p", text: bi("Sadece gizli anahtarlarla kullanılabilir.", "Secret keys only.") },
      { t: "table", head: PARAM_HEAD, rows: [["ip", "path", YES, bi("IPv4 veya IPv6 adresi.", "IPv4 or IPv6 address.")]] },
      { t: "ul", items: [
        bi("Özel/ayrılmış aralık tespiti.", "Private/reserved range detection."),
        bi("Tor çıkış düğümü: Tor Project torbulkexitlist, saatte bir yenilenir.", "Tor exit node: Tor Project torbulkexitlist, refreshed hourly."),
        bi("AbuseIPDB puanı ve ülke (anahtar tanımlıysa, 6 saat önbellek).", "AbuseIPDB score and country (when configured, cached 6h)."),
      ] },
      { t: "snippets", endpoint: "ip" },
      { t: "code", title: "200 OK", code: `{
  "success": true,
  "data": {
    "ip": "185.220.101.1",
    "version": 4,
    "is_private": false,
    "is_tor_exit": true,
    "abuse_score": 100,
    "country": "DE",
    "risk": "critical",
    "score": 100
  },
  "meta": { "request_id": "req_…", "latency_ms": 54, "sources_used": ["ip_ranges", "tor_exit_list", "abuseipdb"], "partial": false }
}` },
    ],
  },
  {
    slug: "secrets-scan",
    group: "endpoint",
    method: "POST",
    path: "/secrets/scan",
    title: bi("Sızmış anahtar tarama", "Leaked key scanning"),
    summary: bi("Kodda sızmış API anahtarlarını bulur.", "Finds leaked API keys in code."),
    blocks: [
      { t: "callout", tone: "warn", text: bi(
        "Gizlilik: `content` hiçbir yerde saklanmaz, loglanmaz veya önbelleğe alınmaz; sadece bellekte işlenir. Tam değerler asla döndürülmez.",
        "Privacy: `content` is never stored, logged or cached; it is processed in memory only. Full values are never returned.",
      ) },
      { t: "table", head: PARAM_HEAD, rows: [
        ["content", "string", YES, bi("Taranacak metin, en fazla 100 KB (aşılırsa 413).", "Text to scan, max 100 KB (413 if exceeded).")],
        ["filename", "string", NO, bi("Bilgi amaçlı dosya adı.", "Informational file name.")],
      ] },
      { t: "p", text: bi(
        "Kurallar: OpenRouter, OpenAI, Anthropic, Google API key, GitHub, AWS, Stripe, Supabase service_role JWT ve secret key, Slack, Telegram, Discord, özel anahtarlar ve key/secret/token/password değişkenlerine atanmış yüksek entropili (Shannon > 4.0, 20+ karakter) değerler.",
        "Rules: OpenRouter, OpenAI, Anthropic, Google API key, GitHub, AWS, Stripe, Supabase service_role JWT and secret key, Slack, Telegram, Discord, private keys and high-entropy values (Shannon > 4.0, 20+ chars) assigned to key/secret/token/password variables.",
      ) },
      { t: "snippets", endpoint: "secrets-scan" },
      { t: "code", title: "200 OK", code: `{
  "success": true,
  "data": {
    "filename": "config.js",
    "scanned_bytes": 412,
    "findings": [
      {
        "rule_id": "aws-access-key-id",
        "name": "AWS Access Key ID",
        "line": 3,
        "column": 15,
        "severity": "critical",
        "masked": "AKIA****MPLE",
        "remediation": "Bu anahtarı AWS panelinden hemen iptal edip yenisini oluşturun…"
      }
    ],
    "summary": { "total": 1, "critical": 1, "high": 0, "medium": 0, "low": 0, "info": 0 }
  },
  "meta": { "request_id": "req_…", "latency_ms": 3, "sources_used": ["secret_rules"], "partial": false }
}` },
    ],
  },
];

export function getDocPage(slug: string): DocPage | undefined {
  return DOC_PAGES.find((p) => p.slug === slug);
}
