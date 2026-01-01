import { ItemView, WorkspaceLeaf } from 'obsidian';
import { Presentation, Slide } from '../types';
import { SlideRenderer } from '../renderer/SlideRenderer';

export const THUMBNAIL_VIEW_TYPE = 'perspecta-thumbnail-navigator';

export class ThumbnailNavigatorView extends ItemView {
  private presentation: Presentation | null = null;
  private selectedSlideIndex: number = 0;
  private onSlideSelect: ((index: number) => void) | null = null;
  
  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }
  
  getViewType(): string {
    return THUMBNAIL_VIEW_TYPE;
  }
  
  getDisplayText(): string {
    return 'Slide Navigator';
  }
  
  getIcon(): string {
    return 'layout-grid';
  }
  
  async onOpen() {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass('perspecta-thumbnail-navigator');
    
    this.renderEmptyState(container as HTMLElement);
  }
  
  async onClose() {
    // Cleanup
  }
  
  setPresentation(presentation: Presentation) {
    this.presentation = presentation;
    this.selectedSlideIndex = 0;
    this.render();
  }
  
  setOnSlideSelect(callback: (index: number) => void) {
    this.onSlideSelect = callback;
  }
  
  selectSlide(index: number) {
    this.selectedSlideIndex = index;
    this.updateSelection();
  }
  
  private render() {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    
    if (!this.presentation || this.presentation.slides.length === 0) {
      this.renderEmptyState(container);
      return;
    }
    
    // Header
    const header = container.createDiv({ cls: 'navigator-header' });
    header.createEl('h4', { text: 'Slides' });
    header.createEl('span', { 
      cls: 'slide-count',
      text: `${this.presentation.slides.length} slides` 
    });
    
    // Thumbnail list
    const list = container.createDiv({ cls: 'thumbnail-list' });
    
    this.presentation.slides.forEach((slide, index) => {
      const item = this.createThumbnailItem(slide, index);
      list.appendChild(item);
    });
  }
  
  private renderEmptyState(container: HTMLElement) {
    const empty = container.createDiv({ cls: 'empty-state' });
    empty.createEl('div', { cls: 'empty-icon', text: '📊' });
    empty.createEl('p', { text: 'Open a presentation file to see slides' });
    empty.createEl('small', { text: 'Use --- to separate slides in your markdown' });
  }
  
  private createThumbnailItem(slide: Slide, index: number): HTMLElement {
    const item = document.createElement('div');
    item.className = `thumbnail-item ${index === this.selectedSlideIndex ? 'selected' : ''}`;
    item.dataset.index = String(index);
    
    // Slide number
    const number = document.createElement('span');
    number.className = 'slide-number';
    number.textContent = String(index + 1);
    item.appendChild(number);
    
    // Thumbnail preview
    const preview = document.createElement('div');
    preview.className = 'thumbnail-preview';
    preview.innerHTML = this.generateThumbnailContent(slide);
    item.appendChild(preview);
    
    // Slide info
    const info = document.createElement('div');
    info.className = 'slide-info';
    
    const title = this.getSlideTitle(slide);
    if (title) {
      const titleEl = document.createElement('span');
      titleEl.className = 'slide-title';
      titleEl.textContent = title;
      info.appendChild(titleEl);
    }
    
    const layout = document.createElement('span');
    layout.className = 'slide-layout';
    layout.textContent = slide.metadata.layout || 'default';
    info.appendChild(layout);
    
    item.appendChild(info);
    
    // Click handler
    item.addEventListener('click', () => {
      this.selectedSlideIndex = index;
      this.updateSelection();
      if (this.onSlideSelect) {
        this.onSlideSelect(index);
      }
    });
    
    return item;
  }
  
  private generateThumbnailContent(slide: Slide): string {
    const elements = slide.elements.filter(e => e.visible);
    
    if (elements.length === 0) {
      return '<div class="thumbnail-empty">Empty slide</div>';
    }
    
    const preview: string[] = [];
    
    for (const element of elements.slice(0, 3)) {
      switch (element.type) {
        case 'heading':
          preview.push(`<div class="th-heading th-h${element.level}">${this.truncate(element.content, 30)}</div>`);
          break;
        case 'paragraph':
          preview.push(`<div class="th-text">${this.truncate(element.content, 40)}</div>`);
          break;
        case 'image':
          preview.push(`<div class="th-image">🖼️</div>`);
          break;
        case 'list':
          preview.push(`<div class="th-list">• List</div>`);
          break;
        case 'code':
          preview.push(`<div class="th-code">&lt;/&gt;</div>`);
          break;
        default:
          preview.push(`<div class="th-text">${this.truncate(element.content, 30)}</div>`);
      }
    }
    
    return preview.join('');
  }
  
  private getSlideTitle(slide: Slide): string | null {
    const heading = slide.elements.find(e => e.type === 'heading');
    if (heading) {
      return this.truncate(heading.content, 25);
    }
    return null;
  }
  
  private truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 1) + '…';
  }
  
  private updateSelection() {
    const items = this.containerEl.querySelectorAll('.thumbnail-item');
    items.forEach((item, index) => {
      item.classList.toggle('selected', index === this.selectedSlideIndex);
    });
  }
}
