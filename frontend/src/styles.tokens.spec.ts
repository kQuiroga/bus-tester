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
 * re-host the plain `--*` custom-property declarations found inside
 * `@theme { ... }` under a vanilla `:root {}` rule that jsdom's CSSOM
 * understands, then let the real DOM cascade resolve the literal ones via
 * getComputedStyle. The theme now ships a single fixed dark "Graphite" palette,
 * so there is no `.dark {}` override block to re-host (design D1).
 */
function injectThemeTokens(css: string): void {
  const themeDecls = extractDecls(extractBlock(css, '@theme'));
  const style = document.createElement('style');
  style.textContent = `:root {\n${themeDecls}\n}`;
  document.head.appendChild(style);
}

/** jsdom's CSS serializer sometimes drops a space after a percentage sign; ignore all whitespace differences. */
function normalize(value: string): string {
  return value.replace(/\s+/g, '');
}

function resolveToken(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

describe('styles.css design tokens — single fixed Graphite theme', () => {
  const css = loadStylesCss();

  beforeEach(() => {
    injectThemeTokens(css);
  });

  afterEach(() => {
    document.head.querySelectorAll('style').forEach((el) => el.remove());
  });

  describe('Graphite palette (ui-presentation: "Graphite Palette, Typography, and Radii")', () => {
    const palette: Array<{ token: string; hex: string }> = [
      { token: '--color-ground', hex: '#161616' },
      { token: '--color-panel', hex: '#1f1f1f' },
      { token: '--color-panel-2', hex: '#282828' },
      { token: '--color-line', hex: '#363636' },
      { token: '--color-ink', hex: '#ededed' },
      { token: '--color-ink-muted', hex: '#9a9a9a' },
    ];

    it.each(palette)('$token resolves to the Graphite value $hex', ({ token, hex }) => {
      expect(normalize(resolveToken(token))).toBe(normalize(hex));
    });

    const semanticAliases: Array<{ token: string; source: string }> = [
      { token: '--color-background', source: '--color-ground' },
      { token: '--color-foreground', source: '--color-ink' },
      { token: '--color-card', source: '--color-panel' },
      { token: '--color-card-foreground', source: '--color-ink' },
      { token: '--color-popover', source: '--color-panel' },
      { token: '--color-muted', source: '--color-panel-2' },
      { token: '--color-muted-foreground', source: '--color-ink-muted' },
      { token: '--color-border', source: '--color-line' },
      { token: '--color-input', source: '--color-line' },
      { token: '--color-accent-foreground', source: '--color-ground' },
      // Focus ring consumes the accent token, never a broker color directly, so
      // it stays neutral while disconnected (ui-presentation: "with no broker
      // connected, a neutral default accent MUST apply").
      { token: '--color-ring', source: '--color-accent' },
    ];

    it.each(semanticAliases)('$token is declared as var($source)', ({ token, source }) => {
      const decl = new RegExp(`${token}\\s*:\\s*var\\(\\s*${source}\\b`);
      expect(decl.test(css)).toBe(true);
    });

    it('--color-primary follows the broker accent, not the near-white ink (slice 1 fidelity)', () => {
      // The prototype `.btn` fills with `var(--accent)` over `var(--accent-ink)`,
      // so primary buttons track the broker accent (amber RabbitMQ / blue Kafka)
      // and render neutral grey while disconnected (decision #167) — never the
      // near-white ink that made every button look identical.
      expect(/--color-primary\s*:\s*var\(\s*--color-accent\s*\)/.test(css)).toBe(true);
      expect(/--color-primary-foreground\s*:\s*var\(\s*--color-accent-foreground\s*\)/.test(css)).toBe(true);
      expect(/--color-primary\s*:\s*var\(\s*--color-ink\s*\)/.test(css)).toBe(false);
    });
  });

  describe('Typography — Bricolage Grotesque / Public Sans / JetBrains Mono', () => {
    it.each([
      { token: '--font-display', family: 'Bricolage Grotesque', fallback: 'sans-serif' },
      { token: '--font-sans', family: 'Public Sans', fallback: 'sans-serif' },
      { token: '--font-mono', family: 'JetBrains Mono', fallback: 'monospace' },
    ])('$token names $family and ends in a system fallback', ({ token, family, fallback }) => {
      const value = resolveToken(token);
      expect(value).toContain(family);
      expect(value.trimEnd().endsWith(fallback)).toBe(true);
    });
  });

  describe('Radii derive from a single 12px base token', () => {
    it('--radius-base resolves to 0.75rem (12px)', () => {
      expect(normalize(resolveToken('--radius-base'))).toBe(normalize('0.75rem'));
    });

    it.each(['--radius-sm', '--radius-md', '--radius-lg', '--radius-xl'])(
      '%s is declared as var(--radius-base), not a hardcoded length',
      (token) => {
        const decl = new RegExp(`${token}\\s*:\\s*var\\(\\s*--radius-base\\s*\\)`);
        expect(decl.test(css)).toBe(true);
      },
    );
  });

  describe('Accent color follows the connected broker (design D2, decision #167)', () => {
    it('declares the static broker accent colors', () => {
      expect(/--color-broker-rabbitmq\s*:\s*#e0a34a/i.test(css)).toBe(true);
      expect(/--color-broker-kafka\s*:\s*#3d8ef0/i.test(css)).toBe(true);
    });

    it('--color-accent is an indirection that defaults to a neutral, non-broker accent', () => {
      expect(
        /--color-accent\s*:\s*var\(\s*--broker-accent\s*,\s*var\(\s*--color-accent-neutral\s*\)\s*\)/.test(css),
      ).toBe(true);
      // With no [data-broker] override active, --broker-accent is unset, so the
      // fallback chain lands on the neutral accent — never a broker color
      // (ui-presentation: "with no broker connected, a neutral default accent MUST apply").
      const neutral = normalize(resolveToken('--color-accent-neutral'));
      expect(neutral).toMatch(/^#[0-9a-f]{3,8}$/i);
      expect(neutral).not.toBe(normalize('#e0a34a'));
      expect(neutral).not.toBe(normalize('#3d8ef0'));
    });

    it('maps --broker-accent to the RabbitMQ amber under [data-broker=\'rabbitmq\']', () => {
      expect(
        /\[data-broker=['"]rabbitmq['"]\]\s*\{\s*--broker-accent\s*:\s*var\(\s*--color-broker-rabbitmq\s*\)\s*;?\s*\}/.test(
          css,
        ),
      ).toBe(true);
    });

    it('maps --broker-accent to the Kafka blue under [data-broker=\'kafka\']', () => {
      expect(
        /\[data-broker=['"]kafka['"]\]\s*\{\s*--broker-accent\s*:\s*var\(\s*--color-broker-kafka\s*\)\s*;?\s*\}/.test(
          css,
        ),
      ).toBe(true);
    });
  });

  describe('Dark mode is the default and only theme (ui-presentation: "Dark Mode Is the Default Theme")', () => {
    it('keeps the @custom-variant dark declaration for the vendored libs/ui helpers', () => {
      expect(css).toContain('@custom-variant dark (&:where(.dark, .dark *))');
    });

    it('no longer defines a `.dark {}` token-override block', () => {
      expect(/(^|\s)\.dark\s*\{/.test(css)).toBe(false);
    });

    it('defines no light-theme token block (single @theme, no :root override)', () => {
      // The only brace-opening top-level rules are @theme, the [data-broker] map,
      // @layer base and @media — never a bare `:root {` or `.light {`.
      expect(/:root\s*\{/.test(css)).toBe(false);
      expect(/\.light\s*\{/.test(css)).toBe(false);
    });
  });

  describe('queue hue tokens realize the prototype Graphite palette (slice 1 fidelity)', () => {
    // Slots 1-5 are the approved prototype palette (`graphite.q` in
    // docs/redesign-prototype/Main.dc.html): green, teal, violet, blue, pink.
    // Slot 6 extends the palette with a warm coral kept visibly distinct from
    // the amber accent and from the other five hues.
    const queueHues: Array<{ token: string; hex: string }> = [
      { token: '--color-queue-1', hex: '#5ac37d' },
      { token: '--color-queue-2', hex: '#67c1c9' },
      { token: '--color-queue-3', hex: '#b393e6' },
      { token: '--color-queue-4', hex: '#6f9fe0' },
      { token: '--color-queue-5', hex: '#e08a9e' },
      { token: '--color-queue-6', hex: '#e0906a' },
    ];

    it.each(queueHues)('$token resolves to the pinned hue $hex', ({ token, hex }) => {
      expect(normalize(resolveToken(token))).toBe(normalize(hex));
    });
  });

  describe('.field-label component class (slice 1 fidelity — prototype `.lbl`)', () => {
    it('is defined inside an @layer components block', () => {
      expect(/@layer\s+components\s*\{[\s\S]*?\.field-label\s*\{/.test(css)).toBe(true);
    });

    it('renders 11px uppercase, letter-spaced, muted label text', () => {
      const body = extractBlock(css, '.field-label');
      expect(/font-size\s*:\s*11px/.test(body)).toBe(true);
      expect(/text-transform\s*:\s*uppercase/.test(body)).toBe(true);
      expect(/letter-spacing\s*:\s*0?\.06em/.test(body)).toBe(true);
      expect(/color\s*:\s*var\(\s*--color-muted-foreground\s*\)/.test(body)).toBe(true);
    });
  });
});
