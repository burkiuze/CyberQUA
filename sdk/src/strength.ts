import type { Locale } from "./types.js";

/** Common Turkish and global password fragments (normalised, lowercase ASCII). */
const DICTIONARY = [
  // Football clubs and founding years
  "galatasaray", "fenerbahce", "besiktas", "trabzonspor", "cimbom", "fener", "gs", "fb", "bjk", "ts",
  "1905", "1907", "1903", "1967",
  // Password words
  "sifre", "parola", "password", "passw0rd", "pass", "sifrem", "parolam", "giris", "admin", "root", "login",
  "sevgilim", "askim", "canim", "hayatim", "bebegim", "ataturk", "turkiye", "allah",
  // Common Turkish first names
  "ahmet", "mehmet", "mustafa", "ali", "ayse", "fatma", "emine", "hatice", "zeynep", "elif", "yusuf", "can",
  "deniz", "burak", "emre", "murat", "huseyin", "hasan", "ibrahim", "ismail", "omer", "osman", "ramazan",
  "merve", "busra", "esra", "kubra", "ozge", "selin", "ece", "irem", "yasemin", "berk", "kerem", "baris",
  "cem", "eren", "furkan", "hakan", "kaan", "mert", "onur", "serkan", "tolga", "ugur", "volkan", "yigit",
  "gizem", "ebru", "derya", "sibel", "melek", "sultan", "kemal", "selim", "efe", "arda", "ayaz", "miray",
  // Cities
  "istanbul", "ankara", "izmir", "bursa", "antalya", "adana", "konya", "trabzon", "samsun", "eskisehir",
  "gaziantep", "kayseri", "mersin", "diyarbakir", "erzurum", "malatya", "sakarya", "kocaeli", "denizli",
  "manisa", "hatay", "sivas", "van", "rize", "ordu", "mugla", "aydin", "tekirdag", "edirne", "canakkale",
  // Global
  "123456", "12345678", "123456789", "qwerty", "qwertyuiop", "asdfgh", "zxcvbn", "111111", "000000",
  "abc123", "iloveyou", "dragon", "monkey", "letmein", "welcome", "football", "superman", "batman",
];

const KEYBOARD_ROWS = ["qwertyuiopgu", "asdfghjklsi", "zxcvbnmoc", "1234567890", "qwertzuiop", "azertyuiop"];

const TURKISH_MAP: Record<string, string> = { ç: "c", ğ: "g", ı: "i", İ: "i", ö: "o", ş: "s", ü: "u" };
const LEET_MAP: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", $: "s", "!": "i" };

function normalise(password: string, leet: boolean): string {
  let out = "";
  for (const ch of password.toLocaleLowerCase("tr")) {
    const t = TURKISH_MAP[ch] ?? ch;
    out += leet ? (LEET_MAP[t] ?? t) : t;
  }
  return out;
}

function poolSize(password: string): number {
  let pool = 0;
  if (/[a-zçğıöşü]/.test(password)) pool += 26;
  if (/[A-ZÇĞİÖŞÜ]/.test(password)) pool += 26;
  if (/[0-9]/.test(password)) pool += 10;
  if (/[^a-zA-Z0-9çğıöşüÇĞİÖŞÜ]/.test(password)) pool += 33;
  return Math.max(pool, 10);
}

function hasSequence(lower: string, minLen = 4): boolean {
  for (let i = 0; i + minLen <= lower.length; i++) {
    let asc = true;
    let desc = true;
    for (let j = 1; j < minLen; j++) {
      const diff = lower.charCodeAt(i + j) - lower.charCodeAt(i + j - 1);
      if (diff !== 1) asc = false;
      if (diff !== -1) desc = false;
    }
    if (asc || desc) return true;
  }
  return false;
}

function keyboardRun(lower: string, minLen = 4): boolean {
  for (const row of KEYBOARD_ROWS) {
    for (let i = 0; i + minLen <= row.length; i++) {
      const chunk = row.slice(i, i + minLen);
      if (lower.includes(chunk) || lower.includes([...chunk].reverse().join(""))) return true;
    }
  }
  return false;
}

export interface StrengthResult {
  score: 0 | 1 | 2 | 3 | 4;
  tips: string[];
}

const TIPS = {
  length: { tr: "En az 12 karakter kullan; uzunluk en etkili korumadır.", en: "Use at least 12 characters; length is the strongest protection." },
  variety: { tr: "Büyük-küçük harf, rakam ve sembolleri karıştır.", en: "Mix upper and lower case letters, digits and symbols." },
  dictionary: {
    tr: "Takım adı, kuruluş yılı, isim, şehir veya 'şifre' gibi tahmin edilebilir kelimelerden kaçın.",
    en: "Avoid guessable words such as team names, founding years, names, cities or 'password'.",
  },
  keyboard: { tr: "qwerty, 123456 gibi klavye dizilerinden kaçın.", en: "Avoid keyboard patterns like qwerty or 123456." },
  repeat: { tr: "Aynı karakteri art arda tekrarlama (aaa, 111).", en: "Don't repeat the same character (aaa, 111)." },
  year: { tr: "Doğum veya kuruluş yılı eklemek şifreyi güçlendirmez.", en: "Appending a birth or founding year doesn't make a password stronger." },
  leet: { tr: "0→o, 1→i gibi harf değişiklikleri saldırganlar tarafından bilinir.", en: "Letter swaps like 0→o or 1→i are well known to attackers." },
  passphrase: { tr: "Birbiriyle ilgisiz 4-5 kelimeden oluşan bir parola cümlesi dene.", en: "Try a passphrase of 4-5 unrelated words." },
  leaked: {
    tr: "Bu şifre veri sızıntılarında görülmüş. Hiçbir yerde kullanma ve kullandığın her yerde değiştir.",
    en: "This password has appeared in data breaches. Don't use it anywhere and change it wherever you did.",
  },
  manager: { tr: "Her site için farklı şifre üretmek üzere bir şifre yöneticisi kullan.", en: "Use a password manager to generate a unique password for every site." },
} satisfies Record<string, Record<Locale, string>>;

/** Estimates password strength entirely on-device. */
export function estimateStrength(password: string, locale: Locale = "tr", leaked = false): StrengthResult {
  const tips = new Set<string>();
  const plain = normalise(password, false);
  const leet = normalise(password, true);

  let effectiveLength = [...password].length;
  let penaltyBits = 0;

  const dictionaryHits = DICTIONARY.filter((w) => w.length >= 3 && (plain.includes(w) || leet.includes(w)));
  if (dictionaryHits.length > 0) {
    const covered = Math.min(effectiveLength, dictionaryHits.reduce((s, w) => s + w.length, 0));
    effectiveLength -= covered;
    penaltyBits += 4 * dictionaryHits.length;
    tips.add(TIPS.dictionary[locale]);
    if (leet !== plain && DICTIONARY.some((w) => leet.includes(w) && !plain.includes(w))) tips.add(TIPS.leet[locale]);
  }
  if (/(19[0-9]{2}|20[0-9]{2})/.test(plain)) {
    penaltyBits += 6;
    tips.add(TIPS.year[locale]);
  }
  if (keyboardRun(plain) || hasSequence(plain)) {
    penaltyBits += 10;
    tips.add(TIPS.keyboard[locale]);
  }
  if (/(.)\1{2,}/.test(plain)) {
    penaltyBits += 8;
    tips.add(TIPS.repeat[locale]);
  }

  const classes = [/[a-zçğıöşü]/, /[A-ZÇĞİÖŞÜ]/, /[0-9]/, /[^a-zA-Z0-9çğıöşüÇĞİÖŞÜ]/].filter((re) => re.test(password)).length;
  if (classes < 3) tips.add(TIPS.variety[locale]);
  if ([...password].length < 12) tips.add(TIPS.length[locale]);

  const bits = Math.max(0, Math.max(effectiveLength, 1) * Math.log2(poolSize(password)) + (dictionaryHits.length > 0 ? 10 : 0) - penaltyBits);

  let score: StrengthResult["score"];
  if (bits < 28) score = 0;
  else if (bits < 40) score = 1;
  else if (bits < 60) score = 2;
  else if (bits < 80) score = 3;
  else score = 4;

  if ([...password].length < 8) score = 0;
  if (leaked) {
    score = 0;
    tips.add(TIPS.leaked[locale]);
  }
  if (score <= 2) tips.add(TIPS.passphrase[locale]);
  if (tips.size === 0) tips.add(TIPS.manager[locale]);

  return { score, tips: [...tips] };
}
