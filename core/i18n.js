// Translations. The English text is the key; each dictionary maps it to
// another language. Unknown keys fall back to the English text.
import DE from './i18n-de.js';

export const DICTIONARIES = { de: DE };
export const LANGUAGES = ['en', 'de'];

/** A tr(text, vars) function for `lang` that fills {placeholders} from `vars`. */
export function translator(lang) {
  const dict = DICTIONARIES[lang] || {};
  return (s, vars) => {
    let out = dict[s] !== undefined ? dict[s] : s;
    if (vars) out = out.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? vars[k] : m));
    return out;
  };
}

/** 'de' when the first preferred language is German, otherwise 'en'. */
export function pickLanguage(preferred = []) {
  const first = preferred.find(Boolean) || 'en';
  return /^de\b/i.test(first) ? 'de' : 'en';
}

/**
 * The locale for English dates and numbers: English words in the phone's region
 * (Laurin, 6 Nov 2026). "de-DE" → "en-DE" (Friday, 6 November · 19:15 · 1.630,5),
 * "en-GB" → "en-GB", "zh-Hans-CN" → "en-CN"; without a region, "en-US".
 */
export function englishFormatLocale(locale) {
  const all = String(locale || '').split(/[-_]/).slice(1);
  const end = all.findIndex((t) => t.length === 1); // extensions (-u-…, -x-…) come after the region
  const tags = end < 0 ? all : all.slice(0, end);
  const region = tags.find((t) => /^[A-Za-z]{2}$/.test(t) || /^\d{3}$/.test(t));
  return region ? `en-${region.toUpperCase()}` : 'en-US';
}
