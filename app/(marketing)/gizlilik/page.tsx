import type { Metadata } from "next";
import { getI18n } from "@/lib/i18n/server";
import { LegalPage, type LegalSection } from "@/components/legal-page";

export const metadata: Metadata = { title: "Gizlilik / Privacy" };

function contact(locale: "tr" | "en") {
  const email = process.env.NEXT_PUBLIC_CONTACT_EMAIL;
  if (email) return email;
  return locale === "tr" ? "panelden ulaşabileceğiniz destek kanalı" : "the support channel available in the dashboard";
}

export default async function PrivacyPage() {
  const { locale } = await getI18n();
  const c = contact(locale);

  const tr: LegalSection[] = [
    {
      title: "1. Veri sorumlusu",
      paragraphs: [
        `6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") kapsamında kişisel verileriniz, veri sorumlusu sıfatıyla CyberQUA tarafından aşağıda açıklanan şekilde işlenir. Başvurularınız için: ${c}.`,
      ],
    },
    {
      title: "2. İşlenen kişisel veriler",
      items: [
        "Hesap verileri: e-posta adresi, ad-soyad (varsa), giriş yöntemi (e-posta, Google, GitHub, GitLab). Kimlik doğrulama Clerk altyapısı üzerinden yapılır.",
        "Profil verileri: görünen ad, plan, arayüz dili, kayıt tarihi.",
        "API anahtarı verileri: anahtarın adı, türü, SHA-256 hash'i, ilk 12 karakteri, izinli domainler, oluşturulma / son kullanım / iptal tarihleri. Anahtarın kendisi hiçbir zaman saklanmaz.",
        "Kullanım kayıtları: zaman, endpoint adı, HTTP durum kodu ve yanıt süresi. Bu kayıtlar 90 gün sonra otomatik olarak silinir.",
      ],
    },
    {
      title: "3. ASLA saklamadığımız veriler",
      items: [
        "Kontrol ettiğiniz linkler, e-posta adresleri ve IP adresleri.",
        "Şifreler ve şifre hash'leri (şifre kontrolünde sunucuya yalnızca SHA-1 hash'inin ilk 5 karakteri gelir).",
        "/secrets/scan ile gönderdiğiniz kod içerikleri — yalnızca bellekte işlenir; saklanmaz, loglanmaz, önbelleğe alınmaz.",
        "API isteklerinin gövdeleri ve istemci IP adresleri.",
      ],
      paragraphs: [
        "Performans için bazı sonuçlar kısa süreli önbelleğe alınır: domain kayıt tarihleri (24 saat), MX kayıtları (1 saat), header denetim sonuçları (10 dakika), AbuseIPDB sonuçları (6 saat) ve k-anonymity şifre aralıkları (24 saat). Bu önbellekler sizinle ilişkilendirilmez.",
      ],
    },
    {
      title: "4. İşleme amaçları ve hukuki sebepler",
      items: [
        "Hizmetin sunulması, hesabın yönetimi ve API kimlik doğrulaması (KVKK m.5/2-c: sözleşmenin ifası).",
        "Kota, hız sınırı ve kötüye kullanımın önlenmesi (KVKK m.5/2-f: meşru menfaat).",
        "Yasal yükümlülüklerin yerine getirilmesi (KVKK m.5/2-ç).",
      ],
    },
    {
      title: "5. Aktarım",
      paragraphs: [
        "Veriler yalnızca hizmetin sunulması için gerekli altyapı sağlayıcılarına aktarılır: Clerk (kimlik doğrulama), Supabase (veritabanı), Upstash (önbellek ve hız sınırı) ve Vercel (barındırma). Bu sağlayıcıların sunucuları yurt dışında bulunabilir; aktarım KVKK m.9 kapsamında açık rızanıza veya ilgili güvencelere dayanır.",
      ],
    },
    {
      title: "6. Saklama süresi",
      paragraphs: [
        "Hesap verileri hesabınız açık olduğu sürece saklanır. Panelde Ayarlar > Hesabı sil ile tüm anahtarlarınız, kullanım kayıtlarınız ve hesabınız kalıcı olarak silinir. Kullanım kayıtları her durumda 90 gün sonra otomatik silinir.",
      ],
    },
    {
      title: "7. Haklarınız (KVKK m.11)",
      items: [
        "Kişisel verilerinizin işlenip işlenmediğini öğrenme ve bilgi talep etme,",
        "İşleme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme,",
        "Aktarıldığı üçüncü kişileri bilme,",
        "Eksik veya yanlış işlenmişse düzeltilmesini, silinmesini veya yok edilmesini isteme,",
        "Otomatik sistemlerle analiz sonucu aleyhinize bir sonuca itiraz etme ve zararın giderilmesini talep etme.",
      ],
      paragraphs: [`Başvurularınızı ${c} üzerinden iletebilirsiniz.`],
    },
  ];

  const en: LegalSection[] = [
    { title: "1. Data controller", paragraphs: [`Under the Turkish Personal Data Protection Law No. 6698 ("KVKK"), CyberQUA processes your personal data as data controller as described below. Contact: ${c}.`] },
    {
      title: "2. Data we process",
      items: [
        "Account data: email address, name (if provided), sign-in method (email, Google, GitHub, GitLab). Authentication is provided by Clerk.",
        "Profile data: display name, plan, interface language, sign-up date.",
        "API key data: name, type, SHA-256 hash, first 12 characters, allowed origins, created / last used / revoked timestamps. The key itself is never stored.",
        "Usage logs: time, endpoint, HTTP status code and latency. Deleted automatically after 90 days.",
      ],
    },
    {
      title: "3. Data we NEVER store",
      items: [
        "Links, email addresses and IP addresses you check.",
        "Passwords and password hashes (only the first 5 characters of a SHA-1 hash reach our server).",
        "Code submitted to /secrets/scan — processed in memory only; never stored, logged or cached.",
        "API request bodies and client IP addresses.",
      ],
      paragraphs: [
        "Some results are cached briefly for performance: domain registration dates (24h), MX records (1h), header audits (10 min), AbuseIPDB results (6h) and k-anonymity password ranges (24h). These caches are not linked to you.",
      ],
    },
    {
      title: "4. Purposes and legal bases",
      items: [
        "Providing the service, managing your account and API authentication (performance of contract).",
        "Quotas, rate limits and abuse prevention (legitimate interest).",
        "Compliance with legal obligations.",
      ],
    },
    { title: "5. Transfers", paragraphs: ["Data is only shared with infrastructure providers required to run the service: Clerk (authentication), Supabase (database), Upstash (cache and rate limiting) and Vercel (hosting). Their servers may be located abroad."] },
    { title: "6. Retention", paragraphs: ["Account data is kept while your account exists. Settings > Delete account permanently deletes all keys, usage logs and the account. Usage logs are always deleted after 90 days."] },
    { title: "7. Your rights", paragraphs: [`You may request access, correction, deletion or objection regarding your data under KVKK Article 11 via ${c}.`] },
  ];

  return (
    <LegalPage
      eyebrow="KVKK"
      title={locale === "tr" ? "Gizlilik ve KVKK Aydınlatma Metni" : "Privacy Notice (KVKK)"}
      updated={locale === "tr" ? "Son güncelleme: 16 Ekim 2026" : "Last updated: October 16, 2026"}
      intro={
        locale === "tr"
          ? "CyberQUA bir güvenlik ürünüdür ve en az veriyle çalışacak şekilde tasarlanmıştır. Bu metin neyi tuttuğumuzu ve neyi asla tutmadığımızı açıkça anlatır."
          : "CyberQUA is a security product designed to work with as little data as possible. This notice explains what we keep and what we never keep."
      }
      sections={locale === "tr" ? tr : en}
    />
  );
}
