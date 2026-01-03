import { TFile, Notice } from 'obsidian';
import { Presentation, Theme } from '../types';
import { SlideRenderer } from '../renderer/SlideRenderer';
import { SlideParser } from '../parser/SlideParser';

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
  private parser: SlideParser;
  private currentSlideIndex: number = 0;
  private mouseIdleTimeout: ReturnType<typeof setTimeout> | null = null;
  
  constructor() {
    this.parser = new SlideParser();
  }
  
  /**
   * Open a new presentation window
   */
  async open(presentation: Presentation, theme: Theme | null, sourceFile?: TFile, app?: any, startSlide: number = 0): Promise<void> {
    this.currentSlideIndex = startSlide;
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
      },
      show: false, // Don't show until ready
    });
    
    // Store reference for ESC key handling
    const win = this.win;
    
    // Render the presentation HTML
    const renderer = new SlideRenderer(presentation, theme || undefined);
    const html = this.generatePresentationHTML(presentation, renderer, theme, startSlide);
    
    // Load the HTML content
    this.win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    
    // Show window when ready
    this.win.once('ready-to-show', () => {
      this.win.show();
      this.win.focus();
    });
    
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
    
    // Set up live updates if we have a source file
    if (sourceFile && app) {
      this.setupLiveUpdates(sourceFile, app, theme);
    }
  }
  
  /**
   * Generate the complete HTML for the presentation window
   */
  private generatePresentationHTML(presentation: Presentation, renderer: SlideRenderer, theme: Theme | null, startSlide: number = 0): string {
    const slidesHTML = presentation.slides.map((slide, index) => {
      return renderer.renderThumbnailHTML(slide, index);
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
      
      /* Make the entire window draggable by default */
      body {
        -webkit-app-region: drag;
      }
      
      /* Exclude interactive elements from dragging */
      iframe, button, a, input, select, textarea, .no-drag {
        -webkit-app-region: no-drag;
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
        pointer-events: none; /* Prevent iframe from capturing keyboard/mouse */
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
        let currentSlide = ${startSlide};
        const totalSlides = ${totalSlides};
        let mouseIdleTimeout = null;
        
        function showSlide(index) {
          if (index < 0) index = 0;
          if (index >= totalSlides) index = totalSlides - 1;
          
          const frames = document.querySelectorAll('.slide-frame');
          frames.forEach((frame, i) => {
            frame.classList.toggle('active', i === index);
          });
          
          currentSlide = index;
          document.getElementById('currentSlide').textContent = currentSlide + 1;
        }
        
        function nextSlide() {
          showSlide(currentSlide + 1);
        }
        
        function previousSlide() {
          showSlide(currentSlide - 1);
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
              showSlide(totalSlides - 1);
              showUI();
              break;
            // ESC is handled at window level via before-input-event
          }
        });
        
        // Click navigation (left side = back, right side = forward)
        document.addEventListener('click', (e) => {
          const x = e.clientX;
          const width = window.innerWidth;
          
          if (x < width / 3) {
            previousSlide();
          } else if (x > width * 2 / 3) {
            nextSlide();
          }
          showUI();
        });
        
        // Mouse movement shows UI
        document.addEventListener('mousemove', () => {
          showUI();
        });
        
        // Initial UI show
        showUI();
        
        // Ensure focus on body for keyboard events
        document.body.tabIndex = 0;
        document.body.focus();
        
        // Re-focus on click anywhere
        document.addEventListener('click', () => {
          document.body.focus();
        });
      })();
    `;
  }
  
  /**
   * Set up live updates when source file changes
   */
  private setupLiveUpdates(sourceFile: TFile, app: any, theme: Theme | null): void {
    const handler = async (file: any) => {
      if (file.path === sourceFile.path && this.win && !this.win.isDestroyed()) {
        try {
          const content = await app.vault.read(file);
          const presentation = this.parser.parse(content);
          const renderer = new SlideRenderer(presentation, theme || undefined);
          const html = this.generatePresentationHTML(presentation, renderer, theme);
          
          this.win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
        } catch (error) {
          console.error('Failed to update presentation window:', error);
        }
      }
    };
    
    app.vault.on('modify', handler);
    
    // Clean up when window closes
    if (this.win) {
      this.win.on('closed', () => {
        app.vault.off('modify', handler);
      });
    }
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
