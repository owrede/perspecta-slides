import { TFile, Notice } from 'obsidian';
import { Presentation, Theme } from '../types';
import { SlideRenderer, ImagePathResolver } from '../renderer/SlideRenderer';
import {
  PresentationCache,
  buildPresentationCache,
  diffPresentations,
  requiresFullRender
} from '../utils/SlideHasher';

// Access Electron from the global require in Obsidian's context
declare const require: NodeRequire;

/**
 * PresentationWindow - Opens a frameless Electron window for fullscreen presentation
 * 
 * Features:
 * - Frameless window (no title bar)
 * - Traffic light buttons appear on hover (macOS) with auto-hide after 3s
 * - Window draggable by clicking non-interactive areas
 * - Keyboard navigation (arrow keys, escape to close)
 * - Live updates when source file changes
 */
export class PresentationWindow {
  private win: any = null; // Electron.BrowserWindow
  private currentSlideIndex: number = 0;
  private presentationCache: PresentationCache | null = null;
  private currentTheme: Theme | null = null;
  private imagePathResolver: ImagePathResolver | null = null;
  private presentation: Presentation | null = null;
  private customFontCSS: string = '';

  public getPresentation(): Presentation | null {
    return this.presentation;
  }

  /**
   * Set the image path resolver for wiki-link images
   */
  setImagePathResolver(resolver: ImagePathResolver): void {
    this.imagePathResolver = resolver;
  }

  /**
   * Set custom font CSS (e.g., @font-face rules for cached Google Fonts)
   */
  setCustomFontCSS(css: string): void {
    this.customFontCSS = css;
  }

  /**
   * Create a SlideRenderer with the image path resolver and custom font CSS
   */
  private createRenderer(presentation: Presentation, theme: Theme | null): SlideRenderer {
    const renderer = new SlideRenderer(
      presentation,
      theme || undefined,
      this.imagePathResolver || undefined
    );
    if (this.customFontCSS) {
      renderer.setCustomFontCSS(this.customFontCSS);
    }
    return renderer;
  }

  /**
   * Open a new presentation window
   */
  async open(presentation: Presentation, theme: Theme | null, sourceFile?: TFile, startSlide: number = 0): Promise<void> {
    this.presentation = presentation;
    this.currentSlideIndex = startSlide;
    this.currentTheme = theme;
    this.presentationCache = buildPresentationCache(presentation);
    
    // In Obsidian, we need to access Electron's remote module
    const electron = require('electron');
    const remote = electron.remote || (require as any)('@electron/remote');
    const { BrowserWindow, screen } = remote;

    // Get screen dimensions for optimal window size
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

    // Calculate 16:9 window size that fits the screen
    const aspectRatio = 16 / 9;
    let windowWidth = Math.min(screenWidth * 0.9, 1920);
    let windowHeight = windowWidth / aspectRatio;

    if (windowHeight > screenHeight * 0.9) {
      windowHeight = screenHeight * 0.9;
      windowWidth = windowHeight * aspectRatio;
    }

    // Create the frameless window
    this.win = new BrowserWindow({
      width: Math.round(windowWidth),
      height: Math.round(windowHeight),
      frame: false,
      titleBarStyle: process.platform === 'darwin' ? 'customButtonsOnHover' : 'hidden',
      trafficLightPosition: { x: 16, y: 16 },
      transparent: false,
      hasShadow: true,
      backgroundColor: '#000000',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: false,
      },
      show: false,
    });

    // Render the presentation HTML
    const renderer = this.createRenderer(presentation, theme);
    const html = this.generatePresentationHTML(presentation, renderer, theme, startSlide);

    // Load HTML via temp file to avoid data URL length limits
    await this.loadHTMLContent(html);

    // Show window when ready
    this.win.once('ready-to-show', () => {
      console.log('ready-to-show event fired');
      this.win.show();
      this.win.focus();
    });
    
    // Fallback: show window after a short delay if ready-to-show doesn't fire
    setTimeout(() => {
      if (this.win && !this.win.isDestroyed() && !this.win.isVisible()) {
        console.log('Fallback: showing window after timeout');
        this.win.show();
        this.win.focus();
      }
    }, 1000);

    // Handle window close
    this.win.on('closed', () => {
      this.win = null;
    });

    // Handle ESC key at the window level (before-input-event)
    this.win.webContents.on('before-input-event', (event: any, input: any) => {
      if (input.key === 'Escape' && input.type === 'keyDown') {
        event.preventDefault();
        if (this.win.isFullScreen()) {
          this.win.setFullScreen(false);
        } else if (this.win.isMaximized()) {
          this.win.unmaximize();
        } else {
          this.win.close();
        }
      }
    });
  }

  /**
   * Load HTML content into the window using document.write() to avoid data URL length limits
   * This is faster than writing temp files and has no size limit
   */
  private async loadHTMLContent(html: string): Promise<void> {
    if (!this.win) {
      console.error('Cannot load HTML: win is null');
      return;
    }

    try {
      // Load a blank page first, then inject the HTML via JavaScript
      // This avoids both file I/O and data URL length limits
      await this.win.loadURL('about:blank');
      
      // Inject the HTML content using document.write()
      // We need to escape the HTML for use in a JavaScript string
      const escapedHtml = JSON.stringify(html);
      await this.win.webContents.executeJavaScript(`
        document.open();
        document.write(${escapedHtml});
        document.close();
      `);
    } catch (error) {
      console.error('Failed to load HTML content:', error);
      new Notice('Failed to open presentation window.');
    }
  }

  /**
   * Generate the complete HTML for the presentation window
   */
  private generatePresentationHTML(presentation: Presentation, renderer: SlideRenderer, theme: Theme | null, startSlide: number = 0): string {
    const slidesHTML = presentation.slides.map((slide, index) => {
      return renderer.renderPresentationSlideHTML(slide, index);
    });

    const themeCSS = theme ? this.generateThemeVariables(theme) : '';

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${this.escapeHtml(presentation.frontmatter.title || 'Presentation')}</title>
  <style>
    ${this.getPresentationWindowStyles()}
    ${themeCSS}
  </style>
</head>
<body>
  <div class="presentation-window">
    <div class="slides-container" id="slidesContainer">
      ${presentation.slides.map((slide, index) => `
        <div class="slide-frame ${index === startSlide ? 'active' : ''}" data-index="${index}">
          <iframe 
            srcdoc="${this.escapeAttr(slidesHTML[index])}" 
            frameborder="0"
            scrolling="no"
          ></iframe>
        </div>
      `).join('')}
    </div>
    <!-- Drag overlay: handles window dragging, hides on double-click for text selection -->
    <div class="drag-overlay" id="dragOverlay"></div>
    <div class="slide-counter" id="slideCounter">
      <span id="currentSlide">${startSlide + 1}</span> / <span id="totalSlides">${presentation.slides.length}</span>
    </div>
  </div>
  <script>
    ${this.getPresentationWindowScript(presentation.slides.length, startSlide)}
  </script>
</body>
</html>`;
  }

  /**
   * Styles for the presentation window
   */
  private getPresentationWindowStyles(): string {
    return `
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      
      html, body {
        width: 100%;
        height: 100%;
        overflow: hidden;
        background: #000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      
      .presentation-window {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
      }
      
      .slides-container {
        width: 100%;
        height: 100%;
        position: relative;
      }
      
      .slide-frame {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.3s ease;
      }
      
      .slide-frame.active {
        opacity: 1;
        pointer-events: auto;
      }
      
      .slide-frame iframe {
        width: 100%;
        height: 100%;
        border: none;
        background: transparent;
        pointer-events: none; /* Disabled by default, enabled when drag overlay hidden */
      }
      
      /* Drag overlay - transparent layer for window dragging */
      .drag-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 100;
        -webkit-app-region: drag;
        cursor: grab;
      }
      
      .drag-overlay:active {
        cursor: grabbing;
      }
      
      .drag-overlay.hidden {
        display: none;
      }
      
      /* When overlay is hidden, enable iframe interaction */
      .drag-overlay.hidden ~ .slides-container .slide-frame.active iframe,
      body.selection-mode .slide-frame.active iframe {
        pointer-events: auto;
      }
      
      /* Slide counter - appears on mouse movement */
      .slide-counter {
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: rgba(0, 0, 0, 0.6);
        color: white;
        padding: 8px 16px;
        border-radius: 8px;
        font-size: 14px;
        opacity: 0;
        transition: opacity 0.3s ease;
        z-index: 1000;
        -webkit-app-region: no-drag;
      }
      
      body.show-ui .slide-counter {
        opacity: 1;
      }
      
      /* Traffic light area padding for macOS */
      @supports (-webkit-app-region: drag) {
        .presentation-window::before {
          content: '';
          position: fixed;
          top: 0;
          left: 0;
          width: 80px;
          height: 40px;
          z-index: 9999;
          -webkit-app-region: no-drag;
        }
      }
    `;
  }

  /**
   * JavaScript for the presentation window
   */
  private getPresentationWindowScript(totalSlides: number, startSlide: number = 0): string {
    return `
      (function() {
        // Expose to window for external access (live updates)
        window.currentSlide = ${startSlide};
        window.totalSlides = ${totalSlides};
        let mouseIdleTimeout = null;
        
        // Getter for local use
        function getCurrentSlide() { return window.currentSlide; }
        function setCurrentSlide(idx) { window.currentSlide = idx; }
        
        function showSlide(index) {
          if (index < 0) index = 0;
          if (index >= window.totalSlides) index = window.totalSlides - 1;
          
          const frames = document.querySelectorAll('.slide-frame');
          frames.forEach((frame, i) => {
            frame.classList.toggle('active', i === index);
          });
          
          window.currentSlide = index;
          document.getElementById('currentSlide').textContent = window.currentSlide + 1;
        }
        
        function nextSlide() {
          showSlide(window.currentSlide + 1);
        }
        
        function previousSlide() {
          showSlide(window.currentSlide - 1);
        }
        
        function showUI() {
          document.body.classList.add('show-ui');
          
          if (mouseIdleTimeout) {
            clearTimeout(mouseIdleTimeout);
          }
          
          mouseIdleTimeout = setTimeout(() => {
            document.body.classList.remove('show-ui');
          }, 3000);
        }
        
        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
          switch (e.key) {
            case 'ArrowRight':
            case 'ArrowDown':
            case ' ':
            case 'PageDown':
              e.preventDefault();
              nextSlide();
              showUI();
              break;
            case 'ArrowLeft':
            case 'ArrowUp':
            case 'PageUp':
              e.preventDefault();
              previousSlide();
              showUI();
              break;
            case 'Home':
              e.preventDefault();
              showSlide(0);
              showUI();
              break;
            case 'End':
              e.preventDefault();
              showSlide(window.totalSlides - 1);
              showUI();
              break;
            // ESC is handled at window level via before-input-event
          }
        });
        
        // Drag overlay management
        // By default: overlay visible = window can be dragged
        // On double-click: hide overlay = text selection enabled
        // Press Escape or click outside: show overlay again
        const dragOverlay = document.getElementById('dragOverlay');
        let selectionModeTimeout = null;
        
        function enterSelectionMode() {
          if (dragOverlay) {
            dragOverlay.classList.add('hidden');
            document.body.classList.add('selection-mode');
            // Enable pointer-events on active iframe
            const activeIframe = document.querySelector('.slide-frame.active iframe');
            if (activeIframe) {
              activeIframe.style.pointerEvents = 'auto';
            }
          }
        }
        
        function exitSelectionMode() {
          if (dragOverlay) {
            dragOverlay.classList.remove('hidden');
            document.body.classList.remove('selection-mode');
            // Disable pointer-events on all iframes
            document.querySelectorAll('.slide-frame iframe').forEach(iframe => {
              iframe.style.pointerEvents = 'none';
            });
            // Clear any text selection
            window.getSelection()?.removeAllRanges();
            // Re-focus body for keyboard nav
            document.body.focus();
          }
        }
        
        // Double-click on overlay enters selection mode
        if (dragOverlay) {
          dragOverlay.addEventListener('dblclick', (e) => {
            e.preventDefault();
            enterSelectionMode();
            showUI();
          });
        }
        
        // Single click on overlay just shows UI (and allows drag)
        if (dragOverlay) {
          dragOverlay.addEventListener('click', () => {
            showUI();
            document.body.focus();
          });
        }
        
        // Escape key exits selection mode (in addition to window close handling)
        // This is handled specially - we check selection mode first
        document.addEventListener('keydown', (e) => {
          if (e.key === 'Escape' && document.body.classList.contains('selection-mode')) {
            e.preventDefault();
            e.stopPropagation();
            exitSelectionMode();
          }
        }, true); // Use capture to handle before other listeners
        
        // Mouse movement shows UI
        document.addEventListener('mousemove', () => {
          showUI();
        });
        
        // Initial UI show
        showUI();
        
        // Ensure focus on body for keyboard events
        document.body.tabIndex = 0;
        document.body.focus();
        
        // Expose function to update a single slide's iframe (for live updates)
        window.updateSlideContent = function(index, html) {
          const frames = document.querySelectorAll('.slide-frame');
          const frame = frames[index];
          if (frame) {
            const iframe = frame.querySelector('iframe');
            if (iframe) {
              iframe.srcdoc = html;
            }
          }
        };
        
        // Expose function to update slide count (when slides are added/removed)
        window.updateSlideCount = function(newTotal) {
          window.totalSlides = newTotal;
          document.getElementById('totalSlides').textContent = newTotal;
          // Clamp current slide if needed
          if (window.currentSlide >= newTotal) {
            showSlide(newTotal - 1);
          }
        };
      })();
    `;
  }

  /**
   * Generate theme CSS variables
   */
  private generateThemeVariables(theme: Theme): string {
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
        --accent1: ${preset.Accent1};
        --accent2: ${preset.Accent2};
        --title-font: ${theme.template.TitleFont};
        --body-font: ${theme.template.BodyFont};
      }
    `;
  }

  /**
   * Update the presentation content while preserving current slide.
   * Uses incremental updates when possible - only updates the currently displayed slide
   * if it was modified, otherwise does nothing.
   */
  async updateContent(presentation: Presentation, theme: Theme | null): Promise<void> {
    if (!this.win || this.win.isDestroyed()) return;

    // Guard against empty presentations
    if (!presentation.slides || presentation.slides.length === 0) {
      console.warn('Cannot update presentation window: no slides');
      return;
    }

    try {
      // Get current slide index from the window
      let currentSlide = this.currentSlideIndex;
      try {
        const result = await this.win.webContents.executeJavaScript('window.currentSlide');
        if (typeof result === 'number' && !isNaN(result)) {
          currentSlide = result;
        }
      } catch (e) {
        // Use stored index if we can't get it from window
      }

      // Ensure slide index is valid
      if (currentSlide < 0 || currentSlide >= presentation.slides.length) {
        currentSlide = Math.max(0, Math.min(currentSlide, presentation.slides.length - 1));
      }
      this.currentSlideIndex = currentSlide;

      // Check if we have a cache and can do incremental update
      if (this.presentationCache) {
        const diff = diffPresentations(this.presentationCache, presentation);

        // No changes - skip update entirely
        if (diff.type === 'none') {
          return;
        }

        // Theme changed or major structural changes - need full reload
        if (requiresFullRender(diff) || diff.type === 'structural') {
          await this.fullReload(presentation, theme, currentSlide);
          return;
        }

        // Content-only changes - check if current slide was modified
        if (diff.type === 'content-only') {
          const currentSlideModified = diff.modifiedIndices.includes(currentSlide);

          if (currentSlideModified) {
            // Only update the current slide's iframe
            const renderer = this.createRenderer(presentation, theme);
            const slideHTML = renderer.renderPresentationSlideHTML(presentation.slides[currentSlide], currentSlide);

            // Escape the HTML for JavaScript string
            const escapedHTML = JSON.stringify(slideHTML);
            await this.win.webContents.executeJavaScript(
              `window.updateSlideContent(${currentSlide}, ${escapedHTML})`
            );
          }
          // If current slide wasn't modified, we don't need to update anything visible

          // Update cache for next comparison
          this.presentationCache = buildPresentationCache(presentation);
          this.currentTheme = theme;
          return;
        }
      }

      // No cache (first update) - do full reload
      await this.fullReload(presentation, theme, currentSlide);

    } catch (error) {
      console.error('Failed to update presentation content:', error);
    }
  }

  /**
   * Specifically update just the frontmatter for live previews
   */
  async updateFrontmatter(frontmatter: any, theme: Theme | null): Promise<void> {
    if (!this.win || this.win.isDestroyed()) return;

    // For now, the simplest way is to trigger a re-render of the current slide
    // This will pick up the updated frontmatter which should be modified in the object passed here
    const currentSlide = this.currentSlideIndex;
    try {
      const result = await this.win.webContents.executeJavaScript('window.currentSlide');
      if (typeof result === 'number' && !isNaN(result)) {
        this.currentSlideIndex = result;
      }
    } catch (e) { }

    // We can't easily reach into the renderer without the full presentation object
    // but the main plugin has it.
  }

  /**
   * Perform a full reload of the presentation window
   */
  private async fullReload(presentation: Presentation, theme: Theme | null, currentSlide: number): Promise<void> {
    const renderer = this.createRenderer(presentation, theme);
    const html = this.generatePresentationHTML(presentation, renderer, theme, currentSlide);

    // Use temp file approach to avoid data URL length limits
    await this.loadHTMLContent(html);

    // Update cache
    this.presentationCache = buildPresentationCache(presentation);
    this.currentTheme = theme;
  }

  /**
   * Close the presentation window
   */
  close(): void {
    if (this.win && !this.win.isDestroyed()) {
      this.win.close();
      this.win = null;
    }
  }

  /**
   * Check if window is open
   */
  isOpen(): boolean {
    return this.win !== null && !this.win.isDestroyed();
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private escapeAttr(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}
