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
  - [3. Upstash Redis](#3-upstash-redis)
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
| Veritabanı | Supabase Postgres (RLS açık, sadece sunucudan secret key ile erişim) |
| Rate limit / kota / önbellek | Upstash Redis + `@upstash/ratelimit` (sliding window) |
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
  api/webhooks/clerk      Clerk → profiles senkronizasyonu (Svix imzalı)
lib/
  api/                    with-api-auth.ts, errors.ts, response.ts, endpoints.ts, keys.ts, body.ts, deps.ts
  checks/                 url.ts, headers.ts, email.ts, ip.ts, secrets.ts, password-range.ts (saf, test edilebilir)
                          *-sources.ts / headers-probe.ts (Redis, DNS, TLS, dış servisler)
  security/               ssrf.ts, ip-ranges.ts
  data/                   brands.ts, disposable-domains.json, secret-rules.ts, email-lists.ts
  supabase/server.ts      sadece sunucu, secret key
  i18n/                   tr.json, en.json
  redis.ts, ratelimit.ts
proxy.ts                  Clerk + nonce tabanlı strict CSP
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
2. **User & Authentication → Email**: *Email address* açık, **Verify at sign-up** zorunlu (e-posta kodu veya link). *Password* açık.
3. **SSO connections** → **Google**, **GitHub** ve **GitLab**'ı ekle.
   - Geliştirme instance'ında Clerk'in paylaşılan OAuth bilgileri yeterlidir.
   - Production'da her sağlayıcı için kendi OAuth uygulamanı oluştur ve Clerk'in gösterdiği **Authorized redirect URI**'ı gir:
     - GitHub: *Settings → Developer settings → OAuth Apps → New OAuth App*
     - GitLab: *User Settings → Applications* (scope: `read_user`, `openid`, `email`)
     - Google: *Google Cloud Console → APIs & Services → Credentials → OAuth client ID (Web)*
   - Client ID / Secret değerlerini Clerk'teki ilgili bağlantıya yapıştır.
4. **API Keys** sayfasından `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` ve `CLERK_SECRET_KEY` değerlerini `.env.local`'a koy.
5. `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/login`, `NEXT_PUBLIC_CLERK_SIGN_UP_URL=/register`.
6. **Webhooks** → *Add endpoint* → `https://<site>/api/webhooks/clerk`, olaylar: `user.created`, `user.updated`, `user.deleted`. Signing secret'ı `CLERK_WEBHOOK_SIGNING_SECRET` olarak ekle. (Webhook olmasa da profil ilk panel girişinde otomatik oluşturulur.)

Şifre sıfırlama Clerk'in giriş akışında ("Şifremi unuttum") yapılır; `/forgot-password` sayfası bu akışa yönlendirir. Şifre değiştirme ve bağlı hesaplar `/dashboard/settings` içindeki Clerk profil bileşenindedir.

### 2. Supabase projesi ve migration

1. [supabase.com](https://supabase.com/dashboard) → **New project**.
2. **Project Settings → API**: Project URL → `NEXT_PUBLIC_SUPABASE_URL`; **Secret key** (`sb_secret_…`) → `SUPABASE_SECRET_KEY`. Bu anahtar sadece sunucuda kullanılır, asla `NEXT_PUBLIC_` ile başlamaz.
3. **Database → Extensions**: `pg_cron`'u etkinleştir (90 günlük log temizliği için).
4. Migration'ı çalıştır — ikisinden biri:
   - Supabase CLI: `supabase link --project-ref <ref> && supabase db push`
   - veya SQL Editor'e `supabase/migrations/20261016000000_init.sql` içeriğini yapıştırıp çalıştır.
5. (Opsiyonel, savunma derinliği) **Authentication → Third-party auth → Clerk** ekle. RLS politikaları `auth.jwt()->>'sub'` ile Clerk kullanıcısını eşler.

Migration şunları oluşturur: `profiles`, `api_keys` (sadece `key_hash` + `key_prefix`, kullanıcı başına 5 aktif anahtar trigger'ı), `usage_logs` (`(user_id, created_at)` index'i, gövde/IP/sorgu değeri yok), tüm tablolarda RLS, `key_hash`'i istemciye kapatan sütun yetkileri ve `api_keys_safe` view'ı, `usage_summary()` RPC'si ve pg_cron silme işi.

### 3. Upstash Redis

1. [console.upstash.com](https://console.upstash.com) → **Create database** (Vercel bölgenize yakın bir bölge seçin).
2. **REST API** bölümünden `UPSTASH_REDIS_REST_URL` ve `UPSTASH_REDIS_REST_TOKEN` değerlerini kopyala.

Redis şunlar için kullanılır: anahtar önbelleği (60 sn), dakikalık rate limit, `quota:{user_id}:{YYYY-MM}` sayaçları, RDAP/MX/header/AbuseIPDB/HIBP önbellekleri ve Tor çıkış listesi.

### 4. Yerel geliştirme

```bash
npm run dev          # http://localhost:3000
npm test             # web uygulaması testleri
npm run typecheck
npm run update:disposable   # geçici e-posta listesini güncelle
```

### 5. Vercel'e deploy

1. Repoyu Vercel'e import et (Framework: Next.js).
2. **Settings → Environment Variables** bölümüne `.env.example`'daki tüm değişkenleri ekle. `NEXT_PUBLIC_SITE_URL` production domainin olmalı (ör. `https://cyberqua.dev`).
3. Deploy et. API rotaları `runtime = "nodejs"` ile Node.js'te çalışır; `/headers` için `maxDuration = 30`.
4. Clerk'te production instance oluştur, domaini doğrula ve production anahtarlarını Vercel'e gir.
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

- **API anahtarları** kriptografik olarak rastgele (base62, rejection sampling). Veritabanında sadece SHA-256 hash ve ilk 12 karakter tutulur; tam anahtar bir kez gösterilir. İptal anında Redis önbelleği silinir.
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
