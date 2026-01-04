/**
 * Theme JSON Schema Types
 * 
 * Defines the structure for theme.json files used by all built-in themes.
 */

/**
 * Font definition with display name and CSS value
 */
export interface ThemeFontDef {
    name: string;
    css: string;
}

/**
 * Background definition - can be solid, gradient, or dynamic
 */
export interface ThemeBackground {
    type: 'solid' | 'gradient' | 'dynamic';
    color?: string;        // For solid
    colors?: string[];     // For gradient or dynamic
}

/**
 * Text color definition for a mode (light/dark)
 */
export interface ThemeTextColors {
    h1: string[];          // Array allows gradient (1 = solid, 2 = gradient)
    h2: string[];
    h3: string[];
    h4: string[];
    body: string;
    header: string;
    footer: string;
}

/**
 * Background definitions for different layouts
 */
export interface ThemeBackgrounds {
    general: ThemeBackground;
    cover: ThemeBackground;
    title: ThemeBackground;
    section: ThemeBackground;
}

/**
 * Color preset for a single mode (light or dark)
 */
export interface ThemeModePreset {
    text: ThemeTextColors;
    backgrounds: ThemeBackgrounds;
    accents: string[];     // Array of 6 accent colors
}

/**
 * Image overlay settings
 */
export interface ThemeOverlay {
    image: string | null;
    transparency: number;  // 0-100, default 50
}

/**
 * Complete theme.json file structure
 */
export interface ThemeJsonFile {
    name: string;
    version: string;
    author: string;
    description: string;

    fonts: {
        title: ThemeFontDef;
        body: ThemeFontDef;
    };

    cssClasses?: string;   // Optional CSS classes to add to body

    presets: {
        light: ThemeModePreset;
        dark: ThemeModePreset;
    };

    overlays?: ThemeOverlay;
}

/**
 * Default values for creating new themes
 */
export const DEFAULT_THEME_PRESET: ThemeModePreset = {
    text: {
        h1: ['#000000'],
        h2: ['#000000'],
        h3: ['#333333'],
        h4: ['#333333'],
        body: '#333333',
        header: '#666666',
        footer: '#666666'
    },
    backgrounds: {
        general: { type: 'solid', color: '#ffffff' },
        cover: { type: 'solid', color: '#f0f0f0' },
        title: { type: 'solid', color: '#f0f0f0' },
        section: { type: 'solid', color: '#000000' }
    },
    accents: ['#000000', '#43aa8b', '#f9c74f', '#90be6d', '#f8961e', '#577590']
};

export const DEFAULT_DARK_PRESET: ThemeModePreset = {
    text: {
        h1: ['#ffffff'],
        h2: ['#ffffff'],
        h3: ['#e0e0e0'],
        h4: ['#e0e0e0'],
        body: '#e0e0e0',
        header: '#999999',
        footer: '#999999'
    },
    backgrounds: {
        general: { type: 'solid', color: '#1a1a1a' },
        cover: { type: 'solid', color: '#0d0d0d' },
        title: { type: 'solid', color: '#1a1a1a' },
        section: { type: 'solid', color: '#ffffff' }
    },
    accents: ['#ffffff', '#43aa8b', '#f9c74f', '#90be6d', '#f8961e', '#577590']
};
