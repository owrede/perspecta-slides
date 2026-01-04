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

    // Handle background from metadata
    let backgroundStyle = '';
    if (slide.metadata.background) {
      const opacity = slide.metadata.backgroundOpacity ?? 1;
      backgroundStyle = `background-image: url('${slide.metadata.background}'); background-size: cover; background-position: center;`;
      if (opacity < 1) {
        backgroundStyle += ` opacity: ${opacity};`;
      }
    }

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
      return this.renderHalfImageSlide(slide, index, frontmatter, layout, modeClass, containerClass, customClass, isActive, backgroundStyle, renderSpeakerNotes, dynamicBgColor);
    }

    // Generate overlay if configured
    const overlayHtml = this.renderOverlay(frontmatter);

    return `
    <section class="slide ${containerClass} ${modeClass} ${customClass} ${isActive}" data-index="${index}"${slideInlineStyle ? ` style="${slideInlineStyle}"` : ''}>
      ${backgroundStyle ? `<div class="slide-background" style="${backgroundStyle}"></div>` : ''}
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
    backgroundStyle: string,
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
      ${backgroundStyle ? `<div class="slide-background" style="${backgroundStyle}"></div>` : ''}
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
   */
  private renderCoverLayout(elements: SlideElement[]): string {
    return elements.map(e => this.renderElement(e)).join('\n');
  }

  /**
   * Title Layout: Centered content with large headings
   */
  private renderTitleLayout(elements: SlideElement[]): string {
    return elements.map(e => this.renderElement(e)).join('\n');
  }

  /**
   * Section Layout: Accent background, centered heading
   */
  private renderSectionLayout(elements: SlideElement[]): string {
    return elements.map(e => this.renderElement(e)).join('\n');
  }

  /**
   * Default Layout: Auto-detects columns based on columnIndex
   */
  private renderDefaultLayout(elements: SlideElement[]): string {
    const columnElements = elements.filter(e => e.columnIndex !== undefined);
    const nonColumnElements = elements.filter(e => e.columnIndex === undefined);

    // If no column elements, render as single column
    if (columnElements.length === 0) {
      return elements.map(e => this.renderElement(e)).join('\n');
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

    // If no column elements, distribute non-column body elements
    if (columnElements.length === 0) {
      const bodyElements = nonColumnElements.filter(e =>
        e.type !== 'heading' && e.type !== 'kicker');
      const headerElements = nonColumnElements.filter(e =>
        e.type === 'heading' || e.type === 'kicker');

      return `
        <div class="slide-content column-content">
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
          </div>
        </div>`;
    }

    return `
      <div class="slide-content column-content">
        <div class="slot-header">
          ${nonColumnElements.map(e => this.renderElement(e)).join('\n')}
        </div>
        <div class="slot-columns columns-${columnCount} ratio-${ratio}">
          ${columns.map((col, i) => `
            <div class="column" data-column="${i + 1}">
              ${col.map(e => this.renderElement(e)).join('\n')}
            </div>
          `).join('\n')}
        </div>
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

  private renderOverlay(frontmatter: PresentationFrontmatter): string {
    if (!frontmatter.imageOverlay) {
      return '';
    }

    const opacity = (frontmatter.imageOverlayOpacity ?? 50) / 100;
    let imagePath = frontmatter.imageOverlay;

    // Resolve image path if resolver available
    if (this.resolveImagePath) {
      imagePath = this.resolveImagePath(imagePath, false);
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

  private getBaseStyles(context: 'thumbnail' | 'preview' | 'presentation' = 'thumbnail'): string {
    // Different scaling for thumbnails vs preview
    let slideUnit: string;
    let containerClass: string;

    if (context === 'thumbnail') {
      // For thumbnails: use the same viewport-based calculation as preview
      // This ensures proportional scaling relative to slide size
      slideUnit = 'min(1vh, 1.778vw)';
      containerClass = 'perspecta-thumbnail';
    } else {
      // For preview: use viewport-based units for proper slide scaling
      slideUnit = 'min(1vh, 1.778vw)';
      containerClass = 'perspecta-preview';
    }

    return `
      * { margin: 0; padding: 0; box-sizing: border-box; }
      :root {
        /* Context-dependent slide unit */
        --slide-unit: ${slideUnit};
      }
      html, body { 
        width: 100%; height: 100%; 
        font-family: var(--body-font, system-ui, -apple-system, sans-serif);
        overflow: hidden;
      }
      .${containerClass} { 
        background: var(--light-background);
        width: 100%;
        height: 100%;
      }
      
      /* Slide Base */
      .slide { 
        width: 100%; height: 100%; 
        display: flex; flex-direction: column;
        padding: 5%;
        position: relative;
      }
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
        .slide.system-mode h5, .slide.system-mode h6 {
          color: var(--dark-title-text);
        }
      }
      
      /* Background */
      .slide-background, .slide-image-background {
        position: absolute;
        top: 0; left: 0; right: 0; bottom: 0;
        z-index: 0;
        overflow: hidden;
      }
      .slide-image-background img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      /* Image overlay layer */
      .slide-overlay {
        position: absolute;
        top: 0; left: 0; right: 0; bottom: 0;
        z-index: 1;
        pointer-events: none;
        background-size: cover;
        background-position: center;
        background-repeat: no-repeat;
      }
      
      /* Dual image layout: responsive based on orientation */
      .slide-image-background.dual-image {
        display: flex;
        flex-direction: row; /* Default: side-by-side for landscape */
      }
      .slide-image-background.dual-image .image-panel {
        flex: 1;
        overflow: hidden;
        min-width: 0;
        min-height: 0;
      }
      /* Portrait orientation: stack vertically */
      @media (orientation: portrait), (max-aspect-ratio: 1/1) {
        .slide-image-background.dual-image {
          flex-direction: column;
        }
      }
      
      /* Three images: side-by-side in thirds (landscape), stacked in portrait */
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
        .slide-image-background.multi-image.count-3 {
          flex-direction: column;
        }
      }
      
      /* Four images: 2x2 grid */
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
      
      /* Five images: 2 on top, 3 on bottom */
      .slide-image-background.multi-image.count-5 {
        display: grid;
        grid-template-columns: repeat(6, 1fr);
        grid-template-rows: 1fr 1fr;
      }
      .slide-image-background.multi-image.count-5 .image-panel {
        overflow: hidden;
        min-width: 0;
        min-height: 0;
      }
      .slide-image-background.multi-image.count-5 .image-1 { grid-column: 1 / 4; grid-row: 1; }
      .slide-image-background.multi-image.count-5 .image-2 { grid-column: 4 / 7; grid-row: 1; }
      .slide-image-background.multi-image.count-5 .image-3 { grid-column: 1 / 3; grid-row: 2; }
      .slide-image-background.multi-image.count-5 .image-4 { grid-column: 3 / 5; grid-row: 2; }
      .slide-image-background.multi-image.count-5 .image-5 { grid-column: 5 / 7; grid-row: 2; }
      
      /* Six images: 3x2 grid */
      .slide-image-background.multi-image.count-6 {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        grid-template-rows: 1fr 1fr;
      }
      .slide-image-background.multi-image.count-6 .image-panel {
        overflow: hidden;
        min-width: 0;
        min-height: 0;
      }
      
      /* Seven+ images: flexible grid */
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
      
      .slide-body { flex: 1; display: flex; flex-direction: column; position: relative; z-index: 1; min-height: 0; }
      .slide-content { flex: 1; display: flex; flex-direction: column; gap: calc(var(--slide-unit) * 1.5); }
      
      /* Typography-scaled dynamically based on container and font-scale offset */
      h1, h2, h3, h4, h5, h6 { 
        font-family: var(--title-font, system-ui, -apple-system, sans-serif);
        font-weight: 700; line-height: 1.15;
        margin-top: var(--headline-spacing-before, 0);
        margin-bottom: var(--headline-spacing-after, 0.25em);
      }
      h1 { font-size: calc(var(--slide-unit) * 7 * var(--font-scale, 1)); }
      h2 { font-size: calc(var(--slide-unit) * 5.5 * var(--font-scale, 1)); }
      h3 { font-size: calc(var(--slide-unit) * 4.5 * var(--font-scale, 1)); }
      h4 { font-size: calc(var(--slide-unit) * 3.5 * var(--font-scale, 1)); }
      h5 { font-size: calc(var(--slide-unit) * 3 * var(--font-scale, 1)); }
      h6 { font-size: calc(var(--slide-unit) * 2.5 * var(--font-scale, 1)); }
      p { font-size: calc(var(--slide-unit) * 2.8 * var(--font-scale, 1)); line-height: 1.4; }
      ul, ol { padding-left: 1.2em; font-size: calc(var(--slide-unit) * 2.8 * var(--font-scale, 1)); }
li { margin-bottom: var(--list-item-spacing, 0); }
      
      /* Kicker */
      .kicker { 
        font-size: calc(var(--slide-unit) * 1.8 * var(--font-scale, 1)); 
        text-transform: uppercase; 
        letter-spacing: 0.08em; 
        opacity: 0.7; 
      }
      
      /* Images in content areas (columns, default layout, etc.) */
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
      /* When size: contain is used, center the image */
      .image-figure img[style*="contain"] {
        margin: 0 auto;
      }
      
      /* Slots */
      .slot-header { margin-bottom: calc(var(--slide-unit) * 1); }
      .slot-columns { 
        display: flex; 
        flex-direction: row;
        gap: calc(var(--slide-unit) * 2); 
        flex: 1; 
        align-items: stretch; 
        width: 100%; 
        min-height: 0;
        overflow: hidden;
        margin-top: var(--content-top-offset, 0);
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
      .slot-columns.columns-3 { gap: calc(var(--slide-unit) * 5) !important; }
      .slot-columns.columns-3 .column { min-width: 0; }
      .slot-columns.ratio-narrow-wide .column[data-column="1"] { flex: 1; }
      .slot-columns.ratio-narrow-wide .column[data-column="2"] { flex: 2; }
      .slot-columns.ratio-wide-narrow .column[data-column="1"] { flex: 2; }
      .slot-columns.ratio-wide-narrow .column[data-column="2"] { flex: 1; }
      
      /* Layout: Cover */
      .layout-cover { justify-content: center; align-items: center; text-align: center; }
      .layout-cover h1 { font-size: calc(var(--slide-unit) * 9 * var(--font-scale, 1)); }
      
      /* Layout: Title */
      .layout-title { justify-content: center; align-items: center; text-align: center; }
      .layout-title h1 { font-size: calc(var(--slide-unit) * 9 * var(--font-scale, 1)); }
      .layout-title h2 { font-size: calc(var(--slide-unit) * 7 * var(--font-scale, 1)); }
      
      /* Layout: Section */
      .section-container .slide-body { 
        background: var(--accent1, #1a1a2e); color: var(--light-body-text, #fff);
        margin: -5%; padding: 5%;
      }
      .layout-section { justify-content: center; align-items: center; text-align: center; }
      
      /* Layout: Default */
      .layout-default { align-items: flex-start; }
      
      /* Layout: Image */
      .layout-full-image { padding: 0; flex-direction: row; }
      .layout-full-image .image-slot { flex: 1; height: 100%; }
      .layout-full-image .image-slot img { width: 100%; height: 100%; object-fit: cover; }
      
      .layout-caption { padding: 0; }
      .caption-container.slide { padding: 0; }
      .caption-container .slide-body { margin: 0; }
      .layout-caption .slot-title-bar { 
        height: calc(var(--slide-unit) * 4 * var(--font-scale, 1)); 
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
        font-size: calc(var(--slide-unit) * 2.5 * var(--font-scale, 1));
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
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
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
        font-size: calc(var(--slide-unit) * 2 * var(--font-scale, 1)); 
        background: var(--light-background, #fff);
        flex-shrink: 0;
      }
      
      /* Hide standard header/footer in caption layout */
      .caption-container .slide-header,
      .caption-container .slide-footer {
        display: none;
      }
      
      /* ============================================
         HALF-IMAGE LAYOUTS
         Split slide into two halves:
        -Image half: edge-to-edge full-bleed
        -Content half: normal slide with header/footer/padding
         ============================================ */
      
      /* Base split layout-remove default padding */
      .split-container.slide,
      .split-horizontal-container.slide {
        padding: 0;
        display: flex;
        overflow: hidden;
      }
      
      /* Vertical split (left/right) */
      .split-container.slide.split-vertical {
        flex-direction: row;
      }
      .split-container.slide.split-vertical.image-right {
        flex-direction: row-reverse;
      }
      
      /* Horizontal split (top/bottom) */
      .split-horizontal-container.slide.split-horizontal {
        flex-direction: column;
      }
      .split-horizontal-container.slide.split-horizontal.image-bottom {
        flex-direction: column-reverse;
      }
      
      /* Image panel-edge-to-edge, exactly 50% */
      .half-image-panel {
        flex: 0 0 50%;
        width: 50%;
        height: 100%;
        overflow: hidden;
        display: flex;
      }
      .split-horizontal .half-image-panel {
        width: 100%;
        height: 50%;
      }
      .half-image-panel img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .half-image-panel .image-slot {
        flex: 1;
        min-width: 0;
        min-height: 0;
        overflow: hidden;
      }
      
      /* Content panel-exactly 50% */
      .half-content-panel {
        flex: 0 0 50%;
        width: 50%;
        height: 100%;
        display: flex;
        flex-direction: column;
        padding: 5%;
        overflow: hidden;
      }
      .split-horizontal .half-content-panel {
        width: 100%;
        height: 50%;
      }
      .half-content-panel.light {
        background: var(--light-background);
        color: var(--light-body-text);
      }
      .half-content-panel.dark {
        background: var(--dark-background);
        color: var(--dark-body-text);
      }
      
      /* Content panel internal structure */
      .half-content-panel .slide-header {
        margin-left: 0;
        margin-right: 0;
        margin-top: 0;
        padding-left: 0;
        padding-right: 0;
      }
      .half-content-panel .slide-footer {
        margin-left: 0;
        margin-right: 0;
        margin-bottom: 0;
        padding-left: 0;
        padding-right: 0;
      }
      .half-content-panel .slide-body {
        flex: 1;
        display: flex;
        flex-direction: column;
        min-height: 0;
      }
      .half-content-panel .slide-content {
        flex: 1;
        display: flex;
        flex-direction: column;
        justify-content: center;
        gap: calc(var(--slide-unit) * 1);
      }
      
      /* Header/Footer */
      .slide-header, .slide-footer { 
        display: flex; 
        justify-content: space-between; 
        position: relative;
        z-index: 2;
        margin-left: -2.5%;
        margin-right: -2.5%;
        padding-left: 2.5%;
        padding-right: 2.5%;
      }
      .slide-header { 
        font-size: calc(var(--slide-unit) * 1.5 * var(--font-scale, 1) * var(--header-font-size, 1));
        align-items: flex-start; 
        margin-top: -2.5%;
        padding-top: 1%;
        margin-bottom: calc(var(--slide-unit) * 2);
      }
      .slide-footer { 
        font-size: calc(var(--slide-unit) * 1.5 * var(--font-scale, 1) * var(--footer-font-size, 1));
        align-items: flex-end; 
        margin-bottom: -2.5%;
        padding-bottom: 1%;
        margin-top: 1.5em;
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
        border-radius: 0.5em;
        color: #fff;
      }
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
  /* Dynamic base unit: uses the constraining dimension (height in landscape, width in portrait) */
  /* For 16:9 slides: 1vh when height-constrained, ~1.778vw when width-constrained */
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
  background: var(--background-color, var(--light-background, #000));
  color: var(--body-text-color, var(--dark-body-text, #fff));
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

/* Slide Base */
.slide {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 5%;
  position: absolute;
  top: 0;
  left: 0;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.4s ease, transform 0.4s ease, visibility 0s 0.4s;
  font-family: var(--body-font);
}

.slide h1, .slide h2, .slide h3, .slide h4, .slide h5, .slide h6 {
  font-family: var(--title-font);
  margin-top: var(--headline-spacing-before, 0);
  margin-bottom: var(--headline-spacing-after, 0);
}

.slide.active {
  opacity: 1;
  visibility: visible;
  transition: opacity 0.4s ease, transform 0.4s ease, visibility 0s 0s;
}

/* Transitions */
.transition-none.slide { transition: none; }
.transition-fade.slide { transform: none; }
.transition-slide.slide { transform: translateX(100%); }
.transition-slide.slide.active { transform: translateX(0); }
.transition-slide.slide.prev { transform: translateX(-100%); }

/* Color modes */
.slide.light {
  background: var(--light-background);
  color: var(--light-body-text);
}
.slide.light h1, .slide.light h2, .slide.light h3,
.slide.light h4, .slide.light h5, .slide.light h6 {
  color: var(--light-title-text);
}

.slide.dark {
  background: var(--dark-background);
  color: var(--dark-body-text);
}
.slide.dark h1, .slide.dark h2, .slide.dark h3,
.slide.dark h4, .slide.dark h5, .slide.dark h6 {
  color: var(--dark-title-text);
}

/* System mode: follows OS preference */
.slide.system-mode {
  background: var(--light-background);
  color: var(--light-body-text);
}
.slide.system-mode h1, .slide.system-mode h2, .slide.system-mode h3,
.slide.system-mode h4, .slide.system-mode h5, .slide.system-mode h6 {
  color: var(--light-title-text);
}
@media (prefers-color-scheme: dark) {
  .slide.system-mode {
    background: var(--dark-background);
    color: var(--dark-body-text);
  }
  .slide.system-mode h1, .slide.system-mode h2, .slide.system-mode h3,
  .slide.system-mode h4, .slide.system-mode h5, .slide.system-mode h6 {
    color: var(--dark-title-text);
  }
}

/* Slide structure */
.slide-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.slide-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: calc(var(--slide-unit) * 2);
  min-height: 0;
  overflow: hidden;
}

/* Header and Footer */
.slide-header, .slide-footer {
  display: flex;
  justify-content: space-between;
  position: relative;
  z-index: 2;
  margin-left: -2.5%;
  margin-right: -2.5%;
  padding-left: 2.5%;
  padding-right: 2.5%;
}
.slide-header {
  font-size: calc(var(--slide-unit) * 1.8 * var(--header-font-size, 1));
  align-items: flex-start;
  margin-top: -2.5%;
  padding-top: 1%;
}
.slide-footer {
  font-size: calc(var(--slide-unit) * 1.8 * var(--footer-font-size, 1));
  align-items: flex-end;
  margin-bottom: -2.5%;
  padding-bottom: 1%;
  margin-top: 1.5em;
}
.slide-header > div, .slide-footer > div { flex: 1; display: flex; }
.header-left, .footer-left { justify-content: flex-start; }
.header-middle, .footer-middle { justify-content: center; }
.header-right, .footer-right { justify-content: flex-end; }

/* Header/Footer in full-image layout: semi-transparent background */
.image-container.header-left > span,
.image-container.header-middle > span,
.image-container.header-right > span,
.image-container.footer-left > span,
.image-container.footer-middle > span,
.image-container.footer-right > span {
  background: rgba(0, 0, 0, 0.5);
  padding: calc(var(--slide-unit) * 0.5) calc(var(--slide-unit) * 1);
  border-radius: 0.5em;
  color: #fff;
}

/* Typography-scaled dynamically based on viewport */
h1, h2, h3, h4, h5, h6 {
  font-family: var(--title-font, system-ui, -apple-system, sans-serif);
  font-weight: 700;
  line-height: 1.15;
  margin-top: var(--headline-spacing-before, 0);
  margin-bottom: var(--headline-spacing-after, 0.4em);
}

h1 { font-size: calc(var(--slide-unit) * 7); }
h2 { font-size: calc(var(--slide-unit) * 5.5); }
h3 { font-size: calc(var(--slide-unit) * 4.5); }
h4 { font-size: calc(var(--slide-unit) * 3.5); }
h5 { font-size: calc(var(--slide-unit) * 3); }
h6 { font-size: calc(var(--slide-unit) * 2.5); }

p {
  font-size: calc(var(--slide-unit) * 2.8);
  line-height: 1.5;
  margin-bottom: 0.8em;
}

.kicker {
  font-size: calc(var(--slide-unit) * 1.8);
  text-transform: uppercase;
  letter-spacing: 0.12em;
  opacity: 0.7;
  margin-bottom: 0.5rem;
}

ul, ol {
  font-size: calc(var(--slide-unit) * 2.8);
  line-height: 1.6;
  padding-left: 1.5em;
}

li { margin-bottom: var(--list-item-spacing, 0); }

blockquote {
  font-size: calc(var(--slide-unit) * 3.2);
  font-style: italic;
  border-left: 4px solid var(--accent1, currentColor);
  padding-left: calc(var(--slide-unit) * 2);
  margin: calc(var(--slide-unit) * 1.5) 0;
}

img { max-width: 100%; max-height: 100%; object-fit: contain; }

figure { display: flex; flex-direction: column; align-items: center; gap: calc(var(--slide-unit) * 1); }

pre, code {
  font-family: 'SF Mono', 'Menlo', 'Monaco', 'Courier New', monospace;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 4px;
}

code { padding: 0.2em 0.4em; font-size: 0.9em; }

pre {
  padding: calc(var(--slide-unit) * 1.5);
  overflow-x: auto;
  font-size: calc(var(--slide-unit) * 2);
}

pre code { background: none; padding: 0; }

table { border-collapse: collapse; width: 100%; font-size: calc(var(--slide-unit) * 2.5); }
th, td { border: 1px solid rgba(0, 0, 0, 0.2); padding: calc(var(--slide-unit) * 1) calc(var(--slide-unit) * 1.5); text-align: left; }
th { background: rgba(0, 0, 0, 0.05); font-weight: 600; }

mark { background: var(--accent3, #f9c74f); padding: 0.1em 0.2em; }

/* ========================
   LAYOUT: SLOTS
   ======================== */

.slot-header {
  margin-bottom: calc(var(--slide-unit) * 2);
}

.slot-columns {
  display: flex;
  flex-direction: row;
  gap: calc(var(--slide-unit) * 4);
  flex: 1;
  align-items: stretch;
  min-height: 0;
  overflow: hidden;
}

.slot-columns.column {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
}

/* Column counts */
.slot-columns.columns-1 { flex-direction: column; }
.slot-columns.columns-1 .column { width: 100%; }
.slot-columns.columns-2, .slot-columns.columns-3 { flex-direction: row; }

/* Auto-detected columns: better widths for 3 columns */
.slot-columns.columns-3 {
  gap: calc(var(--slide-unit) * 5) !important; /* More gap for 3 columns */
}
.slot-columns.columns-3 .column {
  flex: 1;
  min-width: 0; /* Allow columns to shrink */
}

/* Column ratios (for 2-column layouts) */
.slot-columns.ratio-narrow-wide.column[data-column="1"] { flex: 1; }
.slot-columns.ratio-narrow-wide.column[data-column="2"] { flex: 2; }

.slot-columns.ratio-wide-narrow.column[data-column="1"] { flex: 2; }
.slot-columns.ratio-wide-narrow.column[data-column="2"] { flex: 1; }

/* ========================
   LAYOUT: COVER
   ======================== */

.layout-cover.slide-content {
  justify-content: center;
  align-items: center;
  text-align: center;
}

.layout-cover h1 { font-size: calc(var(--slide-unit) * 9); }
.layout-cover h2 { font-size: calc(var(--slide-unit) * 7); }

/* ========================
   LAYOUT: TITLE
   ======================== */

.layout-title.slide-content {
  justify-content: center;
  align-items: center;
  text-align: center;
}

.layout-title h1 { font-size: calc(var(--slide-unit) * 9); }
.layout-title h2 { font-size: calc(var(--slide-unit) * 7); }

/* ========================
   LAYOUT: SECTION
   ======================== */

.layout-section.slide-body {
  background: var(--accent1);
  color: var(--light-body-text);
  margin: -5%;
  padding: 5%;
}

.layout-section.slide-content {
  justify-content: center;
  align-items: center;
  text-align: center;
}

/* ========================
   LAYOUT: DEFAULT
   ======================== */

.layout -default .slide-content {
  align-items: flex-start;
}

/* ========================
   LAYOUT: TEXT COLUMNS
   ======================== */

.layout-1-column.slide-content,
.layout-2-columns.slide-content,
.layout-3-columns.slide-content,
.layout-2-columns-1\\+2 .slide-content,
.layout-2-columns-2\\+1 .slide-content {
  align-items: flex-start;
}

/* ========================
   LAYOUT: FULL IMAGE
   ======================== */

.layout-full-image {
  padding: 0!important;
}

.layout-full-image.slide-body {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
}

.layout-full-image.slide-content {
  padding: 0;
  margin: 0;
  width: 100%;
  height: 100%;
}

/* Single image-absolute positioning to fill entire slide */
.layout-full-image.full-image-content.single-image {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
}

.layout-full-image.full-image-content.single-image.image-slot {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.layout-full-image.full-image-content.single-image.image-slot img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* Multiple images-flexbox layout */
.layout-full-image.full-image-content.split-horizontal {
  display: flex;
  flex-direction: row;
  width: 100%;
  height: 100%;
}

.layout-full-image.full-image-content.split-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  grid-auto-rows: 1fr;
  width: 100%;
  height: 100%;
  gap: 0;
}

.layout-full-image.image-slot {
  flex: 1;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
}

.layout-full-image.image-slot img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

/* ========================
   LAYOUT: CAPTION
   ======================== */

.layout-caption {
  padding: 0!important;
}

.layout-caption.slide-body {
  margin: 0;
}

.layout-caption.slide-content {
  padding: 0;
}

.layout-caption.slot-title-bar {
  padding: calc(var(--slide-unit) * 2) 5%;
  background: rgba(0, 0, 0, 0.03);
}

.layout-caption.slot-image {
  flex: 1;
  display: flex;
  min-height: 0;
}

.layout-caption.slot-image.image-slot {
  flex: 1;
}

.layout-caption.slot-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.layout-caption.slot-caption {
  padding: calc(var(--slide-unit) * 1.5) 5%;
  text-align: center;
  font-size: calc(var(--slide-unit) * 2.5);
}

/* ========================
   LAYOUT: HALF IMAGE
   ======================== */

.layout-half-image {
  padding: 0!important;
}

.layout-half-image.slide-body {
  margin: 0;
}

.layout-half-image.slide-content {
  flex-direction: row;
  padding: 0;
}

.layout-half-image.slot-image {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.layout-half-image.slot-image.image-slot {
  flex: 1;
  min-height: 0;
}

.layout-half-image.slot-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.layout-half-image.slot-text {
  flex: 1;
  padding: 5%;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

/* Navigation */
.nav-controls {
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  display: flex;
  gap: 0.5rem;
  z-index: 100;
}

.nav-btn {
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.3);
  color: white;
  cursor: pointer;
  font-size: 1.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.nav-btn:hover { background: rgba(0, 0, 0, 0.5); }

  .progress-bar {
    position: fixed;
    bottom: 0;
    left: 0;
    height: 3px;
    background: var(--accent1, #000);
    transition: width 0.3s ease;
    z-index: 100;
  }

  /* Speaker notes */
  .speaker-notes { display: none; }
  .perspecta-thumbnail .speaker-notes { display: none !important; }

  /* Print styles */
  @media print {
    .slide {
      page-break-after: always;
      display: flex !important;
      position: relative;
    }
    .nav-controls, .progress-bar { display: none; }
  }
</style>`;
  }

  private generateCSSVariables(frontmatter: PresentationFrontmatter): string {
    const vars: string[] = [];

    if (frontmatter.titleFont) {
      vars.push(`  --title-font: '${frontmatter.titleFont}', sans-serif;`);
    }
    if (frontmatter.bodyFont) {
      vars.push(`  --body-font: '${frontmatter.bodyFont}', sans-serif;`);
    }
    if (frontmatter.listItemSpacing !== undefined) vars.push(`  --list-item-spacing: ${frontmatter.listItemSpacing}em;`);
    if (frontmatter.headerFontSize !== undefined) vars.push(`  --header-font-size: ${frontmatter.headerFontSize};`);
    if (frontmatter.footerFontSize !== undefined) vars.push(`  --footer-font-size: ${frontmatter.footerFontSize};`);
    if (frontmatter.headlineSpacingBefore !== undefined) vars.push(`  --headline-spacing-before: ${frontmatter.headlineSpacingBefore}em;`);
    if (frontmatter.headlineSpacingAfter !== undefined) vars.push(`  --headline-spacing-after: ${frontmatter.headlineSpacingAfter}em;`);

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
