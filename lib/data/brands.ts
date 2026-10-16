export interface Brand {
  /** Canonical identifier, reported as `checks.lookalike.brand`. */
  id: string;
  /** Human readable name. */
  name: string;
  /** Tokens that, when imitated, indicate brand impersonation. */
  tokens: string[];
  /** Official registrable domains. Exact matches and their subdomains are trusted. */
  domains: string[];
}

export const BRANDS: Brand[] = [
  { id: "google", name: "Google", tokens: ["google", "gmail"], domains: ["google.com", "google.com.tr", "gmail.com", "youtube.com", "googleapis.com", "gstatic.com", "goo.gl", "g.co"] },
  { id: "apple", name: "Apple", tokens: ["apple", "icloud"], domains: ["apple.com", "icloud.com", "apple.co"] },
  { id: "microsoft", name: "Microsoft", tokens: ["microsoft", "outlook", "office365", "hotmail"], domains: ["microsoft.com", "live.com", "outlook.com", "office.com", "office365.com", "hotmail.com", "microsoftonline.com", "msn.com"] },
  { id: "paypal", name: "PayPal", tokens: ["paypal"], domains: ["paypal.com", "paypal.me"] },
  { id: "instagram", name: "Instagram", tokens: ["instagram"], domains: ["instagram.com"] },
  { id: "facebook", name: "Facebook", tokens: ["facebook"], domains: ["facebook.com", "fb.com", "fb.me", "meta.com"] },
  { id: "whatsapp", name: "WhatsApp", tokens: ["whatsapp"], domains: ["whatsapp.com", "whatsapp.net", "wa.me"] },
  { id: "netflix", name: "Netflix", tokens: ["netflix"], domains: ["netflix.com"] },
  { id: "amazon", name: "Amazon", tokens: ["amazon"], domains: ["amazon.com", "amazon.com.tr", "amazon.de", "amazon.co.uk", "amazonaws.com", "a.co"] },
  { id: "steam", name: "Steam", tokens: ["steampowered", "steamcommunity"], domains: ["steampowered.com", "steamcommunity.com", "steamgames.com"] },
  { id: "discord", name: "Discord", tokens: ["discord"], domains: ["discord.com", "discord.gg", "discordapp.com", "discord.media"] },
  { id: "github", name: "GitHub", tokens: ["github"], domains: ["github.com", "github.io", "githubusercontent.com"] },
  { id: "binance", name: "Binance", tokens: ["binance"], domains: ["binance.com", "binance.tr"] },
  { id: "garantibbva", name: "Garanti BBVA", tokens: ["garantibbva", "garanti"], domains: ["garantibbva.com.tr", "garanti.com.tr"] },
  { id: "akbank", name: "Akbank", tokens: ["akbank"], domains: ["akbank.com", "akbank.com.tr"] },
  { id: "isbank", name: "İş Bankası", tokens: ["isbank", "isbankasi"], domains: ["isbank.com.tr"] },
  { id: "yapikredi", name: "Yapı Kredi", tokens: ["yapikredi"], domains: ["yapikredi.com.tr"] },
  { id: "ziraat", name: "Ziraat Bankası", tokens: ["ziraat", "ziraatbank"], domains: ["ziraatbank.com.tr", "ziraat.com.tr"] },
  { id: "halkbank", name: "Halkbank", tokens: ["halkbank"], domains: ["halkbank.com.tr"] },
  { id: "vakifbank", name: "VakıfBank", tokens: ["vakifbank"], domains: ["vakifbank.com.tr"] },
  { id: "qnb", name: "QNB", tokens: ["qnb", "qnbfinansbank", "finansbank"], domains: ["qnb.com.tr", "qnbfinansbank.com"] },
  { id: "enpara", name: "Enpara", tokens: ["enpara"], domains: ["enpara.com"] },
  { id: "papara", name: "Papara", tokens: ["papara"], domains: ["papara.com"] },
  { id: "edevlet", name: "e-Devlet", tokens: ["edevlet", "turkiyegov", "turkiyegovtr"], domains: ["turkiye.gov.tr"] },
  { id: "trendyol", name: "Trendyol", tokens: ["trendyol"], domains: ["trendyol.com"] },
  { id: "hepsiburada", name: "Hepsiburada", tokens: ["hepsiburada"], domains: ["hepsiburada.com"] },
  { id: "sahibinden", name: "Sahibinden", tokens: ["sahibinden"], domains: ["sahibinden.com"] },
  { id: "n11", name: "n11", tokens: ["n11"], domains: ["n11.com"] },
  { id: "getir", name: "Getir", tokens: ["getir"], domains: ["getir.com"] },
  { id: "yemeksepeti", name: "Yemeksepeti", tokens: ["yemeksepeti"], domains: ["yemeksepeti.com"] },
  { id: "ptt", name: "PTT", tokens: ["ptt", "pttavm", "pttkargo"], domains: ["ptt.gov.tr", "pttavm.com", "pttbank.gov.tr"] },
  { id: "turkcell", name: "Turkcell", tokens: ["turkcell"], domains: ["turkcell.com.tr"] },
  { id: "vodafone", name: "Vodafone", tokens: ["vodafone"], domains: ["vodafone.com.tr", "vodafone.com"] },
  { id: "turktelekom", name: "Türk Telekom", tokens: ["turktelekom"], domains: ["turktelekom.com.tr"] },
  { id: "migros", name: "Migros", tokens: ["migros"], domains: ["migros.com.tr"] },
];

export const URL_SHORTENERS = new Set([
  "bit.ly", "tinyurl.com", "t.co", "cutt.ly", "goo.gl", "ow.ly", "is.gd", "buff.ly", "rebrand.ly", "tiny.cc",
  "shorturl.at", "rb.gy", "t.ly", "bl.ink", "s.id", "v.gd", "lnkd.in", "trib.al", "shorte.st", "adf.ly",
  "bitly.com", "clck.ru", "qr.ae", "soo.gd", "u.to", "x.co", "tr.im", "short.io", "kutt.it", "bit.do",
]);

export const SUSPICIOUS_TLDS = new Set([
  "xyz", "top", "tk", "ml", "ga", "cf", "gq", "zip", "mov", "click", "country", "rest", "cam",
]);

export const SUSPICIOUS_KEYWORDS = [
  "login", "verify", "secure", "account", "update", "wallet",
  "giris", "dogrula", "guvenlik", "odeme", "kampanya", "hediye", "cekilis", "iade", "kargo",
];

export const REDIRECT_PARAMS = ["redirect", "redirect_uri", "redirect_url", "url", "next", "return", "returnurl", "return_to", "goto", "dest", "destination", "continue", "target"];
