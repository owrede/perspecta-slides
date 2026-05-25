/**
 * Font family name handling.
 *
 * Across the codebase a "font" value is sometimes a canonical family name
 * (e.g. `Inter`) and sometimes a CSS stack (e.g. `'Inter', sans-serif`).
 * Historically theme presets carried the latter, the Inspector wrote that
 * stack into frontmatter, and the renderer wrapped it in another set of
 * quotes — producing invalid CSS like `''Inter', sans-serif', sans-serif`
 * and breaking font lookups against the cache (where keys are family names).
 *
 * This module is the single source of truth for that conversion.
 * Invariants (post Phase 1a):
 *
 *   • Frontmatter stores **only** canonical family names.
 *   • Theme preset font fields store **only** canonical family names.
 *   • CSS stack composition happens exactly once, at render time.
 *
 * `extractFamilyName` exists for backward compatibility: it accepts either
 * form and always returns a canonical family name. Use it at every
 * read-boundary where legacy data might still carry a CSS stack.
 */

const SYSTEM_FALLBACK_STACK = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

/**
 * Extract the canonical font-family name from either a family name
 * (`Inter`) or a CSS stack (`'Inter', sans-serif`).
 *
 * Returns `undefined` for empty / nullish inputs.
 * Always returns the family unquoted, with surrounding whitespace trimmed.
 */
export function extractFamilyName(value: string | undefined | null): string | undefined {
  if (value === undefined || value === null) {return undefined;}
  const trimmed = value.trim();
  if (trimmed.length === 0) {return undefined;}

  // CSS stack form: split on commas, take the first entry, strip quotes.
  // We do this even when there are no commas because input like `'Inter'`
  // (single-quoted, no stack) also needs unquoting.
  const first = trimmed.split(',')[0].trim();
  // Defensive: if a stored value somehow contains the Phase-2 namespace
  // marker (theme migration glitch, copy-paste from devtools), strip it
  // so the canonical family name is returned. The namespace is a
  // render-time concern and never belongs in frontmatter or presets.
  return stripThemeFontNamespace(stripQuotes(first));
}

/**
 * Compose a CSS `font-family` value from a canonical family name.
 * The family is quoted with double quotes (CSS-safe even for families
 * containing spaces or other special characters) and a system fallback
 * stack is appended so missing fonts degrade gracefully instead of
 * hitting the browser's default serif.
 *
 * Pass `undefined` to get the bare system fallback stack — useful when a
 * font field is unset and you still want a complete CSS value.
 *
 * If `renderFamily` is provided (e.g. a namespaced theme-bundled family
 * like `Inter [perspecta:default]`), it is emitted first in the stack so
 * the browser picks the namespaced @font-face deterministically. The
 * canonical family is kept as a second-stage fallback so unrelated System
 * Inter takes over only if the namespaced face fails to load. This is the
 * Phase-2 mechanism that keeps theme-bundled fonts from being silently
 * substituted by a same-named system install.
 */
export function composeFontStack(
  family: string | undefined,
  renderFamily?: string
): string {
  const canonical = extractFamilyName(family);
  const renderCanonical = renderFamily?.trim();

  if (renderCanonical && renderCanonical !== canonical) {
    if (!canonical) {
      return `"${escapeForCssString(renderCanonical)}", ${SYSTEM_FALLBACK_STACK}`;
    }
    return `"${escapeForCssString(renderCanonical)}", "${escapeForCssString(canonical)}", ${SYSTEM_FALLBACK_STACK}`;
  }

  if (!canonical) {return SYSTEM_FALLBACK_STACK;}
  return `"${escapeForCssString(canonical)}", ${SYSTEM_FALLBACK_STACK}`;
}

/**
 * Phase-2 namespace marker. Used to disambiguate theme-bundled fonts from
 * a same-named font that may be installed on the OS. The format is chosen
 * to be valid as a CSS font-family value (square brackets and colon are
 * permitted in quoted family names) and to be visually distinguishable
 * from any real-world font name so users won't accidentally type it.
 *
 *   namespaceThemeFont('Inter', 'Default Theme') → 'Inter [perspecta:Default Theme]'
 *
 * Theme names are passed through as-is. Brackets in theme names are
 * stripped defensively (extremely rare but would otherwise unbalance the
 * marker).
 */
export function namespaceThemeFont(family: string, themeName: string): string {
  const safeTheme = themeName.replace(/[\[\]]/g, '').trim() || 'theme';
  return `${family} [perspecta:${safeTheme}]`;
}

/** Detect whether a family value carries a Phase-2 namespace suffix. */
export function isNamespacedThemeFont(value: string | undefined | null): boolean {
  if (!value) {return false;}
  return /\s\[perspecta:[^\]]+\]\s*$/.test(value);
}

/**
 * Strip the `[perspecta:...]` suffix from a family value, returning the
 * user-facing family name. Round-trip safe: pass a plain family name and
 * it returns unchanged. Used at UI display boundaries so dropdowns never
 * show the namespace marker to the user.
 */
export function stripThemeFontNamespace(value: string): string {
  return value.replace(/\s\[perspecta:[^\]]+\]\s*$/, '').trim();
}

/**
 * Quote a family name for inclusion as a single CSS font-family entry,
 * without the system fallback stack. Used when the caller is composing
 * a multi-family stack themselves.
 */
export function quoteFamilyForCss(family: string): string {
  return `"${escapeForCssString(family)}"`;
}

function stripQuotes(s: string): string {
  if (s.length >= 2) {
    const first = s[0];
    const last = s[s.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return s.slice(1, -1).trim();
    }
  }
  return s;
}

function escapeForCssString(s: string): string {
  // Family names virtually never contain `"` or `\`, but escape defensively
  // so we cannot emit broken CSS for an exotic family name.
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
