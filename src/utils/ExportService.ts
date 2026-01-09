import { App, Notice, TFile, TFolder, FileSystemAdapter, Modal, Setting } from 'obsidian';
import { Presentation, Theme } from '../types';
import { SlideRenderer, ImagePathResolver } from '../renderer/SlideRenderer';
import { FontManager } from './FontManager';

/**
 * Confirmation modal for overwriting export folder
 */
class OverwriteConfirmModal extends Modal {
  private confirmed: boolean = false;
  private resolvePromise: ((value: boolean) => void) | null = null;

  constructor(app: App, private folderName: string) {
    super(app);
  }

  onOpen() {
    const { contentEl } = this;
    
    contentEl.createEl('h2', { text: 'Overwrite Export?' });
    contentEl.createEl('p', { 
      text: `The folder "${this.folderName}" already exists. Do you want to overwrite its contents?` 
    });
    
    new Setting(contentEl)
      .addButton(btn => btn
        .setButtonText('Cancel')
        .onClick(() => {
          this.confirmed = false;
          this.close();
        }))
      .addButton(btn => btn
        .setButtonText('Overwrite')
        .setWarning()
        .setCta()
        .onClick(() => {
          this.confirmed = true;
          this.close();
        }));
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
    if (this.resolvePromise) {
      this.resolvePromise(this.confirmed);
    }
  }

  async waitForConfirmation(): Promise<boolean> {
    return new Promise((resolve) => {
      this.resolvePromise = resolve;
      this.open();
    });
  }
}

interface ExtractedImage {
  originalPath: string;
  exportPath: string;
  file: TFile;
}

export class ExportService {
  constructor(
    private app: App,
    private fontManager: FontManager | null,
    private imagePathResolver: ImagePathResolver
  ) {}

  /**
   * Export presentation to folder with index.html and assets
   */
  async export(
    presentation: Presentation,
    theme: Theme | null,
    sourceFile: TFile,
    customFontCSS: string = ''
  ): Promise<void> {
    try {
      const renderer = new SlideRenderer(presentation, theme || undefined, this.imagePathResolver);
      renderer.setSystemColorScheme(this.getSystemColorScheme());
      if (customFontCSS) {
        renderer.setCustomFontCSS(customFontCSS);
      }

      // Check if export folder already exists
      const folderName = `${sourceFile.basename.replace(/\.md$/, '')}-export`;
      const parentPath = sourceFile.parent?.path || '';
      const exportPath = parentPath ? `${parentPath}/${folderName}` : folderName;
      
      console.log('[Export] Checking for existing folder:', exportPath);
      
      // Check using adapter.exists for more reliable detection
      const folderExists = await this.app.vault.adapter.exists(exportPath);
      console.log('[Export] Folder exists:', folderExists);
      
      if (folderExists) {
        // Folder exists - ask for confirmation
        const modal = new OverwriteConfirmModal(this.app, folderName);
        const confirmed = await modal.waitForConfirmation();
        if (!confirmed) {
          new Notice('Export cancelled');
          return;
        }
      }
      
      // Create export folder (or use existing)
      const exportFolder = await this.getOrCreateExportFolder(exportPath);

      // Track extracted images
      const extractedImages: ExtractedImage[] = [];

      // Render all slides and extract images
      const slides = await Promise.all(
        presentation.slides.map(async (slide, idx) => {
          let html = renderer.renderPresentationSlideHTML(slide, idx);
          
          // Inject theme CSS variables and toggle CSS into each slide's HTML
          html = this.injectThemeCSSVariables(html, theme);
          html = this.injectThemeToggleCSS(html);
          
          const { html: processedHtml, images } = await this.extractImagesFromHTML(
            html,
            exportPath
          );
          extractedImages.push(...images);
          return {
            html: processedHtml,
            speakerNotes: slide.speakerNotes || []
          };
        })
      );

      // Copy unique images to export folder
      const uniqueImages = extractedImages.filter((img, idx, arr) => 
        arr.findIndex(i => i.originalPath === img.originalPath) === idx
      );
      await this.copyImages(uniqueImages);

      // Get theme variables
      const themeCSS = this.generateThemeCSS(theme);

      // Get font CSS with embedded fonts
      const fontCSS = await this.generateEmbeddedFontCSS(customFontCSS);

      // Generate HTML
      const html = this.generateHTML(
        presentation,
        slides,
        themeCSS,
        fontCSS,
        presentation.frontmatter.aspectRatio,
        presentation.frontmatter.lockAspectRatio
      );

      // Write index.html
      await this.app.vault.adapter.write(
        `${exportPath}/index.html`,
        html
      );

      new Notice(`Presentation exported to ${folderName}/`);
    } catch (error) {
      console.error('Export failed:', error);
      new Notice(`Failed to export presentation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Export a test page for debugging theme colors
   */
  async exportTestPage(theme: Theme | null): Promise<void> {
    try {
      const html = this.generateThemeTestHTML(theme);
      
      // Write to Obsidian vault root
      const testFile = 'perspecta-theme-test.html';
      await this.app.vault.adapter.write(testFile, html);
      
      new Notice(`Theme test page exported to ${testFile}`);
    } catch (error) {
      console.error('Test export failed:', error);
      new Notice(`Failed to export test page: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get or create export folder
   */
  private async getOrCreateExportFolder(folderPath: string): Promise<TFolder> {
    // Check if folder already exists
    const existing = this.app.vault.getAbstractFileByPath(folderPath);
    if (existing instanceof TFolder) {
      console.log('[Export] Using existing folder:', folderPath);
      return existing;
    }

    // Check via adapter as fallback
    const existsOnDisk = await this.app.vault.adapter.exists(folderPath);
    if (existsOnDisk) {
      console.log('[Export] Folder exists on disk but not in vault cache, creating via adapter');
      // Folder exists on disk, just ensure we have a reference
      // Try to get it from vault after a small delay for cache sync
      await new Promise(resolve => setTimeout(resolve, 100));
      const folder = this.app.vault.getAbstractFileByPath(folderPath);
      if (folder instanceof TFolder) {
        return folder;
      }
      // If still not found, the folder exists on disk - we can use it
      // Create a minimal folder reference by creating a temp file and getting parent
      // Actually, just proceed - the adapter.write will work even without TFolder reference
      return { path: folderPath } as TFolder;
    }

    // Folder doesn't exist, create it
    console.log('[Export] Creating new folder:', folderPath);
    return await this.app.vault.createFolder(folderPath);
  }

  /**
   * Inject theme CSS variables into slide HTML
   * Creates :root CSS variables with all color definitions and maps generic variable names
   * Generic names (--background, --body-text, etc.) are remapped based on html.light/html.dark class
   * This enables theme toggle to work by changing a single class instead of updating multiple variables
   * Includes per-heading colors and layout backgrounds from theme.json if available
   */
  private injectThemeCSSVariables(html: string, theme: Theme | null): string {
    if (!theme) return html;

    const preset = theme.presets[0];
    if (!preset) return html;

    const themeJson = theme.themeJsonData;
    
    // FIX: Replace .slide.light and .slide.dark selectors with html.light and html.dark
    // because in exported iframes, there's no .slide container - the html element acts as the root
    html = html.replace(/\.slide\.light\b/g, 'html.light');
    html = html.replace(/\.slide\.dark\b/g, 'html.dark');
    
    // Ensure the <html> element has the dark class for iframes (default to dark mode)
    // This ensures CSS rules for html.dark match on initial iframe load
    if (!html.includes('<html') && !html.includes('<HTML')) {
      html = '<html class="dark">\n' + html + '\n</html>';
    } else if (html.includes('<html') && !html.match(/<html[^>]*class=/)) {
      // Add dark class if html tag exists but has no class attribute
      html = html.replace(/<html/, '<html class="dark"');
    } else if (html.includes('<html') && html.match(/<html[^>]*class="([^"]*)"(?=[^>]*>)/)) {
      // Add dark class if html tag exists with class but doesn't have dark or light
      html = html.replace(/<html([^>]*class=")([^"]*)"(?=[^>]*>)/, (match, p1, p2) => {
        if (!p2.includes('dark') && !p2.includes('light')) {
          return p1 + 'dark ' + p2 + '"';
        }
        return match;
      });
    }
    
    // Helper function to convert color array to CSS value
    const colorToCss = (colors: string[] | string | undefined): string => {
      if (!colors) return 'inherit';
      if (typeof colors === 'string') return colors;
      if (Array.isArray(colors)) {
        if (colors.length === 0) return 'inherit';
        if (colors.length === 1) return colors[0];
        return `linear-gradient(to right, ${colors.join(', ')})`;
      }
      return 'inherit';
    };

    // Build light mode heading colors
    let lightH1 = preset.LightTitleTextColor;
    let lightH2 = preset.LightTitleTextColor;
    let lightH3 = preset.LightBodyTextColor;
    let lightH4 = preset.LightBodyTextColor;
    if (themeJson?.presets.light.text) {
      lightH1 = colorToCss(themeJson.presets.light.text.h1);
      lightH2 = colorToCss(themeJson.presets.light.text.h2);
      lightH3 = colorToCss(themeJson.presets.light.text.h3);
      lightH4 = colorToCss(themeJson.presets.light.text.h4);
    }

    // Build dark mode heading colors
    let darkH1 = preset.DarkTitleTextColor;
    let darkH2 = preset.DarkTitleTextColor;
    let darkH3 = preset.DarkBodyTextColor;
    let darkH4 = preset.DarkBodyTextColor;
    if (themeJson?.presets.dark.text) {
      darkH1 = colorToCss(themeJson.presets.dark.text.h1);
      darkH2 = colorToCss(themeJson.presets.dark.text.h2);
      darkH3 = colorToCss(themeJson.presets.dark.text.h3);
      darkH4 = colorToCss(themeJson.presets.dark.text.h4);
    }

    // Build layout backgrounds (light mode)
    let lightBgCover = 'inherit';
    let lightBgTitle = 'inherit';
    let lightBgSection = 'inherit';
    if (themeJson?.presets.light.backgrounds) {
      const bg = themeJson.presets.light.backgrounds;
      lightBgCover = bg.cover?.type === 'solid' && bg.cover.color ? bg.cover.color : 
                     (bg.cover?.colors ? `linear-gradient(135deg, ${bg.cover.colors.join(', ')})` : 'inherit');
      lightBgTitle = bg.title?.type === 'solid' && bg.title.color ? bg.title.color : 
                     (bg.title?.colors ? `linear-gradient(135deg, ${bg.title.colors.join(', ')})` : 'inherit');
      lightBgSection = bg.section?.type === 'solid' && bg.section.color ? bg.section.color : 
                       (bg.section?.colors ? `linear-gradient(135deg, ${bg.section.colors.join(', ')})` : 'inherit');
    }

    // Build layout backgrounds (dark mode)
    let darkBgCover = 'inherit';
    let darkBgTitle = 'inherit';
    let darkBgSection = 'inherit';
    if (themeJson?.presets.dark.backgrounds) {
      const bg = themeJson.presets.dark.backgrounds;
      darkBgCover = bg.cover?.type === 'solid' && bg.cover.color ? bg.cover.color : 
                    (bg.cover?.colors ? `linear-gradient(135deg, ${bg.cover.colors.join(', ')})` : 'inherit');
      darkBgTitle = bg.title?.type === 'solid' && bg.title.color ? bg.title.color : 
                    (bg.title?.colors ? `linear-gradient(135deg, ${bg.title.colors.join(', ')})` : 'inherit');
      darkBgSection = bg.section?.type === 'solid' && bg.section.color ? bg.section.color : 
                      (bg.section?.colors ? `linear-gradient(135deg, ${bg.section.colors.join(', ')})` : 'inherit');
    }

    const variablesCSS = `
    <style>
      :root {
        --light-background: ${preset.LightBackgroundColor};
        --dark-background: ${preset.DarkBackgroundColor};
        --light-body-text: ${preset.LightBodyTextColor};
        --dark-body-text: ${preset.DarkBodyTextColor};
        --light-title-text: ${preset.LightTitleTextColor};
        --dark-title-text: ${preset.DarkTitleTextColor};
        --light-h1-color: ${lightH1};
        --dark-h1-color: ${darkH1};
        --light-h2-color: ${lightH2};
        --dark-h2-color: ${darkH2};
        --light-h3-color: ${lightH3};
        --dark-h3-color: ${darkH3};
        --light-h4-color: ${lightH4};
        --dark-h4-color: ${darkH4};
        --light-link-color: ${preset.LightLinkColor};
        --dark-link-color: ${preset.DarkLinkColor};
        --light-bullet-color: ${preset.LightBulletColor};
        --dark-bullet-color: ${preset.DarkBulletColor};
        --light-blockquote-border: ${preset.LightBlockquoteBorder};
        --dark-blockquote-border: ${preset.DarkBlockquoteBorder};
        --light-table-header-bg: ${preset.LightTableHeaderBg};
        --dark-table-header-bg: ${preset.DarkTableHeaderBg};
        --light-code-border: ${preset.LightCodeBorder};
        --dark-code-border: ${preset.DarkCodeBorder};
        --light-progress-bar: ${preset.LightProgressBar};
        --dark-progress-bar: ${preset.DarkProgressBar};
        --light-bg-cover: ${lightBgCover};
        --dark-bg-cover: ${darkBgCover};
        --light-bg-title: ${lightBgTitle};
        --dark-bg-title: ${darkBgTitle};
        --light-bg-section: ${lightBgSection};
        --dark-bg-section: ${darkBgSection};
        --title-font: ${theme.template.TitleFont};
        --body-font: ${theme.template.BodyFont};
        
        /* Default to dark mode variables */
        --background: var(--dark-background);
        --body-text: var(--dark-body-text);
        --title-text: var(--dark-title-text);
        --h1-color: var(--dark-h1-color);
        --h2-color: var(--dark-h2-color);
        --h3-color: var(--dark-h3-color);
        --h4-color: var(--dark-h4-color);
        --link-color: var(--dark-link-color);
        --bullet-color: var(--dark-bullet-color);
        --blockquote-border: var(--dark-blockquote-border);
        --table-header-bg: var(--dark-table-header-bg);
        --code-border: var(--dark-code-border);
        --progress-bar: var(--dark-progress-bar);
        --bg-cover: var(--dark-bg-cover);
        --bg-title: var(--dark-bg-title);
        --bg-section: var(--dark-bg-section);
      }

      /* Light mode mappings */
      html.light {
        --background: var(--light-background);
        --body-text: var(--light-body-text);
        --title-text: var(--light-title-text);
        --h1-color: var(--light-h1-color);
        --h2-color: var(--light-h2-color);
        --h3-color: var(--light-h3-color);
        --h4-color: var(--light-h4-color);
        --link-color: var(--light-link-color);
        --bullet-color: var(--light-bullet-color);
        --blockquote-border: var(--light-blockquote-border);
        --table-header-bg: var(--light-table-header-bg);
        --code-border: var(--light-code-border);
        --progress-bar: var(--light-progress-bar);
        --bg-cover: var(--light-bg-cover);
        --bg-title: var(--light-bg-title);
        --bg-section: var(--light-bg-section);
      }
    </style>`;

    // Insert variables right after <head>
    const updated = html.replace('<head>', `<head>\n${variablesCSS}`);
    if (updated === html) {
      console.warn('Failed to inject theme CSS variables - no <head> tag found or replace failed');
    }
    return updated;
  }

  /**
   * Inject theme toggle CSS into slide HTML
   * Applies element-level CSS rules that force colors on all HTML elements
   * Works in conjunction with CSS variable mappings from injectThemeCSSVariables()
   * Uses descendant selectors (space) not child selectors (>) to reach ALL nested elements
   * All rules use !important to override inline styles and ensure toggle works reliably
   */
  private injectThemeToggleCSS(html: string): string {
   const themeToggleCSS = `
   <style>
     /* Color scheme helpers for browser defaults */
     html.dark {
       color-scheme: dark;
     }
     html.light {
       color-scheme: light;
     }
      
      /* Dark: Body and root container */
      html.dark body,
      html.dark {
        background-color: var(--dark-background, #000) !important;
        color: var(--dark-body-text, #fff) !important;
      }
      
      /* Dark: ALL text elements using descendant selector (space, not >) */
      html.dark p,
      html.dark span,
      html.dark div,
      html.dark li,
      html.dark td,
      html.dark th,
      html.dark em,
      html.dark strong,
      html.dark b,
      html.dark i {
        color: var(--dark-body-text, #fff) !important;
      }
      
      /* Dark: Headings - per-heading color support */
      html.dark h1 {
        color: var(--dark-h1-color, var(--dark-title-text, #fff)) !important;
      }
      html.dark h2 {
        color: var(--dark-h2-color, var(--dark-title-text, #fff)) !important;
      }
      html.dark h3 {
        color: var(--dark-h3-color, var(--dark-body-text, #fff)) !important;
      }
      html.dark h4 {
        color: var(--dark-h4-color, var(--dark-body-text, #fff)) !important;
      }
      html.dark h5 {
        color: var(--dark-h4-color, var(--dark-body-text, #fff)) !important;
      }
      html.dark h6 {
        color: var(--dark-body-text, #fff) !important;
      }
      
      /* Dark: Links and interactive */
      html.dark a {
        color: var(--dark-link-color, #4a9eff) !important;
      }
      
      /* Dark: Lists */
      html.dark ul li:before,
      html.dark ol li:before {
        color: var(--dark-bullet-color, #4a9eff) !important;
      }
      
      /* Dark: Blockquotes */
      html.dark blockquote {
        border-color: var(--dark-blockquote-border, #666) !important;
        color: var(--dark-body-text, #fff) !important;
      }
      
      /* Dark: Code */
      html.dark code,
      html.dark pre {
        border-color: var(--dark-code-border, #666) !important;
        color: var(--dark-body-text, #fff) !important;
      }
      
      /* Dark: Tables */
      html.dark table {
        color: var(--dark-body-text, #fff) !important;
      }
      html.dark table thead {
        background-color: var(--dark-table-header-bg, #333) !important;
        color: var(--dark-body-text, #fff) !important;
      }
      html.dark table tbody tr {
        color: var(--dark-body-text, #fff) !important;
      }
      
      /* Dark: All container divs (excluding dynamic background slides) */
      html.dark .cover-container:not([data-light-bg]),
      html.dark .title-container:not([data-light-bg]),
      html.dark .section-container:not([data-light-bg]),
      html.dark .image-container:not([data-light-bg]),
      html.dark .split-container:not([data-light-bg]),
      html.dark .split-horizontal-container:not([data-light-bg]),
      html.dark .caption-container:not([data-light-bg]),
      html.dark .grid-container:not([data-light-bg]),
      html.dark .columns-container:not([data-light-bg]),
      html.dark .default-container:not([data-light-bg]),
      html.dark section:not([data-light-bg]),
      html.dark .slide:not([data-light-bg]) {
        background-color: var(--dark-background, #000) !important;
        color: var(--dark-body-text, #fff) !important;
      }
      
      /* Dark: Slides with dynamic backgrounds - only set text color, bg is set via JS */
      html.dark .slide[data-light-bg] {
        color: var(--dark-body-text, #fff) !important;
      }
      
      /* Dark: Layout-specific backgrounds (excluding dynamic background slides) */
      html.dark .cover-container:not([data-light-bg]) {
        background: var(--dark-bg-cover, var(--dark-background, #000)) !important;
      }
      html.dark .title-container:not([data-light-bg]) {
        background: var(--dark-bg-title, var(--dark-background, #000)) !important;
      }
      html.dark .section-container:not([data-light-bg]) {
        background: var(--dark-bg-section, var(--dark-background, #000)) !important;
      }
      
      /* Dark: Slide structural elements (header, body, footer, content) */
      html.dark .slide-header,
      html.dark .slide-footer,
      html.dark .slide-body,
      html.dark .slide-content,
      html.dark .slide-overlay {
        color: var(--dark-body-text, #fff) !important;
      }
      
      /* Dark: Half-image layout panels (excluding dynamic background) */
      html.dark .half-image-panel {
        background: transparent !important;
      }
      html.dark .half-content-panel:not([data-light-bg]),
      html.dark .half-content-panel:not([data-light-bg]) .slide-header,
      html.dark .half-content-panel:not([data-light-bg]) .slide-footer,
      html.dark .half-content-panel:not([data-light-bg]) .slide-body,
      html.dark .half-content-panel:not([data-light-bg]) .slide-content {
        background-color: var(--dark-background, #000) !important;
        color: var(--dark-body-text, #fff) !important;
      }
      
      /* Dark: Slot-based layouts (columns, grids) */
      html.dark .slot-header,
      html.dark .slot-columns,
      html.dark .column {
        color: var(--dark-body-text, #fff) !important;
      }
      
      /* Dark: Image containers and slots */
      html.dark .image-slot,
      html.dark .slide-image-background {
        background: transparent !important;
      }
      
      /* ============================================
         LIGHT MODE - html.light class
         ============================================ */
      html.light {
        color-scheme: light;
      }
      
      /* Light: Body and root container */
      html.light body,
      html.light {
        background-color: var(--light-background, #fff) !important;
        color: var(--light-body-text, #000) !important;
      }
      
      /* Light: ALL text elements using descendant selector (space, not >) */
      html.light p,
      html.light span,
      html.light div,
      html.light li,
      html.light td,
      html.light th,
      html.light em,
      html.light strong,
      html.light b,
      html.light i {
        color: var(--light-body-text, #000) !important;
      }
      
      /* Light: Headings - per-heading color support */
      html.light h1 {
        color: var(--light-h1-color, var(--light-title-text, #000)) !important;
      }
      html.light h2 {
        color: var(--light-h2-color, var(--light-title-text, #000)) !important;
      }
      html.light h3 {
        color: var(--light-h3-color, var(--light-body-text, #000)) !important;
      }
      html.light h4 {
        color: var(--light-h4-color, var(--light-body-text, #000)) !important;
      }
      html.light h5 {
        color: var(--light-h4-color, var(--light-body-text, #000)) !important;
      }
      html.light h6 {
        color: var(--light-body-text, #000) !important;
      }
      
      /* Light: Links and interactive */
      html.light a {
        color: var(--light-link-color, #0066cc) !important;
      }
      
      /* Light: Lists */
      html.light ul li:before,
      html.light ol li:before {
        color: var(--light-bullet-color, #0066cc) !important;
      }
      
      /* Light: Blockquotes */
      html.light blockquote {
        border-color: var(--light-blockquote-border, #ccc) !important;
        color: var(--light-body-text, #000) !important;
      }
      
      /* Light: Code */
      html.light code,
      html.light pre {
        border-color: var(--light-code-border, #ccc) !important;
        color: var(--light-body-text, #000) !important;
      }
      
      /* Light: Tables */
      html.light table {
        color: var(--light-body-text, #000) !important;
      }
      html.light table thead {
        background-color: var(--light-table-header-bg, #f0f0f0) !important;
        color: var(--light-body-text, #000) !important;
      }
      html.light table tbody tr {
        color: var(--light-body-text, #000) !important;
      }
      
      /* Light: All container divs (excluding dynamic background slides) */
      html.light .cover-container:not([data-light-bg]),
      html.light .title-container:not([data-light-bg]),
      html.light .section-container:not([data-light-bg]),
      html.light .image-container:not([data-light-bg]),
      html.light .split-container:not([data-light-bg]),
      html.light .split-horizontal-container:not([data-light-bg]),
      html.light .caption-container:not([data-light-bg]),
      html.light .grid-container:not([data-light-bg]),
      html.light .columns-container:not([data-light-bg]),
      html.light .default-container:not([data-light-bg]),
      html.light section:not([data-light-bg]),
      html.light .slide:not([data-light-bg]) {
        background-color: var(--light-background, #fff) !important;
        color: var(--light-body-text, #000) !important;
      }
      
      /* Light: Slides with dynamic backgrounds - only set text color, bg is set via JS */
      html.light .slide[data-light-bg] {
        color: var(--light-body-text, #000) !important;
      }
      
      /* Light: Layout-specific backgrounds (excluding dynamic background slides) */
      html.light .cover-container:not([data-light-bg]) {
        background: var(--light-bg-cover, var(--light-background, #fff)) !important;
      }
      html.light .title-container:not([data-light-bg]) {
        background: var(--light-bg-title, var(--light-background, #fff)) !important;
      }
      html.light .section-container:not([data-light-bg]) {
        background: var(--light-bg-section, var(--light-background, #fff)) !important;
      }
      
      /* Light: Slide structural elements (header, body, footer, content) */
      html.light .slide-header,
      html.light .slide-footer,
      html.light .slide-body,
      html.light .slide-content,
      html.light .slide-overlay {
        color: var(--light-body-text, #000) !important;
      }
      
      /* Light: Half-image layout panels (excluding dynamic background) */
      html.light .half-image-panel {
        background: transparent !important;
      }
      html.light .half-content-panel:not([data-light-bg]),
      html.light .half-content-panel:not([data-light-bg]) .slide-header,
      html.light .half-content-panel:not([data-light-bg]) .slide-footer,
      html.light .half-content-panel:not([data-light-bg]) .slide-body,
      html.light .half-content-panel:not([data-light-bg]) .slide-content {
        background-color: var(--light-background, #fff) !important;
        color: var(--light-body-text, #000) !important;
      }
      
      /* Light: Slot-based layouts (columns, grids) */
      html.light .slot-header,
      html.light .slot-columns,
      html.light .column {
        color: var(--light-body-text, #000) !important;
      }
      
      /* Light: Image containers and slots */
      html.light .image-slot,
      html.light .slide-image-background {
        background: transparent !important;
      }
      
      /* ============================================
         PER-SLIDE MODE OVERRIDES
         ============================================ */
      /* Override: Slides with local dark mode should stay dark when html is light */
      html.light .slide.dark {
        background-color: var(--dark-background, #000) !important;
        color: var(--dark-body-text, #fff) !important;
      }
      html.light .slide.dark p,
      html.light .slide.dark span,
      html.light .slide.dark div,
      html.light .slide.dark li,
      html.light .slide.dark td,
      html.light .slide.dark th {
        color: var(--dark-body-text, #fff) !important;
      }
      html.light .slide.dark h1 { color: var(--dark-h1-color, var(--dark-title-text, #fff)) !important; }
      html.light .slide.dark h2 { color: var(--dark-h2-color, var(--dark-title-text, #fff)) !important; }
      html.light .slide.dark h3 { color: var(--dark-h3-color, var(--dark-body-text, #fff)) !important; }
      html.light .slide.dark h4 { color: var(--dark-h4-color, var(--dark-body-text, #fff)) !important; }
      html.light .slide.dark h5 { color: var(--dark-h4-color, var(--dark-body-text, #fff)) !important; }
      html.light .slide.dark h6 { color: var(--dark-body-text, #fff) !important; }
      html.light .slide.dark a { color: var(--dark-link-color, #4a9eff) !important; }
      html.light .slide.dark blockquote { border-color: var(--dark-blockquote-border, #666) !important; color: var(--dark-body-text, #fff) !important; }
      html.light .slide.dark code { color: var(--dark-body-text, #fff) !important; }
      html.light .slide.dark table { color: var(--dark-body-text, #fff) !important; }
      html.light .slide.dark table thead { background-color: var(--dark-table-header-bg, #333) !important; color: var(--dark-body-text, #fff) !important; }
      html.light .slide.dark .half-content-panel { background-color: var(--dark-background, #000) !important; color: var(--dark-body-text, #fff) !important; }
      
      /* Override: Slides with local light mode should stay light when html is dark */
      html.dark .slide.light {
        background-color: var(--light-background, #fff) !important;
        color: var(--light-body-text, #000) !important;
      }
      html.dark .slide.light p,
      html.dark .slide.light span,
      html.dark .slide.light div,
      html.dark .slide.light li,
      html.dark .slide.light td,
      html.dark .slide.light th {
        color: var(--light-body-text, #000) !important;
      }
      html.dark .slide.light h1 { color: var(--light-h1-color, var(--light-title-text, #000)) !important; }
      html.dark .slide.light h2 { color: var(--light-h2-color, var(--light-title-text, #000)) !important; }
      html.dark .slide.light h3 { color: var(--light-h3-color, var(--light-body-text, #000)) !important; }
      html.dark .slide.light h4 { color: var(--light-h4-color, var(--light-body-text, #000)) !important; }
      html.dark .slide.light h5 { color: var(--light-h4-color, var(--light-body-text, #000)) !important; }
      html.dark .slide.light h6 { color: var(--light-body-text, #000) !important; }
      html.dark .slide.light a { color: var(--light-link-color, #0066cc) !important; }
      html.dark .slide.light blockquote { border-color: var(--light-blockquote-border, #ccc) !important; color: var(--light-body-text, #000) !important; }
      html.dark .slide.light code { color: var(--light-body-text, #000) !important; }
      html.dark .slide.light table { color: var(--light-body-text, #000) !important; }
      html.dark .slide.light table thead { background-color: var(--light-table-header-bg, #f0f0f0) !important; color: var(--light-body-text, #000) !important; }
      html.dark .slide.light .half-content-panel { background-color: var(--light-background, #fff) !important; color: var(--light-body-text, #000) !important; }
    </style>
    `;
    
    // Inject the CSS before the closing </head> tag
    return html.replace('</head>', `${themeToggleCSS}</head>`);
  }

  /**
   * Extract image references and prepare for copying
   */
  private async extractImagesFromHTML(
    html: string,
    exportPath: string
  ): Promise<{ html: string; images: ExtractedImage[] }> {
    const imgRegex = /<img[^>]+src="([^"]+)"[^>]*>/g;
    let match;
    const replacements: Array<[string, string]> = [];
    const images: ExtractedImage[] = [];

    while ((match = imgRegex.exec(html)) !== null) {
      const src = match[1];
      try {
        const result = await this.processImageReference(src, exportPath);
        if (result) {
          replacements.push([`src="${src}"`, `src="${result.exportPath}"`]);
          images.push(result);
        }
      } catch (e) {
        console.warn(`Failed to process image: ${src}`, e);
      }
    }

    let result = html;
    for (const [from, to] of replacements) {
      result = result.replace(from, to);
    }
    return { html: result, images };
  }

  /**
   * Process image reference and return export info
   */
  private async processImageReference(
    src: string,
    exportPath: string
  ): Promise<ExtractedImage | null> {
    try {
      // Skip URLs
      if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:')) {
        return null;
      }

      // Try to resolve file
      let filePath = src;
      if (filePath.startsWith('file://')) {
        filePath = filePath.replace(/^file:\/\//, '');
      }

      // Try to get file from vault
      const file = this.app.vault.getAbstractFileByPath(filePath);
      if (!file || !(file instanceof TFile)) {
        return null;
      }

      // Create images subdirectory path
      const filename = file.name;
      const relativeExportPath = `images/${filename}`;

      return {
        originalPath: filePath,
        exportPath: relativeExportPath,
        file
      };
    } catch (e) {
      console.warn(`Failed to process image reference: ${src}`, e);
      return null;
    }
  }

  /**
   * Copy images to export folder
   */
  private async copyImages(images: ExtractedImage[]): Promise<void> {
    if (!(this.app.vault.adapter instanceof FileSystemAdapter)) {
      console.warn('Export only works with filesystem-based vaults');
      return;
    }

    const basePath = (this.app.vault.adapter as any).basePath;

    for (const img of images) {
      try {
        const data = await this.app.vault.readBinary(img.file);
        
        // Extract filename from export path
        const filename = img.exportPath.split('/').pop() || img.file.name;
        
        // Get the export folder name from the last created folder
        // For now, we'll write relative to the vault root with a convention
        const fullPath = `${basePath}/${img.exportPath}`;
        
        // Create images folder if needed
        const imagesDir = fullPath.split('/').slice(0, -1).join('/');
        try {
          await (this.app.vault.adapter as any).mkdir(imagesDir);
        } catch (e) {
          // Folder might already exist
        }
        
        await this.app.vault.adapter.writeBinary(fullPath, data);
      } catch (e) {
        console.warn(`Failed to copy image: ${img.originalPath}`, e);
      }
    }
  }

  /**
   * Get MIME type from file extension
   */
  private getMimeType(ext: string): string {
    const mimeTypes: Record<string, string> = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'svg': 'image/svg+xml',
      'webp': 'image/webp',
      'ico': 'image/x-icon',
    };
    return mimeTypes[ext] || 'image/png';
  }

  /**
   * Generate CSS with embedded fonts
   */
  private async generateEmbeddedFontCSS(customFontCSS: string): Promise<string> {
    if (!customFontCSS) {
      return '';
    }

    // The custom font CSS already contains font-face declarations
    // Just return it as-is since fonts are already embedded via FontManager
    return customFontCSS;
  }

  /**
   * Generate theme CSS variables
   */
  private generateThemeCSS(theme: Theme | null): string {
    if (!theme) {
      return '';
    }

    const preset = theme.presets[0];
    if (!preset) return '';

    const themeJson = theme.themeJsonData;

    // Helper function to convert color array to CSS value
    const colorToCss = (colors: string[] | string | undefined): string => {
      if (!colors) return 'inherit';
      if (typeof colors === 'string') return colors;
      if (Array.isArray(colors)) {
        if (colors.length === 0) return 'inherit';
        if (colors.length === 1) return colors[0];
        return `linear-gradient(to right, ${colors.join(', ')})`;
      }
      return 'inherit';
    };

    // Build heading colors
    let lightH1 = preset.LightTitleTextColor;
    let lightH2 = preset.LightTitleTextColor;
    let lightH3 = preset.LightBodyTextColor;
    let lightH4 = preset.LightBodyTextColor;
    let darkH1 = preset.DarkTitleTextColor;
    let darkH2 = preset.DarkTitleTextColor;
    let darkH3 = preset.DarkBodyTextColor;
    let darkH4 = preset.DarkBodyTextColor;

    if (themeJson?.presets.light.text) {
      lightH1 = colorToCss(themeJson.presets.light.text.h1);
      lightH2 = colorToCss(themeJson.presets.light.text.h2);
      lightH3 = colorToCss(themeJson.presets.light.text.h3);
      lightH4 = colorToCss(themeJson.presets.light.text.h4);
    }
    if (themeJson?.presets.dark.text) {
      darkH1 = colorToCss(themeJson.presets.dark.text.h1);
      darkH2 = colorToCss(themeJson.presets.dark.text.h2);
      darkH3 = colorToCss(themeJson.presets.dark.text.h3);
      darkH4 = colorToCss(themeJson.presets.dark.text.h4);
    }

    // Build layout backgrounds
    let lightBgCover = 'inherit';
    let lightBgTitle = 'inherit';
    let lightBgSection = 'inherit';
    let darkBgCover = 'inherit';
    let darkBgTitle = 'inherit';
    let darkBgSection = 'inherit';

    if (themeJson?.presets.light.backgrounds) {
      const bg = themeJson.presets.light.backgrounds;
      lightBgCover = bg.cover?.type === 'solid' && bg.cover.color ? bg.cover.color : 
                     (bg.cover?.colors ? `linear-gradient(135deg, ${bg.cover.colors.join(', ')})` : 'inherit');
      lightBgTitle = bg.title?.type === 'solid' && bg.title.color ? bg.title.color : 
                     (bg.title?.colors ? `linear-gradient(135deg, ${bg.title.colors.join(', ')})` : 'inherit');
      lightBgSection = bg.section?.type === 'solid' && bg.section.color ? bg.section.color : 
                       (bg.section?.colors ? `linear-gradient(135deg, ${bg.section.colors.join(', ')})` : 'inherit');
    }
    if (themeJson?.presets.dark.backgrounds) {
      const bg = themeJson.presets.dark.backgrounds;
      darkBgCover = bg.cover?.type === 'solid' && bg.cover.color ? bg.cover.color : 
                    (bg.cover?.colors ? `linear-gradient(135deg, ${bg.cover.colors.join(', ')})` : 'inherit');
      darkBgTitle = bg.title?.type === 'solid' && bg.title.color ? bg.title.color : 
                    (bg.title?.colors ? `linear-gradient(135deg, ${bg.title.colors.join(', ')})` : 'inherit');
      darkBgSection = bg.section?.type === 'solid' && bg.section.color ? bg.section.color : 
                      (bg.section?.colors ? `linear-gradient(135deg, ${bg.section.colors.join(', ')})` : 'inherit');
    }

    return `
      :root {
        --light-background: ${preset.LightBackgroundColor};
        --dark-background: ${preset.DarkBackgroundColor};
        --light-body-text: ${preset.LightBodyTextColor};
        --dark-body-text: ${preset.DarkBodyTextColor};
        --light-title-text: ${preset.LightTitleTextColor};
        --dark-title-text: ${preset.DarkTitleTextColor};
        --light-h1-color: ${lightH1};
        --dark-h1-color: ${darkH1};
        --light-h2-color: ${lightH2};
        --dark-h2-color: ${darkH2};
        --light-h3-color: ${lightH3};
        --dark-h3-color: ${darkH3};
        --light-h4-color: ${lightH4};
        --dark-h4-color: ${darkH4};
        --light-link-color: ${preset.LightLinkColor};
        --dark-link-color: ${preset.DarkLinkColor};
        --light-bullet-color: ${preset.LightBulletColor};
        --dark-bullet-color: ${preset.DarkBulletColor};
        --light-blockquote-border: ${preset.LightBlockquoteBorder};
        --dark-blockquote-border: ${preset.DarkBlockquoteBorder};
        --light-table-header-bg: ${preset.LightTableHeaderBg};
        --dark-table-header-bg: ${preset.DarkTableHeaderBg};
        --light-code-border: ${preset.LightCodeBorder};
        --dark-code-border: ${preset.DarkCodeBorder};
        --light-progress-bar: ${preset.LightProgressBar};
        --dark-progress-bar: ${preset.DarkProgressBar};
        --light-bg-cover: ${lightBgCover};
        --dark-bg-cover: ${darkBgCover};
        --light-bg-title: ${lightBgTitle};
        --dark-bg-title: ${darkBgTitle};
        --light-bg-section: ${lightBgSection};
        --dark-bg-section: ${darkBgSection};
        --title-font: ${theme.template.TitleFont};
        --body-font: ${theme.template.BodyFont};
        
        /* Default to dark mode (matches initial page styling) */
        --background: var(--dark-background);
        --body-text: var(--dark-body-text);
        --title-text: var(--dark-title-text);
        --h1-color: var(--dark-h1-color);
        --h2-color: var(--dark-h2-color);
        --h3-color: var(--dark-h3-color);
        --h4-color: var(--dark-h4-color);
        --link-color: var(--dark-link-color);
        --bullet-color: var(--dark-bullet-color);
        --blockquote-border: var(--dark-blockquote-border);
        --table-header-bg: var(--dark-table-header-bg);
        --code-border: var(--dark-code-border);
        --progress-bar: var(--dark-progress-bar);
        --bg-cover: var(--dark-bg-cover);
        --bg-title: var(--dark-bg-title);
        --bg-section: var(--dark-bg-section);
      }

      /* Light mode: map generic variables to light colors */
      html.light {
        --background: var(--light-background);
        --body-text: var(--light-body-text);
        --title-text: var(--light-title-text);
        --h1-color: var(--light-h1-color);
        --h2-color: var(--light-h2-color);
        --h3-color: var(--light-h3-color);
        --h4-color: var(--light-h4-color);
        --link-color: var(--light-link-color);
        --bullet-color: var(--light-bullet-color);
        --blockquote-border: var(--light-blockquote-border);
        --table-header-bg: var(--light-table-header-bg);
        --code-border: var(--light-code-border);
        --progress-bar: var(--light-progress-bar);
        --bg-cover: var(--light-bg-cover);
        --bg-title: var(--light-bg-title);
        --bg-section: var(--light-bg-section);
      }
    `;
  }

  /**
   * Generate complete HTML file
   */
  private generateHTML(
    presentation: Presentation,
    slides: Array<{ html: string; speakerNotes: string[] }>,
    themeCSS: string,
    fontCSS: string,
    aspectRatio?: string,
    lockAspectRatio?: boolean
  ): string {
    const title = presentation.frontmatter.title || 'Presentation';
    const slidesHTML = slides
      .map((slide, idx) => {
        const speakerNotesComment = slide.speakerNotes && slide.speakerNotes.length > 0
          ? `<!-- SPEAKER NOTES:\n${slide.speakerNotes.map(n => `  ${n}`).join('\n')}\n-->\n`
          : '';
        
        return `
        ${speakerNotesComment}
        <div class="slide${idx === 0 ? ' active' : ''}" data-slide-index="${idx}">
          <iframe 
            srcdoc="${this.escapeAttr(slide.html)}"
            frameborder="0"
            scrolling="no"
          ></iframe>
        </div>
      `;
      })
      .join('\n');

    // Generate aspect ratio CSS if locked
    const aspectRatioCSS = this.getLockedAspectRatioCSS(aspectRatio, lockAspectRatio);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="Presentation: ${this.escapeHtml(title)}">
  <title>${this.escapeHtml(title)}</title>
  <style>
    ${fontCSS}
    ${themeCSS}
    ${this.getExportCSS()}
    ${aspectRatioCSS}
  </style>
</head>
<body tabindex="0">
  <div class="presentation-container">
    <div class="slides-wrapper">
      ${slidesHTML}
    </div>

    <!-- Navigation -->
    <div class="nav-controls">
      <button class="theme-toggle" id="themeToggle" title="Toggle dark mode">
        <svg class="sun-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="5"></circle>
          <line x1="12" y1="1" x2="12" y2="3"></line>
          <line x1="12" y1="21" x2="12" y2="23"></line>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
          <line x1="1" y1="12" x2="3" y2="12"></line>
          <line x1="21" y1="12" x2="23" y2="12"></line>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
        </svg>
        <svg class="moon-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
        </svg>
      </button>
      <div class="slide-counter"><span id="current">1</span> / <span id="total">${slides.length}</span></div>
      <div class="progress-bar">
        <div class="progress-fill" id="progress"></div>
      </div>
    </div>

    <!-- Help overlay -->
    <div class="help-overlay" id="helpOverlay">
      <div class="help-content">
        <h2>Keyboard Shortcuts</h2>
        <ul>
          <li><kbd>→</kbd> or <kbd>Space</kbd> - Next slide</li>
          <li><kbd>←</kbd> - Previous slide</li>
          <li><kbd>Home</kbd> - First slide</li>
          <li><kbd>End</kbd> - Last slide</li>
          <li><kbd>?</kbd> - Toggle help</li>
          <li><kbd>Esc</kbd> - Exit fullscreen</li>
        </ul>
      </div>
    </div>
  </div>

  <script>
    ${this.getExportJS(slides.length)}
  </script>
</body>
</html>`;
  }

  /**
   * Get CSS for locked aspect ratio (letterboxing/pillarboxing)
   */
  private getLockedAspectRatioCSS(aspectRatio?: string, lockAspectRatio?: boolean): string {
    if (!lockAspectRatio) {
      return '';
    }

    const ratioStr = aspectRatio || '16:9';
    const ratios: Record<string, {width: number, height: number}> = {
      '16:9': { width: 16, height: 9 },
      '4:3': { width: 4, height: 3 },
      '16:10': { width: 16, height: 10 },
      'auto': { width: 0, height: 0 }
    };

    const ratio = ratios[ratioStr] || ratios['16:9'];
    if (ratio.width === 0) {
      return ''; // 'auto' aspect ratio - no locking needed
    }

    return `
      /* Aspect ratio locking */
      .slides-wrapper {
        display: flex;
        align-items: center;
        justify-content: center;
        background: #000;
      }
      
      .slide {
        /* Override absolute positioning to use flexbox centering */
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        /* Maintain aspect ratio with automatic letterboxing/pillarboxing */
        aspect-ratio: ${ratio.width} / ${ratio.height};
        /* Calculate the largest size that fits while maintaining aspect ratio */
        width: min(100%, calc((100vh - 40px) * ${ratio.width} / ${ratio.height}));
        height: min(calc(100% - 40px), calc(100vw * ${ratio.height} / ${ratio.width}));
        max-width: 100%;
        max-height: calc(100% - 40px); /* Account for nav bar */
      }
      
      .slide iframe {
        width: 100% !important;
        height: 100% !important;
      }
    `;
  }

  /**
   * Get CSS for exported presentation
   */
  private getExportCSS(): string {
    return `
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }

      html, body {
        width: 100%;
        height: 100%;
        background: var(--background, #000) !important;
        color: var(--body-text, #fff) !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        overflow: hidden;
        transition: background-color 0.3s ease, color 0.3s ease;
      }

      html.light {
        color-scheme: light;
      }

      html.dark {
        color-scheme: dark;
      }

      .presentation-container {
        display: flex;
        flex-direction: column;
        width: 100%;
        height: 100%;
      }

      .slides-wrapper {
        flex: 1;
        position: relative;
        overflow: hidden;
      }

      .slide {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        transition: opacity 0.6s ease-in-out;
        pointer-events: none;
      }

      .slide.active {
        opacity: 1;
        pointer-events: auto;
      }

      .slide iframe {
        width: 100%;
        height: 100%;
        border: none;
        background: transparent;
      }

      .nav-controls {
        display: flex;
        align-items: center;
        justify-content: flex-start;
        gap: 20px;
        height: 40px;
        padding: 0 20px;
        background: rgba(0, 0, 0, 0.8);
        border-top: 1px solid rgba(255, 255, 255, 0.1);
        transition: background 0.3s ease, border-color 0.3s ease;
      }

      html.light .nav-controls {
        background: rgba(255, 255, 255, 0.8);
        border-top-color: rgba(0, 0, 0, 0.1);
      }

      .theme-toggle {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        border: none;
        background: transparent;
        color: var(--dark-body-text, #999);
        cursor: pointer;
        border-radius: 4px;
        transition: all 0.2s ease;
        padding: 0;
        flex-shrink: 0;
      }

      .theme-toggle:hover {
        color: var(--dark-body-text, #fff);
        background: rgba(255, 255, 255, 0.1);
      }

      html.light .theme-toggle {
        color: var(--light-body-text, #666);
      }

      html.light .theme-toggle:hover {
        color: var(--light-body-text, #000);
        background: rgba(0, 0, 0, 0.1);
      }

      .theme-toggle svg {
        width: 16px;
        height: 16px;
        position: absolute;
      }

      .sun-icon {
        opacity: 0;
        transform: rotate(-180deg);
        transition: opacity 0.3s ease, transform 0.3s ease;
      }

      html.light .sun-icon {
        opacity: 1;
        transform: rotate(0deg);
      }

      .moon-icon {
        opacity: 1;
        transform: rotate(0deg);
        transition: opacity 0.3s ease, transform 0.3s ease;
      }

      html.light .moon-icon {
        opacity: 0;
        transform: rotate(180deg);
      }

      .slide-counter {
        font-size: 14px;
        color: var(--dark-body-text, #999);
        min-width: 60px;
        margin-left: auto;
        transition: color 0.3s ease;
      }

      html.light .slide-counter {
        color: var(--light-body-text, #666);
      }

      .progress-bar {
        flex: 1;
        height: 3px;
        background: rgba(255, 255, 255, 0.2);
        border-radius: 2px;
        margin: 0 20px;
        overflow: hidden;
        transition: background 0.3s ease;
      }

      html.light .progress-bar {
        background: rgba(0, 0, 0, 0.2);
      }

      .progress-fill {
        height: 100%;
        background: var(--dark-progress-bar, #4a9eff);
        width: 0%;
        transition: width 0.3s ease, background 0.3s ease;
      }

      html.light .progress-fill {
        background: var(--light-progress-bar, #0066cc);
      }

      .help-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.9);
        display: none;
        align-items: center;
        justify-content: center;
        z-index: 1000;
      }

      html.light .help-overlay {
        background: rgba(255, 255, 255, 0.95);
      }

      .help-overlay.active {
        display: flex;
      }

      .help-content {
        background: var(--dark-background, #1a1a1a);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 8px;
        padding: 30px;
        max-width: 400px;
        color: var(--dark-body-text, #fff);
        transition: background 0.3s ease, color 0.3s ease, border-color 0.3s ease;
      }

      html.light .help-content {
        background: var(--light-background, #fff);
        border: 1px solid rgba(0, 0, 0, 0.2);
        color: var(--light-body-text, #000);
      }

      .help-content h2 {
        margin-bottom: 20px;
        font-size: 24px;
        color: var(--dark-title-text, #fff);
      }

      html.light .help-content h2 {
        color: var(--light-title-text, #000);
      }

      .help-content ul {
        list-style: none;
      }

      .help-content li {
        margin-bottom: 12px;
        display: flex;
        align-items: center;
        gap: 12px;
        color: var(--dark-body-text, #fff);
      }

      html.light .help-content li {
        color: var(--light-body-text, #000);
      }

      .help-content kbd {
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.3);
        border-radius: 4px;
        padding: 4px 8px;
        font-family: monospace;
        font-size: 12px;
        min-width: 40px;
        text-align: center;
        color: var(--dark-body-text, #fff);
        transition: background 0.3s ease, border-color 0.3s ease, color 0.3s ease;
      }

      html.light .help-content kbd {
        background: rgba(0, 0, 0, 0.1);
        border: 1px solid rgba(0, 0, 0, 0.3);
        color: var(--light-body-text, #000);
      }

      @media (max-width: 768px) {
        .nav-controls {
          height: 50px;
        }

        .help-content {
          padding: 20px;
          max-width: 90vw;
        }
      }
    `;
  }

  /**
   * Get JavaScript for exported presentation
   */
  private getExportJS(totalSlides: number): string {
    return `
      (function() {
        let currentSlide = 0;
        const totalSlides = ${totalSlides};
        const html = document.documentElement;

        function goToSlide(index) {
          if (index < 0) index = 0;
          if (index >= totalSlides) index = totalSlides - 1;

          // Update active slide
          document.querySelectorAll('.slide').forEach(slide => {
            slide.classList.remove('active');
          });
          const activeSlide = document.querySelectorAll('.slide')[index];
          activeSlide.classList.add('active');

          // Apply current theme to the active slide's iframe if it just loaded
          const isLight = html.classList.contains('light');
          const iframe = activeSlide.querySelector('iframe');
          if (iframe) {
            try {
              const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
              if (iframeDoc) {
                const iframeHtml = iframeDoc.documentElement;
                if (isLight) {
                  iframeHtml.classList.add('light');
                  iframeHtml.classList.remove('dark');
                } else {
                  iframeHtml.classList.add('dark');
                  iframeHtml.classList.remove('light');
                }
              }
            } catch (e) {
              // Iframe might not be loaded yet
            }
          }

          // Update counter
          document.getElementById('current').textContent = index + 1;

          // Update progress
          const progress = ((index + 1) / totalSlides) * 100;
          document.getElementById('progress').style.width = progress + '%';

          // Update URL hash
          window.location.hash = 'slide-' + (index + 1);

          currentSlide = index;
        }

        function nextSlide() {
          goToSlide(currentSlide + 1);
        }

        function previousSlide() {
          goToSlide(currentSlide - 1);
        }

        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
          const helpOverlay = document.getElementById('helpOverlay');

          switch (e.key) {
            case 'ArrowRight':
            case 'ArrowDown':
            case ' ':
              if (!helpOverlay.classList.contains('active')) {
                e.preventDefault();
                nextSlide();
              }
              break;
            case 'ArrowLeft':
            case 'ArrowUp':
              e.preventDefault();
              previousSlide();
              break;
            case 'Home':
              e.preventDefault();
              goToSlide(0);
              break;
            case 'End':
              e.preventDefault();
              goToSlide(totalSlides - 1);
              break;
            case '?':
              helpOverlay.classList.toggle('active');
              break;
            case 'Escape':
              helpOverlay.classList.remove('active');
              if (document.fullscreenElement) {
                document.exitFullscreen();
              }
              break;
          }
        });

        // Click navigation
        document.querySelector('.slides-wrapper').addEventListener('click', (e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = e.clientX - rect.left;
          
          if (x < rect.width / 3) {
            previousSlide();
          } else if (x > (rect.width * 2) / 3) {
            nextSlide();
          }
        });

        // Handle hash navigation
        window.addEventListener('hashchange', () => {
          const hash = window.location.hash;
          const match = hash.match(/slide-(\\d+)/);
          if (match) {
            goToSlide(parseInt(match[1]) - 1);
          }
        });

        // Fullscreen on double-click
        document.querySelector('.slides-wrapper').addEventListener('dblclick', () => {
          if (!document.fullscreenElement) {
            document.querySelector('.presentation-container').requestFullscreen().then(() => {
              // Ensure focus returns to document for keyboard events
              document.body.focus();
            });
          }
        });

        // Ensure keyboard events work after fullscreen changes
        document.addEventListener('fullscreenchange', () => {
          // Return focus to document body to ensure keyboard events work
          document.body.focus();
        });

        // Theme toggle
        const themeToggle = document.getElementById('themeToggle');
        
        function applyThemeToIframes(isLight, retryCount = 0) {
          // Apply theme to all slide iframes by toggling html class AND slide element classes
          const iframes = document.querySelectorAll('.slide iframe');
          let successCount = 0;
          
          iframes.forEach((iframe, idx) => {
            try {
              const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
              if (iframeDoc && iframeDoc.documentElement) {
                const iframeHtml = iframeDoc.documentElement;
                
                // 1. Toggle html element class
                if (isLight) {
                  iframeHtml.classList.add('light');
                  iframeHtml.classList.remove('dark');
                } else {
                  iframeHtml.classList.add('dark');
                  iframeHtml.classList.remove('light');
                }
                
                // 2. Toggle .slide element class (section element inside body)
                // Only toggle slides that don't have a per-slide mode override (data-mode attribute)
                const slideEl = iframeDoc.querySelector('.slide');
                if (slideEl && !slideEl.hasAttribute('data-mode')) {
                  if (isLight) {
                    slideEl.classList.add('light');
                    slideEl.classList.remove('dark');
                  } else {
                    slideEl.classList.add('dark');
                    slideEl.classList.remove('light');
                  }
                  
                  // Apply correct dynamic background color from data attributes
                  const lightBg = slideEl.getAttribute('data-light-bg');
                  const darkBg = slideEl.getAttribute('data-dark-bg');
                  if (lightBg || darkBg) {
                    const bgColor = isLight ? lightBg : darkBg;
                    if (bgColor) {
                      slideEl.style.backgroundColor = bgColor;
                    } else {
                      slideEl.style.removeProperty('background-color');
                    }
                  } else if (slideEl.style.backgroundColor) {
                    // No dynamic bg data, just remove inline style
                    slideEl.style.removeProperty('background-color');
                  }
                }
                
                // 3. Also update .half-content-panel if present (for half-image layouts)
                const contentPanel = iframeDoc.querySelector('.half-content-panel');
                if (contentPanel && !slideEl?.hasAttribute('data-mode')) {
                  if (isLight) {
                    contentPanel.classList.add('light');
                    contentPanel.classList.remove('dark');
                  } else {
                    contentPanel.classList.add('dark');
                    contentPanel.classList.remove('light');
                  }
                  
                  // Apply correct dynamic background color from data attributes
                  const lightBg = contentPanel.getAttribute('data-light-bg');
                  const darkBg = contentPanel.getAttribute('data-dark-bg');
                  if (lightBg || darkBg) {
                    const bgColor = isLight ? lightBg : darkBg;
                    if (bgColor) {
                      contentPanel.style.backgroundColor = bgColor;
                    } else {
                      contentPanel.style.removeProperty('background-color');
                    }
                  } else if (contentPanel.style.backgroundColor) {
                    contentPanel.style.removeProperty('background-color');
                  }
                }
                
                successCount++;
                // Debug: log first iframe's state
                if (idx === 0) {
                  const bodyStyle = window.getComputedStyle(iframeDoc.body);
                  const slideStyle = slideEl ? window.getComputedStyle(slideEl) : null;
                  console.log('Iframe 0 updated:', { 
                    isLight: isLight, 
                    htmlClasses: iframeHtml.className,
                    slideClasses: slideEl ? slideEl.className : 'none',
                    slideBgColor: slideStyle ? slideStyle.backgroundColor : 'none',
                    bodyBgColor: bodyStyle.backgroundColor
                  });
                }
              }
            } catch (e) {
              // Iframe might not be loaded yet
              console.warn('Failed to apply theme to iframe:', e);
            }
          });
          
          // Retry if no iframes found (too early) or some failed to apply (not ready yet)
          const totalIframes = iframes.length;
          if ((totalIframes === 0 || successCount < totalIframes) && retryCount < 5) {
            console.log('Theme toggle retry:', { isLight, retryCount, totalIframes, successCount });
            setTimeout(() => applyThemeToIframes(isLight, retryCount + 1), 100);
          } else {
            console.log('Theme toggle applied:', { isLight, retryCount, totalIframes, successCount });
          }
        }
        
        // Load saved theme preference
        const savedTheme = localStorage.getItem('presentation-theme') || 'dark';
        const isLightMode = savedTheme === 'light';
        if (isLightMode) {
          html.classList.add('light');
          html.classList.remove('dark');
        } else {
          html.classList.add('dark');
          html.classList.remove('light');
        }
        applyThemeToIframes(isLightMode);
        
        // Toggle theme on button click
        themeToggle.addEventListener('click', () => {
          const isLight = html.classList.contains('light');
          console.log('Theme toggle clicked. Current mode:', isLight ? 'light' : 'dark', 'html classes:', html.className);
          if (isLight) {
            html.classList.remove('light');
            html.classList.add('dark');
            console.log('Switching to dark mode. New html classes:', html.className);
            setTimeout(() => {
               const bodyStyle = window.getComputedStyle(document.body);
              const htmlStyle = window.getComputedStyle(document.documentElement);
              const rootStyle = window.getComputedStyle(document.documentElement);
              const varBg = rootStyle.getPropertyValue('--background').trim();
              const varDarkBg = rootStyle.getPropertyValue('--dark-background').trim();
              console.log('Dark - html:' + htmlStyle.backgroundColor + ' body:' + bodyStyle.backgroundColor + ' varBg:' + varBg);
            }, 100);
            applyThemeToIframes(false);
            localStorage.setItem('presentation-theme', 'dark');
          } else {
            html.classList.add('light');
            html.classList.remove('dark');
            console.log('Switching to light mode. New html classes:', html.className);
            setTimeout(() => {
               const bodyEl = document.body;
              const htmlEl = document.documentElement;
              console.log('Light - html inline style: ' + (htmlEl.getAttribute('style') || 'none'));
              console.log('Light - body inline style: ' + (bodyEl.getAttribute('style') || 'none'));
              const bodyStyle = window.getComputedStyle(bodyEl);
              const htmlStyle = window.getComputedStyle(htmlEl);
              const varBg = htmlStyle.getPropertyValue('--background').trim();
              console.log('Light - html bg:' + htmlStyle.backgroundColor + ' body bg:' + bodyStyle.backgroundColor + ' varBg:' + varBg);
            }, 100);
            applyThemeToIframes(true);
            localStorage.setItem('presentation-theme', 'light');
          }
        });

        // Initialize
        goToSlide(0);
      })();
    `;
  }

  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return text.replace(/[&<>"']/g, (char) => map[char]);
  }

  private escapeAttr(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  private getSystemColorScheme(): 'light' | 'dark' {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  }

  /**
   * Generate comprehensive theme test page for debugging
   */
  private generateThemeTestHTML(theme: Theme | null): string {
    const preset = theme?.presets[0];
    const themeJson = theme?.themeJsonData;
    
    // Helper function to convert color array to CSS value
    const colorToCss = (colors: string[] | string | undefined): string => {
      if (!colors) return 'inherit';
      if (typeof colors === 'string') return colors;
      if (Array.isArray(colors)) {
        if (colors.length === 0) return 'inherit';
        if (colors.length === 1) return colors[0];
        return `linear-gradient(to right, ${colors.join(', ')})`;
      }
      return 'inherit';
    };

    // Build heading colors
    let lightH1 = preset?.LightTitleTextColor || '#000';
    let lightH2 = preset?.LightTitleTextColor || '#000';
    let lightH3 = preset?.LightBodyTextColor || '#333';
    let lightH4 = preset?.LightBodyTextColor || '#333';
    let darkH1 = preset?.DarkTitleTextColor || '#fff';
    let darkH2 = preset?.DarkTitleTextColor || '#fff';
    let darkH3 = preset?.DarkBodyTextColor || '#ddd';
    let darkH4 = preset?.DarkBodyTextColor || '#ddd';
    
    if (themeJson?.presets.light.text) {
      lightH1 = colorToCss(themeJson.presets.light.text.h1);
      lightH2 = colorToCss(themeJson.presets.light.text.h2);
      lightH3 = colorToCss(themeJson.presets.light.text.h3);
      lightH4 = colorToCss(themeJson.presets.light.text.h4);
    }
    if (themeJson?.presets.dark.text) {
      darkH1 = colorToCss(themeJson.presets.dark.text.h1);
      darkH2 = colorToCss(themeJson.presets.dark.text.h2);
      darkH3 = colorToCss(themeJson.presets.dark.text.h3);
      darkH4 = colorToCss(themeJson.presets.dark.text.h4);
    }

    // Build layout backgrounds
    let lightBgCover = 'inherit';
    let lightBgTitle = 'inherit';
    let lightBgSection = 'inherit';
    let darkBgCover = 'inherit';
    let darkBgTitle = 'inherit';
    let darkBgSection = 'inherit';
    
    if (themeJson?.presets.light.backgrounds) {
      const bg = themeJson.presets.light.backgrounds;
      lightBgCover = bg.cover?.type === 'solid' && bg.cover.color ? bg.cover.color : 
                     (bg.cover?.colors ? `linear-gradient(135deg, ${bg.cover.colors.join(', ')})` : 'inherit');
      lightBgTitle = bg.title?.type === 'solid' && bg.title.color ? bg.title.color : 
                     (bg.title?.colors ? `linear-gradient(135deg, ${bg.title.colors.join(', ')})` : 'inherit');
      lightBgSection = bg.section?.type === 'solid' && bg.section.color ? bg.section.color : 
                       (bg.section?.colors ? `linear-gradient(135deg, ${bg.section.colors.join(', ')})` : 'inherit');
    }
    if (themeJson?.presets.dark.backgrounds) {
      const bg = themeJson.presets.dark.backgrounds;
      darkBgCover = bg.cover?.type === 'solid' && bg.cover.color ? bg.cover.color : 
                    (bg.cover?.colors ? `linear-gradient(135deg, ${bg.cover.colors.join(', ')})` : 'inherit');
      darkBgTitle = bg.title?.type === 'solid' && bg.title.color ? bg.title.color : 
                    (bg.title?.colors ? `linear-gradient(135deg, ${bg.title.colors.join(', ')})` : 'inherit');
      darkBgSection = bg.section?.type === 'solid' && bg.section.color ? bg.section.color : 
                      (bg.section?.colors ? `linear-gradient(135deg, ${bg.section.colors.join(', ')})` : 'inherit');
    }
    
    const variables = preset ? `
      :root {
        --light-background: ${preset.LightBackgroundColor};
        --dark-background: ${preset.DarkBackgroundColor};
        --light-body-text: ${preset.LightBodyTextColor};
        --dark-body-text: ${preset.DarkBodyTextColor};
        --light-title-text: ${preset.LightTitleTextColor};
        --dark-title-text: ${preset.DarkTitleTextColor};
        --light-h1-color: ${lightH1};
        --dark-h1-color: ${darkH1};
        --light-h2-color: ${lightH2};
        --dark-h2-color: ${darkH2};
        --light-h3-color: ${lightH3};
        --dark-h3-color: ${darkH3};
        --light-h4-color: ${lightH4};
        --dark-h4-color: ${darkH4};
        --light-link-color: ${preset.LightLinkColor};
        --dark-link-color: ${preset.DarkLinkColor};
        --light-bullet-color: ${preset.LightBulletColor};
        --dark-bullet-color: ${preset.DarkBulletColor};
        --light-blockquote-border: ${preset.LightBlockquoteBorder};
        --dark-blockquote-border: ${preset.DarkBlockquoteBorder};
        --light-table-header-bg: ${preset.LightTableHeaderBg};
        --dark-table-header-bg: ${preset.DarkTableHeaderBg};
        --light-code-border: ${preset.LightCodeBorder};
        --dark-code-border: ${preset.DarkCodeBorder};
        --light-progress-bar: ${preset.LightProgressBar};
        --dark-progress-bar: ${preset.DarkProgressBar};
        --light-bg-cover: ${lightBgCover};
        --dark-bg-cover: ${darkBgCover};
        --light-bg-title: ${lightBgTitle};
        --dark-bg-title: ${darkBgTitle};
        --light-bg-section: ${lightBgSection};
        --dark-bg-section: ${darkBgSection};
        
        /* Default to dark mode (match initial page styling) */
        --background: var(--dark-background);
        --body-text: var(--dark-body-text);
        --title-text: var(--dark-title-text);
        --h1-color: var(--dark-h1-color);
        --h2-color: var(--dark-h2-color);
        --h3-color: var(--dark-h3-color);
        --h4-color: var(--dark-h4-color);
        --link-color: var(--dark-link-color);
        --bullet-color: var(--dark-bullet-color);
        --blockquote-border: var(--dark-blockquote-border);
        --table-header-bg: var(--dark-table-header-bg);
        --code-border: var(--dark-code-border);
        --progress-bar: var(--dark-progress-bar);
        --bg-cover: var(--dark-bg-cover);
        --bg-title: var(--dark-bg-title);
        --bg-section: var(--dark-bg-section);
      }
      
      /* Light mode: map generic variables to light colors */
      html.light {
        --background: var(--light-background);
        --body-text: var(--light-body-text);
        --title-text: var(--light-title-text);
        --h1-color: var(--light-h1-color);
        --h2-color: var(--light-h2-color);
        --h3-color: var(--light-h3-color);
        --h4-color: var(--light-h4-color);
        --link-color: var(--light-link-color);
        --bullet-color: var(--light-bullet-color);
        --blockquote-border: var(--light-blockquote-border);
        --table-header-bg: var(--light-table-header-bg);
        --code-border: var(--light-code-border);
        --progress-bar: var(--light-progress-bar);
        --bg-cover: var(--light-bg-cover);
        --bg-title: var(--light-bg-title);
        --bg-section: var(--light-bg-section);
      }
    ` : '';

    const toggleCSS = this.injectThemeToggleCSS('').match(/<style>[\s\S]*<\/style>/)?.[0] || '';

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Perspecta Theme Test</title>
  <style>
    ${variables}
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    html, body {
      width: 100%;
      height: 100%;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      transition: background-color 0.3s ease, color 0.3s ease;
    }

    html {
      background-color: var(--dark-background, #000);
      color: var(--dark-body-text, #fff);
    }

    html.light {
      background-color: var(--light-background, #fff);
      color: var(--light-body-text, #000);
    }

    body {
      padding: 40px;
      max-width: 1200px;
      margin: 0 auto;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 40px;
      padding-bottom: 20px;
      border-bottom: 2px solid currentColor;
    }

    .theme-toggle {
      padding: 10px 20px;
      font-size: 16px;
      cursor: pointer;
      border: 2px solid currentColor;
      background: transparent;
      color: currentColor;
      border-radius: 4px;
      transition: all 0.3s ease;
    }

    .theme-toggle:hover {
      opacity: 0.8;
    }

    .section {
      margin-bottom: 60px;
      padding: 20px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
    }

    html.light .section {
      border-color: rgba(0, 0, 0, 0.1);
    }

    .section-title {
      font-size: 24px;
      font-weight: bold;
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 1px solid currentColor;
    }

    .color-swatch {
      display: inline-block;
      width: 80px;
      height: 80px;
      margin-right: 20px;
      margin-bottom: 20px;
      border-radius: 4px;
      border: 1px solid rgba(255, 255, 255, 0.2);
    }

    html.light .color-swatch {
      border-color: rgba(0, 0, 0, 0.2);
    }

    .swatch-label {
      font-size: 12px;
      margin-top: 5px;
      word-break: break-all;
    }

    .color-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
      gap: 20px;
      margin-bottom: 40px;
    }

    .color-item {
      text-align: center;
    }

    .elements-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 30px;
    }

    .element-test {
      padding: 15px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 4px;
    }

    html.light .element-test {
      border-color: rgba(0, 0, 0, 0.1);
    }

    .element-label {
      font-size: 12px;
      font-weight: bold;
      margin-bottom: 10px;
      opacity: 0.7;
    }

    .test-p { color: var(--dark-body-text, #fff); }
    html.light .test-p { color: var(--light-body-text, #000); }

    .test-h1 { font-size: 28px; font-weight: bold; color: var(--dark-h1-color, var(--dark-title-text, #fff)); }
    html.light .test-h1 { color: var(--light-h1-color, var(--light-title-text, #000)); }

    .test-h2 { font-size: 24px; font-weight: bold; color: var(--dark-h2-color, var(--dark-title-text, #fff)); }
    html.light .test-h2 { color: var(--light-h2-color, var(--light-title-text, #000)); }

    .test-h3 { font-size: 20px; font-weight: bold; color: var(--dark-h3-color, var(--dark-body-text, #fff)); }
    html.light .test-h3 { color: var(--light-h3-color, var(--light-body-text, #000)); }

    .test-a { color: var(--dark-link-color, #4a9eff); text-decoration: underline; }
    html.light .test-a { color: var(--light-link-color, #0066cc); }

    .test-em { color: var(--dark-body-text, #fff); font-style: italic; }
    html.light .test-em { color: var(--light-body-text, #000); }

    .test-strong { color: var(--dark-body-text, #fff); font-weight: bold; }
    html.light .test-strong { color: var(--light-body-text, #000); }

    .test-code { 
      color: var(--dark-body-text, #fff);
      background: rgba(255, 255, 255, 0.1);
      padding: 2px 6px;
      border-radius: 3px;
      font-family: monospace;
    }
    html.light .test-code { 
      color: var(--light-body-text, #000);
      background: rgba(0, 0, 0, 0.1);
    }

    ${toggleCSS}
  </style>
</head>
<body>
  <div class="header">
    <h1>Perspecta Theme Test Page</h1>
    <button class="theme-toggle" id="themeToggle">🌙 Toggle Dark/Light</button>
  </div>

  <div class="section">
    <div class="section-title">CSS Variables Check Grid (All Colors)</div>
    <p style="margin-bottom: 15px; font-size: 12px;"><strong>How to read:</strong> The <span id="modeIndicator" style="padding: 2px 6px; border-radius: 3px; background: rgba(255,255,255,0.2); font-size: 11px;">DARK MODE</span> columns (Dynamic + Dark) should match. If not, the variable mapping is broken.</p>
    <style>
      .check-grid {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 20px;
        font-size: 11px;
      }
      .check-grid th {
        background: rgba(255, 255, 255, 0.1);
        padding: 6px 8px;
        text-align: left;
        font-weight: bold;
        border: 1px solid rgba(255, 255, 255, 0.2);
        transition: background 0.3s ease;
      }
      html.light .check-grid th {
        background: rgba(0, 0, 0, 0.05);
        border-color: rgba(0, 0, 0, 0.1);
      }
      .check-grid th.highlight-dark {
        background: rgba(100, 150, 200, 0.3) !important;
        border: 2px solid rgba(100, 150, 200, 0.6) !important;
      }
      html.light .check-grid th.highlight-light {
        background: rgba(100, 200, 100, 0.3) !important;
        border: 2px solid rgba(100, 200, 100, 0.6) !important;
      }
      html.dark .check-grid th.highlight-dark {
        background: rgba(100, 150, 200, 0.3) !important;
        border: 2px solid rgba(100, 150, 200, 0.6) !important;
      }
      .check-grid td {
        padding: 6px 8px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        height: 30px;
        vertical-align: middle;
      }
      html.light .check-grid td {
        border-color: rgba(0, 0, 0, 0.1);
      }
      .check-grid .label-col {
        font-weight: 500;
        width: 12%;
      }
      .check-grid .var-col {
        font-family: monospace;
        font-size: 10px;
        width: 18%;
      }
      .check-grid .swatch {
        height: 30px;
        border: 1px solid rgba(0, 0, 0, 0.3);
        border-radius: 2px;
        width: 100%;
      }
    </style>
    <table class="check-grid">
      <thead>
        <tr>
          <th style="width: 12%;">Element</th>
          <th style="width: 18%;">CSS Variable</th>
          <th class="highlight-light" style="width: 10%;">Light</th>
          <th class="highlight-dark" style="width: 10%;">Dynamic</th>
          <th class="highlight-dark" style="width: 10%;">Dark</th>
        </tr>
      </thead>
      <tbody>
        <tr><td class="label-col">Background</td><td class="var-col">--*-background</td><td><div class="swatch" style="background-color: ${preset?.LightBackgroundColor || '#fff'};"></div></td><td><div class="swatch" style="background-color: var(--background, ${preset?.LightBackgroundColor || '#fff'});"></div></td><td><div class="swatch" style="background-color: ${preset?.DarkBackgroundColor || '#000'};"></div></td></tr>
        <tr><td class="label-col">Body Text</td><td class="var-col">--*-body-text</td><td><div class="swatch" style="background-color: ${preset?.LightBodyTextColor || '#000'};"></div></td><td><div class="swatch" style="background-color: var(--body-text, ${preset?.LightBodyTextColor || '#000'});"></div></td><td><div class="swatch" style="background-color: ${preset?.DarkBodyTextColor || '#fff'};"></div></td></tr>
        <tr><td class="label-col">Title Text</td><td class="var-col">--*-title-text</td><td><div class="swatch" style="background-color: ${preset?.LightTitleTextColor || '#000'};"></div></td><td><div class="swatch" style="background-color: var(--title-text, ${preset?.LightTitleTextColor || '#000'});"></div></td><td><div class="swatch" style="background-color: ${preset?.DarkTitleTextColor || '#fff'};"></div></td></tr>
        <tr><td class="label-col">H1 Color</td><td class="var-col">--*-h1-color</td><td><div class="swatch" style="background-color: ${lightH1};"></div></td><td><div class="swatch" style="background-color: var(--h1-color, ${lightH1});"></div></td><td><div class="swatch" style="background-color: ${darkH1};"></div></td></tr>
        <tr><td class="label-col">H2 Color</td><td class="var-col">--*-h2-color</td><td><div class="swatch" style="background-color: ${lightH2};"></div></td><td><div class="swatch" style="background-color: var(--h2-color, ${lightH2});"></div></td><td><div class="swatch" style="background-color: ${darkH2};"></div></td></tr>
        <tr><td class="label-col">H3 Color</td><td class="var-col">--*-h3-color</td><td><div class="swatch" style="background-color: ${lightH3};"></div></td><td><div class="swatch" style="background-color: var(--h3-color, ${lightH3});"></div></td><td><div class="swatch" style="background-color: ${darkH3};"></div></td></tr>
        <tr><td class="label-col">H4 Color</td><td class="var-col">--*-h4-color</td><td><div class="swatch" style="background-color: ${lightH4};"></div></td><td><div class="swatch" style="background-color: var(--h4-color, ${lightH4});"></div></td><td><div class="swatch" style="background-color: ${darkH4};"></div></td></tr>
        <tr><td class="label-col">Link Color</td><td class="var-col">--*-link-color</td><td><div class="swatch" style="background-color: ${preset?.LightLinkColor || '#0066cc'};"></div></td><td><div class="swatch" style="background-color: var(--link-color, ${preset?.LightLinkColor || '#0066cc'});"></div></td><td><div class="swatch" style="background-color: ${preset?.DarkLinkColor || '#4a9eff'};"></div></td></tr>
        <tr><td class="label-col">Bullet Color</td><td class="var-col">--*-bullet-color</td><td><div class="swatch" style="background-color: ${preset?.LightBulletColor || '#666'};"></div></td><td><div class="swatch" style="background-color: var(--bullet-color, ${preset?.LightBulletColor || '#666'});"></div></td><td><div class="swatch" style="background-color: ${preset?.DarkBulletColor || '#999'};"></div></td></tr>
        <tr><td class="label-col">Blockquote</td><td class="var-col">--*-blockquote-border</td><td><div class="swatch" style="background-color: ${preset?.LightBlockquoteBorder || '#ccc'};"></div></td><td><div class="swatch" style="background-color: var(--blockquote-border, ${preset?.LightBlockquoteBorder || '#ccc'});"></div></td><td><div class="swatch" style="background-color: ${preset?.DarkBlockquoteBorder || '#666'};"></div></td></tr>
        <tr><td class="label-col">Table Header</td><td class="var-col">--*-table-header-bg</td><td><div class="swatch" style="background-color: ${preset?.LightTableHeaderBg || '#f0f0f0'};"></div></td><td><div class="swatch" style="background-color: var(--table-header-bg, ${preset?.LightTableHeaderBg || '#f0f0f0'});"></div></td><td><div class="swatch" style="background-color: ${preset?.DarkTableHeaderBg || '#333'};"></div></td></tr>
        <tr><td class="label-col">Code Border</td><td class="var-col">--*-code-border</td><td><div class="swatch" style="background-color: ${preset?.LightCodeBorder || '#ddd'};"></div></td><td><div class="swatch" style="background-color: var(--code-border, ${preset?.LightCodeBorder || '#ddd'});"></div></td><td><div class="swatch" style="background-color: ${preset?.DarkCodeBorder || '#555'};"></div></td></tr>
        <tr><td class="label-col">Progress Bar</td><td class="var-col">--*-progress-bar</td><td><div class="swatch" style="background-color: ${preset?.LightProgressBar || '#0066cc'};"></div></td><td><div class="swatch" style="background-color: var(--progress-bar, ${preset?.LightProgressBar || '#0066cc'});"></div></td><td><div class="swatch" style="background-color: ${preset?.DarkProgressBar || '#4a9eff'};"></div></td></tr>
        <tr><td class="label-col">BG Cover</td><td class="var-col">--*-bg-cover</td><td><div class="swatch" style="background-color: ${lightBgCover};"></div></td><td><div class="swatch" style="background-color: var(--bg-cover, ${lightBgCover});"></div></td><td><div class="swatch" style="background-color: ${darkBgCover};"></div></td></tr>
        <tr><td class="label-col">BG Title</td><td class="var-col">--*-bg-title</td><td><div class="swatch" style="background-color: ${lightBgTitle};"></div></td><td><div class="swatch" style="background-color: var(--bg-title, ${lightBgTitle});"></div></td><td><div class="swatch" style="background-color: ${darkBgTitle};"></div></td></tr>
        <tr><td class="label-col">BG Section</td><td class="var-col">--*-bg-section</td><td><div class="swatch" style="background-color: ${lightBgSection};"></div></td><td><div class="swatch" style="background-color: var(--bg-section, ${lightBgSection});"></div></td><td><div class="swatch" style="background-color: ${darkBgSection};"></div></td></tr>
      </tbody>
    </table>
  </div>

  <div class="section">
    <div class="section-title">CSS Variables Being Used</div>
    <p>These are the actual CSS variables from your theme:</p>
    <pre style="margin-top: 15px; padding: 15px; background: rgba(0,0,0,0.3); border-radius: 4px; overflow-x: auto;">
Light Colors:
  --light-background: ${preset?.LightBackgroundColor || 'not set'}
  --light-body-text: ${preset?.LightBodyTextColor || 'not set'}
  --light-title-text: ${preset?.LightTitleTextColor || 'not set'}
  --light-h1-color: ${preset?.LightTitleTextColor || 'not set'}
  --light-h2-color: ${preset?.LightTitleTextColor || 'not set'}
  --light-h3-color: ${preset?.LightBodyTextColor || 'not set'}
  --light-link-color: ${preset?.LightLinkColor || 'not set'}
  --light-bullet-color: ${preset?.LightBulletColor || 'not set'}

Dark Colors:
  --dark-background: ${preset?.DarkBackgroundColor || 'not set'}
  --dark-body-text: ${preset?.DarkBodyTextColor || 'not set'}
  --dark-title-text: ${preset?.DarkTitleTextColor || 'not set'}
  --dark-h1-color: ${preset?.DarkTitleTextColor || 'not set'}
  --dark-h2-color: ${preset?.DarkTitleTextColor || 'not set'}
  --dark-h3-color: ${preset?.DarkBodyTextColor || 'not set'}
  --dark-link-color: ${preset?.DarkLinkColor || 'not set'}
  --dark-bullet-color: ${preset?.DarkBulletColor || 'not set'}
    </pre>
  </div>



  <div class="section">
    <div class="section-title">Text Elements (Using Dynamic Variables)</div>
    <div class="elements-grid">
      <div class="element-test">
        <div class="element-label">Paragraph</div>
        <p class="test-p">This is paragraph text using --body-text</p>
      </div>
      <div class="element-test">
        <div class="element-label">H1 Heading</div>
        <div class="test-h1">H1 using --h1-color</div>
      </div>
      <div class="element-test">
        <div class="element-label">H2 Heading</div>
        <div class="test-h2">H2 using --h2-color</div>
      </div>
      <div class="element-test">
        <div class="element-label">H3 Heading</div>
        <div class="test-h3">H3 using --h3-color</div>
      </div>
      <div class="element-test">
        <div class="element-label">Link</div>
        <a class="test-a" href="#">Link using --link-color</a>
      </div>
      <div class="element-test">
        <div class="element-label">Emphasis</div>
        <em class="test-em">Emphasized text</em>
      </div>
      <div class="element-test">
        <div class="element-label">Strong</div>
        <strong class="test-strong">Strong text</strong>
      </div>
      <div class="element-test">
        <div class="element-label">Code</div>
        <code class="test-code">code using --body-text</code>
      </div>
    </div>
  </div>

  <script>
    const html = document.documentElement;
    const themeToggle = document.getElementById('themeToggle');
    const modeIndicator = document.getElementById('modeIndicator');
    
    function updateHeaderHighlight() {
      const isLight = html.classList.contains('light');
      const lightHeader = document.querySelector('.check-grid th.highlight-light');
      const darkHeaders = document.querySelectorAll('.check-grid th.highlight-dark');
      
      if (isLight) {
        lightHeader.style.background = 'rgba(100, 200, 100, 0.3)';
        lightHeader.style.border = '2px solid rgba(100, 200, 100, 0.6)';
        darkHeaders.forEach(h => {
          h.style.background = 'rgba(255, 255, 255, 0.1)';
          h.style.border = '1px solid rgba(255, 255, 255, 0.2)';
        });
        modeIndicator.textContent = 'LIGHT MODE';
        modeIndicator.style.background = 'rgba(100, 200, 100, 0.3)';
      } else {
        lightHeader.style.background = 'rgba(255, 255, 255, 0.1)';
        lightHeader.style.border = '1px solid rgba(255, 255, 255, 0.2)';
        darkHeaders.forEach(h => {
          h.style.background = 'rgba(100, 150, 200, 0.3)';
          h.style.border = '2px solid rgba(100, 150, 200, 0.6)';
        });
        modeIndicator.textContent = 'DARK MODE';
        modeIndicator.style.background = 'rgba(100, 150, 200, 0.3)';
      }
    }
    
    // Load saved theme preference
    const savedTheme = localStorage.getItem('test-theme') || 'dark';
    if (savedTheme === 'light') {
      html.classList.add('light');
    } else {
      html.classList.add('dark');
    }
    updateHeaderHighlight();
    
    // Toggle theme on button click
    themeToggle.addEventListener('click', () => {
      const isLight = html.classList.contains('light');
      if (isLight) {
        html.classList.remove('light');
        html.classList.add('dark');
        themeToggle.textContent = '🌙 Toggle Dark/Light';
        localStorage.setItem('test-theme', 'dark');
      } else {
        html.classList.add('light');
        html.classList.remove('dark');
        themeToggle.textContent = '☀️ Toggle Dark/Light';
        localStorage.setItem('test-theme', 'light');
      }
      updateHeaderHighlight();
    });
  </script>
</body>
</html>`;
  }
}
