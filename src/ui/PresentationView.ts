import { ItemView, WorkspaceLeaf, Menu, TFile } from 'obsidian';
import { Presentation, Slide } from '../types';
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
  
  private onSlideChange: ((index: number) => void) | null = null;
  
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
  
  setPresentation(presentation: Presentation) {
    this.presentation = presentation;
    this.currentSlideIndex = 0;
    this.render();
  }
  
  setOnSlideChange(callback: (index: number) => void) {
    this.onSlideChange = callback;
  }
  
  goToSlide(index: number) {
    if (!this.presentation) return;
    
    if (index < 0) index = 0;
    if (index >= this.presentation.slides.length) {
      index = this.presentation.slides.length - 1;
    }
    
    this.currentSlideIndex = index;
    this.updateSlideDisplay();
    
    if (this.onSlideChange) {
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
    
    // Export button
    const exportBtn = actions.createEl('button');
    exportBtn.createSpan({ text: 'Export HTML' });
    exportBtn.addEventListener('click', () => this.exportHTML());
    
    // More options
    const moreBtn = actions.createEl('button');
    moreBtn.createSpan({ text: '⋯' });
    moreBtn.addEventListener('click', (e) => this.showOptionsMenu(e));
  }
  
  private renderSlides(container: HTMLElement) {
    if (!this.presentation) return;
    
    const theme = getTheme(this.presentation.frontmatter.theme || 'zurich');
    const renderer = new SlideRenderer(this.presentation, theme);
    
    // Create slide wrapper with aspect ratio
    const aspectRatio = this.presentation.frontmatter.aspectRatio || '16:9';
    const wrapper = container.createDiv({ 
      cls: `slide-wrapper aspect-${aspectRatio.replace(':', '-')}` 
    });
    
    // Render all slides
    this.presentation.slides.forEach((slide, index) => {
      const slideEl = wrapper.createDiv({
        cls: `slide ${slide.metadata.mode || 'light'} layout-${slide.metadata.layout || 'default'} ${index === this.currentSlideIndex ? 'active' : ''}`
      });
      slideEl.dataset.index = String(index);
      
      // Background
      if (slide.metadata.background) {
        slideEl.style.backgroundImage = `url('${slide.metadata.background}')`;
        slideEl.style.backgroundSize = 'cover';
        slideEl.style.backgroundPosition = 'center';
        
        if (slide.metadata.backgroundOpacity !== undefined) {
          const overlay = slideEl.createDiv({ cls: 'background-overlay' });
          overlay.style.backgroundColor = `rgba(255,255,255,${1 - slide.metadata.backgroundOpacity})`;
        }
      }
      
      // Header
      this.renderSlideHeader(slideEl, index);
      
      // Content
      const content = slideEl.createDiv({ cls: 'slide-content' });
      this.renderSlideContent(content, slide);
      
      // Footer
      this.renderSlideFooter(slideEl, index);
    });
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
    
    if (layout === 'v-split') {
      const textContent = container.createDiv({ cls: 'text-content' });
      const mediaContent = container.createDiv({ cls: 'media-content' });
      
      elements.forEach(el => {
        if (el.type === 'image') {
          this.renderElement(mediaContent, el);
        } else {
          this.renderElement(textContent, el);
        }
      });
    } else if (layout === 'caption') {
      const mediaContent = container.createDiv({ cls: 'media-content' });
      const textContent = container.createDiv({ cls: 'text-content' });
      
      elements.forEach(el => {
        if (el.type === 'image') {
          this.renderElement(mediaContent, el);
        } else {
          this.renderElement(textContent, el);
        }
      });
    } else {
      elements.forEach(el => this.renderElement(container, el));
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
    const slides = this.containerEl.querySelectorAll('.slide');
    slides.forEach((slide, index) => {
      slide.classList.toggle('active', index === this.currentSlideIndex);
    });
    
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
          if (this.isPresenting) {
            this.stopPresentation();
          }
          break;
      }
    });
  }
  
  private startPresentation() {
    if (!this.presentation) return;
    
    const theme = getTheme(this.presentation.frontmatter.theme || 'zurich');
    const renderer = new SlideRenderer(this.presentation, theme);
    const html = renderer.renderHTML();
    
    // Open in new window
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
      this.isPresenting = true;
    }
  }
  
  private stopPresentation() {
    this.isPresenting = false;
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
        if (this.file) this.loadFile(this.file);
      });
    });
    
    menu.showAtMouseEvent(e);
  }
}
