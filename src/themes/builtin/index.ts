/**
 * Built-in Themes
 *
 * Contains the default theme bundled with Perspecta Slides.
 * Additional themes can be created by users in their custom themes folder.
 */

import type { Theme, ThemeTemplate, ThemePreset } from '../../types';
import { DEFAULT_SEMANTIC_COLORS_LIGHT, DEFAULT_SEMANTIC_COLORS_DARK } from '../ThemeSchema';

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

const defaultThemeCSS = `/* Default Theme CSS */
/* Clean, professional theme with dynamic gradient backgrounds */

:root {
  /* Typography - Fonts */
  --title-font-weight: 700;
  --body-font-weight: 400;
  --header-font-weight: 400;
  --footer-font-weight: 400;
  
  /* Typography - Font Sizes */
  --title-font-size-offset: -40;
  --body-font-size-offset: -20;
  --header-font-size-offset: 0;
  --footer-font-size-offset: 0;
  --text-scale: 1;
  
  /* Typography - Spacing */
  --headline-spacing-before: 0;
  --headline-spacing-after: 1.3;
  --list-item-spacing: 1.2;
  --line-height: 1.2;
  
  /* Typography - Margins */
  --header-top: 3;
  --footer-bottom: 2.5;
  --title-top: 6.4;
  --content-top: 22;
  --content-left: 4;
  --content-right: 4;
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
    TitleFont: json.fonts.title.css,
    BodyFont: json.fonts.body.css,
    Appearance: 'light',
    
    // Text colors
    DarkTitleTextColor: json.presets.dark.text.h1[0],
    LightTitleTextColor: json.presets.light.text.h1[0],
    DarkBodyTextColor: json.presets.dark.text.body,
    LightBodyTextColor: json.presets.light.text.body,
    
    // Background colors
    DarkBackgroundColor: json.presets.dark.backgrounds.general.colors?.[0] || '#1a1a1a',
    LightBackgroundColor: json.presets.light.backgrounds.general.colors?.[0] || '#ffffff',
    
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
