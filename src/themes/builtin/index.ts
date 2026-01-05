/**
 * Built-in Themes - REMOVED
 * 
 * As of v0.2.0, all built-in themes have been removed.
 * Themes now come exclusively from the user's custom themes folder.
 * 
 * This file is kept for backwards compatibility with any code that might
 * still import from './builtin'. All exports return empty values.
 */

import { Theme } from '../../types';

// No built-in themes
export const builtInThemes: Record<string, Theme> = {};

export function getBuiltInTheme(name: string): Theme | undefined {
  return undefined;
}

export function getBuiltInThemeNames(): string[] {
  return [];
}

export function getThemeJson(name: string): undefined {
  return undefined;
}
