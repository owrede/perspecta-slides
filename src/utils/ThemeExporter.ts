import { App, TFile, TFolder, Modal, Setting, Notice } from 'obsidian';
import { PresentationFrontmatter, Theme, ThemePreset } from '../types';
import { ThemeJsonFile, ThemeModePreset, ThemeBackground } from '../themes/ThemeSchema';
import { FontManager } from './FontManager';
import { getTheme } from '../themes';

/**
 * Modal dialog for saving a custom theme
 */
export class SaveThemeModal extends Modal {
  private themeName: string = '';
  private onSave: (name: string) => Promise<void>;
  private existingThemes: string[];

  constructor(app: App, existingThemes: string[], onSave: (name: string) => Promise<void>) {
    super(app);
    this.existingThemes = existingThemes;
    this.onSave = onSave;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.addClass('perspecta-save-theme-modal');

    contentEl.createEl('h2', { text: 'Save as Custom Theme' });
    contentEl.createEl('p', { 
      text: 'This will save all current settings (fonts, colors, typography, margins) as a reusable theme.',
      cls: 'modal-description'
    });

    new Setting(contentEl)
      .setName('Theme Name')
      .setDesc('Choose a unique name for your theme')
      .addText(text => {
        text
          .setPlaceholder('My Custom Theme')
          .onChange(value => {
            this.themeName = value.trim();
          });
        text.inputEl.focus();
      });

    const footer = contentEl.createDiv({ cls: 'modal-button-container' });
    
    const cancelBtn = footer.createEl('button', { text: 'Cancel' });
    cancelBtn.addEventListener('click', () => this.close());

    const saveBtn = footer.createEl('button', { text: 'Save Theme', cls: 'mod-cta' });
    saveBtn.addEventListener('click', async () => {
      if (!this.themeName) {
        new Notice('Please enter a theme name');
        return;
      }

      // Check for name conflicts with built-in themes
      const normalizedName = this.themeName.toLowerCase().replace(/\s+/g, '-');
      const builtInConflict = this.existingThemes.some(t => 
        t.toLowerCase() === normalizedName && !t.includes('(custom)')
      );
      
      if (builtInConflict) {
        new Notice(`A built-in theme named "${this.themeName}" exists. Your custom theme will be saved as "${this.themeName} (custom)".`);
      }

      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';

      try {
        await this.onSave(this.themeName);
        this.close();
      } catch (e) {
        console.error('Failed to save theme:', e);
        new Notice(`Failed to save theme: ${e instanceof Error ? e.message : 'Unknown error'}`);
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Theme';
      }
    });
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

/**
 * ThemeExporter - Exports current presentation settings as a custom theme
 */
export class ThemeExporter {
  private app: App;
  private fontManager: FontManager | null;
  private customThemesFolder: string;

  constructor(app: App, fontManager: FontManager | null, customThemesFolder: string) {
    this.app = app;
    this.fontManager = fontManager;
    this.customThemesFolder = customThemesFolder;
  }

  /**
   * Export the current presentation settings as a custom theme
   */
  async exportTheme(
    themeName: string,
    frontmatter: PresentationFrontmatter,
    baseThemeName?: string
  ): Promise<string> {
    // Get the base theme for fallback values
    const baseTheme = getTheme(baseThemeName || frontmatter.theme || 'zurich');
    const basePreset = baseTheme?.presets[0];

    // Create theme folder
    const folderName = themeName.toLowerCase().replace(/\s+/g, '-');
    const themePath = `${this.customThemesFolder}/${folderName}`;
    
    await this.ensureFolder(themePath);

    // Generate theme.json
    const themeJson = this.generateThemeJson(themeName, frontmatter, baseTheme);
    await this.app.vault.create(
      `${themePath}/theme.json`,
      JSON.stringify(themeJson, null, 2)
    );

    // Generate theme.css with typography/margin defaults
    const themeCss = this.generateThemeCss(frontmatter, baseTheme);
    await this.app.vault.create(`${themePath}/theme.css`, themeCss);

    // Copy fonts if using cached Google Fonts
    await this.copyFonts(themePath, frontmatter);

    new Notice(`Theme "${themeName}" saved to ${themePath}`);
    return themePath;
  }

  /**
   * Generate theme.json from frontmatter settings
   */
  private generateThemeJson(
    themeName: string,
    fm: PresentationFrontmatter,
    baseTheme: Theme | undefined
  ): ThemeJsonFile {
    const basePreset = baseTheme?.presets[0];

    // Determine fonts
    const titleFontName = fm.titleFont || baseTheme?.template.TitleFont || 'Helvetica';
    const bodyFontName = fm.bodyFont || baseTheme?.template.BodyFont || 'Helvetica';

    // Build font CSS values
    const titleFontCss = this.getFontCss(titleFontName);
    const bodyFontCss = this.getFontCss(bodyFontName);

    // Build light mode preset
    const lightPreset: ThemeModePreset = {
      text: {
        h1: fm.lightH1Color || [fm.lightTitleText || basePreset?.LightTitleTextColor || '#000000'],
        h2: fm.lightH2Color || [fm.lightTitleText || basePreset?.LightTitleTextColor || '#000000'],
        h3: fm.lightH3Color || [fm.lightTitleText || basePreset?.LightTitleTextColor || '#333333'],
        h4: fm.lightH4Color || [fm.lightTitleText || basePreset?.LightTitleTextColor || '#333333'],
        body: fm.lightBodyText || basePreset?.LightBodyTextColor || '#333333',
        header: fm.lightHeaderText || '#666666',
        footer: fm.lightFooterText || '#666666',
      },
      backgrounds: {
        general: this.buildBackground(fm.lightBackground, basePreset?.LightBackgroundColor || '#ffffff'),
        cover: this.buildBackground(fm.lightBgCover, fm.lightBackground || basePreset?.LightBackgroundColor || '#ffffff'),
        title: this.buildBackground(fm.lightBgTitle, fm.lightBackground || basePreset?.LightBackgroundColor || '#ffffff'),
        section: this.buildBackground(fm.lightBgSection, '#000000'),
      },
      accents: [
        fm.accent1 || basePreset?.Accent1 || '#000000',
        fm.accent2 || basePreset?.Accent2 || '#43aa8b',
        fm.accent3 || basePreset?.Accent3 || '#f9c74f',
        fm.accent4 || basePreset?.Accent4 || '#90be6d',
        fm.accent5 || basePreset?.Accent5 || '#f8961e',
        fm.accent6 || basePreset?.Accent6 || '#577590',
      ],
    };

    // Build dark mode preset
    const darkPreset: ThemeModePreset = {
      text: {
        h1: fm.darkH1Color || [fm.darkTitleText || basePreset?.DarkTitleTextColor || '#ffffff'],
        h2: fm.darkH2Color || [fm.darkTitleText || basePreset?.DarkTitleTextColor || '#ffffff'],
        h3: fm.darkH3Color || [fm.darkTitleText || basePreset?.DarkTitleTextColor || '#e0e0e0'],
        h4: fm.darkH4Color || [fm.darkTitleText || basePreset?.DarkTitleTextColor || '#e0e0e0'],
        body: fm.darkBodyText || basePreset?.DarkBodyTextColor || '#e0e0e0',
        header: fm.darkHeaderText || '#999999',
        footer: fm.darkFooterText || '#999999',
      },
      backgrounds: {
        general: this.buildBackground(fm.darkBackground, basePreset?.DarkBackgroundColor || '#1a1a1a'),
        cover: this.buildBackground(fm.darkBgCover, fm.darkBackground || basePreset?.DarkBackgroundColor || '#1a1a1a'),
        title: this.buildBackground(fm.darkBgTitle, fm.darkBackground || basePreset?.DarkBackgroundColor || '#1a1a1a'),
        section: this.buildBackground(fm.darkBgSection, '#ffffff'),
      },
      accents: [
        fm.accent1 || basePreset?.Accent1 || '#ffffff',
        fm.accent2 || basePreset?.Accent2 || '#43aa8b',
        fm.accent3 || basePreset?.Accent3 || '#f9c74f',
        fm.accent4 || basePreset?.Accent4 || '#90be6d',
        fm.accent5 || basePreset?.Accent5 || '#f8961e',
        fm.accent6 || basePreset?.Accent6 || '#577590',
      ],
    };

    // Handle dynamic backgrounds if present
    if (fm.lightDynamicBackground && fm.lightDynamicBackground.length > 0) {
      lightPreset.backgrounds.general = {
        type: 'dynamic',
        colors: fm.lightDynamicBackground,
      };
    }
    if (fm.darkDynamicBackground && fm.darkDynamicBackground.length > 0) {
      darkPreset.backgrounds.general = {
        type: 'dynamic',
        colors: fm.darkDynamicBackground,
      };
    }

    return {
      name: themeName,
      version: '1.0.0',
      author: fm.author || 'Custom',
      description: `Custom theme based on ${baseTheme?.template.Name || 'Zurich'}`,
      fonts: {
        title: {
          name: titleFontName,
          css: titleFontCss,
        },
        body: {
          name: bodyFontName,
          css: bodyFontCss,
        },
      },
      cssClasses: baseTheme?.template.CssClasses,
      presets: {
        light: lightPreset,
        dark: darkPreset,
      },
    };
  }

  /**
   * Generate theme.css with typography and margin defaults
   */
  private generateThemeCss(fm: PresentationFrontmatter, baseTheme: Theme | undefined): string {
    const lines: string[] = [
      `/* Custom Theme CSS */`,
      `/* Generated from presentation settings */`,
      ``,
    ];

    // Root variables for typography defaults
    const rootVars: string[] = [];

    // Font weights
    if (fm.titleFontWeight !== undefined) {
      rootVars.push(`  --title-font-weight: ${fm.titleFontWeight};`);
    }
    if (fm.bodyFontWeight !== undefined) {
      rootVars.push(`  --body-font-weight: ${fm.bodyFontWeight};`);
    }
    if (fm.headerFontWeight !== undefined) {
      rootVars.push(`  --header-font-weight: ${fm.headerFontWeight};`);
    }
    if (fm.footerFontWeight !== undefined) {
      rootVars.push(`  --footer-font-weight: ${fm.footerFontWeight};`);
    }

    // Font size offsets
    if (fm.titleFontSize !== undefined) {
      rootVars.push(`  --title-font-size-offset: ${fm.titleFontSize};`);
    }
    if (fm.bodyFontSize !== undefined) {
      rootVars.push(`  --body-font-size-offset: ${fm.bodyFontSize};`);
    }
    if (fm.headerFontSize !== undefined) {
      rootVars.push(`  --header-font-size-offset: ${fm.headerFontSize};`);
    }
    if (fm.footerFontSize !== undefined) {
      rootVars.push(`  --footer-font-size-offset: ${fm.footerFontSize};`);
    }

    // Spacing
    if (fm.headlineSpacingBefore !== undefined) {
      rootVars.push(`  --headline-spacing-before: ${fm.headlineSpacingBefore};`);
    }
    if (fm.headlineSpacingAfter !== undefined) {
      rootVars.push(`  --headline-spacing-after: ${fm.headlineSpacingAfter};`);
    }
    if (fm.listItemSpacing !== undefined) {
      rootVars.push(`  --list-item-spacing: ${fm.listItemSpacing};`);
    }
    if (fm.lineHeight !== undefined) {
      rootVars.push(`  --line-height: ${fm.lineHeight};`);
    }

    // Margins
    if (fm.headerTop !== undefined) {
      rootVars.push(`  --header-top: ${fm.headerTop};`);
    }
    if (fm.footerBottom !== undefined) {
      rootVars.push(`  --footer-bottom: ${fm.footerBottom};`);
    }
    if (fm.titleTop !== undefined) {
      rootVars.push(`  --title-top: ${fm.titleTop};`);
    }
    if (fm.contentTop !== undefined) {
      rootVars.push(`  --content-top: ${fm.contentTop};`);
    }
    if (fm.contentWidth !== undefined) {
      rootVars.push(`  --content-width: ${fm.contentWidth};`);
    }

    if (rootVars.length > 0) {
      lines.push(`:root {`);
      lines.push(...rootVars);
      lines.push(`}`);
      lines.push(``);
    }

    // Include base theme CSS if available (without font-size declarations that would override)
    if (baseTheme?.css) {
      lines.push(`/* Base theme styles */`);
      lines.push(baseTheme.css);
    }

    return lines.join('\n');
  }

  /**
   * Copy cached fonts to the theme folder
   */
  private async copyFonts(themePath: string, fm: PresentationFrontmatter): Promise<void> {
    if (!this.fontManager) return;

    const fontsFolder = `${themePath}/fonts`;
    const fontsToCopy = [fm.titleFont, fm.bodyFont, fm.headerFont, fm.footerFont]
      .filter((f): f is string => !!f && this.fontManager!.isCached(f));

    if (fontsToCopy.length === 0) return;

    await this.ensureFolder(fontsFolder);

    for (const fontName of fontsToCopy) {
      const cachedFont = this.fontManager.getCachedFont(fontName);
      if (!cachedFont) continue;

      for (const file of cachedFont.files) {
        const sourceFile = this.app.vault.getAbstractFileByPath(file.localPath);
        if (sourceFile instanceof TFile) {
          const fileName = file.localPath.split('/').pop() || `${fontName}.woff2`;
          const destPath = `${fontsFolder}/${fileName}`;
          
          // Check if destination already exists
          const existing = this.app.vault.getAbstractFileByPath(destPath);
          if (!existing) {
            const data = await this.app.vault.readBinary(sourceFile);
            await this.app.vault.createBinary(destPath, data);
          }
        }
      }
    }
  }

  /**
   * Build a ThemeBackground object from a color string
   */
  private buildBackground(color: string | undefined, fallback: string): ThemeBackground {
    const c = color || fallback;
    return {
      type: 'solid',
      color: c,
    };
  }

  /**
   * Get CSS font-family value for a font name
   */
  private getFontCss(fontName: string): string {
    // Check if it's a cached Google Font
    if (this.fontManager?.isCached(fontName)) {
      return `'${fontName}', sans-serif`;
    }

    // Common system font stacks
    const fontStacks: Record<string, string> = {
      'Helvetica': 'Helvetica Neue, Helvetica, Arial, sans-serif',
      'Arial': 'Arial, Helvetica, sans-serif',
      'Georgia': 'Georgia, Times New Roman, serif',
      'Times New Roman': 'Times New Roman, Times, serif',
      'Courier': 'Courier New, Courier, monospace',
    };

    return fontStacks[fontName] || `'${fontName}', sans-serif`;
  }

  /**
   * Ensure a folder exists, creating it if necessary
   */
  private async ensureFolder(path: string): Promise<void> {
    const existing = this.app.vault.getAbstractFileByPath(path);
    if (existing instanceof TFolder) return;

    // Create parent folders if needed
    const parts = path.split('/');
    let currentPath = '';
    
    for (const part of parts) {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const folder = this.app.vault.getAbstractFileByPath(currentPath);
      if (!folder) {
        try {
          await this.app.vault.createFolder(currentPath);
        } catch (e) {
          // Folder might already exist (race condition)
          if (!(e instanceof Error && e.message.includes('Folder already exists'))) {
            throw e;
          }
        }
      }
    }
  }
}
