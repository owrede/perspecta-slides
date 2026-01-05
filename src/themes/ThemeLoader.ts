import { App, TFolder, TFile } from 'obsidian';
import { Theme, ThemeTemplate, ThemePreset, ThemePresetsFile, DEFAULT_SEMANTIC_COLORS } from '../types';
import { ThemeJsonFile, DEFAULT_SEMANTIC_COLORS_LIGHT, DEFAULT_SEMANTIC_COLORS_DARK } from './ThemeSchema';

export class ThemeLoader {
  private app: App;
  private themes: Map<string, Theme> = new Map();
  private customThemesFolder: string;

  constructor(app: App, customThemesFolder: string = 'perspecta-themes') {
    this.app = app;
    this.customThemesFolder = customThemesFolder;
  }

  async loadThemes(): Promise<void> {
    this.themes.clear();

    // Load custom themes from vault only (no built-in themes)
    await this.loadCustomThemes();
  }

  private async loadCustomThemes(): Promise<void> {
    // Normalize folder path (remove trailing slashes)
    const folderPath = this.customThemesFolder.replace(/\/+$/, '');
    console.log('[ThemeLoader] Loading custom themes from:', folderPath);
    
    const folder = this.app.vault.getAbstractFileByPath(folderPath);
    if (!folder || !(folder instanceof TFolder)) {
      console.log('[ThemeLoader] Folder not found or not a folder:', folderPath);
      return;
    }

    console.log('[ThemeLoader] Found folder with', folder.children.length, 'children');
    for (const child of folder.children) {
      console.log('[ThemeLoader] Checking child:', child.name, 'isFolder:', child instanceof TFolder);
      if (child instanceof TFolder) {
        try {
          const theme = await this.loadThemeFromFolder(child);
          if (theme) {
            const themeName = theme.template.Name.toLowerCase();
            console.log('[ThemeLoader] Loaded custom theme:', themeName);
            this.themes.set(themeName, theme);
          }
        } catch (e) {
          console.warn(`Failed to load theme from ${child.path}:`, e);
        }
      }
    }
  }

  private async loadThemeFromFolder(folder: TFolder): Promise<Theme | null> {
    // First, try to load theme.json (new Perspecta format)
    const themeJsonFile = folder.children.find(
      f => f instanceof TFile && f.name === 'theme.json'
    ) as TFile | undefined;

    if (themeJsonFile) {
      return this.loadThemeFromThemeJson(folder, themeJsonFile);
    }

    // Fall back to template.json (legacy iA Presenter format)
    const templateFile = folder.children.find(
      f => f instanceof TFile && f.name === 'template.json'
    ) as TFile | undefined;

    if (!templateFile) {
      console.warn(`No theme.json or template.json found in ${folder.path}`);
      return null;
    }

    // Load and parse template.json
    const templateContent = await this.app.vault.read(templateFile);
    const template: ThemeTemplate = JSON.parse(templateContent);

    // Look for presets.json
    const presetsFile = folder.children.find(
      f => f instanceof TFile && f.name === 'presets.json'
    ) as TFile | undefined;

    let presets: ThemePreset[] = [];
    if (presetsFile) {
      const presetsContent = await this.app.vault.read(presetsFile);
      const presetsData: ThemePresetsFile = JSON.parse(presetsContent);
      presets = presetsData.Presets || [];
    }

    // Look for CSS file (name from template.Css or default to theme.css)
    const cssFileName = template.Css || 'theme.css';
    const cssFile = folder.children.find(
      f => f instanceof TFile && f.name === cssFileName
    ) as TFile | undefined;

    let css = '';
    if (cssFile) {
      css = await this.app.vault.read(cssFile);
    }

    // Look for thumbnail
    const thumbnailFile = folder.children.find(
      f => f instanceof TFile && (
        f.name === 'template.png' || 
        f.name === 'template.webp' ||
        f.name === 'thumbnail.png' || 
        f.name === 'thumbnail.jpg'
      )
    ) as TFile | undefined;

    let thumbnail: string | undefined;
    if (thumbnailFile) {
      thumbnail = this.app.vault.getResourcePath(thumbnailFile);
    }

    // Get base path for asset resolution
    const basePath = folder.path;

    return {
      template,
      presets,
      css,
      basePath,
      thumbnail,
      isBuiltIn: false,
    };
  }

  /**
   * Load a theme from the new theme.json format (Perspecta custom themes)
   */
  private async loadThemeFromThemeJson(folder: TFolder, themeJsonFile: TFile): Promise<Theme | null> {
    const content = await this.app.vault.read(themeJsonFile);
    const themeJson: ThemeJsonFile = JSON.parse(content);

    // Convert theme.json to Theme format
    const template: ThemeTemplate = {
      Name: themeJson.name,
      Version: themeJson.version,
      Author: themeJson.author,
      ShortDescription: themeJson.description,
      LongDescription: themeJson.description,
      Css: 'theme.css',
      TitleFont: themeJson.fonts.title.name,
      BodyFont: themeJson.fonts.body.name,
      CssClasses: themeJson.cssClasses,
    };

    // Convert presets
    const lightPreset = this.convertModeToPreset(themeJson, 'light');
    const darkPreset = this.convertModeToPreset(themeJson, 'dark');
    const presets: ThemePreset[] = [lightPreset, darkPreset];

    // Load CSS
    const cssFile = folder.children.find(
      f => f instanceof TFile && f.name === 'theme.css'
    ) as TFile | undefined;

    let css = '';
    if (cssFile) {
      css = await this.app.vault.read(cssFile);
    }

    // Look for thumbnail
    const thumbnailFile = folder.children.find(
      f => f instanceof TFile && (
        f.name === 'template.png' || 
        f.name === 'template.webp' ||
        f.name === 'thumbnail.png' || 
        f.name === 'thumbnail.jpg'
      )
    ) as TFile | undefined;

    let thumbnail: string | undefined;
    if (thumbnailFile) {
      thumbnail = this.app.vault.getResourcePath(thumbnailFile);
    }

    return {
      template,
      presets,
      css,
      basePath: folder.path,
      thumbnail,
      isBuiltIn: false,
      // Store the parsed theme.json data for advanced features (per-heading colors, etc.)
      themeJsonData: {
        presets: themeJson.presets,
      },
    };
  }

  /**
   * Convert ThemeJsonFile mode preset to ThemePreset format
   */
  private convertModeToPreset(json: ThemeJsonFile, mode: 'light' | 'dark'): ThemePreset {
    const preset = json.presets[mode];

    const bgInfo = preset.backgrounds.general;
    let bgColor: string;
    let bgGradient: string[] | undefined;

    if (bgInfo.type === 'solid') {
      bgColor = bgInfo.color || (mode === 'light' ? '#ffffff' : '#1a1a1a');
    } else if (bgInfo.type === 'gradient' || bgInfo.type === 'dynamic') {
      bgColor = bgInfo.colors?.[0] || (mode === 'light' ? '#ffffff' : '#1a1a1a');
      bgGradient = bgInfo.colors;
    } else {
      bgColor = mode === 'light' ? '#ffffff' : '#1a1a1a';
    }

    // Get semantic colors with defaults
    const semanticColors = preset.semanticColors || (mode === 'light' ? DEFAULT_SEMANTIC_COLORS_LIGHT : DEFAULT_SEMANTIC_COLORS_DARK);

    return {
      Name: mode === 'light' ? 'Light' : 'Dark',
      TitleFont: json.fonts.title.css,
      BodyFont: json.fonts.body.css,
      Appearance: mode,

      // Text colors
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

      // Semantic colors (light mode)
      LightLinkColor: json.presets.light.semanticColors?.link || DEFAULT_SEMANTIC_COLORS_LIGHT.link,
      LightBulletColor: json.presets.light.semanticColors?.bullet || DEFAULT_SEMANTIC_COLORS_LIGHT.bullet,
      LightBlockquoteBorder: json.presets.light.semanticColors?.blockquoteBorder || DEFAULT_SEMANTIC_COLORS_LIGHT.blockquoteBorder,
      LightTableHeaderBg: json.presets.light.semanticColors?.tableHeaderBg || DEFAULT_SEMANTIC_COLORS_LIGHT.tableHeaderBg,
      LightCodeBorder: json.presets.light.semanticColors?.codeBorder || DEFAULT_SEMANTIC_COLORS_LIGHT.codeBorder,
      LightProgressBar: json.presets.light.semanticColors?.progressBar || DEFAULT_SEMANTIC_COLORS_LIGHT.progressBar,

      // Semantic colors (dark mode)
      DarkLinkColor: json.presets.dark.semanticColors?.link || DEFAULT_SEMANTIC_COLORS_DARK.link,
      DarkBulletColor: json.presets.dark.semanticColors?.bullet || DEFAULT_SEMANTIC_COLORS_DARK.bullet,
      DarkBlockquoteBorder: json.presets.dark.semanticColors?.blockquoteBorder || DEFAULT_SEMANTIC_COLORS_DARK.blockquoteBorder,
      DarkTableHeaderBg: json.presets.dark.semanticColors?.tableHeaderBg || DEFAULT_SEMANTIC_COLORS_DARK.tableHeaderBg,
      DarkCodeBorder: json.presets.dark.semanticColors?.codeBorder || DEFAULT_SEMANTIC_COLORS_DARK.codeBorder,
      DarkProgressBar: json.presets.dark.semanticColors?.progressBar || DEFAULT_SEMANTIC_COLORS_DARK.progressBar,

      // Background gradients
      LightBgGradient: json.presets.light.backgrounds.general.type === 'dynamic'
        ? json.presets.light.backgrounds.general.colors : undefined,
      DarkBgGradient: json.presets.dark.backgrounds.general.type === 'dynamic'
        ? json.presets.dark.backgrounds.general.colors : undefined,
    };
  }

  getTheme(name: string): Theme | undefined {
    return this.themes.get(name.toLowerCase());
  }

  getThemeNames(): string[] {
    return Array.from(this.themes.keys());
  }

  getAllThemes(): Theme[] {
    return Array.from(this.themes.values());
  }

  getBuiltInThemes(): Theme[] {
    // No built-in themes anymore
    return [];
  }

  getCustomThemes(): Theme[] {
    return Array.from(this.themes.values());
  }

  setCustomThemesFolder(folder: string): void {
    this.customThemesFolder = folder;
  }

  /**
   * Generate CSS variables from theme presets
   */
  generateCSSVariables(theme: Theme, presetName?: string): string {
    const preset = presetName 
      ? theme.presets.find(p => p.Name === presetName) 
      : theme.presets[0];
    
    if (!preset) {
      return '';
    }

    const vars: string[] = [
      `--title-font: ${preset.TitleFont || theme.template.TitleFont};`,
      `--body-font: ${preset.BodyFont || theme.template.BodyFont};`,
      `--dark-body-text: ${preset.DarkBodyTextColor};`,
      `--light-body-text: ${preset.LightBodyTextColor};`,
      `--dark-title-text: ${preset.DarkTitleTextColor};`,
      `--light-title-text: ${preset.LightTitleTextColor};`,
      `--dark-background: ${preset.DarkBackgroundColor};`,
      `--light-background: ${preset.LightBackgroundColor};`,
      `--light-link-color: ${preset.LightLinkColor};`,
      `--light-bullet-color: ${preset.LightBulletColor};`,
      `--light-blockquote-border: ${preset.LightBlockquoteBorder};`,
      `--light-table-header-bg: ${preset.LightTableHeaderBg};`,
      `--light-code-border: ${preset.LightCodeBorder};`,
      `--light-progress-bar: ${preset.LightProgressBar};`,
      `--dark-link-color: ${preset.DarkLinkColor};`,
      `--dark-bullet-color: ${preset.DarkBulletColor};`,
      `--dark-blockquote-border: ${preset.DarkBlockquoteBorder};`,
      `--dark-table-header-bg: ${preset.DarkTableHeaderBg};`,
      `--dark-code-border: ${preset.DarkCodeBorder};`,
      `--dark-progress-bar: ${preset.DarkProgressBar};`,
    ];

    return `:root {\n  ${vars.join('\n  ')}\n}`;
  }

  /**
   * Get the default preset for a theme
   */
  getDefaultPreset(theme: Theme): ThemePreset | undefined {
    return theme.presets.find(p => p.Name === 'Default') || theme.presets[0];
  }

  /**
   * Check if a theme has gradient backgrounds
   */
  hasGradientBackgrounds(theme: Theme): boolean {
    const preset = this.getDefaultPreset(theme);
    return !!(preset?.LightBgGradient || preset?.DarkBgGradient);
  }

  /**
   * Generate @font-face CSS for a custom theme's bundled fonts
   * Returns base64-encoded font-face rules for fonts in the theme's fonts/ folder
   */
  async generateThemeFontCSS(theme: Theme): Promise<string> {
    if (theme.isBuiltIn) return '';

    const fontsPath = `${theme.basePath}/fonts`;
    const fontsFolder = this.app.vault.getAbstractFileByPath(fontsPath);
    
    if (!fontsFolder || !(fontsFolder instanceof TFolder)) {
      return '';
    }

    const rules: string[] = [];
    const processedFonts = new Set<string>();

    for (const file of fontsFolder.children) {
      if (!(file instanceof TFile)) continue;
      
      // Only process woff2/woff files
      const ext = file.extension.toLowerCase();
      if (ext !== 'woff2' && ext !== 'woff') continue;

      // Parse font name from filename (e.g., "Barlow-normal.woff2" -> "Barlow")
      const match = file.name.match(/^(.+?)(?:-(normal|italic))?\.woff2?$/i);
      if (!match) continue;

      const fontName = match[1].replace(/-/g, ' ');
      const style = match[2] || 'normal';
      const format = ext;

      // Skip if we've already processed this font (for variable fonts)
      const key = `${fontName}-${style}`;
      if (processedFonts.has(key)) continue;
      processedFonts.add(key);

      try {
        const data = await this.app.vault.readBinary(file);
        const base64 = this.arrayBufferToBase64(data);
        const mimeType = format === 'woff2' ? 'font/woff2' : 'font/woff';

        rules.push(`
@font-face {
  font-family: '${fontName}';
  font-style: ${style};
  font-weight: 100 900;
  font-display: swap;
  src: url('data:${mimeType};base64,${base64}') format('${format}');
}`);
      } catch (e) {
        console.warn(`Failed to read font file: ${file.path}`, e);
      }
    }

    return rules.join('\n');
  }

  /**
   * Convert ArrayBuffer to base64
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
}
