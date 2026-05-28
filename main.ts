import {
  type WorkspaceLeaf,
  Plugin,
  MarkdownView,
  Notice,
  addIcon,
  FileSystemAdapter,
  TFile,
} from 'obsidian';

import {
  type PerspecaSlidesSettings,
  type Presentation,
  type Theme,
  type PresentationFrontmatter,
  DEFAULT_SETTINGS,
} from './src/types';
import { SlideParser } from './src/parser/SlideParser';
import type { ImagePathResolver } from './src/renderer/SlideRenderer';
import type { getTheme } from './src/themes';
import { ThumbnailNavigatorView, THUMBNAIL_VIEW_TYPE } from './src/ui/ThumbnailNavigator';
import { InspectorPanelView, INSPECTOR_VIEW_TYPE } from './src/ui/InspectorPanel';
import { PresentationView, PRESENTATION_VIEW_TYPE } from './src/ui/PresentationView';
import { PerspectaSlidesSettingTab, CreateDemoModal } from './src/ui/SettingsTab';
import { PresentationWindow } from './src/ui/PresentationWindow';
import { PresenterWindow } from './src/ui/PresenterWindow';
import {
  type PresentationCache,
  type SlideDiff,
  buildPresentationCache,
  diffPresentations,
  requiresFullRender,
} from './src/utils/SlideHasher';
import { type FontCache, FontManager } from './src/utils/FontManager';
import { ThemeExporter, SaveThemeModal } from './src/utils/ThemeExporter';
import { ThemeLoader } from './src/themes/ThemeLoader';
import { getBuiltInThemeNames } from './src/themes/builtin';
import { DebugService, setDebugService } from './src/utils/DebugService';
import { ExportService } from './src/utils/ExportService';
import { PdfExportService } from './src/utils/PdfExportService';
import { PptxExportService } from './src/utils/PptxExportService';
import { ExcalidrawCoordinator } from './src/utils/ExcalidrawCoordinator';
import { DeckFontResolver } from './src/utils/DeckFontResolver';
import { IpcListenerManager } from './src/utils/IpcListenerManager';
import { CursorTracker } from './src/utils/CursorTracker';
import { SlideMutationService } from './src/utils/SlideMutationService';
import {
  getSlideIndexAtLine,
  getLineNumberForSlide,
} from './src/utils/SlideChunkSerializer';
import { createImagePathResolver } from './src/utils/ImagePathResolverFactory';

const SLIDES_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>`;

export default class PerspectaSlidesPlugin extends Plugin {
  settings: PerspecaSlidesSettings = DEFAULT_SETTINGS;
  parser: SlideParser = new SlideParser();
  private _slideMutations: SlideMutationService | null = null;
  private get slideMutations(): SlideMutationService {
    // Lazily constructed: `app` is available throughout the plugin
    // lifetime, but field initialisers run before the Obsidian Plugin
    // base wires it, so we can't build the service at field-init time.
    if (!this._slideMutations) {
      this._slideMutations = new SlideMutationService(this.app, this.parser);
    }
    return this._slideMutations;
  }
  fontManager: FontManager | null = null;
  themeLoader: ThemeLoader | null = null;
  fontResolver: DeckFontResolver | null = null;
  debugService: DebugService = new DebugService();
  exportService: ExportService | null = null;
  pdfExportService: PdfExportService | null = null;
  pptxExportService: PptxExportService | null = null;
  excalidrawCoordinator: ExcalidrawCoordinator | null = null;
  private settingsTab: PerspectaSlidesSettingTab | null = null;
  private presentationWindow: PresentationWindow | null = null;
  private presenterWindow: PresenterWindow | null = null;
  private currentPresentationFile: TFile | null = null;
  private presentationCache: PresentationCache | null = null;
  private cachedFilePath: string | null = null;
  private currentTheme: Theme | null = null;
  private lastUsedSlideDocument: TFile | null = null;
  private rerenderDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  /**
   * Set when we persist an inspector-driven frontmatter/metadata change to
   * disk after we've ALREADY applied the same change to the sidebar DOM via
   * a live update. The subsequent `editor-change` event (fired because the
   * file is open in an editor and vault.process synced it) would otherwise
   * redraw the same slides a second time — the source of the double redraw
   * and the visible flicker. We swallow exactly one such event. A timeout
   * clears the flag in case the edit isn't reflected through the editor
   * (e.g. file not open in the active editor), so we never wrongly swallow
   * a later genuine user edit.
   */
  private suppressNextEditorChangeRefresh = false;
  private suppressEditorChangeTimer: ReturnType<typeof setTimeout> | null = null;
  /**
   * Build the dependency bag for image-path resolvers. Recomputed on
   * each resolver instantiation; `app` is available throughout the
   * plugin lifetime, `excalidrawCoordinator` is null until `onload`
   * finishes initialisation (resolvers handle that gracefully).
   */
  private resolverDeps() {
    return {
      app: this.app,
      excalidraw: this.excalidrawCoordinator,
    };
  }

  /**
   * Absolute filesystem path to the bundled preload.js, used as the
   * Electron `webPreferences.preload` for the presenter window so it can
   * run with nodeIntegration disabled and contextIsolation enabled.
   * Returns null on non-filesystem vaults (mobile) where external windows
   * aren't supported anyway.
   */
  private resolvePreloadPath(): string | null {
    const adapter = this.app.vault.adapter;
    if (!(adapter instanceof FileSystemAdapter)) {
      return null;
    }
    const base = adapter.getBasePath().replace(/\\/g, '/');
    const dir = (this.manifest.dir ?? '').replace(/\\/g, '/');
    return `${base}/${dir}/preload.js`.replace(/\/+/g, '/');
  }

  /**
   * In-editor image-path resolver (Inspector / Thumbnails / Presenter
   * sidebar). Uses Obsidian's `app:` resource URLs and follows the
   * user's focused file for wiki-link source context.
   */
  imagePathResolver: ImagePathResolver = (path, isWikiLink) =>
    createImagePathResolver(this.resolverDeps(), {
      urlMode: 'app',
      sourcePath: { kind: 'active-file' },
    })(path, isWikiLink);

  /**
   * External-window image-path resolver. Uses `file://` URLs because
   * the Electron presentation window doesn't have Obsidian's `app:`
   * protocol handler. Source context is the active file (e.g. when
   * resolving from the inspector before a deck is pinned).
   */
  presentationImagePathResolver: ImagePathResolver = (path, isWikiLink) =>
    createImagePathResolver(this.resolverDeps(), {
      urlMode: 'file',
      sourcePath: { kind: 'active-file' },
    })(path, isWikiLink);

  /**
   * External-window resolver pinned to a specific source deck file.
   * Used after the presentation window opens — the active file may have
   * shifted (e.g. the user clicked into another note), but link
   * resolution must stay anchored to the deck's vault location.
   */
  private createPresentationImageResolver(sourcePath: string): ImagePathResolver {
    return createImagePathResolver(this.resolverDeps(), {
      urlMode: 'file',
      sourcePath: { kind: 'explicit', path: sourcePath },
    });
  }


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

    // Initialize Excalidraw coordinator (owns renderer + conversion state)
    this.excalidrawCoordinator = new ExcalidrawCoordinator({
      vault: this.app.vault,
      debugService: this.debugService,
      onSvgConverted: () => void this.rerenderPresentationWindow(),
    });

    // Initialize export service with Excalidraw support
    this.exportService = new ExportService(
      this.app,
      this.fontManager,
      this.presentationImagePathResolver
    );
    this.exportService.setExcalidrawRenderer(this.excalidrawCoordinator.getRenderer());

    // Initialize PDF export service (uses Electron printToPDF)
    this.pdfExportService = new PdfExportService(this.app, this.presentationImagePathResolver);
    this.pdfExportService.setExcalidrawRenderer(this.excalidrawCoordinator.getRenderer());

    // Initialize PPTX export service (uses PptxGenJS + font embedding)
    this.pptxExportService = new PptxExportService(this.app, this.fontManager);

    // Initialize theme loader with built-in themes first
    this.themeLoader = new ThemeLoader(this.app, this.settings.customThemesFolder);
    await this.themeLoader.loadThemes();

    // Single resolver for "what fonts does this deck use". All consumers
    // (renderer, exports, sidebar refresh) go through this rather than
    // re-deriving font logic from scratch. Memoizes by theme + cache
    // revision + role weights, so hot UI paths stay fast.
    this.fontResolver = new DeckFontResolver(this.fontManager, this.themeLoader);

    // Reload custom themes when layout is ready (vault file index is complete)
    this.app.workspace.onLayoutReady(async () => {
      if (this.themeLoader) {
        await this.themeLoader.loadThemes();
        // Themes reloaded — invalidate font resolver cache so deck CSS
        // picks up potentially-changed theme bundled fonts.
        this.fontResolver?.invalidateAll();
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

    // Wire up IPC for the presenter / presentation-window dance. The
    // listeners are tracked so they can be removed in onunload() — without
    // that, reloading the plugin (dev workflow, settings changes) would
    // leave dangling handlers and fire slide-change callbacks multiple
    // times per real change. See §8.2 in FONT-HANDLING-PLAN.
    this.registerIpcListeners();

    // Listen for Obsidian theme changes (light ↔ dark) and refresh all views.
    // We follow Obsidian's own theme, not the OS-level prefers-color-scheme,
    // because Obsidian's theme can be set independently of the OS.
    const handleColorSchemeChange = () => {
      const activeFile = this.app.workspace.getActiveFile();
      if (activeFile && activeFile.extension === 'md') {
        void this.updateSidebars(activeFile);
      }
      if (this.presentationWindow?.isOpen() && this.currentPresentationFile) {
        void this.refreshPresentationWindow();
      }
    };
    this.registerEvent(this.app.workspace.on('css-change', handleColorSchemeChange));

    addIcon('presentation', SLIDES_ICON);

    this.registerView(THUMBNAIL_VIEW_TYPE, (leaf) => new ThumbnailNavigatorView(leaf));

    this.registerView(INSPECTOR_VIEW_TYPE, (leaf) => new InspectorPanelView(leaf));

    this.registerView(PRESENTATION_VIEW_TYPE, (leaf) => new PresentationView(leaf));

    this.addCommand({
      id: 'open-presentation-view',
      name: 'Open presentation view',
      checkCallback: (checking: boolean) => {
        const file = this.app.workspace.getActiveFile();
        if (file && file.extension === 'md') {
          if (!checking) {
            void this.openPresentationView(file);
          }
          return true;
        }
        return false;
      },
    });

    this.addCommand({
      id: 'toggle-thumbnail-navigator',
      name: 'Toggle slide navigator',
      callback: () => {
        void this.toggleThumbnailNavigator();
      },
    });

    this.addCommand({
      id: 'toggle-inspector',
      name: 'Toggle slide inspector',
      callback: () => {
        void this.toggleInspector();
      },
    });

    this.addCommand({
      id: 'start-presentation',
      name: 'Start presentation',
      checkCallback: (checking: boolean) => {
        const file = this.app.workspace.getActiveFile();
        if (file && file.extension === 'md') {
          if (!checking) {
            void this.startPresentation(file);
          }
          return true;
        }
        return false;
      },
    });

    this.addCommand({
      id: 'convert-to-presentation',
      name: 'Convert to presentation',
      checkCallback: (checking: boolean) => {
        const file = this.app.workspace.getActiveFile();
        if (file && file.extension === 'md') {
          if (!checking) {
            void this.convertToPresentation(file);
          }
          return true;
        }
        return false;
      },
    });

    this.addCommand({
      id: 'insert-slide-separator',
      name: 'Insert slide separator',
      editorCallback: (editor) => {
        const cursor = editor.getCursor();
        const currentLine = editor.getLine(cursor.line) ?? '';
        const beforeCursor = currentLine.slice(0, cursor.ch);
        const afterCursor = currentLine.slice(cursor.ch);

        // Markdown needs a blank line **above** `---` for it to render as an
        // HR rather than a Setext H2. We inspect the line the cursor sits on
        // and decide how much padding to insert before the `---`:
        //
        //   cursor on a blank line, no text before  → `---\n\n`
        //   cursor with text before the cursor      → `\n\n---\n\n`
        //   cursor at column 0 of a non-blank line  → `\n---\n\n` (line break + blank line)
        const needsBlankAbove = beforeCursor.trim() !== '';
        const leadingPadding = needsBlankAbove ? '\n\n' : '';
        const insertion = `${leadingPadding}---\n\n`;
        editor.replaceRange(insertion, cursor);

        // Place cursor on the first content line after the separator.
        const lineAdvance = (insertion.match(/\n/g) ?? []).length;
        editor.setCursor({ line: cursor.line + lineAdvance, ch: 0 });

        // afterCursor is preserved by replaceRange (insertion happens at the
        // cursor; everything after the cursor moves down). No explicit work
        // needed here, but reference the binding so an accidental refactor
        // doesn't drop the line-tail.
        void afterCursor;
      },
    });

    this.addCommand({
      id: 'save-as-custom-theme',
      name: 'Save as custom theme',
      checkCallback: (checking: boolean) => {
        const file = this.app.workspace.getActiveFile();
        if (file && file.extension === 'md') {
          if (!checking) {
            void this.saveAsCustomTheme(file);
          }
          return true;
        }
        return false;
      },
    });

    this.addCommand({
      id: 'open-presenter-view',
      name: 'Open presenter view',
      checkCallback: (checking: boolean) => {
        const file = this.app.workspace.getActiveFile();
        if (file && file.extension === 'md') {
          if (!checking) {
            void this.openPresenterView(file);
          }
          return true;
        }
        return false;
      },
    });

    this.addCommand({
      id: 'open-presenter-presentation-fullscreen',
      name: 'Open presentation fullscreen on secondary display',
      checkCallback: (checking: boolean) => {
        const file = this.app.workspace.getActiveFile();
        if (file && file.extension === 'md') {
          if (!checking) {
            void this.openPresenterViewWithPresentation(file, true);
          }
          return true;
        }
        return false;
      },
    });

    this.addCommand({
      id: 'export-presentation',
      name: 'Export presentation to HTML',
      checkCallback: (checking: boolean) => {
        const file = this.app.workspace.getActiveFile();
        if (file && file.extension === 'md') {
          if (!checking) {
            void this.exportPresentation(file);
          }
          return true;
        }
        return false;
      },
    });

    this.addCommand({
      id: 'tidy-all-slides',
      name: 'Tidy all slides (canonical meta block)',
      checkCallback: (checking: boolean) => {
        const file = this.app.workspace.getActiveFile();
        if (file && file.extension === 'md') {
          if (!checking) {
            void this.tidyAllSlides(file);
          }
          return true;
        }
        return false;
      },
    });

    this.addCommand({
      id: 'lint-slide-headings',
      name: 'Lint slide headings (start at level 1, honor startlevel)',
      checkCallback: (checking: boolean) => {
        const file = this.app.workspace.getActiveFile();
        if (file && file.extension === 'md') {
          if (!checking) {
            void this.lintSlideHeadings(file);
          }
          return true;
        }
        return false;
      },
    });

    this.addRibbonIcon('presentation', 'Open presentation view', () => {
      console.log('[Presentation Button] Clicked');
      const file = this.app.workspace.getActiveFile();
      if (file && file.extension === 'md') {
        void this.openPresentationView(file);
      } else {
        new Notice('Please open a markdown file first');
      }
    });

    this.addRibbonIcon('presentation', 'Open presenter view (speaker notes)', () => {
      const file = this.app.workspace.getActiveFile();
      if (file && file.extension === 'md') {
        new Notice('Opening presenter view...');
        void this.openPresenterView(file);
      } else {
        new Notice('Please open a markdown file first');
      }
    });

    this.settingsTab = new PerspectaSlidesSettingTab(this.app, this);
    this.addSettingTab(this.settingsTab);
    this.settingsTab.setOnCreateDemo(async (modalOnOk, modalOnGoToDemo) => {
      await this.createDemoPresentation(modalOnOk, modalOnGoToDemo);
    });

    this.registerEvent(
      this.app.workspace.on('file-open', (file) => {
        if (file && file.extension === 'md') {
          void this.updateSidebars(file);
        }
      })
    );

    this.registerEvent(
      this.app.workspace.on('editor-change', (editor) => {
        const file = this.app.workspace.getActiveFile();
        if (file) {
          // Get content directly from editor (not saved file)
          const content = editor.getValue();
          // An inspector live-update already patched the sidebar DOM for
          // this change; skip the redundant redraw that the self-write
          // would otherwise trigger (see suppressNextEditorChangeRefresh).
          if (this.suppressNextEditorChangeRefresh) {
            this.clearSuppressEditorChangeRefresh();
          } else {
            this.debounceUpdateSidebarsWithContent(file, content);
          }
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

    // Handle format insertion from inspector. Wrapped in registerEvent so
    // Obsidian detaches the listener on plugin unload (the custom event is
    // emitted on the workspace; the returned EventRef participates in the
    // same cleanup path as the built-in events above).
    this.registerEvent(
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
      })
    );

    // Initial setup
    this.setupCursorTracking();
  }

  private ipcListeners: IpcListenerManager = new IpcListenerManager();
  private cursorTracker: CursorTracker | null = null;

  private registerIpcListeners(): void {
    this.ipcListeners.register({
      onSlideChanged: (slideIndex) => {
        if (this.presenterWindow?.isOpen() && (this.presenterWindow as any)['onSlideChanged']) {
          (this.presenterWindow as any)['onSlideChanged'](slideIndex);
        }
      },
      onOpenPresentation: () => {
        if (
          this.presenterWindow?.isOpen() &&
          (this.presenterWindow as any)['onOpenPresentationWindow']
        ) {
          (this.presenterWindow as any)['onOpenPresentationWindow']();
        }
      },
    });
  }

  private setupCursorTracking() {
    if (!this.cursorTracker) {
      this.cursorTracker = new CursorTracker({
        app: this.app,
        registerInterval: (id) => this.registerInterval(id),
        onLineChange: (file, line) => void this.handleCursorPositionChange(file, line),
        onAttach: () => this.updateInspectorFocus(),
      });
    }
    this.cursorTracker.attach();
  }

  onunload() {
    // Tear down explicit subscriptions first, before detaching views, so
    // dangling callbacks don't fire against half-torn-down state.
    this.cursorTracker?.detach();
    this.ipcListeners.dispose();

    if (this.presentationWindow) {
      this.presentationWindow.close();
    }
    if (this.presenterWindow) {
      this.presenterWindow.close();
    }

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
    if (!(view instanceof PresentationView)) {
      return;
    }

    // Ensure parser uses the correct content mode from settings
    view.setDefaultContentMode(this.settings.defaultContentMode);

    await view.loadFile(file);

    // Track this as the last used slide document for initialization context
    this.lastUsedSlideDocument = file;

    await this.app.workspace.revealLeaf(leaf);

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
      const preloadPath = this.resolvePreloadPath();
      if (preloadPath) {
        this.presenterWindow.setPreloadPath(preloadPath);
      }
      // Create a context-aware resolver that uses the source file path
      const contextAwareResolverForPresenter = this.createPresentationImageResolver(file.path);
      this.presenterWindow.setImagePathResolver(contextAwareResolverForPresenter);

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
        void this.saveSettings();
      });

      // Set up callback to open presentation window when timer is started
      this.presenterWindow.setOnOpenPresentationWindow(() => {
        void this.startPresentation(file);
      });

      await this.presenterWindow.open(presentation, theme || null, file, 0, fullscreenOnSecondary);

      // Track as last used document
      this.lastUsedSlideDocument = file;
    } catch (error) {
      console.error('[PresenterWindow] Failed to open:', error);
      new Notice(
        `Failed to open presenter view: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
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
      // Create a context-aware resolver that uses the source file path
      const contextAwareResolver = this.createPresentationImageResolver(file.path);
      this.presentationWindow.setImagePathResolver(contextAwareResolver);

      const customFontCSS = await this.getCustomFontCSS(presentation.frontmatter);
      const fontWeightsCache = this.buildFontWeightsCache();

      this.presentationWindow.setCustomFontCSS(customFontCSS);
      this.presentationWindow.setFontWeightsCache(fontWeightsCache);
      
      // Pass Excalidraw SVG cache and failed decompression files to presentation window
      this.excalidrawCoordinator?.attachCaches(this.presentationWindow);

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
      new Notice(
        `Failed to export presentation: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private async exportPresentationPDF(file: TFile) {
    try {
      const content = await this.app.vault.read(file);
      const presentation = this.parser.parse(content);
      const themeName = presentation.frontmatter.theme || this.settings.defaultTheme;
      const theme = this.getThemeByName(themeName);
      const customFontCSS = await this.getCustomFontCSS(presentation.frontmatter);

      if (!this.pdfExportService) {
        new Notice('PDF export service not initialized');
        return;
      }

      await this.pdfExportService.export(presentation, theme || null, file, customFontCSS);
    } catch (error) {
      console.error('PDF export failed:', error);
      new Notice(
        `Failed to export PDF: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private async exportPresentationPPTX(file: TFile) {
    try {
      const content = await this.app.vault.read(file);
      const presentation = this.parser.parse(content);
      const themeName = presentation.frontmatter.theme || this.settings.defaultTheme;
      const theme = this.getThemeByName(themeName);

      if (!this.pptxExportService) {
        new Notice('PPTX export service not initialized');
        return;
      }

      await this.pptxExportService.export(presentation, theme || null, file);
    } catch (error) {
      console.error('PPTX export failed:', error);
      new Notice(
        `Failed to export PPTX: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private async convertToPresentation(file: TFile) {
    try {
      let hadFrontmatter = false;
      let hadSlides = false;
      let changed = false;

      await this.app.vault.process(file, (content) => {
        let newContent = content;
        hadFrontmatter = content.startsWith('---');
        if (hadFrontmatter) {
          const slideSeparators = content.match(/\n---\n/g);
          hadSlides = slideSeparators !== null && slideSeparators.length > 0;
        }

        if (!hadFrontmatter) {
          newContent = '---\ntheme: default\n---\n\n' + content;
        }

        if (!hadSlides) {
          if (!newContent.endsWith('\n\n')) {
            newContent = newContent.trimEnd() + '\n\n';
          }
          newContent += '---\n\n# Slide 1\n\nAdd your content here...';
        }

        changed = newContent !== content;
        return newContent;
      });

      if (changed) {
        new Notice(
          hadFrontmatter && hadSlides
            ? 'File is ready for presentation'
            : hadFrontmatter
              ? 'Added slide structure'
              : 'Added frontmatter and slide structure'
        );
      } else {
        new Notice('File is ready for presentation');
      }

      // Open presentation view
      await this.openPresentationView(file);

      // Open navigator if setting allows
      if (this.settings.showThumbnailNavigator) {
        await this.ensureThumbnailNavigator();
      }

      // Open inspector if setting allows
      if (this.settings.showInspector) {
        await this.ensureInspector();
      }

      // Start presentation window
      await this.startPresentation(file);
    } catch (error) {
      console.error('Convert to presentation failed:', error);
      new Notice(
        `Failed to convert to presentation: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
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
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return false;
  }

  private async ensureThumbnailNavigator() {
    const existing = this.app.workspace.getLeavesOfType(THUMBNAIL_VIEW_TYPE);
    if (existing.length > 0) {
      return;
    }

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
    if (existing.length > 0) {
      return;
    }

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
      void this.updateSidebarsIncrementalWithContent(file, content);
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
        void this.updateSidebarsIncrementalWithContent(file, this.pendingContent);
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
    const currentSlideIndex = Math.max(
      0,
      Math.min(
        this.lastCursorSlideIndex >= 0 ? this.lastCursorSlideIndex : 0,
        presentation.slides.length - 1
      )
    );

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
          if (!(view instanceof InspectorPanelView)) {
            continue;
          }
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
        await this.updateSidebars(file);
        return;
      }
    }

    const theme = this.getThemeByName(presentation.frontmatter.theme || this.settings.defaultTheme);

    // Handle based on diff type
    if (diff && diff.type === 'content-only') {
      // Content-only changes: update only modified slides
      const success = await this.applyContentOnlyUpdate(
        diff,
        presentation,
        theme,
        currentSlideIndex
      );
      if (!success) {
        // Fallback to full re-render
        await this.updateSidebarsWithPresentation(file, presentation, theme, currentSlideIndex);
      }
    } else if (diff && diff.type === 'structural') {
      // Structural changes: handle adds/removes
      await this.applyStructuralUpdate(diff, presentation, theme, file, currentSlideIndex);
    } else {
      // No cache or first load: do full render with the parsed presentation
      this.lastSlideCount = presentation.slides.length;
      await this.updateSidebarsWithPresentation(file, presentation, theme, currentSlideIndex);
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
    const modifiedSlides = diff.modifiedIndices.map((i) => presentation.slides[i]);

    // Update thumbnail navigator (only modified slides)
    const thumbnailLeaves = this.app.workspace.getLeavesOfType(THUMBNAIL_VIEW_TYPE);
    for (const leaf of thumbnailLeaves) {
      const view = leaf.view;
      if (!(view instanceof ThumbnailNavigatorView)) {
        continue;
      }
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
      if (!(view instanceof PresentationView)) {
        continue;
      }
      // Set both fallback and factory: factory uses sourceFile context when available, fallback for other cases
      view.setImagePathResolver(this.imagePathResolver);
      view.setResolverFactory((sourcePath) => this.createPresentationImageResolver(sourcePath));
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
      if (!(view instanceof InspectorPanelView)) {
        continue;
      }
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
      await this.updateSidebars(file);
      return;
    }

    for (const leaf of thumbnailLeaves) {
      const view = leaf.view;
      if (!(view instanceof ThumbnailNavigatorView)) {
        continue;
      }
      view.setImagePathResolver(this.imagePathResolver);

      // Update internal presentation reference WITHOUT triggering a full re-render
      view.updatePresentationRef(presentation, theme, file);

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
      if (!(view instanceof PresentationView)) {
        continue;
      }
      view.setImagePathResolver(this.imagePathResolver);
      view.setPresentationImagePathResolver(this.presentationImagePathResolver);
      // Ensure parser uses correct content mode for live updates
      view.setDefaultContentMode(this.settings.defaultContentMode);
      view.setPresentation(presentation, theme);
      view.goToSlide(currentSlideIndex, false);
    }

    // Update inspector
    const inspectorLeaves = this.app.workspace.getLeavesOfType(INSPECTOR_VIEW_TYPE);
    for (const leaf of inspectorLeaves) {
      const view = leaf.view;
      if (!(view instanceof InspectorPanelView)) {
        continue;
      }
      view.setPresentation(presentation, undefined, file);
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
      currentSlideIndex = Math.max(
        0,
        Math.min(
          this.lastCursorSlideIndex >= 0 ? this.lastCursorSlideIndex : 0,
          presentation.slides.length - 1
        )
      );
    }

    await this.updateSidebarsWithPresentation(file, presentation, theme, currentSlideIndex);
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
      if (!(view instanceof ThumbnailNavigatorView)) {
        continue;
      }
      view.setImagePathResolver(this.imagePathResolver);
      view.setCustomFontCSS(customFontCSS);
      view.setFontWeightsCache(fontWeightsCache);
      // Pass Excalidraw SVG cache and failed decompression files for native rendering
      this.excalidrawCoordinator?.attachCaches(view);
      view.setPresentation(presentation, theme, file);
      view.setOnSlideSelect((index) => {
        void this.navigateToSlide(index, presentation, file);
      });
      view.setOnSlideReorder((fromIndex, toIndex) => {
        void this.reorderSlides(file, fromIndex, toIndex);
      });
      view.setOnStartPresentation((index) => {
        void this.startPresentationAtSlide(file, index);
      });
      view.setOnAddSlide(() => {
        void this.addSlideAtEnd(file);
      });
      view.setOnSlideHiddenChanged((index, hidden) => {
        void this.updateSlideHiddenState(file, index, hidden);
      });
      // Preserve selection
      view.selectSlide(currentSlideIndex);
    }

    const inspectorLeaves = this.app.workspace.getLeavesOfType(INSPECTOR_VIEW_TYPE);
    for (const leaf of inspectorLeaves) {
      const view = leaf.view;
      if (!(view instanceof InspectorPanelView)) {
        continue;
      }

      if (this.fontManager) {
        view.setFontManager(this.fontManager);
      }
      if (this.themeLoader) {
        view.setThemeLoader(this.themeLoader);
      }
      view.setPresentation(presentation, theme, file);
      if (presentation.slides.length > 0 && presentation.slides[currentSlideIndex]) {
        view.setCurrentSlide(presentation.slides[currentSlideIndex], currentSlideIndex);
      }
      view.setOnSlideMetadataChange((slideIndex, metadata) => {
        void this.updateSlideMetadata(file, slideIndex, metadata);
      });
      view.setOnPresentationChange((frontmatter, persistent, _domAlreadyLive) => {
        if (persistent) {
          // For CSS-only changes the live iframe patch (updatePreviewsLive)
          // fully covers the visual update, and the disk write is only for
          // persistence — so the editor-change redraw it triggers is always
          // redundant. We don't rely on event ordering (the persistent event
          // can arrive before OR after the live one depending on whether the
          // slider was dragged or clicked): we apply the live patch here
          // ourselves, then suppress the editor-change redraw. Non-CSS
          // changes (layout/mode/content) still need the full redraw, so we
          // only suppress for CSS-only.
          if (this.isCssOnlyFrontmatterChange(frontmatter)) {
            this.updatePreviewsLive(file, frontmatter);
            this.armSuppressEditorChangeRefresh();
          }
          void this.updatePresentationFrontmatter(file, frontmatter);
        } else {
          this.updatePreviewsLive(file, frontmatter);
        }
      });
    }

    const presentationLeaves = this.app.workspace.getLeavesOfType(PRESENTATION_VIEW_TYPE);
    for (const leaf of presentationLeaves) {
      const view = leaf.view;
      if (!(view instanceof PresentationView)) {
        continue;
      }
      // Set both fallback and factory: factory uses sourceFile context when available, fallback for other cases
      view.setImagePathResolver(this.imagePathResolver);
      view.setResolverFactory((sourcePath) => this.createPresentationImageResolver(sourcePath));
      view.setCustomFontCSS(customFontCSS);
      view.setFontWeightsCache(fontWeightsCache);
      // Pass Excalidraw SVG cache and failed decompression files for native rendering
      this.excalidrawCoordinator?.attachCaches(view);
      if (this.themeLoader) {
        view.setThemeLoader(this.themeLoader);
      }
      // Ensure parser uses correct content mode for live updates
      view.setDefaultContentMode(this.settings.defaultContentMode);
      view.setPresentation(presentation, theme, file);
      // Wire up slide change callback for navigation controls (prev/next buttons)
      view.setOnSlideChange((index) => {
        void this.navigateToSlide(index, presentation, file, true);
      });
      // Wire up reload callback for full refresh
      view.setOnReload(() => {
        void this.updateSidebars(file);
      });
      // Wire up font CSS callback for presentation window
      // Accepts frontmatter parameter so it uses fresh data from startPresentation
      view.setOnGetFontCSS(async (frontmatter) => {
        return this.getCustomFontCSS(frontmatter);
      });
      // Wire up start presentation callback to use the same code path as double-click
      view.setOnStartPresentation((f, slideIndex) => {
        void this.startPresentationAtSlide(f, slideIndex);
      });
      // Wire up presenter view callback
      view.setOnStartPresenterView(async (f) => {
        await this.openPresenterView(f);
      });
      // Wire up HTML export callback
      view.setOnExportHTML(async (f) => {
        await this.exportPresentation(f);
      });
      // Wire up PDF export callback
      view.setOnExportPDF(async (f) => {
        await this.exportPresentationPDF(f);
      });
      // Wire up PPTX export callback
      view.setOnExportPPTX(async (f) => {
        await this.exportPresentationPPTX(f);
      });
      // Preserve current slide position (without triggering callback)
      view.goToSlide(currentSlideIndex, false);
    }
  }

  private async navigateToSlide(
    index: number,
    presentation: Presentation,
    file?: TFile,
    fromPresentationView: boolean = false
  ) {
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
          markdownView = leaf.view;
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
      const lineNumber = getLineNumberForSlide(content, slideOriginalIndex);
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
      editor.scrollIntoView(
        {
          from: { line: lineNumber, ch: cursorColumn },
          to: { line: lineNumber, ch: cursorColumn },
        },
        true
      );

      // Focus the editor so typing goes directly into it
      editor.focus();
    }
  }

  private lastCursorSlideIndex: number = -1;

  private async handleCursorPositionChange(file: TFile, lineNumber: number) {
    const content = await this.app.vault.cachedRead(file);
    const slideIndex = getSlideIndexAtLine(content, lineNumber);

    // Only update if slide changed
    if (slideIndex === this.lastCursorSlideIndex) {
      return;
    }
    this.lastCursorSlideIndex = slideIndex;

    const presentation = this.parser.parse(content);

    if (slideIndex >= 0 && slideIndex < presentation.slides.length) {
      // Update thumbnail navigator selection
      const thumbnailLeaves = this.app.workspace.getLeavesOfType(THUMBNAIL_VIEW_TYPE);
      for (const leaf of thumbnailLeaves) {
        const view = leaf.view;
        if (!(view instanceof ThumbnailNavigatorView)) {
          continue;
        }
        view.selectSlide(slideIndex);
      }

      // Update inspector panel
      const inspectorLeaves = this.app.workspace.getLeavesOfType(INSPECTOR_VIEW_TYPE);
      for (const leaf of inspectorLeaves) {
        const view = leaf.view;
        if (!(view instanceof InspectorPanelView)) {
          continue;
        }
        view.setCurrentSlide(presentation.slides[slideIndex], slideIndex);
      }

      // Update presentation view (without triggering callback to avoid cursor repositioning)
      const presentationLeaves = this.app.workspace.getLeavesOfType(PRESENTATION_VIEW_TYPE);
      for (const leaf of presentationLeaves) {
        const view = leaf.view;
        if (!(view instanceof PresentationView)) {
          continue;
        }
        view.goToSlide(slideIndex, false);
      }
    }
  }

  // Slide-chunk parsing/serialisation lives in SlideChunkSerializer.ts.


  private async startPresentation(file: TFile) {
    await this.startPresentationAtSlide(file, 0);
  }

  private async startPresentationAtSlide(file: TFile, slideIndex: number) {
    try {
      const content = await this.app.vault.read(file);
      const presentation = this.parser.parse(content);
      const theme = this.getThemeByName(
        presentation.frontmatter.theme || this.settings.defaultTheme
      );

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

      // Pass Excalidraw SVG cache and failed decompression files to presentation window
      this.excalidrawCoordinator?.attachCaches(this.presentationWindow);

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
      void this.updatePresentationWindowWithContent(file, content);
    }, 250);
  }

  private debounceUpdatePresentationWindowWithContent(file: TFile, content: string) {
    this.pendingPresentationContent = content;
    if (this.presentationUpdateTimeout) {
      clearTimeout(this.presentationUpdateTimeout);
    }
    this.presentationUpdateTimeout = setTimeout(() => {
      if (this.pendingPresentationContent) {
        void this.updatePresentationWindowWithContent(file, this.pendingPresentationContent);
        this.pendingPresentationContent = null;
      }
    }, 250);
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

    await this.presentationWindow.updateContent(presentation, theme || null);
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

  /**
   * Invalidate every font CSS cache and re-render every open surface.
   * Called by Settings → Rebuild font cache so changes show up immediately
   * in sidebars, presentation window, and presenter window without the
   * user having to re-open anything.
   */
  async refreshAllForFontCacheChange(): Promise<void> {
    this.fontResolver?.invalidateAll();

    const activeFile = this.app.workspace.getActiveFile();
    if (activeFile && activeFile.extension === 'md') {
      await this.updateSidebars(activeFile);
    }

    if (this.presentationWindow?.isOpen()) {
      await this.refreshPresentationWindow();
    }

    if (this.presenterWindow?.isOpen() && this.currentPresentationFile) {
      // Presenter has no incremental update path — close + reopen to pick
      // up the new font CSS. Cheaper than building a full updateContent
      // pipeline for the presenter just for this case.
      const content = await this.app.vault.read(this.currentPresentationFile);
      const presentation = this.parser.parse(content);
      const theme = this.getThemeByName(
        presentation.frontmatter.theme || this.settings.defaultTheme
      );
      const customFontCSS = await this.getCustomFontCSS(presentation.frontmatter);
      this.presenterWindow.setCustomFontCSS(customFontCSS);
      this.presenterWindow.setFontWeightsCache(this.buildFontWeightsCache());
      this.presenterWindow.close();
      await this.presenterWindow.open(presentation, theme || null, this.currentPresentationFile, 0);
    }
  }

  /**
    * Re-render the presentation window and editor view (used when async conversions complete)
    * Re-parses and re-renders current slides with updated cache
    */
  private async rerenderPresentationWindow() {
    this.excalidrawCoordinator?.log(`rerenderPresentationWindow() called`);
    
    // Debounce re-renders to avoid flickering from multiple conversions
    if (this.rerenderDebounceTimer) {
      this.excalidrawCoordinator?.log(`⏱️ Re-render already pending, skipping duplicate`);
      return;
    }
    
    // Determine which file to re-render - prefer currentPresentationFile (fullscreen),
    // then fall back to lastUsedSlideDocument (editor view)
    const targetFile = this.currentPresentationFile || this.lastUsedSlideDocument;
    if (!targetFile) {
      this.excalidrawCoordinator?.log(`❌ No presentation file currently in use`);
      return;
    }

    // Schedule re-render with a small delay to batch multiple conversions
    this.rerenderDebounceTimer = setTimeout(async () => {
      this.rerenderDebounceTimer = null;

      try {
        // Try to re-render fullscreen presentation window if open
        if (this.presentationWindow?.isOpen() && this.currentPresentationFile) {
          this.excalidrawCoordinator?.log(`✅ Triggering fullscreen presentation window re-render`);
          const content = await this.app.vault.read(this.currentPresentationFile);
          await this.updatePresentationWindowWithContent(this.currentPresentationFile, content);
        }

        // Re-render the editor view if open for this file
        const presentationLeaves = this.app.workspace.getLeavesOfType(PRESENTATION_VIEW_TYPE);
        for (const leaf of presentationLeaves) {
          const view = leaf.view;
          if (!(view instanceof PresentationView)) {
            continue;
          }
          // Check if this view is showing the target file (access private file property)
          const viewFile = (view as any).file as TFile | null;
          if (viewFile?.path === targetFile.path) {
            this.excalidrawCoordinator?.log(`✅ Triggering editor view re-render for: ${targetFile.path}`);
            // Force re-render by calling private render() method
            (view as any).render();
          }
        }

        // Re-render thumbnail navigator for this file
        const thumbnailLeaves = this.app.workspace.getLeavesOfType(THUMBNAIL_VIEW_TYPE);
        for (const leaf of thumbnailLeaves) {
          const view = leaf.view;
          if (!(view instanceof ThumbnailNavigatorView)) {
            continue;
          }
          // Check if this view is showing the target file
          const viewPresentation = view.getPresentation();
          // Thumbnail navigator doesn't expose its file directly, so we re-render if its presentation is loaded
          if (viewPresentation) {
            this.excalidrawCoordinator?.log(`✅ Triggering thumbnail navigator re-render for: ${targetFile.path}`);
            // Force re-render by calling private render() method
            (view as any).render();
          }
        }

        this.excalidrawCoordinator?.log(`✅ Re-render complete`);
      } catch (e) {
        this.excalidrawCoordinator?.error(`Error during re-render:`, e);
      }
    }, 100); // 100ms delay to batch conversions
  }

  // ---------------------------------------------------------------------------
  // Slide mutations. The content transforms live in SlideMutationService; these
  // wrappers own the view reactions (navigation, notices, sidebar refresh,
  // presentation-cache invalidation) that must stay in the plugin.
  // ---------------------------------------------------------------------------

  async reorderSlides(file: TFile, fromIndex: number, toIndex: number) {
    const result = await this.slideMutations.reorder(file, fromIndex, toIndex);
    if (result.status === 'footnotes-slide') {
      new Notice('Cannot reorder the auto-generated footnotes slide - it must remain at the end');
      return;
    }
    if (result.status !== 'reordered') {
      return;
    }
    new Notice(`Moved slide ${fromIndex + 1} to position ${toIndex + 1}`);
    const newPresentation = this.parser.parse(result.content);
    await this.navigateToSlide(result.toIndex, newPresentation, file);
  }

  async addSlideAtEnd(file: TFile) {
    const { content } = await this.slideMutations.appendSlide(file);
    if (!content) {
      return;
    }
    const tempPresentation = this.parser.parse(content);
    const newSlideIndex = tempPresentation.slides.length - 1;
    await this.navigateToSlide(newSlideIndex, tempPresentation, file);
  }

  async tidyAllSlides(file: TFile) {
    const result = await this.slideMutations.tidyAll(file);
    if (result.status === 'already-tidy') {
      new Notice('All slides are already tidy.');
      return;
    }
    new Notice(`Tidied ${result.count} slide${result.count === 1 ? '' : 's'}.`);
    if (result.content) {
      this.updateSidebarsIncrementalWithContent(file, result.content);
    }
  }

  async lintSlideHeadings(file: TFile) {
    const result = await this.slideMutations.lintHeadings(file);
    if (result.status === 'already-tidy') {
      new Notice('Slide headings already start at the right level.');
      return;
    }
    new Notice(`Adjusted headings on ${result.count} slide${result.count === 1 ? '' : 's'}.`);
    if (result.content) {
      this.updateSidebarsIncrementalWithContent(file, result.content);
    }
  }

  async updateSlideMetadata(file: TFile, slideIndex: number, metadata: Record<string, any>) {
    const { content } = await this.slideMutations.updateMetadata(file, slideIndex, metadata);
    if (content) {
      this.updateSidebarsIncrementalWithContent(file, content);
    }
  }

  async updateSlideHiddenState(file: TFile, slideIndex: number, hidden: boolean) {
    // Clear presentation cache to trigger full re-render (dynamic background
    // colors depend on visible slide count, so we need a full recalc).
    this.presentationCache = null;
    this.cachedFilePath = null;
    await this.slideMutations.setHidden(file, slideIndex, hidden);
    // vault.process triggers the editor-change event which calls
    // debounceUpdateSidebarsWithContent — no explicit refresh needed.
  }

  async updatePresentationFrontmatter(file: TFile, updates: Record<string, any>) {
    await this.slideMutations.updateFrontmatter(file, updates);
    // vault.process triggers the editor-change event which handles updates
    // with debouncing.
  }

  /**
   * Arm the one-shot suppression of the next editor-change sidebar refresh.
   * Call this right before persisting an inspector-driven change whose DOM
   * effect was already applied via updatePreviewsLive. The flag auto-clears
   * after 400ms so it can never swallow a later genuine edit if the
   * expected editor-change never arrives.
   */
  private armSuppressEditorChangeRefresh() {
    this.suppressNextEditorChangeRefresh = true;
    if (this.suppressEditorChangeTimer) {
      clearTimeout(this.suppressEditorChangeTimer);
    }
    this.suppressEditorChangeTimer = setTimeout(() => {
      this.clearSuppressEditorChangeRefresh();
    }, 400);
  }

  private clearSuppressEditorChangeRefresh() {
    this.suppressNextEditorChangeRefresh = false;
    if (this.suppressEditorChangeTimer) {
      clearTimeout(this.suppressEditorChangeTimer);
      this.suppressEditorChangeTimer = null;
    }
  }

  /**
   * Frontmatter keys whose effect is entirely carried by the
   * frontmatter-derived `<style>` blocks (CSS custom properties, heading
   * color overrides, font-scale). Changing only these can be applied to
   * live iframes by patching CSS, with no DOM rebuild and no flicker.
   * Keys NOT listed here (layout, mode, content, theme, aspectRatio, …)
   * change DOM structure or body classes and need a full rebuild.
   */
  private static readonly CSS_ONLY_FRONTMATTER_KEYS = new Set([
    // Typography (fonts, sizes, scales)
    'titleFont',
    'bodyFont',
    'headerFont',
    'footerFont',
    'titleFontWeight',
    'bodyFontWeight',
    'headerFontWeight',
    'footerFontWeight',
    'titleFontSize',
    'bodyFontSize',
    'headerFontSize',
    'footerFontSize',
    'fontSizeOffset',
    'textScale',
    'lineHeight',
    // Spacing & margins
    'headlineSpacingBefore',
    'headlineSpacingAfter',
    'listItemSpacing',
    'headerTop',
    'footerBottom',
    'titleTop',
    'contentTop',
    'contentLeft',
    'contentRight',
    'contentWidth',
    // Theme colors (mapped to :root CSS vars + heading-color overrides in
    // generateCSSVariables / generateHeadingColorOverrides — both part of
    // generateLiveStyleUpdate, so they patch in place). NOTE: `mode` is NOT
    // here — it toggles the body light/dark class, which a CSS-var patch
    // can't change, so it must keep the full rebuild path.
    'lightBackground',
    'darkBackground',
    'lightBodyText',
    'darkBodyText',
    'lightTitleText',
    'darkTitleText',
    'lightHeaderText',
    'darkHeaderText',
    'lightFooterText',
    'darkFooterText',
  ]);

  private isCssOnlyFrontmatterChange(updates: Record<string, unknown>): boolean {
    const keys = Object.keys(updates);
    if (keys.length === 0) {
      return false;
    }
    return keys.every((k) => PerspectaSlidesPlugin.CSS_ONLY_FRONTMATTER_KEYS.has(k));
  }

  private updatePreviewsLive(file: TFile, updates: Record<string, any>) {
    // CSS-only changes (font sizes/scales, spacing, margins, colors, font
    // families) affect only the frontmatter-derived <style> blocks — these
    // can be patched inside the live iframes without a reload (no flicker).
    // Anything that changes DOM structure or body classes (layout, mode,
    // content) needs a full slide rebuild.
    const cssOnly = this.isCssOnlyFrontmatterChange(updates);

    // Update all views without writing to disk
    const thumbnailLeaves = this.app.workspace.getLeavesOfType(THUMBNAIL_VIEW_TYPE);
    for (const leaf of thumbnailLeaves) {
      const view = leaf.view;
      if (!(view instanceof ThumbnailNavigatorView)) {
        continue;
      }
      const presentation = view.getPresentation();
      if (presentation) {
        // patchLiveStyles also applies the frontmatter mutation; fall back
        // to a full rebuild if it can't patch (iframe not ready) or the
        // change isn't CSS-only.
        if (cssOnly && view.patchLiveStyles(updates)) {
          continue;
        }
        Object.assign(presentation.frontmatter, updates);
        view.updateSlides(
          Array.from({ length: presentation.slides.length }, (_, i) => i),
          presentation.slides
        );
      }
    }

    const presentationLeaves = this.app.workspace.getLeavesOfType(PRESENTATION_VIEW_TYPE);
    for (const leaf of presentationLeaves) {
      const view = leaf.view;
      if (!(view instanceof PresentationView)) {
        continue;
      }
      const presentation = view.getPresentation();
      if (presentation) {
        if (cssOnly && view.patchLiveStyles(updates)) {
          continue;
        }
        Object.assign(presentation.frontmatter, updates);
        view.updateCurrentSlideOnly();
      }
    }

    if (this.presentationWindow && this.presentationWindow.isOpen()) {
      const presentation = this.presentationWindow.getPresentation();
      if (presentation) {
        Object.assign(presentation.frontmatter, updates);
        void (async () => {
          // CSS-only changes can be patched into the external window's slide
          // iframes in place (no reload, no flicker), mirroring the in-app
          // preview. Fall back to a full updateContent only when the patch
          // can't apply or the change isn't CSS-only.
          if (cssOnly) {
            const patched = await this.presentationWindow!.patchLiveStyles(
              presentation,
              this.currentTheme || null
            );
            if (patched) {
              return;
            }
          }
          // Refresh the font CSS too — frontmatter font changes won't take
          // effect in the window otherwise, because updateContent reuses the
          // window's stored customFontCSS.
          const css = await this.getCustomFontCSS(presentation.frontmatter);
          this.presentationWindow!.setCustomFontCSS(css);
          this.presentationWindow!.setFontWeightsCache(this.buildFontWeightsCache());
          await this.presentationWindow!.updateContent(presentation, this.currentTheme || null);
        })();
      }
    }
  }

  private updateInspectorFocus() {
    const activeFile = this.app.workspace.getActiveFile();
    const inspectorLeaves = this.app.workspace.getLeavesOfType(INSPECTOR_VIEW_TYPE);

    for (const leaf of inspectorLeaves) {
      const view = leaf.view;
      if (!(view instanceof InspectorPanelView)) {
        continue;
      }
      const isFocused = activeFile !== null && view.getTargetFile()?.path === activeFile.path;
      view.setFocused(isFocused);
    }
  }

  /**
   * Generate @font-face CSS for cached fonts used in the presentation.
   * Delegates to DeckFontResolver, which memoizes the result by
   * (theme, font cache revision, role families, role weights).
   * Hot UI paths (sidebar refresh, external-window updates) get a cache
   * hit and avoid re-reading + re-base64-encoding font binaries.
   */
  async getCustomFontCSS(frontmatter: PresentationFrontmatter): Promise<string> {
    if (!this.fontResolver) {
      this.debugService.warn('font-handling', 'DeckFontResolver not initialized');
      return '';
    }
    const themeName = frontmatter.theme || this.settings.defaultTheme;
    const theme = this.getThemeByName(themeName) ?? null;
    const resolved = await this.fontResolver.resolve({ frontmatter, theme });
    return resolved.faceCSS;
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
      if (theme) {
        return theme;
      }
    }

    // If requested theme not found, try default theme
    // This handles cases like Advanced Slides theme names that don't exist in Perspecta
    if (this.themeLoader && this.settings.defaultTheme && this.settings.defaultTheme !== name) {
      const defaultTheme = this.themeLoader.getTheme(this.settings.defaultTheme);
      if (defaultTheme) {
        return defaultTheme;
      }
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
    const customThemeNames = this.themeLoader?.getCustomThemes().map((t) => t.template.Name) || [];

    const modal = new SaveThemeModal(
      this.app,
      builtInNames,
      customThemeNames,
      this.settings.customThemesFolder,
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

        // Reload themes after saving, then invalidate the font resolver so a
        // theme whose bundled fonts changed re-resolves its @font-face CSS
        // instead of serving stale memoized base64.
        if (this.themeLoader) {
          await this.themeLoader.loadThemes();
        }
        this.fontResolver?.invalidateAll();
      }
    );

    modal.open();
  }

  /**
   * Create a demo presentation from the built-in default theme
   */
  private async createDemoPresentation(
    modalOnOk: () => void,
    modalOnGoToDemo: () => void
  ): Promise<void> {
    try {
      // Install Inter font in background if not already installed
      if (this.fontManager) {
        const interFont = this.fontManager.getCachedFont('Inter');
        if (!interFont) {
          // Install Inter font without user interaction (silent install)
          try {
            await this.fontManager.cacheGoogleFont('Inter', [400, 700], ['normal'], 'Inter');
          } catch (e) {
            console.warn('Failed to auto-install Inter font:', e);
            // Continue anyway - the demo will still work
          }
        }
      }

      // Create the demo folder
      const demFolderPath = 'Perspecta Slides Demo';
      let demoFolder = this.app.vault.getFolderByPath(demFolderPath);
      if (!demoFolder) {
        demoFolder = await this.app.vault.createFolder(demFolderPath);
      }

      // Read the default theme demo content from the vault
      const demoContent = `---
theme: default
header-left: Perspecta Slides
footer-left: Default Slide Template
title-font-size: -40
content-top: 21.2
title-top: 6.4
header-top: 3
light-h2-color: "#918a83"
body-font-size: -20
list-item-spacing: 1.2
headline-spacing-after: 1.3
light-bold-color: "#2f4e98"
title-font: Inter
body-font: Inter
body-font-weight: 400
title-font-weight: 700
content-left: 6
content-right: 6
title: Default Theme
mode: dark
use-dynamic-background: dark
dark-dynamic-background: "#450a0a, #431407, #451a03, #422006, #1a2e05, #052e16, #022c22, #042f2e, #083344, #082f49, #172554, #1e1b4b, #2e1065, #3b0764, #4a044e, #500724, #4c0519"
light-dynamic-background: "#fecaca, #fed7aa, #fde68a, #fef08a, #d9f99d, #bbf7d0, #a7f3d0, #99f6e4, #a5f3fc, #bae6fd, #bfdbfe, #c7d2fe, #ddd6fe, #e9d5ff, #f5d0fe, #fbcfe8, #fecdd3"
lock-aspect-ratio: true
dark-background: "#2b2b2b"
light-background: "#f2ebe3"
line-height: 1.35
dark-bg-cover: "#2b2b2b"
---
layout: cover
opacity: 30%
background: clouds.png
mode: dark

# Perspecta Slides

## Default Theme

GitHub: [owrede/perspecta-slides](https://github.com/owrede/perspecta-slides/)

Enjoy!

---
layout: section
# Default Layout Slide

---
layout: default (hidden)
# This is a hidden slide

Hiding slides is possible by adding ´ (hidden)´ after the ´layout:´ slide override info —or— you can just hide/unhide with the eye-icon in the slide list.

Hidden slides do not use the dynamic background (and they do not interrupt the gradient) and do not count in the total slide count.

---
layout: default
# Default Slide Layout
## Automatic columns for the lazy

Content (#/## headlines, parapgraphs, images) are  detected as potential column element. The auto-detect will create one, two or three columns.

If you need to give the image a little more space...

![[default-clouds.png|Clouds]]

---
layout: 2-columns-1+2
# Default Slide Layout
## Automatic columns for the lazy

... you could use the »2-columns-1+2« layout.[^1]

![[default-clouds.png|Clouds]]

---
layout: default
# Default Slide Layout
## Paragraphs

The slide layout »default« is special compared to the other Layouts because it offers an auto-detection of columns (one, two or three columns)[^2]

To add some a new lines in text without triggering the auto-detection you can use  \\n\\n\\\\n\\n\\nThis will be translated to a new line in the rendered slide. 

**\\\\n → New line**\\n\\nNew lines via \\\\n will connect the text, so that the auto-detection would not detect a new paragraph.

---
layout: default
# Default Slide Layout
## Headlines (###)

### Alternative

- If headlines of level 3 (###) are detected on a slide, then these headlines will be used as column separator for that slide. 
- A second headline of level 3 will create a second column.
### Second Column

![[default-clouds.png|Clouds]]

---
layout: section
# Column Layouts

---
layout: 1-column
# One Column
## Subheadline

- A single column design is the most common way of presenting thoughts in slides. Usually this would be used with a larger typeface.

- Paragraph 2

- Paragraph 3

---
layout: 2-columns
# Two Columns

- Paragraph 1

- Paragraph 2

- *More text in two colums will simply end up in the last column. No additional columne.*

---
layout: 3-columns
# Three Columns

- Paragraph 1

- Paragraph 2

- Paragraph 3

---
layout: 2-columns-2+1
# 2 Columns
## 2/3 + 1/3 

![[default-clouds.png|Clouds]]

Soft giants adrift, \\n
painting shadows on the earth— \\n
sky's fleeting canvas.

---
layout: 2-columns-1+2
# 2 Columns
## 1/3 + 2/3 

Soft giants adrift, \\n
painting shadows on the earth— \\n
sky's fleeting canvas.

![[default-clouds.png|Clouds]]

---
layout: section
# Image Slides

---
layout: half-image
# Half-Image Slide
## Image to the right

![[default-clouds.png|Clouds]]

---
layout: half-image

![[default-clouds.png|Clouds]]
# Half-Image Slide
## Image to the left

---
layout: caption
# Caption Slide

![[clouds.png|Clouds]]

With some caption text.

---
layout: full-image

![[default-clouds.png|Clouds]]

---
layout: half-image-horizontal
# Image
## Image below

![[default-clouds.png|Clouds]]

---
layout: half-image-horizontal

![[default-clouds.png|Clouds]]
# Image
## Image below

---
layout: footnotes
# Footnotes




---
[^1]: By the way: The standard Obsidian footnotes are supported on slides (option globally). The footnote box will stay inside the first column.
[^2]: The auto-detect feature is for quick presentations that try to get to a decent presentation without any extra work. You may want to consider other predefined slide layouts to better control the slide design.`;

      // Create the demo file
      const demoFileName = 'Default Theme Demo.md';
      const demoFile = await this.app.vault.create(
        demoFolder.path + '/' + demoFileName,
        demoContent
      );

      // Show confirmation modal
      const modal = new CreateDemoModal(this.app, modalOnOk, async () => {
        // Hide the settings dialog
        const settingsDialogs = document.querySelectorAll('.mod-settings');
        settingsDialogs.forEach((dialog) => {
          if (dialog instanceof HTMLElement) {
            dialog.style.display = 'none';
          }
        });

        // Close the settings leaf
        const settingsLeaves = this.app.workspace.getLeavesOfType('settings');
        for (const leaf of settingsLeaves) {
          await leaf.detach();
        }

        // Open the demo file
        await this.app.workspace.openLinkText(demoFile.path, '', false);

        // Ensure both sidebars are open
        // Toggle navigator if not visible
        const navigatorLeaves = this.app.workspace.getLeavesOfType(THUMBNAIL_VIEW_TYPE);
        if (navigatorLeaves.length === 0) {
          await this.toggleThumbnailNavigator();
        }

        // Toggle inspector if not visible
        const inspectorLeaves = this.app.workspace.getLeavesOfType(INSPECTOR_VIEW_TYPE);
        if (inspectorLeaves.length === 0) {
          await this.toggleInspector();
        }

        // Open presentation preview (not fullscreen)
        await this.openPresentationView(demoFile);
      });
      modal.open();
    } catch (error) {
      console.error('Failed to create demo presentation:', error);
      new Notice('Failed to create demo presentation: ' + (error as Error).message);
    }
  }
}
