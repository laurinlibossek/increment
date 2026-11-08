// Public addresses the app links to. The contact email lives here and only
// here: building the website (scripts/web-site.mjs) writes it into the privacy
// pages, and refuses to run while it's a placeholder in square brackets.
export const WEB_APP_URL = 'https://increment-training.app/';
export const CONTACT_EMAIL = 'hello@increment-training.app';
export const SUPPORT_URL = 'https://github.com/laurinlibossek/increment/issues';

/** The privacy policy page for a language, relative to the web app: German for 'de', English otherwise. */
export const privacyPage = (lang) => (lang === 'de' ? 'datenschutz.html' : 'privacy.html');
