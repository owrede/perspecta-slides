import { Theme } from '../types';
import { builtInThemes, getBuiltInTheme, getBuiltInThemeNames } from './builtin';

export { ThemeLoader } from './ThemeLoader';
export { builtInThemes };

export function getTheme(name: string): Theme | undefined {
  return getBuiltInTheme(name);
}

export function getThemeNames(): string[] {
  return getBuiltInThemeNames();
}

/**
 * Generate CSS variables from a theme's preset
 */
export function generateThemeCSS(theme: Theme, context: 'thumbnail' | 'preview' | 'presentation' | 'export' = 'export'): string {
  const preset = theme.presets[0];
  if (!preset) {
    return context === 'thumbnail' ? '' : theme.css;
  }

  const cssVars = `
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
}
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
