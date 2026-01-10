import { TFile, Notice } from 'obsidian';
import { getDebugService } from '../utils/DebugService';
import { Presentation, Theme, PresentationFrontmatter, Slide } from '../types';
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
 * PresenterWindow - Opens an Electron window for presenter view
 * 
 * Features:
 * - Vertical list of all slides with small thumbnails on the left
 * - Slide number badge next to each thumbnail
 * - Slide content and speaker notes displayed to the right
 * - All slides visible in one scrollable document
 * - Simple timer controls
 */
export class PresenterWindow {
  private win: any = null; // Electron.BrowserWindow
  private presentationCache: PresentationCache | null = null;
  private currentTheme: Theme | null = null;
  private imagePathResolver: ImagePathResolver | null = null;
  private presentation: Presentation | null = null;
  private customFontCSS: string = '';
  private fontWeightsCache: Map<string, number[]> = new Map();
  private onSlideChanged: ((index: number) => void) | null = null;
  private onWindowBoundsChanged: ((bounds: { x: number; y: number; width: number; height: number }) => void) | null = null;
  private onOpenPresentationWindow: (() => void) | null = null;
  private windowBounds: { x: number; y: number; width: number; height: number } | null = null;
  private ipcMainRef: any = null; // Cache ipcMain reference

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

  setOnWindowBoundsChanged(callback: (bounds: { x: number; y: number; width: number; height: number }) => void): void {
    this.onWindowBoundsChanged = callback;
  }

  setWindowBounds(bounds: { x: number; y: number; width: number; height: number } | null): void {
    this.windowBounds = bounds;
  }

  setOnOpenPresentationWindow(callback: () => void): void {
    this.onOpenPresentationWindow = callback;
  }

  notifySlideChange(slideIndex: number): void {
    const debug = getDebugService();

    if (!this.win || this.win.isDestroyed()) {
      debug.warn('presentation-window', '[PresenterWindow.notifySlideChange] Window is not open');
      return;
    }

    debug.log('presentation-window', `[PresenterWindow.notifySlideChange] Updating presenter view to slide ${slideIndex}`);

    // Execute the setActiveSlide function in the presenter window
    const jsCode = `setActiveSlide(${slideIndex});`;

    this.win.webContents.executeJavaScript(jsCode).catch((e: any) => {
      debug.error('presentation-window', `[PresenterWindow.notifySlideChange] Error: ${e}`);
    });
  }

  private injectCallbacksIntoWindow(): void {
    const debug = getDebugService();
    debug.log('presentation-window', '[PresenterWindow.injectCallbacksIntoWindow] CALLED');

    if (!this.win || this.win.isDestroyed()) {
      debug.warn('presentation-window', '[PresenterWindow] Cannot inject callbacks: window is destroyed');
      return;
    }

    debug.log('presentation-window', '[PresenterWindow] Setting up callback handlers via direct invocation');

    try {
      // Define handlers that will be called from the presenter window
      const slideChangedHandler = (index: number) => {
        debug.log('presentation-window', `[PresenterWindow] Slide changed to ${index}`);
        if (this.onSlideChanged) {
          this.onSlideChanged(index);
        }
      };

      const openPresentationHandler = () => {
        debug.log('presentation-window', '[PresenterWindow] Open presentation requested');
        if (this.onOpenPresentationWindow) {
          this.onOpenPresentationWindow();
        }
      };

      // Inject callback definitions into presenter window
      // These will be called by the presenter window's slide navigation code
      this.win.webContents.executeJavaScript(`
        (function() {
          window.__presenterCallbacks.onSlideChanged = function(index) {
            // Store the value so we can detect it changed
            window.__lastSlideChange = {index: index, timestamp: Date.now()};
          };
          window.__presenterCallbacks.onOpenPresentation = function() {
            window.__lastOpenPresentation = {timestamp: Date.now()};
          };
        })();
      `);

      // Set up a watcher that calls our handlers when values change in the presenter window
      // We'll use setInterval to periodically check
      let pollCount = 0;
      const checkInterval = setInterval(async () => {
        if (this.win && !this.win.isDestroyed()) {
          try {
            const result = await this.win.webContents.executeJavaScript(`
              (function() {
                const lastChange = window.__lastSlideChange;
                const lastOpen = window.__lastOpenPresentation;
                return {lastChange, lastOpen, hasCallbacks: !!window.__presenterCallbacks};
              })();
            `);

            pollCount++;
            if (pollCount % 10 === 0) {
              debug.log('presentation-window', `[Poll] Result: ${JSON.stringify(result)}`);
            }

            if (result && result.lastChange && result.lastChange.timestamp > ((this as any).__lastCheckTime || 0)) {
              (this as any).__lastCheckTime = result.lastChange.timestamp;
              debug.log('presentation-window', `[Poll] Detected slide change to ${result.lastChange.index}`);
              slideChangedHandler(result.lastChange.index);
            }
            if (result && result.lastOpen && result.lastOpen.timestamp > ((this as any).__lastCheckOpenTime || 0)) {
              (this as any).__lastCheckOpenTime = result.lastOpen.timestamp;
              debug.log('presentation-window', `[Poll] Detected open presentation request`);
              openPresentationHandler();
            }
          } catch (e: any) {
            debug.warn('presentation-window', `[Poll] Check failed: ${e}`);
            clearInterval(checkInterval);
          }
        } else {
          clearInterval(checkInterval);
        }
      }, 500);

      // Clean up interval when window closes
      this.win.once('closed', () => {
        clearInterval(checkInterval);
      });

      debug.log('presentation-window', '[PresenterWindow] Callback monitoring started');
    } catch (e) {
      debug.error('presentation-window', `Failed to inject callbacks: ${e}`);
    }
  }

  private setupIPCHandlers(ipcMain: any, debug: any): void {
    if (!ipcMain) {
      debug.error('presentation-window', '[PresenterWindow] Cannot setup IPC: ipcMain is null/undefined');
      return;
    }

    this.ipcMainRef = ipcMain;
    debug.log('presentation-window', '[PresenterWindow] Setting up IPC handlers');

    try {
      // Clean up any existing listeners
      ipcMain.removeAllListeners('presenter:slide-changed');
      ipcMain.removeAllListeners('presenter:open-presentation');
    } catch (e) {
      debug.warn('presentation-window', `Failed to remove existing listeners: ${e}`);
    }

    // Listen for slide changes from the presenter window UI
    ipcMain.on('presenter:slide-changed', (event: any, slideIndex: number) => {
      debug.log('presentation-window', `[PresenterWindow] IPC: slide-changed received with index ${slideIndex}`);
      if (this.onSlideChanged) {
        debug.log('presentation-window', `[PresenterWindow] Invoking onSlideChanged callback`);
        this.onSlideChanged(slideIndex);
      } else {
        debug.warn('presentation-window', '[PresenterWindow] onSlideChanged callback not set');
      }
    });

    // Listen for request to open presentation window
    ipcMain.on('presenter:open-presentation', (event: any) => {
      debug.log('presentation-window', '[PresenterWindow] IPC: open-presentation received');
      if (this.onOpenPresentationWindow) {
        debug.log('presentation-window', '[PresenterWindow] Invoking onOpenPresentationWindow callback');
        this.onOpenPresentationWindow();
      } else {
        debug.warn('presentation-window', '[PresenterWindow] onOpenPresentationWindow callback not set');
      }
    });

    debug.log('presentation-window', '[PresenterWindow] IPC handlers setup complete');
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

  async open(
    presentation: Presentation,
    theme: Theme | null,
    sourceFile?: TFile,
    startSlide: number = 0,
    fullscreenOnSecondaryDisplay: boolean = false
  ): Promise<void> {
    const debug = getDebugService();
    debug.log('presentation-window', '[PresenterWindow.open] CALLED - START OF METHOD');

    this.presentation = presentation;
    this.currentTheme = theme;
    this.presentationCache = buildPresentationCache(presentation);

    if (!Platform.isDesktop) {
      new Notice('External presenter windows are only available on Desktop.');
      return;
    }

    const electron = require('electron');

    // In renderer process, we need to get remote first, then access BrowserWindow/screen from it
    let remote = electron.remote;
    if (!remote) {
      try {
        remote = (require as any)('@electron/remote');
      } catch (e) {
        debug.error('presentation-window', `Failed to load @electron/remote: ${e}`);
        throw new Error('Cannot access Electron remote module');
      }
    }

    if (!remote) {
      debug.error('presentation-window', 'Electron remote module is not available');
      throw new Error('Electron remote module not available');
    }

    const { BrowserWindow, screen } = remote;
    const { ipcMain } = electron;
    const displays = screen.getAllDisplays();
    const primaryDisplay = screen.getPrimaryDisplay();

    let targetDisplay = primaryDisplay;
    let isFullscreen = fullscreenOnSecondaryDisplay;

    if (fullscreenOnSecondaryDisplay && displays.length > 1) {
      targetDisplay = displays[1];
    }

    const { width: screenWidth, height: screenHeight } = targetDisplay.workAreaSize;
    const { x: screenX, y: screenY } = targetDisplay.workArea;

    // Use saved bounds if available, otherwise use defaults
    let windowWidth = screenWidth * 0.65;
    let windowHeight = screenHeight * 0.75;
    let windowX = screenX + (screenWidth - windowWidth) / 2;
    let windowY = screenY + (screenHeight - windowHeight) / 2;

    if (this.windowBounds) {
      windowX = this.windowBounds.x;
      windowY = this.windowBounds.y;
      windowWidth = this.windowBounds.width;
      windowHeight = this.windowBounds.height;
    }

    debug.log('presentation-window', `[PresenterWindow] Creating window: ${windowWidth}x${windowHeight}`);

    try {
      this.win = new BrowserWindow({
        x: Math.round(windowX),
        y: Math.round(windowY),
        width: Math.round(windowWidth),
        height: Math.round(windowHeight),
        frame: true,
        titleBarStyle: process.platform === 'darwin' ? 'default' : 'default',
        transparent: false,
        hasShadow: true,
        backgroundColor: '#1a1a1a',
        webPreferences: {
          nodeIntegration: true,
          contextIsolation: false,
          webSecurity: false,
        },
        show: false,
      });
      debug.log('presentation-window', `[PresenterWindow] Window created successfully`);
    } catch (error) {
      debug.error('presentation-window', `[PresenterWindow] Failed to create window: ${error}`);
      throw error;
    }

    if (isFullscreen) {
      this.win.setFullScreen(true);
    }

    const renderer = this.createRenderer(presentation, theme);
    const html = this.generatePresenterHTML(presentation, renderer, theme);
    await this.loadHTMLContent(html);

    // After HTML is loaded, inject the callbacks into the presenter window
    debug.log('presentation-window', '[PresenterWindow] Injecting callbacks into presenter window');
    try {
      await this.win.webContents.executeJavaScript(`
         (function() {
           window.__presenterCallbacks = window.__presenterCallbacks || {};
         })();
       `);
    } catch (e) {
      debug.warn('presentation-window', `Failed to inject callback object: ${e}`);
    }

    try {
      debug.log('presentation-window', '[PresenterWindow] About to register ready-to-show handler');

      // Register ready-to-show handler
      const readyHandler = () => {
        debug.log('presentation-window', '[PresenterWindow] ready-to-show event fired');
        if (this.win && !this.win.isDestroyed()) {
          this.win.show();
          this.win.focus();

          // After window is shown, inject the actual callbacks
          debug.log('presentation-window', '[PresenterWindow] Window shown, calling injectCallbacksIntoWindow()');
          this.injectCallbacksIntoWindow();
        }
      };

      this.win.once('ready-to-show', readyHandler);
      debug.log('presentation-window', '[PresenterWindow] ready-to-show handler registered');

      // If window is already ready, call handler immediately
      // (this can happen if ready-to-show fired before we registered the handler)
      if (this.win.isReady && this.win.isReady()) {
        debug.log('presentation-window', '[PresenterWindow] Window already ready, calling handler immediately');
        readyHandler();
      }

      this.win.on('closed', () => {
        this.win = null;
      });

      // Save window bounds when resized or moved
      this.win.on('move', () => {
        if (this.win && !this.win.isDestroyed()) {
          const bounds = this.win.getBounds();
          if (this.onWindowBoundsChanged) {
            this.onWindowBoundsChanged(bounds);
          }
        }
      });

      this.win.on('resize', () => {
        if (this.win && !this.win.isDestroyed()) {
          const bounds = this.win.getBounds();
          if (this.onWindowBoundsChanged) {
            this.onWindowBoundsChanged(bounds);
          }
        }
      });
    } catch (e) {
      debug.error('presentation-window', `[PresenterWindow] Failed to set up basic events: ${e}`);
      throw e;
    }

    setTimeout(() => {
      if (this.win && !this.win.isDestroyed() && !this.win.isVisible()) {
        debug.log('presentation-window', 'Fallback: showing window after timeout');
        this.win.show();
        this.win.focus();

        // Inject callbacks after window is shown via fallback
        debug.log('presentation-window', '[PresenterWindow] Fallback: calling injectCallbacksIntoWindow()');
        this.injectCallbacksIntoWindow();
      }
    }, 1000);

    try {
      if (!this.win || this.win.isDestroyed()) {
        debug.error('presentation-window', '[PresenterWindow] Window was destroyed before setting up handlers');
        throw new Error('Window was destroyed');
      }

      this.win.webContents.on('before-input-event', (event: any, input: any): void => {
        const key = input.key.toLowerCase();
        if (input.type === 'keyDown' && !input.isAutoRepeat) {
          switch (key) {
            case 'escape':
              event.preventDefault();
              if (this.win.isFullScreen()) {
                this.win.setFullScreen(false);
              } else {
                this.win.close();
              }
              break;
          }
        }
      });

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

      debug.log('presentation-window', '[PresenterWindow] Window opened successfully');
    } catch (error) {
      debug.error('presentation-window', `[PresenterWindow] Failed to open: ${error}`);
      throw error;
    }

    try {
      debug.log('presentation-window', `[PresenterWindow] ipcMain available: ${!!ipcMain}`);

      if (ipcMain) {
        debug.log('presentation-window', '[PresenterWindow] Setting up IPC handlers from presenter window');
        this.setupIPCHandlers(ipcMain, debug);
      } else {
        // ipcMain is not available in renderer/plugin process
        // The presenter window will send messages via ipcRenderer.send()
        // and the main Obsidian process will receive them via ipcMain.on()
        // (handlers set up in main.ts onload)
        debug.log('presentation-window', '[PresenterWindow] ipcMain not available - using ipcRenderer to send messages to main process');
      }
    } catch (error) {
      debug.error('presentation-window', `[PresenterWindow] Error during IPC setup: ${error}`);
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
      debug.error('presentation-window', `Failed to load HTML: ${error}`);
    }
  }

  private generatePresenterHTML(
    presentation: Presentation,
    renderer: SlideRenderer,
    theme: Theme | null
  ): string {
    const styles = this.generatePresenterCSS(theme);
    const content = this.generateSlidesContent(presentation, renderer);

    return `
       <!DOCTYPE html>
       <html>
       <head>
         <meta charset="UTF-8">
         <meta name="viewport" content="width=device-width, initial-scale=1.0">
         <style>${styles}</style>
         <title>Present: ${this.escapeHtml(presentation.frontmatter.title || 'Presentation')}</title>
       </head>
       <body>
         <div class="presenter-container">
           <!-- Title bar with controls -->
           <div class="title-bar">
             <div class="title-controls-left">
               <button id="timerPlayBtn" class="title-btn title-btn-play" title="Start timer">
                 <svg viewBox="0 0 24 24" width="20" height="20">
                   <path fill="currentColor" d="M8 5v14l11-7z"/>
                 </svg>
               </button>
             </div>
             
             <div class="title-controls-center">
               <div class="slider-group">
                 <div class="slider-header">
                   <input type="checkbox" id="slideToggle" class="size-toggle" checked>
                   <label for="slideToggle" class="slider-label">Slide</label>
                 </div>
                 <input type="range" id="slideSlider" class="slider" min="0" max="100" value="0">
               </div>
               <div class="slider-group">
                 <div class="slider-header">
                   <input type="checkbox" id="contentToggle" class="size-toggle" checked>
                   <label for="contentToggle" class="slider-label">Content</label>
                 </div>
                 <input type="range" id="contentSlider" class="slider" min="0" max="100" value="80">
               </div>
               <div class="slider-group">
                 <div class="slider-header">
                   <input type="checkbox" id="notesToggle" class="size-toggle" checked>
                   <label for="notesToggle" class="slider-label">Notes</label>
                 </div>
                 <input type="range" id="notesSlider" class="slider" min="0" max="100" value="10">
               </div>
             </div>
             
             <div class="title-controls-right">
               <div class="timer" id="timer">00:00:00</div>
               <button id="timerResetBtn" class="title-btn" title="Reset timer">
                 <svg viewBox="0 0 24 24" width="20" height="20">
                   <path fill="currentColor" d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/>
                 </svg>
               </button>
               <span id="slideCounter">Slide 1 of ${presentation.slides.filter(s => !s.hidden).length}</span>
             </div>
           </div>

           <!-- Main scrollable content -->
           <div class="presenter-content">
             ${content}
           </div>
         </div>

         <script>
           window.timerInterval = null;
           window.timerSeconds = 0;
           window.currentSlideIndex = 0;
           
           // Global object to hold callbacks injected by the Obsidian process
           window.__presenterCallbacks = {
             onSlideChanged: null,
             onOpenPresentation: null
           };
           
           // Store for slide changes to be picked up by the main process
           window.__lastSlideChange = null;
           window.__lastOpenPresentation = null;

           // Get ipcRenderer from electron with node integration
           let ipcRenderer = null;
           try {
             const electron = require('electron');
             ipcRenderer = electron.ipcRenderer;
           } catch (e) {
             // ipcRenderer not available
           }

           function sendIPC(channel, args) {
             if (ipcRenderer) {
               try {
                 ipcRenderer.send(channel, args);
               } catch (e) {
                 // Failed to send IPC
               }
             }
           }

          function formatTime(seconds) {
            const hours = Math.floor(seconds / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            const secs = seconds % 60;
            return [hours, minutes, secs]
              .map(v => String(v).padStart(2, '0'))
              .join(':');
          }

          function setActiveSlide(index) {
             const slides = document.querySelectorAll('.slide-row');
             if (index < 0 || index >= slides.length) return;

             // Remove active class from all slides
             slides.forEach(slide => slide.classList.remove('active'));
             
             // Add active class to current slide
             slides[index].classList.add('active');
             
             // Scroll into view at top of viewport
             slides[index].scrollIntoView({ behavior: 'smooth', block: 'start' });
             
             // Update counter - calculate visible slide number
             const slideRow = slides[index];
             if (slideRow && slideRow.dataset.hidden === 'false') {
               const visibleIndex = Array.from(slides).slice(0, index + 1).filter(s => s.dataset.hidden === 'false').length;
               document.getElementById('slideCounter').textContent = 'Slide ' + visibleIndex + ' of ${presentation.slides.filter(s => !s.hidden).length}';
             }
             
             window.currentSlideIndex = index;
             
             // Notify parent window via polling flag
             window.__lastSlideChange = {index: index, timestamp: Date.now()};
             
             // Also try the callback if it's injected
             if (window.__presenterCallbacks && window.__presenterCallbacks.onSlideChanged) {
               try {
                 window.__presenterCallbacks.onSlideChanged(index);
               } catch (e) {
                 // Silently fail
               }
             }
           }

          document.getElementById('timerPlayBtn').addEventListener('click', () => {
            const btn = document.getElementById('timerPlayBtn');
            const svg = btn.querySelector('svg');
            
            if (!window.timerInterval) {
              // Request to open presentation window if not open
              window.__lastOpenPresentation = {timestamp: Date.now()};
              
              // Also try the callback if it's injected
              if (window.__presenterCallbacks && window.__presenterCallbacks.onOpenPresentation) {
                try {
                  window.__presenterCallbacks.onOpenPresentation();
                } catch (e) {
                  // Silently fail
                }
              }
              
              // Start the timer
              window.timerInterval = setInterval(() => {
                window.timerSeconds++;
                document.getElementById('timer').textContent = formatTime(window.timerSeconds);
              }, 1000);
              btn.classList.add('active');
              
              // Change icon to STOP (square)
              svg.innerHTML = '';
              const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
              rect.setAttribute('fill', 'currentColor');
              rect.setAttribute('x', '6');
              rect.setAttribute('y', '6');
              rect.setAttribute('width', '12');
              rect.setAttribute('height', '12');
              svg.appendChild(rect);
            } else {
              clearInterval(window.timerInterval);
              window.timerInterval = null;
              btn.classList.remove('active');
              
              // Change icon back to PLAY (triangle)
              svg.innerHTML = '';
              const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
              path.setAttribute('fill', 'currentColor');
              path.setAttribute('d', 'M8 5v14l11-7z');
              svg.appendChild(path);
            }
          });

          document.getElementById('timerResetBtn').addEventListener('click', () => {
            clearInterval(window.timerInterval);
            window.timerInterval = null;
            window.timerSeconds = 0;
            document.getElementById('timer').textContent = '00:00:00';
            document.getElementById('timerPlayBtn').classList.remove('active');
          });

          // Keyboard navigation
          document.addEventListener('keydown', (e) => {
            const slides = document.querySelectorAll('.slide-row');
            if (e.key === 'ArrowDown' || e.key === 'ArrowRight' || e.key === ' ') {
              e.preventDefault();
              if (window.currentSlideIndex < slides.length - 1) {
                setActiveSlide(window.currentSlideIndex + 1);
              }
            } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
              e.preventDefault();
              if (window.currentSlideIndex > 0) {
                setActiveSlide(window.currentSlideIndex - 1);
              }
            } else if (e.key === 'Home') {
              e.preventDefault();
              setActiveSlide(0);
            } else if (e.key === 'End') {
              e.preventDefault();
              setActiveSlide(slides.length - 1);
            }
          });

          // Slider controls for size adjustments
          document.getElementById('slideSlider').addEventListener('input', (e) => {
            const value = e.target.value;
            const slides = document.querySelectorAll('.slide-thumb-wrapper');
            slides.forEach(slide => {
              slide.style.setProperty('--slide-size', value);
            });
          });

          // Slide visibility toggle
          document.getElementById('slideToggle').addEventListener('change', (e) => {
            const isChecked = e.target.checked;
            const slides = document.querySelectorAll('.slide-row');
            slides.forEach(slide => {
              slide.setAttribute('data-slides-hidden', isChecked ? 'false' : 'true');
            });
          });

          document.getElementById('contentSlider').addEventListener('input', (e) => {
            const value = e.target.value;
            const contents = document.querySelectorAll('.slide-text');
            contents.forEach(content => {
              content.style.setProperty('--content-size', value);
            });
          });

          // Content visibility toggle
          document.getElementById('contentToggle').addEventListener('change', (e) => {
            const isChecked = e.target.checked;
            const slides = document.querySelectorAll('.slide-row');
            slides.forEach(slide => {
              slide.setAttribute('data-content-hidden', isChecked ? 'false' : 'true');
            });
          });

          document.getElementById('notesSlider').addEventListener('input', (e) => {
            const value = e.target.value;
            const notes = document.querySelectorAll('.notes-content');
            notes.forEach(note => {
              note.style.setProperty('--notes-size', value);
            });
          });

          // Notes visibility toggle
          document.getElementById('notesToggle').addEventListener('change', (e) => {
            const isChecked = e.target.checked;
            const slides = document.querySelectorAll('.slide-row');
            slides.forEach(slide => {
              slide.setAttribute('data-notes-hidden', isChecked ? 'false' : 'true');
            });
          });
          </script>
      </body>
      </html>
    `;
  }

  private generateSlidesContent(presentation: Presentation, renderer: SlideRenderer): string {
    let html = '';

    for (let slideIdx = 0; slideIdx < presentation.slides.length; slideIdx++) {
      const slide = presentation.slides[slideIdx];
      const slideHTML = renderer.renderPresentationSlideHTML(slide, slideIdx);
      const isFirst = slideIdx === 0 ? 'active' : '';
      
      // Calculate visible slide number (count only non-hidden slides up to this one)
      const visibleNumber = presentation.slides.slice(0, slideIdx + 1).filter(s => !s.hidden).length;
      
      // If slide is hidden, render it but with display: none
      const hiddenClass = slide.hidden ? 'hidden' : '';
      const displayStyle = slide.hidden ? 'style="display: none;"' : '';

      html += `
         <div class="slide-row ${isFirst} ${hiddenClass}" ${displayStyle} data-slide-index="${slideIdx}" data-hidden="${slide.hidden ? 'true' : 'false'}">
           <div class="slide-left">
             <div class="slide-num-circle">${slide.hidden ? '-' : visibleNumber}</div>
             <div class="slide-thumb-wrapper">
               <iframe class="slide-thumb" srcdoc="${this.escapeAttr(slideHTML)}"></iframe>
             </div>
           </div>
           <div class="slide-right">
             <div class="slide-text">
               ${this.renderSlideContent(slide)}
             </div>
             ${this.generateSpeakerNotesHTML(slide)}
           </div>
         </div>
       `;
    }

    return html;
  }

  private renderSlideContent(slide: Slide): string {
    if (!slide.rawContent) return '';

    const lines = slide.rawContent.split('\n');
    let html = '';
    let inList = false;
    let listItems: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        // Flush any pending list
        if (inList && listItems.length > 0) {
          html += `<ul>${listItems.map(item => `<li>${item}</li>`).join('')}</ul>`;
          listItems = [];
          inList = false;
        }
        continue;
      }

      // Skip frontmatter/metadata lines (key: value pattern)
      if (trimmed.match(/^[a-z]+\s*:/i)) {
        continue;
      }

      if (trimmed.match(/^#+\s/)) {
        // Flush any pending list
        if (inList && listItems.length > 0) {
          html += `<ul>${listItems.map(item => `<li>${item}</li>`).join('')}</ul>`;
          listItems = [];
          inList = false;
        }

        const match = trimmed.match(/^#+/);
        const level = match ? match[0].length : 1;
        const text = trimmed.replace(/^#+\s/, '');
        html += `<h${level}>${this.renderMarkdown(text)}</h${level}>`;
      } else if (trimmed.match(/^[-*+]\s/)) {
        inList = true;
        const text = trimmed.replace(/^[-*+]\s/, '');
        listItems.push(this.renderMarkdown(text));
      } else {
        // Flush any pending list
        if (inList && listItems.length > 0) {
          html += `<ul>${listItems.map(item => `<li>${item}</li>`).join('')}</ul>`;
          listItems = [];
          inList = false;
        }
        html += `<p>${this.renderMarkdown(trimmed)}</p>`;
      }
    }

    // Flush any remaining list
    if (inList && listItems.length > 0) {
      html += `<ul>${listItems.map(item => `<li>${item}</li>`).join('')}</ul>`;
    }

    return html;
  }

  private renderMarkdown(text: string): string {
    // Escape HTML special characters but preserve markdown formatting
    let result = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Process markdown: bold **text**, italic *text*, code `text`
    result = result
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code>$1</code>');

    return result;
  }

  private generateSpeakerNotesHTML(slide: Slide): string {
    if (!slide.speakerNotes || slide.speakerNotes.length === 0) {
      return '';
    }

    const notesHTML = slide.speakerNotes
      .filter(note => note.trim())
      .map(note => `<p>${this.escapeHtml(note)}</p>`)
      .join('');

    if (!notesHTML) return '';

    return `
      <div class="speaker-notes">
        <div class="notes-label">Notes:</div>
        <div class="notes-content">
          ${notesHTML}
        </div>
      </div>
    `;
  }

  private generatePresenterCSS(theme: Theme | null): string {
    const themeVars = theme ? this.generateThemeVariables(theme) : '';

    return `
      ${themeVars}

      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }

      html, body {
        width: 100%;
        height: 100%;
        background: #1a1a1a;
        color: #e0e0e0;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto;
        overflow: hidden;
      }

      .presenter-container {
        display: flex;
        flex-direction: column;
        width: 100%;
        height: 100%;
      }

      .title-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        height: 48px;
        padding: 8px 16px;
        background: #2a2a2a;
        border-bottom: 1px solid #333;
        flex-shrink: 0;
        -webkit-app-region: drag;
        gap: 16px;
      }

      .title-controls-left,
      .title-controls-center,
      .title-controls-right {
        display: flex;
        align-items: center;
        gap: 12px;
        -webkit-app-region: no-drag;
      }

      .title-controls-center {
        flex: 1;
        justify-content: center;
        gap: 16px;
        flex-wrap: nowrap;
        min-width: 0;
      }

      .slider-group {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 6px;
        white-space: nowrap;
        flex-shrink: 0;
      }

      .slider-header {
        display: flex;
        align-items: center;
        gap: 6px;
        height: 20px;
        flex-shrink: 0;
      }

      .size-toggle {
        width: 16px;
        height: 16px;
        cursor: pointer;
        accent-color: #4a9eff;
      }

      .slider-label {
        font-size: 11px;
        color: #999;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        cursor: pointer;
        white-space: nowrap;
      }

      .slider {
        width: 80px;
        height: 4px;
        border-radius: 2px;
        background: #3a3a3a;
        outline: none;
        -webkit-appearance: none;
        appearance: none;
        cursor: pointer;
        flex-shrink: 0;
      }

      .slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: #4a9eff;
        cursor: pointer;
        transition: background 0.2s;
      }

      .slider::-webkit-slider-thumb:hover {
        background: #6ab3ff;
      }

      .slider::-moz-range-thumb {
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: #4a9eff;
        cursor: pointer;
        border: none;
        transition: background 0.2s;
      }

      .slider::-moz-range-thumb:hover {
        background: #6ab3ff;
      }

      .timer {
        font-family: 'Monaco', 'Menlo', monospace;
        font-size: 13px;
        font-weight: 600;
        color: #4a9eff;
        min-width: 70px;
        text-align: right;
      }

      .title-btn {
        background: transparent;
        border: none;
        color: #999;
        cursor: pointer;
        padding: 4px;
        border-radius: 3px;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .title-btn:hover {
        background: rgba(255, 255, 255, 0.1);
        color: #e0e0e0;
      }

      .title-btn.active {
        color: #4a9eff;
        background: rgba(74, 158, 255, 0.1);
      }

      #slideCounter {
        font-size: 13px;
        color: #999;
        min-width: 70px;
        text-align: right;
      }

      .presenter-content {
        flex: 1;
        overflow-y: auto;
        padding: 20px;
      }

      .slide-row {
        display: flex;
        gap: 16px;
        margin-bottom: 24px;
        padding-bottom: 20px;
        border-bottom: 1px solid #333;
      }

      .slide-row:last-child {
        border-bottom: none;
        margin-bottom: 0;
        padding-bottom: 0;
      }

      .slide-left {
        display: flex;
        flex-direction: row;
        align-items: flex-start;
        gap: 16px;
        flex-shrink: 0;
      }

      /* Hide slide thumbnails when toggle is unchecked */
      .slide-row[data-slides-hidden="true"] .slide-thumb-wrapper {
        display: none;
      }

      .slide-num-circle {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: #2a3a4a;
        border: 2px solid #4a9eff;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 15px;
        font-weight: 700;
        color: #4a9eff;
        flex-shrink: 0;
        margin-top: 3px;
      }

      .slide-thumb-wrapper {
        background: #252525;
        border-radius: 4px;
        overflow: hidden;
        border: 1px solid #333;
        flex-shrink: 0;
        /* Smooth scaling: 100px to 900px width, maintaining 16:9 aspect ratio */
        --slide-size: 0;
        width: calc(100px + var(--slide-size) * 8px);
        height: calc(60px + var(--slide-size) * 4.8px);
        transition: width 0.3s, height 0.3s;
      }

      .slide-thumb {
        width: 100%;
        height: 100%;
        border: none;
      }

      .slide-right {
        flex: 1;
        min-width: 0;
      }

      .slide-text {
        background: transparent;
        padding: 12px;
        border-radius: 4px;
        border-left: 3px solid transparent;
        --content-size: 80;
        font-size: calc(1rem + var(--content-size) * 0.02rem);
        line-height: 1.8;
        color: #999;
        margin-bottom: 12px;
        transition: all 0.3s;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }

      .slide-row.active .slide-text {
        background: rgba(74, 158, 255, 0.12);
        border-left-color: #4a9eff;
        color: #e0e0e0;
        font-weight: 400;
      }

      /* Hide non-heading content when content toggle is unchecked - keep only h1 */
      .slide-row[data-content-hidden="true"] .slide-text h2,
      .slide-row[data-content-hidden="true"] .slide-text h3,
      .slide-row[data-content-hidden="true"] .slide-text p,
      .slide-row[data-content-hidden="true"] .slide-text ul,
      .slide-row[data-content-hidden="true"] .slide-text strong,
      .slide-row[data-content-hidden="true"] .slide-text em,
      .slide-row[data-content-hidden="true"] .slide-text code {
        display: none;
      }

      .slide-text h1 {
        font-size: 1.8rem;
        margin: 0 0 12px 0;
        color: #999;
        font-weight: 700;
      }

      .slide-text h2 {
        font-size: 1.5rem;
        margin: 0 0 12px 0;
        color: #999;
        font-weight: 700;
      }

      .slide-text h3 {
        font-size: 1.3rem;
        margin: 0 0 12px 0;
        color: #999;
        font-weight: 700;
      }

      .slide-row.active .slide-text h1,
      .slide-row.active .slide-text h2,
      .slide-row.active .slide-text h3 {
        color: #e0e0e0;
      }

      .slide-text strong {
        font-weight: 700;
        color: inherit;
      }

      .slide-row.active .slide-text strong {
        color: #ffffff;
      }

      .slide-text em {
        font-style: italic;
      }

      .slide-text code {
        background: rgba(0, 0, 0, 0.3);
        padding: 2px 6px;
        border-radius: 3px;
        font-family: 'Monaco', 'Menlo', monospace;
        font-size: 0.95rem;
      }

      .slide-text p {
        margin: 0 0 8px 0;
      }

      .slide-text p:last-child {
        margin-bottom: 0;
      }

      .slide-text li {
        margin-left: 20px;
        margin-bottom: 6px;
      }

      .speaker-notes {
        background: transparent;
        padding: 12px;
        border-radius: 4px;
        border-left: 3px solid transparent;
        transition: all 0.2s;
      }

      /* Hide speaker notes when toggle is unchecked */
      .slide-row[data-notes-hidden="true"] .speaker-notes {
        display: none;
      }

      .slide-row.active .speaker-notes {
        background: rgba(255, 154, 74, 0.1);
        border-left-color: #ff9a4a;
      }

      .notes-label {
        font-size: 0.85rem;
        font-weight: 700;
        color: #ff9a4a;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: 10px;
      }

      .notes-content {
        --notes-size: 10;
        font-size: calc(1rem + var(--notes-size) * 0.02rem);
        line-height: 1.6;
        color: #999;
        transition: font-size 0.3s;
      }

      .slide-row.active .notes-content {
        color: #b0b0b0;
      }

      .notes-content p {
        margin: 0 0 8px 0;
      }

      .notes-content p:last-child {
        margin-bottom: 0;
      }

      .presenter-content::-webkit-scrollbar {
        width: 8px;
      }

      .presenter-content::-webkit-scrollbar-track {
        background: #1a1a1a;
      }

      .presenter-content::-webkit-scrollbar-thumb {
        background: #444;
        border-radius: 4px;
      }

      .presenter-content::-webkit-scrollbar-thumb:hover {
        background: #555;
      }
    `;
  }

  private generateThemeVariables(theme: Theme): string {
    const preset = theme.presets[0];
    if (!preset) return '';
    return `
      :root {
        --light-background: ${preset.LightBackgroundColor};
        --dark-background: ${preset.DarkBackgroundColor};
      }
    `;
  }

  async updateContent(presentation: Presentation, theme: Theme | null): Promise<void> {
    const debug = getDebugService();
    if (!this.win || this.win.isDestroyed()) return;

    if (!presentation.slides || presentation.slides.length === 0) {
      debug.warn('presentation-window', 'Cannot update presenter window: no slides');
      return;
    }

    try {
      this.presentation = presentation;
      this.currentTheme = theme;
      this.presentationCache = buildPresentationCache(presentation);

      const renderer = this.createRenderer(presentation, theme);
      const html = this.generatePresenterHTML(presentation, renderer, theme);
      await this.loadHTMLContent(html);
    } catch (error) {
      debug.error('presentation-window', `Failed to update presenter content: ${error}`);
    }
  }

  close(): void {
    if (this.win && !this.win.isDestroyed()) {
      // Clean up IPC handlers if we have the reference
      if (this.ipcMainRef) {
        try {
          this.ipcMainRef.removeAllListeners('presenter:slide-changed');
          this.ipcMainRef.removeAllListeners('presenter:open-presentation');
          this.ipcMainRef = null;
        } catch (e) {
          // Ignore errors during cleanup
        }
      }
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
