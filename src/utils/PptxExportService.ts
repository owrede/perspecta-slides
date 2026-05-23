import type { App, TFile } from 'obsidian';
import { Notice } from 'obsidian';
import PptxGenJS from 'pptxgenjs';
import type { Presentation, Theme } from '../types';

interface PageSizeInches {
  width: number;
  height: number;
}

interface PptxThemeConfig {
  titleFont: string;
  bodyFont: string;
  titleColor: string; // 6-char hex without #
  bodyColor: string;
  bgColor: string;
  accentColor: string;
}

/**
 * PptxExportService renders the deck as an editable .pptx using PptxGenJS.
 *
 * Phase 1: scaffolding only — creates the file, sets the correct page layout
 * for the deck's aspect ratio, and emits one blank slide per source slide
 * (no content yet). Subsequent phases will fill text frames, images, lists,
 * and complex layouts.
 */
export class PptxExportService {
  constructor(private app: App) {}

  async export(
    presentation: Presentation,
    theme: Theme | null,
    sourceFile: TFile
  ): Promise<void> {
    try {
      const pptx = new PptxGenJS();
      const themeConfig = this.resolveThemeConfig(theme);
      const pageSize = this.resolvePageSize(presentation.frontmatter.aspectRatio);

      this.applyLayout(pptx, pageSize);
      this.applyDocumentMeta(pptx, presentation);

      // Phase 1: emit one blank slide per source slide so the deck shape and
      // page count match the source. Content rendering arrives in Phase 2.
      const visibleSlides = presentation.slides.filter((slide) => !slide.hidden);
      for (let i = 0; i < visibleSlides.length; i++) {
        const slide = pptx.addSlide();
        slide.background = { color: themeConfig.bgColor };

        // Provisional title-text so the empty deck is identifiable in PowerPoint.
        // Phase 2 will replace this with real heading / body rendering.
        slide.addText(`Slide ${i + 1}`, {
          x: 0.5,
          y: 0.5,
          w: pageSize.width - 1.0,
          h: 0.6,
          fontFace: themeConfig.titleFont,
          fontSize: 14,
          color: themeConfig.bodyColor,
        });

        // Preserve speaker notes from the source — PPTX supports them natively
        // and they survive the round-trip even before content rendering lands.
        const notes = visibleSlides[i].speakerNotes || [];
        if (notes.length > 0) {
          slide.addNotes(notes.join('\n\n'));
        }
      }

      const data = (await pptx.stream()) as ArrayBuffer | Uint8Array;
      const arrayBuffer = this.toArrayBuffer(data);

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

  private computeExportPath(sourceFile: TFile): string {
    const parent = sourceFile.parent?.path || '';
    const base = sourceFile.basename;
    return parent ? `${parent}/${base}.pptx` : `${base}.pptx`;
  }

  private resolvePageSize(aspectRatio?: string): PageSizeInches {
    // Mirror the PDF export sizing so all three exports agree on geometry.
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
    // PptxGenJS ships LAYOUT_WIDE = 13.333 × 7.5 (16:9 widescreen) and
    // LAYOUT_4x3 = 10 × 7.5. For 16:10 we register a custom layout.
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

  /**
   * Map a Perspecta theme to a flat PPTX-friendly config. PPTX doesn't grok
   * CSS variables, modes, or gradients — pick a representative palette and
   * font pair that survives the round-trip.
   */
  private resolveThemeConfig(theme: Theme | null): PptxThemeConfig {
    const fallback: PptxThemeConfig = {
      titleFont: 'Calibri',
      bodyFont: 'Calibri',
      titleColor: '111111',
      bodyColor: '333333',
      bgColor: 'FFFFFF',
      accentColor: '0066CC',
    };

    if (!theme) {
      return fallback;
    }

    const preset = theme.presets?.[0];
    if (!preset) {
      return fallback;
    }

    // Pick light-mode colors for PPTX — presentations are typically reused on
    // a projector with a light background in PowerPoint. Phase 2+ may add a
    // `mode: dark` override that swaps the palette.
    return {
      titleFont: this.cleanFontName(preset.TitleFont) || fallback.titleFont,
      bodyFont: this.cleanFontName(preset.BodyFont) || fallback.bodyFont,
      titleColor: this.toHex6(preset.LightTitleTextColor) || fallback.titleColor,
      bodyColor: this.toHex6(preset.LightBodyTextColor) || fallback.bodyColor,
      bgColor: this.toHex6(preset.LightBackgroundColor) || fallback.bgColor,
      accentColor: this.toHex6(preset.LightProgressBar) || fallback.accentColor,
    };
  }

  private cleanFontName(font?: string): string | null {
    if (!font) return null;
    // CSS font stacks like `"Inter", system-ui, sans-serif` — keep only the
    // first concrete family for PPTX since it can't fall back the same way.
    const first = font.split(',')[0]?.trim().replace(/^['"]|['"]$/g, '');
    return first || null;
  }

  private toHex6(color?: string): string | null {
    if (!color) return null;
    const trimmed = color.trim();

    // #RRGGBB
    const longHex = trimmed.match(/^#([0-9a-fA-F]{6})$/);
    if (longHex) return longHex[1].toUpperCase();

    // #RGB
    const shortHex = trimmed.match(/^#([0-9a-fA-F]{3})$/);
    if (shortHex) {
      const [r, g, b] = shortHex[1].split('');
      return `${r}${r}${g}${g}${b}${b}`.toUpperCase();
    }

    // rgb(r,g,b) — accept rgba() too, drop alpha
    const rgb = trimmed.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (rgb) {
      const [, r, g, b] = rgb;
      const hex = [r, g, b]
        .map((c) => Math.max(0, Math.min(255, parseInt(c, 10))).toString(16).padStart(2, '0'))
        .join('');
      return hex.toUpperCase();
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
