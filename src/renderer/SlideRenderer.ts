import { Presentation, Slide, SlideElement, PresentationFrontmatter, Theme, SlideLayout, ImageData } from '../types';
import { generateThemeCSS } from '../themes';

/**
 * SlideRenderer-Renders presentations to HTML
 * 
 * Uses iA Presenter-compatible container/layout class pattern:
 *-Container class (e.g., .cover-container, .section-container) on outer element
 *-Layout class (e.g., .layout-cover, .layout-section) on content
 *-Light/dark appearance classes
 */
/**
 * Function to resolve wiki-link paths to actual resource URLs
 */
export type ImagePathResolver = (path: string, isWikiLink: boolean) => string;

export class SlideRenderer {
  private presentation: Presentation;
  private theme: Theme | null = null;
  private resolveImagePath: ImagePathResolver | null = null;
  private customFontCSS: string = '';

  constructor(presentation: Presentation, theme?: Theme, resolveImagePath?: ImagePathResolver) {
    this.presentation = presentation;
    this.theme = theme || null;
    this.resolveImagePath = resolveImagePath || null;
  }

  /**
   * Set custom font CSS (e.g., @font-face rules for cached Google Fonts)
   */
  setCustomFontCSS(css: string): void {
    this.customFontCSS = css;
  }

  /**
   * Set the image path resolver (for resolving Obsidian wiki-links)
   */
  setImagePathResolver(resolver: ImagePathResolver): void {
    this.resolveImagePath = resolver;
  }

  /**
   * Resolve an image path, using the resolver if available
   */
  private resolveImageSrc(element: SlideElement): string {
    const imageData = element.imageData;
    let src = element.content;

    if (this.resolveImagePath) {
      src = this.resolveImagePath(src, imageData?.isWikiLink || false);
    }

    return src;
  }

  /**
   * Get the container class for a layout (iA Presenter pattern)
   */
  private getContainerClass(layout: SlideLayout): string {
    switch (layout) {
      case 'cover': return 'cover-container';
      case 'title': return 'title-container';
      case 'section': return 'section-container';
      case 'full-image': return 'image-container';
      case 'half-image': return 'split-container';
      case 'half-image-horizontal': return 'split-horizontal-container';
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

  /**
   * Render a slide thumbnail as HTML for embedding in an iframe
   */
  renderThumbnailHTML(slide: Slide, index: number): string {
    return this.renderSingleSlideHTML(slide, index, this.presentation.frontmatter, 'thumbnail');
  }

  /**
   * Render a slide for the presentation window
   */
  renderPresentationSlideHTML(slide: Slide, index: number): string {
    return this.renderSingleSlideHTML(slide, index, this.presentation.frontmatter, 'presentation');
  }

  /**
   * Render a single slide to standalone HTML (for thumbnails/iframes)
   */
  renderSingleSlideHTML(slide: Slide, index: number, frontmatter: PresentationFrontmatter, context: 'thumbnail' | 'preview' | 'presentation' = 'thumbnail'): string {
    const themeClasses = this.theme?.template.CssClasses || '';
    const themeCSS = this.theme ? generateThemeCSS(this.theme, context) : '';
    const bodyClass = context === 'thumbnail' ? 'perspecta-thumbnail' : 'perspecta-preview';
    const fontScaleCSS = this.getFontScaleCSS(frontmatter);
    // Include frontmatter CSS variable overrides so Inspector color changes apply
    const frontmatterVars = this.generateCSSVariables(frontmatter);
    const frontmatterCSS = frontmatterVars ? `:root {\n${frontmatterVars}\n}` : '';

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>${this.customFontCSS}</style>
  <style>${this.getBaseStyles(context)}</style>
  <style>${themeCSS}</style>
  <style>${frontmatterCSS}</style>
  <style>${fontScaleCSS}</style>
</head>
<body class="${bodyClass} ${themeClasses}">
  ${this.renderSlide(slide, index, frontmatter, false)}
</body>
</html>`;
  }

  /**
   * Render full presentation to HTML
   */
  renderHTML(): string {
    const { frontmatter, slides } = this.presentation;
    const themeClasses = this.theme?.template.CssClasses || '';
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="viewport-fit=cover, width=device-width, height=device-height, initial-scale=1" />
  <title>${this.escapeHtml(frontmatter.title || 'Presentation')}</title>
  ${this.renderStyles(frontmatter)}
</head>
<body class="perspecta-slides transition-${frontmatter.transition || 'fade'} ${themeClasses}">
  <div class="reveal">
    <div class="slides">
      ${slides.map((slide, index) => this.renderSlide(slide, index, frontmatter)).join('\n')}
    </div>
  </div>
  ${this.renderScripts()}
</body>
</html>`;
  }

  // ============================================
  // SLIDE RENDERING
  // ============================================

  /**
   * Interpolate between colors in a gradient based on position (0-1)
   */
  private interpolateGradientColor(colors: string[], position: number): string {
    if (colors.length === 0) return '#ffffff';
    if (colors.length === 1) return colors[0];

    // Clamp position to 0-1
    position = Math.max(0, Math.min(1, position));

    // Find which two colors to interpolate between
    const segment = position * (colors.length - 1);
    const index = Math.floor(segment);
    const t = segment - index;

    if (index >= colors.length - 1) return colors[colors.length - 1];

    const color1 = this.parseColor(colors[index]);
    const color2 = this.parseColor(colors[index + 1]);

    // Linear interpolation
    const r = Math.round(color1.r + (color2.r - color1.r) * t);
    const g = Math.round(color1.g + (color2.g - color1.g) * t);
    const b = Math.round(color1.b + (color2.b - color1.b) * t);

    return `rgb(${r}, ${g}, ${b})`;
  }

  /**
   * Parse a hex color to RGB components
   */
  private parseColor(hex: string): { r: number; g: number; b: number } {
    // Remove # if present
    hex = hex.replace('#', '');

    // Handle shorthand (e.g., #fff)
    if (hex.length === 3) {
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }

    return {
      r: parseInt(hex.substring(0, 2), 16) || 0,
      g: parseInt(hex.substring(2, 4), 16) || 0,
      b: parseInt(hex.substring(4, 6), 16) || 0,
    };
  }

  /**
   * Get dynamic background color for a slide if enabled
   */
  private getDynamicBackgroundColor(slideIndex: number, totalSlides: number, mode: 'light' | 'dark', frontmatter: PresentationFrontmatter): string | null {
    const useDynamic = frontmatter.useDynamicBackground;
    if (!useDynamic || useDynamic === 'none') return null;
    if (useDynamic !== 'both' && useDynamic !== mode) return null;

    // Get gradient colors-priority: frontmatter > theme > fallback
    let colors: string[] | undefined;
    if (mode === 'light') {
      colors = frontmatter.lightDynamicBackground;
    } else {
      colors = frontmatter.darkDynamicBackground;
    }

    // If no frontmatter colors, try to get from theme
    if (!colors || colors.length === 0) {
      const themeName = frontmatter.theme || 'zurich';
      const theme = this.theme;
      if (theme) {
        const preset = theme.presets[0];
        if (preset) {
          colors = mode === 'light' ? preset.LightBgGradient : preset.DarkBgGradient;
        }
      }
    }

    // Fallback gradient
    if (!colors || colors.length === 0) {
      colors = mode === 'light'
        ? ['#ffffff', '#f0f0f0', '#e0e0e0']
        : ['#1a1a2e', '#2d2d44', '#3d3d5c'];
    }

    // Calculate position (0 to 1) based on slide index
    const position = totalSlides > 1 ? slideIndex / (totalSlides - 1) : 0;

    return this.interpolateGradientColor(colors, position);
  }

  /**
   * Determine the effective mode for a slide
   * Priority: per-slide override > presentation default > 'light'
   * 'system' mode adds a CSS class that uses prefers-color-scheme media query
   */
  private getEffectiveMode(slide: Slide, frontmatter: PresentationFrontmatter): 'light' | 'dark' | 'system' {
    // Per-slide override takes precedence
    if (slide.metadata.mode) {
      return slide.metadata.mode;
    }
    // Fall back to presentation-wide setting
    return frontmatter.mode || 'light';
  }

  private renderSlide(slide: Slide, index: number, frontmatter: PresentationFrontmatter, renderSpeakerNotes: boolean = true): string {
    const effectiveMode = this.getEffectiveMode(slide, frontmatter);
    // For 'system' mode, we'll add both classes and let CSS handle it
    const modeClass = effectiveMode === 'system' ? 'system-mode' : effectiveMode;
    const layout = (slide.metadata.layout || 'default') as SlideLayout;
    const containerClass = this.getContainerClass(layout);
    const customClass = slide.metadata.class || '';
    const isActive = index === 0 ? 'active' : '';

    // Handle per-slide background image from metadata
    // This sits between the background color/gradient and the overlay
    const slideBackgroundHtml = this.renderSlideBackground(slide);

    // Compute dynamic background color if enabled (for system mode, compute for light-CSS will handle dark)
    const dynamicMode = effectiveMode === 'system' ? 'light' : effectiveMode;
    const dynamicBgColor = this.getDynamicBackgroundColor(index, this.presentation.slides.length, dynamicMode, frontmatter);
    const slideInlineStyle = dynamicBgColor ? `background-color: ${dynamicBgColor};` : '';

    // For full-image layout, render images as background layer (edge-to-edge)
    let imageBackground = '';
    if (layout === 'full-image') {
      imageBackground = this.renderFullImageBackground(slide);
    }

    // For half-image layouts, use special split rendering
    if (layout === 'half-image' || layout === 'half-image-horizontal') {
      return this.renderHalfImageSlide(slide, index, frontmatter, layout, modeClass, containerClass, customClass, isActive, slideBackgroundHtml, renderSpeakerNotes, dynamicBgColor);
    }

    // Generate overlay if configured (presentation-wide)
    const overlayHtml = this.renderOverlay(frontmatter);

    // Layer order: background color/gradient (on section) -> slide background image -> full-image -> overlay -> content
    return `
    <section class="slide ${containerClass} ${modeClass} ${customClass} ${isActive}" data-index="${index}"${slideInlineStyle ? ` style="${slideInlineStyle}"` : ''}>
      ${slideBackgroundHtml}
      ${imageBackground}
      ${overlayHtml}
      ${this.renderHeader(frontmatter, index)}
      <div class="slide-body">
        <div class="slide-content layout-${layout}">
          ${layout === 'full-image' ? '' : this.renderSlideContent(slide, layout)}
        </div>
      </div>
      ${this.renderFooter(frontmatter, index, this.presentation.slides.length)}
      ${renderSpeakerNotes && slide.speakerNotes.length > 0 ? `<aside class="speaker-notes">${slide.speakerNotes.map(n => this.renderMarkdown(n)).join('<br>')}</aside>` : ''}
    </section>`;
  }

  /**
   * Render half-image layouts with proper split structure:
   *-Image half: edge-to-edge full-bleed image
   *-Content half: normal slide with header/footer and padding
   */
  private renderHalfImageSlide(
    slide: Slide,
    index: number,
    frontmatter: PresentationFrontmatter,
    layout: 'half-image' | 'half-image-horizontal',
    mode: string,
    containerClass: string,
    customClass: string,
    isActive: string,
    slideBackgroundHtml: string,
    renderSpeakerNotes: boolean,
    dynamicBgColor?: string | null
  ): string {
    const elements = slide.elements.filter(e => e.visible);
    const images = elements.filter(e => e.type === 'image');
    const textElements = elements.filter(e => e.type !== 'image');

    // Determine position based on content order
    const firstElement = elements[0];
    const imageFirst = firstElement?.type === 'image';

    // Render the image panel (edge-to-edge like full-image)
    const imagePanel = this.renderHalfImagePanel(images);

    // Render the content panel (like a normal slide but in half space)
    const textContent = textElements.map(e => this.renderElement(e)).join('\n');

    const isHorizontal = layout === 'half-image-horizontal';
    const directionClass = isHorizontal ? 'split-horizontal' : 'split-vertical';
    const positionClass = imageFirst
      ? (isHorizontal ? 'image-top' : 'image-left')
      : (isHorizontal ? 'image-bottom' : 'image-right');

    const slideInlineStyle = dynamicBgColor ? `background-color: ${dynamicBgColor};` : '';
    const contentPanelStyle = dynamicBgColor ? ` style="background-color: ${dynamicBgColor};"` : '';
    const overlayHtml = this.renderOverlay(frontmatter);

    return `
    <section class="slide ${containerClass} ${mode} ${customClass} ${isActive} ${directionClass} ${positionClass}" data-index="${index}"${slideInlineStyle ? ` style="${slideInlineStyle}"` : ''}>
      ${slideBackgroundHtml}
      ${overlayHtml}
      <div class="half-image-panel">
        ${imagePanel}
      </div>
      <div class="half-content-panel ${mode}"${contentPanelStyle}>
        ${this.renderHeader(frontmatter, index)}
        <div class="slide-body">
          <div class="slide-content">
            ${textContent}
          </div>
        </div>
        ${this.renderFooter(frontmatter, index, this.presentation.slides.length)}
      </div>
      ${renderSpeakerNotes && slide.speakerNotes.length > 0 ? `<aside class="speaker-notes">${slide.speakerNotes.map(n => this.renderMarkdown(n)).join('<br>')}</aside>` : ''}
    </section>`;
  }

  /**
   * Render the image panel for half-image layouts (edge-to-edge)
   */
  private renderHalfImagePanel(images: SlideElement[]): string {
    if (images.length === 0) return '';

    if (images.length === 1) {
      const img = images[0];
      const imageData = img.imageData;
      const src = this.escapeHtml(this.resolveImageSrc(img));
      const x = imageData?.x || 'center';
      const y = imageData?.y || 'center';
      const objectFit = imageData?.size || 'cover';

      return `<img src="${src}" style="width: 100%; height: 100%; object-fit: ${objectFit}; object-position: ${x} ${y};" />`;
    }

    // Multiple images-stack them
    return images.map(img => {
      const imageData = img.imageData;
      const src = this.escapeHtml(this.resolveImageSrc(img));
      const x = imageData?.x || 'center';
      const y = imageData?.y || 'center';
      const objectFit = imageData?.size || 'cover';
      return `<div class="image-slot"><img src="${src}" style="width: 100%; height: 100%; object-fit: ${objectFit}; object-position: ${x} ${y};" /></div>`;
    }).join('\n');
  }

  /**
   * Render full-image layout as a background layer (edge-to-edge, no padding)
   */
  private renderFullImageBackground(slide: Slide): string {
    const images = slide.elements.filter(e => e.visible && e.type === 'image');
    if (images.length === 0) return '';

    // For single image, fill the entire slide
    if (images.length === 1) {
      const img = images[0];
      const imageData = img.imageData;
      const src = this.escapeHtml(this.resolveImageSrc(img));
      const x = imageData?.x || 'center';
      const y = imageData?.y || 'center';

      // Build styles
      const objectFit = imageData?.size || 'cover';
      const styles: string[] = [
        'position: absolute',
        'top: 0', 'left: 0', 'right: 0', 'bottom: 0',
        'width: 100%', 'height: 100%',
        `object-fit: ${objectFit}`,
        `object-position: ${x} ${y}`,
      ];

      if (imageData?.opacity !== undefined && imageData.opacity < 100) {
        styles.push(`opacity: ${imageData.opacity / 100}`);
      }

      if (imageData?.filter && imageData.filter !== 'none') {
        const filterMap: Record<string, string> = {
          'darken': 'brightness(0.6)',
          'lighten': 'brightness(1.4)',
          'blur': 'blur(4px)',
          'grayscale': 'grayscale(100%)',
          'sepia': 'sepia(100%)',
        };
        const filterValue = filterMap[imageData.filter];
        if (filterValue) styles.push(`filter: ${filterValue}`);
      }

      return `<div class="slide-image-background"><img src="${src}" style="${styles.join('; ')}" /></div>`;
    }

    // Multiple images-use CSS classes for responsive layout
    // Two images: side-by-side in landscape, stacked in portrait
    const imageCount = images.length;
    const layoutClass = imageCount === 2 ? 'dual-image' : `multi-image count-${imageCount}`;

    return `<div class="slide-image-background ${layoutClass}">
      ${images.map((img, idx) => {
      const imageData = img.imageData;
      const src = this.escapeHtml(this.resolveImageSrc(img));
      const x = imageData?.x || 'center';
      const y = imageData?.y || 'center';
      const objectFit = imageData?.size || 'cover';
      return `<div class="image-panel image-${idx + 1}"><img src="${src}" style="object-fit: ${objectFit}; object-position: ${x} ${y};" /></div>`;
    }).join('\n')}
    </div>`;
  }

  // ============================================
  // LAYOUT TEMPLATES
  // ============================================

  private renderSlideContent(slide: Slide, layout: string): string {
    const elements = slide.elements.filter(e => e.visible);
    const images = elements.filter(e => e.type === 'image');
    const textElements = elements.filter(e => e.type !== 'image');
    const headings = elements.filter(e => e.type === 'heading' || e.type === 'kicker');
    const bodyElements = elements.filter(e => e.type !== 'heading' && e.type !== 'kicker' && e.type !== 'image');

    switch (layout as SlideLayout) {
      // ==================
      // STANDARD SLIDES
      // ==================

      case 'cover':
        return this.renderCoverLayout(elements);

      case 'title':
        return this.renderTitleLayout(elements);

      case 'section':
        return this.renderSectionLayout(elements);

      case 'default':
        return this.renderDefaultLayout(elements);

      // ==================
      // TEXT SLIDES
      // ==================

      case '1-column':
        return this.renderColumnLayout(elements, 1);

      case '2-columns':
        return this.renderColumnLayout(elements, 2, 'equal');

      case '3-columns':
        return this.renderColumnLayout(elements, 3, 'equal');

      case '2-columns-1+2':
        return this.renderColumnLayout(elements, 2, 'narrow-wide');

      case '2-columns-2+1':
        return this.renderColumnLayout(elements, 2, 'wide-narrow');

      // ==================
      // IMAGE SLIDES
      // ==================

      case 'full-image':
        return this.renderFullImageLayout(images);

      case 'caption':
        return this.renderCaptionLayout(headings, images, bodyElements);

      // Note: half-image and half-image-horizontal are handled by renderHalfImageSlide()
      // before this switch is reached

      default:
        return this.renderDefaultLayout(elements);
    }
  }

  // ==================
  // STANDARD LAYOUTS
  // ==================

  /**
   * Cover Layout: Opening slide with centered content (iA Presenter compatible)
   * Uses centered flex layout - no slots needed
   */
  private renderCoverLayout(elements: SlideElement[]): string {
    return `<div class="cover-content">
      ${elements.map(e => this.renderElement(e)).join('\n')}
    </div>`;
  }

  /**
   * Title Layout: Centered content with large headings
   * Uses centered flex layout - no slots needed
   */
  private renderTitleLayout(elements: SlideElement[]): string {
    return `<div class="title-content">
      ${elements.map(e => this.renderElement(e)).join('\n')}
    </div>`;
  }

  /**
   * Section Layout: Accent background, centered heading
   * Uses centered flex layout - no slots needed
   */
  private renderSectionLayout(elements: SlideElement[]): string {
    return `<div class="section-content">
      ${elements.map(e => this.renderElement(e)).join('\n')}
    </div>`;
  }

  /**
   * Default Layout: Auto-detects columns based on columnIndex
   * Uses slot-header + slot-columns for proper positioning
   */
  private renderDefaultLayout(elements: SlideElement[]): string {
    const columnElements = elements.filter(e => e.columnIndex !== undefined);
    const nonColumnElements = elements.filter(e => e.columnIndex === undefined);

    // Separate headings/kickers from body content
    const headerElements = nonColumnElements.filter(e => e.type === 'heading' || e.type === 'kicker');
    const bodyElements = nonColumnElements.filter(e => e.type !== 'heading' && e.type !== 'kicker');

    // If no column elements, render all body content in a single column
    if (columnElements.length === 0) {
      return `
        <div class="slot-header">
          ${headerElements.map(e => this.renderElement(e)).join('\n')}
        </div>
        <div class="slot-columns columns-1">
          <div class="column" data-column="1">
            ${bodyElements.map(e => this.renderElement(e)).join('\n')}
          </div>
        </div>`;
    }

    // Auto-detect column count
    const maxColumnIndex = Math.max(...columnElements.map(e => e.columnIndex ?? 0));
    const columnCount = Math.min(maxColumnIndex + 1, 3); // Max 3 columns

    // Group elements by column
    const columns: SlideElement[][] = Array.from({ length: columnCount }, () => []);
    columnElements.forEach(e => {
      const idx = Math.min(e.columnIndex ?? 0, columnCount - 1);
      columns[idx].push(e);
    });

    return `
      <div class="slot-header">
        ${nonColumnElements.map(e => this.renderElement(e)).join('\n')}
      </div>
      <div class="slot-columns columns-${columnCount}">
        ${columns.map((col, i) => `
          <div class="column" data-column="${i + 1}">
            ${col.map(e => this.renderElement(e)).join('\n')}
          </div>
        `).join('\n')}
      </div>`;
  }

  // ==================
  // TEXT LAYOUTS
  // ==================

  /**
   * Column Layout: Explicit column control
   * Uses slot-header + slot-columns for consistent positioning
   * @param elements All visible elements
   * @param columnCount Number of visual columns (1, 2, or 3)
   * @param ratio Column ratio: 'equal', 'narrow-wide' (1/3+2/3), 'wide-narrow' (2/3+1/3)
   */
  private renderColumnLayout(
    elements: SlideElement[],
    columnCount: number,
    ratio: 'equal' | 'narrow-wide' | 'wide-narrow' = 'equal'
  ): string {
    const columnElements = elements.filter(e => e.columnIndex !== undefined);
    const nonColumnElements = elements.filter(e => e.columnIndex === undefined);

    // Separate headings/kickers from body content
    const headerElements = nonColumnElements.filter(e => e.type === 'heading' || e.type === 'kicker');
    const bodyElements = nonColumnElements.filter(e => e.type !== 'heading' && e.type !== 'kicker');

    // Find how many data columns exist
    const maxDataColumn = columnElements.reduce((max, e) =>
      Math.max(max, e.columnIndex ?? 0), -1);
    const dataColumnCount = maxDataColumn + 1;

    // Group elements into visual columns, merging overflow into last column
    const columns: SlideElement[][] = Array.from({ length: columnCount }, () => []);
    columnElements.forEach(e => {
      let targetCol = e.columnIndex ?? 0;
      if (dataColumnCount > columnCount && targetCol >= columnCount - 1) {
        targetCol = columnCount - 1; // Merge into last column
      }
      columns[Math.min(targetCol, columnCount - 1)].push(e);
    });

    // If no column elements, distribute body elements into first column
    if (columnElements.length === 0) {
      return `
        <div class="slot-header">
          ${headerElements.map(e => this.renderElement(e)).join('\n')}
        </div>
        <div class="slot-columns columns-${columnCount} ratio-${ratio}">
          <div class="column" data-column="1">
            ${bodyElements.map(e => this.renderElement(e)).join('\n')}
          </div>
          ${Array.from({ length: columnCount - 1 }, (_, i) => `
            <div class="column" data-column="${i + 2}"></div>
          `).join('\n')}
        </div>`;
    }

    return `
      <div class="slot-header">
        ${headerElements.map(e => this.renderElement(e)).join('\n')}
      </div>
      <div class="slot-columns columns-${columnCount} ratio-${ratio}">
        ${columns.map((col, i) => `
          <div class="column" data-column="${i + 1}">
            ${col.map(e => this.renderElement(e)).join('\n')}
          </div>
        `).join('\n')}
      </div>`;
  }

  // ==================
  // IMAGE LAYOUTS
  // ==================

  /**
   * Full Image Layout: Images fill the entire slide with object-fit: cover
   * First image fills the whole slide; multiple images split the space equally
   */
  private renderFullImageLayout(images: SlideElement[]): string {
    if (images.length === 0) {
      return `<div class="slide-content full-image-content empty">No images</div>`;
    }

    // For single image, fill the entire slide
    if (images.length === 1) {
      const img = images[0];
      const imageData = img.imageData;
      const src = this.escapeHtml(this.resolveImageSrc(img));
      const alt = imageData?.alt ? this.escapeHtml(imageData.alt) : '';

      // Build style for positioning
      const x = imageData?.x || 'center';
      const y = imageData?.y || 'center';
      const objectFit = imageData?.size || 'cover';
      const objectPosition = `${x} ${y}`;

      return `
        <div class="slide-content full-image-content single-image">
          <div class="image-slot">
            <img src="${src}" alt="${alt}" style="object-fit: ${objectFit}; object-position: ${objectPosition};" />
          </div>
        </div>`;
    }

    // Multiple images split the space
    const direction = images.length === 2 ? 'horizontal' : 'grid';

    return `
      <div class="slide-content full-image-content split-${direction} count-${images.length}">
        ${images.map(img => {
      const imageData = img.imageData;
      const src = this.escapeHtml(this.resolveImageSrc(img));
      const alt = imageData?.alt ? this.escapeHtml(imageData.alt) : '';
      const x = imageData?.x || 'center';
      const y = imageData?.y || 'center';
      const objectFit = imageData?.size || 'cover';
      return `
          <div class="image-slot">
            <img src="${src}" alt="${alt}" style="object-fit: ${objectFit}; object-position: ${x} ${y};" />
          </div>`;
    }).join('\n')}
      </div>`;
  }

  /**
   * Caption Layout: Full image with title bar at top, optional caption at bottom
   */
  private renderCaptionLayout(
    headings: SlideElement[],
    images: SlideElement[],
    bodyElements: SlideElement[]
  ): string {
    return `
      <div class="slide-content caption-content">
        <div class="slot-title-bar">
          ${headings.map(e => this.renderElement(e)).join('\n')}
        </div>
        <div class="slot-image">
          ${images.map(img => {
      const imageData = img.imageData;
      const objectFit = imageData?.size || 'cover';
      const x = imageData?.x || 'center';
      const y = imageData?.y || 'center';
      return `
            <div class="image-slot">
              <img src="${this.escapeHtml(this.resolveImageSrc(img))}" alt="" style="object-fit: ${objectFit}; object-position: ${x} ${y};" />
            </div>`;
    }).join('\n')}
        </div>
        ${bodyElements.length > 0 ? `
          <div class="slot-caption">
            ${bodyElements.map(e => this.renderElement(e)).join('\n')}
          </div>
        ` : ''}
      </div>`;
  }

  // ============================================
  // ELEMENT RENDERING
  // ============================================

  private renderElement(element: SlideElement): string {
    switch (element.type) {
      case 'heading':
        const level = element.level || 1;
        return `<h${level}>${this.renderMarkdown(element.content)}</h${level}>`;

      case 'paragraph':
        return `<p>${this.renderMarkdown(element.content)}</p>`;

      case 'list':
        return this.renderList(element.content);

      case 'blockquote':
        return `<blockquote>${this.renderMarkdown(element.content)}</blockquote>`;

      case 'image':
        return this.renderImage(element);

      case 'code':
        const lines = element.content.split('\n');
        const language = lines[0] || '';
        const code = lines.slice(1).join('\n') || element.content;
        return `<pre><code class="language-${language}">${this.escapeHtml(code)}</code></pre>`;

      case 'table':
        return this.renderTable(element.content);

      case 'math':
        return `<div class="math-block">${this.escapeHtml(element.content)}</div>`;

      case 'kicker':
        return `<div class="kicker">${this.renderMarkdown(element.content)}</div>`;

      default:
        return `<p>${this.renderMarkdown(element.content)}</p>`;
    }
  }

  private renderList(content: string): string {
    const lines = content.split('\n');
    const isOrdered = /^\d+\./.test(lines[0]);
    const tag = isOrdered ? 'ol' : 'ul';

    const items = lines.map(line => {
      const text = line.replace(/^[-*+]\s+/, '').replace(/^\d+\.\s+/, '');
      return `<li>${this.renderMarkdown(text)}</li>`;
    }).join('\n');

    return `<${tag}>${items}</${tag}>`;
  }

  /**
   * Render an image element with proper styling for presentations
   */
  private renderImage(element: SlideElement): string {
    const imageData = element.imageData;
    const src = this.escapeHtml(this.resolveImageSrc(element));
    const alt = imageData?.alt ? this.escapeHtml(imageData.alt) : '';

    // Build inline styles for positioning
    const styles: string[] = [];

    // Object-fit based on size mode
    const objectFit = imageData?.size || 'cover';
    styles.push(`object-fit: ${objectFit}`);

    // Object-position from x/y
    const x = imageData?.x || 'center';
    const y = imageData?.y || 'center';
    styles.push(`object-position: ${x} ${y}`);

    // Opacity
    if (imageData?.opacity !== undefined && imageData.opacity < 100) {
      styles.push(`opacity: ${imageData.opacity / 100}`);
    }

    // Build filter string
    if (imageData?.filter && imageData.filter !== 'none') {
      const filterMap: Record<string, string> = {
        'darken': 'brightness(0.6)',
        'lighten': 'brightness(1.4)',
        'blur': 'blur(4px)',
        'grayscale': 'grayscale(100%)',
        'sepia': 'sepia(100%)',
      };
      const filterValue = filterMap[imageData.filter];
      if (filterValue) {
        styles.push(`filter: ${filterValue}`);
      }
    }

    const styleAttr = styles.length > 0 ? ` style="${styles.join('; ')}"` : '';

    // Wrap in figure for semantic markup
    return `<figure class="image-figure"><img src="${src}" alt="${alt}"${styleAttr} /></figure>`;
  }

  private renderTable(content: string): string {
    const lines = content.split('\n').filter(l => l.trim());
    if (lines.length < 2) return '';

    const headerCells = lines[0].split('|').filter(c => c.trim()).map(c => c.trim());
    const bodyLines = lines.slice(2);

    const header = `<tr>${headerCells.map(c => `<th>${this.renderMarkdown(c)}</th>`).join('')}</tr>`;
    const body = bodyLines.map(line => {
      const cells = line.split('|').filter(c => c.trim()).map(c => c.trim());
      return `<tr>${cells.map(c => `<td>${this.renderMarkdown(c)}</td>`).join('')}</tr>`;
    }).join('\n');

    return `<table><thead>${header}</thead><tbody>${body}</tbody></table>`;
  }

  private renderMarkdown(text: string): string {
    let html = this.escapeHtml(text);

    // Bold
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');

    // Italic
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    html = html.replace(/_(.+?)_/g, '<em>$1</em>');

    // Highlight
    html = html.replace(/==(.+?)==/g, '<mark>$1</mark>');

    // Inline code
    html = html.replace(/`(.+?)`/g, '<code>$1</code>');

    // Links
    html = html.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');

    return html;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ============================================
  // OVERLAY
  // ============================================

  /**
   * Render per-slide background image
   * This sits between the background color/gradient and the overlay
   */
  private renderSlideBackground(slide: Slide): string {
    if (!slide.metadata.background) {
      return '';
    }

    const opacity = slide.metadata.backgroundOpacity ?? 1;
    let imagePath = slide.metadata.background;

    // Resolve image path if resolver available
    // Treat as wiki-link style (just filename) so Obsidian can find it in the vault
    if (this.resolveImagePath) {
      const isUrl = imagePath.startsWith('http://') || imagePath.startsWith('https://');
      const isAbsolute = imagePath.startsWith('/') || imagePath.startsWith('file://');
      if (!isUrl && !isAbsolute) {
        imagePath = this.resolveImagePath(imagePath, true);
      }
    }

    return `<div class="slide-background" style="background-image: url('${this.escapeHtml(imagePath)}'); opacity: ${opacity};"></div>`;
  }

  /**
   * Render presentation-wide overlay image
   * This sits above slide backgrounds but below content
   */
  private renderOverlay(frontmatter: PresentationFrontmatter): string {
    if (!frontmatter.imageOverlay) {
      return '';
    }

    const opacity = (frontmatter.imageOverlayOpacity ?? 50) / 100;
    let imagePath = frontmatter.imageOverlay;

    // Resolve image path if resolver available
    // Treat as wiki-link style (just filename) so Obsidian can find it in the vault
    if (this.resolveImagePath) {
      // Check if it's a URL (http/https) or absolute path - don't resolve those
      const isUrl = imagePath.startsWith('http://') || imagePath.startsWith('https://');
      const isAbsolute = imagePath.startsWith('/') || imagePath.startsWith('file://');
      if (!isUrl && !isAbsolute) {
        imagePath = this.resolveImagePath(imagePath, true);
      }
    }

    return `<div class="slide-overlay" style="background-image: url('${this.escapeHtml(imagePath)}'); opacity: ${opacity};"></div>`;
  }

  // ============================================
  // HEADER / FOOTER
  // ============================================

  private renderHeader(frontmatter: PresentationFrontmatter, index: number): string {
    if (!frontmatter.headerLeft && !frontmatter.headerMiddle && !frontmatter.headerRight) {
      return '';
    }

    return `
      <header class="slide-header">
        <div class="header-left">${frontmatter.headerLeft ? `<span>${frontmatter.headerLeft}</span>` : ''}</div>
        <div class="header-middle">${frontmatter.headerMiddle ? `<span>${frontmatter.headerMiddle}</span>` : ''}</div>
        <div class="header-right">${frontmatter.headerRight ? `<span>${frontmatter.headerRight}</span>` : ''}</div>
      </header>`;
  }

  private renderFooter(frontmatter: PresentationFrontmatter, index: number, total: number): string {
    const showNumbers = frontmatter.showSlideNumbers !== false;

    return `
      <footer class="slide-footer">
        <div class="footer-left">${frontmatter.footerLeft ? `<span>${frontmatter.footerLeft}</span>` : ''}</div>
        <div class="footer-middle">${frontmatter.footerMiddle ? `<span>${frontmatter.footerMiddle}</span>` : ''}</div>
        <div class="footer-right">${showNumbers ? `<span>${index + 1}</span>` : ''}</div>
      </footer>`;
  }

  // ============================================
  // STYLES
  // ============================================

  /**
   * Generate CSS for font size scaling and content offset based on frontmatter
   * fontSizeOffset is a percentage: -20 means 20% smaller, +10 means 10% larger
   * contentTopOffset is a percentage of slide height to push columns down
   */
  private getFontScaleCSS(frontmatter: PresentationFrontmatter): string {
    const fontOffset = frontmatter.fontSizeOffset ?? 0;
    // Convert percentage offset to scale factor: -20 → 0.8, +10 → 1.1
    const scale = 1 + (fontOffset / 100);
    // Clamp to reasonable range (0.5 to 1.5)
    const clampedScale = Math.max(0.5, Math.min(1.5, scale));

    const contentOffset = frontmatter.contentTopOffset ?? 0;
    // Clamp to 0-20%
    const clampedContentOffset = Math.max(0, Math.min(20, contentOffset));

    return `:root { --font-scale: ${clampedScale}; --content-top-offset: ${clampedContentOffset}%; }`;
  }

  /**
   * Generate unified slide CSS that works for all contexts (thumbnail, preview, presentation).
   * Uses --slide-unit for ALL measurements so everything scales uniformly.
   * Uses absolute positioning for layout regions so each margin is independent from the slide edge.
   */
  private getSlideCSS(): string {
    return `
      /* ============================================
         SLIDE BASE - Uses absolute positioning
         All margins are independent distances from slide edges
         ============================================ */
      
      .slide { 
        width: 100%; 
        height: 100%; 
        position: relative;
        overflow: hidden;
      }
      
      /* Color modes */
      .slide.light { background: var(--light-background); color: var(--light-body-text); }
      .slide.light h1 { color: var(--light-h1-color, var(--light-title-text)); }
      .slide.light h2 { color: var(--light-h2-color, var(--light-title-text)); }
      .slide.light h3 { color: var(--light-h3-color, var(--light-title-text)); }
      .slide.light h4 { color: var(--light-h4-color, var(--light-title-text)); }
      .slide.light h5, .slide.light h6 { color: var(--light-title-text); }
      .slide.dark { background: var(--dark-background); color: var(--dark-body-text); }
      .slide.dark h1 { color: var(--dark-h1-color, var(--dark-title-text)); }
      .slide.dark h2 { color: var(--dark-h2-color, var(--dark-title-text)); }
      .slide.dark h3 { color: var(--dark-h3-color, var(--dark-title-text)); }
      .slide.dark h4 { color: var(--dark-h4-color, var(--dark-title-text)); }
      .slide.dark h5, .slide.dark h6 { color: var(--dark-title-text); }
      
      /* Layout-specific backgrounds */
      .slide.light.cover-container { background: var(--light-bg-cover, var(--light-background)); }
      .slide.light.title-container { background: var(--light-bg-title, var(--light-background)); }
      .slide.light.section-container { background: var(--light-bg-section, var(--accent1)); }
      .slide.dark.cover-container { background: var(--dark-bg-cover, var(--dark-background)); }
      .slide.dark.title-container { background: var(--dark-bg-title, var(--dark-background)); }
      .slide.dark.section-container { background: var(--dark-bg-section, var(--accent1)); }
      
      /* System mode: follows OS preference */
      .slide.system-mode { background: var(--light-background); color: var(--light-body-text); }
      .slide.system-mode h1 { color: var(--light-h1-color, var(--light-title-text)); }
      .slide.system-mode h2 { color: var(--light-h2-color, var(--light-title-text)); }
      .slide.system-mode h3, .slide.system-mode h4,
      .slide.system-mode h5, .slide.system-mode h6 { color: var(--light-title-text); }
      @media (prefers-color-scheme: dark) {
        .slide.system-mode { background: var(--dark-background); color: var(--dark-body-text); }
        .slide.system-mode h1 { color: var(--dark-h1-color, var(--dark-title-text)); }
        .slide.system-mode h2 { color: var(--dark-h2-color, var(--dark-title-text)); }
        .slide.system-mode h3, .slide.system-mode h4,
        .slide.system-mode h5, .slide.system-mode h6 { color: var(--dark-title-text); }
      }
      
      /* ============================================
         BACKGROUND LAYERS
         ============================================ */
      .slide-background, .slide-image-background {
        position: absolute;
        top: 0; left: 0; right: 0; bottom: 0;
        z-index: 0;
        overflow: hidden;
        background-size: cover;
        background-position: center;
        background-repeat: no-repeat;
      }
      .slide-image-background img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .slide-overlay {
        position: absolute;
        top: 0; left: 0; right: 0; bottom: 0;
        z-index: 1;
        pointer-events: none;
        background-size: cover;
        background-position: center;
        background-repeat: no-repeat;
      }
      
      /* Multi-image backgrounds */
      .slide-image-background.dual-image {
        display: flex;
        flex-direction: row;
      }
      .slide-image-background.dual-image .image-panel {
        flex: 1;
        overflow: hidden;
        min-width: 0;
        min-height: 0;
      }
      @media (orientation: portrait), (max-aspect-ratio: 1/1) {
        .slide-image-background.dual-image { flex-direction: column; }
      }
      
      .slide-image-background.multi-image.count-3 {
        display: flex;
        flex-direction: row;
      }
      .slide-image-background.multi-image.count-3 .image-panel {
        flex: 1;
        overflow: hidden;
        min-width: 0;
        min-height: 0;
      }
      @media (orientation: portrait), (max-aspect-ratio: 1/1) {
        .slide-image-background.multi-image.count-3 { flex-direction: column; }
      }
      
      .slide-image-background.multi-image.count-4 {
        display: grid;
        grid-template-columns: 1fr 1fr;
        grid-template-rows: 1fr 1fr;
      }
      .slide-image-background.multi-image.count-4 .image-panel {
        overflow: hidden;
        min-width: 0;
        min-height: 0;
      }
      
      .slide-image-background.multi-image.count-5 {
        display: grid;
        grid-template-columns: repeat(6, 1fr);
        grid-template-rows: 1fr 1fr;
      }
      .slide-image-background.multi-image.count-5 .image-panel { overflow: hidden; min-width: 0; min-height: 0; }
      .slide-image-background.multi-image.count-5 .image-1 { grid-column: 1 / 4; grid-row: 1; }
      .slide-image-background.multi-image.count-5 .image-2 { grid-column: 4 / 7; grid-row: 1; }
      .slide-image-background.multi-image.count-5 .image-3 { grid-column: 1 / 3; grid-row: 2; }
      .slide-image-background.multi-image.count-5 .image-4 { grid-column: 3 / 5; grid-row: 2; }
      .slide-image-background.multi-image.count-5 .image-5 { grid-column: 5 / 7; grid-row: 2; }
      
      .slide-image-background.multi-image.count-6 {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        grid-template-rows: 1fr 1fr;
      }
      .slide-image-background.multi-image.count-6 .image-panel { overflow: hidden; min-width: 0; min-height: 0; }
      
      .slide-image-background.multi-image:not(.count-3):not(.count-4):not(.count-5):not(.count-6) {
        display: flex;
        flex-wrap: wrap;
      }
      .slide-image-background.multi-image:not(.count-3):not(.count-4):not(.count-5):not(.count-6) .image-panel {
        flex: 1 1 33.333%;
        overflow: hidden;
        min-width: 0;
        min-height: 0;
      }
      
      /* ============================================
         SLIDE BODY - Full bleed positioning context
         ============================================ */
      .slide-body { 
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 2;
        display: flex;
        flex-direction: column;
      }
      
      /* ============================================
         HEADER / FOOTER - Absolutely positioned from edges
         ============================================ */
      .slide-header {
        position: absolute;
        top: calc(var(--header-top, 2.5) * var(--slide-unit));
        left: calc(var(--content-width, 5) * var(--slide-unit));
        right: calc(var(--content-width, 5) * var(--slide-unit));
        z-index: 10;
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        font-family: var(--header-font, var(--body-font, system-ui, -apple-system, sans-serif));
        font-weight: var(--header-font-weight, var(--body-font-weight, 400));
        font-size: calc(var(--slide-unit) * 1.8 * var(--header-font-scale, 1) * var(--font-scale, 1));
      }
      
      .slide-footer {
        position: absolute;
        bottom: calc(var(--footer-bottom, 2.5) * var(--slide-unit));
        left: calc(var(--content-width, 5) * var(--slide-unit));
        right: calc(var(--content-width, 5) * var(--slide-unit));
        z-index: 10;
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
        font-family: var(--footer-font, var(--body-font, system-ui, -apple-system, sans-serif));
        font-weight: var(--footer-font-weight, var(--body-font-weight, 400));
        font-size: calc(var(--slide-unit) * 1.8 * var(--footer-font-scale, 1) * var(--font-scale, 1));
      }
      
      .slide-header > div, .slide-footer > div { flex: 1; display: flex; }
      .header-left, .footer-left { justify-content: flex-start; }
      .header-middle, .footer-middle { justify-content: center; }
      .header-right, .footer-right { justify-content: flex-end; }
      
      /* Header/Footer in full-image layout: semi-transparent background */
      .image-container .header-left > span,
      .image-container .header-middle > span,
      .image-container .header-right > span,
      .image-container .footer-left > span,
      .image-container .footer-middle > span,
      .image-container .footer-right > span {
        background: rgba(0, 0, 0, 0.5);
        padding: calc(var(--slide-unit) * 0.5) calc(var(--slide-unit) * 1);
        border-radius: calc(var(--slide-unit) * 0.5);
        color: #fff;
      }
      
      /* ============================================
         SLIDE CONTENT AREA
         ============================================ */
      .slide-content { 
        position: absolute;
        left: calc(var(--content-width, 5) * var(--slide-unit));
        right: calc(var(--content-width, 5) * var(--slide-unit));
        top: 0;
        bottom: 0;
        display: flex; 
        flex-direction: column; 
        gap: calc(var(--slide-unit) * 1.5);
        z-index: 5;
      }
      
      /* ============================================
         SLOT HEADER - Title area (absolute from top)
         ============================================ */
      .slot-header { 
        position: absolute;
        top: calc(var(--title-top, 5) * var(--slide-unit));
        left: 0;
        right: 0;
      }
      
      /* ============================================
         SLOT COLUMNS - Content area (absolute from top and bottom)
         ============================================ */
      .slot-columns { 
        position: absolute;
        top: calc(var(--content-top, 12) * var(--slide-unit));
        left: 0;
        right: 0;
        bottom: calc(var(--footer-bottom, 2.5) * var(--slide-unit) + var(--slide-unit) * 4);
        display: flex; 
        flex-direction: row;
        gap: calc(var(--slide-unit) * 3); 
        align-items: stretch;
        overflow: hidden;
      }
      
      .slot-columns .column { 
        flex: 1; 
        display: flex; 
        flex-direction: column; 
        min-height: 0;
        min-width: 0;
        overflow: hidden;
      }
      .slot-columns.columns-1 { flex-direction: column; }
      .slot-columns.columns-2, .slot-columns.columns-3 { flex-direction: row; }
      .slot-columns.columns-3 { gap: calc(var(--slide-unit) * 5); }
      .slot-columns.columns-3 .column { min-width: 0; }
      .slot-columns.ratio-narrow-wide .column[data-column="1"] { flex: 1; }
      .slot-columns.ratio-narrow-wide .column[data-column="2"] { flex: 2; }
      .slot-columns.ratio-wide-narrow .column[data-column="1"] { flex: 2; }
      .slot-columns.ratio-wide-narrow .column[data-column="2"] { flex: 1; }
      
      /* ============================================
         TYPOGRAPHY - All sizes use --slide-unit
         ============================================ */
      h1, h2, h3, h4, h5, h6 { 
        font-family: var(--title-font, system-ui, -apple-system, sans-serif);
        font-weight: var(--title-font-weight, 700); 
        line-height: var(--line-height, 1.1);
        margin-top: calc(var(--headline-spacing-before, 0) * var(--slide-unit));
        margin-bottom: calc(var(--headline-spacing-after, 0.5) * var(--slide-unit));
      }
      h1 { font-size: calc(var(--slide-unit) * 7 * var(--title-font-scale, 1) * var(--font-scale, 1)); }
      h2 { font-size: calc(var(--slide-unit) * 5.5 * var(--title-font-scale, 1) * var(--font-scale, 1)); }
      h3 { font-size: calc(var(--slide-unit) * 4.5 * var(--title-font-scale, 1) * var(--font-scale, 1)); }
      h4 { font-size: calc(var(--slide-unit) * 3.5 * var(--title-font-scale, 1) * var(--font-scale, 1)); }
      h5 { font-size: calc(var(--slide-unit) * 3 * var(--title-font-scale, 1) * var(--font-scale, 1)); }
      h6 { font-size: calc(var(--slide-unit) * 2.5 * var(--title-font-scale, 1) * var(--font-scale, 1)); }
      
      p { 
        font-weight: var(--body-font-weight, 400);
        font-size: calc(var(--slide-unit) * 2.8 * var(--body-font-scale, 1) * var(--font-scale, 1)); 
        line-height: var(--line-height, 1.1); 
      }
      
      ul, ol { 
        font-weight: var(--body-font-weight, 400);
        padding-left: calc(var(--slide-unit) * 2); 
        font-size: calc(var(--slide-unit) * 2.8 * var(--body-font-scale, 1) * var(--font-scale, 1)); 
        line-height: var(--line-height, 1.1);
      }
      li { margin-bottom: calc(var(--list-item-spacing, 1) * var(--slide-unit)); }
      
      .kicker { 
        font-size: calc(var(--slide-unit) * 1.8 * var(--body-font-scale, 1) * var(--font-scale, 1)); 
        text-transform: uppercase; 
        letter-spacing: 0.08em; 
        opacity: 0.7; 
      }
      
      /* ============================================
         IMAGES
         ============================================ */
      .image-figure {
        margin: 0;
        padding: 0;
        width: 100%;
        max-width: 100%;
        flex: 1;
        min-height: 0;
        overflow: hidden;
        position: relative;
      }
      .image-figure img {
        display: block;
        width: 100%;
        height: 100%;
        max-width: 100%;
        position: absolute;
        top: 0;
        left: 0;
      }
      .image-figure img[style*="contain"] {
        margin: 0 auto;
      }
      
      /* ============================================
         LAYOUT: COVER - Centered content
         ============================================ */
      .layout-cover {
        display: flex;
        justify-content: center;
        align-items: center;
      }
      .cover-content {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        text-align: center;
        padding: calc(var(--slide-unit) * 5);
      }
      .cover-content h1 { font-size: calc(var(--slide-unit) * 9 * var(--title-font-scale, 1) * var(--font-scale, 1)); }
      .cover-content h2 { font-size: calc(var(--slide-unit) * 7 * var(--title-font-scale, 1) * var(--font-scale, 1)); }
      
      /* ============================================
         LAYOUT: TITLE - Centered content
         ============================================ */
      .layout-title {
        display: flex;
        justify-content: center;
        align-items: center;
      }
      .title-content {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        text-align: center;
        padding: calc(var(--slide-unit) * 5);
      }
      .title-content h1 { font-size: calc(var(--slide-unit) * 9 * var(--title-font-scale, 1) * var(--font-scale, 1)); }
      .title-content h2 { font-size: calc(var(--slide-unit) * 7 * var(--title-font-scale, 1) * var(--font-scale, 1)); }
      
      /* ============================================
         LAYOUT: SECTION - Accent background, centered
         ============================================ */
      .section-container .slide-body { 
        background: var(--accent1, #1a1a2e); 
        color: var(--light-body-text, #fff);
      }
      .layout-section {
        display: flex;
        justify-content: center;
        align-items: center;
      }
      .section-content {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        text-align: center;
        padding: calc(var(--slide-unit) * 5);
      }
      .section-content h1,
      .section-content h2,
      .section-content h3 {
        color: var(--light-body-text, #fff);
      }
      
      /* ============================================
         LAYOUT: DEFAULT & COLUMN LAYOUTS
         Uses slot-header + slot-columns positioning
         ============================================ */
      .layout-default,
      .layout-1-column,
      .layout-2-columns,
      .layout-3-columns,
      .layout-2-columns-1\\+2,
      .layout-2-columns-2\\+1 {
        /* Container for slot-based layouts */
      }
      
      /* ============================================
         LAYOUT: FULL-IMAGE
         ============================================ */
      .image-container .slide-content {
        left: 0;
        right: 0;
        padding: calc(var(--content-width, 5) * var(--slide-unit));
      }
      .layout-full-image { 
        padding: 0; 
        flex-direction: row; 
      }
      .layout-full-image .image-slot { flex: 1; height: 100%; }
      .layout-full-image .image-slot img { width: 100%; height: 100%; object-fit: cover; }
      
      /* ============================================
         LAYOUT: CAPTION
         ============================================ */
      .layout-caption { padding: 0; }
      .caption-container .slide-body { 
        position: absolute;
        top: 0; left: 0; right: 0; bottom: 0;
        display: flex;
        flex-direction: column;
      }
      .layout-caption .slot-title-bar { 
        height: calc(var(--slide-unit) * 5); 
        padding: 0 calc(var(--slide-unit) * 2); 
        background: var(--light-background, #fff);
        display: flex;
        align-items: center;
        justify-content: flex-start;
        flex-shrink: 0;
        margin: 0;
      }
      .layout-caption .slot-title-bar h1,
      .layout-caption .slot-title-bar h2,
      .layout-caption .slot-title-bar h3,
      .layout-caption .slot-title-bar h4,
      .layout-caption .slot-title-bar h5,
      .layout-caption .slot-title-bar h6 {
        font-size: calc(var(--slide-unit) * 2.5 * var(--title-font-scale, 1) * var(--font-scale, 1));
        margin: 0;
        line-height: 1.2;
      }
      .layout-caption .slot-image { 
        flex: 1; 
        display: flex; 
        min-height: 0; 
        overflow: hidden;
        position: relative;
      }
      .layout-caption .slot-image .image-slot {
        position: absolute;
        top: 0; left: 0; right: 0; bottom: 0;
      }
      .layout-caption .slot-image img { 
        width: 100%; 
        height: 100%; 
        object-fit: cover; 
        display: block;
      }
      .layout-caption .slot-caption { 
        padding: calc(var(--slide-unit) * 1) calc(var(--slide-unit) * 2); 
        text-align: center; 
        font-size: calc(var(--slide-unit) * 2 * var(--body-font-scale, 1) * var(--font-scale, 1)); 
        background: var(--light-background, #fff);
        flex-shrink: 0;
      }
      
      .caption-container .slide-header,
      .caption-container .slide-footer {
        display: none;
      }
      
      /* ============================================
         LAYOUT: HALF-IMAGE (Vertical Split)
         ============================================ */
      .split-container .slide-body,
      .split-horizontal-container .slide-body {
        position: absolute;
        top: 0; left: 0; right: 0; bottom: 0;
        display: flex;
        overflow: hidden;
      }
      
      .split-container .slide-body {
        flex-direction: row;
      }
      .split-container.image-right .slide-body {
        flex-direction: row-reverse;
      }
      
      .split-horizontal-container .slide-body {
        flex-direction: column;
      }
      .split-horizontal-container.image-bottom .slide-body {
        flex-direction: column-reverse;
      }
      
      .half-image-panel {
        flex: 1;
        min-width: 0;
        min-height: 0;
        overflow: hidden;
        position: relative;
      }
      .half-image-panel img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      
      .half-content-panel {
        flex: 1;
        min-width: 0;
        min-height: 0;
        display: flex;
        flex-direction: column;
        padding: calc(var(--slide-unit) * 4);
        overflow: hidden;
        position: relative;
      }
      .half-content-panel .slide-header {
        position: relative;
        top: auto;
        left: auto;
        right: auto;
        font-size: calc(var(--slide-unit) * 1.5 * var(--header-font-scale, 1) * var(--font-scale, 1));
        margin-bottom: calc(var(--slide-unit) * 1);
      }
      .half-content-panel .slide-footer {
        position: relative;
        bottom: auto;
        left: auto;
        right: auto;
        font-size: calc(var(--slide-unit) * 1.5 * var(--footer-font-scale, 1) * var(--font-scale, 1));
        margin-top: auto;
      }
      .half-content-panel .slide-body {
        position: relative;
        flex: 1;
        display: flex;
        flex-direction: column;
        justify-content: center;
        gap: calc(var(--slide-unit) * 1);
      }
      
      /* Hide main slide header/footer in split layouts */
      .split-container > .slide-header,
      .split-container > .slide-footer,
      .split-horizontal-container > .slide-header,
      .split-horizontal-container > .slide-footer {
        display: none;
      }
    `;
  }

  private getBaseStyles(context: 'thumbnail' | 'preview' | 'presentation' = 'thumbnail'): string {
    const containerClass = context === 'thumbnail' ? 'perspecta-thumbnail' : 'perspecta-preview';

    return `
      * { margin: 0; padding: 0; box-sizing: border-box; }
      :root {
        --slide-unit: min(1vh, 1.778vw);
      }
      html, body { 
        width: 100%; 
        height: 100%; 
        font-family: var(--body-font, system-ui, -apple-system, sans-serif);
        overflow: hidden;
      }
      .${containerClass} { 
        background: var(--light-background);
        width: 100%;
        height: 100%;
      }
      
      ${this.getSlideCSS()}
    `;
  }

  private renderStyles(frontmatter: PresentationFrontmatter): string {
    const cssVars = this.generateCSSVariables(frontmatter);
    const themeCSS = this.theme ? generateThemeCSS(this.theme, 'export') : '';

    return `<style>
/* Custom Fonts */
${this.customFontCSS}

${themeCSS}
:root {
${cssVars}
  --slide-unit: min(1vh, 1.778vw);
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body {
  width: 100%;
  height: 100%;
  font-family: var(--body-font, system-ui, -apple-system, sans-serif);
  background: var(--light-background, #000);
  color: var(--light-body-text, #fff);
}

.reveal {
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.slides {
  width: 100%;
  height: 100%;
  position: relative;
}

${this.getSlideCSS()}

/* Presentation-specific: slide transitions */
.slide {
  position: absolute;
  top: 0;
  left: 0;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.4s ease, transform 0.4s ease, visibility 0s 0.4s;
}

.slide.active {
  opacity: 1;
  visibility: visible;
  transition: opacity 0.4s ease, transform 0.4s ease, visibility 0s 0s;
}

/* Transitions */
.transition-none .slide { transition: none; }
.transition-fade .slide { transform: none; }
.transition-slide .slide { transform: translateX(100%); }
.transition-slide .slide.active { transform: translateX(0); }
.transition-slide .slide.prev { transform: translateX(-100%); }

/* Progress bar */
.progress-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  width: 100%;
  height: calc(var(--slide-unit) * 0.5);
  background: rgba(0, 0, 0, 0.1);
  z-index: 100;
}

.progress-bar-fill {
  height: 100%;
  background: var(--accent1, #007acc);
  transition: width 0.3s ease;
}

/* Slide numbers */
.slide-number {
  position: fixed;
  bottom: calc(var(--slide-unit) * 2);
  right: calc(var(--slide-unit) * 2);
  font-size: calc(var(--slide-unit) * 1.5);
  opacity: 0.5;
  z-index: 100;
}
</style>`;
  }

  private generateCSSVariables(frontmatter: PresentationFrontmatter): string {
    const vars: string[] = [];

    // Fonts
    if (frontmatter.titleFont) {
      vars.push(`  --title-font: '${frontmatter.titleFont}', sans-serif;`);
    }
    if (frontmatter.titleFontWeight !== undefined) {
      vars.push(`  --title-font-weight: ${frontmatter.titleFontWeight};`);
    }
    if (frontmatter.bodyFont) {
      vars.push(`  --body-font: '${frontmatter.bodyFont}', sans-serif;`);
    }
    if (frontmatter.bodyFontWeight !== undefined) {
      vars.push(`  --body-font-weight: ${frontmatter.bodyFontWeight};`);
    }
    if (frontmatter.headerFont) {
      vars.push(`  --header-font: '${frontmatter.headerFont}', sans-serif;`);
    }
    if (frontmatter.headerFontWeight !== undefined) {
      vars.push(`  --header-font-weight: ${frontmatter.headerFontWeight};`);
    }
    if (frontmatter.footerFont) {
      vars.push(`  --footer-font: '${frontmatter.footerFont}', sans-serif;`);
    }
    if (frontmatter.footerFontWeight !== undefined) {
      vars.push(`  --footer-font-weight: ${frontmatter.footerFontWeight};`);
    }

    // Font sizes (as scale factors, convert from % offset)
    if (frontmatter.titleFontSize !== undefined) {
      const scale = 1 + (frontmatter.titleFontSize / 100);
      vars.push(`  --title-font-scale: ${scale};`);
    }
    if (frontmatter.bodyFontSize !== undefined) {
      const scale = 1 + (frontmatter.bodyFontSize / 100);
      vars.push(`  --body-font-scale: ${scale};`);
    }
    if (frontmatter.headerFontSize !== undefined) {
      const scale = 1 + (frontmatter.headerFontSize / 100);
      vars.push(`  --header-font-scale: ${scale};`);
    }
    if (frontmatter.footerFontSize !== undefined) {
      const scale = 1 + (frontmatter.footerFontSize / 100);
      vars.push(`  --footer-font-scale: ${scale};`);
    }

    // Legacy font size offset (affects all text)
    if (frontmatter.fontSizeOffset !== undefined) {
      const scale = 1 + (frontmatter.fontSizeOffset / 100);
      vars.push(`  --font-scale: ${scale};`);
    }

    // Spacing (unitless, will be multiplied by --slide-unit in CSS)
    if (frontmatter.headlineSpacingBefore !== undefined) vars.push(`  --headline-spacing-before: ${frontmatter.headlineSpacingBefore};`);
    if (frontmatter.headlineSpacingAfter !== undefined) vars.push(`  --headline-spacing-after: ${frontmatter.headlineSpacingAfter};`);
    if (frontmatter.listItemSpacing !== undefined) vars.push(`  --list-item-spacing: ${frontmatter.listItemSpacing};`);
    if (frontmatter.lineHeight !== undefined) vars.push(`  --line-height: ${frontmatter.lineHeight};`);

    // Margins (unitless, absolute distance from slide edge in slide units)
    // These will be multiplied by --slide-unit in CSS for proper scaling
    if (frontmatter.headerTop !== undefined) vars.push(`  --header-top: ${frontmatter.headerTop};`);
    if (frontmatter.footerBottom !== undefined) vars.push(`  --footer-bottom: ${frontmatter.footerBottom};`);
    if (frontmatter.titleTop !== undefined) vars.push(`  --title-top: ${frontmatter.titleTop};`);
    if (frontmatter.contentTop !== undefined) vars.push(`  --content-top: ${frontmatter.contentTop};`);
    if (frontmatter.contentWidth !== undefined) vars.push(`  --content-width: ${frontmatter.contentWidth};`);

    if (frontmatter.accent1) vars.push(`  --accent1: ${frontmatter.accent1};`);
    if (frontmatter.accent2) vars.push(`  --accent2: ${frontmatter.accent2};`);
    if (frontmatter.accent3) vars.push(`  --accent3: ${frontmatter.accent3};`);
    if (frontmatter.accent4) vars.push(`  --accent4: ${frontmatter.accent4};`);
    if (frontmatter.accent5) vars.push(`  --accent5: ${frontmatter.accent5};`);
    if (frontmatter.accent6) vars.push(`  --accent6: ${frontmatter.accent6};`);

    if (frontmatter.lightBackground) vars.push(`  --light-background: ${frontmatter.lightBackground};`);
    if (frontmatter.darkBackground) vars.push(`  --dark-background: ${frontmatter.darkBackground};`);
    if (frontmatter.lightTitleText) vars.push(`  --light-title-text: ${frontmatter.lightTitleText};`);
    if (frontmatter.darkTitleText) vars.push(`  --dark-title-text: ${frontmatter.darkTitleText};`);
    if (frontmatter.lightBodyText) vars.push(`  --light-body-text: ${frontmatter.lightBodyText};`);
    if (frontmatter.darkBodyText) vars.push(`  --dark-body-text: ${frontmatter.darkBodyText};`);

    // Per-heading colors (can be gradient if array has 2 elements)
    const colorOrGradient = (colors: string[]): string => {
      if (colors.length === 1) return colors[0];
      return `linear-gradient(to right, ${colors.join(', ')})`;
    };

    if (frontmatter.lightH1Color?.length) vars.push(`  --light-h1-color: ${colorOrGradient(frontmatter.lightH1Color)};`);
    if (frontmatter.lightH2Color?.length) vars.push(`  --light-h2-color: ${colorOrGradient(frontmatter.lightH2Color)};`);
    if (frontmatter.lightH3Color?.length) vars.push(`  --light-h3-color: ${colorOrGradient(frontmatter.lightH3Color)};`);
    if (frontmatter.lightH4Color?.length) vars.push(`  --light-h4-color: ${colorOrGradient(frontmatter.lightH4Color)};`);
    if (frontmatter.darkH1Color?.length) vars.push(`  --dark-h1-color: ${colorOrGradient(frontmatter.darkH1Color)};`);
    if (frontmatter.darkH2Color?.length) vars.push(`  --dark-h2-color: ${colorOrGradient(frontmatter.darkH2Color)};`);
    if (frontmatter.darkH3Color?.length) vars.push(`  --dark-h3-color: ${colorOrGradient(frontmatter.darkH3Color)};`);
    if (frontmatter.darkH4Color?.length) vars.push(`  --dark-h4-color: ${colorOrGradient(frontmatter.darkH4Color)};`);

    // Header/Footer text colors
    if (frontmatter.lightHeaderText) vars.push(`  --light-header-text: ${frontmatter.lightHeaderText};`);
    if (frontmatter.lightFooterText) vars.push(`  --light-footer-text: ${frontmatter.lightFooterText};`);
    if (frontmatter.darkHeaderText) vars.push(`  --dark-header-text: ${frontmatter.darkHeaderText};`);
    if (frontmatter.darkFooterText) vars.push(`  --dark-footer-text: ${frontmatter.darkFooterText};`);

    // Layout-specific backgrounds
    if (frontmatter.lightBgCover) vars.push(`  --light-bg-cover: ${frontmatter.lightBgCover};`);
    if (frontmatter.lightBgTitle) vars.push(`  --light-bg-title: ${frontmatter.lightBgTitle};`);
    if (frontmatter.lightBgSection) vars.push(`  --light-bg-section: ${frontmatter.lightBgSection};`);
    if (frontmatter.darkBgCover) vars.push(`  --dark-bg-cover: ${frontmatter.darkBgCover};`);
    if (frontmatter.darkBgTitle) vars.push(`  --dark-bg-title: ${frontmatter.darkBgTitle};`);
    if (frontmatter.darkBgSection) vars.push(`  --dark-bg-section: ${frontmatter.darkBgSection};`);

    if (frontmatter.lightDynamicBackground) {
      vars.push(`  --light-bg-gradient: ${frontmatter.lightDynamicBackground.join(', ')};`);
    }
    if (frontmatter.darkDynamicBackground) {
      vars.push(`  --dark-bg-gradient: ${frontmatter.darkDynamicBackground.join(', ')};`);
    }

    return vars.join('\n');
  }

  // ============================================
  // SCRIPTS
  // ============================================

  private renderScripts(): string {
    return `<script>
  (function () {
    let currentSlide = 0;
    const slides = document.querySelectorAll('.slide');
    const totalSlides = slides.length;

    function showSlide(index) {
      if (index < 0) index = 0;
      if (index >= totalSlides) index = totalSlides-1;

      slides.forEach((slide, i) => {
        slide.classList.remove('active', 'prev');
        if (i === index) {
          slide.classList.add('active');
        } else if (i < index) {
          slide.classList.add('prev');
        }
      });

      currentSlide = index;
      updateProgress();
    }

    function updateProgress() {
      const progress = document.querySelector('.progress-bar');
      if (progress) {
        progress.style.width = ((currentSlide + 1) / totalSlides * 100) + '%';
      }
    }

    function nextSlide() { showSlide(currentSlide + 1); }
    function prevSlide() { showSlide(currentSlide-1); }

    document.addEventListener('keydown', function (e) {
      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
        case ' ':
        case 'PageDown':
          e.preventDefault();
          nextSlide();
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
        case 'PageUp':
          e.preventDefault();
          prevSlide();
          break;
        case 'Home':
          e.preventDefault();
          showSlide(0);
          break;
        case 'End':
          e.preventDefault();
          showSlide(totalSlides-1);
          break;
      }
    });

    document.addEventListener('click', function (e) {
      if (e.clientX > window.innerWidth / 2) {
        nextSlide();
      } else {
        prevSlide();
      }
    });

    // Add progress bar
    const progressBar = document.createElement('div');
    progressBar.className = 'progress-bar';
    document.body.appendChild(progressBar);
    updateProgress();

    showSlide(0);
  })();
</script>`;
  }

  // ============================================
  // PRESENTER VIEW
  // ============================================

  renderPresenterHTML(): string {
    const { frontmatter, slides } = this.presentation;

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Presenter View-${this.escapeHtml(frontmatter.title || 'Presentation')}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: 100%; height: 100%;
      font-family: system-ui, -apple-system, sans-serif;
      background: #1a1a2e; color: #eee;
      overflow: hidden;
    }
    .presenter-view {
      display: grid;
      grid-template-columns: 2fr 1fr;
      grid-template-rows: 1fr auto;
      gap: 16px; padding: 16px;
      height: 100vh;
    }
    .current-slide-container {
      background: #000; border-radius: 8px;
      overflow: hidden; display: flex;
      align-items: center; justify-content: center;
    }
    .current-slide-frame { width: 100%; height: 100%; border: none; }
    .side-panel { display: flex; flex-direction: column; gap: 16px; }
    .next-slide-container {
      background: #16213e; border-radius: 8px;
      padding: 12px; flex: 0 0 auto;
    }
    .next-slide-container h3 {
      font-size: 12px; text-transform: uppercase;
      letter-spacing: 0.1em; color: #888; margin-bottom: 8px;
    }
    .next-slide-preview {
      background: #000; border-radius: 4px;
      aspect-ratio: 16/9; overflow: hidden;
    }
    .next-slide-preview iframe { width: 100%; height: 100%; border: none; pointer-events: none; }
    .notes-container {
      background: #16213e; border-radius: 8px;
      padding: 16px; flex: 1; overflow-y: auto;
    }
    .notes-container h3 {
      font-size: 12px; text-transform: uppercase;
      letter-spacing: 0.1em; color: #888; margin-bottom: 12px;
    }
    .notes-content { font-size: 18px; line-height: 1.6; }
    .notes-content p { margin-bottom: 1em; }
    .controls {
      grid-column: 1 / -1;
      display: flex; justify-content: space-between; align-items: center;
      background: #16213e; border-radius: 8px; padding: 12px 24px;
    }
    .slide-counter { font-size: 24px; font-weight: 600; }
    .timer { font-size: 32px; font-family: monospace; font-weight: 600; }
    .nav-buttons { display: flex; gap: 12px; }
    .nav-btn {
      background: #0f3460; border: none; color: white;
      padding: 12px 24px; border-radius: 6px;
      font-size: 16px; cursor: pointer; transition: background 0.2s;
    }
    .nav-btn:hover { background: #1a4b8c; }
    .nav-btn.primary { background: #e94560; }
    .nav-btn.primary:hover { background: #ff6b8a; }
  </style>
</head>
<body>
  <div class="presenter-view">
    <div class="current-slide-container">
      <iframe id="current-slide-frame" class="current-slide-frame" srcdoc=""></iframe>
    </div>
    <div class="side-panel">
      <div class="next-slide-container">
        <h3>Next Slide</h3>
        <div class="next-slide-preview">
          <iframe id="next-slide-frame" srcdoc=""></iframe>
        </div>
      </div>
      <div class="notes-container">
        <h3>Speaker Notes</h3>
        <div id="notes-content" class="notes-content">
          <p>No notes for this slide.</p>
        </div>
      </div>
    </div>
    <div class="controls">
      <div class="slide-counter">
        <span id="current-slide-num">1</span> / <span id="total-slides">${slides.length}</span>
      </div>
      <div class="timer" id="timer">00:00:00</div>
      <div class="nav-buttons">
        <button class="nav-btn" onclick="prevSlide()">← Previous</button>
        <button class="nav-btn primary" onclick="nextSlide()">Next →</button>
      </div>
    </div>
  </div>
  <script>
    const slidesData = ${JSON.stringify(slides.map((s, i) => ({
      index: i,
      notes: s.speakerNotes,
      html: this.renderSingleSlideHTML(s, i, frontmatter)
    })))};
    
    let currentSlide = 0;
    const totalSlides = slidesData.length;
    let startTime = Date.now();
    
    function showSlide(index) {
      if (index < 0) index = 0;
      if (index >= totalSlides) index = totalSlides-1;
      currentSlide = index;
      
      document.getElementById('current-slide-frame').srcdoc = slidesData[index].html;
      document.getElementById('current-slide-num').textContent = index + 1;
      
      const nextIndex = index + 1 < totalSlides ? index + 1 : index;
      document.getElementById('next-slide-frame').srcdoc = slidesData[nextIndex].html;
      
      const notes = slidesData[index].notes;
      const notesEl = document.getElementById('notes-content');
      if (notes && notes.length > 0) {
        notesEl.innerHTML = notes.map(n => '<p>' + n + '</p>').join('');
      } else {
        notesEl.innerHTML = '<p>No notes for this slide.</p>';
      }
    }
    
    function nextSlide() { showSlide(currentSlide + 1); }
    function prevSlide() { showSlide(currentSlide-1); }
    
    document.addEventListener('keydown', function(e) {
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); nextSlide(); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); prevSlide(); }
    });
    
    setInterval(function() {
      const elapsed = Math.floor((Date.now()-startTime) / 1000);
      const h = Math.floor(elapsed / 3600);
      const m = Math.floor((elapsed% 3600) / 60);
      const s = elapsed% 60;
      document.getElementById('timer').textContent = 
        String(h).padStart(2, '0') + ':' + 
        String(m).padStart(2, '0') + ':' + 
        String(s).padStart(2, '0');
    }, 1000);
    
    showSlide(0);
  </script>
</body>
</html>`;
  }

  /**
   * Render slide thumbnail (simple version for lists)
   */
  renderSlideThumbnail(slide: Slide): string {
    const mode = slide.metadata.mode || 'light';
    const layout = slide.metadata.layout || 'default';

    return `
    <div class="slide-thumbnail ${mode} layout-${layout}">
      <div class="slide-content">
        ${this.renderSlideContent(slide, layout)}
      </div>
    </div>`;
  }
}
