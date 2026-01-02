import { 
  App, 
  Plugin, 
  WorkspaceLeaf,
  TFile,
  MarkdownView,
  Notice,
  addIcon
} from 'obsidian';

import { PerspecaSlidesSettings, DEFAULT_SETTINGS, Presentation } from './src/types';
import { SlideParser } from './src/parser/SlideParser';
import { SlideRenderer } from './src/renderer/SlideRenderer';
import { getTheme } from './src/themes';
import { ThumbnailNavigatorView, THUMBNAIL_VIEW_TYPE } from './src/ui/ThumbnailNavigator';
import { InspectorPanelView, INSPECTOR_VIEW_TYPE } from './src/ui/InspectorPanel';
import { PresentationView, PRESENTATION_VIEW_TYPE } from './src/ui/PresentationView';
import { PerspectaSlidesSettingTab } from './src/ui/SettingsTab';

const SLIDES_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>`;

export default class PerspectaSlidesPlugin extends Plugin {
  settings: PerspecaSlidesSettings = DEFAULT_SETTINGS;
  parser: SlideParser = new SlideParser();
  private presentationWindow: Window | null = null;
  private currentPresentationFile: TFile | null = null;

  async onload() {
    await this.loadSettings();

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
      id: 'export-presentation-html',
      name: 'Export presentation to HTML',
      checkCallback: (checking: boolean) => {
        const file = this.app.workspace.getActiveFile();
        if (file && file.extension === 'md') {
          if (!checking) {
            this.exportToHTML(file);
          }
          return true;
        }
        return false;
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

    this.addRibbonIcon('presentation', 'Open presentation view', () => {
      const file = this.app.workspace.getActiveFile();
      if (file && file.extension === 'md') {
        this.openPresentationView(file);
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
          this.debounceUpdateSidebars(file);
          this.debounceUpdatePresentationWindow(file);
        }
      })
    );

    // Track cursor position to update slide selection
    this.registerEvent(
      this.app.workspace.on('active-leaf-change', () => {
        this.setupCursorTracking();
      })
    );
    
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

    const view = leaf.view as PresentationView;
    await view.loadFile(file);

    this.app.workspace.revealLeaf(leaf);

    if (this.settings.showThumbnailNavigator) {
      await this.ensureThumbnailNavigator();
    }
    if (this.settings.showInspector) {
      await this.ensureInspector();
    }

    this.updateSidebars(file);
  }

  private async toggleThumbnailNavigator() {
    const existing = this.app.workspace.getLeavesOfType(THUMBNAIL_VIEW_TYPE);
    
    if (existing.length > 0) {
      existing[0].detach();
    } else {
      await this.ensureThumbnailNavigator();
      const file = this.app.workspace.getActiveFile();
      if (file) {
        this.updateSidebars(file);
      }
    }
  }

  private async toggleInspector() {
    const existing = this.app.workspace.getLeavesOfType(INSPECTOR_VIEW_TYPE);
    
    if (existing.length > 0) {
      existing[0].detach();
    } else {
      await this.ensureInspector();
      const file = this.app.workspace.getActiveFile();
      if (file) {
        this.updateSidebars(file);
      }
    }
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

  private updateTimeout: ReturnType<typeof setTimeout> | null = null;
  private lastSlideCount: number = 0;

  private debounceUpdateSidebars(file: TFile) {
    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
    }
    // Use shorter delay (100ms) for more responsive updates
    this.updateTimeout = setTimeout(() => {
      this.updateSidebarsIncremental(file);
    }, 100);
  }
  
  /**
   * Incrementally update sidebars. If slide count changed, do full re-render.
   * Otherwise, only update the current slide.
   */
  private async updateSidebarsIncremental(file: TFile) {
    const content = await this.app.vault.read(file);
    const presentation = this.parser.parse(content);
    const newSlideCount = presentation.slides.length;
    
    // Determine current slide index
    const currentSlideIndex = Math.max(0, Math.min(
      this.lastCursorSlideIndex >= 0 ? this.lastCursorSlideIndex : 0,
      newSlideCount - 1
    ));
    
    // Check if slide count changed - if so, do full re-render
    if (newSlideCount !== this.lastSlideCount) {
      this.lastSlideCount = newSlideCount;
      this.updateSidebars(file);
      return;
    }
    
    // Slide count unchanged - do incremental update of current slide only
    const currentSlide = presentation.slides[currentSlideIndex];
    if (!currentSlide) {
      this.updateSidebars(file);
      return;
    }
    
    const theme = getTheme(presentation.frontmatter.theme || this.settings.defaultTheme);
    
    // Update thumbnail navigator (current slide only)
    const thumbnailLeaves = this.app.workspace.getLeavesOfType(THUMBNAIL_VIEW_TYPE);
    for (const leaf of thumbnailLeaves) {
      const view = leaf.view as ThumbnailNavigatorView;
      if (theme) {
        view.setTheme(theme);
      }
      const success = view.updateSlide(currentSlideIndex, currentSlide);
      if (!success) {
        // Fallback to full re-render
        this.updateSidebars(file);
        return;
      }
    }
    
    // Update presentation view (current slide only)
    const presentationLeaves = this.app.workspace.getLeavesOfType(PRESENTATION_VIEW_TYPE);
    for (const leaf of presentationLeaves) {
      const view = leaf.view as PresentationView;
      const success = view.updateSlide(currentSlideIndex, currentSlide);
      if (!success) {
        // Fallback to full re-render
        this.updateSidebars(file);
        return;
      }
    }
    
    // Update inspector with current slide
    const inspectorLeaves = this.app.workspace.getLeavesOfType(INSPECTOR_VIEW_TYPE);
    for (const leaf of inspectorLeaves) {
      const view = leaf.view as InspectorPanelView;
      view.setCurrentSlide(currentSlide, currentSlideIndex);
    }
  }

  private async updateSidebars(file: TFile) {
    const content = await this.app.vault.read(file);
    const presentation = this.parser.parse(content);
    const theme = getTheme(presentation.frontmatter.theme || this.settings.defaultTheme);

    // Update slide count tracking
    this.lastSlideCount = presentation.slides.length;

    // Preserve current slide index (use lastCursorSlideIndex or 0)
    const currentSlideIndex = Math.max(0, Math.min(
      this.lastCursorSlideIndex >= 0 ? this.lastCursorSlideIndex : 0,
      presentation.slides.length - 1
    ));

    const thumbnailLeaves = this.app.workspace.getLeavesOfType(THUMBNAIL_VIEW_TYPE);
    for (const leaf of thumbnailLeaves) {
      const view = leaf.view as ThumbnailNavigatorView;
      view.setPresentation(presentation, file, theme);
      view.setOnSlideSelect((index) => {
        this.navigateToSlide(index, presentation, file);
      });
      view.setOnSlideReorder((fromIndex, toIndex) => {
        this.reorderSlides(file, fromIndex, toIndex);
      });
      // Preserve selection
      view.selectSlide(currentSlideIndex);
    }

    const inspectorLeaves = this.app.workspace.getLeavesOfType(INSPECTOR_VIEW_TYPE);
    for (const leaf of inspectorLeaves) {
      const view = leaf.view as InspectorPanelView;
      view.setPresentation(presentation, file);
      if (presentation.slides.length > 0 && presentation.slides[currentSlideIndex]) {
        view.setCurrentSlide(presentation.slides[currentSlideIndex], currentSlideIndex);
      }
      view.setOnSlideMetadataChange((slideIndex, metadata) => {
        this.updateSlideMetadata(file, slideIndex, metadata);
      });
      view.setOnPresentationChange((frontmatter) => {
        this.updatePresentationFrontmatter(file, frontmatter);
      });
    }

    const presentationLeaves = this.app.workspace.getLeavesOfType(PRESENTATION_VIEW_TYPE);
    for (const leaf of presentationLeaves) {
      const view = leaf.view as PresentationView;
      view.setPresentation(presentation, theme);
      // Wire up slide change callback for navigation controls (prev/next buttons)
      view.setOnSlideChange((index) => {
        this.navigateToSlide(index, presentation, file, true);
      });
      // Wire up reload callback for full refresh
      view.setOnReload(() => {
        this.updateSidebars(file);
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
        const view = leaf.view as PresentationView;
        view.goToSlide(index);
      }
    }

    const inspectorLeaves = this.app.workspace.getLeavesOfType(INSPECTOR_VIEW_TYPE);
    for (const leaf of inspectorLeaves) {
      const view = leaf.view as InspectorPanelView;
      if (presentation.slides[index]) {
        view.setCurrentSlide(presentation.slides[index], index);
      }
    }

    const thumbnailLeaves = this.app.workspace.getLeavesOfType(THUMBNAIL_VIEW_TYPE);
    for (const leaf of thumbnailLeaves) {
      const view = leaf.view as ThumbnailNavigatorView;
      view.selectSlide(index);
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
      const lineNumber = this.getLineNumberForSlide(content, index);
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
        const view = leaf.view as ThumbnailNavigatorView;
        view.selectSlide(slideIndex);
      }

      // Update inspector panel
      const inspectorLeaves = this.app.workspace.getLeavesOfType(INSPECTOR_VIEW_TYPE);
      for (const leaf of inspectorLeaves) {
        const view = leaf.view as InspectorPanelView;
        view.setCurrentSlide(presentation.slides[slideIndex], slideIndex);
      }

      // Update presentation view (without triggering callback to avoid cursor repositioning)
      const presentationLeaves = this.app.workspace.getLeavesOfType(PRESENTATION_VIEW_TYPE);
      for (const leaf of presentationLeaves) {
        const view = leaf.view as PresentationView;
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

  private async exportToHTML(file: TFile) {
    const content = await this.app.vault.read(file);
    const presentation = this.parser.parse(content);
    const theme = getTheme(presentation.frontmatter.theme || this.settings.defaultTheme);
    const renderer = new SlideRenderer(presentation, theme);
    const html = renderer.renderHTML();

    const exportPath = file.path.replace(/\.md$/, '.html');
    
    const existingFile = this.app.vault.getAbstractFileByPath(exportPath);
    if (existingFile instanceof TFile) {
      await this.app.vault.modify(existingFile, html);
    } else {
      await this.app.vault.create(exportPath, html);
    }

    new Notice(`Exported presentation to ${exportPath}`);
  }

  private async startPresentation(file: TFile) {
    const content = await this.app.vault.read(file);
    const presentation = this.parser.parse(content);
    const theme = getTheme(presentation.frontmatter.theme || this.settings.defaultTheme);
    const renderer = new SlideRenderer(presentation, theme);
    const html = renderer.renderHTML();

    // Write to a temporary HTML file and open with system browser
    const tempFileName = `.perspecta-presentation-${Date.now()}.html`;
    
    try {
      // Clean up any existing temp files
      const existingFile = this.app.vault.getAbstractFileByPath(tempFileName);
      if (existingFile) {
        await this.app.vault.delete(existingFile);
      }
      
      // Create the temp file
      await this.app.vault.create(tempFileName, html);
      
      // Get the full file path
      const adapter = this.app.vault.adapter as any;
      if (adapter.getFullPath) {
        const fullPath = adapter.getFullPath(tempFileName);
        
        // Use Electron's shell to open the file in default browser
        const { shell } = require('electron');
        await shell.openPath(fullPath);
        
        this.currentPresentationFile = file;
        
        // Store temp file path for live updates
        (this as any)._tempPresentationPath = tempFileName;
        (this as any)._tempPresentationFullPath = fullPath;
        
        // Clean up temp file after a delay (user has time to view it)
        setTimeout(async () => {
          try {
            const tempFile = this.app.vault.getAbstractFileByPath(tempFileName);
            if (tempFile) {
              await this.app.vault.delete(tempFile);
            }
          } catch (e) {
            // Ignore cleanup errors
          }
          (this as any)._tempPresentationPath = null;
          (this as any)._tempPresentationFullPath = null;
        }, 60000); // Keep for 1 minute
      } else {
        new Notice('Could not determine file path');
      }
    } catch (e) {
      new Notice('Could not start presentation: ' + (e as Error).message);
    }
  }

  private presentationUpdateTimeout: ReturnType<typeof setTimeout> | null = null;

  private debounceUpdatePresentationWindow(file: TFile) {
    if (this.presentationUpdateTimeout) {
      clearTimeout(this.presentationUpdateTimeout);
    }
    this.presentationUpdateTimeout = setTimeout(() => {
      this.updatePresentationWindow(file);
    }, 500);
  }

  private async updatePresentationWindow(file: TFile) {
    // Only update if we have an active presentation for this file
    const tempPath = (this as any)._tempPresentationPath;
    if (!tempPath || !this.currentPresentationFile) {
      return;
    }

    if (this.currentPresentationFile.path !== file.path) {
      return;
    }

    // Update the temp HTML file - browser will need manual refresh
    // For now, we just update sidebars. True live sync would require WebSocket or similar.
    // The sidebars and presentation view within Obsidian will update automatically.
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

    // Split by slide separator
    const slideRawContents = bodyContent.split(/\n---+\s*\n/);

    // Reorder
    const [movedSlide] = slideRawContents.splice(fromIndex, 1);
    slideRawContents.splice(toIndex, 0, movedSlide);

    // Reconstruct the document
    const newBody = slideRawContents.join('\n\n---\n\n');
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
    this.updateSidebarsIncremental(file);
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
    
    // Full refresh for frontmatter changes (affects all slides)
    this.updateSidebars(file);
  }
}
