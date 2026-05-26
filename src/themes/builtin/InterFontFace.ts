/**
 * Built-in Inter font faces for the Default theme.
 *
 * The Default theme declares Inter as its title/body family. Previously
 * that was a lie on machines without Inter installed or cached: the
 * theme advertised Inter but shipped no font, so rendering silently fell
 * back to the system stack. We now bundle a small set of Inter weights
 * (Regular/Medium/SemiBold/Bold + Regular Italic) as base64 woff2 and
 * emit @font-face rules for them, so the Default theme looks identical
 * everywhere.
 *
 * The emitted family name is namespaced via `namespaceThemeFont` exactly
 * like custom-theme bundled fonts (Phase 2), so it can't be confused with
 * a differently-versioned OS install of Inter and flows through the same
 * DeckFontResolver render-family machinery.
 *
 * Inter is licensed under the SIL Open Font License 1.1, which permits
 * bundling. Five weights keep the bundle cost ~550KB; that covers the
 * weights the inspector exposes for the Default theme.
 */

import InterRegular from '../../fonts/inter/Inter-Regular.woff2';
import InterItalic from '../../fonts/inter/Inter-Italic.woff2';
import InterMedium from '../../fonts/inter/Inter-Medium.woff2';
import InterSemiBold from '../../fonts/inter/Inter-SemiBold.woff2';
import InterBold from '../../fonts/inter/Inter-Bold.woff2';
import { namespaceThemeFont } from '../../utils/FontFamily';

/** The family name the Default theme stores in its preset font fields. */
export const BUILTIN_INTER_FAMILY = 'Inter';

/** The theme name whose namespace the bundled Inter faces are tagged with. */
export const BUILTIN_DEFAULT_THEME_NAME = 'Default';

interface InterFace {
  base64: string;
  weight: number;
  style: 'normal' | 'italic';
}

const INTER_FACES: InterFace[] = [
  { base64: InterRegular, weight: 400, style: 'normal' },
  { base64: InterItalic, weight: 400, style: 'italic' },
  { base64: InterMedium, weight: 500, style: 'normal' },
  { base64: InterSemiBold, weight: 600, style: 'normal' },
  { base64: InterBold, weight: 700, style: 'normal' },
];

/** Weights the bundled built-in Inter actually provides (normal styles). */
export const BUILTIN_INTER_WEIGHTS = [400, 500, 600, 700];

/**
 * Generate the @font-face CSS for the bundled Inter, using the namespaced
 * render family so it matches the render family DeckFontResolver /
 * SlideRenderer compute for a bundled `Inter` in the Default theme.
 */
export function generateBuiltinInterFontCSS(): string {
  const renderFamily = namespaceThemeFont(BUILTIN_INTER_FAMILY, BUILTIN_DEFAULT_THEME_NAME);
  return INTER_FACES.map(
    (face) => `
@font-face {
  font-family: '${renderFamily}';
  font-style: ${face.style};
  font-weight: ${face.weight};
  font-display: swap;
  src: url('data:font/woff2;base64,${face.base64}') format('woff2');
}`
  ).join('\n');
}

/** A bundled built-in font variant decoded to raw WOFF2 bytes. */
export interface BuiltinFontVariant {
  weight: number;
  style: 'normal' | 'italic';
  /** Raw WOFF2 bytes (still compressed; callers decompress as needed). */
  bytes: Uint8Array;
  format: 'woff2';
}

/**
 * Decode the bundled Inter faces to raw WOFF2 bytes. Used by export paths
 * (e.g. PPTX embedding) that need the actual font files for the built-in
 * Default theme, which has no on-disk fonts/ folder or global cache entry.
 */
export function getBuiltinInterVariants(): BuiltinFontVariant[] {
  return INTER_FACES.map((face) => {
    const binary = atob(face.base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return { weight: face.weight, style: face.style, bytes, format: 'woff2' as const };
  });
}
