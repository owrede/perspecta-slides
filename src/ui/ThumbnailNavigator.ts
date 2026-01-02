import { ItemView, WorkspaceLeaf, TFile } from 'obsidian';
import { Presentation, Slide, Theme } from '../types';
import { SlideRenderer } from '../renderer/SlideRenderer';

export const THUMBNAIL_VIEW_TYPE = 'perspecta-thumbnail-navigator';

export class ThumbnailNavigatorView extends ItemView {
  private presentation: Presentation | null = null;
  private theme: Theme | null = null;
  private selectedSlideIndex: number = 0;
  private onSlideSelect: ((index: number) => void) | null = null;
  private onSlideReorder: ((fromIndex: number, toIndex: number) => void) | null = null;
  private draggedIndex: number = -1;
  private currentFile: TFile | null = null;
  
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
  
  setPresentation(presentation: Presentation, file?: TFile, theme?: Theme) {
    this.presentation = presentation;
    if (file) {
      this.currentFile = file;
    }
    if (theme) {
      this.theme = theme;
    }
    this.selectedSlideIndex = Math.min(this.selectedSlideIndex, presentation.slides.length - 1);
    if (this.selectedSlideIndex < 0) this.selectedSlideIndex = 0;
    this.render();
  }
  
  setCurrentFile(file: TFile) {
    this.currentFile = file;
  }
  
  setTheme(theme: Theme) {
    this.theme = theme;
  }
  
  setOnSlideSelect(callback: (index: number) => void) {
    this.onSlideSelect = callback;
  }
  
  setOnSlideReorder(callback: (fromIndex: number, toIndex: number) => void) {
    this.onSlideReorder = callback;
  }
  
  selectSlide(index: number) {
    this.selectedSlideIndex = index;
    this.updateSelection();
  }
  
  getSlideCount(): number {
    return this.presentation?.slides.length || 0;
  }
  
  /**
   * Update a single slide's thumbnail without re-rendering the entire list.
   * Returns true if the update was successful, false if a full re-render is needed.
   */
  updateSlide(index: number, slide: Slide): boolean {
    if (!this.presentation) return false;
    
    const items = this.containerEl.querySelectorAll('.thumbnail-item');
    const item = items[index] as HTMLElement | undefined;
    if (!item) return false;
    
    // Update the slide in the presentation
    this.presentation.slides[index] = slide;
    
    // Find and update the iframe
    const iframe = item.querySelector('.thumbnail-iframe') as HTMLIFrameElement;
    if (!iframe) return false;
    
    // Create renderer and update the iframe content
    const renderer = this.theme 
      ? new SlideRenderer(this.presentation, this.theme)
      : new SlideRenderer(this.presentation);
    
    iframe.srcdoc = renderer.renderThumbnailHTML(slide, index);
    
    // Update the layout class on the item if needed
    const layoutClass = `layout-${slide.metadata.layout || 'default'}`;
    item.className = item.className.replace(/layout-\S+/g, '').trim();
    item.classList.add(layoutClass);
    
    return true;
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
      text: `${this.presentation.slides.length}` 
    });
    
    // Thumbnail list
    const list = container.createDiv({ cls: 'thumbnail-list' });
    
    // Create renderer for thumbnails
    const renderer = this.theme 
      ? new SlideRenderer(this.presentation, this.theme)
      : new SlideRenderer(this.presentation);
    
    this.presentation.slides.forEach((slide, index) => {
      const item = this.createThumbnailItem(slide, index, renderer);
      list.appendChild(item);
    });
  }
  
  private renderEmptyState(container: HTMLElement) {
    const empty = container.createDiv({ cls: 'empty-state' });
    empty.createEl('div', { cls: 'empty-icon', text: '📊' });
    empty.createEl('p', { text: 'Open a presentation file to see slides' });
    empty.createEl('small', { text: 'Use --- to separate slides in your markdown' });
  }
  
  private getAspectRatioValue(): string {
    if (!this.presentation) return '16 / 9';
    const ratio = this.presentation.frontmatter.aspectRatio || '16:9';
    switch (ratio) {
      case '4:3': return '4 / 3';
      case '16:10': return '16 / 10';
      case '16:9':
      default: return '16 / 9';
    }
  }

  private createThumbnailItem(slide: Slide, index: number, renderer: SlideRenderer): HTMLElement {
    const item = document.createElement('div');
    item.className = `thumbnail-item ${index === this.selectedSlideIndex ? 'selected' : ''}`;
    item.dataset.index = String(index);
    item.draggable = true;
    
    // Slide number badge (SVG circle with number - also serves as drag handle)
    const numberBadge = document.createElement('div');
    numberBadge.className = 'slide-number-badge';
    const num = index + 1;
    numberBadge.innerHTML = `<svg viewBox="0 0 28 28" width="28" height="28">
      <circle cx="14" cy="14" r="12" class="badge-circle"/>
      <text x="14" y="14" text-anchor="middle" dominant-baseline="central" class="badge-text">${num}</text>
    </svg>`;
    item.appendChild(numberBadge);
    
    // Thumbnail preview - using iframe with actual rendered slide
    const previewContainer = document.createElement('div');
    previewContainer.className = 'thumbnail-preview';
    previewContainer.style.aspectRatio = this.getAspectRatioValue();
    
    const iframe = document.createElement('iframe');
    iframe.className = 'thumbnail-iframe';
    iframe.setAttribute('scrolling', 'no');
    iframe.setAttribute('loading', 'lazy');
    iframe.srcdoc = renderer.renderThumbnailHTML(slide, index);
    
    previewContainer.appendChild(iframe);
    item.appendChild(previewContainer);
    
    // Click handler
    item.addEventListener('click', () => {
      this.selectedSlideIndex = index;
      this.updateSelection();
      if (this.onSlideSelect) {
        this.onSlideSelect(index);
      }
    });
    
    // Drag and drop handlers
    item.addEventListener('dragstart', (e) => {
      this.draggedIndex = index;
      item.classList.add('dragging');
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(index));
      }
    });
    
    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
      this.draggedIndex = -1;
      // Remove all drop indicators
      this.containerEl.querySelectorAll('.drop-before, .drop-after').forEach(el => {
        el.classList.remove('drop-before', 'drop-after');
      });
    });
    
    item.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (this.draggedIndex === -1 || this.draggedIndex === index) return;
      
      const rect = item.getBoundingClientRect();
      const midpoint = rect.top + rect.height / 2;
      
      // Remove existing indicators
      item.classList.remove('drop-before', 'drop-after');
      
      if (e.clientY < midpoint) {
        item.classList.add('drop-before');
      } else {
        item.classList.add('drop-after');
      }
    });
    
    item.addEventListener('dragleave', () => {
      item.classList.remove('drop-before', 'drop-after');
    });
    
    item.addEventListener('drop', (e) => {
      e.preventDefault();
      item.classList.remove('drop-before', 'drop-after');
      
      if (this.draggedIndex === -1 || this.draggedIndex === index) return;
      
      const rect = item.getBoundingClientRect();
      const midpoint = rect.top + rect.height / 2;
      let toIndex = e.clientY < midpoint ? index : index + 1;
      
      // Adjust toIndex if dragging from before to after
      if (this.draggedIndex < toIndex) {
        toIndex--;
      }
      
      if (this.draggedIndex !== toIndex && this.onSlideReorder) {
        this.onSlideReorder(this.draggedIndex, toIndex);
      }
      
      this.draggedIndex = -1;
    });
    
    return item;
  }
  
  private updateSelection() {
    const items = this.containerEl.querySelectorAll('.thumbnail-item');
    items.forEach((item, index) => {
      const isSelected = index === this.selectedSlideIndex;
      item.classList.toggle('selected', isSelected);
      
      // Scroll selected item into view
      if (isSelected) {
        item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });
  }
}
