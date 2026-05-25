/**
 * DeckFontResolver — single source of truth for "what fonts does this deck use".
 *
 * Before Phase 1c, every consumer (renderer, PDF export, HTML export, PPTX,
 * Inspector) had its own ad-hoc font lookup logic. The classic symptom was
 * that one path used a different family name (or none at all) than another,
 * so a deck could render correctly in the editor but lose its fonts in PDF
 * — or vice versa.
 *
 * This resolver collapses that to one well-defined function: given a deck
 * (theme + frontmatter), it returns the canonical families per role, the
 * weights each family needs, the @font-face CSS to inline, and the
 * available weights map for renderer-side fallback validation.
 *
 * Output is intentionally pure data — the resolver makes no side effects
 * beyond reading the font cache. Caching of the generated CSS lives one
 * layer up (see DeckFontResolver.cache property) so that hot UI paths
 * don't redo the base64 work on every sidebar refresh.
 */

import type { PresentationFrontmatter, Theme } from '../types';
import { extractFamilyName, namespaceThemeFont } from './FontFamily';
import type { FontManager } from './FontManager';
import type { ThemeLoader } from '../themes/ThemeLoader';

/**
 * Resolved font picture for a single deck. Pure data, no closures.
 */
export interface ResolvedDeckFonts {
  /** Canonical family name per role. `undefined` means "use theme default". */
  titleFamily?: string;
  bodyFamily?: string;
  headerFamily?: string;
  footerFamily?: string;

  /**
   * Render family per role. When the role's canonical family matches a
   * theme-bundled font, this is the Phase-2 namespaced form (e.g.
   * `Inter [perspecta:Default Theme]`); otherwise identical to the
   * canonical family. Consumers should pass this to composeFontStack as
   * the renderFamily argument so the namespaced @font-face wins over a
   * same-named OS font.
   */
  titleRenderFamily?: string;
  bodyRenderFamily?: string;
  headerRenderFamily?: string;
  footerRenderFamily?: string;

  /** Families actually used by the deck (deduped, in declaration order). */
  usedFamilies: string[];

  /** For each family, the available weights from the cache. */
  availableWeights: Map<string, number[]>;

  /**
   * The combined @font-face CSS to inline. Includes both theme-bundled
   * fonts (from custom themes' `fonts/` folder) and globally-cached fonts
   * referenced by the deck.
   */
  faceCSS: string;
}

/**
 * Inputs to the resolver. Stable identity matters for memoization keys —
 * pass the same Theme instance across calls when nothing changed.
 */
export interface DeckFontResolveInput {
  frontmatter: PresentationFrontmatter;
  theme: Theme | null;
}

/**
 * Internal cache entry: the resolved output plus the inputs we keyed on.
 * `fontCacheRevision` is incremented by FontManager whenever fonts are
 * added, removed, or rebuilt — that's our invalidation signal.
 */
interface CacheEntry {
  themeName: string | undefined;
  fontCacheRevision: number;
  roleFamiliesKey: string;
  roleWeightsKey: string;
  resolved: ResolvedDeckFonts;
}

export class DeckFontResolver {
  private fontManager: FontManager | null;
  private themeLoader: ThemeLoader | null;
  private cache = new Map<string, CacheEntry>();

  constructor(fontManager: FontManager | null, themeLoader: ThemeLoader | null) {
    this.fontManager = fontManager;
    this.themeLoader = themeLoader;
  }

  /** Invalidate every memoized resolution. Call this on theme reload. */
  invalidateAll(): void {
    this.cache.clear();
  }

  /**
   * Resolve everything about the deck's fonts.
   *
   * Memoized by (theme name, font cache revision, role families, role weights).
   * The cache is process-local; persistence is intentionally not done here.
   */
  async resolve(input: DeckFontResolveInput): Promise<ResolvedDeckFonts> {
    const fm = input.frontmatter;
    const themeName = input.theme?.template.Name;

    // Canonical family names — tolerate legacy CSS-stack values via extractFamilyName.
    const titleFamily = extractFamilyName(fm.titleFont);
    const bodyFamily = extractFamilyName(fm.bodyFont);
    const headerFamily = extractFamilyName(fm.headerFont);
    const footerFamily = extractFamilyName(fm.footerFont);

    const fontCacheRevision = this.fontManager?.getCacheRevision() ?? 0;
    const roleFamiliesKey = [titleFamily, bodyFamily, headerFamily, footerFamily].join('|');
    const roleWeightsKey = [
      fm.titleFontWeight ?? '',
      fm.bodyFontWeight ?? '',
      fm.headerFontWeight ?? '',
      fm.footerFontWeight ?? '',
    ].join('|');

    const cacheKey = `${themeName ?? ''}::${fontCacheRevision}::${roleFamiliesKey}::${roleWeightsKey}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {return cached.resolved;}

    // Collect families actually used (in role order, deduped).
    const usedFamilies: string[] = [];
    for (const f of [titleFamily, bodyFamily, headerFamily, footerFamily]) {
      if (f && !usedFamilies.includes(f)) {usedFamilies.push(f);}
    }

    // Available weights map.
    const availableWeights = new Map<string, number[]>();
    if (this.fontManager) {
      for (const family of usedFamilies) {
        const font = this.fontManager.getCachedFont(family);
        availableWeights.set(family, font?.weights ?? []);
      }
    }

    // Compose @font-face CSS. Two sources:
    //   1) Theme-bundled fonts (custom themes only — built-in themes don't
    //      have a fonts/ folder).
    //   2) Globally-cached fonts referenced by the deck.
    const cssChunks: string[] = [];

    if (input.theme && this.themeLoader && !input.theme.isBuiltIn) {
      const themeFontCSS = await this.themeLoader.generateThemeFontCSS(input.theme);
      if (themeFontCSS) {cssChunks.push(themeFontCSS);}
    }

    if (this.fontManager) {
      // Collect requested weights per family across all roles.
      const weightsPerFamily = new Map<string, Set<number>>();
      const addWeight = (family: string | undefined, weight: number) => {
        if (!family) {return;}
        if (!weightsPerFamily.has(family)) {weightsPerFamily.set(family, new Set());}
        weightsPerFamily.get(family)!.add(weight);
      };

      addWeight(titleFamily, fm.titleFontWeight ?? 700);
      const bodyWeight = fm.bodyFontWeight ?? 400;
      addWeight(bodyFamily, bodyWeight);
      // Body always needs 700 too, for <strong>/<b> tags.
      if (bodyFamily && bodyWeight !== 700) {addWeight(bodyFamily, 700);}
      addWeight(headerFamily, fm.headerFontWeight ?? 400);
      addWeight(footerFamily, fm.footerFontWeight ?? 400);

      for (const family of usedFamilies) {
        if (!this.fontManager.isCached(family)) {continue;}
        const weights = Array.from(weightsPerFamily.get(family) ?? []);
        const css = await this.fontManager.generateFontFaceCSS(
          family,
          weights.length > 0 ? weights : undefined
        );
        if (css) {cssChunks.push(css);}
      }
    }

    // Phase-2 render-family resolution: when a role's canonical family
    // matches a theme-bundled family (case-insensitive — theme.json keys
    // and Inspector input may differ in casing), expose the namespaced
    // form so CSS variables can prefer the bundled face over OS fonts.
    const bundledFamilies = new Map<string, string>();
    if (input.theme?.themeJsonData?.bundledFonts) {
      for (const b of input.theme.themeJsonData.bundledFonts) {
        bundledFamilies.set(b.family.toLowerCase(), b.family);
      }
    }
    const renderThemeName = input.theme?.template.Name || 'theme';
    const renderFor = (family: string | undefined): string | undefined => {
      if (!family) {return undefined;}
      const bundled = bundledFamilies.get(family.toLowerCase());
      if (!bundled) {return family;}
      return namespaceThemeFont(bundled, renderThemeName);
    };

    const resolved: ResolvedDeckFonts = {
      titleFamily,
      bodyFamily,
      headerFamily,
      footerFamily,
      titleRenderFamily: renderFor(titleFamily),
      bodyRenderFamily: renderFor(bodyFamily),
      headerRenderFamily: renderFor(headerFamily),
      footerRenderFamily: renderFor(footerFamily),
      usedFamilies,
      availableWeights,
      faceCSS: cssChunks.join('\n'),
    };

    this.cache.set(cacheKey, {
      themeName,
      fontCacheRevision,
      roleFamiliesKey,
      roleWeightsKey,
      resolved,
    });

    return resolved;
  }
}
