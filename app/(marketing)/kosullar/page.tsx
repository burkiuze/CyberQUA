import type { Metadata } from "next";
import { getI18n } from "@/lib/i18n/server";
import { LegalPage, type LegalSection } from "@/components/legal-page";

export const metadata: Metadata = { title: "Kullanım koşulları / Terms" };

export default async function TermsPage() {
  const { locale } = await getI18n();

  const tr: LegalSection[] = [
    { title: "1. Kapsam", paragraphs: ["Bu koşullar CyberQUA web sitesini, panelini, API'sini ve SDK'sını (birlikte \"Hizmet\") kullanımınızı düzenler. Hizmeti kullanarak bu koşulları kabul etmiş olursunuz."] },
    {
      title: "2. Kabul edilebilir kullanım",
      items: [
        "API'yi izinsiz üçüncü taraf sistemlere saldırı, zafiyet taraması, keşif veya tarama amacıyla kullanmak kesinlikle yasaktır.",
        "/headers endpoint'ini yalnızca sahibi olduğunuz veya denetleme izniniz bulunan siteler için kullanabilirsiniz.",
        "Hız sınırlarını, kotaları veya güvenlik önlemlerini aşmaya çalışmak, birden çok hesapla kota toplamak yasaktır.",
        "Hizmeti yasa dışı içerik, oltalama veya kötü amaçlı yazılım dağıtımı için kullanmak yasaktır.",
      ],
    },
    { title: "3. API anahtarları", paragraphs: ["Anahtarlarınızın güvenliğinden siz sorumlusunuz. Gizli anahtarları istemci tarafında kullanmayın. Sızdığından şüphelendiğiniz anahtarı derhal iptal edin. Anahtarınızla yapılan istekler sizin adınıza yapılmış sayılır."] },
    { title: "4. Planlar ve kotalar", paragraphs: ["Ücretsiz plan ayda 1.000 istek ve dakikada 30 istek (açık anahtarlarda 10) içerir. Pro plan şu anda kullanıma açık değildir. Limitler önceden bildirilerek değiştirilebilir."] },
    { title: "5. Sonuçların niteliği", paragraphs: ["Risk puanları sezgisel ve üçüncü taraf kaynaklara dayalı tahminlerdir; kesinlik garantisi verilmez. Kritik kararlarınızı tek başına CyberQUA sonuçlarına dayandırmayın. Hizmet \"olduğu gibi\" sunulur."] },
    { title: "6. Askıya alma", paragraphs: ["Bu koşulların ihlali halinde anahtarlarınız ve hesabınız bildirimde bulunulmaksızın askıya alınabilir veya kapatılabilir."] },
    { title: "7. Sorumluluğun sınırlandırılması", paragraphs: ["Yürürlükteki mevzuatın izin verdiği ölçüde CyberQUA, Hizmetin kullanımından doğan dolaylı zararlardan sorumlu değildir."] },
    { title: "8. Uygulanacak hukuk", paragraphs: ["Bu koşullar Türkiye Cumhuriyeti hukukuna tabidir."] },
  ];

  const en: LegalSection[] = [
    { title: "1. Scope", paragraphs: ["These terms govern your use of the CyberQUA website, dashboard, API and SDK (the \"Service\"). By using the Service you accept them."] },
    {
      title: "2. Acceptable use",
      items: [
        "Using the API to attack, vulnerability-scan, probe or crawl third-party systems without authorisation is strictly prohibited.",
        "Only use /headers on sites you own or are authorised to audit.",
        "Circumventing rate limits, quotas or security controls, or pooling quotas across accounts, is prohibited.",
        "Using the Service to distribute illegal content, phishing or malware is prohibited.",
      ],
    },
    { title: "3. API keys", paragraphs: ["You are responsible for keeping your keys safe. Never use secret keys client-side and revoke any key you suspect has leaked. Requests made with your key are deemed made by you."] },
    { title: "4. Plans and quotas", paragraphs: ["The Free plan includes 1,000 requests per month and 30 requests per minute (10 for publishable keys). The Pro plan is not yet available. Limits may change with notice."] },
    { title: "5. Nature of results", paragraphs: ["Risk scores are heuristic estimates based on third-party sources and are not guaranteed to be accurate. Do not base critical decisions solely on CyberQUA results. The Service is provided \"as is\"."] },
    { title: "6. Suspension", paragraphs: ["Keys and accounts may be suspended or terminated without notice for violations of these terms."] },
    { title: "7. Limitation of liability", paragraphs: ["To the extent permitted by law, CyberQUA is not liable for indirect damages arising from use of the Service."] },
    { title: "8. Governing law", paragraphs: ["These terms are governed by the laws of the Republic of Türkiye."] },
  ];

  return (
    <LegalPage
      eyebrow={locale === "tr" ? "Koşullar" : "Terms"}
      title={locale === "tr" ? "Kullanım Koşulları" : "Terms of Use"}
      updated={locale === "tr" ? "Son güncelleme: 16 Ekim 2026" : "Last updated: October 16, 2026"}
      intro={locale === "tr" ? "CyberQUA'yı kullanmadan önce lütfen bu koşulları okuyun." : "Please read these terms before using CyberQUA."}
      sections={locale === "tr" ? tr : en}
    />
  );
}
