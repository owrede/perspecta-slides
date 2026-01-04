import { Theme } from '../types';
import { builtInThemes, getBuiltInTheme, getBuiltInThemeNames, getThemeJson } from './builtin';
import { ThemeJsonFile } from './ThemeSchema';

export { ThemeLoader } from './ThemeLoader';
export { builtInThemes };

export function getTheme(name: string): Theme | undefined {
  return getBuiltInTheme(name);
}

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
 * Generate CSS variables from a theme's preset
 * Enhanced to support per-heading colors and layout-specific backgrounds
 */
export function generateThemeCSS(theme: Theme, context: 'thumbnail' | 'preview' | 'presentation' | 'export' = 'export'): string {
  const preset = theme.presets[0];
  if (!preset) {
    return context === 'thumbnail' ? '' : theme.css;
  }

  // Try to get enhanced theme.json data for new features
  const themeJson = getThemeJson(theme.template.Name.toLowerCase());

  // Basic CSS variables from legacy preset
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
  --dark-accent1: ${preset.DarkAccent1 || preset.Accent1};
  --light-accent1: ${preset.LightAccent1 || preset.Accent1};
  --accent1: ${preset.Accent1};
  --accent2: ${preset.Accent2};
  --accent3: ${preset.Accent3};
  --accent4: ${preset.Accent4};
  --accent5: ${preset.Accent5};
  --accent6: ${preset.Accent6};
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
  --light-bg-cover: ${lightBg.cover.type === 'solid' ? lightBg.cover.color : (lightBg.cover.colors ? `linear-gradient(135deg, ${lightBg.cover.colors.join(', ')})` : 'inherit')};
  --light-bg-title: ${lightBg.title.type === 'solid' ? lightBg.title.color : (lightBg.title.colors ? `linear-gradient(135deg, ${lightBg.title.colors.join(', ')})` : 'inherit')};
  --light-bg-section: ${lightBg.section.type === 'solid' ? lightBg.section.color : (lightBg.section.colors ? `linear-gradient(135deg, ${lightBg.section.colors.join(', ')})` : 'inherit')};
`;

    // Layout-specific backgrounds (dark mode)
    const darkBg = dark.backgrounds;
    cssVars += `
  --dark-bg-cover: ${darkBg.cover.type === 'solid' ? darkBg.cover.color : (darkBg.cover.colors ? `linear-gradient(135deg, ${darkBg.cover.colors.join(', ')})` : 'inherit')};
  --dark-bg-title: ${darkBg.title.type === 'solid' ? darkBg.title.color : (darkBg.title.colors ? `linear-gradient(135deg, ${darkBg.title.colors.join(', ')})` : 'inherit')};
  --dark-bg-section: ${darkBg.section.type === 'solid' ? darkBg.section.color : (darkBg.section.colors ? `linear-gradient(135deg, ${darkBg.section.colors.join(', ')})` : 'inherit')};
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
