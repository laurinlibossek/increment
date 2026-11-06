// Ship in English for now; keep German maintained for its return.
// Texts remain English keys translated by core/i18n-de.js.
import { useMemo } from 'react';
import { translator, pickLanguage, configureUnits } from '@increment/core';

import { useSettings } from '@/data/store';

export type Tr = (text: string, vars?: Record<string, string | number>) => string;

// One switch restores German, the Account language choices and device defaults.
export const ENABLE_GERMAN = false;

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

/** English launch formats; with German enabled, use the existing device defaults. */
export function localeFor(lang: 'en' | 'de'): string {
  if (!ENABLE_GERMAN) return 'en-US';
  const phone = phoneLocale();
  if (lang === 'de') return /^de\b/i.test(phone) ? phone : 'de-DE';
  return /^de\b/i.test(phone) ? 'en-US' : phone;
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
