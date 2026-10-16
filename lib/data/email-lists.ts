export const FREE_PROVIDERS = new Set([
  "gmail.com", "googlemail.com", "outlook.com", "outlook.com.tr", "hotmail.com", "hotmail.com.tr", "live.com", "msn.com",
  "yahoo.com", "yahoo.com.tr", "ymail.com", "rocketmail.com", "yandex.com", "yandex.com.tr", "yandex.ru", "ya.ru",
  "icloud.com", "me.com", "mac.com", "proton.me", "protonmail.com", "protonmail.ch", "pm.me", "aol.com", "gmx.com",
  "gmx.net", "gmx.de", "mail.com", "zoho.com", "mail.ru", "tutanota.com", "tuta.io",
]);

/** Domains we offer typo suggestions for. */
export const TYPO_TARGETS = [
  "gmail.com", "hotmail.com", "outlook.com", "yahoo.com", "yandex.com", "icloud.com", "proton.me", "protonmail.com",
  "live.com", "hotmail.com.tr", "outlook.com.tr", "yahoo.com.tr", "yandex.com.tr", "aol.com", "msn.com", "me.com",
];

export const ROLE_ACCOUNTS = new Set([
  "admin", "administrator", "info", "support", "help", "noreply", "no-reply", "donotreply", "do-not-reply", "contact",
  "sales", "marketing", "billing", "abuse", "postmaster", "hostmaster", "webmaster", "root", "security", "office",
  "hello", "team", "hr", "jobs", "careers", "press", "media", "legal", "privacy", "accounts", "accounting", "finance",
  "service", "services", "notifications", "newsletter", "mailer-daemon", "destek", "iletisim", "bilgi", "muhasebe",
  "satis", "yonetim", "kariyer",
]);

export const TLD_TYPOS: Record<string, string> = {
  con: "com", cmo: "com", ocm: "com", vom: "com", xom: "com", comm: "com", cpm: "com", co: "com", om: "com",
  nte: "net", ner: "net", met: "net", ogr: "org", rog: "org",
};
