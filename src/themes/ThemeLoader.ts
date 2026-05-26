import { type App, TFolder, TFile } from 'obsidian';
import type { Theme, ThemeTemplate, ThemePreset, ThemePresetsFile } from '../types';
import {
  type ThemeJsonFile,
  DEFAULT_SEMANTIC_COLORS_LIGHT,
  DEFAULT_SEMANTIC_COLORS_DARK,
} from './ThemeSchema';
import { builtInThemes } from './builtin';
import { namespaceThemeFont } from '../utils/FontFamily';
import { vaultPathJoin } from '../utils/VaultPath';
import {
  BUILTIN_DEFAULT_THEME_NAME,
  generateBuiltinInterFontCSS,
} from './builtin/InterFontFace';

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

    // Load built-in themes first
    for (const [name, theme] of Object.entries(builtInThemes)) {
      this.themes.set(name, theme);
    }

    // Load custom themes from vault (may override built-in themes)
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
      console.log(
        '[ThemeLoader] Checking child:',
        child.name,
        'isFolder:',
        child instanceof TFolder
      );
      if (child instanceof TFolder) {
        try {
          const theme = await this.loadThemeFromFolder(child);
          if (theme) {
            const themeName = theme.template.Name.toLowerCase();
            console.log('[ThemeLoader] Loaded custom theme:', themeName);
            // Validate bundled-font manifest. Issues are logged but the theme
            // still loads — partial functionality is better than a hard fail
            // for a typo in one file entry. Authors get a visible warning.
            const issues = this.validateThemeFonts(theme);
            if (issues.length > 0) {
              console.warn(
                `[ThemeLoader] Theme "${theme.template.Name}" has ${issues.length} font manifest issue(s):`
              );
              for (const issue of issues) {console.warn(`  • ${issue}`);}
            }
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
      (f) => f instanceof TFile && f.name === 'theme.json'
    ) as TFile | undefined;

    if (themeJsonFile) {
      return this.loadThemeFromThemeJson(folder, themeJsonFile);
    }

    // Fall back to template.json (legacy format)
    const templateFile = folder.children.find(
      (f) => f instanceof TFile && f.name === 'template.json'
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
      (f) => f instanceof TFile && f.name === 'presets.json'
    ) as TFile | undefined;

    let presets: ThemePreset[] = [];
    if (presetsFile) {
      const presetsContent = await this.app.vault.read(presetsFile);
      const presetsData: ThemePresetsFile = JSON.parse(presetsContent);
      presets = presetsData.Presets || [];
    }

    // Look for CSS file (name from template.Css or default to theme.css)
    const cssFileName = template.Css || 'theme.css';
    const cssFile = folder.children.find((f) => f instanceof TFile && f.name === cssFileName) as
      | TFile
      | undefined;

    let css = '';
    if (cssFile) {
      css = await this.app.vault.read(cssFile);
    }

    // Look for thumbnail
    const thumbnailFile = folder.children.find(
      (f) =>
        f instanceof TFile &&
        (f.name === 'template.png' ||
          f.name === 'template.webp' ||
          f.name === 'thumbnail.png' ||
          f.name === 'thumbnail.jpg')
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
  private async loadThemeFromThemeJson(
    folder: TFolder,
    themeJsonFile: TFile
  ): Promise<Theme | null> {
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
    const cssFile = folder.children.find((f) => f instanceof TFile && f.name === 'theme.css') as
      | TFile
      | undefined;

    let css = '';
    if (cssFile) {
      css = await this.app.vault.read(cssFile);
    }

    // Look for thumbnail
    const thumbnailFile = folder.children.find(
      (f) =>
        f instanceof TFile &&
        (f.name === 'template.png' ||
          f.name === 'template.webp' ||
          f.name === 'thumbnail.png' ||
          f.name === 'thumbnail.jpg')
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
        bundledFonts: themeJson.bundledFonts,
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
    const semanticColors =
      preset.semanticColors ||
      (mode === 'light' ? DEFAULT_SEMANTIC_COLORS_LIGHT : DEFAULT_SEMANTIC_COLORS_DARK);

    return {
      Name: mode === 'light' ? 'Light' : 'Dark',
      // Canonical family names only — CSS stacks are composed at render time
      // by ThemeLoader.generateCSSVariables / SlideRenderer.generateCSSVariables.
      TitleFont: json.fonts.title.name,
      BodyFont: json.fonts.body.name,
      Appearance: mode,

      // Text colors
      DarkTitleTextColor: json.presets.dark.text.h1[0],
      LightTitleTextColor: json.presets.light.text.h1[0],
      DarkBodyTextColor: json.presets.dark.text.body,
      LightBodyTextColor: json.presets.light.text.body,

      // Background colors
      DarkBackgroundColor:
        json.presets.dark.backgrounds.general.type === 'solid'
          ? json.presets.dark.backgrounds.general.color || '#1a1a1a'
          : json.presets.dark.backgrounds.general.colors?.[0] || '#1a1a1a',
      LightBackgroundColor:
        json.presets.light.backgrounds.general.type === 'solid'
          ? json.presets.light.backgrounds.general.color || '#ffffff'
          : json.presets.light.backgrounds.general.colors?.[0] || '#ffffff',

      // Semantic colors (light mode)
      LightLinkColor: json.presets.light.semanticColors?.link || DEFAULT_SEMANTIC_COLORS_LIGHT.link,
      LightBulletColor:
        json.presets.light.semanticColors?.bullet || DEFAULT_SEMANTIC_COLORS_LIGHT.bullet,
      LightBlockquoteBorder:
        json.presets.light.semanticColors?.blockquoteBorder ||
        DEFAULT_SEMANTIC_COLORS_LIGHT.blockquoteBorder,
      LightTableHeaderBg:
        json.presets.light.semanticColors?.tableHeaderBg ||
        DEFAULT_SEMANTIC_COLORS_LIGHT.tableHeaderBg,
      LightCodeBorder:
        json.presets.light.semanticColors?.codeBorder || DEFAULT_SEMANTIC_COLORS_LIGHT.codeBorder,
      LightProgressBar:
        json.presets.light.semanticColors?.progressBar || DEFAULT_SEMANTIC_COLORS_LIGHT.progressBar,

      // Semantic colors (dark mode)
      DarkLinkColor: json.presets.dark.semanticColors?.link || DEFAULT_SEMANTIC_COLORS_DARK.link,
      DarkBulletColor:
        json.presets.dark.semanticColors?.bullet || DEFAULT_SEMANTIC_COLORS_DARK.bullet,
      DarkBlockquoteBorder:
        json.presets.dark.semanticColors?.blockquoteBorder ||
        DEFAULT_SEMANTIC_COLORS_DARK.blockquoteBorder,
      DarkTableHeaderBg:
        json.presets.dark.semanticColors?.tableHeaderBg ||
        DEFAULT_SEMANTIC_COLORS_DARK.tableHeaderBg,
      DarkCodeBorder:
        json.presets.dark.semanticColors?.codeBorder || DEFAULT_SEMANTIC_COLORS_DARK.codeBorder,
      DarkProgressBar:
        json.presets.dark.semanticColors?.progressBar || DEFAULT_SEMANTIC_COLORS_DARK.progressBar,

      // Background gradients
      LightBgGradient:
        json.presets.light.backgrounds.general.type === 'dynamic'
          ? json.presets.light.backgrounds.general.colors
          : undefined,
      DarkBgGradient:
        json.presets.dark.backgrounds.general.type === 'dynamic'
          ? json.presets.dark.backgrounds.general.colors
          : undefined,
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
    return Object.values(builtInThemes);
  }

  getCustomThemes(): Theme[] {
    // `this.themes` also holds the built-in themes (loaded first in
    // loadThemes); filter them out so callers — notably save-theme
    // conflict handling — see only vault-resident custom themes.
    return Array.from(this.themes.values()).filter((t) => !t.isBuiltIn);
  }

  setCustomThemesFolder(folder: string): void {
    this.customThemesFolder = folder;
  }

  /**
   * Get the default preset for a theme
   */
  getDefaultPreset(theme: Theme): ThemePreset | undefined {
    return theme.presets.find((p) => p.Name === 'Default') || theme.presets[0];
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
    if (theme.isBuiltIn) {
      // The built-in Default theme bundles Inter (see InterFontFace).
      // Other built-ins ship no fonts and use the system stack.
      if (theme.template.Name === BUILTIN_DEFAULT_THEME_NAME) {
        return generateBuiltinInterFontCSS();
      }
      return '';
    }

    const fontsPath = vaultPathJoin(theme.basePath, 'fonts');
    const fontsFolder = this.app.vault.getAbstractFileByPath(fontsPath);

    if (!fontsFolder || !(fontsFolder instanceof TFolder)) {
      return '';
    }

    const rules: string[] = [];

    // Preferred path: explicit bundled font manifest from theme.json
    const bundledFonts = theme.themeJsonData?.bundledFonts || [];
    if (bundledFonts.length > 0) {
      // Phase 2: namespace the emitted family name so it cannot be confused
      // with a same-named font installed on the OS. Theme name comes from the
      // template — see namespaceThemeFont docs for the format.
      const themeName = theme.template.Name || 'theme';
      for (const bundled of bundledFonts) {
        const renderFamily = namespaceThemeFont(bundled.family, themeName);
        for (const fileRef of bundled.files) {
          const absolutePath = vaultPathJoin(theme.basePath, fileRef.path);
          const file = this.app.vault.getAbstractFileByPath(absolutePath);
          if (!(file instanceof TFile)) {
            continue;
          }

          try {
            const data = await this.app.vault.readBinary(file);
            const base64 = this.arrayBufferToBase64(data);
            const format = fileRef.format.toLowerCase();
            const mimeType =
              format === 'woff2'
                ? 'font/woff2'
                : format === 'woff'
                  ? 'font/woff'
                  : format === 'ttf'
                    ? 'font/ttf'
                    : format === 'otf'
                      ? 'font/otf'
                      : 'font/woff2';
            const cssFormat =
              format === 'ttf' ? 'truetype' : format === 'otf' ? 'opentype' : format;

            rules.push(`
@font-face {
  font-family: '${renderFamily}';
  font-style: ${fileRef.style || 'normal'};
  font-weight: ${fileRef.weight || 400};
  font-display: swap;
  src: url('data:${mimeType};base64,${base64}') format('${cssFormat}');
}`);
          } catch (e) {
            console.warn(`Failed to read font file: ${absolutePath}`, e);
          }
        }
      }
      return rules.join('\n');
    }

    // Backward compatibility for old theme packages without bundledFonts manifest
    const themeName = theme.template.Name || 'theme';
    const processedFonts = new Set<string>();
    for (const file of fontsFolder.children) {
      if (!(file instanceof TFile)) {continue;}
      const ext = file.extension.toLowerCase();
      if (!['woff2', 'woff', 'ttf', 'otf'].includes(ext)) {continue;}

      // Legacy filenames may include family-weight-style
      const match = file.name.match(/^(.+?)-(\d+)-(normal|italic)\.(woff2|woff|ttf|otf)$/i);
      if (!match) {continue;}

      const fontName = match[1].replace(/-/g, ' ');
      const weight = parseInt(match[2], 10);
      const style = match[3] || 'normal';
      const format = match[4].toLowerCase();
      const key = `${fontName}-${weight}-${style}-${file.path}`;
      if (processedFonts.has(key)) {continue;}
      processedFonts.add(key);

      try {
        const data = await this.app.vault.readBinary(file);
        const base64 = this.arrayBufferToBase64(data);
        const mimeType =
          format === 'woff2'
            ? 'font/woff2'
            : format === 'woff'
              ? 'font/woff'
              : format === 'ttf'
                ? 'font/ttf'
                : 'font/otf';
        const cssFormat = format === 'ttf' ? 'truetype' : format === 'otf' ? 'opentype' : format;
        const renderFamily = namespaceThemeFont(fontName, themeName);

        rules.push(`
@font-face {
  font-family: '${renderFamily}';
  font-style: ${style};
  font-weight: ${weight};
  font-display: swap;
  src: url('data:${mimeType};base64,${base64}') format('${cssFormat}');
}`);
      } catch (e) {
        console.warn(`Failed to read font file: ${file.path}`, e);
      }
    }

    return rules.join('\n');
  }

  /**
   * Validate a theme's bundled-font manifest. For each declared file:
   *   • does the file exist at the declared path?
   *   • does the declared `format` match the actual extension?
   *   • is `weight` a plausible number (100..1000)?
   *   • is `style` either "normal" or "italic"?
   *
   * Returns a list of human-readable issues. Empty list = healthy theme.
   * Built-in themes return [] (they have no on-disk bundled fonts).
   */
  validateThemeFonts(theme: Theme): string[] {
    const issues: string[] = [];
    if (theme.isBuiltIn) {return issues;}

    const bundledFonts = theme.themeJsonData?.bundledFonts || [];
    if (bundledFonts.length === 0) {return issues;}

    const allowedFormats = new Set(['woff2', 'woff', 'ttf', 'otf']);
    const allowedStyles = new Set(['normal', 'italic']);

    for (const bundled of bundledFonts) {
      if (!bundled.family || bundled.family.trim().length === 0) {
        issues.push('A bundled font entry is missing its `family` name.');
        continue;
      }
      if (!Array.isArray(bundled.files) || bundled.files.length === 0) {
        issues.push(`Family "${bundled.family}" declares no font files.`);
        continue;
      }
      for (const fileRef of bundled.files) {
        const absolutePath = vaultPathJoin(theme.basePath, fileRef.path);
        const file = this.app.vault.getAbstractFileByPath(absolutePath);
        if (!(file instanceof TFile)) {
          issues.push(`"${bundled.family}": file not found at "${fileRef.path}".`);
          continue;
        }
        const ext = file.extension.toLowerCase();
        const declaredFormat = (fileRef.format || '').toLowerCase();
        if (!allowedFormats.has(ext)) {
          issues.push(`"${bundled.family}/${fileRef.path}": unsupported file extension "${ext}".`);
        }
        if (declaredFormat && declaredFormat !== ext) {
          issues.push(
            `"${bundled.family}/${fileRef.path}": declared format "${declaredFormat}" does not match file extension ".${ext}".`
          );
        }
        if (
          fileRef.weight !== undefined &&
          (typeof fileRef.weight !== 'number' || fileRef.weight < 100 || fileRef.weight > 1000)
        ) {
          issues.push(
            `"${bundled.family}/${fileRef.path}": weight ${fileRef.weight} is outside the valid range 100..1000.`
          );
        }
        if (fileRef.style && !allowedStyles.has(fileRef.style.toLowerCase())) {
          issues.push(
            `"${bundled.family}/${fileRef.path}": style "${fileRef.style}" must be "normal" or "italic".`
          );
        }
      }
    }
    return issues;
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
