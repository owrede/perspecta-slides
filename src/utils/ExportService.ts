import { App, Notice, TFile, TFolder, FileSystemAdapter } from 'obsidian';
import { Presentation, Theme } from '../types';
import { SlideRenderer, ImagePathResolver } from '../renderer/SlideRenderer';
import { FontManager } from './FontManager';

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

      // Create export folder
      const folderName = `${sourceFile.basename.replace(/\.md$/, '')}-export`;
      const exportFolder = await this.createExportFolder(sourceFile, folderName);
      const exportPath = `${sourceFile.parent?.path || ''}/${folderName}`;

      // Track extracted images
      const extractedImages: ExtractedImage[] = [];

      // Render all slides and extract images
      const slides = await Promise.all(
        presentation.slides.map(async (slide, idx) => {
          let html = renderer.renderPresentationSlideHTML(slide, idx);
          
          // Inject theme toggle CSS into each slide's HTML
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
        fontCSS
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
   * Create export folder
   */
  private async createExportFolder(sourceFile: TFile, folderName: string): Promise<TFolder> {
    const parentPath = sourceFile.parent?.path || '';
    const folderPath = parentPath ? `${parentPath}/${folderName}` : folderName;

    try {
      const existing = this.app.vault.getAbstractFileByPath(folderPath);
      if (existing instanceof TFolder) {
        return existing;
      }
    } catch (e) {
      // Folder doesn't exist, create it
    }

    return await this.app.vault.createFolder(folderPath);
  }

  /**
   * Inject theme toggle CSS into slide HTML
   */
  private injectThemeToggleCSS(html: string): string {
    const themeToggleCSS = `
    <style>
      /* Light mode color overrides - use html.light for cascade */
      html.light {
        color-scheme: light;
      }
      html.light body {
        background-color: var(--light-background, #fff) !important;
        color: var(--light-body-text, #000) !important;
      }
      html.light h1, html.light h2, html.light h3, html.light h4, html.light h5, html.light h5 {
        color: var(--light-title-text, var(--light-h1-color, #000)) !important;
      }
      html.light a {
        color: var(--light-link-color, #0066cc) !important;
      }
      html.light ul li:before {
        color: var(--light-bullet-color, #0066cc) !important;
      }
      html.light blockquote {
        border-color: var(--light-blockquote-border, #ccc) !important;
      }
      html.light table thead {
        background-color: var(--light-table-header-bg, #f0f0f0) !important;
      }
      html.light code {
        border-color: var(--light-code-border, #ccc) !important;
      }
      /* All container divs in light mode */
      html.light .cover-container,
      html.light .title-container,
      html.light .section-container,
      html.light section {
        background-color: var(--light-background, #fff) !important;
        color: var(--light-body-text, #000) !important;
      }
      html.light .cover-container {
        background: var(--light-bg-cover, var(--light-background, #fff)) !important;
      }
      html.light .title-container {
        background: var(--light-bg-title, var(--light-background, #fff)) !important;
      }
      html.light .section-container {
        background: var(--light-bg-section, var(--light-background, #fff)) !important;
      }
      
      /* Dark mode color overrides - use html.dark for cascade */
      html.dark {
        color-scheme: dark;
      }
      html.dark body {
        background-color: var(--dark-background, #000) !important;
        color: var(--dark-body-text, #fff) !important;
      }
      html.dark h1, html.dark h2, html.dark h3, html.dark h4, html.dark h5, html.dark h6 {
        color: var(--dark-title-text, var(--dark-h1-color, #fff)) !important;
      }
      html.dark a {
        color: var(--dark-link-color, #4a9eff) !important;
      }
      html.dark ul li:before {
        color: var(--dark-bullet-color, #4a9eff) !important;
      }
      html.dark blockquote {
        border-color: var(--dark-blockquote-border, #666) !important;
      }
      html.dark table thead {
        background-color: var(--dark-table-header-bg, #333) !important;
      }
      html.dark code {
        border-color: var(--dark-code-border, #666) !important;
      }
      /* All container divs in dark mode */
      html.dark .cover-container,
      html.dark .title-container,
      html.dark .section-container,
      html.dark section {
        background-color: var(--dark-background, #000) !important;
        color: var(--dark-body-text, #fff) !important;
      }
      html.dark .cover-container {
        background: var(--dark-bg-cover, var(--dark-background, #000)) !important;
      }
      html.dark .title-container {
        background: var(--dark-bg-title, var(--dark-background, #000)) !important;
      }
      html.dark .section-container {
        background: var(--dark-bg-section, var(--dark-background, #000)) !important;
      }
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

    return `
      :root {
        --light-background: ${preset.LightBackgroundColor};
        --dark-background: ${preset.DarkBackgroundColor};
        --light-body-text: ${preset.LightBodyTextColor};
        --dark-body-text: ${preset.DarkBodyTextColor};
        --light-title-text: ${preset.LightTitleTextColor};
        --dark-title-text: ${preset.DarkTitleTextColor};
        --light-link-color: ${preset.LightLinkColor};
        --light-bullet-color: ${preset.LightBulletColor};
        --light-blockquote-border: ${preset.LightBlockquoteBorder};
        --light-table-header-bg: ${preset.LightTableHeaderBg};
        --light-code-border: ${preset.LightCodeBorder};
        --light-progress-bar: ${preset.LightProgressBar};
        --dark-link-color: ${preset.DarkLinkColor};
        --dark-bullet-color: ${preset.DarkBulletColor};
        --dark-blockquote-border: ${preset.DarkBlockquoteBorder};
        --dark-table-header-bg: ${preset.DarkTableHeaderBg};
        --dark-code-border: ${preset.DarkCodeBorder};
        --dark-progress-bar: ${preset.DarkProgressBar};
        --title-font: ${theme.template.TitleFont};
        --body-font: ${theme.template.BodyFont};
      }

      /* Light mode overrides */
      html.light-mode {
        --background: var(--light-background);
        --body-text: var(--light-body-text);
        --title-text: var(--light-title-text);
        --link-color: var(--light-link-color);
        --bullet-color: var(--light-bullet-color);
        --blockquote-border: var(--light-blockquote-border);
        --table-header-bg: var(--light-table-header-bg);
        --code-border: var(--light-code-border);
        --progress-bar: var(--light-progress-bar);
      }

      /* Dark mode overrides */
      html.dark-mode {
        --background: var(--dark-background);
        --body-text: var(--dark-body-text);
        --title-text: var(--dark-title-text);
        --link-color: var(--dark-link-color);
        --bullet-color: var(--dark-bullet-color);
        --blockquote-border: var(--dark-blockquote-border);
        --table-header-bg: var(--dark-table-header-bg);
        --code-border: var(--dark-code-border);
        --progress-bar: var(--dark-progress-bar);
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
    fontCSS: string
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
  </style>
</head>
<body>
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
        background: var(--dark-background, #000);
        color: var(--dark-body-text, #fff);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        overflow: hidden;
        transition: background-color 0.3s ease, color 0.3s ease;
      }

      html.light-mode, html.light-mode body {
        background: var(--light-background, #fff) !important;
        color: var(--light-body-text, #000) !important;
      }

      html.light-mode {
        color-scheme: light;
      }

      html.dark-mode {
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
        border-top: 1px solid #333;
      }

      html.light-mode .nav-controls {
        background: rgba(255, 255, 255, 0.8);
        border-top-color: #ddd;
      }

      .theme-toggle {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        border: none;
        background: transparent;
        color: #999;
        cursor: pointer;
        border-radius: 4px;
        transition: all 0.2s ease;
        padding: 0;
        flex-shrink: 0;
      }

      .theme-toggle:hover {
        color: #fff;
        background: rgba(255, 255, 255, 0.1);
      }

      html.light-mode .theme-toggle {
        color: #666;
      }

      html.light-mode .theme-toggle:hover {
        color: #000;
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

      html.light-mode .sun-icon {
        opacity: 1;
        transform: rotate(0deg);
      }

      .moon-icon {
        opacity: 1;
        transform: rotate(0deg);
        transition: opacity 0.3s ease, transform 0.3s ease;
      }

      html.light-mode .moon-icon {
        opacity: 0;
        transform: rotate(180deg);
      }

      .slide-counter {
        font-size: 14px;
        color: #999;
        min-width: 60px;
        margin-left: auto;
      }

      html.light-mode .slide-counter {
        color: #666;
      }

      .progress-bar {
        flex: 1;
        height: 3px;
        background: #333;
        border-radius: 2px;
        margin: 0 20px;
        overflow: hidden;
      }

      html.light-mode .progress-bar {
        background: #ddd;
      }

      .progress-fill {
        height: 100%;
        background: #4a9eff;
        width: 0%;
        transition: width 0.3s ease;
      }

      html.light-mode .progress-fill {
        background: #0066cc;
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

      html.light-mode .help-overlay {
        background: rgba(255, 255, 255, 0.95);
      }

      .help-overlay.active {
        display: flex;
      }

      .help-content {
        background: #1a1a1a;
        border: 1px solid #333;
        border-radius: 8px;
        padding: 30px;
        max-width: 400px;
        color: #fff;
      }

      html.light-mode .help-content {
        background: #fff;
        border: 1px solid #ddd;
        color: #000;
      }

      .help-content h2 {
        margin-bottom: 20px;
        font-size: 24px;
      }

      .help-content ul {
        list-style: none;
      }

      .help-content li {
        margin-bottom: 12px;
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .help-content kbd {
        background: #333;
        border: 1px solid #555;
        border-radius: 4px;
        padding: 4px 8px;
        font-family: monospace;
        font-size: 12px;
        min-width: 40px;
        text-align: center;
        color: #fff;
      }

      html.light-mode .help-content kbd {
        background: #f0f0f0;
        border: 1px solid #ccc;
        color: #000;
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
            document.querySelector('.presentation-container').requestFullscreen();
          }
        });

        // Theme toggle
        const html = document.documentElement;
        const themeToggle = document.getElementById('themeToggle');
        
        function applyThemeToIframes(isLight) {
          // Apply theme to all slide iframes by toggling html class
          const iframes = document.querySelectorAll('.slide iframe');
          iframes.forEach(iframe => {
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
              // Iframe might not be loaded yet or cross-origin
            }
          });
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
          if (isLight) {
            html.classList.remove('light');
            html.classList.add('dark');
            applyThemeToIframes(false);
            localStorage.setItem('presentation-theme', 'dark');
          } else {
            html.classList.add('light');
            html.classList.remove('dark');
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
}
