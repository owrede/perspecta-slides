import { ItemView, WorkspaceLeaf, Menu, TFile } from 'obsidian';
import { Presentation, Slide, Theme, SlideElement } from '../types';
import { SlideParser } from '../parser/SlideParser';
import { SlideRenderer } from '../renderer/SlideRenderer';
import { getTheme } from '../themes';

export const PRESENTATION_VIEW_TYPE = 'perspecta-presentation';

export class PresentationView extends ItemView {
  private presentation: Presentation | null = null;
  private currentSlideIndex: number = 0;
  private isPresenting: boolean = false;
  private parser: SlideParser;
  private file: TFile | null = null;
  private theme: Theme | null = null;
  
  private onSlideChange: ((index: number) => void) | null = null;
  private onReload: (() => void) | null = null;
  
  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
    this.parser = new SlideParser();
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
    this.file = file;
    const content = await this.app.vault.read(file);
    this.presentation = this.parser.parse(content);
    this.currentSlideIndex = 0;
    this.render();
  }
  
  setPresentation(presentation: Presentation, theme?: Theme) {
    this.presentation = presentation;
    this.currentSlideIndex = 0;
    this.theme = theme || null;
    this.render();
  }
  
  setOnSlideChange(callback: (index: number) => void) {
    this.onSlideChange = callback;
  }
  
  setOnReload(callback: () => void) {
    this.onReload = callback;
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
    
    const slideEls = this.containerEl.querySelectorAll('.slide-wrapper .slide');
    const slideEl = slideEls[index] as HTMLElement | undefined;
    if (!slideEl) return false;
    
    // Update the slide in the presentation
    this.presentation.slides[index] = slide;
    
    // Clear and re-render just the content of this slide
    const contentEl = slideEl.querySelector('.slide-content') as HTMLElement;
    if (!contentEl) return false;
    
    contentEl.empty();
    this.renderSlideContent(contentEl, slide);
    
    // Update slide classes (mode, layout)
    const mode = slide.metadata.mode || 'light';
    const layout = slide.metadata.layout || 'default';
    
    // Remove old mode/layout classes
    slideEl.classList.remove('light', 'dark');
    slideEl.className = slideEl.className.replace(/layout-\S+/g, '').trim();
    
    // Add new classes
    slideEl.classList.add(mode, `layout-${layout}`);
    
    // Update speaker notes if this is the current slide
    if (index === this.currentSlideIndex) {
      const notesContainer = this.containerEl.querySelector('.speaker-notes-container');
      if (notesContainer) {
        notesContainer.empty();
        this.renderSpeakerNotes(notesContainer as HTMLElement);
      }
    }
    
    return true;
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
    presentBtn.addEventListener('click', () => this.startPresentation());
    
    // Presenter View button
    const presenterBtn = actions.createEl('button');
    presenterBtn.createSpan({ text: 'Presenter View' });
    presenterBtn.addEventListener('click', () => this.startPresenterView());
    
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
    
    const theme = getTheme(this.presentation.frontmatter.theme || 'zurich');
    const themeClasses = theme?.template.CssClasses || '';
    
    // Create slide wrapper with aspect ratio
    const aspectRatio = this.presentation.frontmatter.aspectRatio || '16:9';
    const wrapper = container.createDiv({ 
      cls: `slide-wrapper aspect-${aspectRatio.replace(':', '-')} ${themeClasses}` 
    });
    
    // Create renderer with theme
    const renderer = new SlideRenderer(this.presentation, theme);
    
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
    if (!this.presentation || !this.file) return;
    
    const theme = getTheme(this.presentation.frontmatter.theme || 'zurich');
    const renderer = new SlideRenderer(this.presentation, theme);
    const html = renderer.renderHTML();
    
    await this.openPresentationInBrowser(html, 'presentation');
  }
  
  private async startPresenterView() {
    if (!this.presentation || !this.file) return;
    
    const theme = getTheme(this.presentation.frontmatter.theme || 'zurich');
    const renderer = new SlideRenderer(this.presentation, theme);
    const html = renderer.renderPresenterHTML();
    
    await this.openPresentationInBrowser(html, 'presenter');
  }
  
  /**
   * Opens presentation HTML in the system browser via a temp file
   */
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
      
      // Get the full file path
      const adapter = this.app.vault.adapter as any;
      if (adapter.getFullPath) {
        const fullPath = adapter.getFullPath(tempFileName);
        
        // Use Electron's shell to open the file in default browser
        const { shell } = require('electron');
        await shell.openPath(fullPath);
        
        this.isPresenting = true;
        
        // Clean up temp file after a delay
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
        new Notice('Could not determine file path');
      }
    } catch (e) {
      new Notice('Could not open presentation: ' + (e as Error).message);
    }
  }
  
  private async exportHTML() {
    if (!this.presentation || !this.file) return;
    
    const theme = getTheme(this.presentation.frontmatter.theme || 'zurich');
    const renderer = new SlideRenderer(this.presentation, theme);
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
      root.style.setProperty('--accent1', preset.Accent1);
      root.style.setProperty('--accent2', preset.Accent2);
      root.style.setProperty('--accent3', preset.Accent3);
      root.style.setProperty('--accent4', preset.Accent4);
      root.style.setProperty('--accent5', preset.Accent5);
      root.style.setProperty('--accent6', preset.Accent6);
    }
    
    // Apply font variables
    root.style.setProperty('--title-font', this.theme.template.TitleFont);
    root.style.setProperty('--body-font', this.theme.template.BodyFont);
  }
}
