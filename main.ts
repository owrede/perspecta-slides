import {
  App,
  Plugin,
  WorkspaceLeaf,
  TFile,
  MarkdownView,
  Notice,
  addIcon,
  FileSystemAdapter
} from 'obsidian';

import { PerspecaSlidesSettings, DEFAULT_SETTINGS, Presentation, Theme, PresentationFrontmatter } from './src/types';
import { SlideParser } from './src/parser/SlideParser';
import { SlideRenderer, ImagePathResolver } from './src/renderer/SlideRenderer';
import { getTheme } from './src/themes';
import { ThumbnailNavigatorView, THUMBNAIL_VIEW_TYPE } from './src/ui/ThumbnailNavigator';
import { InspectorPanelView, INSPECTOR_VIEW_TYPE } from './src/ui/InspectorPanel';
import { PresentationView, PRESENTATION_VIEW_TYPE } from './src/ui/PresentationView';
import { PerspectaSlidesSettingTab } from './src/ui/SettingsTab';
import { PresentationWindow } from './src/ui/PresentationWindow';
import { PresenterWindow } from './src/ui/PresenterWindow';
import {
  PresentationCache,
  SlideDiff,
  buildPresentationCache,
  diffPresentations,
  requiresFullRender
} from './src/utils/SlideHasher';
import { FontManager, FontCache } from './src/utils/FontManager';
import { ThemeExporter, SaveThemeModal } from './src/utils/ThemeExporter';
import { ThemeLoader } from './src/themes/ThemeLoader';
import { getBuiltInThemeNames } from './src/themes/builtin';
import { DebugService, setDebugService } from './src/utils/DebugService';
import { ExportService } from './src/utils/ExportService';

const SLIDES_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>`;

/**
 * Detect the system color scheme (light or dark)
 * Uses window.matchMedia which works in Obsidian's Electron context
 */
function getSystemColorScheme(): 'light' | 'dark' {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
}

export default class PerspectaSlidesPlugin extends Plugin {
  settings: PerspecaSlidesSettings = DEFAULT_SETTINGS;
  parser: SlideParser = new SlideParser();
  fontManager: FontManager | null = null;
  themeLoader: ThemeLoader | null = null;
  debugService: DebugService = new DebugService();
  exportService: ExportService | null = null;
  private presentationWindow: PresentationWindow | null = null;
  private presenterWindow: PresenterWindow | null = null;
  private currentPresentationFile: TFile | null = null;
  private presentationCache: PresentationCache | null = null;
  private cachedFilePath: string | null = null;
  private currentTheme: Theme | null = null;
  private lastUsedSlideDocument: TFile | null = null;

  /**
   * Image path resolver for Obsidian wiki-links
   * Resolves ![[image.png]] paths to actual resource URLs
   */
  imagePathResolver: ImagePathResolver = (path: string, isWikiLink: boolean): string => {
    if (!isWikiLink) {
      // Standard markdown paths - return as-is (may be URL or relative path)
      return path;
    }

    // For wiki-links, resolve through Obsidian's system
    try {
      // Decode any URL-encoded characters in the path (e.g., %20 for space)
      const decodedPath = decodeURIComponent(path);
      
      // Get the current file for context
      const activeFile = this.app.workspace.getActiveFile();
      const sourcePath = activeFile?.path || '';

      // Resolve the link to a file
      const linkedFile = this.app.metadataCache.getFirstLinkpathDest(decodedPath, sourcePath);

      if (linkedFile) {
        // Get the resource path for the file
        return this.app.vault.getResourcePath(linkedFile);
      }
      
      // Try with original path as fallback
      const linkedFileOriginal = this.app.metadataCache.getFirstLinkpathDest(path, sourcePath);
      if (linkedFileOriginal) {
        return this.app.vault.getResourcePath(linkedFileOriginal);
      }
    } catch (e) {
      console.warn('Failed to resolve image path:', path, e);
    }

    // Fallback - return original path
    return path;
  };

  /**
   * Image path resolver for presentation window (external Electron window)
   * Returns file:// URLs instead of app:// URLs since the presentation window
   * doesn't have access to Obsidian's custom protocol handler
   */
  presentationImagePathResolver: ImagePathResolver = (path: string, isWikiLink: boolean): string => {
    // Handle URLs - pass through as-is
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }
    
    // Handle absolute paths - pass through as-is
    if (path.startsWith('file://') || path.startsWith('/')) {
      return path;
    }

    // For wiki-links and plain filenames, resolve to file:// URL
    try {
      // Decode any URL-encoded characters in the path (e.g., %20 for space)
      const decodedPath = decodeURIComponent(path);
      
      // Get the current file for context
      const activeFile = this.app.workspace.getActiveFile();
      const sourcePath = activeFile?.path || '';

      // Resolve the link to a file (try decoded first, then original)
      let linkedFile = this.app.metadataCache.getFirstLinkpathDest(decodedPath, sourcePath);
      if (!linkedFile) {
        linkedFile = this.app.metadataCache.getFirstLinkpathDest(path, sourcePath);
      }

      if (linkedFile) {
        // Get the vault's base path
        const adapter = this.app.vault.adapter;
        if (adapter instanceof FileSystemAdapter) {
          const basePath = adapter.getBasePath();
          const fullPath = `${basePath}/${linkedFile.path}`;
          // Return as file:// URL with proper encoding
          return `file://${encodeURI(fullPath).replace(/#/g, '%23')}`;
        }
      }
    } catch (e) {
      console.warn('Failed to resolve image path for presentation:', path, e);
    }

    // Fallback - return original path
    return path;
  };

  async onload() {
    await this.loadSettings();

    // Initialize debug service with settings
    this.debugService.setTopicConfig(this.settings.debugTopics || {});
    setDebugService(this.debugService);

    // Initialize font manager
    this.fontManager = new FontManager(
      this.app,
      this.settings.fontCache ? { fonts: this.settings.fontCache.fonts } : null,
      async (cache: FontCache) => {
        this.settings.fontCache = { fonts: cache.fonts };
        await this.saveSettings();
      },
      this.settings.fontCacheFolder
    );
    // Font handling uses the new consolidated debug topic instead of a separate setting
    // this.fontManager.setDebugMode(this.settings.debugFontHandling);

    // Initialize export service
    this.exportService = new ExportService(
      this.app,
      this.fontManager,
      this.presentationImagePathResolver
    );

    // Initialize theme loader with built-in themes first
    this.themeLoader = new ThemeLoader(this.app, this.settings.customThemesFolder);
    await this.themeLoader.loadThemes();
    
    // Reload custom themes when layout is ready (vault file index is complete)
    this.app.workspace.onLayoutReady(async () => {
      if (this.themeLoader) {
        await this.themeLoader.loadThemes();
      }
      
      // Initialize restored views with theme data
      // Fixes: When Obsidian restores workspace with visible views (navigator, presenter, inspector),
      // they may not have theme data yet because no file was actively focused.
      const activeFile = this.app.workspace.getActiveFile();
      if (activeFile && activeFile.extension === 'md') {
        // There's an active file - initialize with its content
        await this.updateSidebarsWithContext(activeFile, true);
      } else {
        // Check if any views are already open (restored from session)
        const hasRestoredViews = 
          this.app.workspace.getLeavesOfType(THUMBNAIL_VIEW_TYPE).length > 0 ||
          this.app.workspace.getLeavesOfType(INSPECTOR_VIEW_TYPE).length > 0 ||
          this.app.workspace.getLeavesOfType(PRESENTATION_VIEW_TYPE).length > 0;
        
        if (hasRestoredViews) {
          // Find any visible markdown file to initialize with
          const visibleFile = this.findVisibleMarkdownFile();
          if (visibleFile) {
            await this.updateSidebarsWithContext(visibleFile, true);
          }
        }
      }
    });

    // Try to access ipcMain from Electron for IPC handling
    try {
      const electron = require('electron');
      const { ipcMain } = electron;
      
      if (ipcMain) {
        // Listen for slide changes from the presenter window
        ipcMain.on('presenter:slide-changed', (event: any, slideIndex: number) => {
          // Call the callback if presenter window is open
          if (this.presenterWindow?.isOpen()) {
            if (this.presenterWindow['onSlideChanged']) {
              this.presenterWindow['onSlideChanged'](slideIndex);
            }
          }
        });
        
        // Listen for request to open presentation window
        ipcMain.on('presenter:open-presentation', (event: any) => {
          if (this.presenterWindow?.isOpen()) {
            if (this.presenterWindow['onOpenPresentationWindow']) {
              this.presenterWindow['onOpenPresentationWindow']();
            }
          }
        });
      }
    } catch (e) {
      // IPC setup failed silently
    }

    // Listen for system color scheme changes and refresh all views
    if (typeof window !== 'undefined' && window.matchMedia) {
      const colorSchemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleColorSchemeChange = () => {
        // Refresh the active presentation if there is one
        const activeFile = this.app.workspace.getActiveFile();
        if (activeFile && activeFile.extension === 'md') {
          this.updateSidebars(activeFile);
        }
        // Also update the presentation window if it's open
        if (this.presentationWindow?.isOpen() && this.currentPresentationFile) {
          this.refreshPresentationWindow();
        }
      };
      colorSchemeQuery.addEventListener('change', handleColorSchemeChange);
      this.register(() => colorSchemeQuery.removeEventListener('change', handleColorSchemeChange));
    }

    addIcon('presentation', SLIDES_ICON);

    this.registerView(
      THUMBNAIL_VIEW_TYPE,
      (leaf) => new ThumbnailNavigatorView(leaf)
    );

    this.registerView(
      INSPECTOR_VIEW_TYPE,
      (leaf) => new InspectorPanelView(leaf)
    );

    this.registerView(
      PRESENTATION_VIEW_TYPE,
      (leaf) => new PresentationView(leaf)
    );

    this.addCommand({
      id: 'open-presentation-view',
      name: 'Open presentation view',
      checkCallback: (checking: boolean) => {
        const file = this.app.workspace.getActiveFile();
        if (file && file.extension === 'md') {
          if (!checking) {
            this.openPresentationView(file);
          }
          return true;
        }
        return false;
      }
    });

    this.addCommand({
      id: 'toggle-thumbnail-navigator',
      name: 'Toggle slide navigator',
      callback: () => {
        this.toggleThumbnailNavigator();
      }
    });

    this.addCommand({
      id: 'toggle-inspector',
      name: 'Toggle slide inspector',
      callback: () => {
        this.toggleInspector();
      }
    });

    this.addCommand({
      id: 'start-presentation',
      name: 'Start presentation',
      checkCallback: (checking: boolean) => {
        const file = this.app.workspace.getActiveFile();
        if (file && file.extension === 'md') {
          if (!checking) {
            this.startPresentation(file);
          }
          return true;
        }
        return false;
      }
    });

    this.addCommand({
      id: 'insert-slide-separator',
      name: 'Insert slide separator',
      editorCallback: (editor) => {
        const cursor = editor.getCursor();
        editor.replaceRange('\n---\n\n', cursor);
        editor.setCursor({ line: cursor.line + 3, ch: 0 });
      }
    });

    this.addCommand({
      id: 'save-as-custom-theme',
      name: 'Save as custom theme',
      checkCallback: (checking: boolean) => {
        const file = this.app.workspace.getActiveFile();
        if (file && file.extension === 'md') {
          if (!checking) {
            this.saveAsCustomTheme(file);
          }
          return true;
        }
        return false;
      }
    });

    this.addCommand({
      id: 'open-presenter-view',
      name: 'Open presenter view',
      checkCallback: (checking: boolean) => {
        const file = this.app.workspace.getActiveFile();
        if (file && file.extension === 'md') {
          if (!checking) {
            this.openPresenterView(file);
          }
          return true;
        }
        return false;
      }
    });

    this.addCommand({
      id: 'open-presenter-presentation-fullscreen',
      name: 'Open presentation fullscreen on secondary display',
      checkCallback: (checking: boolean) => {
        const file = this.app.workspace.getActiveFile();
        if (file && file.extension === 'md') {
          if (!checking) {
            this.openPresenterViewWithPresentation(file, true);
          }
          return true;
        }
        return false;
      }
    });

    this.addCommand({
      id: 'export-presentation',
      name: 'Export presentation to HTML',
      checkCallback: (checking: boolean) => {
        const file = this.app.workspace.getActiveFile();
        if (file && file.extension === 'md') {
          if (!checking) {
            this.exportPresentation(file);
          }
          return true;
        }
        return false;
      }
    });

    this.addRibbonIcon('presentation', 'Open presentation view', () => {
      console.log('[Presentation Button] Clicked');
      const file = this.app.workspace.getActiveFile();
      if (file && file.extension === 'md') {
        this.openPresentationView(file);
      } else {
        new Notice('Please open a markdown file first');
      }
    });

    this.addRibbonIcon('presentation', 'Open presenter view (speaker notes)', () => {
      console.log('[Presenter Button] Clicked');
      const file = this.app.workspace.getActiveFile();
      if (file && file.extension === 'md') {
        new Notice('Opening presenter view...');
        console.log('[Presenter Button] Opening presenter view for:', file.path);
        this.openPresenterView(file);
      } else {
        new Notice('Please open a markdown file first');
      }
    });

    this.addSettingTab(new PerspectaSlidesSettingTab(this.app, this));

    this.registerEvent(
      this.app.workspace.on('file-open', (file) => {
        if (file && file.extension === 'md') {
          this.updateSidebars(file);
        }
      })
    );

    this.registerEvent(
      this.app.workspace.on('editor-change', (editor) => {
        const file = this.app.workspace.getActiveFile();
        if (file) {
          // Get content directly from editor (not saved file)
          const content = editor.getValue();
          this.debounceUpdateSidebarsWithContent(file, content);
          this.debounceUpdatePresentationWindowWithContent(file, content);
        }
      })
    );

    // Track cursor position to update slide selection
    this.registerEvent(
      this.app.workspace.on('active-leaf-change', () => {
        const activeFile = this.app.workspace.getActiveFile();
        if (activeFile && activeFile.extension === 'md') {
          this.lastUsedSlideDocument = activeFile;
        }
        this.setupCursorTracking();
        this.updateInspectorFocus();
      })
    );

    // Handle format insertion from inspector
    (this.app.workspace as any).on('perspecta:insert-format', (format: string) => {
      const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (activeView) {
        const editor = activeView.editor;
        const cursor = editor.getCursor();

        if (format.includes('text')) {
          // Placeholder replacement like **text**
          editor.replaceSelection(format);
          // Move cursor to middle if it's a wrapper
          if (format.startsWith('**') && format.endsWith('**')) {
            const pos = editor.getCursor();
            editor.setCursor({ line: pos.line, ch: pos.ch - 2 });
          } else if (format.startsWith('*') && format.endsWith('*')) {
            const pos = editor.getCursor();
            editor.setCursor({ line: pos.line, ch: pos.ch - 1 });
          } else if (format.startsWith('==') && format.endsWith('==')) {
            const pos = editor.getCursor();
            editor.setCursor({ line: pos.line, ch: pos.ch - 2 });
          }
        } else if (format.startsWith('\n\n---\n\n')) {
          // Slide separator
          editor.replaceRange(format, cursor);
          editor.setCursor({ line: cursor.line + 3, ch: 0 });
        } else {
          // Simple prefix like "# " or "	- "
          const lineContent = editor.getLine(cursor.line);
          editor.replaceRange(format, { line: cursor.line, ch: 0 }, { line: cursor.line, ch: 0 });
          editor.setCursor({ line: cursor.line, ch: lineContent.length + format.length });
        }
        editor.focus();
      }
    });

    // Initial setup
    this.setupCursorTracking();
  }

  private cursorTrackingCleanup: (() => void) | null = null;
  private lastTrackedLine: number = -1;
  private lastTrackedFile: string = '';

  private setupCursorTracking() {
    // Clean up previous listener
    if (this.cursorTrackingCleanup) {
      this.cursorTrackingCleanup();
      this.cursorTrackingCleanup = null;
    }

    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!activeView) return;

    const editor = activeView.editor;
    const file = activeView.file;
    if (!file || file.extension !== 'md') return;

    // Use interval-based polling for cursor position (works with CM6)
    const pollInterval = setInterval(() => {
      const currentView = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (!currentView || currentView.file?.path !== file.path) return;

      const cursor = currentView.editor.getCursor();
      const currentLine = cursor.line;

      // Only trigger if line changed
      if (currentLine !== this.lastTrackedLine || file.path !== this.lastTrackedFile) {
        this.lastTrackedLine = currentLine;
        this.lastTrackedFile = file.path;
        this.handleCursorPositionChange(file, currentLine);
      }
    }, 150);

    this.cursorTrackingCleanup = () => {
      clearInterval(pollInterval);
    };

    // Update inspector focus immediately
    this.updateInspectorFocus();

    // Also try CodeMirror 5 approach as fallback
    const cm = (editor as any).cm;
    if (cm?.on) {
      const handleCursorChange = () => {
        const cursor = editor.getCursor();
        if (cursor.line !== this.lastTrackedLine || file.path !== this.lastTrackedFile) {
          this.lastTrackedLine = cursor.line;
          this.lastTrackedFile = file.path;
          this.handleCursorPositionChange(file, cursor.line);
        }
      };
      cm.on('cursorActivity', handleCursorChange);
      const originalCleanup = this.cursorTrackingCleanup;
      this.cursorTrackingCleanup = () => {
        originalCleanup?.();
        cm.off('cursorActivity', handleCursorChange);
      };
    }
  }

  onunload() {
    this.app.workspace.detachLeavesOfType(THUMBNAIL_VIEW_TYPE);
    this.app.workspace.detachLeavesOfType(INSPECTOR_VIEW_TYPE);
    this.app.workspace.detachLeavesOfType(PRESENTATION_VIEW_TYPE);
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    // Apply content mode to parser
    this.parser.setDefaultContentMode(this.settings.defaultContentMode);
    // Apply debug mode to parser
    this.parser.setDebugMode(this.settings.debugSlideRendering);
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  private async openPresentationView(file: TFile) {
    const existing = this.app.workspace.getLeavesOfType(PRESENTATION_VIEW_TYPE);

    let leaf: WorkspaceLeaf;
    if (existing.length > 0) {
      leaf = existing[0];
    } else {
      const activeLeaf = this.app.workspace.getLeaf(false);
      leaf = this.app.workspace.getLeaf('split', 'vertical');
    }

    await leaf.setViewState({
      type: PRESENTATION_VIEW_TYPE,
      active: true,
    });

    const view = leaf.view;
    if (!(view instanceof PresentationView)) return;
    await view.loadFile(file);

    // Track this as the last used slide document for initialization context
    this.lastUsedSlideDocument = file;

    this.app.workspace.revealLeaf(leaf);

    if (this.settings.showThumbnailNavigator) {
      await this.ensureThumbnailNavigator();
    }
    if (this.settings.showInspector) {
      await this.ensureInspector();
    }

    // Use first slide as context for initialization (not cursor-dependent)
    await this.updateSidebarsWithContext(file, true);
    }

    async openPresenterView(file: TFile, fullscreenOnSecondary: boolean = false) {
      try {
        const content = await this.app.vault.read(file);
        const presentation = this.parser.parse(content);
        const themeName = presentation.frontmatter.theme || this.settings.defaultTheme;
         const theme = this.getThemeByName(themeName);

         // Close any existing presenter window
         if (this.presenterWindow?.isOpen()) {
           this.presenterWindow.close();
         }

         this.presenterWindow = new PresenterWindow();
         this.presenterWindow.setImagePathResolver(this.presentationImagePathResolver);
         
         const customFontCSS = await this.getCustomFontCSS(presentation.frontmatter);
         const fontWeightsCache = this.buildFontWeightsCache();
         
         this.presenterWindow.setCustomFontCSS(customFontCSS);
         this.presenterWindow.setFontWeightsCache(fontWeightsCache);

         // Restore window bounds if available
         if (this.settings.presenterWindowBounds) {
           this.presenterWindow.setWindowBounds(this.settings.presenterWindowBounds);
         }

         // Set up callback to sync slide changes with presentation window
         this.presenterWindow.setOnSlideChanged((slideIndex: number) => {
           // Update presentation window to the same slide
           if (this.presentationWindow?.isOpen()) {
             this.presentationWindow.goToSlide(slideIndex);
           }
         });

         // Set up callback to save window bounds
         this.presenterWindow.setOnWindowBoundsChanged((bounds: any) => {
           this.settings.presenterWindowBounds = bounds;
           this.saveSettings();
         });

         // Set up callback to open presentation window when timer is started
         this.presenterWindow.setOnOpenPresentationWindow(() => {
           this.startPresentation(file);
         });

         await this.presenterWindow.open(presentation, theme || null, file, 0, fullscreenOnSecondary);

         // Track as last used document
         this.lastUsedSlideDocument = file;
      } catch (error) {
        console.error('[PresenterWindow] Failed to open:', error);
        new Notice(`Failed to open presenter view: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    private async openPresenterViewWithPresentation(file: TFile, fullscreen: boolean = false) {
      // Open presenter window first
      await this.openPresenterView(file, fullscreen);

      // Then open presentation window on secondary display if applicable
      if (fullscreen && this.presenterWindow?.isOpen()) {
        const content = await this.app.vault.read(file);
        const presentation = this.parser.parse(content);
        const themeName = presentation.frontmatter.theme || this.settings.defaultTheme;
        const theme = this.getThemeByName(themeName);

        if (this.presentationWindow?.isOpen()) {
          this.presentationWindow.close();
        }

        this.presentationWindow = new PresentationWindow();
        this.presentationWindow.setImagePathResolver(this.presentationImagePathResolver);
        
        const customFontCSS = await this.getCustomFontCSS(presentation.frontmatter);
        const fontWeightsCache = this.buildFontWeightsCache();
        
        this.presentationWindow.setCustomFontCSS(customFontCSS);
        this.presentationWindow.setFontWeightsCache(fontWeightsCache);

        // Sync presentation window slide changes back to presenter window
        this.presentationWindow.setOnSlideChanged((slideIndex: number) => {
          if (this.presenterWindow?.isOpen()) {
            this.presenterWindow.notifySlideChange(slideIndex);
          }
        });

        await this.presentationWindow.open(presentation, theme || null, file, 0);
      }
    }

    private async exportPresentation(file: TFile) {
      try {
        const content = await this.app.vault.read(file);
        const presentation = this.parser.parse(content);
        const themeName = presentation.frontmatter.theme || this.settings.defaultTheme;
        const theme = this.getThemeByName(themeName);
        const customFontCSS = await this.getCustomFontCSS(presentation.frontmatter);

        if (!this.exportService) {
          new Notice('Export service not initialized');
          return;
        }

        await this.exportService.export(presentation, theme || null, file, customFontCSS);
      } catch (error) {
        console.error('Export failed:', error);
        new Notice(`Failed to export presentation: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    private async toggleThumbnailNavigator() {
    const existing = this.app.workspace.getLeavesOfType(THUMBNAIL_VIEW_TYPE);

    if (existing.length > 0) {
      existing[0].detach();
    } else {
      await this.ensureThumbnailNavigator();
      // Wait for the view to be fully initialized before updating
      await this.waitForView(THUMBNAIL_VIEW_TYPE);
      
      // Use active file, or fall back to visible markdown file, or previously used file
      let file = this.app.workspace.getActiveFile();
      
      // If no active file, try to find a visible markdown file
      if (!file || file.extension !== 'md') {
        file = this.findVisibleMarkdownFile();
      }
      
      // If no visible file, use the last file that was actually used
      if (!file && this.lastUsedSlideDocument) {
        file = this.lastUsedSlideDocument;
      }
      
      if (file && file.extension === 'md') {
        // Force first slide context when opening navigator without active cursor
        await this.updateSidebarsWithContext(file, true);
      }
    }
  }

  private async toggleInspector() {
    const existing = this.app.workspace.getLeavesOfType(INSPECTOR_VIEW_TYPE);

    if (existing.length > 0) {
      existing[0].detach();
    } else {
      await this.ensureInspector();
      // Wait for the view to be fully initialized before updating
      await this.waitForView(INSPECTOR_VIEW_TYPE);
      
      // Use active file, or fall back to visible markdown file, or previously used file
      let file = this.app.workspace.getActiveFile();
      
      // If no active file, try to find a visible markdown file
      if (!file || file.extension !== 'md') {
        file = this.findVisibleMarkdownFile();
      }
      
      // If no visible file, use the last file that was actually used
      if (!file && this.lastUsedSlideDocument) {
        file = this.lastUsedSlideDocument;
      }
      
      if (file && file.extension === 'md') {
        // Force first slide context when opening inspector without active cursor
        await this.updateSidebarsWithContext(file, true);
      }
    }
  }

  /**
   * Wait for a view type to be available and ready
   */
  private async waitForView(viewType: string, maxAttempts: number = 10): Promise<boolean> {
    for (let i = 0; i < maxAttempts; i++) {
      const leaves = this.app.workspace.getLeavesOfType(viewType);
      if (leaves.length > 0 && leaves[0].view) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    return false;
  }

  private async ensureThumbnailNavigator() {
    const existing = this.app.workspace.getLeavesOfType(THUMBNAIL_VIEW_TYPE);
    if (existing.length > 0) return;

    const leaf = this.app.workspace.getLeftLeaf(false);
    if (leaf) {
      await leaf.setViewState({
        type: THUMBNAIL_VIEW_TYPE,
        active: true,
      });
    }
  }

  private async ensureInspector() {
    const existing = this.app.workspace.getLeavesOfType(INSPECTOR_VIEW_TYPE);
    if (existing.length > 0) return;

    const leaf = this.app.workspace.getRightLeaf(false);
    if (leaf) {
      await leaf.setViewState({
        type: INSPECTOR_VIEW_TYPE,
        active: true,
      });
    }
  }

  /**
   * Find a visible markdown file in the workspace.
   * Searches all workspace leaves to find a TFile with markdown extension.
   */
  private findVisibleMarkdownFile(): TFile | null {
    const allLeaves = this.app.workspace.getLeavesOfType('markdown');
    
    // Return the first visible markdown file found
    for (const leaf of allLeaves) {
      if (leaf.view instanceof MarkdownView) {
        const file = leaf.view.file;
        if (file && file.extension === 'md') {
          return file;
        }
      }
    }
    
    return null;
  }

  private updateTimeout: ReturnType<typeof setTimeout> | null = null;
  private lastSlideCount: number = 0;

  private debounceUpdateSidebars(file: TFile) {
    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
    }
    this.updateTimeout = setTimeout(async () => {
      const content = await this.app.vault.read(file);
      this.updateSidebarsIncrementalWithContent(file, content);
    }, 50);
  }

  private pendingContent: string | null = null;

  private debounceUpdateSidebarsWithContent(file: TFile, content: string) {
    this.pendingContent = content;
    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
    }
    // Use very short delay (30ms) for responsive updates from editor
    this.updateTimeout = setTimeout(() => {
      if (this.pendingContent) {
        this.updateSidebarsIncrementalWithContent(file, this.pendingContent);
        this.pendingContent = null;
      }
    }, 30);
  }

  /**
   * Incrementally update sidebars using content-based diffing.
   * Only re-renders slides that actually changed.
   */
  private async updateSidebarsIncrementalWithContent(file: TFile, content: string) {
    const presentation = this.parser.parse(content);

    // Determine current slide index
    const currentSlideIndex = Math.max(0, Math.min(
      this.lastCursorSlideIndex >= 0 ? this.lastCursorSlideIndex : 0,
      presentation.slides.length - 1
    ));

    // Check if we have a valid cache for this file
    const hasCacheForThisFile = this.presentationCache && this.cachedFilePath === file.path;

    // Compute diff if we have a cache
    let diff: SlideDiff | null = null;
    if (hasCacheForThisFile && this.presentationCache) {
      diff = diffPresentations(this.presentationCache, presentation);

      // If no changes detected, skip all updates
      if (diff.type === 'none') {
        // Still update inspector to reflect cursor position
        const inspectorLeaves = this.app.workspace.getLeavesOfType(INSPECTOR_VIEW_TYPE);
        for (const leaf of inspectorLeaves) {
          const view = leaf.view;
          if (!(view instanceof InspectorPanelView)) continue;
          if (presentation.slides[currentSlideIndex]) {
            view.setCurrentSlide(presentation.slides[currentSlideIndex], currentSlideIndex);
          }
        }
        return;
      }

      // If theme changed or major structural changes, do full re-render
      if (requiresFullRender(diff)) {
        this.presentationCache = buildPresentationCache(presentation);
        this.cachedFilePath = file.path;
        this.lastSlideCount = presentation.slides.length;
        this.updateSidebars(file);
        return;
      }
    }

    const theme = this.getThemeByName(presentation.frontmatter.theme || this.settings.defaultTheme);

    // Handle based on diff type
    if (diff && diff.type === 'content-only') {
      // Content-only changes: update only modified slides
      const success = await this.applyContentOnlyUpdate(diff, presentation, theme, currentSlideIndex);
      if (!success) {
        // Fallback to full re-render
        this.updateSidebarsWithPresentation(file, presentation, theme, currentSlideIndex);
      }
    } else if (diff && diff.type === 'structural') {
      // Structural changes: handle adds/removes
      await this.applyStructuralUpdate(diff, presentation, theme, file, currentSlideIndex);
    } else {
      // No cache or first load: do full render with the parsed presentation
      this.lastSlideCount = presentation.slides.length;
      this.updateSidebarsWithPresentation(file, presentation, theme, currentSlideIndex);
    }

    // Update cache for next comparison
    this.presentationCache = buildPresentationCache(presentation);
    this.cachedFilePath = file.path;
    this.lastSlideCount = presentation.slides.length;
  }

  /**
   * Apply content-only updates (no structural changes)
   */
  private async applyContentOnlyUpdate(
    diff: SlideDiff,
    presentation: Presentation,
    theme: ReturnType<typeof getTheme>,
    currentSlideIndex: number
  ): Promise<boolean> {
    const modifiedSlides = diff.modifiedIndices.map(i => presentation.slides[i]);

    // Update thumbnail navigator (only modified slides)
    const thumbnailLeaves = this.app.workspace.getLeavesOfType(THUMBNAIL_VIEW_TYPE);
    for (const leaf of thumbnailLeaves) {
      const view = leaf.view;
      if (!(view instanceof ThumbnailNavigatorView)) continue;
      view.setImagePathResolver(this.imagePathResolver);
      if (theme) {
        view.setTheme(theme);
      }
      // Update only modified slides
      const success = view.updateSlides(diff.modifiedIndices, modifiedSlides);
      if (!success) {
        return false;
      }
    }

    // Update presentation view - always update the presentation object and current slide
    const presentationLeaves = this.app.workspace.getLeavesOfType(PRESENTATION_VIEW_TYPE);
    for (const leaf of presentationLeaves) {
      const view = leaf.view;
      if (!(view instanceof PresentationView)) continue;
      view.setImagePathResolver(this.imagePathResolver);
      view.setPresentationImagePathResolver(this.presentationImagePathResolver);
      // Update all modified slides in the view's internal state
      for (let i = 0; i < diff.modifiedIndices.length; i++) {
        const idx = diff.modifiedIndices[i];
        const slide = modifiedSlides[i];
        // Update the slide - this updates internal state and re-renders if current
        view.updateSlide(idx, slide);
      }
    }

    // Update inspector with current slide
    const inspectorLeaves = this.app.workspace.getLeavesOfType(INSPECTOR_VIEW_TYPE);
    for (const leaf of inspectorLeaves) {
      const view = leaf.view;
      if (!(view instanceof InspectorPanelView)) continue;
      if (presentation.slides[currentSlideIndex]) {
        view.setCurrentSlide(presentation.slides[currentSlideIndex], currentSlideIndex);
      }
    }

    return true;
  }

  /**
   * Apply structural updates (slides added or removed)
   */
  private async applyStructuralUpdate(
    diff: SlideDiff,
    presentation: Presentation,
    theme: ReturnType<typeof getTheme>,
    file: TFile,
    currentSlideIndex: number
  ) {
    const thumbnailLeaves = this.app.workspace.getLeavesOfType(THUMBNAIL_VIEW_TYPE);

    // For now, if there are too many changes or complex reordering, do full re-render
    // This is a reasonable tradeoff for simplicity
    if (diff.addedIndices.length > 3 || diff.removedIndices.length > 3) {
      this.updateSidebars(file);
      return;
    }

    for (const leaf of thumbnailLeaves) {
      const view = leaf.view;
      if (!(view instanceof ThumbnailNavigatorView)) continue;
      view.setImagePathResolver(this.imagePathResolver);

      // Update internal presentation reference WITHOUT triggering a full re-render
      view.updatePresentationRef(presentation, file, theme);

      // For structural changes, we need to be careful about order
      // Simplest approach: remove then add, then renumber

      // Remove slides (process in reverse order to maintain indices)
      const sortedRemoved = [...diff.removedIndices].sort((a, b) => b - a);
      for (const idx of sortedRemoved) {
        view.removeSlideAt(idx);
      }

      // Add slides
      for (const idx of diff.addedIndices) {
        view.insertSlideAt(idx, presentation.slides[idx]);
      }

      // Renumber all slides
      view.renumberSlides();
    }

    // Update presentation view
    const presentationLeaves = this.app.workspace.getLeavesOfType(PRESENTATION_VIEW_TYPE);
    for (const leaf of presentationLeaves) {
      const view = leaf.view;
      if (!(view instanceof PresentationView)) continue;
      view.setImagePathResolver(this.imagePathResolver);
      view.setPresentationImagePathResolver(this.presentationImagePathResolver);
      view.setPresentation(presentation, theme);
      view.goToSlide(currentSlideIndex, false);
    }

    // Update inspector
    const inspectorLeaves = this.app.workspace.getLeavesOfType(INSPECTOR_VIEW_TYPE);
    for (const leaf of inspectorLeaves) {
      const view = leaf.view;
      if (!(view instanceof InspectorPanelView)) continue;
      view.setPresentation(presentation, file);
      if (presentation.slides[currentSlideIndex]) {
        view.setCurrentSlide(presentation.slides[currentSlideIndex], currentSlideIndex);
      }
    }
  }

  /**
   * Update sidebars for a document, with intelligent context selection.
   * If forceFirstSlide is true, always start with slide 0.
   * Otherwise, use cursor position or default to slide 0.
   */
  private async updateSidebarsWithContext(file: TFile, forceFirstSlide: boolean = false) {
    const content = await this.app.vault.read(file);
    const presentation = this.parser.parse(content);
    const theme = this.getThemeByName(presentation.frontmatter.theme || this.settings.defaultTheme);
    
    let currentSlideIndex: number;
    if (forceFirstSlide) {
      // Force first slide for initialization (when document not focused)
      currentSlideIndex = 0;
    } else {
      // Use cursor position or default to first slide
      currentSlideIndex = Math.max(0, Math.min(
        this.lastCursorSlideIndex >= 0 ? this.lastCursorSlideIndex : 0,
        presentation.slides.length - 1
      ));
    }
    
    this.updateSidebarsWithPresentation(file, presentation, theme, currentSlideIndex);
  }

  private async updateSidebars(file: TFile) {
    // Track as last used slide document for initialization fallback
    if (file.extension === 'md') {
      this.lastUsedSlideDocument = file;
    }
    
    await this.updateSidebarsWithContext(file, false);
  }

  private async updateSidebarsWithPresentation(
    file: TFile,
    presentation: Presentation,
    theme: ReturnType<typeof getTheme>,
    currentSlideIndex: number
  ) {
    this.currentTheme = theme || null;
    // Update slide count tracking
    this.lastSlideCount = presentation.slides.length;

    const thumbnailLeaves = this.app.workspace.getLeavesOfType(THUMBNAIL_VIEW_TYPE);
    // Generate custom font CSS for cached fonts
    const customFontCSS = await this.getCustomFontCSS(presentation.frontmatter);
    // Build font weights cache for validation
    const fontWeightsCache = this.buildFontWeightsCache();

    for (const leaf of thumbnailLeaves) {
      const view = leaf.view;
      if (!(view instanceof ThumbnailNavigatorView)) continue;
      view.setImagePathResolver(this.imagePathResolver);
      view.setCustomFontCSS(customFontCSS);
      view.setFontWeightsCache(fontWeightsCache);
      view.setPresentation(presentation, file, theme);
      view.setOnSlideSelect((index) => {
        this.navigateToSlide(index, presentation, file);
      });
      view.setOnSlideReorder((fromIndex, toIndex) => {
        this.reorderSlides(file, fromIndex, toIndex);
      });
      view.setOnStartPresentation((index) => {
        this.startPresentationAtSlide(file, index);
      });
      // Preserve selection
      view.selectSlide(currentSlideIndex);
    }

    const inspectorLeaves = this.app.workspace.getLeavesOfType(INSPECTOR_VIEW_TYPE);
    for (const leaf of inspectorLeaves) {
      const view = leaf.view;
      if (!(view instanceof InspectorPanelView)) continue;
      
      if (this.fontManager) {
        view.setFontManager(this.fontManager);
      }
      if (this.themeLoader) {
        view.setThemeLoader(this.themeLoader);
      }
      view.setPresentation(presentation, file);
      if (presentation.slides.length > 0 && presentation.slides[currentSlideIndex]) {
        view.setCurrentSlide(presentation.slides[currentSlideIndex], currentSlideIndex);
      }
      view.setOnSlideMetadataChange((slideIndex, metadata) => {
        this.updateSlideMetadata(file, slideIndex, metadata);
      });
      view.setOnPresentationChange((frontmatter, persistent) => {
        if (persistent) {
          this.updatePresentationFrontmatter(file, frontmatter);
        } else {
          this.updatePreviewsLive(file, frontmatter);
        }
      });
    }

    const presentationLeaves = this.app.workspace.getLeavesOfType(PRESENTATION_VIEW_TYPE);
    for (const leaf of presentationLeaves) {
      const view = leaf.view;
      if (!(view instanceof PresentationView)) continue;
      view.setImagePathResolver(this.imagePathResolver);
      view.setPresentationImagePathResolver(this.presentationImagePathResolver);
      view.setCustomFontCSS(customFontCSS);
      view.setFontWeightsCache(fontWeightsCache);
      if (this.themeLoader) {
        view.setThemeLoader(this.themeLoader);
      }
      view.setPresentation(presentation, theme);
      // Wire up slide change callback for navigation controls (prev/next buttons)
      view.setOnSlideChange((index) => {
        this.navigateToSlide(index, presentation, file, true);
      });
      // Wire up reload callback for full refresh
      view.setOnReload(() => {
        this.updateSidebars(file);
      });
      // Wire up font CSS callback for presentation window
      // Accepts frontmatter parameter so it uses fresh data from startPresentation
      view.setOnGetFontCSS(async (frontmatter) => {
        return this.getCustomFontCSS(frontmatter);
      });
      // Wire up start presentation callback to use the same code path as double-click
      view.setOnStartPresentation((f, slideIndex) => {
        this.startPresentationAtSlide(f, slideIndex);
      });
      // Wire up presenter view callback
      view.setOnStartPresenterView(async (f) => {
        await this.openPresenterView(f);
      });
      // Preserve current slide position (without triggering callback)
      view.goToSlide(currentSlideIndex, false);
    }
  }

  private async navigateToSlide(index: number, presentation: Presentation, file?: TFile, fromPresentationView: boolean = false) {
    // Only update presentation view if not triggered from it (to avoid loop)
    if (!fromPresentationView) {
      const presentationLeaves = this.app.workspace.getLeavesOfType(PRESENTATION_VIEW_TYPE);
      for (const leaf of presentationLeaves) {
        if (leaf.view instanceof PresentationView) {
          leaf.view.goToSlide(index);
        }
      }
    }

    const inspectorLeaves = this.app.workspace.getLeavesOfType(INSPECTOR_VIEW_TYPE);
    for (const leaf of inspectorLeaves) {
      if (leaf.view instanceof InspectorPanelView) {
        if (presentation.slides[index]) {
          leaf.view.setCurrentSlide(presentation.slides[index], index);
        }
      }
    }

    const thumbnailLeaves = this.app.workspace.getLeavesOfType(THUMBNAIL_VIEW_TYPE);
    for (const leaf of thumbnailLeaves) {
      if (leaf.view instanceof ThumbnailNavigatorView) {
        leaf.view.selectSlide(index);
      }
    }

    // Move cursor in the markdown editor to the corresponding slide section
    // Find the markdown view for the specific file, not just the active view
    let markdownLeaf: WorkspaceLeaf | null = null;
    let markdownView: MarkdownView | null = null;

    if (file) {
      // Find the markdown leaf that has this file open
      this.app.workspace.iterateAllLeaves((leaf) => {
        if (leaf.view instanceof MarkdownView && leaf.view.file?.path === file.path) {
          markdownLeaf = leaf;
          markdownView = leaf.view as MarkdownView;
        }
      });
    }

    // Fallback to active view if no specific file
    if (!markdownView) {
      markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
    }

    if (markdownView && markdownView.file) {
      const content = await this.app.vault.cachedRead(markdownView.file);
      // Use the slide's original index (accounting for filtered-out empty slides)
      const slideOriginalIndex = presentation.slides[index]?.index ?? index;
      const lineNumber = this.getLineNumberForSlide(content, slideOriginalIndex);
      const editor = markdownView.editor;

      // Update lastCursorSlideIndex to prevent feedback loop
      this.lastCursorSlideIndex = index;

      // Activate the markdown tab so cursor is visible and ready for typing
      if (markdownLeaf) {
        this.app.workspace.setActiveLeaf(markdownLeaf, { focus: true });
      }

      // Determine cursor column - if it's a headline, place cursor before first letter
      const lines = content.split('\n');
      const targetLine = lines[lineNumber] || '';
      let cursorColumn = 0;

      // Check if line is a headline (# , ## , ### , etc.)
      const headingMatch = targetLine.match(/^(#{1,6})\s+/);
      if (headingMatch) {
        // Place cursor right after "# " (before the first letter)
        cursorColumn = headingMatch[0].length;
      }

      // Move cursor to the appropriate position
      editor.setCursor({ line: lineNumber, ch: cursorColumn });

      // Scroll the line into view
      editor.scrollIntoView({ from: { line: lineNumber, ch: cursorColumn }, to: { line: lineNumber, ch: cursorColumn } }, true);

      // Focus the editor so typing goes directly into it
      editor.focus();
    }
  }

  private lastCursorSlideIndex: number = -1;

  private async handleCursorPositionChange(file: TFile, lineNumber: number) {
    const content = await this.app.vault.cachedRead(file);
    const slideIndex = this.getSlideIndexAtLine(content, lineNumber);

    // Only update if slide changed
    if (slideIndex === this.lastCursorSlideIndex) return;
    this.lastCursorSlideIndex = slideIndex;

    const presentation = this.parser.parse(content);

    if (slideIndex >= 0 && slideIndex < presentation.slides.length) {
      // Update thumbnail navigator selection
      const thumbnailLeaves = this.app.workspace.getLeavesOfType(THUMBNAIL_VIEW_TYPE);
      for (const leaf of thumbnailLeaves) {
        const view = leaf.view;
        if (!(view instanceof ThumbnailNavigatorView)) continue;
        view.selectSlide(slideIndex);
      }

      // Update inspector panel
      const inspectorLeaves = this.app.workspace.getLeavesOfType(INSPECTOR_VIEW_TYPE);
      for (const leaf of inspectorLeaves) {
        const view = leaf.view;
        if (!(view instanceof InspectorPanelView)) continue;
        view.setCurrentSlide(presentation.slides[slideIndex], slideIndex);
      }

      // Update presentation view (without triggering callback to avoid cursor repositioning)
      const presentationLeaves = this.app.workspace.getLeavesOfType(PRESENTATION_VIEW_TYPE);
      for (const leaf of presentationLeaves) {
        const view = leaf.view;
        if (!(view instanceof PresentationView)) continue;
        view.goToSlide(slideIndex, false);
      }
    }
  }

  private isSlideSeparator(line: string): boolean {
    // Must be exactly `---` (3 or more dashes) at the start of the line, with optional trailing whitespace
    return /^---+\s*$/.test(line);
  }

  private findFrontmatterEnd(lines: string[]): number {
    let inFrontmatter = false;
    for (let i = 0; i < lines.length; i++) {
      if (i === 0 && lines[i].trim() === '---') {
        inFrontmatter = true;
        continue;
      }
      if (inFrontmatter && lines[i].trim() === '---') {
        return i + 1;
      }
    }
    return 0;
  }

  private getSlideIndexAtLine(content: string, lineNumber: number): number {
    const lines = content.split('\n');
    const frontmatterEnd = this.findFrontmatterEnd(lines);

    // If cursor is in frontmatter, return slide 0
    if (lineNumber < frontmatterEnd) {
      return 0;
    }

    // Count slide separators before the cursor line, ignoring those inside code blocks
    let slideIndex = 0;
    let inCodeBlock = false;

    for (let i = frontmatterEnd; i <= lineNumber && i < lines.length; i++) {
      const line = lines[i];

      // Track code block state (``` at start of line)
      if (line.startsWith('```')) {
        inCodeBlock = !inCodeBlock;
        continue;
      }

      // Only count separators outside code blocks
      if (!inCodeBlock && this.isSlideSeparator(line)) {
        slideIndex++;
      }
    }

    return slideIndex;
  }

  private isSlideMetadataLine(line: string): boolean {
    const trimmed = line.trim();
    if (trimmed === '') return false;
    // Match patterns like "layout: title", "mode: dark", "background: image.jpg", "opacity: 50%", "class: custom"
    return /^(layout|mode|background|opacity|class):\s*.+$/i.test(trimmed);
  }

  private getLineNumberForSlide(content: string, slideIndex: number): number {
    const lines = content.split('\n');
    const frontmatterEnd = this.findFrontmatterEnd(lines);

    // Helper to skip metadata block and blank lines, return first content line
    const skipToContent = (startLine: number): number => {
      let i = startLine;
      // Skip blank lines first
      while (i < lines.length && lines[i].trim() === '') {
        i++;
      }
      // Skip metadata lines (layout:, mode:, etc.)
      while (i < lines.length && this.isSlideMetadataLine(lines[i])) {
        i++;
      }
      // Skip any blank lines after metadata
      while (i < lines.length && lines[i].trim() === '') {
        i++;
      }
      return i < lines.length ? i : startLine;
    };

    // Slide 0 starts right after frontmatter
    if (slideIndex === 0) {
      return skipToContent(frontmatterEnd);
    }

    // Find the nth slide separator, ignoring those inside code blocks
    let separatorCount = 0;
    let inCodeBlock = false;

    for (let i = frontmatterEnd; i < lines.length; i++) {
      const line = lines[i];

      // Track code block state (``` at start of line)
      if (line.startsWith('```')) {
        inCodeBlock = !inCodeBlock;
        continue;
      }

      // Only count separators outside code blocks
      if (!inCodeBlock && this.isSlideSeparator(line)) {
        separatorCount++;
        if (separatorCount === slideIndex) {
          return skipToContent(i + 1);
        }
      }
    }

    return frontmatterEnd;
  }

  private async startPresentation(file: TFile) {
    await this.startPresentationAtSlide(file, 0);
  }

  private async startPresentationAtSlide(file: TFile, slideIndex: number) {
    try {
      const content = await this.app.vault.read(file);
      const presentation = this.parser.parse(content);
      const theme = this.getThemeByName(presentation.frontmatter.theme || this.settings.defaultTheme);

      // Close existing presentation window if open
      if (this.presentationWindow && this.presentationWindow.isOpen()) {
        this.presentationWindow.close();
      }

      // Generate custom font CSS for cached fonts
      const customFontCSS = await this.getCustomFontCSS(presentation.frontmatter);

      // Build font weights cache for weight validation/fallback
      const fontWeightsCache = new Map<string, number[]>();
      if (this.fontManager) {
        for (const cachedFont of this.fontManager.getAllCachedFonts()) {
          fontWeightsCache.set(cachedFont.name, cachedFont.weights);
        }
      }

      // Create new presentation window
      // Use presentationImagePathResolver which returns file:// URLs for the external window
      this.presentationWindow = new PresentationWindow();
      this.presentationWindow.setImagePathResolver(this.presentationImagePathResolver);
      this.presentationWindow.setCustomFontCSS(customFontCSS);
      this.presentationWindow.setFontWeightsCache(fontWeightsCache);

      // Sync presentation window slide changes back to presenter window
      this.presentationWindow.setOnSlideChanged((slideIndex: number) => {
        if (this.presenterWindow?.isOpen()) {
          this.presenterWindow.notifySlideChange(slideIndex);
        }
      });

      await this.presentationWindow.open(presentation, theme || null, file, slideIndex);

      this.currentPresentationFile = file;
    } catch (e) {
      console.error('Failed to start presentation:', e);
      new Notice('Could not start presentation: ' + (e as Error).message);
    }
  }

  private presentationUpdateTimeout: ReturnType<typeof setTimeout> | null = null;
  private pendingPresentationContent: string | null = null;

  private debounceUpdatePresentationWindow(file: TFile) {
    if (this.presentationUpdateTimeout) {
      clearTimeout(this.presentationUpdateTimeout);
    }
    this.presentationUpdateTimeout = setTimeout(async () => {
      const content = await this.app.vault.read(file);
      this.updatePresentationWindowWithContent(file, content);
    }, 100);
  }

  private debounceUpdatePresentationWindowWithContent(file: TFile, content: string) {
    this.pendingPresentationContent = content;
    if (this.presentationUpdateTimeout) {
      clearTimeout(this.presentationUpdateTimeout);
    }
    this.presentationUpdateTimeout = setTimeout(() => {
      if (this.pendingPresentationContent) {
        this.updatePresentationWindowWithContent(file, this.pendingPresentationContent);
        this.pendingPresentationContent = null;
      }
    }, 50);
  }

  private async updatePresentationWindowWithContent(file: TFile, content: string) {
    // Only update if we have an active presentation window for this file
    if (!this.presentationWindow || !this.presentationWindow.isOpen()) {
      return;
    }

    if (!this.currentPresentationFile || this.currentPresentationFile.path !== file.path) {
      return;
    }

    // Update the presentation window with new content
    const presentation = this.parser.parse(content);
    const theme = this.getThemeByName(presentation.frontmatter.theme || this.settings.defaultTheme);
    
    // Regenerate custom font CSS in case fonts changed in frontmatter
    const customFontCSS = await this.getCustomFontCSS(presentation.frontmatter);
    this.presentationWindow.setCustomFontCSS(customFontCSS);
    
    this.presentationWindow.updateContent(presentation, theme || null);
  }

  /**
   * Refresh the presentation window (e.g., when system color scheme changes)
   */
  private async refreshPresentationWindow() {
    if (!this.presentationWindow || !this.presentationWindow.isOpen()) {
      return;
    }
    if (!this.currentPresentationFile) {
      return;
    }
    const content = await this.app.vault.read(this.currentPresentationFile);
    await this.updatePresentationWindowWithContent(this.currentPresentationFile, content);
  }

  async reorderSlides(file: TFile, fromIndex: number, toIndex: number) {
    const content = await this.app.vault.read(file);
    const presentation = this.parser.parse(content);

    if (fromIndex < 0 || fromIndex >= presentation.slides.length ||
      toIndex < 0 || toIndex >= presentation.slides.length ||
      fromIndex === toIndex) {
      return;
    }

    // Get the raw content of each slide
    const slideContents: string[] = [];
    const lines = content.split('\n');
    let currentSlideStart = 0;
    let inFrontmatter = false;
    let frontmatterEnd = 0;

    // Find where frontmatter ends
    for (let i = 0; i < lines.length; i++) {
      if (i === 0 && lines[i].trim() === '---') {
        inFrontmatter = true;
        continue;
      }
      if (inFrontmatter && lines[i].trim() === '---') {
        frontmatterEnd = i + 1;
        break;
      }
    }

    // Extract frontmatter
    const frontmatter = lines.slice(0, frontmatterEnd).join('\n');
    const bodyContent = lines.slice(frontmatterEnd).join('\n');

    // Split by slide separator, preserving exact content
    const separatorPattern = /(\n---+\s*\n)/;
    const parts = bodyContent.split(separatorPattern);

    // parts is: [slide0, sep0, slide1, sep1, slide2, ...]
    // Extract slide contents (even indices) and separators (odd indices)
    const slideRawContents: string[] = [];
    const separators: string[] = [];
    for (let i = 0; i < parts.length; i++) {
      if (i % 2 === 0) {
        slideRawContents.push(parts[i]);
      } else {
        separators.push(parts[i]);
      }
    }

    // Reorder slides
    const [movedSlide] = slideRawContents.splice(fromIndex, 1);
    slideRawContents.splice(toIndex, 0, movedSlide);

    // Reconstruct the document preserving original separator style
    // Use the first separator as template, or default to '\n---\n'
    const sep = separators[0] || '\n---\n';
    const newBody = slideRawContents.join(sep);
    const newContent = frontmatter + (frontmatter ? '\n' : '') + newBody;

    await this.app.vault.modify(file, newContent);
    new Notice(`Moved slide ${fromIndex + 1} to position ${toIndex + 1}`);
  }

  async updateSlideMetadata(file: TFile, slideIndex: number, metadata: Record<string, any>) {
    const content = await this.app.vault.read(file);
    const lines = content.split('\n');

    // Find frontmatter end
    let inFrontmatter = false;
    let frontmatterEnd = 0;
    for (let i = 0; i < lines.length; i++) {
      if (i === 0 && lines[i].trim() === '---') {
        inFrontmatter = true;
        continue;
      }
      if (inFrontmatter && lines[i].trim() === '---') {
        frontmatterEnd = i + 1;
        break;
      }
    }

    const frontmatter = lines.slice(0, frontmatterEnd).join('\n');
    const bodyContent = lines.slice(frontmatterEnd).join('\n');

    // Split by slide separator, preserving the separator pattern
    const separatorPattern = /(\n---+\s*\n)/;
    const parts = bodyContent.split(separatorPattern);

    // parts is now: [slide0, sep0, slide1, sep1, slide2, ...]
    // Extract just the slide contents (even indices) and separators (odd indices)
    const slideRawContents: string[] = [];
    const separators: string[] = [];
    for (let i = 0; i < parts.length; i++) {
      if (i % 2 === 0) {
        slideRawContents.push(parts[i]);
      } else {
        separators.push(parts[i]);
      }
    }

    if (slideIndex < 0 || slideIndex >= slideRawContents.length) {
      return;
    }

    // Get the slide content
    let slideContent = slideRawContents[slideIndex];
    const slideLines = slideContent.split('\n');

    // Find or create metadata block at start of slide
    let metadataEndLine = 0;
    const existingMetadata: Record<string, string> = {};

    // Check for existing metadata lines at start
    for (let i = 0; i < slideLines.length; i++) {
      const line = slideLines[i].trim();
      if (line === '') {
        metadataEndLine = i;
        break;
      }
      const match = line.match(/^(\w+):\s*(.*)$/i);
      if (match) {
        existingMetadata[match[1].toLowerCase()] = match[2];
        metadataEndLine = i + 1;
      } else if (!line.startsWith('#') && !line.startsWith('!') && !line.startsWith('-')) {
        // Not a metadata line and not content, check if it looks like metadata
        break;
      } else {
        // This is content, no more metadata
        break;
      }
    }

    // Merge new metadata with existing
    const finalMetadata: Record<string, string> = { ...existingMetadata };
    for (const [key, value] of Object.entries(metadata)) {
      if (value === undefined || value === null || value === '') {
        delete finalMetadata[key];
      } else if (typeof value === 'boolean') {
        finalMetadata[key] = value ? 'true' : 'false';
      } else if (typeof value === 'number') {
        if (key === 'backgroundOpacity') {
          finalMetadata['opacity'] = `${Math.round(value * 100)}%`;
        } else {
          finalMetadata[key] = String(value);
        }
      } else {
        finalMetadata[key] = String(value);
      }
    }

    // Build new metadata lines
    const metadataLines: string[] = [];
    for (const [key, value] of Object.entries(finalMetadata)) {
      if (value) {
        metadataLines.push(`${key}: ${value}`);
      }
    }

    // Get content after metadata
    const contentLines = slideLines.slice(metadataEndLine);

    // Remove leading empty lines from content
    while (contentLines.length > 0 && contentLines[0].trim() === '') {
      contentLines.shift();
    }

    // Reconstruct slide
    let newSlideContent = '';
    if (metadataLines.length > 0) {
      newSlideContent = metadataLines.join('\n') + '\n\n' + contentLines.join('\n');
    } else {
      newSlideContent = contentLines.join('\n');
    }

    slideRawContents[slideIndex] = newSlideContent;

    // Reconstruct the document using original separators
    let newBody = slideRawContents[0];
    for (let i = 1; i < slideRawContents.length; i++) {
      // Use original separator if available, otherwise default
      const separator = separators[i - 1] || '\n---\n';
      newBody += separator + slideRawContents[i];
    }
    const newContent = frontmatter + (frontmatter ? '\n' : '') + newBody;

    await this.app.vault.modify(file, newContent);

    // Immediately refresh views for responsive updates
    this.updateSidebarsIncrementalWithContent(file, newContent);
  }

  async updatePresentationFrontmatter(file: TFile, updates: Record<string, any>) {
    const content = await this.app.vault.read(file);
    const lines = content.split('\n');

    // Find frontmatter boundaries
    let hasFrontmatter = false;
    let frontmatterStart = -1;
    let frontmatterEnd = -1;

    for (let i = 0; i < lines.length; i++) {
      if (i === 0 && lines[i].trim() === '---') {
        hasFrontmatter = true;
        frontmatterStart = 0;
        continue;
      }
      if (hasFrontmatter && frontmatterStart >= 0 && lines[i].trim() === '---') {
        frontmatterEnd = i;
        break;
      }
    }

    // Parse existing frontmatter
    const existingFM: Record<string, string> = {};
    if (hasFrontmatter && frontmatterEnd > frontmatterStart) {
      for (let i = frontmatterStart + 1; i < frontmatterEnd; i++) {
        const line = lines[i];
        const colonIndex = line.indexOf(':');
        if (colonIndex > 0) {
          const key = line.slice(0, colonIndex).trim();
          let value = line.slice(colonIndex + 1).trim();
          // Remove quotes
          if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }
          existingFM[key] = value;
        }
      }
    }

    // Merge updates
    for (const [key, value] of Object.entries(updates)) {
      // Convert camelCase to kebab-case for YAML
      const yamlKey = key.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '');

      if (value === undefined || value === null || value === '') {
        delete existingFM[yamlKey];
        delete existingFM[key];
      } else if (typeof value === 'boolean') {
        existingFM[yamlKey] = value ? 'true' : 'false';
      } else if (Array.isArray(value)) {
        // Serialize arrays as comma-separated values
        existingFM[yamlKey] = value.join(', ');
      } else {
        existingFM[yamlKey] = String(value);
      }
    }

    // Build new frontmatter
    const fmLines = ['---'];
    for (const [key, value] of Object.entries(existingFM)) {
      // Quote values that need it
      if (value.includes(':') || value.includes('#') || value.startsWith(' ')) {
        fmLines.push(`${key}: "${value}"`);
      } else {
        fmLines.push(`${key}: ${value}`);
      }
    }
    fmLines.push('---');

    // Get body content
    const bodyStart = hasFrontmatter ? frontmatterEnd + 1 : 0;
    const bodyLines = lines.slice(bodyStart);

    // Reconstruct document
    const newContent = fmLines.join('\n') + '\n' + bodyLines.join('\n');

    await this.app.vault.modify(file, newContent);
    // Note: No explicit updateSidebars call needed here - the file modification
    // triggers the editor-change event which handles the update with debouncing
  }

  private updatePreviewsLive(file: TFile, updates: Record<string, any>) {
    // Update all views without writing to disk
    const thumbnailLeaves = this.app.workspace.getLeavesOfType(THUMBNAIL_VIEW_TYPE);
    for (const leaf of thumbnailLeaves) {
      const view = leaf.view;
      if (!(view instanceof ThumbnailNavigatorView)) continue;
      const presentation = view.getPresentation();
      if (presentation) {
        Object.assign(presentation.frontmatter, updates);
        view.updateSlides(Array.from({ length: presentation.slides.length }, (_, i) => i), presentation.slides);
      }
    }

    const presentationLeaves = this.app.workspace.getLeavesOfType(PRESENTATION_VIEW_TYPE);
    for (const leaf of presentationLeaves) {
      const view = leaf.view;
      if (!(view instanceof PresentationView)) continue;
      const presentation = view.getPresentation();
      if (presentation) {
        Object.assign(presentation.frontmatter, updates);
        view.updateCurrentSlideOnly();
      }
    }

    if (this.presentationWindow && this.presentationWindow.isOpen()) {
      const presentation = this.presentationWindow.getPresentation();
      if (presentation) {
        Object.assign(presentation.frontmatter, updates);
        // Trigger a re-render of the current slide in the window
        this.presentationWindow.updateContent(presentation, this.currentTheme || null);
      }
    }
  }

  private updateInspectorFocus() {
    const activeFile = this.app.workspace.getActiveFile();
    const inspectorLeaves = this.app.workspace.getLeavesOfType(INSPECTOR_VIEW_TYPE);

    for (const leaf of inspectorLeaves) {
      const view = leaf.view;
      if (!(view instanceof InspectorPanelView)) continue;
      const isFocused = activeFile !== null && view.getTargetFile()?.path === activeFile.path;
      view.setFocused(isFocused);
    }
  }

  /**
   * Generate @font-face CSS for cached fonts used in the presentation
   * Uses base64 data URLs for iframe compatibility
   */
  async getCustomFontCSS(frontmatter: PresentationFrontmatter): Promise<string> {
    const cssRules: string[] = [];
    const debug = this.debugService;

    // First, check if using a custom theme with bundled fonts
    const themeName = frontmatter.theme || this.settings.defaultTheme;
    const theme = this.getThemeByName(themeName);
    
    if (theme && !theme.isBuiltIn && this.themeLoader) {
      // Load fonts from the custom theme's fonts/ folder
      const themeFontCSS = await this.themeLoader.generateThemeFontCSS(theme);
      if (themeFontCSS) {
        debug.log('font-handling', `Added theme font CSS (${themeName})`);
        cssRules.push(themeFontCSS);
      }
    }

    // Check for any fonts from the global font cache
    // (e.g., if frontmatter overrides the theme's fonts with other cached fonts)
    if (this.fontManager) {
      const fontsToCheck = [
        frontmatter.titleFont,
        frontmatter.bodyFont,
        frontmatter.headerFont,
        frontmatter.footerFont
      ].filter(Boolean) as string[];

      debug.log('font-handling', `Checking fonts for CSS generation: ${fontsToCheck.join(', ')}`);

      for (const fontName of fontsToCheck) {
        const isCached = this.fontManager.isCached(fontName);
        debug.log('font-handling', `Font "${fontName}" cached: ${isCached}`);
        
        if (isCached) {
          // Collect all used weights for this font
          const usedWeights = new Set<number>();
          if (fontName === frontmatter.titleFont && frontmatter.titleFontWeight) {
            usedWeights.add(frontmatter.titleFontWeight);
          }
          if (fontName === frontmatter.bodyFont && frontmatter.bodyFontWeight) {
            usedWeights.add(frontmatter.bodyFontWeight);
            // IMPORTANT: Always include weight 700 for body font to support <strong> and <b> tags
            usedWeights.add(700);
          }
          if (fontName === frontmatter.headerFont && frontmatter.headerFontWeight) {
            usedWeights.add(frontmatter.headerFontWeight);
          }
          if (fontName === frontmatter.footerFont && frontmatter.footerFontWeight) {
            usedWeights.add(frontmatter.footerFontWeight);
          }
          
          // If no specific weight is used for this font, include all available weights
          // (this ensures the font is available even if weight selection isn't specified)
          const weightsToInclude = usedWeights.size > 0 ? Array.from(usedWeights) : undefined;
          
          const css = await this.fontManager.generateFontFaceCSS(fontName, weightsToInclude);
          if (css) {
            debug.log('font-handling', `Generated @font-face CSS for "${fontName}" (${css.length} bytes)${weightsToInclude ? ` with weights [${weightsToInclude.join(', ')}]` : ' with all available weights'}`);
            cssRules.push(css);
          } else {
            debug.warn('font-handling', `Failed to generate CSS for cached font "${fontName}"`);
          }
        } else {
          debug.warn('font-handling', `Font "${fontName}" not found in cache`);
        }
      }
    } else {
      debug.warn('font-handling', 'FontManager not initialized');
    }

    const result = cssRules.join('\n');
    debug.log('font-handling', `Total custom font CSS: ${result.length} bytes, ${cssRules.length} rules`);
    return result;
  }

  /**
   * Build a map of font names to their available weights
   * Used by SlideRenderer to validate and sanitize font weights
   */
  private buildFontWeightsCache(): Map<string, number[]> {
    const cache = new Map<string, number[]>();

    if (this.fontManager) {
      const cachedFonts = this.fontManager.getAllCachedFonts();
      for (const font of cachedFonts) {
        cache.set(font.name, font.weights || []);
      }
    }

    return cache;
  }

  /**
   * Get a theme by name, checking both built-in and custom themes
   * This should be used instead of getTheme() to support custom themes
   */
  getThemeByName(name: string): Theme | undefined {
    // Try the requested theme first
    if (this.themeLoader && name) {
      const theme = this.themeLoader.getTheme(name);
      if (theme) return theme;
    }
    
    // If requested theme not found, try default theme
    // This handles cases like Advanced Slides theme names that don't exist in Perspecta
    if (this.themeLoader && this.settings.defaultTheme && this.settings.defaultTheme !== name) {
      const defaultTheme = this.themeLoader.getTheme(this.settings.defaultTheme);
      if (defaultTheme) return defaultTheme;
    }
    
    // No theme found - return undefined (will use CSS defaults)
    return undefined;
  }

  /**
   * Save current presentation settings as a custom theme
   */
  async saveAsCustomTheme(file: TFile): Promise<void> {
    const content = await this.app.vault.read(file);
    const presentation = this.parser.parse(content);
    
    // IMPORTANT: Use the Inspector's current presentation if available (has all user changes)
    // Otherwise fall back to parsing from file (which may not have unsaved Inspector changes)
    let frontmatter = presentation.frontmatter;
    
    const inspectorLeaves = this.app.workspace.getLeavesOfType(INSPECTOR_VIEW_TYPE);
    for (const leaf of inspectorLeaves) {
      const view = leaf.view;
      if (view instanceof InspectorPanelView) {
        const inspectorPresentation = view.getPresentation();
        if (inspectorPresentation) {
          // Use the Inspector's presentation which has all current changes
          frontmatter = inspectorPresentation.frontmatter;
          console.log('[ThemeSave] Using Inspector presentation frontmatter with current changes');
          break;
        }
      }
    }

    // Get list of existing theme names (built-in + custom)
    const builtInNames = getBuiltInThemeNames();
    const customThemeNames = this.themeLoader?.getCustomThemes().map(t => t.template.Name) || [];
    
    const modal = new SaveThemeModal(
      this.app,
      builtInNames,
      customThemeNames,
      async (themeName: string, overwrite: boolean) => {
        const exporter = new ThemeExporter(
          this.app,
          this.fontManager,
          this.settings.customThemesFolder
        );
        
        await exporter.exportTheme(
          themeName,
          frontmatter,
          content,
          file,
          frontmatter.theme,
          overwrite
        );
        
        // Reload themes after saving
        if (this.themeLoader) {
          await this.themeLoader.loadThemes();
        }
      }
    );
    
    modal.open();
  }
}
