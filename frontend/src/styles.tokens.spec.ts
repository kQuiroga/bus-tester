import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

/**
 * Extracts the raw declaration body of the first top-level block whose
 * selector/at-rule text matches `selector` (brace-depth aware, so nested
 * at-rules like `@keyframes` inside `@theme` don't confuse extraction).
 */
function extractBlock(css: string, selector: string): string {
  const startIdx = css.indexOf(selector);
  if (startIdx === -1) throw new Error(`selector "${selector}" not found in styles.css`);
  const braceStart = css.indexOf('{', startIdx);
  let depth = 0;
  let i = braceStart;
  for (; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}') {
      depth--;
      if (depth === 0) break;
    }
  }
  return css.slice(braceStart + 1, i);
}

/** Pulls every `--custom-property: value;` declaration out of a block body. */
function extractDecls(blockContent: string): string {
  const matches = blockContent.match(/--[\w-]+\s*:\s*[^;]+;/g) ?? [];
  return matches.join('\n');
}

/** Reads the real, on-disk styles.css (not a copy) as plain text. */
function loadStylesCss(): string {
  const dir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(dir, 'styles.css'), 'utf-8');
}

/**
 * jsdom cannot parse Tailwind v4's `@theme`/`@custom-variant` at-rules, so we
 * re-host the plain `--color-*` custom-property declarations found inside
 * `@theme { ... }` and `.dark { ... }` under vanilla `:root {}` / `.dark {}`
 * rules that jsdom's CSSOM understands, then let the real DOM cascade
 * resolve them via getComputedStyle.
 */
function injectTokenStyles(css: string): void {
  const themeDecls = extractDecls(extractBlock(css, '@theme'));
  const darkDecls = extractDecls(extractBlock(css, '.dark {'));
  const style = document.createElement('style');
  style.textContent = `:root {\n${themeDecls}\n}\n.dark {\n${darkDecls}\n}`;
  document.head.appendChild(style);
}

/** jsdom's CSS serializer sometimes drops a space after a percentage sign; ignore all whitespace differences. */
function normalize(value: string): string {
  return value.replace(/\s+/g, '');
}

function resolveToken(name: string, mode: 'light' | 'dark'): string {
  if (mode === 'dark') document.documentElement.classList.add('dark');
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (mode === 'dark') document.documentElement.classList.remove('dark');
  return value;
}

describe('styles.css design tokens', () => {
  beforeEach(() => {
    injectTokenStyles(loadStylesCss());
  });

  afterEach(() => {
    document.head.querySelectorAll('style').forEach((el) => el.remove());
    document.documentElement.classList.remove('dark');
  });

  const cases: Array<{ token: string; light: string; dark: string }> = [
    { token: '--color-muted', light: 'oklch(94% 0.01 264.665)', dark: 'oklch(30% 0.03 264.665)' },
    {
      token: '--color-muted-foreground',
      light: 'oklch(46% 0.02 264.665)',
      dark: 'oklch(65% 0.02 264.665)',
    },
    { token: '--color-accent', light: 'oklch(94% 0.02 262.9)', dark: 'oklch(30% 0.04 259.8)' },
    {
      token: '--color-accent-foreground',
      light: 'oklch(21% 0.034 264.665)',
      dark: 'oklch(96% 0.005 264.53)',
    },
    {
      token: '--color-destructive',
      light: 'oklch(54.6% 0.215 25.7)',
      dark: 'oklch(62% 0.19 24.5)',
    },
    {
      token: '--color-destructive-foreground',
      light: 'oklch(98% 0.003 247.86)',
      dark: 'oklch(98% 0.003 247.86)',
    },
    {
      token: '--color-secondary',
      light: 'oklch(94% 0.01 264.665)',
      dark: 'oklch(30% 0.03 264.665)',
    },
    {
      token: '--color-secondary-foreground',
      light: 'oklch(21% 0.034 264.665)',
      dark: 'oklch(96% 0.005 264.53)',
    },
    { token: '--color-input', light: 'oklch(90% 0.013 255.5)', dark: 'oklch(35% 0.03 264.665)' },
    { token: '--color-popover', light: 'oklch(100% 0 0)', dark: 'oklch(25.5% 0.037 264.665)' },
    {
      token: '--color-popover-foreground',
      light: 'oklch(21% 0.034 264.665)',
      dark: 'oklch(96% 0.005 264.53)',
    },
  ];

  it.each(cases)('resolves $token in light mode', ({ token, light }) => {
    expect(normalize(resolveToken(token, 'light'))).toBe(normalize(light));
  });

  it.each(cases)('resolves $token in dark mode', ({ token, dark }) => {
    expect(normalize(resolveToken(token, 'dark'))).toBe(normalize(dark));
  });

  it('aliases --color-input to the same value as --color-border in both modes', () => {
    expect(normalize(resolveToken('--color-input', 'light'))).toBe(
      normalize(resolveToken('--color-border', 'light')),
    );
    expect(normalize(resolveToken('--color-input', 'dark'))).toBe(
      normalize(resolveToken('--color-border', 'dark')),
    );
  });

  it('aliases --color-popover(-foreground) to the same value as --color-card(-foreground) in both modes', () => {
    expect(normalize(resolveToken('--color-popover', 'light'))).toBe(
      normalize(resolveToken('--color-card', 'light')),
    );
    expect(normalize(resolveToken('--color-popover-foreground', 'light'))).toBe(
      normalize(resolveToken('--color-card-foreground', 'light')),
    );
    expect(normalize(resolveToken('--color-popover', 'dark'))).toBe(
      normalize(resolveToken('--color-card', 'dark')),
    );
    expect(normalize(resolveToken('--color-popover-foreground', 'dark'))).toBe(
      normalize(resolveToken('--color-card-foreground', 'dark')),
    );
  });
});
