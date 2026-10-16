# CyberQUA — Geliştiriciler İçin Güvenlik API Platformu

> **Güvenliği sen yazma, CyberQUA'ya sor.**

CyberQUA, güvenlik kontrollerini tek bir HTTP isteğiyle yapmanı sağlayan bir API platformudur: oltalama linkleri, sızmış şifreler (k-anonymity), güvenlik header denetimi, çöp e-postalar, IP itibarı ve koda gömülmüş API anahtarları.

```bash
curl -X POST "$SITE/api/v1/url/check" \
  -H "Authorization: Bearer $CYBERQUA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://g00gle-login.xyz/verify"}'
```

## İçindekiler

- [Teknoloji yığını](#teknoloji-yığını)
- [Klasör yapısı](#klasör-yapısı)
- [Kurulum](#kurulum)
  - [1. Clerk (giriş: e-posta, Google, GitHub, GitLab)](#1-clerk-giriş-e-posta-google-github-gitlab)
  - [2. Supabase projesi ve migration](#2-supabase-projesi-ve-migration)
  - [3. Sunucu veritabanı sırrı](#3-sunucu-veritabanı-sırrı)
  - [4. Yerel geliştirme](#4-yerel-geliştirme)
  - [5. Vercel'e deploy](#5-vercele-deploy)
  - [6. Opsiyonel anahtarlar](#6-opsiyonel-anahtarlar)
  - [7. SDK'yı npm'e yayınlama](#7-sdkyı-npme-yayınlama)
- [Güvenlik notları](#güvenlik-notları)
- [Testler](#testler)

## Teknoloji yığını

| Katman | Seçim |
|---|---|
| Framework | Next.js 16 (App Router, `proxy.ts`), TypeScript strict |
| Stil | Tailwind CSS 4 — e2b.dev esintili tasarım: koyu tema, mono etiketler, ince çizgili grid'ler, köşe işaretleri |
| Kimlik doğrulama | **Clerk** (e-posta/şifre + Google, GitHub, GitLab OAuth, e-posta doğrulaması) |
| Veritabanı | Supabase Postgres — veriler API'ye kapalı `cq_private` şemasında; sunucu sadece sırla korunan `cq_*` fonksiyonlarını çağırır |
| Rate limit / kota / önbellek | Postgres (`cq_private` şeması, sliding window) — ek servis gerekmez |
| Doğrulama | Zod 4 |
| Diğer | tldts, Recharts, undici (SSRF-güvenli istekler), Vitest |
| Deploy | Vercel — tüm API rotaları Node.js runtime'ında (`dns`, `tls` gerekiyor) |

> **Not:** Orijinal şartnamede Supabase Auth vardı; istek doğrultusunda giriş **Clerk** ile yapılıyor (Google / GitHub / GitLab). Supabase yalnızca Postgres olarak kullanılıyor ve kullanıcı kimlikleri Clerk `user_…` ID'leridir. RLS politikaları Clerk JWT'sinin `sub` claim'ine göre yazılmıştır (Supabase'de Clerk'i third-party auth olarak eklerseniz doğrudan çalışır); uygulama ise veritabanına sadece sunucudan erişir.

## Klasör yapısı

```
app/
  (marketing)/            ana sayfa, docs/, playground/, gizlilik/, kosullar/
  (auth)/                 login/, register/, forgot-password/ (Clerk bileşenleri)
  dashboard/              genel bakış, keys/, logs/, settings/
  api/v1/…                url/check, password/range, headers, email/check, ip/[ip], secrets/scan, health
  api/demo/url-check      ana sayfa canlı demosu (anahtarsız, IP başına saatte 10)
  api/internal/…          keys, playground, settings, account (Clerk oturumu + Origin/CSRF kontrolü)
lib/
  api/                    with-api-auth.ts, errors.ts, response.ts, endpoints.ts, keys.ts, body.ts, deps.ts
  checks/                 url.ts, headers.ts, email.ts, ip.ts, secrets.ts, password-range.ts (saf, test edilebilir)
                          *-sources.ts / headers-probe.ts (önbellek, DNS, TLS, dış servisler)
  security/               ssrf.ts, ip-ranges.ts
  data/                   brands.ts, disposable-domains.json, secret-rules.ts, email-lists.ts
  db.ts, cache.ts         cq_* RPC çağrıları (publishable key + CYBERQUA_DB_SECRET)
  clerk-session.ts        Clerk oturum token'ını JWKS ile doğrular (secret key gerekmez)
  i18n/                   tr.json, en.json
  ratelimit.ts
proxy.ts                  nonce tabanlı strict CSP
sdk/                      npm paketi "cyberqua"
supabase/migrations/      şema, RLS, pg_cron
scripts/update-disposable-domains.ts
tests/
```

## Kurulum

Gereksinimler: Node.js 20+ (geliştirme), npm.

```bash
git clone <repo> cyberqua && cd cyberqua
npm install
cp .env.example .env.local
```

### 1. Clerk (giriş: e-posta, Google, GitHub, GitLab)

1. [dashboard.clerk.com](https://dashboard.clerk.com) → **Create application**.
2. **User & Authentication → Email**: e-posta açık, **Verify at sign-up** zorunlu. *Password* açık.
3. **SSO connections** → **Google**, **GitHub** ve **GitLab**'ı etkinleştir. Geliştirme instance'ında Clerk'in paylaşılan OAuth bilgileri yeterlidir; production'da her sağlayıcı için kendi OAuth uygulamanı oluşturup Clerk'in verdiği redirect URI'ı gir.
4. `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` değerini ekle. **Secret key gerekmez:** sunucu, `__session` çerezindeki token'ı Clerk'in herkese açık JWKS anahtarlarıyla (`https://<frontend-api>/.well-known/jwks.json`) doğrular — imza (RS256), `iss`, `exp`/`nbf` ve `azp` kontrol edilir (`lib/clerk-session.ts`).

Şifre sıfırlama Clerk'in giriş akışındadır ("Şifremi unuttum"). Şifre değiştirme, bağlı hesaplar ve hesap silme `/dashboard/settings` içindedir.

### 2. Supabase ve migration

1. Bir Supabase projesi oluştur (başka bir uygulamayla paylaşılabilir — tüm tablolar ayrı `cq_private` şemasındadır ve Data API'ye kapalıdır).
2. `NEXT_PUBLIC_SUPABASE_URL` ve **publishable key** (`sb_publishable_…`) → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
3. `pg_cron`'u etkinleştir (90 günlük log temizliği, süresi dolan önbellek).
4. `supabase/migrations/20261016000000_init.sql` dosyasını SQL Editor'de çalıştır (veya `supabase db push`).

### 3. Sunucu veritabanı sırrı

```bash
SECRET=$(openssl rand -base64 48 | tr -d '\n/+=')
echo "CYBERQUA_DB_SECRET=$SECRET"            # → Vercel ortam değişkeni (Sensitive)
echo -n "$SECRET" | sha256sum               # → aşağıdaki SQL'e
```

```sql
insert into cq_private.config (key, value) values ('app_secret_sha256', '<sha256-hex>')
on conflict (key) do update set value = excluded.value;
```

`cq_*` fonksiyonları her çağrıda bu sırrı doğrular; publishable key tek başına hiçbir veriye erişemez.

### 4. Yerel geliştirme

```bash
npm run dev          # http://localhost:3000
npm test             # web uygulaması testleri
npm run typecheck
npm run update:disposable   # geçici e-posta listesini güncelle
```

### 5. Vercel'e deploy

1. Repoyu Vercel'e import et (Framework: Next.js).
2. **Settings → Environment Variables** bölümüne `.env.example`'daki değişkenleri ekle. Fonksiyon bölgesini Supabase'e yakın seç (ör. `fra1`). `NEXT_PUBLIC_SITE_URL` production domainin olmalı (ör. `https://cyberqua.dev`).
3. Deploy et. API rotaları `runtime = "nodejs"` ile Node.js'te çalışır; `/headers` için `maxDuration = 30`.
4. Clerk'te production instance oluştur, domaini doğrula ve production publishable key'ini Vercel'e gir.
5. Kontrol: `https://<site>/api/v1/health` → `{"status":"ok"}`. Kendi sitenizi `/api/v1/headers?url=https://<site>` ile denetleyin; HSTS preload, nonce tabanlı strict CSP ve diğer header'lar sayesinde **A+** almalı.

### 6. Opsiyonel anahtarlar

Anahtar tanımlı değilse ilgili kontrol atlanır, uygulama çökmez ve `meta.sources_used` hangi kaynakların çalıştığını gösterir.

| Değişken | Nereden | Kullanım |
|---|---|---|
| `ABUSEIPDB_API_KEY` | [abuseipdb.com](https://www.abuseipdb.com/account/api) → Account → API | `/ip` kötüye kullanım puanı ve ülke |
| `URLHAUS_AUTH_KEY` | [auth.abuse.ch](https://auth.abuse.ch/) → Auth-Key | `/url/check` kara liste |
| `GOOGLE_WEB_RISK_API_KEY` | Google Cloud Console → Web Risk API'yi etkinleştir → Credentials → API key | `/url/check` kara liste |
| `NEXT_PUBLIC_CONTACT_EMAIL` | — | KVKK başvuru adresi (gizlilik sayfası) |

Anahtarsız çalışan kaynaklar: RDAP (rdap.org), Have I Been Pwned range API, Tor Project exit listesi, DNS MX sorguları.

### 7. SDK'yı npm'e yayınlama

```bash
cd sdk
npm install
npm test
npm run build            # dist/esm + dist/cjs + .d.ts
npm login
npm publish --access public
```

Yayınlamadan önce `sdk/src/client.ts` içindeki `DEFAULT_BASE_URL`'i kendi domaininize ayarlayın ve `package.json`'daki `version`'ı artırın. Ayrıntılar: [`sdk/README.md`](sdk/README.md).

## Güvenlik notları

- **API anahtarları** kriptografik olarak rastgele (base62, rejection sampling). Veritabanında sadece SHA-256 hash ve ilk 12 karakter tutulur; tam anahtar bir kez gösterilir. İptal anında önbellekteki anahtar kaydı silinir.
- **Gizli anahtar + Origin header'ı** → `403 secret_key_in_browser`. Açık anahtarlar sadece izinli origin'lerden ve sadece `/url/check`, `/email/check`, `/password/range` için çalışır.
- **SSRF** (`/headers`): sadece http/https ve 80/443; çözülen IP'lerden herhangi biri özel/ayrılmışsa ret; alternatif IPv4 yazımları (2130706433, 0x7f000001, 0177.0.0.1); bağlantı undici `connect.lookup` ile doğrulanmış IP'ye sabitlenir (DNS rebinding yok); her yönlendirme (en fazla 3) yeniden doğrulanır; gövde okunmaz.
- **Gizlilik**: istek gövdeleri, IP'ler, sorgulanan değerler, şifre hash'leri ve kod içerikleri loglanmaz/saklanmaz. `/secrets/scan` içeriği sadece bellekte işlenir; bulgular maskelenir (ilk 4 + `****` + son 4).
- **Web**: nonce + `strict-dynamic` CSP, HSTS preload, `X-Frame-Options: DENY`, COOP, Permissions-Policy, `poweredByHeader: false`. Oturumlu iç rotalarda sunucuda Clerk doğrulaması ve Origin tabanlı CSRF kontrolü. `dangerouslySetInnerHTML`/`eval` kullanılmaz.
- Tüm girdiler Zod ile doğrulanır; gövde boyutu akış sırasında sınırlandırılır (`413 payload_too_large`).

## Testler

```bash
npm test               # 100+ test: url, ssrf, email, secrets, ip, headers, api auth
npm --prefix sdk test  # SDK: k-anonymity, retry, timeout, shield, şifre gücü
```

## Lisans

Apache-2.0
