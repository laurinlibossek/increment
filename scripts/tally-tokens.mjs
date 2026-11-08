// Writes app/src/design/tally.ts from docs/design/tokens.json, the Tally design
// tokens (colours per theme, spacing, radii, stroke and control sizes, type), and
// web/css/tally.css, the same tokens for the website's own pages (the privacy
// pages). tokens.json is the source: run `npm run tally` after changing it (the
// tests fail until you do).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const TOKENS_FILE = path.join(root, 'docs/design/tokens.json');
export const OUT_FILE = path.join(root, 'app/src/design/tally.ts');
export const CSS_FILE = path.join(root, 'web/css/tally.css');

const camel = (name) => name.replace(/-(\w)/g, (_, c) => c.toUpperCase());
const px = (v) => (typeof v === 'number' ? v : Number(String(v).replace(/px$/, '')));

function luminance(hex) {
  const n = hex.replace('#', '');
  const ch = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255)
    .map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

/** The tokens as plain data: { themes, space, radius, stroke, control, type }. */
export function tallyFromTokens(tokens) {
  const ids = tokens.color.themes.map((t) => t.id);
  const raw = Object.fromEntries(tokens.color.tokens.map((t) => [t.name, t.value]));
  const value = (name, theme) => {
    const v = raw[name];
    const s = typeof v === 'string' ? v : (v[theme] ?? v[ids[0]]);
    return s.startsWith('{') ? value(s.slice(1, -1), theme) : s;
  };
  const themes = {};
  for (const id of ids) {
    const colors = {};
    for (const name of Object.keys(raw)) colors[camel(name)] = value(name, id);
    themes[id] = { scheme: luminance(colors.paper) < 0.5 ? 'dark' : 'light', colors };
  }
  // space-5 -> s5, radius-capsule -> capsule, stroke-h-hero -> hHero, hit-min -> hitMin
  const short = (name) => camel(name.replace(/^space-/, 's').replace(/^(radius|stroke)-/, ''));
  const family = (key) => Object.fromEntries(tokens[key].tokens.map((t) => [short(t.name), px(t.value)]));
  const type = {};
  for (const g of tokens.type.groups) {
    for (const s of g.styles) {
      const size = px(s.fontSize);
      const style = { fontSize: size, lineHeight: px(s.lineHeight), fontWeight: String(s.fontWeight) };
      if (s.letterSpacing) style.letterSpacing = Math.round(parseFloat(s.letterSpacing) * size * 100) / 100;
      type[camel(s.name.replace(/^t-/, ''))] = style;
    }
  }
  return { themes, space: family('spacing'), radius: family('radius'), stroke: family('stroke'), control: family('control'), type };
}

const json = (v) => JSON.stringify(v, null, 2).replace(/"([A-Za-z_][\w]*)":/g, '$1:').replace(/"/g, "'");

/** The TypeScript module for the app. */
export function render(t) {
  const ids = Object.keys(t.themes);
  const colorKeys = Object.keys(t.themes[ids[0]].colors);
  return `// The Tally design tokens for the app, generated from docs/design/tokens.json
// by scripts/tally-tokens.mjs. Don't edit by hand: change tokens.json, then run
// \`npm run tally\`. Names are the token names in camelCase (paper-2 -> paper2).

export const TALLY_THEME_IDS = ${json(ids)} as const;
export type TallyThemeId = (typeof TALLY_THEME_IDS)[number];
export type TallyColors = { ${colorKeys.map((k) => `${k}: string`).join('; ')} };
export type TallyTheme = { scheme: 'light' | 'dark'; colors: TallyColors };

export const TALLY_THEMES: Record<TallyThemeId, TallyTheme> = ${json(t.themes)};

export const SPACE = ${json(t.space)} as const;
export const RADIUS = ${json(t.radius)} as const;
export const STROKE = ${json(t.stroke)} as const;
export const CONTROL = ${json(t.control)} as const;

type Weight = '400' | '500' | '600' | '700';
export const TYPE: Record<string, { fontSize: number; lineHeight: number; fontWeight: Weight; letterSpacing?: number }> = ${json(t.type)};
`;
}

/** The stylesheet for the website's pages: light and dark follow the device; named themes stay in the app. */
export function renderCss(tokens) {
  const t = tallyFromTokens(tokens);
  const names = tokens.color.tokens.map((c) => c.name);
  const colors = (theme) => names.map((n) => `  --${n}: ${t.themes[theme].colors[camel(n)]};`).join('\n');
  const sizes = (key) => tokens[key].tokens.map((s) => `  --${s.name}: ${s.value};`).join('\n');
  const families = Object.entries(tokens.type.families).map(([k, v]) => `  --font-${k}: ${v};`).join('\n');
  const styles = tokens.type.groups.flatMap((g) => g.styles.map((s) => `.${s.name} { font: ${s.fontWeight} ${s.fontSize}/${s.lineHeight} var(--font-${g.family || 'sans'});${s.letterSpacing ? ` letter-spacing: ${s.letterSpacing};` : ''} }`));
  return `/* The Tally design tokens for the website's own pages (the privacy pages),
   generated from docs/design/tokens.json by scripts/tally-tokens.mjs. Don't edit
   by hand: change tokens.json, then run \`npm run tally\`. Light and dark follow
   the device. */
:root {
  color-scheme: light dark;
${colors('light')}
${families}
${sizes('spacing')}
${sizes('radius')}
${sizes('control')}
}
@media (prefers-color-scheme: dark) {
  :root {
${colors('dark').replace(/^/gm, '  ')}
  }
}
${styles.join('\n')}
`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const tokens = JSON.parse(fs.readFileSync(TOKENS_FILE, 'utf8'));
  for (const [file, out] of [[OUT_FILE, render(tallyFromTokens(tokens))], [CSS_FILE, renderCss(tokens)]]) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, out);
    console.log(`wrote ${path.relative(root, file)}`);
  }
}
