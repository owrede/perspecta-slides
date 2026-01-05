import { App, TFile, TFolder, Modal, Setting, Notice, FileSystemAdapter } from 'obsidian';
import { PresentationFrontmatter, Theme, ThemePreset, DEFAULT_SEMANTIC_COLORS } from '../types';
import { ThemeJsonFile, ThemeModePreset, ThemeBackground, ThemeSemanticColors, DEFAULT_SEMANTIC_COLORS_LIGHT, DEFAULT_SEMANTIC_COLORS_DARK } from '../themes/ThemeSchema';
import { FontManager } from './FontManager';
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

  constructor(app: App, existingThemes: string[], customThemeNames: string[], onSave: (name: string, overwrite: boolean) => Promise<void>) {
    super(app);
    this.existingThemes = existingThemes;
    this.customThemeNames = customThemeNames;
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

      // Check for existing custom theme with same name
      const customThemeExists = this.customThemeNames.some(t => 
        t.toLowerCase().replace(/\s+/g, '-') === normalizedName
      );
      
      let overwrite = false;
      if (customThemeExists) {
        if (!confirm(`A custom theme named "${this.themeName}" already exists. Do you want to overwrite it?`)) {
          return;
        }
        overwrite = true;
      }

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
    
    // If overwriting, delete existing theme folder first
    if (overwrite) {
      await this.deleteThemeFolder(themePath);
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
    
    // Create demo markdown file with updated image paths
    await this.createDemoFile(themePath, themeName, markdownContent, imageRefs);

    new Notice(`Theme "${themeName}" saved to ${themePath}`);
    return themePath;
  }

  /**
   * Delete an existing theme folder and all its contents
   */
  private async deleteThemeFolder(themePath: string): Promise<void> {
    const folder = this.app.vault.getAbstractFileByPath(themePath);
    if (folder instanceof TFolder) {
      const deleteRecursively = async (f: TFolder) => {
        for (const child of [...f.children]) {
          if (child instanceof TFolder) {
            await deleteRecursively(child);
          } else {
            await this.app.vault.delete(child);
          }
        }
        await this.app.vault.delete(f);
      };
      await deleteRecursively(folder);
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
        general: this.buildBackground(fm.lightBackground, basePreset?.LightBackgroundColor || '#ffffff'),
        cover: this.buildBackground(fm.lightBgCover, fm.lightBackground || basePreset?.LightBackgroundColor || '#ffffff'),
        title: this.buildBackground(fm.lightBgTitle, fm.lightBackground || basePreset?.LightBackgroundColor || '#ffffff'),
        section: this.buildBackground(fm.lightBgSection, '#000000'),
      },
      semanticColors: {
        link: fm.lightLinkColor || basePreset?.LightLinkColor || DEFAULT_SEMANTIC_COLORS_LIGHT.link,
        bullet: fm.lightBulletColor || basePreset?.LightBulletColor || DEFAULT_SEMANTIC_COLORS_LIGHT.bullet,
        blockquoteBorder: fm.lightBlockquoteBorder || basePreset?.LightBlockquoteBorder || DEFAULT_SEMANTIC_COLORS_LIGHT.blockquoteBorder,
        tableHeaderBg: fm.lightTableHeaderBg || basePreset?.LightTableHeaderBg || DEFAULT_SEMANTIC_COLORS_LIGHT.tableHeaderBg,
        codeBorder: fm.lightCodeBorder || basePreset?.LightCodeBorder || DEFAULT_SEMANTIC_COLORS_LIGHT.codeBorder,
        progressBar: fm.lightProgressBar || basePreset?.LightProgressBar || DEFAULT_SEMANTIC_COLORS_LIGHT.progressBar,
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
        general: this.buildBackground(fm.darkBackground, basePreset?.DarkBackgroundColor || '#1a1a1a'),
        cover: this.buildBackground(fm.darkBgCover, fm.darkBackground || basePreset?.DarkBackgroundColor || '#1a1a1a'),
        title: this.buildBackground(fm.darkBgTitle, fm.darkBackground || basePreset?.DarkBackgroundColor || '#1a1a1a'),
        section: this.buildBackground(fm.darkBgSection, '#ffffff'),
      },
      semanticColors: {
        link: fm.darkLinkColor || basePreset?.DarkLinkColor || DEFAULT_SEMANTIC_COLORS_DARK.link,
        bullet: fm.darkBulletColor || basePreset?.DarkBulletColor || DEFAULT_SEMANTIC_COLORS_DARK.bullet,
        blockquoteBorder: fm.darkBlockquoteBorder || basePreset?.DarkBlockquoteBorder || DEFAULT_SEMANTIC_COLORS_DARK.blockquoteBorder,
        tableHeaderBg: fm.darkTableHeaderBg || basePreset?.DarkTableHeaderBg || DEFAULT_SEMANTIC_COLORS_DARK.tableHeaderBg,
        codeBorder: fm.darkCodeBorder || basePreset?.DarkCodeBorder || DEFAULT_SEMANTIC_COLORS_DARK.codeBorder,
        progressBar: fm.darkProgressBar || basePreset?.DarkProgressBar || DEFAULT_SEMANTIC_COLORS_DARK.progressBar,
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
          imageFile = this.app.metadataCache.getFirstLinkpathDest(ref.originalPath, sourceFile.path);
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
   * - Clean frontmatter (only theme reference)
   * - Updated image paths pointing to local theme folder images
   */
  private async createDemoFile(
    themePath: string,
    themeName: string,
    markdownContent: string,
    imageRefs: ImageReference[]
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
    
    // Replace frontmatter with clean version (just theme reference)
    let demoContent = markdownContent;
    const frontmatterRegex = /^---\s*\n[\s\S]*?\n---\s*\n/;
    const cleanFrontmatter = `---
theme: ${folderName}
---
`;
    
    if (frontmatterRegex.test(demoContent)) {
      demoContent = demoContent.replace(frontmatterRegex, cleanFrontmatter);
    } else {
      demoContent = cleanFrontmatter + demoContent;
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
