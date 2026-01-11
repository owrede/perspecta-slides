import type { WorkspaceLeaf, TFile } from 'obsidian';
import { ItemView } from 'obsidian';
import type { Presentation, Slide, Theme } from '../types';
import type { ImagePathResolver } from '../renderer/SlideRenderer';
import { SlideRenderer } from '../renderer/SlideRenderer';
import type { ExcalidrawCacheEntry } from '../utils/ExcalidrawRenderer';

export const THUMBNAIL_VIEW_TYPE = 'perspecta-thumbnail-navigator';

export class ThumbnailNavigatorView extends ItemView {
  private presentation: Presentation | null = null;
  private theme: Theme | null = null;
  private selectedSlideIndex: number = 0;
  private onSlideSelect: ((index: number) => void) | null = null;
  private onSlideReorder: ((fromIndex: number, toIndex: number) => void) | null = null;
  private onStartPresentation: ((index: number) => void) | null = null;
  private onAddSlide: (() => void) | null = null;
  private onSlideHiddenChanged: ((index: number, hidden: boolean) => void) | null = null;
  private draggedIndex: number = -1;
  private currentFile: TFile | null = null;
  private imagePathResolver: ImagePathResolver | null = null;
  private customFontCSS: string = '';
  private fontWeightsCache: Map<string, number[]> = new Map();
  private excalidrawSvgCache: Map<string, ExcalidrawCacheEntry> | null = null;
  private failedDecompressionFiles: Set<string> = new Set();

  public getPresentation(): Presentation | null {
    return this.presentation;
  }

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }

  /**
   * Set the image path resolver for resolving wiki-link images
   */
  setImagePathResolver(resolver: ImagePathResolver): void {
    this.imagePathResolver = resolver;
  }

  /**
   * Set custom font CSS for cached Google Fonts
   */
  setCustomFontCSS(css: string): void {
    this.customFontCSS = css;
  }

  /**
   * Set the font weights cache for validating font weights
   */
  setFontWeightsCache(cache: Map<string, number[]>): void {
    this.fontWeightsCache = cache;
  }

  /**
   * Set the Excalidraw SVG cache (for native Excalidraw rendering)
   */
  setExcalidrawSvgCache(cache: Map<string, ExcalidrawCacheEntry>): void {
    this.excalidrawSvgCache = cache;
  }

  /**
   * Set failed decompression files (files that need manual decompression)
   */
  setFailedDecompressionFiles(files: Set<string>): void {
    this.failedDecompressionFiles = files;
  }

  /**
   * Create a SlideRenderer with the image path resolver
   */
  private createRenderer(): SlideRenderer {
    const renderer = this.theme
      ? new SlideRenderer(this.presentation!, this.theme, this.imagePathResolver || undefined)
      : new SlideRenderer(this.presentation!, undefined, this.imagePathResolver || undefined);
    if (this.customFontCSS) {
      renderer.setCustomFontCSS(this.customFontCSS);
    }
    // Set font weights cache for validation
    renderer.setFontWeightsCache(this.fontWeightsCache);
    // Set Excalidraw SVG cache for native rendering
    if (this.excalidrawSvgCache) {
      renderer.setExcalidrawSvgCache(this.excalidrawSvgCache);
    }
    // Set failed decompression files
    if (this.failedDecompressionFiles.size > 0) {
      renderer.setFailedDecompressionFiles(this.failedDecompressionFiles);
    }
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
    if (this.selectedSlideIndex < 0) {
      this.selectedSlideIndex = 0;
    }
    this.render();
  }

  /**
   * Update the presentation reference without triggering a full re-render
   * Used for incremental updates where we manually add/remove slides
   */
  updatePresentationRef(presentation: Presentation, file?: TFile, theme?: Theme) {
    this.presentation = presentation;
    if (file) {
      this.currentFile = file;
    }
    if (theme) {
      this.theme = theme;
    }
    this.selectedSlideIndex = Math.min(this.selectedSlideIndex, presentation.slides.length - 1);
    if (this.selectedSlideIndex < 0) {
      this.selectedSlideIndex = 0;
    }
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

  setOnStartPresentation(callback: (index: number) => void) {
    this.onStartPresentation = callback;
  }

  setOnAddSlide(callback: () => void) {
    this.onAddSlide = callback;
  }

  setOnSlideHiddenChanged(callback: (index: number, hidden: boolean) => void) {
    this.onSlideHiddenChanged = callback;
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
    if (!this.presentation) {
      return false;
    }

    const items = this.containerEl.querySelectorAll('.thumbnail-item');
    const item = items[index] as HTMLElement | undefined;
    if (!item) {
      return false;
    }

    // Update the slide in the presentation
    this.presentation.slides[index] = slide;

    // Find and update the iframe
    const iframe = item.querySelector('.thumbnail-iframe') as HTMLIFrameElement;
    if (!iframe) {
      return false;
    }

    // Create renderer and update the iframe content
    const renderer = this.createRenderer();

    iframe.srcdoc = renderer.renderThumbnailHTML(slide, index);

    // Update the layout class on the item if needed
    const layoutClass = `layout-${slide.metadata.layout || 'default'}`;
    item.className = item.className.replace(/layout-\S+/g, '').trim();
    item.classList.add(layoutClass);

    // Update the hidden state class
    item.classList.toggle('hidden-slide', slide.hidden || false);

    // Update the visibility toggle button
    const visibilityToggle = item.querySelector('.slide-visibility-toggle');
    if (visibilityToggle) {
      visibilityToggle.classList.toggle('hidden', slide.hidden || false);
      visibilityToggle.setAttribute('aria-label', slide.hidden ? 'Show slide' : 'Hide slide');
      visibilityToggle.innerHTML = slide.hidden
        ? `<svg class="icon-permanent" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`
        : `<svg class="icon-permanent" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>`;
    }

    // Update the slide number badge
    const numberBadge = item.querySelector('.badge-text');
    if (numberBadge && this.presentation) {
      let visibleNumber = '-';
      if (!slide.hidden) {
        visibleNumber = String(
          this.presentation.slides.slice(0, index + 1).filter((s) => !s.hidden).length
        );
      }
      numberBadge.textContent = visibleNumber;
    }

    return true;
  }

  /**
   * Update multiple slides by their indices (for incremental updates)
   */
  updateSlides(indices: number[], slides: Slide[]): boolean {
    if (!this.presentation) {
      return false;
    }

    const renderer = this.createRenderer();

    const items = this.containerEl.querySelectorAll('.thumbnail-item');

    for (let i = 0; i < indices.length; i++) {
      const index = indices[i];
      const slide = slides[i];
      const item = items[index] as HTMLElement | undefined;

      if (!item) {
        return false;
      }

      // Update the slide in the presentation
      this.presentation.slides[index] = slide;

      // Find and update the iframe
      const iframe = item.querySelector('.thumbnail-iframe') as HTMLIFrameElement;
      if (!iframe) {
        return false;
      }

      iframe.srcdoc = renderer.renderThumbnailHTML(slide, index);

      // Update the layout class
      const layoutClass = `layout-${slide.metadata.layout || 'default'}`;
      item.className = item.className.replace(/layout-\S+/g, '').trim();
      item.classList.add(layoutClass);

      // Update the hidden state class
      item.classList.toggle('hidden-slide', slide.hidden || false);

      // Update the visibility toggle button
      const visibilityToggle = item.querySelector('.slide-visibility-toggle');
      if (visibilityToggle) {
        visibilityToggle.classList.toggle('hidden', slide.hidden || false);
        visibilityToggle.setAttribute('aria-label', slide.hidden ? 'Show slide' : 'Hide slide');
        visibilityToggle.innerHTML = slide.hidden
          ? `<svg class="icon-permanent" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`
          : `<svg class="icon-permanent" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>`;
      }

      // Update the slide number badge
      const numberBadge = item.querySelector('.badge-text');
      if (numberBadge && this.presentation) {
        let visibleNumber = '-';
        if (!slide.hidden) {
          visibleNumber = String(
            this.presentation.slides.slice(0, index + 1).filter((s) => !s.hidden).length
          );
        }
        numberBadge.textContent = visibleNumber;
      }
    }

    return true;
  }

  /**
   * Remove a slide at the given index
   */
  removeSlideAt(index: number): boolean {
    if (!this.presentation) {
      return false;
    }

    const list = this.containerEl.querySelector('.thumbnail-list');
    if (!list) {
      return false;
    }

    const items = list.querySelectorAll('.thumbnail-item');
    const item = items[index] as HTMLElement | undefined;
    if (!item) {
      return false;
    }

    // Remove from DOM
    item.remove();

    // Update slide count in header
    this.updateSlideCountHeader();

    return true;
  }

  /**
   * Insert a new slide at the given index
   */
  insertSlideAt(index: number, slide: Slide): boolean {
    if (!this.presentation) {
      return false;
    }

    const list = this.containerEl.querySelector('.thumbnail-list');
    if (!list) {
      return false;
    }

    const renderer = this.createRenderer();

    const newItem = this.createThumbnailItem(slide, index, renderer);

    const items = list.querySelectorAll('.thumbnail-item');
    if (index >= items.length) {
      // Append at end
      list.appendChild(newItem);
    } else {
      // Insert before existing item
      list.insertBefore(newItem, items[index]);
    }

    // Update slide count in header
    this.updateSlideCountHeader();

    return true;
  }

  /**
   * Renumber all slide badges without re-rendering iframes
   */
  renumberSlides(): void {
    const list = this.containerEl.querySelector('.thumbnail-list');
    if (!list) {
      return;
    }

    const items = list.querySelectorAll('.thumbnail-item');
    items.forEach((item, index) => {
      // Update data-index attribute
      (item as HTMLElement).dataset.index = String(index);

      // Update the badge text
      const badgeText = item.querySelector('.badge-text');
      if (badgeText) {
        badgeText.textContent = String(index + 1);
      }
    });
  }

  /**
   * Update the slide count in the header
   */
  private updateSlideCountHeader(): void {
    const countEl = this.containerEl.querySelector('.slide-count');
    if (countEl && this.presentation) {
      countEl.textContent = String(this.presentation.slides.length);
    }
  }

  /**
   * Get the thumbnail list container
   */
  getListContainer(): HTMLElement | null {
    return this.containerEl.querySelector('.thumbnail-list');
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
      text: `${this.presentation.slides.length}`,
    });

    // Thumbnail list
    const list = container.createDiv({ cls: 'thumbnail-list' });

    // Create renderer for thumbnails
    const renderer = this.createRenderer();

    this.presentation.slides.forEach((slide, index) => {
      const item = this.createThumbnailItem(slide, index, renderer);
      list.appendChild(item);
    });

    // Add slide button
    const addSlideItem = this.createAddSlideItem();
    list.appendChild(addSlideItem);
  }

  private renderEmptyState(container: HTMLElement) {
    const empty = container.createDiv({ cls: 'empty-state' });
    empty.createEl('div', { cls: 'empty-icon', text: '📊' });
    empty.createEl('p', { text: 'Open a presentation file to see slides' });
    empty.createEl('small', { text: 'Use --- to separate slides in your markdown' });
  }

  private getAspectRatioValue(): string {
    if (!this.presentation) {
      return '16 / 9';
    }
    const ratio = this.presentation.frontmatter.aspectRatio || '16:9';
    switch (ratio) {
      case '4:3':
        return '4 / 3';
      case '16:10':
        return '16 / 10';
      case '16:9':
      default:
        return '16 / 9';
    }
  }

  private createThumbnailItem(slide: Slide, index: number, renderer: SlideRenderer): HTMLElement {
    const item = document.createElement('div');
    item.className = `thumbnail-item ${index === this.selectedSlideIndex ? 'selected' : ''} ${slide.hidden ? 'hidden-slide' : ''}`;
    item.dataset.index = String(index);
    item.draggable = true;

    // Slide number badge (SVG circle with number - also serves as drag handle)
    const numberBadge = document.createElement('div');
    numberBadge.className = 'slide-number-badge';

    // Calculate visible slide number (count only non-hidden slides up to this one)
    let visibleNumber = '-';
    if (!slide.hidden && this.presentation) {
      visibleNumber = String(
        this.presentation.slides.slice(0, index + 1).filter((s) => !s.hidden).length
      );
    }
    const num = visibleNumber;

    const svg = numberBadge.createSvg('svg', {
      attr: { viewBox: '0 0 28 28', width: '28', height: '28' },
    });
    svg.createSvg('circle', {
      attr: { cx: '14', cy: '14', r: '12' },
      cls: 'badge-circle',
    });
    const textEl = svg.createSvg('text', {
      attr: { x: '14', y: '14', 'text-anchor': 'middle', 'dominant-baseline': 'central' },
      cls: 'badge-text',
    });
    textEl.textContent = String(num);

    // Wrapper for badge and toggle (stacked vertically)
    const badgeWrapper = document.createElement('div');
    badgeWrapper.className = 'badge-toggle-wrapper';
    badgeWrapper.appendChild(numberBadge);

    // Visibility toggle button
    const visibilityToggle = document.createElement('button');
    visibilityToggle.className = `slide-visibility-toggle ${slide.hidden ? 'hidden' : ''}`;
    visibilityToggle.setAttribute('type', 'button');
    visibilityToggle.setAttribute('aria-label', slide.hidden ? 'Show slide' : 'Hide slide');

    // For hidden slides, show eye-closed icon permanently; on hover show toggle icons
    visibilityToggle.innerHTML = slide.hidden
      ? `<svg class="icon-permanent" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`
      : `<svg class="icon-permanent" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>`;

    visibilityToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const newHiddenState = !slide.hidden;
      // Emit event to save changes to file - this will trigger updateSidebars
      // which will handle all UI updates (no need to render here)
      if (this.onSlideHiddenChanged) {
        this.onSlideHiddenChanged(index, newHiddenState);
      }
    });

    badgeWrapper.appendChild(visibilityToggle);
    item.appendChild(badgeWrapper);

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

    // Click handler - read index from DOM to handle renumbering after inserts/removes
    item.addEventListener('click', () => {
      const currentIndex = parseInt(item.dataset.index || '0', 10);
      this.selectedSlideIndex = currentIndex;
      this.updateSelection();
      if (this.onSlideSelect) {
        this.onSlideSelect(currentIndex);
      }
    });

    // Double-click to start presentation at this slide
    item.addEventListener('dblclick', () => {
      const currentIndex = parseInt(item.dataset.index || '0', 10);
      if (this.onStartPresentation) {
        this.onStartPresentation(currentIndex);
      }
    });

    // Drag and drop handlers - read index from DOM to handle renumbering
    item.addEventListener('dragstart', (e) => {
      const currentIndex = parseInt(item.dataset.index || '0', 10);
      this.draggedIndex = currentIndex;
      item.classList.add('dragging');
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(currentIndex));
      }
    });

    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
      this.draggedIndex = -1;
      // Remove all drop indicators
      this.containerEl.querySelectorAll('.drop-before, .drop-after').forEach((el) => {
        el.classList.remove('drop-before', 'drop-after');
      });
    });

    item.addEventListener('dragover', (e) => {
      e.preventDefault();
      const currentIndex = parseInt(item.dataset.index || '0', 10);
      if (this.draggedIndex === -1 || this.draggedIndex === currentIndex) {
        return;
      }

      const rect = item.getBoundingClientRect();
      const midpoint = rect.top + rect.height / 2;

      // Remove existing indicators
      item.classList.remove('drop-before', 'drop-after');

      if (e.clientY < midpoint) {
        item.classList.add('drop-before');
      } else {
        item.classList.add('drop-after');
      }

      // Auto-scroll the thumbnail list when dragging near edges
      const list = this.containerEl.querySelector('.thumbnail-list') as HTMLElement;
      if (list) {
        const scrollThreshold = 80; // pixels from edge to trigger scroll
        const scrollSpeed = 5; // pixels to scroll
        const listRect = list.getBoundingClientRect();

        // Scroll down if dragging near the top
        if (e.clientY < listRect.top + scrollThreshold) {
          list.scrollTop = Math.max(0, list.scrollTop - scrollSpeed);
        }
        // Scroll up if dragging near the bottom
        else if (e.clientY > listRect.bottom - scrollThreshold) {
          list.scrollTop = Math.min(
            list.scrollHeight - list.clientHeight,
            list.scrollTop + scrollSpeed
          );
        }
      }
    });

    item.addEventListener('dragleave', () => {
      item.classList.remove('drop-before', 'drop-after');
    });

    item.addEventListener('drop', (e) => {
      e.preventDefault();
      item.classList.remove('drop-before', 'drop-after');

      const currentIndex = parseInt(item.dataset.index || '0', 10);
      if (this.draggedIndex === -1 || this.draggedIndex === currentIndex) {
        return;
      }

      const rect = item.getBoundingClientRect();
      const midpoint = rect.top + rect.height / 2;
      let toIndex = e.clientY < midpoint ? currentIndex : currentIndex + 1;

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

  private createAddSlideItem(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'add-slide-item-container';

    const item = document.createElement('div');
    item.className = 'add-slide-item';

    // Invisible placeholder for badge spacing (to match thumbnail layout)
    const badgePlaceholder = document.createElement('div');
    badgePlaceholder.className = 'badge-placeholder';
    item.appendChild(badgePlaceholder);

    // Preview container (same size as thumbnail preview) with centered + sign
    const previewContainer = document.createElement('div');
    previewContainer.className = 'add-slide-preview';
    previewContainer.textContent = '+';
    item.appendChild(previewContainer);

    container.appendChild(item);

    // Click handler
    item.addEventListener('click', () => {
      if (this.onAddSlide) {
        this.onAddSlide();
      }
    });

    return container;
  }

  private updateSelection() {
    const list = this.containerEl.querySelector('.thumbnail-list');
    if (!list) {
      return;
    }

    const items = list.querySelectorAll('.thumbnail-item');
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
