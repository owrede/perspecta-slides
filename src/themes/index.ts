import { Theme } from '../types';
import { zurichTheme } from './zurich';

export const builtInThemes: Record<string, Theme> = {
  zurich: zurichTheme,
};

export function getTheme(name: string): Theme | undefined {
  return builtInThemes[name.toLowerCase()];
}

export function getThemeNames(): string[] {
  return Object.keys(builtInThemes);
}

export { zurichTheme };
