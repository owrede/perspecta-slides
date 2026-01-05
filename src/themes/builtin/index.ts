/**
 * Built-in Theme Loader
 * 
 * Loads themes from individual folders with theme.json and theme.css files.
 * Each theme folder contains:
 * - theme.json: Theme configuration and color presets
 * - theme.css: Theme-specific styles
 */

import { Theme, ThemeTemplate, ThemePreset } from '../../types';
import { ThemeJsonFile, ThemeModePreset } from '../ThemeSchema';

// Import theme JSON files
import zurichJson from './zurich/theme.json';
import kyotoJson from './kyoto/theme.json';
import berlinJson from './berlin/theme.json';
import minimalJson from './minimal/theme.json';
import helveticaJson from './helvetica/theme.json';
import baselJson from './basel/theme.json';
import copenhagenJson from './copenhagen/theme.json';
import garamondJson from './garamond/theme.json';
import laJson from './la/theme.json';
import milanoJson from './milano/theme.json';
import newyorkJson from './newyork/theme.json';
import parisJson from './paris/theme.json';
import sanfranciscoJson from './sanfrancisco/theme.json';
import vancouverJson from './vancouver/theme.json';

// Import theme CSS files
import zurichCss from './zurich/theme.css';
import kyotoCss from './kyoto/theme.css';
import berlinCss from './berlin/theme.css';
import minimalCss from './minimal/theme.css';
import helveticaCss from './helvetica/theme.css';
import baselCss from './basel/theme.css';
import copenhagenCss from './copenhagen/theme.css';
import garamondCss from './garamond/theme.css';
import laCss from './la/theme.css';
import milanoCss from './milano/theme.css';
import newyorkCss from './newyork/theme.css';
import parisCss from './paris/theme.css';
import sanfranciscoCss from './sanfrancisco/theme.css';
import vancouverCss from './vancouver/theme.css';

/**
 * Convert new theme.json format to legacy ThemePreset format
 * This allows gradual migration while maintaining compatibility
 */
function convertModeToPreset(json: ThemeJsonFile, mode: 'light' | 'dark'): ThemePreset {
  const preset = json.presets[mode];
  const isLight = mode === 'light';

  // Get the first color from headline arrays (or gradient first color)
  const h1Color = preset.text.h1[0];

  // Determine background handling
  const bgInfo = preset.backgrounds.general;
  let bgColor: string;
  let bgGradient: string[] | undefined;

  if (bgInfo.type === 'solid') {
    bgColor = bgInfo.color || (isLight ? '#ffffff' : '#1a1a1a');
  } else if (bgInfo.type === 'gradient' || bgInfo.type === 'dynamic') {
    bgColor = bgInfo.colors?.[0] || (isLight ? '#ffffff' : '#1a1a1a');
    bgGradient = bgInfo.colors;
  } else {
    bgColor = isLight ? '#ffffff' : '#1a1a1a';
  }

  return {
    Name: mode === 'light' ? 'Light' : 'Dark',
    TitleFont: json.fonts.title.css,
    BodyFont: json.fonts.body.css,
    Appearance: mode,

    // Text colors - use h1 as title color
    DarkTitleTextColor: json.presets.dark.text.h1[0],
    LightTitleTextColor: json.presets.light.text.h1[0],
    DarkBodyTextColor: json.presets.dark.text.body,
    LightBodyTextColor: json.presets.light.text.body,

    // Background colors
    DarkBackgroundColor: json.presets.dark.backgrounds.general.type === 'solid'
      ? json.presets.dark.backgrounds.general.color || '#1a1a1a'
      : json.presets.dark.backgrounds.general.colors?.[0] || '#1a1a1a',
    LightBackgroundColor: json.presets.light.backgrounds.general.type === 'solid'
      ? json.presets.light.backgrounds.general.color || '#ffffff'
      : json.presets.light.backgrounds.general.colors?.[0] || '#ffffff',

    // Accent colors
    Accent1: preset.accents[0],
    Accent2: preset.accents[1],
    Accent3: preset.accents[2],
    Accent4: preset.accents[3],
    Accent5: preset.accents[4],
    Accent6: preset.accents[5],

    // Mode-specific accent colors
    DarkAccent1: json.presets.dark.accents[0],
    LightAccent1: json.presets.light.accents[0],

    // Background gradients (if dynamic)
    LightBgGradient: json.presets.light.backgrounds.general.type === 'dynamic'
      ? json.presets.light.backgrounds.general.colors : undefined,
    DarkBgGradient: json.presets.dark.backgrounds.general.type === 'dynamic'
      ? json.presets.dark.backgrounds.general.colors : undefined,
  };
}

/**
 * Convert theme.json to legacy Theme format
 */
function createThemeFromJson(json: ThemeJsonFile, css: string): Theme {
  const template: ThemeTemplate = {
    Name: json.name,
    Version: json.version,
    Author: json.author,
    ShortDescription: json.description,
    LongDescription: json.description,
    Css: 'theme.css',
    TitleFont: json.fonts.title.name,
    BodyFont: json.fonts.body.name,
    CssClasses: json.cssClasses,
  };

  // Create presets for both light and dark modes
  const lightPreset = convertModeToPreset(json, 'light');
  const darkPreset = convertModeToPreset(json, 'dark');

  // The primary preset is based on which mode the theme defaults to
  // For now, use light as primary (first preset)
  const presets: ThemePreset[] = [lightPreset, darkPreset];

  return {
    template,
    presets,
    css,
    basePath: '',
    isBuiltIn: true,
  };
}

// Create themes from JSON/CSS files
export const builtInThemes: Record<string, Theme> = {
  zurich: createThemeFromJson(zurichJson as ThemeJsonFile, zurichCss),
  kyoto: createThemeFromJson(kyotoJson as ThemeJsonFile, kyotoCss),
  berlin: createThemeFromJson(berlinJson as ThemeJsonFile, berlinCss),
  minimal: createThemeFromJson(minimalJson as ThemeJsonFile, minimalCss),
  helvetica: createThemeFromJson(helveticaJson as ThemeJsonFile, helveticaCss),
  basel: createThemeFromJson(baselJson as ThemeJsonFile, baselCss),
  copenhagen: createThemeFromJson(copenhagenJson as ThemeJsonFile, copenhagenCss),
  garamond: createThemeFromJson(garamondJson as ThemeJsonFile, garamondCss),
  la: createThemeFromJson(laJson as ThemeJsonFile, laCss),
  milano: createThemeFromJson(milanoJson as ThemeJsonFile, milanoCss),
  newyork: createThemeFromJson(newyorkJson as ThemeJsonFile, newyorkCss),
  paris: createThemeFromJson(parisJson as ThemeJsonFile, parisCss),
  sanfrancisco: createThemeFromJson(sanfranciscoJson as ThemeJsonFile, sanfranciscoCss),
  vancouver: createThemeFromJson(vancouverJson as ThemeJsonFile, vancouverCss),
};

export function getBuiltInTheme(name: string): Theme | undefined {
  return builtInThemes[name.toLowerCase()];
}

export function getBuiltInThemeNames(): string[] {
  return Object.keys(builtInThemes);
}

/**
 * Get the raw theme.json data for advanced features
 */
export function getThemeJson(name: string): ThemeJsonFile | undefined {
  const themeJsons: Record<string, ThemeJsonFile> = {
    zurich: zurichJson as ThemeJsonFile,
    kyoto: kyotoJson as ThemeJsonFile,
    berlin: berlinJson as ThemeJsonFile,
    minimal: minimalJson as ThemeJsonFile,
    helvetica: helveticaJson as ThemeJsonFile,
    basel: baselJson as ThemeJsonFile,
    copenhagen: copenhagenJson as ThemeJsonFile,
    garamond: garamondJson as ThemeJsonFile,
    la: laJson as ThemeJsonFile,
    milano: milanoJson as ThemeJsonFile,
    newyork: newyorkJson as ThemeJsonFile,
    paris: parisJson as ThemeJsonFile,
    sanfrancisco: sanfranciscoJson as ThemeJsonFile,
    vancouver: vancouverJson as ThemeJsonFile,
  };
  return themeJsons[name.toLowerCase()];
}
