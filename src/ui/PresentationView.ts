import { ItemView, WorkspaceLeaf, Menu, TFile, Notice } from 'obsidian';
import { Presentation, Slide, Theme, SlideElement } from '../types';
import { SlideParser } from '../parser/SlideParser';
import { SlideRenderer, ImagePathResolver } from '../renderer/SlideRenderer';
import { getTheme } from '../themes';
import { ThemeLoader } from '../themes/ThemeLoader';
import { PresentationWindow } from './PresentationWindow';
import { getDebugService } from '../utils/DebugService';

export const PRESENTATION_VIEW_TYPE = 'perspecta-presentation';

export class PresentationView extends ItemView {
  private presentation: Presentation | null = null;
  private currentSlideIndex: number = 0;
  private isPresenting: boolean = false;
  private parser: SlideParser;
  private file: TFile | null = null;
  private theme: Theme | null = null;
  private imagePathResolver: ImagePathResolver | null = null;
  private presentationImagePathResolver: ImagePathResolver | null = null;
  private customFontCSS: string = '';
  private themeLoader: ThemeLoader | null = null;
  
  private onSlideChange: ((index: number) => void) | null = null;
  private onReload: (() => void) | null = null;
  private onGetFontCSS: ((frontmatter: any) => Promise<string>) | null = null;
  private onStartPresentation: ((file: TFile, slideIndex: number) => void) | null = null;
  private onStartPresenterView: ((file: TFile) => Promise<void>) | null = null;
  private fontWeightsCache: Map<string, number[]> = new Map();
  
  // Live update related properties
  private sourceFile: TFile | null = null;
  private fileWatcher: any = null;
  
  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
    this.parser = new SlideParser();
  }
  
  /**
   * Set the image path resolver for wiki-link images (app:// URLs for Obsidian views)
   */
  setImagePathResolver(resolver: ImagePathResolver): void {
    this.imagePathResolver = resolver;
  }
  
  /**
   * Set the image path resolver for presentation window (file:// URLs for external window)
   */
  setPresentationImagePathResolver(resolver: ImagePathResolver): void {
    this.presentationImagePathResolver = resolver;
  }
  
  /**
   * Set custom font CSS for cached Google Fonts
   */
  setCustomFontCSS(css: string): void {
    this.customFontCSS = css;
  }

  /**
   * Set the theme loader for resolving custom themes
   */
  setThemeLoader(loader: ThemeLoader): void {
    this.themeLoader = loader;
  }

  /**
   * Set the font weights cache for validating font weights
   */
  setFontWeightsCache(cache: Map<string, number[]>): void {
    this.fontWeightsCache = cache;
  }

  /**
   * Get a theme by name, using themeLoader if available
   */
  private getThemeByName(name: string): Theme | undefined {
    if (this.themeLoader) {
      const theme = this.themeLoader.getTheme(name);
      if (theme) return theme;
    }
    return getTheme(name);
  }

  /**
   * Create a SlideRenderer with the image path resolver
   */
  private createRenderer(theme?: Theme): SlideRenderer {
    const renderer = new SlideRenderer(
      this.presentation!, 
      theme || this.theme || undefined, 
      this.imagePathResolver || undefined
    );
    if (this.customFontCSS) {
      renderer.setCustomFontCSS(this.customFontCSS);
    }
    // Set font weights cache for validation
    renderer.setFontWeightsCache(this.fontWeightsCache);
    // Set system color scheme so 'system' mode resolves correctly
    renderer.setSystemColorScheme(this.getSystemColorScheme());
    return renderer;
  }

  /**
   * Detect the system color scheme (light or dark)
   */
  private getSystemColorScheme(): 'light' | 'dark' {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  }
  
  getViewType(): string {
    return PRESENTATION_VIEW_TYPE;
  }
  
  getDisplayText(): string {
    return this.file?.basename || 'Presentation';
  }
  
  getIcon(): string {
    return 'presentation';
  }
  
  async onOpen() {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass('perspecta-presentation-view');
    
    this.renderEmptyState(container as HTMLElement);
    this.registerKeyboardShortcuts();
  }
  
  async onClose() {
    // Cleanup
  }
  
  async loadFile(file: TFile) {
    const debug = getDebugService();
    debug.log('presentation-view', `loadFile called with file: ${file.name} (${file.path})`);
    
    this.file = file;
    const content = await this.app.vault.read(file);
    debug.log('presentation-view', `Read content, length: ${content.length}`);
    
    this.presentation = this.parser.parse(content);
    debug.log('presentation-view', `Parsed presentation, slides count: ${this.presentation.slides.length}`);
    
    this.currentSlideIndex = 0;
    this.render();
    
    debug.log('presentation-view', `loadFile completed. File: ${this.file?.path}, has presentation: ${!!this.presentation}`);
  }
  
  setPresentation(presentation: Presentation, theme?: Theme, sourceFile?: TFile) {
    this.presentation = presentation;
    this.currentSlideIndex = 0;
    this.theme = theme || null;
    
    // Set up live updates if we have a source file
    if (sourceFile) {
      this.setupLiveUpdates(sourceFile);
    }
    
    this.render();
  }
  
  setOnSlideChange(callback: (index: number) => void) {
    this.onSlideChange = callback;
  }
  
  setOnReload(callback: () => void) {
    this.onReload = callback;
  }
  
  setOnGetFontCSS(callback: (frontmatter: any) => Promise<string>) {
    this.onGetFontCSS = callback;
  }
  
  setOnStartPresentation(callback: (file: TFile, slideIndex: number) => void) {
    this.onStartPresentation = callback;
  }

  setOnStartPresenterView(callback: (file: TFile) => Promise<void>) {
    this.onStartPresenterView = callback;
  }
  
  private setupLiveUpdates(sourceFile: TFile) {
    const debug = getDebugService();
    debug.log('presentation-view', `Setting up live updates for file: ${sourceFile.path}`);
    
    // Clean up existing watcher
    if (this.fileWatcher) {
      this.fileWatcher();
      this.fileWatcher = null;
    }
    
    this.sourceFile = sourceFile;
    
    // Watch for file changes
    this.fileWatcher = this.registerEvent(
      this.app.vault.on('modify', async (file) => {
        if (file.path === sourceFile.path) {
          debug.log('presentation-view', 'Source file modified, updating presentation...');
          try {
            if (!(file instanceof TFile)) return;
            const content = await this.app.vault.read(file);
            const newPresentation = this.parser.parse(content);
            
            // Update the presentation while keeping current slide
            const currentSlide = this.currentSlideIndex;
            this.presentation = newPresentation;
            
            // Make sure we don't go beyond the slide count
            if (currentSlide >= newPresentation.slides.length) {
              this.currentSlideIndex = newPresentation.slides.length - 1;
            }
            
            this.render();
            debug.log('presentation-view', 'Presentation updated successfully');
          } catch (error) {
            debug.error('presentation-view', 'Failed to update presentation on file change:', error);
          }
        }
      })
    );
  }
  
  goToSlide(index: number, triggerCallback: boolean = true) {
    if (!this.presentation) return;
    
    if (index < 0) index = 0;
    if (index >= this.presentation.slides.length) {
      index = this.presentation.slides.length - 1;
    }
    
    this.currentSlideIndex = index;
    this.updateSlideDisplay();
    
    if (triggerCallback && this.onSlideChange) {
      this.onSlideChange(index);
    }
  }
  
  nextSlide() {
    this.goToSlide(this.currentSlideIndex + 1);
  }
  
  previousSlide() {
    this.goToSlide(this.currentSlideIndex - 1);
  }
  
  getCurrentSlide(): Slide | null {
    if (!this.presentation) return null;
    return this.presentation.slides[this.currentSlideIndex];
  }
  
  getPresentation(): Presentation | null {
    return this.presentation;
  }
  
  getSlideCount(): number {
    return this.presentation?.slides.length || 0;
  }
  
  /**
   * Update a single slide without re-rendering the entire presentation.
   * Returns true if the update was successful, false if a full re-render is needed.
   */
  updateSlide(index: number, slide: Slide): boolean {
    if (!this.presentation) return false;
    
    // Update the slide in the presentation data
    this.presentation.slides[index] = slide;
    
    // Only re-render if this is the currently displayed slide
    if (index === this.currentSlideIndex) {
      // Find the iframe and update its content
      const iframe = this.containerEl.querySelector('.slide-wrapper .slide-iframe') as HTMLIFrameElement;
      if (!iframe) return false;
      
      const theme = this.getThemeByName(this.presentation.frontmatter.theme || '');
      const renderer = this.createRenderer(theme);
      
      const slideHTML = renderer.renderSingleSlideHTML(
        slide,
        index,
        this.presentation.frontmatter,
        'preview'
      );
      
      iframe.srcdoc = slideHTML;
      
      // Update speaker notes
      const notesContainer = this.containerEl.querySelector('.speaker-notes-container');
      if (notesContainer) {
        (notesContainer as HTMLElement).empty();
        this.renderSpeakerNotes(notesContainer as HTMLElement);
      }
    }
    
    return true;
  }
  
  /**
   * Update multiple slides by their indices (for incremental updates)
   * Only updates slides that are currently rendered (current slide in this view)
   */
  updateSlides(indices: number[], slides: Slide[]): boolean {
    if (!this.presentation) return false;
    
    // Update the slides in the presentation object
    for (let i = 0; i < indices.length; i++) {
      const index = indices[i];
      const slide = slides[i];
      this.presentation.slides[index] = slide;
    }
    
    // Only re-render if current slide is in the modified list
    if (indices.includes(this.currentSlideIndex)) {
      const currentSlide = slides[indices.indexOf(this.currentSlideIndex)];
      if (currentSlide) {
        return this.updateSlide(this.currentSlideIndex, currentSlide);
      }
    }
    
    return true;
  }
  
  /**
   * Check if a slide index is currently being displayed
   */
  isSlideVisible(index: number): boolean {
    return index === this.currentSlideIndex;
  }
  
  /**
   * Update just the current slide display without touching other slides
   */
  updateCurrentSlideOnly(): boolean {
    if (!this.presentation) return false;
    const currentSlide = this.presentation.slides[this.currentSlideIndex];
    if (!currentSlide) return false;
    return this.updateSlide(this.currentSlideIndex, currentSlide);
  }
  
  private render() {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    
    if (!this.presentation || this.presentation.slides.length === 0) {
      this.renderEmptyState(container);
      return;
    }
    
    // Toolbar
    const toolbar = container.createDiv({ cls: 'presentation-toolbar' });
    this.renderToolbar(toolbar);
    
    // Slide container
    const slideContainer = container.createDiv({ cls: 'slide-container' });
    this.renderSlides(slideContainer);
    
    // Speaker notes (below or hidden)
    const notesContainer = container.createDiv({ cls: 'speaker-notes-container' });
    this.renderSpeakerNotes(notesContainer);
    
    // Navigation
    const nav = container.createDiv({ cls: 'slide-navigation' });
    this.renderNavigation(nav);
  }
  
  private renderEmptyState(container: HTMLElement) {
    const empty = container.createDiv({ cls: 'empty-state' });
    empty.createEl('div', { cls: 'empty-icon', text: '📽️' });
    empty.createEl('h3', { text: 'No presentation loaded' });
    empty.createEl('p', { text: 'Open a markdown file with slide content' });
    
    const helpSection = empty.createDiv({ cls: 'help-section' });
    helpSection.createEl('h4', { text: 'Quick Start' });
    helpSection.createEl('pre', { 
      text: `---
title: My Presentation
theme: zurich
---

# Welcome

This is my first slide

---

## Second Slide

Regular text becomes speaker notes.

\t- Tab-indented content appears on slide
\t- Like this list

---

### Section Title

More content here...`
    });
  }
  
  private renderToolbar(container: HTMLElement) {
    // Title
    const title = container.createDiv({ cls: 'toolbar-title' });
    title.createEl('span', { 
      text: this.presentation?.frontmatter.title || this.file?.basename || 'Untitled' 
    });
    
    // Actions
    const actions = container.createDiv({ cls: 'toolbar-actions' });
    
    // Present button
    const presentBtn = actions.createEl('button', { cls: 'mod-cta' });
    presentBtn.createSpan({ text: 'Present' });
    presentBtn.addEventListener('click', () => {
      const debug = getDebugService();
      debug.log('presentation-view', 'Present button clicked');
      this.startPresentation();
    });
    
    // Presenter View button
    const presenterBtn = actions.createEl('button');
    presenterBtn.createSpan({ text: 'Presenter View' });
    presenterBtn.addEventListener('click', () => {
      const debug = getDebugService();
      debug.log('presentation-view', 'Presenter View button clicked');
      this.startPresenterView();
    });
    
    // Export button
    const exportBtn = actions.createEl('button');
    exportBtn.createSpan({ text: 'Export HTML' });
    exportBtn.addEventListener('click', () => this.exportHTML());
    
    // More options
    const moreBtn = actions.createEl('button');
    moreBtn.createSpan({ text: '⋯' });
    moreBtn.addEventListener('click', (e) => this.showOptionsMenu(e));
  }
  
  /**
   * Get the container class for a layout (iA Presenter pattern)
   */
  private getContainerClass(layout: string): string {
    switch (layout) {
      case 'cover': return 'cover-container';
      case 'title': return 'title-container';
      case 'section': return 'section-container';
      case 'full-image': return 'image-container';
      case 'half-image': return 'split-container';
      case 'caption': return 'caption-container';
      case 'grid': return 'grid-container';
      case '1-column':
      case '2-columns':
      case '3-columns':
      case '2-columns-1+2':
      case '2-columns-2+1':
        return 'columns-container';
      default: return 'default-container';
    }
  }
  
  private renderSlides(container: HTMLElement) {
    if (!this.presentation) return;
    
    const theme = this.getThemeByName(this.presentation.frontmatter.theme || '');
    const themeClasses = theme?.template.CssClasses || '';
    
    // Create slide wrapper with aspect ratio
    const aspectRatio = this.presentation.frontmatter.aspectRatio || '16:9';
    const wrapper = container.createDiv({ 
      cls: `slide-wrapper aspect-${aspectRatio.replace(':', '-')} ${themeClasses}` 
    });
    
    // Create renderer with theme
    const renderer = this.createRenderer(theme);
    
    // Render current slide as iframe
    const currentSlide = this.presentation.slides[this.currentSlideIndex];
    if (currentSlide) {
      const slideHTML = renderer.renderSingleSlideHTML(
        currentSlide, 
        this.currentSlideIndex, 
        this.presentation.frontmatter,
        'preview'
      );
      
      const iframe = wrapper.createEl('iframe', {
        cls: 'slide-iframe',
        attr: {
          srcdoc: slideHTML,
          frameborder: '0',
          scrolling: 'no'
        }
      });
      
      // Make iframe responsive
      iframe.style.width = '100%';
      iframe.style.height = '100%';
      iframe.style.border = 'none';
      iframe.style.background = 'transparent';
      
      // Handle link clicks inside iframe - open in external browser
      iframe.addEventListener('load', () => {
        this.setupIframeLinkHandlers(iframe);
      });
    }
  }
  
  /**
   * Setup click handlers for links inside an iframe to open in external browser
   */
  private setupIframeLinkHandlers(iframe: HTMLIFrameElement): void {
    try {
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (iframeDoc) {
        iframeDoc.querySelectorAll('a[href]').forEach((link: Element) => {
          link.addEventListener('click', (e: Event) => {
            e.preventDefault();
            const url = (link as HTMLAnchorElement).href;
            if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
              // Open in external browser
              window.open(url, '_blank');
            }
          });
        });
      }
    } catch (err) {
      // Security restrictions may prevent access to iframe content
      console.debug('Could not setup iframe link handlers:', err);
    }
  }
  
  private renderSlideHeader(container: HTMLElement, index: number) {
    const fm = this.presentation?.frontmatter;
    if (!fm?.headerLeft && !fm?.headerMiddle && !fm?.headerRight) return;
    
    const header = container.createDiv({ cls: 'slide-header' });
    header.createDiv({ cls: 'header-left', text: fm.headerLeft || '' });
    header.createDiv({ cls: 'header-middle', text: fm.headerMiddle || '' });
    header.createDiv({ cls: 'header-right', text: fm.headerRight || '' });
  }
  
  private renderSlideFooter(container: HTMLElement, index: number) {
    const fm = this.presentation?.frontmatter;
    const footer = container.createDiv({ cls: 'slide-footer' });
    footer.createDiv({ cls: 'footer-left', text: fm?.footerLeft || '' });
    footer.createDiv({ cls: 'footer-middle', text: fm?.footerMiddle || '' });
    footer.createDiv({ 
      cls: 'footer-right', 
      text: fm?.showSlideNumbers !== false ? String(index + 1) : '' 
    });
  }
  
  private renderSlideContent(container: HTMLElement, slide: Slide) {
    const layout = slide.metadata.layout || 'default';
    const elements = slide.elements.filter(e => e.visible);
    const images = elements.filter(e => e.type === 'image');
    const textElements = elements.filter(e => e.type !== 'image');
    const headings = elements.filter(e => e.type === 'heading' || e.type === 'kicker');
    const bodyElements = elements.filter(e => e.type !== 'heading' && e.type !== 'kicker' && e.type !== 'image');
    
    switch (layout) {
      // ==================
      // STANDARD SLIDES
      // ==================
      
      case 'cover':
        this.renderCoverLayout(container, elements);
        break;
      
      case 'title':
        this.renderTitleLayout(container, elements);
        break;
        
      case 'section':
        this.renderSectionLayout(container, elements);
        break;
        
      case 'default':
        this.renderDefaultLayout(container, elements);
        break;
      
      // ==================
      // TEXT SLIDES
      // ==================
      
      case '1-column':
        this.renderColumnLayout(container, elements, 1);
        break;
        
      case '2-columns':
        this.renderColumnLayout(container, elements, 2, 'equal');
        break;
        
      case '3-columns':
        this.renderColumnLayout(container, elements, 3, 'equal');
        break;
        
      case '2-columns-1+2':
        this.renderColumnLayout(container, elements, 2, 'narrow-wide');
        break;
        
      case '2-columns-2+1':
        this.renderColumnLayout(container, elements, 2, 'wide-narrow');
        break;
      
      // ==================
      // IMAGE SLIDES
      // ==================
      
      case 'full-image':
        this.renderFullImageLayout(container, images);
        break;
        
      case 'caption':
        this.renderCaptionLayout(container, headings, images, bodyElements);
        break;
        
      case 'half-image':
        this.renderHalfImageLayout(container, elements, images, textElements);
        break;
        
      default:
        this.renderDefaultLayout(container, elements);
    }
  }
  
  // ==================
  // STANDARD LAYOUTS
  // ==================
  
  /**
   * Cover Layout: Opening slide with centered content (iA Presenter compatible)
   */
  private renderCoverLayout(container: HTMLElement, elements: SlideElement[]) {
    elements.forEach(el => this.renderElement(container, el));
  }
  
  /**
   * Title Layout: Centered content with large headings
   */
  private renderTitleLayout(container: HTMLElement, elements: SlideElement[]) {
    elements.forEach(el => this.renderElement(container, el));
  }
  
  /**
   * Section Layout: Accent background, centered heading
   */
  private renderSectionLayout(container: HTMLElement, elements: SlideElement[]) {
    elements.forEach(el => this.renderElement(container, el));
  }
  
  /**
   * Default Layout: Auto-detects columns based on columnIndex
   */
  private renderDefaultLayout(container: HTMLElement, elements: SlideElement[]) {
    const columnElements = elements.filter(e => e.columnIndex !== undefined);
    const nonColumnElements = elements.filter(e => e.columnIndex === undefined);
    
    // If no column elements, render as single column
    if (columnElements.length === 0) {
      elements.forEach(el => this.renderElement(container, el));
      return;
    }
    
    // Auto-detect column count
    const maxColumnIndex = Math.max(...columnElements.map(e => e.columnIndex ?? 0));
    const columnCount = Math.min(maxColumnIndex + 1, 3);
    
    // Render header (non-column elements)
    const headerSlot = container.createDiv({ cls: 'slot-header' });
    nonColumnElements.forEach(el => this.renderElement(headerSlot, el));
    
    // Group elements by column
    const columns: SlideElement[][] = Array.from({ length: columnCount }, () => []);
    columnElements.forEach(e => {
      const idx = Math.min(e.columnIndex ?? 0, columnCount - 1);
      columns[idx].push(e);
    });
    
    // Render columns
    const columnsSlot = container.createDiv({ cls: `slot-columns columns-${columnCount}` });
    columns.forEach((col, i) => {
      const colDiv = columnsSlot.createDiv({ cls: 'column' });
      colDiv.dataset.column = String(i + 1);
      col.forEach(el => this.renderElement(colDiv, el));
    });
  }
  
  // ==================
  // TEXT LAYOUTS
  // ==================
  
  /**
   * Column Layout: Explicit column control
   */
  private renderColumnLayout(
    container: HTMLElement, 
    elements: SlideElement[], 
    columnCount: number, 
    ratio: 'equal' | 'narrow-wide' | 'wide-narrow' = 'equal'
  ) {
    const columnElements = elements.filter(e => e.columnIndex !== undefined);
    const nonColumnElements = elements.filter(e => e.columnIndex === undefined);
    
    // Find how many data columns exist
    const maxDataColumn = columnElements.reduce((max, e) => 
      Math.max(max, e.columnIndex ?? 0), -1);
    const dataColumnCount = maxDataColumn + 1;
    
    // Render header slot
    const headerSlot = container.createDiv({ cls: 'slot-header' });
    nonColumnElements.forEach(el => this.renderElement(headerSlot, el));
    
    // Group elements into visual columns, merging overflow into last column
    const columns: SlideElement[][] = Array.from({ length: columnCount }, () => []);
    
    if (columnElements.length === 0) {
      // No column elements - put body elements in first column
      const bodyElements = nonColumnElements.filter(e => 
        e.type !== 'heading' && e.type !== 'kicker');
      columns[0] = bodyElements;
    } else {
      columnElements.forEach(e => {
        let targetCol = e.columnIndex ?? 0;
        if (dataColumnCount > columnCount && targetCol >= columnCount - 1) {
          targetCol = columnCount - 1;
        }
        columns[Math.min(targetCol, columnCount - 1)].push(e);
      });
    }
    
    // Render columns slot
    const columnsSlot = container.createDiv({ cls: `slot-columns columns-${columnCount} ratio-${ratio}` });
    columns.forEach((col, i) => {
      const colDiv = columnsSlot.createDiv({ cls: 'column' });
      colDiv.dataset.column = String(i + 1);
      col.forEach(el => this.renderElement(colDiv, el));
    });
  }
  
  // ==================
  // IMAGE LAYOUTS
  // ==================
  
  /**
   * Full Image Layout: Images fill entire slide
   */
  private renderFullImageLayout(container: HTMLElement, images: SlideElement[]) {
    if (images.length > 1) {
      container.addClass(`count-${images.length}`);
    }
    
    if (images.length === 0) {
      container.createDiv({ cls: 'empty', text: 'No images' });
      return;
    }
    
    images.forEach(img => {
      const slot = container.createDiv({ cls: 'image-slot' });
      slot.createEl('img', { attr: { src: img.content, alt: '' } });
    });
  }
  
  /**
   * Caption Layout: Full image with title bar and caption
   */
  private renderCaptionLayout(
    container: HTMLElement,
    headings: SlideElement[], 
    images: SlideElement[], 
    bodyElements: SlideElement[]
  ) {
    // Title bar
    const titleBar = container.createDiv({ cls: 'slot-title-bar' });
    headings.forEach(el => this.renderElement(titleBar, el));
    
    // Image slot
    const imageSlot = container.createDiv({ cls: 'slot-image' });
    images.forEach(img => {
      const slot = imageSlot.createDiv({ cls: 'image-slot' });
      slot.createEl('img', { attr: { src: img.content, alt: '' } });
    });
    
    // Caption slot
    if (bodyElements.length > 0) {
      const captionSlot = container.createDiv({ cls: 'slot-caption' });
      bodyElements.forEach(el => this.renderElement(captionSlot, el));
    }
  }
  
  /**
   * Half Image Layout: Half for image(s), half for text
   */
  private renderHalfImageLayout(
    container: HTMLElement,
    allElements: SlideElement[],
    images: SlideElement[], 
    textElements: SlideElement[]
  ) {
    // Determine if images come first
    const firstElement = allElements[0];
    const imageFirst = firstElement?.type === 'image';
    
    if (imageFirst) {
      container.addClass('image-left');
      
      const imageSlot = container.createDiv({ cls: 'slot-image' });
      images.forEach(img => {
        const slot = imageSlot.createDiv({ cls: 'image-slot' });
        slot.createEl('img', { attr: { src: img.content, alt: '' } });
      });
      
      const textSlot = container.createDiv({ cls: 'slot-text' });
      textElements.forEach(el => this.renderElement(textSlot, el));
    } else {
      container.addClass('image-right');
      
      const textSlot = container.createDiv({ cls: 'slot-text' });
      textElements.forEach(el => this.renderElement(textSlot, el));
      
      const imageSlot = container.createDiv({ cls: 'slot-image' });
      images.forEach(img => {
        const slot = imageSlot.createDiv({ cls: 'image-slot' });
        slot.createEl('img', { attr: { src: img.content, alt: '' } });
      });
    }
  }
  
  private renderElement(container: HTMLElement, element: any) {
    switch (element.type) {
      case 'heading':
        container.createEl(`h${element.level || 1}` as keyof HTMLElementTagNameMap, {
          text: element.content
        });
        break;
        
      case 'paragraph':
        container.createEl('p', { text: element.content });
        break;
        
      case 'list':
        const isOrdered = /^\d+\./.test(element.content);
        const listEl = container.createEl(isOrdered ? 'ol' : 'ul');
        element.content.split('\n').forEach((item: string) => {
          const text = item.replace(/^[-*+]\s+/, '').replace(/^\d+\.\s+/, '');
          listEl.createEl('li', { text });
        });
        break;
        
      case 'blockquote':
        container.createEl('blockquote', { text: element.content });
        break;
        
      case 'image':
        const figure = container.createEl('figure');
        figure.createEl('img', { attr: { src: element.content, alt: '' } });
        break;
        
      case 'code':
        const pre = container.createEl('pre');
        pre.createEl('code', { text: element.content });
        break;
        
      case 'table':
        this.renderTable(container, element.content);
        break;
        
      default:
        container.createEl('p', { text: element.content });
    }
  }
  
  private renderTable(container: HTMLElement, content: string) {
    const lines = content.split('\n').filter((l: string) => l.trim());
    if (lines.length < 2) return;
    
    const table = container.createEl('table');
    const thead = table.createEl('thead');
    const tbody = table.createEl('tbody');
    
    // Header
    const headerCells = lines[0].split('|').filter((c: string) => c.trim());
    const headerRow = thead.createEl('tr');
    headerCells.forEach((cell: string) => {
      headerRow.createEl('th', { text: cell.trim() });
    });
    
    // Body (skip separator line)
    lines.slice(2).forEach((line: string) => {
      const cells = line.split('|').filter((c: string) => c.trim());
      const row = tbody.createEl('tr');
      cells.forEach((cell: string) => {
        row.createEl('td', { text: cell.trim() });
      });
    });
  }
  
  private renderSpeakerNotes(container: HTMLElement) {
    if (!this.presentation) return;
    
    const slide = this.presentation.slides[this.currentSlideIndex];
    if (!slide || slide.speakerNotes.length === 0) {
      container.createDiv({ cls: 'no-notes', text: 'No speaker notes for this slide' });
      return;
    }
    
    container.createEl('h4', { text: 'Speaker Notes' });
    const notes = container.createDiv({ cls: 'notes-content' });
    slide.speakerNotes.forEach(note => {
      // Filter out "note:" or "notes:" markers (from advanced-slides mode)
      const trimmed = note.trim().toLowerCase();
      if (trimmed === 'note:' || trimmed === 'notes:') {
        return; // Skip the marker line
      }
      notes.createEl('p', { text: note });
    });
  }
  
  private renderNavigation(container: HTMLElement) {
    if (!this.presentation) return;
    
    // Previous button
    const prevBtn = container.createEl('button', { cls: 'nav-btn' });
    prevBtn.createSpan({ text: '←' });
    prevBtn.addEventListener('click', () => this.previousSlide());
    
    // Slide counter
    const counter = container.createDiv({ cls: 'slide-counter' });
    counter.createSpan({ 
      text: `${this.currentSlideIndex + 1} / ${this.presentation.slides.length}` 
    });
    
    // Next button
    const nextBtn = container.createEl('button', { cls: 'nav-btn' });
    nextBtn.createSpan({ text: '→' });
    nextBtn.addEventListener('click', () => this.nextSlide());
  }
  
  private updateSlideDisplay() {
    // Re-render the slide iframe with the current slide
    const slideContainer = this.containerEl.querySelector('.slide-container') as HTMLElement;
    if (slideContainer && this.presentation) {
      slideContainer.empty();
      this.renderSlides(slideContainer);
    }
    
    // Update counter
    const counter = this.containerEl.querySelector('.slide-counter span');
    if (counter && this.presentation) {
      counter.textContent = `${this.currentSlideIndex + 1} / ${this.presentation.slides.length}`;
    }
    
    // Update speaker notes
    const notesContainer = this.containerEl.querySelector('.speaker-notes-container');
    if (notesContainer) {
      notesContainer.empty();
      this.renderSpeakerNotes(notesContainer as HTMLElement);
    }
  }
  
  private registerKeyboardShortcuts() {
    this.registerDomEvent(document, 'keydown', (e: KeyboardEvent) => {
      if (!this.presentation) return;
      
      // Only handle if this view is focused
      if (!this.containerEl.contains(document.activeElement) && 
          document.activeElement !== document.body) return;
      
      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
        case ' ':
        case 'PageDown':
          e.preventDefault();
          this.nextSlide();
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
        case 'PageUp':
          e.preventDefault();
          this.previousSlide();
          break;
        case 'Home':
          e.preventDefault();
          this.goToSlide(0);
          break;
        case 'End':
          e.preventDefault();
          this.goToSlide(this.presentation.slides.length - 1);
          break;
        case 'f':
          if (e.metaKey || e.ctrlKey) {
            // Ctrl/Cmd+F: Start presentation
            e.preventDefault();
            this.startPresentation();
          }
          break;
        case 'Escape':
          // Presentation is in separate window, no action needed here
          break;
      }
    });
  }
  
  private async startPresentation() {
    const debug = getDebugService();
    debug.log('presentation-view', 'startPresentation called');
    
    let file = this.file;
    
    // If no file is loaded in this view, try to use the active file
    if (!file) {
      const activeFile = this.app.workspace.getActiveFile();
      if (activeFile && activeFile.extension === 'md') {
        file = activeFile;
      } else {
        new Notice('Please open a markdown file first');
        return;
      }
    }
    
    // Use the main plugin's startPresentationAtSlide for consistent behavior
    if (this.onStartPresentation) {
      debug.log('presentation-view', 'Using main plugin startPresentationAtSlide');
      this.onStartPresentation(file, this.currentSlideIndex);
    } else {
      debug.error('presentation-view', 'onStartPresentation callback not set');
      new Notice('Cannot start presentation - callback not configured');
    }
  }
  
  private async startPresenterView() {
    const debug = getDebugService();
    debug.log('presentation-view', 'startPresenterView called');
    
    let file = this.file;
    
    // If no file is loaded in this view, try to use the active file
    if (!file) {
      const activeFile = this.app.workspace.getActiveFile();
      if (activeFile && activeFile.extension === 'md') {
        file = activeFile;
      } else {
        new Notice('Please open a markdown file first');
        return;
      }
    }
    
    // Use the callback if available (preferred method)
    if (this.onStartPresenterView) {
      debug.log('presentation-view', 'Using callback for presenter view');
      await this.onStartPresenterView(file);
    } else {
      debug.error('presentation-view', 'onStartPresenterView callback not set');
      new Notice('Cannot open presenter view - callback not configured');
    }
  }
  private async openPresentationInBrowser(html: string, mode: 'presentation' | 'presenter') {
    const tempFileName = `.perspecta-${mode}-${Date.now()}.html`;
    const Notice = (require('obsidian') as typeof import('obsidian')).Notice;
    
    try {
      // Clean up any existing temp files with similar names
      const existingFile = this.app.vault.getAbstractFileByPath(tempFileName);
      if (existingFile) {
        await this.app.vault.delete(existingFile);
      }
      
      // Create the temp file
      await this.app.vault.create(tempFileName, html);
      
      // Get the file using the file system adapter
      const file = this.app.vault.getAbstractFileByPath(tempFileName);
      if (file) {
        // Try different methods to get the file path
        let fileUrl: string | null = null;
        
        // Method 1: Try getResourcePath first
        try {
          fileUrl = this.app.vault.getResourcePath(file as any);
        } catch (e) {
          const debug = getDebugService();
          debug.log('presentation-view', `getResourcePath failed: ${e}`);
        }
        
        // Method 2: Try constructing the URL manually
        if (!fileUrl) {
          const adapter = this.app.vault.adapter;
          if ('basePath' in adapter) {
            // For local vaults
            const basePath = (adapter as any).basePath;
            fileUrl = `app://local/${basePath}/${tempFileName}`;
          } else {
            // For remote vaults, use obsidian://
            fileUrl = `obsidian://show?file=${encodeURIComponent(tempFileName)}`;
          }
        }
        
        // Method 3: Fallback - create a data URL
        if (!fileUrl) {
          const blob = new Blob([html], { type: 'text/html' });
          fileUrl = URL.createObjectURL(blob);
          // Open in a new window
          const newWindow = window.open(fileUrl, '_blank');
          if (newWindow) {
            // Clean up the blob URL after opening
            setTimeout(() => URL.revokeObjectURL(fileUrl!), 60000);
          }
        } else {
          // Open in default browser
          window.open(fileUrl, '_blank');
        }
        
        this.isPresenting = true;
        
        // Clean up temp file after a delay (only if we created a file)
        setTimeout(async () => {
          try {
            const tempFile = this.app.vault.getAbstractFileByPath(tempFileName);
            if (tempFile) {
              await this.app.vault.delete(tempFile);
            }
          } catch (e) {
            // Ignore cleanup errors
          }
        }, 60000); // Keep for 1 minute
      } else {
        new Notice('Could not create temporary file');
      }
    } catch (e) {
    const debug = getDebugService();
    debug.error('presentation-view', `Presentation open error: ${e}`);
    new Notice('Could not open presentation: ' + (e as Error).message);
    }
  }
  
  private async exportHTML() {
    if (!this.presentation || !this.file) return;
    
    const theme = this.getThemeByName(this.presentation.frontmatter.theme || '');
    const renderer = this.createRenderer(theme);
    const html = renderer.renderHTML();
    
    // Save to file
    const exportPath = this.file.path.replace(/\.md$/, '.html');
    await this.app.vault.create(exportPath, html);
    
    // Notify user
    new (require('obsidian').Notice)(`Exported to ${exportPath}`);
  }
  
  private showOptionsMenu(e: MouseEvent) {
    const menu = new Menu();
    
    menu.addItem(item => {
      item.setTitle('Export as HTML');
      item.setIcon('file-output');
      item.onClick(() => this.exportHTML());
    });
    
    menu.addItem(item => {
      item.setTitle('Print / PDF');
      item.setIcon('printer');
      item.onClick(() => window.print());
    });
    
    menu.addSeparator();
    
    menu.addItem(item => {
      item.setTitle('Reload');
      item.setIcon('refresh-cw');
      item.onClick(() => {
        if (this.onReload) {
          this.onReload();
        } else if (this.file) {
          this.loadFile(this.file);
        }
      });
    });
    
    menu.showAtMouseEvent(e);
  }
  
  private applyThemeVariables(container: HTMLElement) {
    if (!this.theme) return;
    
    // Apply theme CSS variables to the container
    const root = container;
    
    // Apply color variables from the active preset
    const preset = this.theme.presets[0]; // Use first preset (usually light)
    if (preset) {
      root.style.setProperty('--light-background', preset.LightBackgroundColor);
      root.style.setProperty('--dark-background', preset.DarkBackgroundColor);
      root.style.setProperty('--light-body-text', preset.LightBodyTextColor);
      root.style.setProperty('--dark-body-text', preset.DarkBodyTextColor);
      root.style.setProperty('--light-title-text', preset.LightTitleTextColor);
      root.style.setProperty('--dark-title-text', preset.DarkTitleTextColor);
      // Semantic colors
      root.style.setProperty('--light-link-color', preset.LightLinkColor);
      root.style.setProperty('--light-bullet-color', preset.LightBulletColor);
      root.style.setProperty('--light-blockquote-border', preset.LightBlockquoteBorder);
      root.style.setProperty('--light-table-header-bg', preset.LightTableHeaderBg);
      root.style.setProperty('--light-code-border', preset.LightCodeBorder);
      root.style.setProperty('--light-progress-bar', preset.LightProgressBar);
      root.style.setProperty('--dark-link-color', preset.DarkLinkColor);
      root.style.setProperty('--dark-bullet-color', preset.DarkBulletColor);
      root.style.setProperty('--dark-blockquote-border', preset.DarkBlockquoteBorder);
      root.style.setProperty('--dark-table-header-bg', preset.DarkTableHeaderBg);
      root.style.setProperty('--dark-code-border', preset.DarkCodeBorder);
      root.style.setProperty('--dark-progress-bar', preset.DarkProgressBar);
    }
    
    // Apply font variables
    root.style.setProperty('--title-font', this.theme.template.TitleFont);
    root.style.setProperty('--body-font', this.theme.template.BodyFont);
  }
}
