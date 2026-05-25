/**
 * Built-in Themes
 *
 * Contains the default theme bundled with Perspecta Slides.
 * Additional themes can be created by users in their custom themes folder.
 */

import type { Theme, ThemeTemplate, ThemePreset } from '../../types';
import { BUILTIN_INTER_FAMILY, BUILTIN_INTER_WEIGHTS } from './InterFontFace';

/**
 * Default Theme - A clean, professional theme with Inter font and dynamic gradient backgrounds
 */
const defaultThemeJson = {
  name: 'Default',
  version: '1.0.0',
  author: 'Perspecta Slides',
  description: 'Clean, professional theme with dynamic gradient backgrounds',
  fonts: {
    title: {
      name: 'Inter',
      css: "'Inter', sans-serif",
    },
    body: {
      name: 'Inter',
      css: "'Inter', sans-serif",
    },
  },
  presets: {
    light: {
      text: {
        h1: ['#000000'],
        h2: ['#918a83'],
        h3: ['#333333'],
        h4: ['#333333'],
        body: '#333333',
        header: '#666666',
        footer: '#666666',
      },
      backgrounds: {
        general: {
          type: 'dynamic' as const,
          colors: [
            '#fecaca',
            '#fed7aa',
            '#fde68a',
            '#fef08a',
            '#d9f99d',
            '#bbf7d0',
            '#a7f3d0',
            '#99f6e4',
            '#a5f3fc',
            '#bae6fd',
            '#bfdbfe',
            '#c7d2fe',
            '#ddd6fe',
            '#e9d5ff',
            '#f5d0fe',
            '#fbcfe8',
            '#fecdd3',
          ],
        },
        cover: { type: 'solid' as const, color: '#ffffff' },
        title: { type: 'solid' as const, color: '#ffffff' },
        section: { type: 'solid' as const, color: '#000000' },
      },
      semanticColors: {
        link: '#0066cc',
        bullet: '#333333',
        blockquoteBorder: '#cccccc',
        tableHeaderBg: '#f0f0f0',
        codeBorder: '#e0e0e0',
        progressBar: '#0066cc',
      },
    },
    dark: {
      text: {
        h1: ['#ffffff'],
        h2: ['#ffffff'],
        h3: ['#e0e0e0'],
        h4: ['#e0e0e0'],
        body: '#e0e0e0',
        header: '#999999',
        footer: '#999999',
      },
      backgrounds: {
        general: {
          type: 'dynamic' as const,
          colors: [
            '#450a0a',
            '#431407',
            '#451a03',
            '#422006',
            '#1a2e05',
            '#052e16',
            '#022c22',
            '#042f2e',
            '#083344',
            '#082f49',
            '#172554',
            '#1e1b4b',
            '#2e1065',
            '#3b0764',
            '#4a044e',
            '#500724',
            '#4c0519',
          ],
        },
        cover: { type: 'solid' as const, color: '#1a1a1a' },
        title: { type: 'solid' as const, color: '#1a1a1a' },
        section: { type: 'solid' as const, color: '#ffffff' },
      },
      semanticColors: {
        link: '#66b3ff',
        bullet: '#e0e0e0',
        blockquoteBorder: '#555555',
        tableHeaderBg: '#333333',
        codeBorder: '#444444',
        progressBar: '#66b3ff',
      },
    },
  },
};

const defaultThemeCSS = `/* Default Theme CSS — values aligned with docs/LAYOUT-BLUEPRINT.md §4 */

:root {
  /* Typography — Font weights */
  --title-font-weight: 700;
  --body-font-weight: 400;
  --header-font-weight: 400;
  --footer-font-weight: 400;

  /* Typography — Type scale (multipliers of --slide-unit; see Blueprint §4.2.5) */
  /* Slot-based layouts (default, *-column) */
  --h1-size-default: 7;
  --h2-size-default: 5.5;
  --h3-size-default: 4.5;
  --h4-size-default: 3.5;
  --h5-size-default: 3;
  --h6-size-default: 2.5;
  /* Centered layouts (cover, title) */
  --h1-size-centered: 9;
  --h2-size-centered: 7;
  /* Body and accents */
  --body-size: 2.8;
  --blockquote-size: 2.8;
  --kicker-size: 1.8;
  --header-size: 1.8;
  --footer-size: 1.8;
  --footnote-size: 1.8;
  --caption-size: 2;
  --caption-title-size: 3.5;
  --footnotes-title-size: 6;
  --footnotes-list-size: 2;

  /* Typography — Rhythm */
  --headline-spacing-before: 0;
  --headline-spacing-after: 1.3;
  --list-item-spacing: 1.2;
  --line-height: 1.2;

  /* Grid (safe area) — distances from canvas edges, in slide-units */
  --header-top: 3;
  --footer-bottom: 2.5;
  --content-left: 4;
  --content-right: 4;

  /* Slots — distances from canvas top, in slide-units */
  --title-top: 6.4;
  --content-top: 22;

  /* Column geometry */
  --column-gap-2: 3;
  --column-gap-3: 5;
  --columns-bottom-offset: 4;
}`;

/**
 * Convert theme.json format to Theme object
 */
function createDefaultTheme(): Theme {
  const json = defaultThemeJson;

  const template: ThemeTemplate = {
    Name: json.name,
    Version: json.version,
    Author: json.author,
    ShortDescription: json.description,
    LongDescription: json.description,
    Css: 'theme.css',
    TitleFont: json.fonts.title.name,
    BodyFont: json.fonts.body.name,
    CssClasses: '',
  };

  const lightPreset: ThemePreset = {
    Name: 'Light',
    // Canonical family names only — CSS stacks are composed at render time.
    TitleFont: json.fonts.title.name,
    BodyFont: json.fonts.body.name,
    Appearance: 'light',
    
    // Text colors
    DarkTitleTextColor: json.presets.dark.text.h1[0],
    LightTitleTextColor: json.presets.light.text.h1[0],
    DarkBodyTextColor: json.presets.dark.text.body,
    LightBodyTextColor: json.presets.light.text.body,
    
    // Background colors — explicit neutral single-color defaults.
    // The dynamic gradient list is exposed separately via LightBgGradient / DarkBgGradient
    // and only takes effect when frontmatter.useDynamicBackground is enabled.
    // Single-color and gradient are independent concerns.
    DarkBackgroundColor: '#1a1a1a',
    LightBackgroundColor: '#ffffff',
    
    // Semantic colors (light mode)
    LightLinkColor: json.presets.light.semanticColors.link,
    LightBulletColor: json.presets.light.semanticColors.bullet,
    LightBlockquoteBorder: json.presets.light.semanticColors.blockquoteBorder,
    LightTableHeaderBg: json.presets.light.semanticColors.tableHeaderBg,
    LightCodeBorder: json.presets.light.semanticColors.codeBorder,
    LightProgressBar: json.presets.light.semanticColors.progressBar,
    
    // Semantic colors (dark mode)
    DarkLinkColor: json.presets.dark.semanticColors.link,
    DarkBulletColor: json.presets.dark.semanticColors.bullet,
    DarkBlockquoteBorder: json.presets.dark.semanticColors.blockquoteBorder,
    DarkTableHeaderBg: json.presets.dark.semanticColors.tableHeaderBg,
    DarkCodeBorder: json.presets.dark.semanticColors.codeBorder,
    DarkProgressBar: json.presets.dark.semanticColors.progressBar,
    
    // Background gradients
    LightBgGradient: json.presets.light.backgrounds.general.colors,
    DarkBgGradient: json.presets.dark.backgrounds.general.colors,
  };

  return {
    template,
    presets: [lightPreset],
    css: defaultThemeCSS,
    basePath: '',
    isBuiltIn: true,
    themeJsonData: {
      presets: json.presets,
      // Declare Inter as a bundled font so the render-family namespace
      // logic in SlideRenderer / generateThemeCSS / DeckFontResolver
      // treats it like any custom-theme bundled font. The actual
      // @font-face bytes are emitted by ThemeLoader.generateThemeFontCSS
      // via InterFontFace (built-in special case). File paths are
      // synthetic — built-ins don't read from the vault.
      bundledFonts: [
        {
          family: BUILTIN_INTER_FAMILY,
          files: BUILTIN_INTER_WEIGHTS.map((weight) => ({
            path: `builtin:inter-${weight}`,
            weight,
            style: 'normal',
            format: 'woff2',
          })),
        },
      ],
    },
  };
}

// Create the built-in themes map
export const builtInThemes: Record<string, Theme> = {
  default: createDefaultTheme(),
};

export function getBuiltInTheme(name: string): Theme | undefined {
  return builtInThemes[name.toLowerCase()];
}

export function getBuiltInThemeNames(): string[] {
  return Object.keys(builtInThemes);
}
