import type { Theme } from '../types';
import { DEFAULT_SEMANTIC_COLORS } from '../types';
import { DEFAULT_SEMANTIC_COLORS_LIGHT, DEFAULT_SEMANTIC_COLORS_DARK } from './ThemeSchema';
import { getBuiltInTheme, getBuiltInThemeNames } from './builtin';

export { ThemeLoader } from './ThemeLoader';

/**
 * Get a built-in theme by name
 */
export function getTheme(name: string): Theme | undefined {
  return getBuiltInTheme(name);
}

/**
 * Get available built-in theme names
 */
export function getThemeNames(): string[] {
  return getBuiltInThemeNames();
}

/**
 * Helper to generate CSS for a color that may be a gradient
 */
function colorOrGradient(colors: string[]): string {
  if (colors.length === 1) {
    return colors[0];
  }
  return `linear-gradient(to right, ${colors.join(', ')})`;
}

/**
 * Generate default CSS variables when no theme is loaded
 */
export function generateDefaultCSS(): string {
  return `
:root {
  --title-font: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --body-font: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  
  /* Light mode colors */
  --light-body-text: #333333;
  --light-title-text: #000000;
  --light-background: #ffffff;
  --light-h1-color: #000000;
  --light-h2-color: #000000;
  --light-h3-color: #333333;
  --light-h4-color: #333333;
  --light-header-text: #666666;
  --light-footer-text: #666666;
  --light-bg-cover: #f0f0f0;
  --light-bg-title: #f0f0f0;
  --light-bg-section: #000000;
  
  /* Light mode semantic colors */
  --light-link-color: ${DEFAULT_SEMANTIC_COLORS.light.link};
  --light-bullet-color: ${DEFAULT_SEMANTIC_COLORS.light.bullet};
  --light-blockquote-border: ${DEFAULT_SEMANTIC_COLORS.light.blockquoteBorder};
  --light-table-header-bg: ${DEFAULT_SEMANTIC_COLORS.light.tableHeaderBg};
  --light-code-border: ${DEFAULT_SEMANTIC_COLORS.light.codeBorder};
  --light-progress-bar: ${DEFAULT_SEMANTIC_COLORS.light.progressBar};
  
  /* Dark mode colors */
  --dark-body-text: #e0e0e0;
  --dark-title-text: #ffffff;
  --dark-background: #1a1a1a;
  --dark-h1-color: #ffffff;
  --dark-h2-color: #ffffff;
  --dark-h3-color: #e0e0e0;
  --dark-h4-color: #e0e0e0;
  --dark-header-text: #999999;
  --dark-footer-text: #999999;
  --dark-bg-cover: #0d0d0d;
  --dark-bg-title: #1a1a1a;
  --dark-bg-section: #ffffff;
  
  /* Dark mode semantic colors */
  --dark-link-color: ${DEFAULT_SEMANTIC_COLORS.dark.link};
  --dark-bullet-color: ${DEFAULT_SEMANTIC_COLORS.dark.bullet};
  --dark-blockquote-border: ${DEFAULT_SEMANTIC_COLORS.dark.blockquoteBorder};
  --dark-table-header-bg: ${DEFAULT_SEMANTIC_COLORS.dark.tableHeaderBg};
  --dark-code-border: ${DEFAULT_SEMANTIC_COLORS.dark.codeBorder};
  --dark-progress-bar: ${DEFAULT_SEMANTIC_COLORS.dark.progressBar};
}
`;
}

/**
 * Generate CSS variables from a theme's preset
 * Enhanced to support per-heading colors, layout-specific backgrounds, and semantic colors
 */
export function generateThemeCSS(
  theme: Theme,
  context: 'thumbnail' | 'preview' | 'presentation' | 'export' = 'export'
): string {
  const preset = theme.presets[0];
  if (!preset) {
    return context === 'thumbnail' ? '' : theme.css;
  }

  // Get theme.json data for advanced features
  const themeJson = theme.themeJsonData;

  // Basic CSS variables from preset
  let cssVars = `
:root {
  --title-font: ${preset.TitleFont || theme.template.TitleFont}, sans-serif;
  --body-font: ${preset.BodyFont || theme.template.BodyFont}, sans-serif;
  --dark-body-text: ${preset.DarkBodyTextColor};
  --light-body-text: ${preset.LightBodyTextColor};
  --dark-title-text: ${preset.DarkTitleTextColor};
  --light-title-text: ${preset.LightTitleTextColor};
  --dark-background: ${preset.DarkBackgroundColor};
  --light-background: ${preset.LightBackgroundColor};
  
  /* Semantic colors (light mode) */
  --light-link-color: ${preset.LightLinkColor};
  --light-bullet-color: ${preset.LightBulletColor};
  --light-blockquote-border: ${preset.LightBlockquoteBorder};
  --light-table-header-bg: ${preset.LightTableHeaderBg};
  --light-code-border: ${preset.LightCodeBorder};
  --light-progress-bar: ${preset.LightProgressBar};
  
  /* Semantic colors (dark mode) */
  --dark-link-color: ${preset.DarkLinkColor};
  --dark-bullet-color: ${preset.DarkBulletColor};
  --dark-blockquote-border: ${preset.DarkBlockquoteBorder};
  --dark-table-header-bg: ${preset.DarkTableHeaderBg};
  --dark-code-border: ${preset.DarkCodeBorder};
  --dark-progress-bar: ${preset.DarkProgressBar};
  
  --light-bg-gradient: ${preset.LightBgGradient?.join(', ') || 'none'};
  --dark-bg-gradient: ${preset.DarkBgGradient?.join(', ') || 'none'};
`;

  // Add enhanced variables from theme.json if available
  if (themeJson) {
    const light = themeJson.presets.light;
    const dark = themeJson.presets.dark;

    // Per-heading colors (light mode)
    cssVars += `
  --light-h1-color: ${colorOrGradient(light.text.h1)};
  --light-h2-color: ${colorOrGradient(light.text.h2)};
  --light-h3-color: ${colorOrGradient(light.text.h3)};
  --light-h4-color: ${colorOrGradient(light.text.h4)};
  --light-header-text: ${light.text.header};
  --light-footer-text: ${light.text.footer};
`;

    // Per-heading colors (dark mode)
    cssVars += `
  --dark-h1-color: ${colorOrGradient(dark.text.h1)};
  --dark-h2-color: ${colorOrGradient(dark.text.h2)};
  --dark-h3-color: ${colorOrGradient(dark.text.h3)};
  --dark-h4-color: ${colorOrGradient(dark.text.h4)};
  --dark-header-text: ${dark.text.header};
  --dark-footer-text: ${dark.text.footer};
`;

    // Layout-specific backgrounds (light mode)
    const lightBg = light.backgrounds;
    cssVars += `
  --light-bg-cover: ${lightBg.cover.type === 'solid' ? lightBg.cover.color : lightBg.cover.colors ? `linear-gradient(135deg, ${lightBg.cover.colors.join(', ')})` : 'inherit'};
  --light-bg-title: ${lightBg.title.type === 'solid' ? lightBg.title.color : lightBg.title.colors ? `linear-gradient(135deg, ${lightBg.title.colors.join(', ')})` : 'inherit'};
  --light-bg-section: ${lightBg.section.type === 'solid' ? lightBg.section.color : lightBg.section.colors ? `linear-gradient(135deg, ${lightBg.section.colors.join(', ')})` : 'inherit'};
`;

    // Layout-specific backgrounds (dark mode)
    const darkBg = dark.backgrounds;
    cssVars += `
  --dark-bg-cover: ${darkBg.cover.type === 'solid' ? darkBg.cover.color : darkBg.cover.colors ? `linear-gradient(135deg, ${darkBg.cover.colors.join(', ')})` : 'inherit'};
  --dark-bg-title: ${darkBg.title.type === 'solid' ? darkBg.title.color : darkBg.title.colors ? `linear-gradient(135deg, ${darkBg.title.colors.join(', ')})` : 'inherit'};
  --dark-bg-section: ${darkBg.section.type === 'solid' ? darkBg.section.color : darkBg.section.colors ? `linear-gradient(135deg, ${darkBg.section.colors.join(', ')})` : 'inherit'};
`;
  }

  cssVars += `}
`;

  // For thumbnails, include CSS variables plus essential layout CSS (no fixed font sizes)
  // For preview/presentation, include CSS variables plus layout CSS but use dynamic scaling
  // For export, include the full theme CSS
  if (context === 'thumbnail' || context === 'preview' || context === 'presentation') {
    // Extract only the essential CSS from theme.css (excluding fixed font sizes)
    // Keep backgrounds, colors, layout, gradients, but remove font-size declarations
    const essentialCSS = theme.css
      .replace(/font-size:\s*[^;]+;/g, '') // Remove font-size declarations only
      .replace(/font-weight:\s*[^;]+;/g, '') // Remove font-weight to ensure consistency
      .replace(/letter-spacing:\s*[^;]+;/g, ''); // Remove letter-spacing for consistency

    return cssVars + '\n' + essentialCSS;
  }

  return cssVars + '\n' + theme.css;
}
