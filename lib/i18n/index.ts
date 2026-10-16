import tr from "@/lib/i18n/tr.json";
import en from "@/lib/i18n/en.json";
import type { Locale } from "@/lib/i18n/locale";

export type Dictionary = typeof tr;

const DICTIONARIES: Record<Locale, Dictionary> = { tr, en };

export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale];
}
