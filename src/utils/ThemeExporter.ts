import type { App } from 'obsidian';
import { TFile, TFolder, Modal, Setting, Notice, FileSystemAdapter } from 'obsidian';
import type { PresentationFrontmatter, Theme } from '../types';
import { ThemePreset, DEFAULT_SEMANTIC_COLORS } from '../types';
import type { ThemeJsonFile, ThemeModePreset, ThemeBackground } from '../themes/ThemeSchema';
import {
  ThemeSemanticColors,
  DEFAULT_SEMANTIC_COLORS_LIGHT,
  DEFAULT_SEMANTIC_COLORS_DARK,
} from '../themes/ThemeSchema';
import type { FontManager } from './FontManager';
import { getTheme } from '../themes';

/**
 * Represents an image reference found in markdown
 */
interface ImageReference {
  originalPath: string;
  isWikiLink: boolean;
  fullMatch: string;
}

/**
 * Modal dialog for saving a custom theme
 */
export class SaveThemeModal extends Modal {
  private themeName: string = '';
  private onSave: (name: string, overwrite: boolean) => Promise<void>;
  private existingThemes: string[];
  private customThemeNames: string[];
  private customThemesFolder: string;

  constructor(
    app: App,
    existingThemes: string[],
    customThemeNames: string[],
    customThemesFolder: string,
    onSave: (name: string, overwrite: boolean) => Promise<void>
  ) {
    super(app);
    this.existingThemes = existingThemes;
    this.customThemeNames = customThemeNames;
    this.customThemesFolder = customThemesFolder.replace(/\/$/, '') || 'perspecta-themes';
    this.onSave = onSave;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.addClass('perspecta-save-theme-modal');

    contentEl.createEl('h2', { text: 'Save as Custom Theme' });
    contentEl.createEl('p', {
      text: 'This will save all current settings (fonts, colors, typography, margins) as a reusable theme.',
      cls: 'modal-description',
    });

    new Setting(contentEl)
      .setName('Theme Name')
      .setDesc('Choose a unique name for your theme')
      .addText((text) => {
        text.setPlaceholder('My Custom Theme').onChange((value) => {
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
      const builtInConflict = this.existingThemes.some(
        (t) => t.toLowerCase() === normalizedName && !t.includes('(custom)')
      );

      if (builtInConflict) {
        new Notice(
          `A built-in theme named "${this.themeName}" exists. Your custom theme will be saved as "${this.themeName} (custom)".`
        );
      }

      // Check if theme folder actually exists right now (re-check, don't rely on cached state)
      const folderName = this.themeName.toLowerCase().replace(/\s+/g, '-');
      const themeFolderPath = `${this.customThemesFolder}/${folderName}`;
      const themeFolder = this.app.vault.getAbstractFileByPath(themeFolderPath);
      const folderActuallyExists = themeFolder instanceof TFolder;

      // Only show overwrite dialog if folder actually exists
      if (folderActuallyExists) {
        this.showOverwriteConfirmation(saveBtn, this.themeName);
        return;
      }

      await this.performSave(saveBtn, false);
    });
  }

  private showOverwriteConfirmation(saveBtn: HTMLButtonElement, themeName: string) {
    const { contentEl } = this;

    // Create confirmation dialog
    const confirmContainer = contentEl.createDiv({ cls: 'perspecta-confirm-overwrite' });
    confirmContainer.createEl('h3', { text: 'Confirm Update' });
    confirmContainer.createEl('p', {
      text: `A custom theme named "${themeName}" already exists. Do you want to update it with the new values and content?`,
      cls: 'modal-description',
    });

    const confirmFooter = confirmContainer.createDiv({ cls: 'modal-button-container' });

    const cancelConfirmBtn = confirmFooter.createEl('button', { text: 'Cancel' });
    cancelConfirmBtn.addEventListener('click', () => {
      confirmContainer.remove();
    });

    const confirmBtn = confirmFooter.createEl('button', { text: 'Update Theme', cls: 'mod-cta' });
    confirmBtn.addEventListener('click', async () => {
      confirmContainer.remove();
      await this.performSave(saveBtn, true);
    });
  }

  private async performSave(saveBtn: HTMLButtonElement, overwrite: boolean) {
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    try {
      await this.onSave(this.themeName, overwrite);
      this.close();
    } catch (e) {
      console.error('Failed to save theme:', e);
      new Notice(`Failed to save theme: ${e instanceof Error ? e.message : 'Unknown error'}`);
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Theme';
    }
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
    // Normalize path: remove trailing slash to avoid double slashes when concatenating
    this.customThemesFolder = (customThemesFolder || 'perspecta-themes').replace(/\/$/, '');
  }

  /**
   * Export the current presentation settings as a custom theme
   * @param themeName - Name for the custom theme
   * @param frontmatter - Presentation frontmatter with settings
   * @param markdownContent - Full markdown content of the presentation
   * @param sourceFile - Source file for resolving image paths
   * @param baseThemeName - Optional base theme name for fallback values
   * @param overwrite - Whether to overwrite existing theme
   */
  async exportTheme(
    themeName: string,
    frontmatter: PresentationFrontmatter,
    markdownContent: string,
    sourceFile: TFile,
    baseThemeName?: string,
    overwrite: boolean = false
  ): Promise<string> {
    // Get the base theme for fallback values
    const baseTheme = getTheme(baseThemeName || frontmatter.theme || '');
    const basePreset = baseTheme?.presets[0];

    // Create theme folder
    const folderName = themeName.toLowerCase().replace(/\s+/g, '-');
    const themePath = `${this.customThemesFolder}/${folderName}`;

    // If overwriting, delete and recreate the entire folder
    if (overwrite) {
      await this.deleteThemeFolderCompletely(themePath);
      // Wait for vault to process deletions
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    await this.ensureFolder(themePath);

    // Generate theme.json
    const themeJson = this.generateThemeJson(themeName, frontmatter, baseTheme);
    const themeJsonPath = `${themePath}/theme.json`;
    const themeJsonContent = JSON.stringify(themeJson, null, 2);
    await this.createOrModifyFile(themeJsonPath, themeJsonContent);

    // Generate theme.css with typography/margin defaults
    const themeCss = this.generateThemeCss(frontmatter, baseTheme);
    const themeCssPath = `${themePath}/theme.css`;
    await this.createOrModifyFile(themeCssPath, themeCss);

    // Copy fonts if using cached Google Fonts
    await this.copyFonts(themePath, frontmatter);

    // Extract and copy images, generate demo file
    const imageRefs = this.extractImageReferences(markdownContent);
    if (imageRefs.length > 0) {
      await this.copyImages(themePath, imageRefs, sourceFile);
    }

    // Create demo markdown file with COMPLETE frontmatter and updated image paths
    await this.createDemoFile(themePath, themeName, markdownContent, imageRefs, frontmatter);

    new Notice(`Theme "${themeName}" saved to ${themePath}`);
    return themePath;
  }

  /**
   * Completely delete an existing theme folder and all its contents
   * Recursively deletes all files and subfolders
   */
  private async deleteThemeFolderCompletely(themePath: string): Promise<void> {
    const folder = this.app.vault.getAbstractFileByPath(themePath);
    if (!(folder instanceof TFolder)) {
      return; // Folder doesn't exist, nothing to delete
    }

    // Recursively delete all children first
    const deleteRecursive = async (f: TFolder) => {
      const children = [...f.children]; // Create a copy of children array
      for (const child of children) {
        try {
          if (child instanceof TFolder) {
            await deleteRecursive(child);
          } else if (child instanceof TFile) {
            await this.app.vault.delete(child);
          }
        } catch (e) {
          console.warn(`Failed to delete ${child.path}:`, e);
        }
      }
    };

    // Delete all children
    await deleteRecursive(folder);

    // Finally, delete the folder itself
    try {
      await this.app.vault.delete(folder);
    } catch (e) {
      console.warn(`Failed to delete theme folder ${themePath}:`, e);
    }
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
        general: this.buildBackground(
          fm.lightBackground,
          basePreset?.LightBackgroundColor || '#ffffff'
        ),
        cover: this.buildBackground(
          fm.lightBgCover,
          fm.lightBackground || basePreset?.LightBackgroundColor || '#ffffff'
        ),
        title: this.buildBackground(
          fm.lightBgTitle,
          fm.lightBackground || basePreset?.LightBackgroundColor || '#ffffff'
        ),
        section: this.buildBackground(fm.lightBgSection, '#000000'),
      },
      semanticColors: {
        link: fm.lightLinkColor || basePreset?.LightLinkColor || DEFAULT_SEMANTIC_COLORS_LIGHT.link,
        bullet:
          fm.lightBulletColor ||
          basePreset?.LightBulletColor ||
          DEFAULT_SEMANTIC_COLORS_LIGHT.bullet,
        blockquoteBorder:
          fm.lightBlockquoteBorder ||
          basePreset?.LightBlockquoteBorder ||
          DEFAULT_SEMANTIC_COLORS_LIGHT.blockquoteBorder,
        tableHeaderBg:
          fm.lightTableHeaderBg ||
          basePreset?.LightTableHeaderBg ||
          DEFAULT_SEMANTIC_COLORS_LIGHT.tableHeaderBg,
        codeBorder:
          fm.lightCodeBorder ||
          basePreset?.LightCodeBorder ||
          DEFAULT_SEMANTIC_COLORS_LIGHT.codeBorder,
        progressBar:
          fm.lightProgressBar ||
          basePreset?.LightProgressBar ||
          DEFAULT_SEMANTIC_COLORS_LIGHT.progressBar,
      },
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
        general: this.buildBackground(
          fm.darkBackground,
          basePreset?.DarkBackgroundColor || '#1a1a1a'
        ),
        cover: this.buildBackground(
          fm.darkBgCover,
          fm.darkBackground || basePreset?.DarkBackgroundColor || '#1a1a1a'
        ),
        title: this.buildBackground(
          fm.darkBgTitle,
          fm.darkBackground || basePreset?.DarkBackgroundColor || '#1a1a1a'
        ),
        section: this.buildBackground(fm.darkBgSection, '#ffffff'),
      },
      semanticColors: {
        link: fm.darkLinkColor || basePreset?.DarkLinkColor || DEFAULT_SEMANTIC_COLORS_DARK.link,
        bullet:
          fm.darkBulletColor || basePreset?.DarkBulletColor || DEFAULT_SEMANTIC_COLORS_DARK.bullet,
        blockquoteBorder:
          fm.darkBlockquoteBorder ||
          basePreset?.DarkBlockquoteBorder ||
          DEFAULT_SEMANTIC_COLORS_DARK.blockquoteBorder,
        tableHeaderBg:
          fm.darkTableHeaderBg ||
          basePreset?.DarkTableHeaderBg ||
          DEFAULT_SEMANTIC_COLORS_DARK.tableHeaderBg,
        codeBorder:
          fm.darkCodeBorder ||
          basePreset?.DarkCodeBorder ||
          DEFAULT_SEMANTIC_COLORS_DARK.codeBorder,
        progressBar:
          fm.darkProgressBar ||
          basePreset?.DarkProgressBar ||
          DEFAULT_SEMANTIC_COLORS_DARK.progressBar,
      },
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
      description: `Custom theme created with Perspecta Slides`,
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
    } as ThemeJsonFile;
  }

  /**
    * Generate theme.css with COMPLETE set of ALL typography and margin parameters
    * Always includes every parameter with explicit values (from frontmatter or defaults)
    */
  private generateThemeCss(fm: PresentationFrontmatter, baseTheme: Theme | undefined): string {
    const lines: string[] = [
      `/* Custom Theme CSS - Complete Theme Parameters */`,
      `/* Generated from presentation settings - ALL parameters explicitly set */`,
      ``,
    ];

    const rootVars: string[] = [];

    // ===== TYPOGRAPHY - FONTS (weights) =====
    rootVars.push(`  /* Typography - Font Weights */`);
    rootVars.push(`  --title-font-weight: ${fm.titleFontWeight ?? 700};`);
    rootVars.push(`  --body-font-weight: ${fm.bodyFontWeight ?? 400};`);
    rootVars.push(`  --header-font-weight: ${fm.headerFontWeight ?? 400};`);
    rootVars.push(`  --footer-font-weight: ${fm.footerFontWeight ?? 400};`);
    rootVars.push(``);

    // ===== TYPOGRAPHY - FONT SIZES =====
    rootVars.push(`  /* Typography - Font Sizes (as percentage offset) */`);
    rootVars.push(`  --title-font-size-offset: ${fm.titleFontSize ?? -40};`);
    rootVars.push(`  --body-font-size-offset: ${fm.bodyFontSize ?? -20};`);
    rootVars.push(`  --header-font-size-offset: ${fm.headerFontSize ?? 0};`);
    rootVars.push(`  --footer-font-size-offset: ${fm.footerFontSize ?? 0};`);
    rootVars.push(`  --text-scale: ${fm.textScale ?? 1};`);
    rootVars.push(``);

    // ===== TYPOGRAPHY - SPACING =====
    rootVars.push(`  /* Typography - Spacing (in em) */`);
    rootVars.push(`  --headline-spacing-before: ${fm.headlineSpacingBefore ?? 0};`);
    rootVars.push(`  --headline-spacing-after: ${fm.headlineSpacingAfter ?? 1.3};`);
    rootVars.push(`  --list-item-spacing: ${fm.listItemSpacing ?? 1.2};`);
    rootVars.push(`  --line-height: ${fm.lineHeight ?? 1.2};`);
    rootVars.push(``);

    // ===== TYPOGRAPHY - MARGINS =====
    rootVars.push(`  /* Typography - Margins (in em, absolute distance from slide edge) */`);
    rootVars.push(`  --header-top: ${fm.headerTop ?? 3};`);
    rootVars.push(`  --footer-bottom: ${fm.footerBottom ?? 2.5};`);
    rootVars.push(`  --title-top: ${fm.titleTop ?? 6.4};`);
    rootVars.push(`  --content-top: ${fm.contentTop ?? 22};`);
    
    // Content margins: Support asymmetric left/right, with contentWidth as legacy fallback
    const contentLeft = fm.contentLeft ?? fm.contentWidth ?? 4;
    const contentRight = fm.contentRight ?? fm.contentWidth ?? 4;
    rootVars.push(`  --content-left: ${contentLeft};`);
    rootVars.push(`  --content-right: ${contentRight};`);
    
    // Legacy: still output --content-width for backwards compatibility
    if (fm.contentWidth !== undefined) {
      rootVars.push(`  --content-width: ${fm.contentWidth};`);
    }

    if (rootVars.length > 0) {
      lines.push(`:root {`);
      lines.push(...rootVars);
      lines.push(`}`);
      lines.push(``);
    }

    // Include base theme CSS if available
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
    if (!this.fontManager) {
      return;
    }

    const fontsFolder = `${themePath}/fonts`;
    const fontsToCopy = [fm.titleFont, fm.bodyFont, fm.headerFont, fm.footerFont].filter(
      (f): f is string => !!f && this.fontManager!.isCached(f)
    );

    if (fontsToCopy.length === 0) {
      return;
    }

    await this.ensureFolder(fontsFolder);

    for (const fontName of fontsToCopy) {
      const cachedFont = this.fontManager.getCachedFont(fontName);
      if (!cachedFont) {
        continue;
      }

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
      Helvetica: 'Helvetica Neue, Helvetica, Arial, sans-serif',
      Arial: 'Arial, Helvetica, sans-serif',
      Georgia: 'Georgia, Times New Roman, serif',
      'Times New Roman': 'Times New Roman, Times, serif',
      Courier: 'Courier New, Courier, monospace',
    };

    return fontStacks[fontName] || `'${fontName}', sans-serif`;
  }

  /**
   * Create a file or modify it if it already exists
   */
  private async createOrModifyFile(path: string, content: string): Promise<void> {
    const existing = this.app.vault.getAbstractFileByPath(path);
    if (existing instanceof TFile) {
      await this.app.vault.modify(existing, content);
    } else {
      await this.app.vault.create(path, content);
    }
  }

  /**
   * Ensure a folder exists, creating it and parent folders if necessary
   */
  private async ensureFolder(path: string): Promise<void> {
    const existing = this.app.vault.getAbstractFileByPath(path);
    if (existing instanceof TFolder) {
      return;
    }

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

  /**
   * Extract all image references from markdown content
   * Supports both standard markdown ![alt](path) and Obsidian wiki-links ![[path]]
   */
  private extractImageReferences(content: string): ImageReference[] {
    const refs: ImageReference[] = [];

    // Match standard markdown images: ![alt](path)
    const mdImageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
    let match;
    while ((match = mdImageRegex.exec(content)) !== null) {
      const path = match[2].split(/[#?]/)[0].trim(); // Remove anchors/queries
      if (path && !path.startsWith('http://') && !path.startsWith('https://')) {
        refs.push({
          originalPath: path,
          isWikiLink: false,
          fullMatch: match[0],
        });
      }
    }

    // Match Obsidian wiki-link images: ![[path]] or ![[path|alt]]
    const wikiImageRegex = /!\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g;
    while ((match = wikiImageRegex.exec(content)) !== null) {
      const path = match[1].split(/[#?]/)[0].trim();
      if (path && !path.startsWith('http://') && !path.startsWith('https://')) {
        refs.push({
          originalPath: path,
          isWikiLink: true,
          fullMatch: match[0],
        });
      }
    }

    return refs;
  }

  /**
   * Copy images to the theme folder with <themename>- prefix
   * Returns a map of original paths to new filenames
   */
  private async copyImages(
    themePath: string,
    imageRefs: ImageReference[],
    sourceFile: TFile
  ): Promise<Map<string, string>> {
    const pathMap = new Map<string, string>();
    const folderName = themePath.split('/').pop() || 'theme';

    for (const ref of imageRefs) {
      try {
        // Resolve the image file
        const decodedPath = decodeURIComponent(ref.originalPath);
        let imageFile = this.app.metadataCache.getFirstLinkpathDest(decodedPath, sourceFile.path);
        if (!imageFile) {
          imageFile = this.app.metadataCache.getFirstLinkpathDest(
            ref.originalPath,
            sourceFile.path
          );
        }

        if (imageFile instanceof TFile) {
          // Generate new filename with theme prefix
          const ext = imageFile.extension;
          const baseName = imageFile.basename;
          const newFileName = `${folderName}-${baseName}.${ext}`;
          const destPath = `${themePath}/${newFileName}`;

          // Check if already copied (same original path)
          if (!pathMap.has(ref.originalPath)) {
            // Check if destination exists
            const existing = this.app.vault.getAbstractFileByPath(destPath);
            if (!existing) {
              const data = await this.app.vault.readBinary(imageFile);
              await this.app.vault.createBinary(destPath, data);
            }
            pathMap.set(ref.originalPath, newFileName);
          }
        }
      } catch (e) {
        console.warn(`Failed to copy image: ${ref.originalPath}`, e);
      }
    }

    return pathMap;
  }

  /**
    * Create a demo markdown file with:
    * - COMPLETE frontmatter (all design parameters captured)
    * - Updated image paths pointing to local theme folder images
    */
  private async createDemoFile(
    themePath: string,
    themeName: string,
    markdownContent: string,
    imageRefs: ImageReference[],
    fm?: PresentationFrontmatter
  ): Promise<void> {
    const folderName = themePath.split('/').pop() || 'theme';

    // Build image path map from refs
    const pathMap = new Map<string, string>();
    for (const ref of imageRefs) {
      const baseName = ref.originalPath.split('/').pop()?.split('.')[0] || 'image';
      const ext = ref.originalPath.split('.').pop() || 'png';
      const newFileName = `${folderName}-${baseName}.${ext}`;
      pathMap.set(ref.originalPath, newFileName);
    }

    // Create complete frontmatter with all design parameters
    let demoFrontmatter = `---
  # Theme reference
  theme: ${folderName}
  `;

    // Add all available frontmatter parameters from source if provided
    if (fm) {
      if (fm.title) demoFrontmatter += `title: ${fm.title}\n`;
      if (fm.author) demoFrontmatter += `author: ${fm.author}\n`;
      if (fm.date) demoFrontmatter += `date: ${fm.date}\n`;
      if (fm.contentMode) demoFrontmatter += `contentMode: ${fm.contentMode}\n`;
      
      demoFrontmatter += `\n# Typography - Fonts\n`;
      if (fm.titleFont) demoFrontmatter += `titleFont: ${fm.titleFont}\n`;
      if (fm.titleFontWeight !== undefined) demoFrontmatter += `titleFontWeight: ${fm.titleFontWeight}\n`;
      if (fm.bodyFont) demoFrontmatter += `bodyFont: ${fm.bodyFont}\n`;
      if (fm.bodyFontWeight !== undefined) demoFrontmatter += `bodyFontWeight: ${fm.bodyFontWeight}\n`;
      if (fm.headerFont) demoFrontmatter += `headerFont: ${fm.headerFont}\n`;
      if (fm.headerFontWeight !== undefined) demoFrontmatter += `headerFontWeight: ${fm.headerFontWeight}\n`;
      if (fm.footerFont) demoFrontmatter += `footerFont: ${fm.footerFont}\n`;
      if (fm.footerFontWeight !== undefined) demoFrontmatter += `footerFontWeight: ${fm.footerFontWeight}\n`;
      
      demoFrontmatter += `\n# Typography - Font Sizes\n`;
      if (fm.titleFontSize !== undefined) demoFrontmatter += `titleFontSize: ${fm.titleFontSize}\n`;
      if (fm.bodyFontSize !== undefined) demoFrontmatter += `bodyFontSize: ${fm.bodyFontSize}\n`;
      if (fm.headerFontSize !== undefined) demoFrontmatter += `headerFontSize: ${fm.headerFontSize}\n`;
      if (fm.footerFontSize !== undefined) demoFrontmatter += `footerFontSize: ${fm.footerFontSize}\n`;
      if (fm.textScale !== undefined) demoFrontmatter += `textScale: ${fm.textScale}\n`;
      
      demoFrontmatter += `\n# Typography - Spacing\n`;
      if (fm.headlineSpacingBefore !== undefined) demoFrontmatter += `headlineSpacingBefore: ${fm.headlineSpacingBefore}\n`;
      if (fm.headlineSpacingAfter !== undefined) demoFrontmatter += `headlineSpacingAfter: ${fm.headlineSpacingAfter}\n`;
      if (fm.listItemSpacing !== undefined) demoFrontmatter += `listItemSpacing: ${fm.listItemSpacing}\n`;
      if (fm.lineHeight !== undefined) demoFrontmatter += `lineHeight: ${fm.lineHeight}\n`;
      
      demoFrontmatter += `\n# Typography - Margins\n`;
      if (fm.headerTop !== undefined) demoFrontmatter += `headerTop: ${fm.headerTop}\n`;
      if (fm.footerBottom !== undefined) demoFrontmatter += `footerBottom: ${fm.footerBottom}\n`;
      if (fm.titleTop !== undefined) demoFrontmatter += `titleTop: ${fm.titleTop}\n`;
      if (fm.contentTop !== undefined) demoFrontmatter += `contentTop: ${fm.contentTop}\n`;
      if (fm.contentLeft !== undefined) demoFrontmatter += `contentLeft: ${fm.contentLeft}\n`;
      if (fm.contentRight !== undefined) demoFrontmatter += `contentRight: ${fm.contentRight}\n`;
      
      demoFrontmatter += `\n# Colors - Light Mode\n`;
      if (fm.lightBackground) demoFrontmatter += `lightBackground: ${fm.lightBackground}\n`;
      if (fm.lightTitleText) demoFrontmatter += `lightTitleText: ${fm.lightTitleText}\n`;
      if (fm.lightBodyText) demoFrontmatter += `lightBodyText: ${fm.lightBodyText}\n`;
      if (fm.lightH1Color) demoFrontmatter += `lightH1Color: [${fm.lightH1Color.map(c => `'${c}'`).join(', ')}]\n`;
      if (fm.lightH2Color) demoFrontmatter += `lightH2Color: [${fm.lightH2Color.map(c => `'${c}'`).join(', ')}]\n`;
      if (fm.lightH3Color) demoFrontmatter += `lightH3Color: [${fm.lightH3Color.map(c => `'${c}'`).join(', ')}]\n`;
      if (fm.lightH4Color) demoFrontmatter += `lightH4Color: [${fm.lightH4Color.map(c => `'${c}'`).join(', ')}]\n`;
      if (fm.lightHeaderText) demoFrontmatter += `lightHeaderText: ${fm.lightHeaderText}\n`;
      if (fm.lightFooterText) demoFrontmatter += `lightFooterText: ${fm.lightFooterText}\n`;
      if (fm.lightBgCover) demoFrontmatter += `lightBgCover: ${fm.lightBgCover}\n`;
      if (fm.lightBgTitle) demoFrontmatter += `lightBgTitle: ${fm.lightBgTitle}\n`;
      if (fm.lightBgSection) demoFrontmatter += `lightBgSection: ${fm.lightBgSection}\n`;
      
      demoFrontmatter += `\n# Colors - Dark Mode\n`;
      if (fm.darkBackground) demoFrontmatter += `darkBackground: ${fm.darkBackground}\n`;
      if (fm.darkTitleText) demoFrontmatter += `darkTitleText: ${fm.darkTitleText}\n`;
      if (fm.darkBodyText) demoFrontmatter += `darkBodyText: ${fm.darkBodyText}\n`;
      if (fm.darkH1Color) demoFrontmatter += `darkH1Color: [${fm.darkH1Color.map(c => `'${c}'`).join(', ')}]\n`;
      if (fm.darkH2Color) demoFrontmatter += `darkH2Color: [${fm.darkH2Color.map(c => `'${c}'`).join(', ')}]\n`;
      if (fm.darkH3Color) demoFrontmatter += `darkH3Color: [${fm.darkH3Color.map(c => `'${c}'`).join(', ')}]\n`;
      if (fm.darkH4Color) demoFrontmatter += `darkH4Color: [${fm.darkH4Color.map(c => `'${c}'`).join(', ')}]\n`;
      if (fm.darkHeaderText) demoFrontmatter += `darkHeaderText: ${fm.darkHeaderText}\n`;
      if (fm.darkFooterText) demoFrontmatter += `darkFooterText: ${fm.darkFooterText}\n`;
      if (fm.darkBgCover) demoFrontmatter += `darkBgCover: ${fm.darkBgCover}\n`;
      if (fm.darkBgTitle) demoFrontmatter += `darkBgTitle: ${fm.darkBgTitle}\n`;
      if (fm.darkBgSection) demoFrontmatter += `darkBgSection: ${fm.darkBgSection}\n`;
      
      demoFrontmatter += `\n# Semantic Colors - Light Mode\n`;
      if (fm.lightLinkColor) demoFrontmatter += `lightLinkColor: ${fm.lightLinkColor}\n`;
      if (fm.lightBulletColor) demoFrontmatter += `lightBulletColor: ${fm.lightBulletColor}\n`;
      if (fm.lightBlockquoteBorder) demoFrontmatter += `lightBlockquoteBorder: ${fm.lightBlockquoteBorder}\n`;
      if (fm.lightTableHeaderBg) demoFrontmatter += `lightTableHeaderBg: ${fm.lightTableHeaderBg}\n`;
      if (fm.lightCodeBorder) demoFrontmatter += `lightCodeBorder: ${fm.lightCodeBorder}\n`;
      if (fm.lightProgressBar) demoFrontmatter += `lightProgressBar: ${fm.lightProgressBar}\n`;
      if (fm.lightBoldColor) demoFrontmatter += `lightBoldColor: ${fm.lightBoldColor}\n`;
      
      demoFrontmatter += `\n# Semantic Colors - Dark Mode\n`;
      if (fm.darkLinkColor) demoFrontmatter += `darkLinkColor: ${fm.darkLinkColor}\n`;
      if (fm.darkBulletColor) demoFrontmatter += `darkBulletColor: ${fm.darkBulletColor}\n`;
      if (fm.darkBlockquoteBorder) demoFrontmatter += `darkBlockquoteBorder: ${fm.darkBlockquoteBorder}\n`;
      if (fm.darkTableHeaderBg) demoFrontmatter += `darkTableHeaderBg: ${fm.darkTableHeaderBg}\n`;
      if (fm.darkCodeBorder) demoFrontmatter += `darkCodeBorder: ${fm.darkCodeBorder}\n`;
      if (fm.darkProgressBar) demoFrontmatter += `darkProgressBar: ${fm.darkProgressBar}\n`;
      if (fm.darkBoldColor) demoFrontmatter += `darkBoldColor: ${fm.darkBoldColor}\n`;
      
      demoFrontmatter += `\n# Dynamic Backgrounds\n`;
      if (fm.lightDynamicBackground && fm.lightDynamicBackground.length > 0) {
        demoFrontmatter += `lightDynamicBackground: [${fm.lightDynamicBackground.map(c => `'${c}'`).join(', ')}]\n`;
      }
      if (fm.darkDynamicBackground && fm.darkDynamicBackground.length > 0) {
        demoFrontmatter += `darkDynamicBackground: [${fm.darkDynamicBackground.map(c => `'${c}'`).join(', ')}]\n`;
      }
      if (fm.useDynamicBackground) demoFrontmatter += `useDynamicBackground: ${fm.useDynamicBackground}\n`;
      if (fm.dynamicBackgroundRestartAtSection !== undefined) demoFrontmatter += `dynamicBackgroundRestartAtSection: ${fm.dynamicBackgroundRestartAtSection}\n`;
      
      demoFrontmatter += `\n# Header/Footer & Logo\n`;
      if (fm.headerLeft) demoFrontmatter += `headerLeft: ${fm.headerLeft}\n`;
      if (fm.headerMiddle) demoFrontmatter += `headerMiddle: ${fm.headerMiddle}\n`;
      if (fm.headerRight) demoFrontmatter += `headerRight: ${fm.headerRight}\n`;
      if (fm.footerLeft) demoFrontmatter += `footerLeft: ${fm.footerLeft}\n`;
      if (fm.footerMiddle) demoFrontmatter += `footerMiddle: ${fm.footerMiddle}\n`;
      if (fm.footerRight) demoFrontmatter += `footerRight: ${fm.footerRight}\n`;
      if (fm.logo) demoFrontmatter += `logo: ${fm.logo}\n`;
      if (fm.logoSize) demoFrontmatter += `logoSize: ${fm.logoSize}\n`;
      
      demoFrontmatter += `\n# Presentation Settings\n`;
      if (fm.aspectRatio) demoFrontmatter += `aspectRatio: ${fm.aspectRatio}\n`;
      if (fm.lockAspectRatio !== undefined) demoFrontmatter += `lockAspectRatio: ${fm.lockAspectRatio}\n`;
      if (fm.showProgress !== undefined) demoFrontmatter += `showProgress: ${fm.showProgress}\n`;
      if (fm.showSlideNumbers !== undefined) demoFrontmatter += `showSlideNumbers: ${fm.showSlideNumbers}\n`;
      if (fm.transition) demoFrontmatter += `transition: ${fm.transition}\n`;
      if (fm.showFootnotesOnSlides !== undefined) demoFrontmatter += `showFootnotesOnSlides: ${fm.showFootnotesOnSlides}\n`;
      if (fm.enableObsidianLinks !== undefined) demoFrontmatter += `enableObsidianLinks: ${fm.enableObsidianLinks}\n`;
      if (fm.mode) demoFrontmatter += `mode: ${fm.mode}\n`;
    }
    
    demoFrontmatter += `---\n`;

    // Replace frontmatter with complete version
    let demoContent = markdownContent;
    const frontmatterRegex = /^---\s*\n[\s\S]*?\n---\s*\n/;

    if (frontmatterRegex.test(demoContent)) {
      demoContent = demoContent.replace(frontmatterRegex, demoFrontmatter);
    } else {
      demoContent = demoFrontmatter + demoContent;
    }

    // Update image references to use local paths
    for (const ref of imageRefs) {
      const newFileName = pathMap.get(ref.originalPath);
      if (newFileName) {
        if (ref.isWikiLink) {
          // Replace ![[original]] with ![[newFileName]]
          const escapedMatch = ref.fullMatch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const regex = new RegExp(escapedMatch, 'g');
          demoContent = demoContent.replace(regex, `![[${newFileName}]]`);
        } else {
          // Replace ![alt](original) with ![alt](newFileName)
          const escapedMatch = ref.fullMatch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const regex = new RegExp(escapedMatch, 'g');
          // Extract alt text from original match
          const altMatch = ref.fullMatch.match(/!\[([^\]]*)\]/);
          const alt = altMatch ? altMatch[1] : '';
          demoContent = demoContent.replace(regex, `![${alt}](${newFileName})`);
        }
      }
    }

    // Save demo file
    const demoPath = `${themePath}/${folderName}-demo.md`;
    await this.createOrModifyFile(demoPath, demoContent);
  }
}
