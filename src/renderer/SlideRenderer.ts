import type {
  Presentation,
  Slide,
  SlideElement,
  PresentationFrontmatter,
  Theme,
  SlideLayout,
} from '../types';
import { ImageData } from '../types';
import { generateThemeCSS } from '../themes';

/**
 * SlideRenderer-Renders presentations to HTML
 *
 * Uses container/layout class pattern:
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
  private systemColorScheme: 'light' | 'dark' = 'light';
  private fontWeightsCache: Map<string, number[]> = new Map(); // Cache of font name -> available weights
  private excalidrawSvgCache: Map<string, string> | null = null; // Reference to ExcalidrawRenderer's cache

  constructor(presentation: Presentation, theme?: Theme, resolveImagePath?: ImagePathResolver) {
    this.presentation = presentation;
    this.theme = theme || null;
    this.resolveImagePath = resolveImagePath || null;
  }

  /**
   * Set font weights metadata for validation
   * Called by the plugin to provide available weights for each cached font
   */
  setFontWeightsCache(fontWeights: Map<string, number[]>): void {
    this.fontWeightsCache = fontWeights;
  }

  /**
   * Validate and sanitize a font weight against available weights for a font
   * Returns the weight if valid, or the closest valid weight (with fallback warning), or undefined
   * This implements the APPLY STAGE weight fallback from the font handling concept
   */
  private validateFontWeight(
    fontName: string | undefined,
    weight: number | undefined
  ): number | undefined {
    if (!weight || !fontName) {
      return undefined;
    }

    const availableWeights = this.fontWeightsCache.get(fontName);
    if (!availableWeights || availableWeights.length === 0) {
      return undefined;
    }

    // If weight is available, use it directly
    if (availableWeights.includes(weight)) {
      return weight;
    }

    // Weight not available - use fallback logic:
    // Find closest available weight, preferring heavier weights (e.g., if 600 not available, use 700)
    const sorted = availableWeights.sort((a, b) => a - b);

    // Try to find weight >= requested weight first, then fallback to closest
    const heavier = sorted.find((w) => w >= weight);
    const closest =
      heavier ||
      sorted.reduce((prev, curr) =>
        Math.abs(curr - weight) < Math.abs(prev - weight) ? curr : prev
      );

    // Log warning about weight fallback
    console.warn(
      `[font-handling] Font weight ${weight} not available for "${fontName}", using ${closest}`
    );

    return closest;
  }

  /**
   * Set the resolved system color scheme.
   * This should be called from the Obsidian context where we can properly detect the OS preference.
   * When mode is 'system', this value will be used instead of relying on CSS media queries.
   */
  setSystemColorScheme(scheme: 'light' | 'dark'): void {
    this.systemColorScheme = scheme;
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
   * Set reference to ExcalidrawRenderer's SVG cache
   * This allows us to look up asynchronously-converted SVGs
   */
  setExcalidrawSvgCache(cache: Map<string, string>): void {
    this.excalidrawSvgCache = cache;
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

    // Check if this is an excalidraw:// URL that was converted and cached
    if (src.startsWith('excalidraw://')) {
      const filePath = src.substring('excalidraw://'.length);
      console.log(`[Perspecta] Looking up Excalidraw cache for: ${filePath}`);
      if (this.excalidrawSvgCache) {
        console.log(`[Perspecta] Cache has ${this.excalidrawSvgCache.size} items`);
        const cachedSvg = this.excalidrawSvgCache.get(filePath);
        if (cachedSvg) {
          console.log(`[Perspecta] ✅ Found cached SVG for: ${filePath}`);
          return cachedSvg;
        }
        console.log(`[Perspecta] ❌ SVG not in cache for: ${filePath}`);
      } else {
        console.log(`[Perspecta] ❌ Cache is null/undefined`);
      }
      // If not cached, return subtle loading spinner
      console.log(`[Perspecta] Returning loading spinner for: ${filePath}`);
      return this.getLoadingSpinnerSvg();
    }

    return src;
  }

  /**
   * Generate a subtle loading spinner SVG as data URL
   * Small, light gray spinner that indicates loading without being intrusive
   */
  private getLoadingSpinnerSvg(): string {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      <defs>
        <style>
          @keyframes spin { to { transform: rotate(360deg); } }
          .spinner { animation: spin 2s linear infinite; transform-origin: center; }
        </style>
      </defs>
      <circle cx="50" cy="50" r="40" fill="none" stroke="#e0e0e0" stroke-width="3"/>
      <circle cx="50" cy="50" r="40" fill="none" stroke="#999999" stroke-width="3" stroke-dasharray="20 150" class="spinner"/>
    </svg>`;
    const encoded = btoa(unescape(encodeURIComponent(svg)));
    return `data:image/svg+xml;base64,${encoded}`;
  }

  /**
   * Get the container class for a layout
   */
  private getContainerClass(layout: SlideLayout): string {
    switch (layout) {
      case 'cover':
        return 'cover-container';
      case 'title':
        return 'title-container';
      case 'section':
        return 'section-container';
      case 'full-image':
        return 'image-container';
      case 'half-image':
        return 'split-container';
      case 'half-image-horizontal':
        return 'split-horizontal-container';
      case 'caption':
        return 'caption-container';
      case 'grid':
        return 'grid-container';
      case 'footnotes':
        return 'footnotes-container';
      case '1-column':
      case '2-columns':
      case '3-columns':
      case '2-columns-1+2':
      case '2-columns-2+1':
        return 'columns-container';
      default:
        return 'default-container';
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
  renderSingleSlideHTML(
    slide: Slide,
    index: number,
    frontmatter: PresentationFrontmatter,
    context: 'thumbnail' | 'preview' | 'presentation' = 'thumbnail'
  ): string {
    const themeClasses = this.theme?.template.CssClasses || '';
    const themeCSS = this.theme ? generateThemeCSS(this.theme, context) : '';
    const bodyClass = context === 'thumbnail' ? 'perspecta-thumbnail' : 'perspecta-preview';
    const fontScaleCSS = this.getFontScaleCSS(frontmatter);
    // Include frontmatter CSS variable overrides so Inspector color changes apply
    // IMPORTANT: Generate frontmatter variables BEFORE theme CSS so theme can be overridden
    // AND generate AFTER theme fallback rules for heading colors
    const frontmatterVars = this.generateCSSVariables(frontmatter);
    const frontmatterCSS = frontmatterVars ? `:root {\n${frontmatterVars}\n}` : '';
    // Generate override rules for theme heading colors when custom title text is set
    const headingOverrideCSS = this.generateHeadingColorOverrides(frontmatter);

    return `<!DOCTYPE html>
    <html>
    <head>
    <meta charset="utf-8" />
    <style>${this.customFontCSS}</style>
    <style>${this.getBaseStyles(context, frontmatter)}</style>
    <style>${themeCSS}</style>
    <style>${frontmatterCSS}</style>
    <style>${headingOverrideCSS}</style>
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
   * Get the visible slide number (index) for a given slide index
   * Returns -1 if the slide is hidden
   */
  private getVisibleSlideIndex(slideIndex: number): number {
    if (slideIndex < 0 || slideIndex >= this.presentation.slides.length) {
      return -1;
    }
    if (this.presentation.slides[slideIndex].hidden) {
      return -1;
    }

    let visibleIndex = 0;
    for (let i = 0; i < slideIndex; i++) {
      if (!this.presentation.slides[i].hidden) {
        visibleIndex++;
      }
    }
    return visibleIndex;
  }

  /**
   * Interpolate between colors in a gradient based on position (0-1)
   */
  private interpolateGradientColor(colors: string[], position: number): string {
    if (colors.length === 0) {
      return '#ffffff';
    }
    if (colors.length === 1) {
      return colors[0];
    }

    // Clamp position to 0-1
    position = Math.max(0, Math.min(1, position));

    // Find which two colors to interpolate between
    const segment = position * (colors.length - 1);
    const index = Math.floor(segment);
    const t = segment - index;

    if (index >= colors.length - 1) {
      return colors[colors.length - 1];
    }

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
   * Check if a layout has a specific background override defined in frontmatter.
   * Layout backgrounds take precedence over dynamic backgrounds.
   *
   * Only frontmatter overrides count - theme layout backgrounds are now always overridden
   * by the CSS generation (falling back to general background when not set in frontmatter).
   * This ensures dynamic backgrounds work for all layouts unless explicitly overridden.
   */
  private hasLayoutBackground(
    layout: SlideLayout,
    mode: 'light' | 'dark',
    frontmatter: PresentationFrontmatter
  ): boolean {
    // Only check frontmatter - theme layout backgrounds are handled in CSS
    if (layout === 'cover') {
      if (mode === 'light' && frontmatter.lightBgCover) {
        return true;
      }
      if (mode === 'dark' && frontmatter.darkBgCover) {
        return true;
      }
    } else if (layout === 'title') {
      if (mode === 'light' && frontmatter.lightBgTitle) {
        return true;
      }
      if (mode === 'dark' && frontmatter.darkBgTitle) {
        return true;
      }
    } else if (layout === 'section') {
      if (mode === 'light' && frontmatter.lightBgSection) {
        return true;
      }
      if (mode === 'dark' && frontmatter.darkBgSection) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get dynamic background color for a slide if enabled
   */
  private getDynamicBackgroundColor(
    slideIndex: number,
    totalSlides: number,
    mode: 'light' | 'dark',
    frontmatter: PresentationFrontmatter
  ): string | null {
    const useDynamic = frontmatter.useDynamicBackground;
    if (!useDynamic || useDynamic === 'none') {
      return null;
    }
    if (useDynamic !== 'both' && useDynamic !== mode) {
      return null;
    }

    // Get gradient colors-priority: frontmatter > theme > fallback
    let colors: string[] | undefined;
    if (mode === 'light') {
      colors = frontmatter.lightDynamicBackground;
    } else {
      colors = frontmatter.darkDynamicBackground;
    }

    // If no frontmatter colors, try to get from theme
    if (!colors || colors.length === 0) {
      const themeName = frontmatter.theme || '';
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
      colors =
        mode === 'light' ? ['#ffffff', '#f0f0f0', '#e0e0e0'] : ['#1a1a2e', '#2d2d44', '#3d3d5c'];
    }

    // Calculate position (0 to 1) based on visible slide index
    // Skip hidden slides in gradient interpolation
    let position: number;

    if (frontmatter.dynamicBackgroundRestartAtSection) {
      // Find section boundaries for this slide (only counting visible slides)
      const slides = this.presentation.slides;
      let sectionStart = slideIndex;
      let sectionEnd = slideIndex;

      // Find the section slide before or at this index (this is the section start)
      for (let i = slideIndex; i >= 0; i--) {
        if (!slides[i].hidden && slides[i].metadata.layout === 'section') {
          sectionStart = i;
          break;
        }
      }

      // Find the next section slide after this index (the slide before it is section end)
      for (let i = slideIndex + 1; i < slides.length; i++) {
        if (!slides[i].hidden && slides[i].metadata.layout === 'section') {
          sectionEnd = i - 1;
          break;
        }
      }

      // Calculate visible slide positions within section (ignoring hidden slides)
      let visibleIndexInSection = 0;
      let visibleCountInSection = 0;

      for (let i = sectionStart; i <= sectionEnd && i < slides.length; i++) {
        if (!slides[i].hidden) {
          if (i <= slideIndex) {
            visibleIndexInSection++;
          }
          visibleCountInSection++;
        }
      }

      position =
        visibleCountInSection > 1 ? (visibleIndexInSection - 1) / (visibleCountInSection - 1) : 0;
    } else {
      // Use visible slide index and count
      const visibleIndex = this.getVisibleSlideIndex(slideIndex);
      const visibleCount = this.getTotalVisibleSlides();

      if (visibleIndex < 0) {
        // Slide is hidden - use previous visible slide's position
        position = 0;
      } else {
        position = visibleCount > 1 ? visibleIndex / (visibleCount - 1) : 0;
      }
    }

    return this.interpolateGradientColor(colors, position);
  }

  /**
   * Determine the effective mode for a slide
   * Priority: per-slide override > presentation default > 'light'
   * 'system' mode is now resolved to 'light' or 'dark' based on systemColorScheme
   */
  private getEffectiveMode(slide: Slide, frontmatter: PresentationFrontmatter): 'light' | 'dark' {
    // Per-slide override takes precedence
    if (slide.metadata.mode) {
      // Resolve 'system' to actual scheme
      if (slide.metadata.mode === 'system') {
        return this.systemColorScheme;
      }
      return slide.metadata.mode;
    }
    // Fall back to presentation-wide setting
    const mode = frontmatter.mode || 'light';
    // Resolve 'system' to actual scheme
    if (mode === 'system') {
      return this.systemColorScheme;
    }
    return mode;
  }

  private renderSlide(
    slide: Slide,
    index: number,
    frontmatter: PresentationFrontmatter,
    renderSpeakerNotes: boolean = true
  ): string {
    const effectiveMode = this.getEffectiveMode(slide, frontmatter);
    // Mode is now always 'light' or 'dark' (system is resolved)
    const modeClass = effectiveMode;
    const layout = (slide.metadata.layout || 'default') as SlideLayout;
    const containerClass = this.getContainerClass(layout);
    const customClass = slide.metadata.class || '';
    const isActive = index === 0 ? 'active' : '';

    // Add data-mode attribute if this slide has an explicit per-slide mode override
    // This prevents the theme toggle from changing this slide's mode
    const hasExplicitMode = slide.metadata.mode && slide.metadata.mode !== 'system';
    const dataModeAttr = hasExplicitMode ? ` data-mode="${slide.metadata.mode}"` : '';

    // Handle per-slide background image from metadata
    // This sits between the background color/gradient and the overlay
    const slideBackgroundHtml = this.renderSlideBackground(slide);

    // Compute dynamic background colors for BOTH modes (for theme toggle in exports)
    // Skip dynamic background if this layout has a specific layout background defined OR if slide is hidden
    const hasLayoutBackground = this.hasLayoutBackground(layout, effectiveMode, frontmatter);
    const isHiddenSlide = slide.hidden || false;
    const dynamicBgColor =
      hasLayoutBackground || isHiddenSlide
        ? null
        : this.getDynamicBackgroundColor(index, 0, effectiveMode, frontmatter);
    const slideInlineStyle = dynamicBgColor ? `background-color: ${dynamicBgColor};` : '';

    // Calculate both light and dark dynamic bg colors for export theme toggle
    // (skip for hidden slides)
    const lightDynamicBg =
      hasLayoutBackground || isHiddenSlide
        ? null
        : this.getDynamicBackgroundColor(index, 0, 'light', frontmatter);
    const darkDynamicBg =
      hasLayoutBackground || isHiddenSlide
        ? null
        : this.getDynamicBackgroundColor(index, 0, 'dark', frontmatter);
    const dynamicBgAttrs =
      lightDynamicBg || darkDynamicBg
        ? ` data-light-bg="${lightDynamicBg || ''}" data-dark-bg="${darkDynamicBg || ''}"`
        : '';

    // For full-image layout, render images as background layer (edge-to-edge)
    let imageBackground = '';
    if (layout === 'full-image') {
      imageBackground = this.renderFullImageBackground(slide);
    }

    // For half-image layouts, use special split rendering
    if (layout === 'half-image' || layout === 'half-image-horizontal') {
      return this.renderHalfImageSlide(
        slide,
        index,
        frontmatter,
        layout,
        modeClass,
        containerClass,
        customClass,
        isActive,
        slideBackgroundHtml,
        renderSpeakerNotes,
        dynamicBgColor,
        hasExplicitMode ? slide.metadata.mode : undefined,
        lightDynamicBg,
        darkDynamicBg
      );
    }

    // Generate overlay if configured (presentation-wide)
    const overlayHtml = this.renderOverlay(frontmatter);

    // Layer order: background color/gradient (on section) -> slide background image -> full-image -> overlay -> content
    // Cover layout does not include header/footer slots
    const showHeaderFooter = layout !== 'cover';

    return `
    <section class="slide ${containerClass} ${modeClass} ${customClass} ${isActive}" data-index="${index}"${dataModeAttr}${dynamicBgAttrs}${slideInlineStyle ? ` style="${slideInlineStyle}"` : ''}>
      ${slideBackgroundHtml}
      ${imageBackground}
      ${overlayHtml}
      ${showHeaderFooter ? this.renderHeader(frontmatter, index) : ''}
      <div class="slide-body">
        <div class="slide-content layout-${layout}">
          ${layout === 'full-image' ? '' : this.renderSlideContent(slide, layout)}
        </div>
        ${this.renderFootnotes(slide, layout)}
      </div>
      ${showHeaderFooter ? this.renderFooter(frontmatter, index, this.presentation.slides.length) : ''}
      ${renderSpeakerNotes && slide.speakerNotes.length > 0 ? `<aside class="speaker-notes">${slide.speakerNotes.map((n) => this.renderMarkdown(n)).join('<br>')}</aside>` : ''}
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
    dynamicBgColor?: string | null,
    explicitMode?: string,
    lightDynamicBg?: string | null,
    darkDynamicBg?: string | null
  ): string {
    const elements = slide.elements.filter((e) => e.visible);
    const images = elements.filter((e) => e.type === 'image');
    const textElements = elements.filter((e) => e.type !== 'image');

    // Determine position based on content order
    const firstElement = elements[0];
    const imageFirst = firstElement?.type === 'image';

    // Render the image panel (edge-to-edge like full-image)
    const imagePanel = this.renderHalfImagePanel(images);

    // Render the content panel (like a normal slide but in half space)
    const textContent = textElements.map((e) => this.renderElement(e)).join('\n');

    const isHorizontal = layout === 'half-image-horizontal';
    const directionClass = isHorizontal ? 'split-horizontal' : 'split-vertical';
    const positionClass = imageFirst
      ? isHorizontal
        ? 'image-top'
        : 'image-left'
      : isHorizontal
        ? 'image-bottom'
        : 'image-right';

    const slideInlineStyle = dynamicBgColor ? `background-color: ${dynamicBgColor};` : '';
    const contentPanelStyle = dynamicBgColor ? ` style="background-color: ${dynamicBgColor};"` : '';
    const overlayHtml = this.renderOverlay(frontmatter);

    // Add data-mode attribute if this slide has an explicit per-slide mode override
    const dataModeAttr = explicitMode ? ` data-mode="${explicitMode}"` : '';

    // Add dynamic bg data attributes for export theme toggle
    const dynamicBgAttrs =
      lightDynamicBg || darkDynamicBg
        ? ` data-light-bg="${lightDynamicBg || ''}" data-dark-bg="${darkDynamicBg || ''}"`
        : '';

    return `
    <section class="slide ${containerClass} ${mode} ${customClass} ${isActive} ${directionClass} ${positionClass}" data-index="${index}"${dataModeAttr}${dynamicBgAttrs}${slideInlineStyle ? ` style="${slideInlineStyle}"` : ''}>
      ${slideBackgroundHtml}
      ${overlayHtml}
      <div class="half-image-panel">
        ${imagePanel}
      </div>
      <div class="half-content-panel ${mode}"${contentPanelStyle}${dynamicBgAttrs}>
        ${this.renderHeader(frontmatter, index)}
        <div class="slide-body">
          <div class="slide-content">
            ${textContent}
          </div>
          ${this.renderFootnotes(slide)}
        </div>
        ${this.renderFooter(frontmatter, index, this.presentation.slides.length)}
      </div>
      ${renderSpeakerNotes && slide.speakerNotes.length > 0 ? `<aside class="speaker-notes">${slide.speakerNotes.map((n) => this.renderMarkdown(n)).join('<br>')}</aside>` : ''}
    </section>`;
  }

  /**
   * Render the image panel for half-image layouts (edge-to-edge)
   */
  private renderHalfImagePanel(images: SlideElement[]): string {
    if (images.length === 0) {
      return '';
    }

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
    return images
      .map((img) => {
        const imageData = img.imageData;
        const src = this.escapeHtml(this.resolveImageSrc(img));
        const x = imageData?.x || 'center';
        const y = imageData?.y || 'center';
        const objectFit = imageData?.size || 'cover';
        return `<div class="image-slot"><img src="${src}" style="width: 100%; height: 100%; object-fit: ${objectFit}; object-position: ${x} ${y};" /></div>`;
      })
      .join('\n');
  }

  /**
   * Render full-image layout as a background layer (edge-to-edge, no padding)
   */
  private renderFullImageBackground(slide: Slide): string {
    const images = slide.elements.filter((e) => e.visible && e.type === 'image');
    if (images.length === 0) {
      return '';
    }

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
        'top: 0',
        'left: 0',
        'right: 0',
        'bottom: 0',
        'width: 100%',
        'height: 100%',
        `object-fit: ${objectFit}`,
        `object-position: ${x} ${y}`,
      ];

      if (imageData?.opacity !== undefined && imageData.opacity < 100) {
        styles.push(`opacity: ${imageData.opacity / 100}`);
      }

      if (imageData?.filter && imageData.filter !== 'none') {
        const filterMap: Record<string, string> = {
          darken: 'brightness(0.6)',
          lighten: 'brightness(1.4)',
          blur: 'blur(4px)',
          grayscale: 'grayscale(100%)',
          sepia: 'sepia(100%)',
        };
        const filterValue = filterMap[imageData.filter];
        if (filterValue) {
          styles.push(`filter: ${filterValue}`);
        }
      }

      return `<div class="slide-image-background"><img src="${src}" style="${styles.join('; ')}" /></div>`;
    }

    // Multiple images-use CSS classes for responsive layout
    // Two images: side-by-side in landscape, stacked in portrait
    const imageCount = images.length;
    const layoutClass = imageCount === 2 ? 'dual-image' : `multi-image count-${imageCount}`;

    return `<div class="slide-image-background ${layoutClass}">
      ${images
        .map((img, idx) => {
          const imageData = img.imageData;
          const src = this.escapeHtml(this.resolveImageSrc(img));
          const x = imageData?.x || 'center';
          const y = imageData?.y || 'center';
          const objectFit = imageData?.size || 'cover';
          return `<div class="image-panel image-${idx + 1}"><img src="${src}" style="object-fit: ${objectFit}; object-position: ${x} ${y};" /></div>`;
        })
        .join('\n')}
    </div>`;
  }

  // ============================================
  // LAYOUT TEMPLATES
  // ============================================

  private renderSlideContent(slide: Slide, layout: string): string {
    const elements = slide.elements.filter((e) => e.visible);
    const images = elements.filter((e) => e.type === 'image');
    const textElements = elements.filter((e) => e.type !== 'image');
    const headings = elements.filter((e) => e.type === 'heading' || e.type === 'kicker');
    const bodyElements = elements.filter(
      (e) => e.type !== 'heading' && e.type !== 'kicker' && e.type !== 'image'
    );

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

      // ==================
      // SPECIAL LAYOUTS
      // ==================

      case 'footnotes':
        return this.renderFootnotesLayout(slide);

      // Note: half-image and half-image-horizontal are handled by renderHalfImageSlide()
      // before this switch is reached

      default:
        return this.renderDefaultLayout(elements);
    }
  }

  /**
   * Get the effective column count for a slide layout
   * Used to determine footnote width restrictions
   */
  private getColumnCount(slide: Slide, layout: string): number {
    switch (layout) {
      case '2-columns':
      case '2-columns-1+2':
      case '2-columns-2+1':
        return 2;
      case '3-columns':
        return 3;
      case 'default':
        // For default layout, auto-detect from columnIndex in elements
        const columnElements = slide.elements.filter((e) => e.columnIndex !== undefined);
        if (columnElements.length === 0) {
          return 1;
        }
        const maxColumnIndex = Math.max(...columnElements.map((e) => e.columnIndex ?? 0));
        return Math.min(maxColumnIndex + 1, 3);
      default:
        return 1;
    }
  }

  /**
   * Get the first column width CSS calc() for a layout
   *
   * The footnotes container is positioned in .slide-body (full width),
   * but columns are inside .slide-content which has content margins.
   * So we must subtract content margins from the calculation.
   *
   * Content area = 100% - content-left - content-right (in slide-units)
   * Column gaps: 2-col = 3*su, 3-col = 5*su
   * First column = (content area - gaps) / numColumns * flexRatio
   */
  private getFirstColumnWidth(layout: string, columnCount: number): string | null {
    // Content margins - must be wrapped in parens to subtract both left AND right
    const contentLeft = 'var(--content-left, var(--content-width, 5)) * var(--slide-unit)';
    const contentRight = 'var(--content-right, var(--content-width, 5)) * var(--slide-unit)';
    // Gap sizes from CSS
    const gap2col = 'var(--slide-unit) * 3';
    const gap3col = 'var(--slide-unit) * 5';

    switch (layout) {
      case '2-columns':
        // (content area - 1 gap) / 2
        return `(100% - (${contentLeft}) - (${contentRight}) - (${gap2col})) / 2`;
      case '3-columns':
        // (content area - 2 gaps) / 3
        return `(100% - (${contentLeft}) - (${contentRight}) - 2 * (${gap3col})) / 3`;
      case '2-columns-1+2':
        // narrow-wide: flex 1:2, so first column is 1/3 of (content area - gap)
        return `(100% - (${contentLeft}) - (${contentRight}) - (${gap2col})) / 3`;
      case '2-columns-2+1':
        // wide-narrow: flex 2:1, so first column is 2/3 of (content area - gap)
        return `(100% - (${contentLeft}) - (${contentRight}) - (${gap2col})) * 2 / 3`;
      case 'default':
        if (columnCount === 2) {
          return `(100% - (${contentLeft}) - (${contentRight}) - (${gap2col})) / 2`;
        }
        if (columnCount === 3) {
          return `(100% - (${contentLeft}) - (${contentRight}) - 2 * (${gap3col})) / 3`;
        }
        return null;
      default:
        return null;
    }
  }

  /**
   * Render footnotes section for a slide
   * By default, does NOT render footnotes on individual slides (showFootnotesOnSlides defaults to false)
   * If showFootnotesOnSlides is true, renders on each slide where referenced
   * Always renders on slides with layout='footnotes'
   */
  private renderFootnotes(slide: Slide, layout?: string): string {
    if (!slide.footnotes || slide.footnotes.length === 0) {
      return '';
    }

    // Always render for footnotes layout (footnotes are main content)
    if (layout === 'footnotes') {
      return '';
    }

    // Check if footnotes should be shown on individual slides (default: false - don't show)
    // Set to true in frontmatter to enable footnotes on regular slides
    const showFootnotesOnSlides = this.presentation.frontmatter.showFootnotesOnSlides === true;

    // Check if this is the auto-generated footnotes slide (has footnotes but no elements)
    const isAutoGeneratedFootnotesSlide = slide.elements.length === 0 && slide.footnotes.length > 0;

    // Only render if explicitly enabled OR if this is the auto-generated footnotes slide
    if (!showFootnotesOnSlides && !isAutoGeneratedFootnotesSlide) {
      return '';
    }

    const footnotesHtml = slide.footnotes
      .map((fn) => {
        const renderedContent = this.renderMarkdown(fn.content);
        return `<div class="footnote-item"><span class="footnote-number"><sup>${fn.id}</sup></span><span class="footnote-text">${renderedContent}</span></div>`;
      })
      .join('\n');

    // Determine column count and first column width for multi-column layouts
    const columnCount = layout ? this.getColumnCount(slide, layout) : 1;
    const firstColumnWidth = layout ? this.getFirstColumnWidth(layout, columnCount) : null;
    const footnoteClass =
      columnCount > 1 ? `slide-footnotes columns-${columnCount}` : 'slide-footnotes';

    // For multi-column layouts, limit footnotes to first column width
    // Must set right:auto to override the base CSS that sets both left and right
    // The width calc accounts for gaps between columns
    const footnoteStyle = firstColumnWidth
      ? ` style="right: auto; width: calc(${firstColumnWidth});"`
      : '';

    return `<div class="${footnoteClass}"${footnoteStyle}>
      <div class="footnotes-separator"></div>
      <div class="footnotes-content">
        ${footnotesHtml}
      </div>
    </div>`;
  }

  // ==================
  // STANDARD LAYOUTS
  // ==================

  /**
   * Cover Layout: Opening slide with centered content
   * Uses centered flex layout - no slots needed
   */
  private renderCoverLayout(elements: SlideElement[]): string {
    return `<div class="cover-content">
      ${elements.map((e) => this.renderElement(e)).join('\n')}
    </div>`;
  }

  /**
   * Title Layout: Centered content with large headings
   * Uses centered flex layout - no slots needed
   */
  private renderTitleLayout(elements: SlideElement[]): string {
    return `<div class="title-content">
      ${elements.map((e) => this.renderElement(e)).join('\n')}
    </div>`;
  }

  /**
   * Section Layout: Accent background, centered heading
   * Uses centered flex layout - no slots needed
   */
  private renderSectionLayout(elements: SlideElement[]): string {
    return `<div class="section-content">
      ${elements.map((e) => this.renderElement(e)).join('\n')}
    </div>`;
  }

  /**
   * Footnotes Layout: Display footnotes as main slide content
   * Renders footnotes with special styling for presentation
   * Format: "1: content" or "name: content" (not "[1]" or "[name]")
   */
  private renderFootnotesLayout(slide: Slide): string {
    // Collect all footnotes from the entire presentation
    const allFootnotesMap = new Map<string, string>();
    for (const s of this.presentation.slides) {
      for (const fn of s.footnotes) {
        if (!allFootnotesMap.has(fn.id)) {
          allFootnotesMap.set(fn.id, fn.content);
        }
      }
    }

    if (allFootnotesMap.size === 0) {
      return `
        <div class="slot-header"></div>
        <div class="slot-columns columns-1">
          <div class="column" data-column="1">
            <p>No footnotes available</p>
          </div>
        </div>`;
    }

    // Separate header elements (headings, kickers) from body
    const headerElements = slide.elements.filter(
      (e) => e.type === 'heading' || e.type === 'kicker'
    );

    const footnotesRows = Array.from(allFootnotesMap.entries())
      .map(([id, content]) => {
        const renderedContent = this.renderMarkdown(content);
        return `<tr class="footnote-entry">
        <td class="footnote-id">${id}:</td>
        <td class="footnote-body">${renderedContent}</td>
      </tr>`;
      })
      .join('\n');

    return `
      <div class="slot-header">
        ${headerElements.map((e) => this.renderElement(e)).join('\n')}
      </div>
      <div class="slot-columns columns-1">
        <div class="column" data-column="1">
          <div class="footnotes-content">
            ${headerElements.length === 0 ? '<h2 class="footnotes-title">References</h2>' : ''}
            <table class="footnotes-list">
              <tbody>
                ${footnotesRows}
              </tbody>
            </table>
          </div>
        </div>
      </div>`;
  }

  /**
   * Default Layout: Auto-detects columns based on columnIndex
   * Uses slot-header + slot-columns for proper positioning
   */
  private renderDefaultLayout(elements: SlideElement[]): string {
    const columnElements = elements.filter((e) => e.columnIndex !== undefined);
    const nonColumnElements = elements.filter((e) => e.columnIndex === undefined);

    // Separate slide headers (H1/H2 and kickers) from body content
    // H3+ are treated as body content (can serve as column separators)
    const headerElements = nonColumnElements.filter(
      (e) => e.type === 'kicker' || (e.type === 'heading' && (e.level === 1 || e.level === 2))
    );
    const bodyElements = nonColumnElements.filter(
      (e) => !(e.type === 'kicker' || (e.type === 'heading' && (e.level === 1 || e.level === 2)))
    );

    // If no column elements, render all body content in a single column
    if (columnElements.length === 0) {
      return `
        <div class="slot-header">
          ${headerElements.map((e) => this.renderElement(e)).join('\n')}
        </div>
        <div class="slot-columns columns-1 ratio-equal">
          <div class="column" data-column="1">
            ${bodyElements.map((e) => this.renderElement(e)).join('\n')}
          </div>
        </div>`;
    }

    // Auto-detect column count
    const maxColumnIndex = Math.max(...columnElements.map((e) => e.columnIndex ?? 0));
    const columnCount = Math.min(maxColumnIndex + 1, 3); // Max 3 columns

    // Group elements by column
    const columns: SlideElement[][] = Array.from({ length: columnCount }, () => []);
    columnElements.forEach((e) => {
      const idx = Math.min(e.columnIndex ?? 0, columnCount - 1);
      columns[idx].push(e);
    });

    return `
      <div class="slot-header">
        ${headerElements.map((e) => this.renderElement(e)).join('\n')}
      </div>
      <div class="slot-columns columns-${columnCount} ratio-equal">
        ${columns
          .map(
            (col, i) => `
          <div class="column" data-column="${i + 1}">
            ${col.map((e) => this.renderElement(e)).join('\n')}
          </div>
        `
          )
          .join('\n')}
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
    const columnElements = elements.filter((e) => e.columnIndex !== undefined);
    const nonColumnElements = elements.filter((e) => e.columnIndex === undefined);

    // Separate slide headers (H1/H2 and kickers) from body content
    // H3+ are treated as body content (can serve as column separators)
    const headerElements = nonColumnElements.filter(
      (e) => e.type === 'kicker' || (e.type === 'heading' && (e.level === 1 || e.level === 2))
    );
    const bodyElements = nonColumnElements.filter(
      (e) => !(e.type === 'kicker' || (e.type === 'heading' && (e.level === 1 || e.level === 2)))
    );

    // Find how many data columns exist
    const maxDataColumn = columnElements.reduce((max, e) => Math.max(max, e.columnIndex ?? 0), -1);
    const dataColumnCount = maxDataColumn + 1;

    // Group elements into visual columns, merging overflow into last column
    const columns: SlideElement[][] = Array.from({ length: columnCount }, () => []);
    columnElements.forEach((e) => {
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
          ${headerElements.map((e) => this.renderElement(e)).join('\n')}
        </div>
        <div class="slot-columns columns-${columnCount} ratio-${ratio}">
          <div class="column" data-column="1">
            ${bodyElements.map((e) => this.renderElement(e)).join('\n')}
          </div>
          ${Array.from(
            { length: columnCount - 1 },
            (_, i) => `
            <div class="column" data-column="${i + 2}"></div>
          `
          ).join('\n')}
        </div>`;
    }

    return `
      <div class="slot-header">
        ${headerElements.map((e) => this.renderElement(e)).join('\n')}
      </div>
      <div class="slot-columns columns-${columnCount} ratio-${ratio}">
        ${columns
          .map(
            (col, i) => `
          <div class="column" data-column="${i + 1}">
            ${col.map((e) => this.renderElement(e)).join('\n')}
          </div>
        `
          )
          .join('\n')}
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
        ${images
          .map((img) => {
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
          })
          .join('\n')}
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
          ${headings.map((e) => this.renderElement(e)).join('\n')}
        </div>
        <div class="slot-image">
          ${images
            .map((img) => {
              const imageData = img.imageData;
              const objectFit = imageData?.size || 'cover';
              const x = imageData?.x || 'center';
              const y = imageData?.y || 'center';
              return `
            <div class="image-slot">
              <img src="${this.escapeHtml(this.resolveImageSrc(img))}" alt="" style="object-fit: ${objectFit}; object-position: ${x} ${y};" />
            </div>`;
            })
            .join('\n')}
        </div>
        ${
          bodyElements.length > 0
            ? `
          <div class="slot-caption">
            ${bodyElements.map((e) => this.renderElement(e)).join('\n')}
          </div>
        `
            : ''
        }
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

    // Parse list structure with indentation levels
    interface ListItem {
      level: number;
      text: string;
      isOrdered: boolean;
    }

    const items: ListItem[] = lines.map((line) => {
      // Count leading spaces/tabs to determine indentation level
      const leadingWhitespace = line.match(/^(\s*)/)?.[1] || '';

      // Count tabs as single units, spaces as pairs (2 spaces = 1 level)
      let indentLevel = 0;
      for (const char of leadingWhitespace) {
        if (char === '\t') {
          indentLevel++;
        } else if (char === ' ') {
          // Count spaces - every 2 spaces = 1 level
          // We'll handle this by converting spaces to tab-equivalent
        }
      }
      // Handle remaining spaces (in case there are any)
      const spaceCount = leadingWhitespace.replace(/\t/g, '').length;
      indentLevel += Math.floor(spaceCount / 2);

      const isOrdered = /^\d+\./.test(line.trim());
      const text = line
        .trim()
        .replace(/^[-*+]\s+/, '')
        .replace(/^\d+\.\s+/, '');

      return {
        level: indentLevel,
        text,
        isOrdered,
      };
    });

    // Build nested HTML - properly handle nesting by looking ahead
    const buildListHTML = (
      items: ListItem[],
      startIndex: number = 0,
      parentLevel: number = -1
    ): { html: string; nextIndex: number } => {
      let html = '';
      let i = startIndex;

      // Determine the list type from the first item at this level
      let listTag = 'ul';
      if (i < items.length && items[i].level > parentLevel) {
        listTag = items[i].isOrdered ? 'ol' : 'ul';
      }

      html += `<${listTag}>`;

      while (i < items.length) {
        const item = items[i];

        // If item is at a lower level, we're done
        if (item.level <= parentLevel) {
          break;
        }

        // If item is deeper than our level, let parent handle recursion
        if (item.level > parentLevel + 1) {
          i++;
          continue;
        }

        // Item is at our level (parentLevel + 1)
        if (item.level === parentLevel + 1) {
          html += `<li data-level="${item.level}">${this.renderMarkdown(item.text)}`;

          // Look ahead to see if next item is nested
          if (i + 1 < items.length && items[i + 1].level > item.level) {
            // Recursively render nested list
            const { html: nestedHtml, nextIndex } = buildListHTML(items, i + 1, item.level);
            html += nestedHtml;
            i = nextIndex;
          } else {
            i++;
          }

          html += `</li>`;
        }
      }

      html += `</${listTag}>`;

      return { html, nextIndex: i };
    };

    const { html } = buildListHTML(items, 0, -1);
    return html;
  }

  /**
   * Render an image element with proper styling for presentations
   */
  private renderImage(element: SlideElement): string {
    const imageData = element.imageData;
    const src = this.escapeHtml(this.resolveImageSrc(element));
    const alt = imageData?.alt ? this.escapeHtml(imageData.alt) : '';

    // Check if this is a loading spinner OR any Excalidraw SVG data URL
    const isExcalidrawSvg = src.startsWith('data:image/svg+xml');
    const isLoading = isExcalidrawSvg && this.isLoadingSpinnerSvg(src);

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
        darken: 'brightness(0.6)',
        lighten: 'brightness(1.4)',
        blur: 'blur(4px)',
        grayscale: 'grayscale(100%)',
        sepia: 'sepia(100%)',
      };
      const filterValue = filterMap[imageData.filter];
      if (filterValue) {
        styles.push(`filter: ${filterValue}`);
      }
    }

    const styleAttr = styles.length > 0 ? ` style="${styles.join('; ')}"` : '';

    // If Excalidraw SVG (spinner or converted), use special inline styles to prevent stretching
    if (isExcalidrawSvg) {
      const containerStyle = 'display: flex; align-items: center; justify-content: center; width: 100%; height: 100%;';
      const imgStyle = 'max-width: 95%; max-height: 95%; object-fit: contain; object-position: center;';
      return `<figure class="image-figure" style="${containerStyle}"><img src="${src}" alt="${alt}" style="${imgStyle}" /></figure>`;
    }

    // Wrap in figure for semantic markup
    return `<figure class="image-figure"><img src="${src}" alt="${alt}"${styleAttr} /></figure>`;
  }

  /**
   * Check if an SVG data URL is our loading spinner (by checking for the spinner animation marker)
   */
  private isLoadingSpinnerSvg(dataUrl: string): boolean {
    // Our loading spinner contains "spin" keyframe animation
    try {
      const base64 = dataUrl.replace(/^data:image\/svg\+xml;base64,/, '');
      const svg = decodeURIComponent(escape(atob(base64)));
      return svg.includes('spin') && svg.includes('stroke-dasharray');
    } catch {
      return false;
    }
  }

  private renderTable(content: string): string {
    const lines = content.split('\n').filter((l) => l.trim());
    if (lines.length < 2) {
      return '';
    }

    const headerCells = lines[0]
      .split('|')
      .filter((c) => c.trim())
      .map((c) => c.trim());
    const bodyLines = lines.slice(2);

    const header = `<tr>${headerCells.map((c) => `<th>${this.renderMarkdown(c)}</th>`).join('')}</tr>`;
    const body = bodyLines
      .map((line) => {
        const cells = line
          .split('|')
          .filter((c) => c.trim())
          .map((c) => c.trim());
        return `<tr>${cells.map((c) => `<td>${this.renderMarkdown(c)}</td>`).join('')}</tr>`;
      })
      .join('\n');

    return `<table><thead>${header}</thead><tbody>${body}</tbody></table>`;
  }

  private renderMarkdown(text: string): string {
    let html = this.escapeHtml(text);

    // Footnote references [^id] -> <sup><b>id</b></sup> (must be before link parsing)
    // Match [^id] but not [^id]: (which is a definition)
    html = html.replace(/\[\^([^\]]+)\](?!:)/g, '<sup class="footnote-ref"><b>$1</b></sup>');

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

    // Links handling
    const enableObsidianLinks = this.presentation.frontmatter.enableObsidianLinks === true;

    if (enableObsidianLinks) {
      // Links - open in new window/tab
      html = html.replace(
        /\[(.+?)\]\((.+?)\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
      );
    } else {
      // Strip markdown links: keep only the link text, remove the URL
      html = html.replace(/\[(.+?)\]\((.+?)\)/g, '$1');

      // Strip Obsidian wiki-links: [[text]] or [[text|display]]
      // [[path/to/page]] -> "page" (extract last component)
      // [[page|display text]] -> "display text" (use display text if provided)
      // [[page#heading]] -> strip heading reference
      html = html.replace(/\[\[([^\]|]+)(\|([^\]]+))?\]\]/g, (match, path, pipe, displayText) => {
        // If display text is provided, use it
        if (displayText) {
          return displayText.trim();
        }
        // Otherwise extract the page name from the path (last component)
        // Remove heading references (#...) and folder paths (...)
        const cleanPath = path.split('#')[0].trim(); // Remove heading reference
        const pageName = cleanPath.split('/').pop() || cleanPath; // Get last path component
        return pageName.trim();
      });
    }

    // Convert newlines to <br /> tags
    // Preserve escaped backslashes (\\n should display as \n)
    const ESCAPED_BACKSLASH_PLACEHOLDER = '___ESCAPED_BACKSLASH___';
    html = html.replace(/\\\\n/g, ESCAPED_BACKSLASH_PLACEHOLDER); // temporarily replace \\n
    html = html.replace(/\\n/g, '<br />'); // replace unescaped \n with <br />
    html = html.replace(/\n/g, '<br />'); // replace actual newline characters
    html = html.replace(new RegExp(ESCAPED_BACKSLASH_PLACEHOLDER, 'g'), '\\n'); // restore escaped backslashes

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

  private getVisibleSlideNumber(index: number): number {
    // Count only non-hidden slides up to and including this index
    return this.presentation.slides.slice(0, index + 1).filter((s) => !s.hidden).length;
  }

  private getTotalVisibleSlides(): number {
    return this.presentation.slides.filter((s) => !s.hidden).length;
  }

  private renderFooter(frontmatter: PresentationFrontmatter, index: number, total: number): string {
    const showNumbers = frontmatter.showSlideNumbers !== false;
    const visibleNumber = this.getVisibleSlideNumber(index);
    const totalVisible = this.getTotalVisibleSlides();

    return `
      <footer class="slide-footer">
        <div class="footer-left">${frontmatter.footerLeft ? `<span>${frontmatter.footerLeft}</span>` : ''}</div>
        <div class="footer-middle">${frontmatter.footerMiddle ? `<span>${frontmatter.footerMiddle}</span>` : ''}</div>
        <div class="footer-right">${showNumbers ? `<span>${visibleNumber}</span>` : ''}</div>
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
    const scale = 1 + fontOffset / 100;
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
      
      /* Layout-specific backgrounds - fall back to normal background if not defined */
      .slide.light.cover-container { background: var(--light-bg-cover, var(--light-background)); }
      .slide.light.title-container { background: var(--light-bg-title, var(--light-background)); }
      .slide.light.section-container { background: var(--light-bg-section, var(--light-background)); }
      .slide.dark.cover-container { background: var(--dark-bg-cover, var(--dark-background)); }
      .slide.dark.title-container { background: var(--dark-bg-title, var(--dark-background)); }
      .slide.dark.section-container { background: var(--dark-bg-section, var(--dark-background)); }
      
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
        left: calc(var(--content-left, var(--content-width, 5)) * var(--slide-unit));
        right: calc(var(--content-right, var(--content-width, 5)) * var(--slide-unit));
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
        left: calc(var(--content-left, var(--content-width, 5)) * var(--slide-unit));
        right: calc(var(--content-right, var(--content-width, 5)) * var(--slide-unit));
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
        left: calc(var(--content-left, var(--content-width, 5)) * var(--slide-unit));
        right: calc(var(--content-right, var(--content-width, 5)) * var(--slide-unit));
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
        top: calc(var(--content-top, 24) * var(--slide-unit));
        left: 0;
        right: 0;
        bottom: calc(var(--footer-bottom, 2.5) * var(--slide-unit) + var(--slide-unit) * 4);
        display: flex; 
        flex-direction: row;
        gap: calc(var(--slide-unit) * 3); 
        align-items: stretch;
        overflow: visible;
      }
      
      .slot-columns .column { 
        flex: 1; 
        display: flex; 
        flex-direction: column; 
        min-height: 0;
        min-width: 0;
        overflow: visible;
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
         FOOTNOTES - Displayed at bottom of slide content
         Grows upward from footer, respects content margins
         Uses hanging numbers (numbers extend left of content edge)
         ============================================ */
      .slide-footnotes {
        position: absolute;
        /* Position above footer with 2.25em spacing */
        bottom: calc((var(--footer-bottom, 2.5) + 2.25) * var(--slide-unit) + var(--slide-unit) * 2.5);
        left: calc(var(--content-left, var(--content-width, 5)) * var(--slide-unit));
        right: calc(var(--content-right, var(--content-width, 5)) * var(--slide-unit));
        font-size: calc(var(--slide-unit) * 1.8 * var(--body-font-scale, 1) * var(--font-scale, 1));
        color: var(--body-text);
        opacity: 0.75;
        /* Grow upward using flexbox */
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        justify-content: flex-end;
      }
      
      .footnotes-separator {
        /* Short gray line marking end of content */
        width: calc(var(--slide-unit) * 20);
        height: 1px;
        background: currentColor;
        opacity: 0.3;
        margin-bottom: calc(var(--slide-unit) * 1);
      }
      
      .footnotes-content {
        display: flex;
        flex-direction: column;
        gap: calc(var(--slide-unit) * 0.5);
        width: 100%;
      }
      
      .footnote-item {
        display: flex;
        align-items: flex-start;
        line-height: 1.3;
        gap: calc(var(--slide-unit) * 0.5);
        /* Negative margin on number handles hanging */
        margin-left: calc(var(--slide-unit) * -2.5);
      }
      
      .footnote-number {
        /* Fixed width for number column, right-aligned */
        width: calc(var(--slide-unit) * 2.5);
        text-align: right;
        flex-shrink: 0;
      }
      
      .footnote-number sup {
        font-size: 0.75em;
        opacity: 0.8;
      }
      
      .footnote-text {
        flex: 1;
      }
      
      .footnote-text p {
        margin: 0;
        font-size: inherit;
        display: inline;
      }
      
      /* Footnote references in slide content */
      .footnote-ref {
        font-size: 0.65em;
        vertical-align: super;
        margin-left: 0.1em;
        color: var(--link-color);
      }
      
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
        padding-left: 0;
        margin-left: 0;
        margin-top: 0;
        margin-bottom: 0;
        font-size: calc(var(--slide-unit) * 2.8 * var(--body-font-scale, 1) * var(--font-scale, 1)); 
        line-height: var(--line-height, 1.1);
        list-style: none;
      }
      
      /* First level lists */
      > ul > li::before,
      > ol > li::before {
        opacity: 1;
      }
      
      /* Nested lists get left indentation */
      ul ul, ul ol, ol ul, ol ol {
        margin-left: calc(var(--slide-unit) * 4);
        margin-top: calc(var(--slide-unit) * 0.5);
        margin-bottom: calc(var(--slide-unit) * 0.5);
      }
      
      li { 
        margin-bottom: calc(var(--list-item-spacing, 1) * var(--slide-unit));
        margin-top: 0;
        padding-left: calc(var(--slide-unit) * 2.5);
        position: relative;
      }
      
      /* Level bullets based on data-level attribute */
      li::before {
        position: absolute;
        left: 0;
        width: calc(var(--slide-unit) * 2);
        text-align: left;
      }
      
      /* Level 0 bullet */
      li[data-level="0"]::before {
        content: '•';
      }
      
      /* Level 1 bullet (different style) */
      li[data-level="1"]::before {
        content: '◦';
      }
      
      /* Level 2 bullet (different style) */
      li[data-level="2"]::before {
        content: '▪';
      }
      
      /* Level 3+ bullet */
      li[data-level="3"]::before,
      li[data-level="4"]::before,
      li[data-level="5"]::before {
        content: '▫';
      }
      ol { counter-reset: list-counter; }
      ol li { 
        counter-increment: list-counter;
        padding-left: calc(var(--slide-unit) * 3);
      }
      ol li::before {
        content: counter(list-counter) '. ';
        width: calc(var(--slide-unit) * 3);
      }
      
      .kicker { 
        font-size: calc(var(--slide-unit) * 1.8 * var(--body-font-scale, 1) * var(--font-scale, 1)); 
        text-transform: uppercase; 
        letter-spacing: 0.08em; 
        opacity: 0.7; 
      }
      
      /* ============================================
         SEMANTIC COLORS - Links, bullets, etc.
         ============================================ */
      
      /* Links */
      a { 
        color: var(--light-link-color, #0066cc);
        text-decoration: underline;
      }
      a:hover { opacity: 0.8; }
      .slide.dark a { color: var(--dark-link-color, #66b3ff); }
      
      /* Bold text - always use weight 700 regardless of body font weight */
      b, strong {
        font-weight: 700;
        color: var(--light-bold-color, inherit);
      }
      .slide.dark b, .slide.dark strong {
        color: var(--dark-bold-color, inherit);
      }
      
      /* Bullets */
      li::before { color: var(--light-bullet-color, inherit); }
      .slide.dark li::before { color: var(--dark-bullet-color, inherit); }
      
      /* Blockquotes */
      blockquote {
        border-left: calc(var(--slide-unit) * 0.5) solid var(--light-blockquote-border, #cccccc);
        padding-left: calc(var(--slide-unit) * 2);
        margin-left: 0;
        font-style: italic;
        opacity: 0.9;
      }
      .slide.dark blockquote { 
        border-left-color: var(--dark-blockquote-border, #555555); 
      }
      
      /* Tables */
      table {
        width: 100%;
        border-collapse: collapse;
        font-size: calc(var(--slide-unit) * 2.4 * var(--body-font-scale, 1) * var(--font-scale, 1));
      }
      th, td {
        padding: calc(var(--slide-unit) * 1);
        text-align: left;
        border-bottom: 1px solid rgba(0, 0, 0, 0.5);
      }
      th {
        background: var(--light-table-header-bg, #f0f0f0);
        font-weight: 600;
      }
      .slide.dark th { background: var(--dark-table-header-bg, #333333); }
      .slide.dark th, .slide.dark td { border-bottom-color: rgba(255, 255, 255, 0.5); }
      
      /* Code */
      code {
        font-family: 'SF Mono', Monaco, 'Fira Code', monospace;
        font-size: 0.9em;
        padding: 0.15em 0.4em;
        border-radius: calc(var(--slide-unit) * 0.3);
        background: rgba(128, 128, 128, 0.1);
        border: 1px solid var(--light-code-border, #e0e0e0);
      }
      pre {
        background: rgba(128, 128, 128, 0.1);
        border: 1px solid var(--light-code-border, #e0e0e0);
        border-radius: calc(var(--slide-unit) * 0.5);
        padding: calc(var(--slide-unit) * 1.5);
        overflow-x: auto;
        font-size: calc(var(--slide-unit) * 2 * var(--body-font-scale, 1) * var(--font-scale, 1));
      }
      pre code {
        padding: 0;
        border: none;
        background: none;
      }
      .slide.dark code { border-color: var(--dark-code-border, #444444); }
      .slide.dark pre { border-color: var(--dark-code-border, #444444); }
      
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
         LAYOUT: SECTION - Centered content
         Background comes from layout-specific bg or normal background
         ============================================ */
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

      /* ============================================
         LAYOUT: FOOTNOTES - Display footnotes as main content
         Uses 0.8em font size and list item spacing
         ============================================ */
      .layout-footnotes {
        display: flex;
        justify-content: center;
        align-items: flex-start;
        padding-top: calc(var(--slide-unit) * 8);
      }
      .layout-footnotes .footnotes-content {
        width: 100%;
      }
      .footnotes-title {
        font-size: calc(var(--slide-unit) * 6 * var(--title-font-scale, 1) * var(--font-scale, 1));
        font-weight: var(--title-font-weight, 700);
        font-family: var(--title-font, inherit);
        color: var(--title-text);
        margin-bottom: calc(var(--slide-unit) * 4);
        text-align: left;
      }
      .footnotes-list {
        width: 100%;
        border-collapse: collapse;
        border: none;
        font-size: calc(var(--slide-unit) * 2.5 * 0.8 * var(--body-font-scale, 1) * var(--font-scale, 1));
        line-height: 1.5;
      }
      .footnotes-list tbody {
        border: none;
      }
      .footnote-entry {
        border: none;
        padding: 0;
      }
      .footnote-entry:last-child {
        border-bottom: none;
      }
      .footnote-id {
        font-weight: 700;
        color: var(--link-color);
        padding: 0;
        padding-right: calc(var(--slide-unit) * 1);
        padding-bottom: calc(var(--slide-unit) * 1.5);
        white-space: nowrap;
        vertical-align: top;
        border: none;
      }
      .footnote-body {
        color: var(--body-text);
        width: 100%;
        padding: 0;
        padding-bottom: calc(var(--slide-unit) * 1.5);
        border: none;
      }
      .footnote-body p {
        margin: 0;
        display: inline;
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
        padding-top: calc(var(--content-left, var(--content-width, 5)) * var(--slide-unit));
        padding-right: calc(var(--content-right, var(--content-width, 5)) * var(--slide-unit));
        padding-bottom: calc(var(--content-left, var(--content-width, 5)) * var(--slide-unit));
        padding-left: calc(var(--content-left, var(--content-width, 5)) * var(--slide-unit));
      }
      .layout-full-image { 
        padding: 0; 
        flex-direction: row; 
      }
      .layout-full-image .image-slot { flex: 1; height: 100%; }
      .layout-full-image .image-slot img { width: 100%; height: 100%; object-fit: cover; }
      
      /* ============================================
         LAYOUT: CAPTION - Full bleed image with headline overlay
         ============================================ */
      .caption-container {
        display: flex;
        flex-direction: column;
      }
      .caption-container .slide-header,
      .caption-container .slide-footer {
        display: none;
      }
      .caption-container .slide-body {
        position: absolute;
        top: 0; left: 0; right: 0; bottom: 0;
        display: flex;
        flex-direction: column;
        z-index: 2;
        padding: 0;
      }
      .caption-container .slide-content {
        position: static !important;
        left: auto !important;
        right: auto !important;
        top: auto !important;
        bottom: auto !important;
        flex: 1 1 auto;
        display: flex;
        flex-direction: column;
        min-height: 0;
      }
      .layout-caption { 
        position: static !important;
        left: auto !important;
        right: auto !important;
        top: auto !important;
        bottom: auto !important;
        padding: 0 !important;
        flex: 1 1 auto;
        display: flex;
        flex-direction: column;
        min-height: 0;
      }
      .layout-caption .caption-content {
        flex: 1 1 auto;
        display: flex;
        flex-direction: column;
        min-height: 0;
      }
      .layout-caption .slot-title-bar { 
        flex: 0 0 auto;
        padding: 0 calc(var(--slide-unit) * 2);
        background: transparent;
        display: flex;
        align-items: center;
        justify-content: flex-start;
        height: calc(var(--slide-unit) * 6);
      }
      .layout-caption .slot-title-bar h1,
      .layout-caption .slot-title-bar h2,
      .layout-caption .slot-title-bar h3,
      .layout-caption .slot-title-bar h4,
      .layout-caption .slot-title-bar h5,
      .layout-caption .slot-title-bar h6 {
        font-family: var(--title-font, system-ui, -apple-system, sans-serif) !important;
        font-weight: var(--title-font-weight, 700) !important;
        font-size: calc(var(--slide-unit) * 3.5 * var(--title-font-scale, 1) * var(--font-scale, 1));
        margin: 0;
        line-height: 1.0;
        padding: 0;
        display: block;
      }
      .layout-caption .slot-image { 
        flex: 1 1 auto;
        display: flex;
        min-height: 0;
        max-height: 100%;
        overflow: hidden;
        width: 100%;
      }
      .layout-caption .slot-image .image-slot {
        width: 100%;
        height: 100%;
        display: flex;
      }
      .layout-caption .slot-image img { 
        width: 100%; 
        height: 100%; 
        object-fit: cover; 
        display: block;
      }
      .layout-caption .slot-caption { 
        flex: 0 0 auto;
        padding: 0 calc(var(--slide-unit) * 2);
        background: transparent;
        text-align: left;
        font-size: calc(var(--slide-unit) * 2 * var(--body-font-scale, 1) * var(--font-scale, 1));
        display: flex;
        align-items: center;
        justify-content: flex-start;
        height: calc(var(--slide-unit) * 6);
      }
      .layout-caption .slot-caption p {
        margin: 0;
        padding: 0;
        line-height: 1.0;
        display: block;
      }
      
      /* ============================================
         LAYOUT: HALF-IMAGE (Vertical Split)
         ============================================ */
      .split-container,
      .split-horizontal-container {
        display: flex;
        overflow: hidden;
      }
      .split-container {
        flex-direction: row;
      }
      .split-container.image-right {
        flex-direction: row-reverse;
      }
      .split-horizontal-container {
        flex-direction: column;
      }
      .split-horizontal-container.image-top {
        flex-direction: column;
      }
      .split-horizontal-container.image-bottom {
        flex-direction: column-reverse;
      }
      
      /* Hide main slide header/footer in split layouts - they're inside content panel */
      .split-container > .slide-header,
      .split-container > .slide-footer,
      .split-container > .slide-body,
      .split-horizontal-container > .slide-header,
      .split-horizontal-container > .slide-footer,
      .split-horizontal-container > .slide-body {
        display: none;
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
        position: absolute;
        top: 0;
        left: 0;
      }
      
      .half-content-panel {
        flex: 1;
        min-width: 0;
        min-height: 0;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        position: relative;
      }
      /* Header in half panel - uses same margins as full slide but relative to panel */
      .half-content-panel .slide-header {
        position: absolute;
        top: calc(var(--header-top, 2.5) * var(--slide-unit));
        left: calc(var(--content-left, var(--content-width, 5)) * var(--slide-unit));
        right: calc(var(--content-right, var(--content-width, 5)) * var(--slide-unit));
        z-index: 10;
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        font-size: calc(var(--slide-unit) * 1.5 * var(--header-font-scale, 1) * var(--font-scale, 1));
      }
      /* Footer in half panel - uses same margins as full slide but relative to panel */
      .half-content-panel .slide-footer {
        position: absolute;
        bottom: calc(var(--footer-bottom, 2.5) * var(--slide-unit));
        left: calc(var(--content-left, var(--content-width, 5)) * var(--slide-unit));
        right: calc(var(--content-right, var(--content-width, 5)) * var(--slide-unit));
        z-index: 10;
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
        font-size: calc(var(--slide-unit) * 1.5 * var(--footer-font-scale, 1) * var(--font-scale, 1));
      }
      /* Slide body in half panel - uses title-top for positioning (title + content together) */
      .half-content-panel .slide-body {
        position: absolute;
        top: calc(var(--title-top, 5) * var(--slide-unit));
        left: calc(var(--content-left, var(--content-width, 5)) * var(--slide-unit));
        right: calc(var(--content-right, var(--content-width, 5)) * var(--slide-unit));
        bottom: calc(var(--footer-bottom, 2.5) * var(--slide-unit) + var(--slide-unit) * 3);
        display: flex;
        flex-direction: column;
        justify-content: flex-start;
        gap: calc(var(--slide-unit) * 1.5);
        z-index: 5;
      }
      .half-content-panel .slide-content {
        position: relative;
        left: 0;
        right: 0;
        display: flex;
        flex-direction: column;
        gap: calc(var(--slide-unit) * 1.5);
      }
    `;
  }

  private getBaseStyles(
    context: 'thumbnail' | 'preview' | 'presentation' = 'thumbnail',
    frontmatter?: PresentationFrontmatter
  ): string {
    const containerClass = context === 'thumbnail' ? 'perspecta-thumbnail' : 'perspecta-preview';
    const textScale = frontmatter?.textScale || 1;

    return `
      * { margin: 0; padding: 0; box-sizing: border-box; }
      :root {
        /* Scale typography based on geometric mean of viewport dimensions */
        /* Approximated as arithmetic mean: (1vw + 1vh) / 2 */
        /* This accounts for aspect ratio: wider viewports = larger fonts, narrower = smaller */
        /* Prevents text overflow when aspect ratio changes (e.g., 16:9 to 4:3) */
        /* Global text scale multiplier from frontmatter (default: 1) */
        --slide-unit: calc((1vw + 1vh) / 2 * ${textScale});
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
    const headingOverrideCSS = this.generateHeadingColorOverrides(frontmatter);
    const textScale = frontmatter?.textScale || 1;

    return `<style>
/* Custom Fonts */
${this.customFontCSS}

${themeCSS}
:root {
${cssVars}
  --slide-unit: calc((1vw + 1vh) / 2 * ${textScale});
}

${headingOverrideCSS}

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
  background: var(--progress-bar, var(--light-progress-bar, #007acc));
  transition: width 0.3s ease;
}

.slide.appearance-dark .progress-bar-fill {
  background: var(--dark-progress-bar, #66b3ff);
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

  /**
   * Generate CSS rules to override theme heading colors when custom title/body text is set
   * This ensures that inspector color changes take precedence over theme-defined heading colors
   *
   * Priority order:
   * 1. Explicit heading color from frontmatter (lightH1Color, darkH1Color, etc.)
   * 2. General title/body text color from frontmatter (lightTitleText, darkTitleText, etc.)
   * 3. Theme heading color (--light-h1-color, --dark-h1-color, etc.)
   * 4. Theme general color (--light-title-text, --dark-title-text, etc.)
   */
  private generateHeadingColorOverrides(frontmatter: PresentationFrontmatter): string {
    const rules: string[] = [];

    // Light mode heading color overrides
    if (frontmatter.lightTitleText) {
      // Only override h1/h2 if not explicitly set in frontmatter
      if (!frontmatter.lightH1Color?.length) {
        rules.push(`.slide.light h1 { color: ${frontmatter.lightTitleText} !important; }`);
      }
      if (!frontmatter.lightH2Color?.length) {
        rules.push(`.slide.light h2 { color: ${frontmatter.lightTitleText} !important; }`);
      }
    }

    if (frontmatter.lightBodyText) {
      // Only override h3/h4 if not explicitly set in frontmatter
      if (!frontmatter.lightH3Color?.length) {
        rules.push(`.slide.light h3 { color: ${frontmatter.lightBodyText} !important; }`);
      }
      if (!frontmatter.lightH4Color?.length) {
        rules.push(`.slide.light h4 { color: ${frontmatter.lightBodyText} !important; }`);
      }
    }

    // Dark mode heading color overrides
    if (frontmatter.darkTitleText) {
      // Only override h1/h2 if not explicitly set in frontmatter
      if (!frontmatter.darkH1Color?.length) {
        rules.push(`.slide.dark h1 { color: ${frontmatter.darkTitleText} !important; }`);
      }
      if (!frontmatter.darkH2Color?.length) {
        rules.push(`.slide.dark h2 { color: ${frontmatter.darkTitleText} !important; }`);
      }
    }

    if (frontmatter.darkBodyText) {
      // Only override h3/h4 if not explicitly set in frontmatter
      if (!frontmatter.darkH3Color?.length) {
        rules.push(`.slide.dark h3 { color: ${frontmatter.darkBodyText} !important; }`);
      }
      if (!frontmatter.darkH4Color?.length) {
        rules.push(`.slide.dark h4 { color: ${frontmatter.darkBodyText} !important; }`);
      }
    }

    return rules.length > 0 ? rules.join('\n') : '';
  }

  private generateCSSVariables(frontmatter: PresentationFrontmatter): string {
    const vars: string[] = [];

    // Validate font weights against available weights for each font
    const validTitleWeight = this.validateFontWeight(
      frontmatter.titleFont,
      frontmatter.titleFontWeight
    );
    const validBodyWeight = this.validateFontWeight(
      frontmatter.bodyFont,
      frontmatter.bodyFontWeight
    );
    const validHeaderWeight = this.validateFontWeight(
      frontmatter.headerFont,
      frontmatter.headerFontWeight
    );
    const validFooterWeight = this.validateFontWeight(
      frontmatter.footerFont,
      frontmatter.footerFontWeight
    );

    // Fonts
    if (frontmatter.titleFont) {
      vars.push(`  --title-font: '${frontmatter.titleFont}', sans-serif;`);
    }
    if (validTitleWeight !== undefined) {
      vars.push(`  --title-font-weight: ${validTitleWeight};`);
    }
    if (frontmatter.bodyFont) {
      vars.push(`  --body-font: '${frontmatter.bodyFont}', sans-serif;`);
    }
    if (validBodyWeight !== undefined) {
      vars.push(`  --body-font-weight: ${validBodyWeight};`);
    }
    if (frontmatter.headerFont) {
      vars.push(`  --header-font: '${frontmatter.headerFont}', sans-serif;`);
    }
    if (validHeaderWeight !== undefined) {
      vars.push(`  --header-font-weight: ${validHeaderWeight};`);
    }
    if (frontmatter.footerFont) {
      vars.push(`  --footer-font: '${frontmatter.footerFont}', sans-serif;`);
    }
    if (validFooterWeight !== undefined) {
      vars.push(`  --footer-font-weight: ${validFooterWeight};`);
    }

    // Font sizes (as scale factors, convert from % offset)
    if (frontmatter.titleFontSize !== undefined) {
      const scale = 1 + frontmatter.titleFontSize / 100;
      vars.push(`  --title-font-scale: ${scale};`);
    }
    if (frontmatter.bodyFontSize !== undefined) {
      const scale = 1 + frontmatter.bodyFontSize / 100;
      vars.push(`  --body-font-scale: ${scale};`);
    }
    if (frontmatter.headerFontSize !== undefined) {
      const scale = 1 + frontmatter.headerFontSize / 100;
      vars.push(`  --header-font-scale: ${scale};`);
    }
    if (frontmatter.footerFontSize !== undefined) {
      const scale = 1 + frontmatter.footerFontSize / 100;
      vars.push(`  --footer-font-scale: ${scale};`);
    }

    // Legacy font size offset (affects all text)
    if (frontmatter.fontSizeOffset !== undefined) {
      const scale = 1 + frontmatter.fontSizeOffset / 100;
      vars.push(`  --font-scale: ${scale};`);
    }

    // Spacing (unitless, will be multiplied by --slide-unit in CSS)
    if (frontmatter.headlineSpacingBefore !== undefined) {
      vars.push(`  --headline-spacing-before: ${frontmatter.headlineSpacingBefore};`);
    }
    if (frontmatter.headlineSpacingAfter !== undefined) {
      vars.push(`  --headline-spacing-after: ${frontmatter.headlineSpacingAfter};`);
    }
    if (frontmatter.listItemSpacing !== undefined) {
      vars.push(`  --list-item-spacing: ${frontmatter.listItemSpacing};`);
    }
    if (frontmatter.lineHeight !== undefined) {
      vars.push(`  --line-height: ${frontmatter.lineHeight};`);
    }

    // Margins (unitless, absolute distance from slide edge in slide units)
    // These will be multiplied by --slide-unit in CSS for proper scaling
    if (frontmatter.headerTop !== undefined) {
      vars.push(`  --header-top: ${frontmatter.headerTop};`);
    }
    if (frontmatter.footerBottom !== undefined) {
      vars.push(`  --footer-bottom: ${frontmatter.footerBottom};`);
    }
    if (frontmatter.titleTop !== undefined) {
      vars.push(`  --title-top: ${frontmatter.titleTop};`);
    }
    if (frontmatter.contentTop !== undefined) {
      vars.push(`  --content-top: ${frontmatter.contentTop};`);
    }
    // Content margins: Support asymmetric left/right, with contentWidth as legacy fallback
    const contentLeft = frontmatter.contentLeft ?? frontmatter.contentWidth;
    const contentRight = frontmatter.contentRight ?? frontmatter.contentWidth;
    if (contentLeft !== undefined) {
      vars.push(`  --content-left: ${contentLeft};`);
    }
    if (contentRight !== undefined) {
      vars.push(`  --content-right: ${contentRight};`);
    }
    // Legacy: still output --content-width if defined for backwards compatibility
    if (frontmatter.contentWidth !== undefined) {
      vars.push(`  --content-width: ${frontmatter.contentWidth};`);
    }

    // Semantic colors (light mode)
    if (frontmatter.lightLinkColor) {
      vars.push(`  --light-link-color: ${frontmatter.lightLinkColor};`);
    }
    if (frontmatter.lightBulletColor) {
      vars.push(`  --light-bullet-color: ${frontmatter.lightBulletColor};`);
    }
    if (frontmatter.lightBlockquoteBorder) {
      vars.push(`  --light-blockquote-border: ${frontmatter.lightBlockquoteBorder};`);
    }
    if (frontmatter.lightTableHeaderBg) {
      vars.push(`  --light-table-header-bg: ${frontmatter.lightTableHeaderBg};`);
    }
    if (frontmatter.lightCodeBorder) {
      vars.push(`  --light-code-border: ${frontmatter.lightCodeBorder};`);
    }
    if (frontmatter.lightProgressBar) {
      vars.push(`  --light-progress-bar: ${frontmatter.lightProgressBar};`);
    }
    if (frontmatter.lightBoldColor) {
      vars.push(`  --light-bold-color: ${frontmatter.lightBoldColor};`);
    }

    // Semantic colors (dark mode)
    if (frontmatter.darkLinkColor) {
      vars.push(`  --dark-link-color: ${frontmatter.darkLinkColor};`);
    }
    if (frontmatter.darkBulletColor) {
      vars.push(`  --dark-bullet-color: ${frontmatter.darkBulletColor};`);
    }
    if (frontmatter.darkBlockquoteBorder) {
      vars.push(`  --dark-blockquote-border: ${frontmatter.darkBlockquoteBorder};`);
    }
    if (frontmatter.darkTableHeaderBg) {
      vars.push(`  --dark-table-header-bg: ${frontmatter.darkTableHeaderBg};`);
    }
    if (frontmatter.darkCodeBorder) {
      vars.push(`  --dark-code-border: ${frontmatter.darkCodeBorder};`);
    }
    if (frontmatter.darkProgressBar) {
      vars.push(`  --dark-progress-bar: ${frontmatter.darkProgressBar};`);
    }
    if (frontmatter.darkBoldColor) {
      vars.push(`  --dark-bold-color: ${frontmatter.darkBoldColor};`);
    }

    if (frontmatter.lightBackground) {
      vars.push(`  --light-background: ${frontmatter.lightBackground};`);
    }
    if (frontmatter.darkBackground) {
      vars.push(`  --dark-background: ${frontmatter.darkBackground};`);
    }
    if (frontmatter.lightTitleText) {
      vars.push(`  --light-title-text: ${frontmatter.lightTitleText};`);
    }
    if (frontmatter.darkTitleText) {
      vars.push(`  --dark-title-text: ${frontmatter.darkTitleText};`);
    }
    if (frontmatter.lightBodyText) {
      vars.push(`  --light-body-text: ${frontmatter.lightBodyText};`);
    }
    if (frontmatter.darkBodyText) {
      vars.push(`  --dark-body-text: ${frontmatter.darkBodyText};`);
    }

    // Per-heading colors (can be gradient if array has 2 elements)
    const colorOrGradient = (colors: string[]): string => {
      if (colors.length === 1) {
        return colors[0];
      }
      return `linear-gradient(to right, ${colors.join(', ')})`;
    };

    if (frontmatter.lightH1Color?.length) {
      vars.push(`  --light-h1-color: ${colorOrGradient(frontmatter.lightH1Color)};`);
    }
    if (frontmatter.lightH2Color?.length) {
      vars.push(`  --light-h2-color: ${colorOrGradient(frontmatter.lightH2Color)};`);
    }
    if (frontmatter.lightH3Color?.length) {
      vars.push(`  --light-h3-color: ${colorOrGradient(frontmatter.lightH3Color)};`);
    }
    if (frontmatter.lightH4Color?.length) {
      vars.push(`  --light-h4-color: ${colorOrGradient(frontmatter.lightH4Color)};`);
    }
    if (frontmatter.darkH1Color?.length) {
      vars.push(`  --dark-h1-color: ${colorOrGradient(frontmatter.darkH1Color)};`);
    }
    if (frontmatter.darkH2Color?.length) {
      vars.push(`  --dark-h2-color: ${colorOrGradient(frontmatter.darkH2Color)};`);
    }
    if (frontmatter.darkH3Color?.length) {
      vars.push(`  --dark-h3-color: ${colorOrGradient(frontmatter.darkH3Color)};`);
    }
    if (frontmatter.darkH4Color?.length) {
      vars.push(`  --dark-h4-color: ${colorOrGradient(frontmatter.darkH4Color)};`);
    }

    // Header/Footer text colors
    if (frontmatter.lightHeaderText) {
      vars.push(`  --light-header-text: ${frontmatter.lightHeaderText};`);
    }
    if (frontmatter.lightFooterText) {
      vars.push(`  --light-footer-text: ${frontmatter.lightFooterText};`);
    }
    if (frontmatter.darkHeaderText) {
      vars.push(`  --dark-header-text: ${frontmatter.darkHeaderText};`);
    }
    if (frontmatter.darkFooterText) {
      vars.push(`  --dark-footer-text: ${frontmatter.darkFooterText};`);
    }

    // Layout-specific backgrounds
    // Always output these to override theme defaults when user removes a custom layout background
    // If not set in frontmatter, fall back to general background
    vars.push(`  --light-bg-cover: ${frontmatter.lightBgCover || 'var(--light-background)'};`);
    vars.push(`  --light-bg-title: ${frontmatter.lightBgTitle || 'var(--light-background)'};`);
    vars.push(`  --light-bg-section: ${frontmatter.lightBgSection || 'var(--light-background)'};`);
    vars.push(`  --dark-bg-cover: ${frontmatter.darkBgCover || 'var(--dark-background)'};`);
    vars.push(`  --dark-bg-title: ${frontmatter.darkBgTitle || 'var(--dark-background)'};`);
    vars.push(`  --dark-bg-section: ${frontmatter.darkBgSection || 'var(--dark-background)'};`);

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
    const slidesData = ${JSON.stringify(
      slides.map((s, i) => ({
        index: i,
        notes: s.speakerNotes,
        html: this.renderSingleSlideHTML(s, i, frontmatter),
      }))
    )};
    
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
      
      notesEl.innerHTML = '';
      if (notes && notes.length > 0) {
        notes.forEach(n => {
          const p = document.createElement('p');
          p.textContent = n;
          notesEl.appendChild(p);
        });
      } else {
        const p = document.createElement('p');
        p.textContent = 'No notes for this slide.';
        notesEl.appendChild(p);
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
