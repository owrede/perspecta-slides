import { App, TFolder, TFile } from 'obsidian';
import { Theme, ThemeTemplate, ThemePreset, ThemePresetsFile } from '../types';
import { builtInThemes } from './builtin';

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
      this.themes.set(name.toLowerCase(), theme);
    }

    // Load custom themes from vault
    await this.loadCustomThemes();
  }

  private async loadCustomThemes(): Promise<void> {
    const folder = this.app.vault.getAbstractFileByPath(this.customThemesFolder);
    if (!folder || !(folder instanceof TFolder)) {
      return;
    }

    for (const child of folder.children) {
      if (child instanceof TFolder) {
        try {
          const theme = await this.loadThemeFromFolder(child);
          if (theme) {
            this.themes.set(theme.template.Name.toLowerCase(), theme);
          }
        } catch (e) {
          console.warn(`Failed to load theme from ${child.path}:`, e);
        }
      }
    }
  }

  private async loadThemeFromFolder(folder: TFolder): Promise<Theme | null> {
    // Look for template.json (iA Presenter format)
    const templateFile = folder.children.find(
      f => f instanceof TFile && f.name === 'template.json'
    ) as TFile | undefined;

    if (!templateFile) {
      console.warn(`No template.json found in ${folder.path}`);
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
    return Array.from(this.themes.values()).filter(t => t.isBuiltIn);
  }

  getCustomThemes(): Theme[] {
    return Array.from(this.themes.values()).filter(t => !t.isBuiltIn);
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
      `--dark-accent1: ${preset.DarkAccent1 || preset.Accent1};`,
      `--light-accent1: ${preset.LightAccent1 || preset.Accent1};`,
      `--accent1: ${preset.Accent1};`,
      `--accent2: ${preset.Accent2};`,
      `--accent3: ${preset.Accent3};`,
      `--accent4: ${preset.Accent4};`,
      `--accent5: ${preset.Accent5};`,
      `--accent6: ${preset.Accent6};`,
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
}
