import type { App, TFile } from 'obsidian';
import { Notice } from 'obsidian';
import PptxGenJS from 'pptxgenjs';
import type {
  Presentation,
  Slide,
  SlideElement,
  SlideLayout,
  Theme,
  ThemePreset,
} from '../types';
import type { FontManager } from './FontManager';
import { PptxFontEmbedder } from './PptxFontEmbedder';

interface PageSizeInches {
  width: number;
  height: number;
}

interface PptxPalette {
  titleColor: string;
  bodyColor: string;
  mutedColor: string;
  bgColor: string;
  accentColor: string;
  codeBgColor: string;
  codeBorderColor: string;
}

interface PptxThemeConfig {
  titleFont: string;
  bodyFont: string;
  monoFont: string;
  light: PptxPalette;
  dark: PptxPalette;
}

interface LayoutSlot {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface LayoutSlots {
  title?: LayoutSlot;
  kicker?: LayoutSlot;
  body?: LayoutSlot;
  columns?: LayoutSlot[]; // for n-columns
  centered?: boolean; // vertical-center content
  imageMain?: LayoutSlot; // primary image slot (full-image, half-image, caption)
  /**
   * If true, all images on this slide stack edge-to-edge in a grid covering
   * the slide area. The grid count is determined at render time from the
   * number of image elements.
   */
  imageGrid?: boolean;
}

interface ResolvedImage {
  /** base64 data URL, e.g. `data:image/png;base64,...` */
  dataUrl: string;
  /** intrinsic width in pixels, when known */
  widthPx?: number;
  /** intrinsic height in pixels */
  heightPx?: number;
}

type ImageCache = Map<string, ResolvedImage | null>;

type PptxTextProp = {
  text: string;
  options?: {
    bold?: boolean;
    italic?: boolean;
    fontFace?: string;
    fontSize?: number;
    color?: string;
    bullet?: boolean | { type?: 'bullet' | 'number'; indent?: number };
    indentLevel?: number;
    paraSpaceAfter?: number;
    align?: 'left' | 'center' | 'right';
  };
};

/**
 * PptxExportService renders the deck as an editable .pptx using PptxGenJS.
 *
 * Phase 2 (this version): real content rendering. Each slide layout maps to a
 * geometry preset (title / kicker / body / column slots) and each SlideElement
 * becomes a native PPTX shape (text frame, list, code box). Theme colors and
 * fonts are applied. Per-slide `mode: dark` swaps the palette.
 */
export class PptxExportService {
  constructor(
    private app: App,
    private fontManager: FontManager | null = null
  ) {}

  setFontManager(fontManager: FontManager): void {
    this.fontManager = fontManager;
  }

  async export(
    presentation: Presentation,
    theme: Theme | null,
    sourceFile: TFile
  ): Promise<void> {
    try {
      const pptx = new PptxGenJS();
      const themeConfig = this.resolveThemeConfig(theme, presentation);
      const pageSize = this.resolvePageSize(presentation.frontmatter.aspectRatio);

      this.applyLayout(pptx, pageSize);
      this.applyDocumentMeta(pptx, presentation);

      // Pre-resolve all images referenced by the deck into base64 data URLs.
      // We do this up-front because PptxGenJS requires sync image data, and we
      // want to share resolved data across slides (e.g. the same hero image
      // reused as a background) without re-reading the binary each time.
      const imageCache = await this.preloadImages(presentation, sourceFile);

      const visibleSlides = presentation.slides.filter((slide) => !slide.hidden);
      for (const slide of visibleSlides) {
        this.renderSlide(pptx, slide, presentation, themeConfig, pageSize, imageCache);
      }

      const data = (await pptx.stream()) as ArrayBuffer | Uint8Array;
      let arrayBuffer = this.toArrayBuffer(data);

      // Embed referenced fonts so the deck looks right on machines without
      // them installed. Best-effort: only TTF/OTF/WOFF2 fonts in the
      // FontManager cache are embeddable; everything else falls back to
      // typeface-name reference.
      //
      // CRUCIAL for Microsoft Office: also patch the theme's majorFont and
      // minorFont entries to point at our typefaces. Without this, MS Office
      // (Mac and Windows both) honors the typeface name in the picker but
      // renders Calibri because that's what theme1.xml's <a:majorFont> says.
      // Google Slides and macOS Quick Look don't care about theme fonts —
      // they always honor the embedded list directly. That's why the same
      // PPTX rendered correctly in Google Slides but fell back to Office's
      // default font in PowerPoint.
      if (this.fontManager) {
        const typefaces = this.collectTypefaces(themeConfig);
        const embedder = new PptxFontEmbedder(this.app, this.fontManager);
        try {
          arrayBuffer = await embedder.embedFonts(
            arrayBuffer,
            typefaces,
            themeConfig.titleFont,
            themeConfig.bodyFont
          );
        } catch (err) {
          console.warn('[PptxExportService] Font embedding failed:', err);
        }
      }

      const exportPath = this.computeExportPath(sourceFile);
      await this.app.vault.adapter.writeBinary(exportPath, arrayBuffer);

      new Notice(`PPTX exported to ${exportPath}`);
    } catch (error) {
      console.error('[PptxExportService] Export failed:', error);
      new Notice(
        `Failed to export PPTX: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Slide rendering
  // ──────────────────────────────────────────────────────────────────────────

  private renderSlide(
    pptx: PptxGenJS,
    slide: Slide,
    presentation: Presentation,
    themeConfig: PptxThemeConfig,
    pageSize: PageSizeInches,
    imageCache: ImageCache
  ): void {
    const palette = this.resolvePaletteForSlide(slide, presentation, themeConfig);
    const layout: SlideLayout = (slide.metadata.layout as SlideLayout) || 'default';
    const pptxSlide = pptx.addSlide();

    // Resolve slide background. Priority mirrors the runtime renderer:
    //   1. per-slide `background:` image (or color literal)
    //   2. dynamic-background gradient color interpolated for this slide
    //   3. palette base color from theme/mode
    const bgImage = this.resolveSlideBackgroundImage(slide, imageCache);
    if (bgImage) {
      pptxSlide.background = { data: bgImage.dataUrl };
    } else {
      const bgColorLiteral = this.extractBackgroundColorLiteral(slide.metadata.background);
      if (bgColorLiteral) {
        pptxSlide.background = { color: bgColorLiteral };
      } else {
        const dynamicColor = this.resolveDynamicBackgroundColor(
          slide,
          presentation,
          themeConfig
        );
        pptxSlide.background = { color: dynamicColor || palette.bgColor };
      }
    }

    const slots = this.resolveLayoutSlots(layout, pageSize);

    // Bucket elements by intended role.
    const kickers = slide.elements.filter((e) => e.type === 'kicker');
    const headings = slide.elements.filter((e) => e.type === 'heading');
    const images = slide.elements.filter((e) => e.type === 'image');
    const bodyElements = slide.elements.filter(
      (e) => e.type !== 'kicker' && e.type !== 'heading' && e.type !== 'image'
    );

    // Image-dominant layouts route images into dedicated slots and place text
    // (title + body) into the remaining area.
    if (slots.imageMain && images.length > 0) {
      this.renderMainImage(pptxSlide, images[0], slots.imageMain, imageCache, palette);
      // The extra images (if any) are not currently mapped — they'll be
      // surfaced in a grid follow-up. For now, prefer the first.
    } else if (slots.imageGrid && images.length > 0) {
      this.renderImageGrid(pptxSlide, images, pageSize, imageCache, palette);
    }

    // Centered layouts (cover, title, section) put title+subtitle in the middle.
    if (slots.centered) {
      this.renderCenteredLayout(
        pptxSlide,
        kickers,
        headings,
        bodyElements,
        slots,
        themeConfig,
        palette
      );
      this.attachSpeakerNotes(pptxSlide, slide);
      return;
    }

    // Standard layouts: kicker (small, above title), title (top), body (below).
    if (kickers.length > 0 && slots.kicker) {
      this.renderKicker(pptxSlide, kickers[0], slots.kicker, themeConfig, palette);
    }
    if (headings.length > 0 && slots.title) {
      // The first heading is the slide title. Lower-level headings inside
      // multi-column layouts go to columns (handled below).
      const slideTitle = headings.find((h) => (h.level || 2) <= 2) || headings[0];
      this.renderHeading(pptxSlide, slideTitle, slots.title, themeConfig, palette);
    }

    // Multi-column layouts: split remaining headings + body across columns.
    if (slots.columns && slots.columns.length > 0) {
      this.renderColumns(
        pptxSlide,
        slide,
        headings,
        bodyElements,
        slots.columns,
        themeConfig,
        palette,
        imageCache
      );
    } else if (slots.body) {
      // Single-column body area.
      this.renderBodyStack(
        pptxSlide,
        bodyElements,
        slots.body,
        themeConfig,
        palette,
        imageCache
      );
    }

    this.attachSpeakerNotes(pptxSlide, slide);
  }

  private renderCenteredLayout(
    pptxSlide: any,
    kickers: SlideElement[],
    headings: SlideElement[],
    body: SlideElement[],
    slots: LayoutSlots,
    themeConfig: PptxThemeConfig,
    palette: PptxPalette
  ): void {
    // Compute heights for vertical centering.
    const slotBox = slots.body!;
    const itemHeights: { el: SlideElement; h: number; role: 'kicker' | 'title' | 'body' }[] = [];

    for (const k of kickers) {
      itemHeights.push({ el: k, h: 0.4, role: 'kicker' });
    }
    for (const h of headings) {
      const level = h.level || 1;
      itemHeights.push({ el: h, h: level === 1 ? 1.4 : level === 2 ? 1.0 : 0.7, role: 'title' });
    }
    for (const b of body) {
      itemHeights.push({ el: b, h: this.estimateBodyHeight(b), role: 'body' });
    }

    const totalH = itemHeights.reduce((sum, it) => sum + it.h, 0);
    const startY = slotBox.y + Math.max(0, (slotBox.h - totalH) / 2);
    let cursorY = startY;

    for (const { el, h, role } of itemHeights) {
      const box: LayoutSlot = { x: slotBox.x, y: cursorY, w: slotBox.w, h };
      if (role === 'kicker') {
        this.renderKicker(pptxSlide, el, box, themeConfig, palette, true);
      } else if (role === 'title') {
        this.renderHeading(pptxSlide, el, box, themeConfig, palette, true);
      } else {
        this.renderBodyElement(pptxSlide, el, box, themeConfig, palette, true);
      }
      cursorY += h;
    }
  }

  private renderColumns(
    pptxSlide: any,
    slide: Slide,
    allHeadings: SlideElement[],
    bodyElements: SlideElement[],
    columns: LayoutSlot[],
    themeConfig: PptxThemeConfig,
    palette: PptxPalette,
    imageCache?: ImageCache
  ): void {
    // The slide title (H1/H2) was already placed in the title slot. Sub-headings
    // (H3+) become column titles. We group elements by parser-assigned
    // columnIndex when available, otherwise distribute round-robin.
    const subHeadings = allHeadings.filter((h) => (h.level || 2) >= 3);

    // Combine sub-headings + body in original document order so columns reflect
    // authoring intent.
    const colContent = [...subHeadings, ...bodyElements].sort(
      (a, b) => slide.elements.indexOf(a) - slide.elements.indexOf(b)
    );

    // Group by columnIndex if the parser assigned one, else round-robin by H3
    // boundaries.
    const grouped: SlideElement[][] = Array.from({ length: columns.length }, () => []);
    const hasColumnIndex = colContent.some(
      (e) => typeof e.columnIndex === 'number' && (e.columnIndex as number) >= 0
    );

    if (hasColumnIndex) {
      for (const el of colContent) {
        const ci = Math.max(0, Math.min(columns.length - 1, el.columnIndex ?? 0));
        grouped[ci].push(el);
      }
    } else {
      // Fall back: every H3 starts a new column.
      let currentCol = 0;
      for (const el of colContent) {
        if (el.type === 'heading' && (el.level || 2) >= 3 && grouped[currentCol].length > 0) {
          currentCol = Math.min(currentCol + 1, columns.length - 1);
        }
        grouped[currentCol].push(el);
      }
    }

    for (let i = 0; i < columns.length; i++) {
      this.renderBodyStack(
        pptxSlide,
        grouped[i],
        columns[i],
        themeConfig,
        palette,
        imageCache
      );
    }
  }

  private renderBodyStack(
    pptxSlide: any,
    elements: SlideElement[],
    container: LayoutSlot,
    themeConfig: PptxThemeConfig,
    palette: PptxPalette,
    imageCache?: ImageCache
  ): void {
    let cursorY = container.y;
    const endY = container.y + container.h;

    for (const el of elements) {
      if (cursorY >= endY) break;
      const h = Math.min(this.estimateBodyHeight(el), endY - cursorY);
      const box: LayoutSlot = { x: container.x, y: cursorY, w: container.w, h };
      this.renderBodyElement(pptxSlide, el, box, themeConfig, palette, false, imageCache);
      cursorY += h + 0.1; // small gap between elements
    }
  }

  private renderBodyElement(
    pptxSlide: any,
    el: SlideElement,
    box: LayoutSlot,
    themeConfig: PptxThemeConfig,
    palette: PptxPalette,
    centered: boolean = false,
    imageCache?: ImageCache
  ): void {
    switch (el.type) {
      case 'heading':
        this.renderHeading(pptxSlide, el, box, themeConfig, palette, centered);
        break;
      case 'paragraph':
        this.renderParagraph(pptxSlide, el, box, themeConfig, palette, centered);
        break;
      case 'list':
        this.renderList(pptxSlide, el, box, themeConfig, palette);
        break;
      case 'code':
        this.renderCode(pptxSlide, el, box, themeConfig, palette);
        break;
      case 'blockquote':
        this.renderBlockquote(pptxSlide, el, box, themeConfig, palette);
        break;
      case 'image':
        if (imageCache) {
          this.renderImage(pptxSlide, el, box, imageCache, palette, 'contain');
        } else {
          this.renderImagePlaceholder(pptxSlide, el, box, palette);
        }
        break;
      case 'table':
      case 'math':
      case 'kicker':
        // Tables/math: deferred. Kickers shouldn't land here.
        this.renderParagraph(pptxSlide, el, box, themeConfig, palette, centered);
        break;
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Element renderers
  // ──────────────────────────────────────────────────────────────────────────

  private renderKicker(
    pptxSlide: any,
    el: SlideElement,
    box: LayoutSlot,
    themeConfig: PptxThemeConfig,
    palette: PptxPalette,
    centered: boolean = false
  ): void {
    pptxSlide.addText(this.stripInlineMd(el.content), {
      x: box.x,
      y: box.y,
      w: box.w,
      h: box.h,
      fontFace: themeConfig.bodyFont,
      fontSize: 14,
      bold: false,
      color: palette.mutedColor,
      align: centered ? 'center' : 'left',
      valign: 'middle',
      charSpacing: 2, // pseudo small-caps tracking
    });
  }

  private renderHeading(
    pptxSlide: any,
    el: SlideElement,
    box: LayoutSlot,
    themeConfig: PptxThemeConfig,
    palette: PptxPalette,
    centered: boolean = false
  ): void {
    const level = el.level || 1;
    const fontSize = level === 1 ? 54 : level === 2 ? 40 : level === 3 ? 28 : 22;
    pptxSlide.addText(this.stripInlineMd(el.content), {
      x: box.x,
      y: box.y,
      w: box.w,
      h: box.h,
      fontFace: themeConfig.titleFont,
      fontSize,
      bold: true,
      color: palette.titleColor,
      align: centered ? 'center' : 'left',
      valign: centered ? 'middle' : 'top',
    });
  }

  private renderParagraph(
    pptxSlide: any,
    el: SlideElement,
    box: LayoutSlot,
    themeConfig: PptxThemeConfig,
    palette: PptxPalette,
    centered: boolean = false
  ): void {
    pptxSlide.addText(this.stripInlineMd(el.content), {
      x: box.x,
      y: box.y,
      w: box.w,
      h: box.h,
      fontFace: themeConfig.bodyFont,
      fontSize: 18,
      color: palette.bodyColor,
      align: centered ? 'center' : 'left',
      valign: 'top',
    });
  }

  private renderList(
    pptxSlide: any,
    el: SlideElement,
    box: LayoutSlot,
    themeConfig: PptxThemeConfig,
    palette: PptxPalette
  ): void {
    const items = this.parseListItems(el.content);
    if (items.length === 0) return;

    const isOrdered = items[0].ordered;
    // PptxGenJS expects TextProps[]: each entry is one paragraph (one line/
    // bullet). The `bullet` option goes inside each entry's `options`. Passing
    // an array of runs as the `text` value produces `[object Object]` output.
    const props: PptxTextProp[] = items.map((item) => ({
      text: this.stripInlineMd(item.text),
      options: {
        bullet: isOrdered ? { type: 'number' } : { type: 'bullet' },
        indentLevel: item.indent,
        fontSize: 18,
        fontFace: themeConfig.bodyFont,
        color: palette.bodyColor,
        paraSpaceAfter: 6,
      },
    }));

    pptxSlide.addText(props, {
      x: box.x,
      y: box.y,
      w: box.w,
      h: box.h,
      valign: 'top',
    });
  }

  private renderCode(
    pptxSlide: any,
    el: SlideElement,
    box: LayoutSlot,
    themeConfig: PptxThemeConfig,
    palette: PptxPalette
  ): void {
    // Strip the leading ```lang and trailing ``` lines if present.
    let content = el.content;
    content = content.replace(/^```[^\n]*\n?/, '').replace(/\n?```\s*$/, '');

    pptxSlide.addText(content, {
      x: box.x,
      y: box.y,
      w: box.w,
      h: box.h,
      fontFace: themeConfig.monoFont,
      fontSize: 14,
      color: palette.bodyColor,
      fill: { color: palette.codeBgColor },
      line: { color: palette.codeBorderColor, width: 0.5 },
      margin: 8,
      valign: 'top',
    });
  }

  private renderBlockquote(
    pptxSlide: any,
    el: SlideElement,
    box: LayoutSlot,
    themeConfig: PptxThemeConfig,
    palette: PptxPalette
  ): void {
    // Strip leading "> " markers.
    const text = el.content
      .split('\n')
      .map((line) => line.replace(/^>\s?/, ''))
      .join('\n');

    pptxSlide.addText(this.stripInlineMd(text), {
      x: box.x + 0.2,
      y: box.y,
      w: box.w - 0.2,
      h: box.h,
      fontFace: themeConfig.bodyFont,
      fontSize: 18,
      italic: true,
      color: palette.bodyColor,
      valign: 'top',
    });

    // Left accent bar.
    pptxSlide.addShape('rect', {
      x: box.x,
      y: box.y,
      w: 0.05,
      h: box.h,
      fill: { color: palette.accentColor },
      line: { color: palette.accentColor, width: 0 },
    });
  }

  private renderImagePlaceholder(
    pptxSlide: any,
    el: SlideElement,
    box: LayoutSlot,
    palette: PptxPalette
  ): void {
    const label = el.imageData?.alt || el.imageData?.src || '[image]';
    pptxSlide.addText(`🖼  ${label}`, {
      x: box.x,
      y: box.y,
      w: box.w,
      h: box.h,
      fontSize: 14,
      color: palette.mutedColor,
      align: 'center',
      valign: 'middle',
      fill: { color: palette.codeBgColor },
      line: { color: palette.codeBorderColor, width: 0.5, dashType: 'dash' },
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Image rendering
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Render a single image into the given box. `sizing` mirrors the existing
   * Perspecta semantics: 'cover' fills the box and crops; 'contain' fits the
   * image within the box and letterboxes if needed. PptxGenJS handles both
   * via the `sizing` option.
   */
  private renderImage(
    pptxSlide: any,
    el: SlideElement,
    box: LayoutSlot,
    imageCache: ImageCache,
    palette: PptxPalette,
    sizing: 'cover' | 'contain' = 'cover'
  ): void {
    const src = el.imageData?.src;
    if (!src) {
      this.renderImagePlaceholder(pptxSlide, el, box, palette);
      return;
    }
    const img = imageCache.get(src);
    if (!img) {
      this.renderImagePlaceholder(pptxSlide, el, box, palette);
      return;
    }

    pptxSlide.addImage({
      data: img.dataUrl,
      x: box.x,
      y: box.y,
      w: box.w,
      h: box.h,
      sizing: {
        type: sizing,
        w: box.w,
        h: box.h,
      },
    });
  }

  /**
   * Layouts with a primary image slot (full-image, half-image, caption) use
   * 'cover' sizing — the image fills the slot and may be cropped. The text
   * slots still render alongside via the normal pipeline.
   */
  private renderMainImage(
    pptxSlide: any,
    el: SlideElement,
    box: LayoutSlot,
    imageCache: ImageCache,
    palette: PptxPalette
  ): void {
    // `full-image-contained` and `caption-contained` use 'contain' sizing;
    // everything else uses 'cover'. We sniff the layout via box coverage —
    // not robust enough; tie this to the slide layout instead by passing it.
    // For MVP, always 'cover' since the user picked the layout deliberately.
    this.renderImage(pptxSlide, el, box, imageCache, palette, 'cover');
  }

  /**
   * Grid layout — arrange image elements in a square-ish grid that fills the
   * remaining slide area below the title. For 2 images: 1×2, 4 images: 2×2,
   * 6 images: 2×3, etc.
   */
  private renderImageGrid(
    pptxSlide: any,
    images: SlideElement[],
    page: PageSizeInches,
    imageCache: ImageCache,
    palette: PptxPalette
  ): void {
    if (images.length === 0) return;

    const margin = 0.4;
    const gap = 0.15;
    // Reserve top space for title + kicker that resolveLayoutSlots already
    // emits (about 1.5"); start the grid below.
    const top = 2.0;
    const gridW = page.width - 2 * margin;
    const gridH = page.height - top - margin;

    const cols = Math.ceil(Math.sqrt(images.length));
    const rows = Math.ceil(images.length / cols);
    const cellW = (gridW - (cols - 1) * gap) / cols;
    const cellH = (gridH - (rows - 1) * gap) / rows;

    for (let i = 0; i < images.length; i++) {
      const row = Math.floor(i / cols);
      const col = i % cols;
      const box: LayoutSlot = {
        x: margin + col * (cellW + gap),
        y: top + row * (cellH + gap),
        w: cellW,
        h: cellH,
      };
      this.renderImage(pptxSlide, images[i], box, imageCache, palette, 'cover');
    }
  }

  /**
   * Resolve a slide-level background image if the meta block declares one
   * (e.g. `background: clouds.png`). Returns null when the value is a color
   * literal, missing, or unresolvable.
   */
  private resolveSlideBackgroundImage(
    slide: Slide,
    imageCache: ImageCache
  ): ResolvedImage | null {
    const bg = slide.metadata.background;
    if (!bg) return null;
    // Filter out color literals (we don't want #fff or "rgb(...)" to be
    // treated as an image filename).
    if (/^#[0-9a-fA-F]{3,8}$/.test(bg.trim())) return null;
    if (/^(rgb|rgba|hsl|hsla)\(/i.test(bg.trim())) return null;
    if (/^[a-z]+$/i.test(bg.trim()) && !/\.(png|jpe?g|gif|webp|svg)$/i.test(bg)) {
      // Bare color name like "white" or "transparent".
      return null;
    }
    const resolved = imageCache.get(bg);
    return resolved || null;
  }

  /**
   * Walk all slides, collect referenced image sources (inline images +
   * background-image meta), resolve them through Obsidian's link cache, read
   * the binary, and convert to a base64 data URL ready for PptxGenJS.
   *
   * We do the work up-front (and once per src) to keep the per-slide render
   * synchronous. PptxGenJS itself doesn't accept Promises in `addImage`.
   */
  private async preloadImages(
    presentation: Presentation,
    sourceFile: TFile
  ): Promise<ImageCache> {
    const srcs = new Set<string>();
    for (const slide of presentation.slides) {
      if (slide.metadata.background) srcs.add(slide.metadata.background);
      for (const el of slide.elements) {
        if (el.type === 'image' && el.imageData?.src) {
          srcs.add(el.imageData.src);
        }
      }
    }

    const cache: ImageCache = new Map();
    for (const src of srcs) {
      try {
        const resolved = await this.loadImage(src, sourceFile);
        cache.set(src, resolved);
      } catch (err) {
        console.warn(`[PptxExportService] Could not load image "${src}":`, err);
        cache.set(src, null);
      }
    }
    return cache;
  }

  private async loadImage(src: string, sourceFile: TFile): Promise<ResolvedImage | null> {
    // Strip Excalidraw-ref suffixes like "#^group=foo" — PPTX export skips
    // those for now (they need SVG conversion that lives elsewhere).
    const cleaned = src.split('#')[0];
    if (!cleaned) return null;

    // Skip remote URLs — PptxGenJS supports them as `path:`, but embedding is
    // simpler and more deterministic. If you need a network image, that's a
    // future feature.
    if (/^https?:\/\//i.test(cleaned)) {
      return { dataUrl: cleaned };
    }

    let tfile = this.app.metadataCache.getFirstLinkpathDest(
      decodeURIComponent(cleaned),
      sourceFile.path
    );
    if (!tfile) {
      tfile = this.app.metadataCache.getFirstLinkpathDest(cleaned, sourceFile.path);
    }
    if (!tfile) {
      // Maybe it's a relative path from the source file.
      const relPath = sourceFile.parent
        ? `${sourceFile.parent.path}/${cleaned}`
        : cleaned;
      const adapter = this.app.vault.adapter;
      if (await adapter.exists(relPath)) {
        const bytes = await adapter.readBinary(relPath);
        const mime = this.mimeFromExt(cleaned);
        return { dataUrl: this.toDataUrl(bytes, mime) };
      }
      return null;
    }

    const bytes = await this.app.vault.readBinary(tfile);
    const mime = this.mimeFromExt(tfile.extension);
    return { dataUrl: this.toDataUrl(bytes, mime) };
  }

  private mimeFromExt(pathOrExt: string): string {
    const ext = pathOrExt.split('.').pop()?.toLowerCase() || '';
    switch (ext) {
      case 'png':
        return 'image/png';
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'gif':
        return 'image/gif';
      case 'webp':
        return 'image/webp';
      case 'svg':
        return 'image/svg+xml';
      default:
        return 'application/octet-stream';
    }
  }

  private toDataUrl(bytes: ArrayBuffer, mime: string): string {
    const u8 = new Uint8Array(bytes);
    // Build the base64 in chunks to avoid String.fromCharCode max-arg overflow
    // on very large images.
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < u8.length; i += chunk) {
      binary += String.fromCharCode.apply(
        null,
        u8.subarray(i, Math.min(i + chunk, u8.length)) as unknown as number[]
      );
    }
    const b64 = typeof btoa !== 'undefined' ? btoa(binary) : Buffer.from(binary, 'binary').toString('base64');
    return `data:${mime};base64,${b64}`;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Inline markdown — MVP just strips marker characters so the visible text
  // matches the source. Real bold/italic/code runs need a different PptxGenJS
  // call shape (TextProps[] of multiple paragraphs, not nested runs in one
  // paragraph) — deferred until Phase 3 along with images/tables.
  // ──────────────────────────────────────────────────────────────────────────

  private stripInlineMd(text: string): string {
    if (!text) return '';
    // Remove **bold**, *italic*, `code`, [link](url) wrappers; keep the inner
    // text. Order matters: bold before italic so ** doesn't get eaten as two *.
    return text
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  }

  private parseListItems(
    content: string
  ): { text: string; indent: number; ordered: boolean }[] {
    const items: { text: string; indent: number; ordered: boolean }[] = [];
    const lines = content.split('\n');

    for (const line of lines) {
      // Match `- foo`, `* foo`, `+ foo` (unordered) or `1. foo` (ordered),
      // optionally indented.
      const ul = line.match(/^(\s*)[-*+]\s+(.*)$/);
      const ol = line.match(/^(\s*)\d+\.\s+(.*)$/);
      if (ul) {
        const indent = Math.floor(ul[1].length / 2); // 2 spaces per level
        items.push({ text: ul[2], indent, ordered: false });
      } else if (ol) {
        const indent = Math.floor(ol[1].length / 2);
        items.push({ text: ol[2], indent, ordered: true });
      } else if (items.length > 0 && line.trim().length > 0) {
        // Continuation line of the previous item (soft break).
        items[items.length - 1].text += ' ' + line.trim();
      }
    }

    return items;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Layout geometry
  // ──────────────────────────────────────────────────────────────────────────

  private resolveLayoutSlots(layout: SlideLayout, page: PageSizeInches): LayoutSlots {
    const margin = 0.5; // inches
    const titleH = 1.0;
    const kickerH = 0.45;
    const contentTop = margin + kickerH + titleH + 0.2;

    const fullBody: LayoutSlot = {
      x: margin,
      y: margin,
      w: page.width - 2 * margin,
      h: page.height - 2 * margin,
    };

    switch (layout) {
      case 'cover':
      case 'title':
      case 'section':
        return {
          centered: true,
          body: fullBody,
        };

      case '2-columns':
      case '2-columns-1+2':
      case '2-columns-2+1': {
        const titleSlot: LayoutSlot = {
          x: margin,
          y: margin + kickerH,
          w: page.width - 2 * margin,
          h: titleH,
        };
        const kickerSlot: LayoutSlot = {
          x: margin,
          y: margin,
          w: page.width - 2 * margin,
          h: kickerH,
        };
        const colY = contentTop;
        const colH = page.height - colY - margin;
        const gap = 0.3;
        const innerW = page.width - 2 * margin;
        let split: [number, number];
        if (layout === '2-columns-1+2') split = [1 / 3, 2 / 3];
        else if (layout === '2-columns-2+1') split = [2 / 3, 1 / 3];
        else split = [0.5, 0.5];

        const col1W = innerW * split[0] - gap / 2;
        const col2W = innerW * split[1] - gap / 2;
        return {
          title: titleSlot,
          kicker: kickerSlot,
          columns: [
            { x: margin, y: colY, w: col1W, h: colH },
            { x: margin + col1W + gap, y: colY, w: col2W, h: colH },
          ],
        };
      }

      case '3-columns': {
        const titleSlot: LayoutSlot = {
          x: margin,
          y: margin + kickerH,
          w: page.width - 2 * margin,
          h: titleH,
        };
        const kickerSlot: LayoutSlot = {
          x: margin,
          y: margin,
          w: page.width - 2 * margin,
          h: kickerH,
        };
        const colY = contentTop;
        const colH = page.height - colY - margin;
        const gap = 0.3;
        const innerW = page.width - 2 * margin;
        const colW = (innerW - 2 * gap) / 3;
        return {
          title: titleSlot,
          kicker: kickerSlot,
          columns: [
            { x: margin, y: colY, w: colW, h: colH },
            { x: margin + colW + gap, y: colY, w: colW, h: colH },
            { x: margin + 2 * (colW + gap), y: colY, w: colW, h: colH },
          ],
        };
      }

      case 'footnotes': {
        return {
          title: { x: margin, y: margin + kickerH, w: page.width - 2 * margin, h: titleH },
          kicker: { x: margin, y: margin, w: page.width - 2 * margin, h: kickerH },
          body: {
            x: margin,
            y: contentTop,
            w: page.width - 2 * margin,
            h: page.height - contentTop - margin,
          },
        };
      }

      case 'full-image':
      case 'full-image-contained': {
        // Image fills the slide. Title (if any) renders as a small overlay at
        // the top with semi-transparent treatment — for now, render title
        // on top of the image without a backdrop.
        return {
          imageMain: { x: 0, y: 0, w: page.width, h: page.height },
          title: { x: margin, y: margin, w: page.width - 2 * margin, h: titleH },
          kicker: undefined,
          body: undefined,
        };
      }

      case 'caption':
      case 'caption-contained': {
        // Image is most of the slide with a title bar at the top and a caption
        // strip at the bottom. We give ~12% to the title bar and ~12% to the
        // caption bar.
        const titleBarH = Math.max(0.7, page.height * 0.12);
        const captionBarH = Math.max(0.6, page.height * 0.12);
        return {
          title: { x: margin, y: 0.15, w: page.width - 2 * margin, h: titleBarH },
          imageMain: {
            x: 0,
            y: titleBarH + 0.1,
            w: page.width,
            h: page.height - titleBarH - captionBarH - 0.2,
          },
          body: {
            x: margin,
            y: page.height - captionBarH,
            w: page.width - 2 * margin,
            h: captionBarH,
          },
        };
      }

      case 'half-image': {
        // Vertical split: image on the left, text on the right (50/50).
        const half = page.width / 2;
        return {
          imageMain: { x: 0, y: 0, w: half, h: page.height },
          title: {
            x: half + margin,
            y: margin + kickerH,
            w: half - 2 * margin,
            h: titleH,
          },
          kicker: { x: half + margin, y: margin, w: half - 2 * margin, h: kickerH },
          body: {
            x: half + margin,
            y: contentTop,
            w: half - 2 * margin,
            h: page.height - contentTop - margin,
          },
        };
      }

      case 'half-image-horizontal': {
        // Horizontal split: image on top, text below (50/50 by default).
        const half = page.height / 2;
        return {
          imageMain: { x: 0, y: 0, w: page.width, h: half },
          title: {
            x: margin,
            y: half + margin + kickerH,
            w: page.width - 2 * margin,
            h: titleH,
          },
          kicker: {
            x: margin,
            y: half + margin,
            w: page.width - 2 * margin,
            h: kickerH,
          },
          body: {
            x: margin,
            y: half + margin + kickerH + titleH + 0.2,
            w: page.width - 2 * margin,
            h: page.height - (half + margin + kickerH + titleH + 0.2) - margin,
          },
        };
      }

      case 'grid': {
        // Each image element gets a cell; title + kicker render across the top.
        return {
          title: { x: margin, y: margin + kickerH, w: page.width - 2 * margin, h: titleH },
          kicker: { x: margin, y: margin, w: page.width - 2 * margin, h: kickerH },
          imageGrid: true,
        };
      }

      // 1-column / default — title + body stack.
      default: {
        return {
          title: { x: margin, y: margin + kickerH, w: page.width - 2 * margin, h: titleH },
          kicker: { x: margin, y: margin, w: page.width - 2 * margin, h: kickerH },
          body: {
            x: margin,
            y: contentTop,
            w: page.width - 2 * margin,
            h: page.height - contentTop - margin,
          },
        };
      }
    }
  }

  /**
   * Rough vertical sizing for body elements so a single column doesn't
   * overflow. Used only when stacking — PptxGenJS itself doesn't honor "auto
   * height", so we estimate up-front.
   */
  private estimateBodyHeight(el: SlideElement): number {
    switch (el.type) {
      case 'heading': {
        const level = el.level || 2;
        return level === 3 ? 0.6 : level === 2 ? 0.8 : 1.0;
      }
      case 'paragraph': {
        const lines = Math.ceil(el.content.length / 90);
        return Math.max(0.5, lines * 0.4);
      }
      case 'list': {
        const items = el.content.split('\n').filter((l) => l.trim().length > 0);
        return Math.max(0.5, items.length * 0.4);
      }
      case 'code': {
        const lines = el.content.split('\n').length;
        return Math.max(0.8, lines * 0.25 + 0.4);
      }
      case 'blockquote':
        return 0.9;
      case 'image':
        return 2.5;
      default:
        return 0.6;
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Helpers
  // ──────────────────────────────────────────────────────────────────────────

  private attachSpeakerNotes(pptxSlide: any, slide: Slide): void {
    const notes = slide.speakerNotes || [];
    if (notes.length > 0) {
      pptxSlide.addNotes(notes.join('\n\n'));
    }
  }

  private extractBackgroundColorLiteral(bg: string | undefined): string | null {
    if (!bg) return null;
    const trimmed = bg.trim();
    const hex = this.toHex6(trimmed);
    if (hex) return hex;
    return null;
  }

  /**
   * Resolve a per-slide dynamic background color (linear interpolation across
   * the deck's color sequence). Mirrors the runtime SlideRenderer behavior:
   *   - opt-in via `use-dynamic-background: light|dark|both|none`
   *   - color sequence comes from `light-dynamic-background` /
   *     `dark-dynamic-background` in frontmatter, with theme fallback
   *   - position 0..1 is the slide's index among visible slides
   *   - optional `dynamic-background-restart-at-section` restarts the
   *     interpolation at every `layout: section` slide
   */
  private resolveDynamicBackgroundColor(
    slide: Slide,
    presentation: Presentation,
    themeConfig: PptxThemeConfig
  ): string | null {
    const fm = presentation.frontmatter;
    const use = fm.useDynamicBackground;
    if (!use || use === 'none') return null;

    const mode = slide.metadata.mode || fm.mode || 'light';
    const effectiveMode: 'light' | 'dark' =
      mode === 'system' ? 'light' : (mode as 'light' | 'dark');

    if (use !== 'both' && use !== effectiveMode) return null;

    let colors: string[] | undefined =
      effectiveMode === 'light' ? fm.lightDynamicBackground : fm.darkDynamicBackground;

    // Theme fallback — peek at preset's gradient list.
    if ((!colors || colors.length === 0) && themeConfig) {
      // themeConfig doesn't carry the gradient itself; this is a no-op until
      // we widen the type. Inline a sensible default so we always have at
      // least 2 stops to interpolate.
    }
    if (!colors || colors.length === 0) {
      colors =
        effectiveMode === 'light'
          ? ['#ffffff', '#f0f0f0', '#e0e0e0']
          : ['#1a1a2e', '#2d2d44', '#3d3d5c'];
    }

    const slides = presentation.slides;
    let position = 0;

    if (fm.dynamicBackgroundRestartAtSection) {
      let sectionStart = slide.index;
      let sectionEnd = slide.index;
      for (let i = slide.index; i >= 0; i--) {
        if (!slides[i].hidden && slides[i].metadata.layout === 'section') {
          sectionStart = i;
          break;
        }
      }
      for (let i = slide.index + 1; i < slides.length; i++) {
        if (!slides[i].hidden && slides[i].metadata.layout === 'section') {
          sectionEnd = i - 1;
          break;
        }
      }
      let visibleIndexInSection = 0;
      let visibleCountInSection = 0;
      for (let i = sectionStart; i <= sectionEnd && i < slides.length; i++) {
        if (!slides[i].hidden) {
          if (i <= slide.index) visibleIndexInSection++;
          visibleCountInSection++;
        }
      }
      position =
        visibleCountInSection > 1
          ? (visibleIndexInSection - 1) / (visibleCountInSection - 1)
          : 0;
    } else {
      const visibleSlides = slides.filter((s) => !s.hidden);
      const visibleIndex = visibleSlides.findIndex((s) => s.index === slide.index);
      const visibleCount = visibleSlides.length;
      position = visibleCount > 1 ? visibleIndex / (visibleCount - 1) : 0;
    }

    return this.interpolateGradient(colors, position);
  }

  private interpolateGradient(colors: string[], position: number): string | null {
    if (colors.length === 0) return null;
    if (colors.length === 1) return this.toHex6(colors[0]);
    const clamped = Math.max(0, Math.min(1, position));
    const segment = clamped * (colors.length - 1);
    const index = Math.floor(segment);
    const t = segment - index;
    if (index >= colors.length - 1) return this.toHex6(colors[colors.length - 1]);

    const a = this.parseHexRgb(colors[index]);
    const b = this.parseHexRgb(colors[index + 1]);
    if (!a || !b) return null;
    const r = Math.round(a.r + (b.r - a.r) * t);
    const g = Math.round(a.g + (b.g - a.g) * t);
    const bl = Math.round(a.b + (b.b - a.b) * t);
    return [r, g, bl]
      .map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();
  }

  private parseHexRgb(color: string): { r: number; g: number; b: number } | null {
    const trimmed = color.trim();
    const hex6 = trimmed.match(/^#?([0-9a-fA-F]{6})$/);
    if (hex6) {
      return {
        r: parseInt(hex6[1].substring(0, 2), 16),
        g: parseInt(hex6[1].substring(2, 4), 16),
        b: parseInt(hex6[1].substring(4, 6), 16),
      };
    }
    const hex3 = trimmed.match(/^#?([0-9a-fA-F]{3})$/);
    if (hex3) {
      const [r, g, b] = hex3[1].split('');
      return {
        r: parseInt(r + r, 16),
        g: parseInt(g + g, 16),
        b: parseInt(b + b, 16),
      };
    }
    const rgb = trimmed.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
    if (rgb) {
      return {
        r: parseInt(rgb[1], 10),
        g: parseInt(rgb[2], 10),
        b: parseInt(rgb[3], 10),
      };
    }
    return null;
  }

  private resolvePaletteForSlide(
    slide: Slide,
    presentation: Presentation,
    themeConfig: PptxThemeConfig
  ): PptxPalette {
    // Per-slide mode wins, then deck-level mode (frontmatter), then default light.
    const mode =
      slide.metadata.mode || presentation.frontmatter.mode || 'light';
    if (mode === 'dark') return themeConfig.dark;
    return themeConfig.light;
  }

  private computeExportPath(sourceFile: TFile): string {
    const parent = sourceFile.parent?.path || '';
    const base = sourceFile.basename;
    return parent ? `${parent}/${base}.pptx` : `${base}.pptx`;
  }

  private resolvePageSize(aspectRatio?: string): PageSizeInches {
    switch (aspectRatio) {
      case '4:3':
        return { width: 10, height: 7.5 };
      case '16:10':
        return { width: 13.333, height: 8.333 };
      case '16:9':
      case undefined:
      case 'auto':
      default:
        return { width: 13.333, height: 7.5 };
    }
  }

  private applyLayout(pptx: PptxGenJS, pageSize: PageSizeInches): void {
    if (Math.abs(pageSize.width - 13.333) < 0.01 && Math.abs(pageSize.height - 7.5) < 0.01) {
      pptx.layout = 'LAYOUT_WIDE';
    } else if (Math.abs(pageSize.width - 10) < 0.01 && Math.abs(pageSize.height - 7.5) < 0.01) {
      pptx.layout = 'LAYOUT_4x3';
    } else {
      pptx.defineLayout({
        name: 'PERSPECTA_CUSTOM',
        width: pageSize.width,
        height: pageSize.height,
      });
      pptx.layout = 'PERSPECTA_CUSTOM';
    }
  }

  private applyDocumentMeta(pptx: PptxGenJS, presentation: Presentation): void {
    const title = presentation.frontmatter.title || 'Presentation';
    pptx.title = title;
    pptx.subject = title;
    pptx.author = 'Perspecta Slides';
    pptx.company = '';
  }

  private collectTypefaces(themeConfig: PptxThemeConfig): string[] {
    const set = new Set<string>();
    if (themeConfig.titleFont) set.add(themeConfig.titleFont);
    if (themeConfig.bodyFont) set.add(themeConfig.bodyFont);
    if (themeConfig.monoFont) set.add(themeConfig.monoFont);
    // Filter out system fonts that aren't worth embedding (and likely aren't
    // in the font cache anyway).
    const systemFonts = new Set([
      'Calibri',
      'Arial',
      'Helvetica',
      'Times New Roman',
      'Consolas',
      'Courier New',
      'Verdana',
      '-apple-system',
      'system-ui',
    ]);
    return Array.from(set).filter((f) => !systemFonts.has(f));
  }

  private resolveThemeConfig(
    theme: Theme | null,
    presentation?: Presentation
  ): PptxThemeConfig {
    const fallback: PptxThemeConfig = {
      titleFont: 'Calibri',
      bodyFont: 'Calibri',
      monoFont: 'Consolas',
      light: {
        titleColor: '111111',
        bodyColor: '333333',
        mutedColor: '888888',
        bgColor: 'FFFFFF',
        accentColor: '0066CC',
        codeBgColor: 'F4F4F4',
        codeBorderColor: 'DDDDDD',
      },
      dark: {
        titleColor: 'FFFFFF',
        bodyColor: 'EEEEEE',
        mutedColor: 'AAAAAA',
        bgColor: '1A1A1A',
        accentColor: '4A9EFF',
        codeBgColor: '2A2A2A',
        codeBorderColor: '3A3A3A',
      },
    };

    // Frontmatter font overrides win over the theme.json values — they
    // represent author intent for this specific deck.
    const fm = presentation?.frontmatter;
    const fmTitleFont = this.cleanFontName(fm?.titleFont);
    const fmBodyFont = this.cleanFontName(fm?.bodyFont);

    if (!theme) {
      return {
        ...fallback,
        titleFont: fmTitleFont || fallback.titleFont,
        bodyFont: fmBodyFont || fallback.bodyFont,
      };
    }

    const preset = theme.presets?.[0];
    if (!preset) {
      return {
        ...fallback,
        titleFont: fmTitleFont || fallback.titleFont,
        bodyFont: fmBodyFont || fallback.bodyFont,
      };
    }

    return {
      titleFont:
        fmTitleFont || this.cleanFontName(preset.TitleFont) || fallback.titleFont,
      bodyFont:
        fmBodyFont || this.cleanFontName(preset.BodyFont) || fallback.bodyFont,
      monoFont: fallback.monoFont,
      light: this.buildPalette(preset, 'light', fallback.light),
      dark: this.buildPalette(preset, 'dark', fallback.dark),
    };
  }

  private buildPalette(
    preset: ThemePreset,
    mode: 'light' | 'dark',
    fallback: PptxPalette
  ): PptxPalette {
    if (mode === 'dark') {
      return {
        titleColor: this.toHex6(preset.DarkTitleTextColor) || fallback.titleColor,
        bodyColor: this.toHex6(preset.DarkBodyTextColor) || fallback.bodyColor,
        mutedColor: this.muteColor(this.toHex6(preset.DarkBodyTextColor)) || fallback.mutedColor,
        bgColor: this.toHex6(preset.DarkBackgroundColor) || fallback.bgColor,
        accentColor: this.toHex6(preset.DarkProgressBar) || fallback.accentColor,
        codeBgColor: this.toHex6(preset.DarkTableHeaderBg) || fallback.codeBgColor,
        codeBorderColor: this.toHex6(preset.DarkCodeBorder) || fallback.codeBorderColor,
      };
    }
    return {
      titleColor: this.toHex6(preset.LightTitleTextColor) || fallback.titleColor,
      bodyColor: this.toHex6(preset.LightBodyTextColor) || fallback.bodyColor,
      mutedColor: this.muteColor(this.toHex6(preset.LightBodyTextColor)) || fallback.mutedColor,
      bgColor: this.toHex6(preset.LightBackgroundColor) || fallback.bgColor,
      accentColor: this.toHex6(preset.LightProgressBar) || fallback.accentColor,
      codeBgColor: this.toHex6(preset.LightTableHeaderBg) || fallback.codeBgColor,
      codeBorderColor: this.toHex6(preset.LightCodeBorder) || fallback.codeBorderColor,
    };
  }

  private muteColor(hex: string | null): string | null {
    // Blend body color halfway toward gray so kicker / muted text has a soft
    // tint without a separate theme variable.
    if (!hex || hex.length !== 6) return null;
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const mr = Math.round(r * 0.55 + 128 * 0.45);
    const mg = Math.round(g * 0.55 + 128 * 0.45);
    const mb = Math.round(b * 0.55 + 128 * 0.45);
    return [mr, mg, mb].map((c) => c.toString(16).padStart(2, '0')).join('').toUpperCase();
  }

  private cleanFontName(font?: string): string | null {
    if (!font) return null;
    const first = font.split(',')[0]?.trim().replace(/^['"]|['"]$/g, '');
    return first || null;
  }

  private toHex6(color?: string): string | null {
    if (!color) return null;
    const trimmed = color.trim();
    const longHex = trimmed.match(/^#([0-9a-fA-F]{6})$/);
    if (longHex) return longHex[1].toUpperCase();
    const shortHex = trimmed.match(/^#([0-9a-fA-F]{3})$/);
    if (shortHex) {
      const [r, g, b] = shortHex[1].split('');
      return `${r}${r}${g}${g}${b}${b}`.toUpperCase();
    }
    const rgb = trimmed.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (rgb) {
      const [, r, g, b] = rgb;
      return [r, g, b]
        .map((c) => Math.max(0, Math.min(255, parseInt(c, 10))).toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase();
    }
    return null;
  }

  private toArrayBuffer(data: ArrayBuffer | Uint8Array | string | Blob): ArrayBuffer {
    if (data instanceof ArrayBuffer) return data;
    if (data instanceof Uint8Array) {
      return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
    }
    throw new Error(`Unexpected PPTX stream payload type: ${typeof data}`);
  }
}
