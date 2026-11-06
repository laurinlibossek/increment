// Ship in English for now; keep German maintained for its return.
// Texts remain English keys translated by core/i18n-de.js.
import { useMemo } from 'react';
import { translator, pickLanguage, configureUnits, englishFormatLocale } from '@increment/core';

import { useSettings } from '@/data/store';

export type Tr = (text: string, vars?: Record<string, string | number>) => string;

// German returns with EXPO_PUBLIC_ENABLE_GERMAN=1 at build time: the language follows the
// setting or the phone again, and Account shows its Language choice. Builds without it
// (the store and web apps) are English. The browser tests build both; no file is edited.
export const ENABLE_GERMAN = process.env.EXPO_PUBLIC_ENABLE_GERMAN === '1';

export function phoneLocale(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale || 'en-US';
  } catch {
    return 'en-US';
  }
}

export function resolveLanguage(setting: unknown): 'en' | 'de' {
  if (!ENABLE_GERMAN) return 'en';
  return setting === 'en' || setting === 'de' ? setting : pickLanguage([phoneLocale()]);
}

/** Locale for dates and numbers: German formats in German; in English, English words in the phone's region (en-DE: 6 November, 19:15, 62,5). */
export function localeFor(lang: 'en' | 'de'): string {
  const phone = phoneLocale();
  if (lang === 'de') return /^de\b/i.test(phone) ? phone : 'de-DE';
  return englishFormatLocale(phone);
}

export function useLang() {
  const settings = useSettings();
  const lang = resolveLanguage(settings.language);
  return useMemo(() => {
    const locale = localeFor(lang);
    let decimal = '.';
    try {
      decimal = new Intl.NumberFormat(locale).formatToParts(1.5).find((p) => p.type === 'decimal')?.value || '.';
    } catch {
      // keep "."
    }
    configureUnits({ decimal });
    return { lang, locale, tr: translator(lang) as Tr };
  }, [lang]);
}
