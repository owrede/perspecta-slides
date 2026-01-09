import { TFile, Notice } from 'obsidian';
import { getDebugService } from '../utils/DebugService';
import { Presentation, Theme, PresentationFrontmatter } from '../types';
import { SlideRenderer, ImagePathResolver } from '../renderer/SlideRenderer';
import {
  PresentationCache,
  buildPresentationCache,
  diffPresentations,
  requiresFullRender
} from '../utils/SlideHasher';

// Access Electron from the global require in Obsidian's context
import { Platform } from 'obsidian';
declare const require: NodeRequire;

/**
 * PresentationWindow - Opens a frameless Electron window for fullscreen presentation
 * 
 * Features:
 * - Frameless window with draggable titlebar
 * - Keyboard navigation (arrow keys, space, escape to close)
 * - Link clicking works
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
  private fontWeightsCache: Map<string, number[]> = new Map();
  private onSlideChanged: ((index: number) => void) | null = null;

  public getPresentation(): Presentation | null {
    return this.presentation;
  }

  setImagePathResolver(resolver: ImagePathResolver): void {
    this.imagePathResolver = resolver;
  }

  setCustomFontCSS(css: string): void {
    this.customFontCSS = css;
  }

  setFontWeightsCache(cache: Map<string, number[]>): void {
    this.fontWeightsCache = cache;
  }

  setOnSlideChanged(callback: (index: number) => void): void {
    this.onSlideChanged = callback;
  }

  private createRenderer(presentation: Presentation, theme: Theme | null): SlideRenderer {
    const renderer = new SlideRenderer(
      presentation,
      theme || undefined,
      this.imagePathResolver || undefined
    );
    if (this.customFontCSS) {
      renderer.setCustomFontCSS(this.customFontCSS);
    }
    if (this.fontWeightsCache.size > 0) {
      renderer.setFontWeightsCache(this.fontWeightsCache);
    }
    renderer.setSystemColorScheme(this.getSystemColorScheme());
    return renderer;
  }

  private getSystemColorScheme(): 'light' | 'dark' {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  }

  async open(presentation: Presentation, theme: Theme | null, sourceFile?: TFile, startSlide: number = 0): Promise<void> {
    this.presentation = presentation;
    this.currentSlideIndex = startSlide;
    this.currentTheme = theme;
    this.presentationCache = buildPresentationCache(presentation);

    if (!Platform.isDesktop) {
      new Notice('External presentation windows are only available on Desktop.');
      return;
    }

    const electron = require('electron');
    const remote = electron.remote || (require as any)('@electron/remote');
    const { BrowserWindow, screen } = remote;

    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

    const aspectRatio = 16 / 9;
    let windowWidth = Math.min(screenWidth * 0.9, 1920);
    let windowHeight = windowWidth / aspectRatio;

    if (windowHeight > screenHeight * 0.9) {
      windowHeight = screenHeight * 0.9;
      windowWidth = windowHeight * aspectRatio;
    }

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

    const renderer = this.createRenderer(presentation, theme);
    const html = this.generatePresentationHTML(presentation, renderer, theme, startSlide);
    await this.loadHTMLContent(html);

    const debug = getDebugService();

    this.win.once('ready-to-show', () => {
      debug.log('presentation-window', 'ready-to-show event fired');
      this.win.show();
      this.win.focus();
    });

    setTimeout(() => {
      if (this.win && !this.win.isDestroyed() && !this.win.isVisible()) {
        debug.log('presentation-window', 'Fallback: showing window after timeout');
        this.win.show();
        this.win.focus();
      }
    }, 1000);

    this.win.on('closed', () => {
      this.win = null;
    });

    // Track pressed keys to handle each keypress independently
    const pressedKeys = new Set<string>();

    this.win.webContents.on('before-input-event', (event: any, input: any) => {
      const key = input.key.toLowerCase();

      if (input.type === 'keyDown') {
        // Ignore auto-repeat events (held keys) - only respond to initial keydown
        if (input.isAutoRepeat) {
          return;
        }

        // Only process if this key wasn't already pressed
        if (pressedKeys.has(key)) {
          return;
        }

        pressedKeys.add(key);

        switch (key) {
          case 'arrowright':
          case 'arrowdown':
          case ' ':
          case 'pagedown':
            event.preventDefault();
            this.nextSlide();
            break;
          case 'arrowleft':
          case 'arrowup':
          case 'pageup':
            event.preventDefault();
            this.previousSlide();
            break;
          case 'home':
            event.preventDefault();
            this.goToSlide(0);
            break;
          case 'end':
            event.preventDefault();
            this.goToSlide(this.presentation?.slides.length ? this.presentation.slides.length - 1 : 0);
            break;
          case 'escape':
            event.preventDefault();
            if (this.win.isFullScreen()) {
              this.win.setFullScreen(false);
            } else {
              this.win.close();
            }
            break;
        }
      } else if (input.type === 'keyUp') {
        // Remove key from pressed set when released
        pressedKeys.delete(key);
      }
    });

    // Handle link clicks - open external URLs in system browser
    const { shell } = electron;
    this.win.webContents.on('will-navigate', (event: any, url: string) => {
      event.preventDefault();
      if (url.startsWith('http://') || url.startsWith('https://')) {
        shell.openExternal(url);
      }
    });

    this.win.webContents.setWindowOpenHandler(({ url }: { url: string }) => {
      if (url.startsWith('http://') || url.startsWith('https://')) {
        shell.openExternal(url);
      }
      return { action: 'deny' };
    });
  }

  private nextSlide(): void {
    if (!this.presentation) return;
    this.goToSlide(this.currentSlideIndex + 1);
  }

  private previousSlide(): void {
    if (!this.presentation) return;
    this.goToSlide(this.currentSlideIndex - 1);
  }

  public goToSlide(index: number): void {
    const debug = getDebugService();
    debug.log('presentation-window', `[PresentationWindow.goToSlide] called with index ${index}`);

    if (!this.presentation) {
      debug.warn('presentation-window', '[PresentationWindow.goToSlide] No presentation loaded');
      return;
    }
    if (index < 0) index = 0;
    if (index >= this.presentation.slides.length) index = this.presentation.slides.length - 1;

    this.currentSlideIndex = index;

    // Notify any listeners that slide changed (e.g., presenter window)
    if (this.onSlideChanged) {
      debug.log('presentation-window', `[PresentationWindow.goToSlide] Invoking onSlideChanged callback with index ${index}`);
      this.onSlideChanged(index);
    }

    if (this.win && !this.win.isDestroyed()) {
      debug.log('presentation-window', `[PresentationWindow.goToSlide] Executing showSlide(${index}) in window`);
      this.win.webContents.executeJavaScript(`showSlide(${index})`).then(() => {
        debug.log('presentation-window', `[PresentationWindow.goToSlide] showSlide(${index}) executed successfully`);
      }).catch((e: any) => {
        debug.error('presentation-window', `[PresentationWindow.goToSlide] Error executing showSlide: ${e}`);
      });
    } else {
      debug.warn('presentation-window', '[PresentationWindow.goToSlide] Window is null or destroyed');
    }
  }

  private async loadHTMLContent(html: string): Promise<void> {
    const debug = getDebugService();
    if (!this.win) {
      debug.error('presentation-window', 'Cannot load HTML: win is null');
      return;
    }

    try {
      await this.win.loadURL('about:blank');
      const escapedHtml = JSON.stringify(html);

      await this.win.webContents.executeJavaScript(`
        (function() {
          document.open();
          document.write(${escapedHtml});
          document.close();
          return 'loaded';
        })();
      `);
    } catch (error) {
      debug.error('presentation-window', 'Failed to load HTML content:', error);
      new Notice('Failed to open presentation window.');
    }
  }

  private generatePresentationHTML(presentation: Presentation, renderer: SlideRenderer, theme: Theme | null, startSlide: number = 0): string {
    const slidesHTML = presentation.slides.map((slide, index) => {
      return renderer.renderPresentationSlideHTML(slide, index);
    });

    const themeCSS = theme ? this.generateThemeVariables(theme) : '';
    const lockedAspectRatioCSS = this.getLockedAspectRatioCSS(presentation.frontmatter);

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${this.escapeHtml(presentation.frontmatter.title || 'Presentation')}</title>
  <style>
    ${this.getPresentationWindowStyles()}
    ${themeCSS}
    ${lockedAspectRatioCSS}
  </style>
</head>
<body>
  <div class="titlebar"></div>
  <div class="presentation-container">
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
        user-select: none;
        -webkit-user-select: none;
      }
      
      /* Draggable titlebar at top - overlay, doesn't affect layout */
      .titlebar {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        height: 40px;
        background-color: rgba(255, 255, 255, 0);
        -webkit-app-region: drag;
        z-index: 10001;
        pointer-events: none;
        transition: background-color 0.3s ease;
      }
      
      .titlebar.visible {
        background-color: rgba(255, 255, 255, 0.35);
        pointer-events: auto;
      }
      
      .presentation-container {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
      }
      
      .slides-container {
        position: relative;
        width: 100%;
        height: 100%;
      }
      
      .slide-frame {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        opacity: 0;
        pointer-events: none !important;
        transition: opacity 0.3s ease;
        z-index: -1;
      }
      
      .slide-frame.active {
        opacity: 1;
        pointer-events: auto !important;
        z-index: 1;
      }
      
      .slide-frame iframe {
        width: 100%;
        height: 100%;
        border: none;
        background: transparent;
      }
      
      .slide-counter {
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: rgba(0, 0, 0, 0.6);
        color: white;
        padding: 8px 16px;
        border-radius: 8px;
        font-size: 14px;
        z-index: 100;
      }
    `;
  }

  private getPresentationWindowScript(totalSlides: number, startSlide: number = 0): string {
    return `
      window.currentSlide = ${startSlide};
      window.totalSlides = ${totalSlides};
      
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
      
      // Show/hide drag zone based on mouse position and activity
      let titlebarHideTimeout;
      const titlebar = document.querySelector('.titlebar');
      const titlebarHeight = 40;
      const showTitlebarThreshold = window.innerHeight / 4;
      
      if (titlebar) {
        document.addEventListener('mousemove', (e) => {
          // Show titlebar if mouse is in upper portion of window
          if (e.clientY < showTitlebarThreshold) {
            if (!titlebar.classList.contains('visible')) {
              titlebar.classList.add('visible');
            }
            
            // Clear existing hide timeout
            if (titlebarHideTimeout) {
              clearTimeout(titlebarHideTimeout);
            }
            
            // Hide after 2 seconds of no movement
            titlebarHideTimeout = setTimeout(() => {
              titlebar.classList.remove('visible');
            }, 2000);
          }
        });
        
        // Also hide when mouse leaves the window
        document.addEventListener('mouseleave', () => {
          if (titlebarHideTimeout) {
            clearTimeout(titlebarHideTimeout);
          }
          titlebar.classList.remove('visible');
        });
      }
      
      // Expose for main process to call
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
      
      window.updateSlideCount = function(newTotal) {
        window.totalSlides = newTotal;
        document.getElementById('totalSlides').textContent = newTotal;
        if (window.currentSlide >= newTotal) {
          showSlide(newTotal - 1);
        }
      };
    `;
  }

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
    `;
  }

  private getLockedAspectRatioCSS(frontmatter: PresentationFrontmatter): string {
    if (!frontmatter.lockAspectRatio) {
      return '';
    }

    const aspectRatio = frontmatter.aspectRatio || '16:9';
    const ratios: Record<string, { width: number, height: number }> = {
      '16:9': { width: 16, height: 9 },
      '4:3': { width: 4, height: 3 },
      '16:10': { width: 16, height: 10 },
      'auto': { width: 0, height: 0 }
    };

    const ratio = ratios[aspectRatio];
    if (ratio.width === 0) {
      return ''; // 'auto' aspect ratio - no locking needed
    }

    return `
      .presentation-container {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 100%;
        background: #000;
        padding: 0;
        margin: 0;
      }
      
      .slides-container {
        position: relative;
        /* Maintain aspect ratio with automatic letterboxing/pillarboxing */
        aspect-ratio: ${ratio.width} / ${ratio.height};
        /* Calculate the largest size that fits in the viewport while maintaining aspect ratio */
        width: min(100vw, calc(100vh * ${ratio.width} / ${ratio.height}));
        height: min(100vh, calc(100vw * ${ratio.height} / ${ratio.width}));
      }
      
      .slide-frame {
        position: absolute !important;
        top: 0 !important;
        left: 0 !important;
        width: 100% !important;
        height: 100% !important;
      }
      
      .slide-frame iframe {
        width: 100% !important;
        height: 100% !important;
        border: none !important;
        background: transparent !important;
      }
    `;
  }

  async updateContent(presentation: Presentation, theme: Theme | null): Promise<void> {
    const debug = getDebugService();
    if (!this.win || this.win.isDestroyed()) return;

    if (!presentation.slides || presentation.slides.length === 0) {
      debug.warn('presentation-window', 'Cannot update presentation window: no slides');
      return;
    }

    try {
      let currentSlide = this.currentSlideIndex;
      try {
        const result = await this.win.webContents.executeJavaScript('window.currentSlide');
        if (typeof result === 'number' && !isNaN(result)) {
          currentSlide = result;
        }
      } catch (e) {
        // Use stored index if we can't get it from window
      }

      if (currentSlide < 0 || currentSlide >= presentation.slides.length) {
        currentSlide = Math.max(0, Math.min(currentSlide, presentation.slides.length - 1));
      }
      this.currentSlideIndex = currentSlide;

      if (this.presentationCache) {
        const diff = diffPresentations(this.presentationCache, presentation);

        if (diff.type === 'none') {
          return;
        }

        if (requiresFullRender(diff) || diff.type === 'structural') {
          await this.fullReload(presentation, theme, currentSlide);
          return;
        }

        if (diff.type === 'content-only') {
          const currentSlideModified = diff.modifiedIndices.includes(currentSlide);

          if (currentSlideModified) {
            const renderer = this.createRenderer(presentation, theme);
            const slideHTML = renderer.renderPresentationSlideHTML(presentation.slides[currentSlide], currentSlide);
            const escapedHTML = JSON.stringify(slideHTML);
            await this.win.webContents.executeJavaScript(
              `window.updateSlideContent(${currentSlide}, ${escapedHTML})`
            );
          }

          this.presentationCache = buildPresentationCache(presentation);
          this.currentTheme = theme;
          return;
        }
      }

      await this.fullReload(presentation, theme, currentSlide);

    } catch (error) {
      debug.error('presentation-window', `Failed to update presentation content: ${error}`);
    }
  }

  private async fullReload(presentation: Presentation, theme: Theme | null, currentSlide: number): Promise<void> {
    this.presentation = presentation;

    const renderer = this.createRenderer(presentation, theme);
    const html = this.generatePresentationHTML(presentation, renderer, theme, currentSlide);

    await this.loadHTMLContent(html);

    this.presentationCache = buildPresentationCache(presentation);
    this.currentTheme = theme;
  }

  close(): void {
    if (this.win && !this.win.isDestroyed()) {
      this.win.close();
      this.win = null;
    }
  }

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
