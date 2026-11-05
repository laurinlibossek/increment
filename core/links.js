// Public addresses the app links to. The contact email lives here and only
// here: the privacy pages read it from this file, and publishing them must stop
// while it's still the placeholder in square brackets, so it never goes live.
export const WEB_APP_URL = 'https://laurinlibossek.github.io/increment/';
export const CONTACT_EMAIL = '[EMAIL]';
export const SUPPORT_URL = 'https://github.com/laurinlibossek/increment/issues';

/** The privacy policy page for a language, relative to the web app: German for 'de', English otherwise. */
export const privacyPage = (lang) => (lang === 'de' ? 'datenschutz.html' : 'privacy.html');
