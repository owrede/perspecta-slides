import type { App, TFile } from 'obsidian';
import { Notice, Platform } from 'obsidian';
import type { Presentation, Theme } from '../types';
import type { ImagePathResolver } from '../renderer/SlideRenderer';
import { SlideRenderer } from '../renderer/SlideRenderer';
import type { ExcalidrawRenderer } from './ExcalidrawRenderer';
import { getObsidianColorScheme } from './ColorScheme';

declare const require: NodeRequire;

interface PageSizeInches {
  width: number;
  height: number;
}

/**
 * PdfExportService renders the presentation to a real PDF using Electron's
 * webContents.printToPDF API. Each slide becomes its own landscape page sized
 * to the deck's aspect ratio.
 */
export class PdfExportService {
  private excalidrawRenderer: ExcalidrawRenderer | null = null;

  constructor(
    private app: App,
    private imagePathResolver: ImagePathResolver
  ) {}

  setExcalidrawRenderer(renderer: ExcalidrawRenderer): void {
    this.excalidrawRenderer = renderer;
  }

  async export(
    presentation: Presentation,
    theme: Theme | null,
    sourceFile: TFile,
    customFontCSS: string = ''
  ): Promise<void> {
    if (!Platform.isDesktop) {
      new Notice('PDF export is only available on Desktop.');
      return;
    }

    try {
      const renderer = new SlideRenderer(presentation, theme || undefined, this.imagePathResolver);
      renderer.setSystemColorScheme(getObsidianColorScheme());
      if (customFontCSS) {
        renderer.setCustomFontCSS(customFontCSS);
      }
      if (this.excalidrawRenderer) {
        renderer.setExcalidrawSvgCache(this.excalidrawRenderer.getSvgCache());
        renderer.setFailedDecompressionFiles(this.excalidrawRenderer.getFailedDecompressionFiles());
      }

      const pageSize = this.resolvePageSize(presentation.frontmatter.aspectRatio);
      const printHTML = this.generatePrintHTML(presentation, renderer, pageSize);

      const pdfBuffer = await this.renderPDF(printHTML, pageSize);
      if (!pdfBuffer) {
        new Notice('PDF export failed: no data produced.');
        return;
      }

      const exportPath = this.computeExportPath(sourceFile);
      // Obsidian's writeBinary expects an ArrayBuffer; printToPDF returns a Node Buffer.
      const arrayBuffer = pdfBuffer.buffer.slice(
        pdfBuffer.byteOffset,
        pdfBuffer.byteOffset + pdfBuffer.byteLength
      );
      await this.app.vault.adapter.writeBinary(exportPath, arrayBuffer as ArrayBuffer);

      new Notice(`PDF exported to ${exportPath}`);
    } catch (error) {
      console.error('[PdfExportService] Export failed:', error);
      new Notice(
        `Failed to export PDF: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private computeExportPath(sourceFile: TFile): string {
    const parent = sourceFile.parent?.path || '';
    const base = sourceFile.basename;
    return parent ? `${parent}/${base}.pdf` : `${base}.pdf`;
  }

  private resolvePageSize(aspectRatio?: string): PageSizeInches {
    // Standard PowerPoint widescreen is 13.333 × 7.5 inches.
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

  private generatePrintHTML(
    presentation: Presentation,
    renderer: SlideRenderer,
    pageSize: PageSizeInches
  ): string {
    const visibleSlides = presentation.slides.filter((slide) => !slide.hidden);

    const slidesHTML = visibleSlides
      .map((slide, idx) => {
        const slideHTML = renderer.renderPresentationSlideHTML(slide, idx);
        const escaped = this.escapeAttr(slideHTML);
        return `<div class="pdf-page"><iframe srcdoc="${escaped}" frameborder="0" scrolling="no"></iframe></div>`;
      })
      .join('\n');

    // Render in CSS pixels at 96 DPI so the iframe content matches the
    // exact paper size used by printToPDF (`pageSize` in inches).
    const widthPx = Math.round(pageSize.width * 96);
    const heightPx = Math.round(pageSize.height * 96);

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>${this.escapeHtml(presentation.frontmatter.title || 'Presentation')}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }

  .pdf-page {
    width: ${widthPx}px;
    height: ${heightPx}px;
    overflow: hidden;
    page-break-after: always;
    break-after: page;
  }
  .pdf-page:last-child {
    page-break-after: auto;
    break-after: auto;
  }
  .pdf-page iframe {
    width: ${widthPx}px;
    height: ${heightPx}px;
    border: 0;
    display: block;
  }

  @page {
    size: ${pageSize.width}in ${pageSize.height}in;
    margin: 0;
  }

  @media print {
    html, body { width: ${widthPx}px; }
  }
</style>
</head>
<body>
${slidesHTML}
</body>
</html>`;
  }

  private async renderPDF(html: string, pageSize: PageSizeInches): Promise<Buffer | null> {
    const electron = require('electron');
    const remote = electron.remote || (require as any)('@electron/remote');
    if (!remote) {
      throw new Error('Electron remote module is not available.');
    }
    const { BrowserWindow } = remote;

    const widthPx = Math.round(pageSize.width * 96);
    const heightPx = Math.round(pageSize.height * 96);

    const win = new BrowserWindow({
      show: false,
      width: widthPx,
      height: heightPx,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: false,
        offscreen: false,
      },
    });

    try {
      // Load via about:blank then inject content with document.write — avoids
      // data-URL size limits and is more reliable across Electron versions.
      await win.loadURL('about:blank');
      const escapedHtml = JSON.stringify(html);
      await win.webContents.executeJavaScript(`
        (function() {
          document.open();
          document.write(${escapedHtml});
          document.close();
        })();
      `);

      // Give iframes a beat to settle (fonts, layout).
      await this.waitForIframes(win);

      const pdfData: Buffer = await win.webContents.printToPDF({
        landscape: pageSize.width > pageSize.height,
        printBackground: true,
        pageSize: {
          // Electron expects microns (1 inch = 25400 microns).
          width: Math.round(pageSize.width * 25400),
          height: Math.round(pageSize.height * 25400),
        },
        margins: {
          marginType: 'none',
        },
        preferCSSPageSize: true,
      });

      return pdfData;
    } finally {
      if (!win.isDestroyed()) {
        win.close();
      }
    }
  }

  /**
   * Wait until all iframes in the offscreen window have loaded their srcdoc
   * content. printToPDF will otherwise capture a blank page when fired too
   * early. We poll readyState plus a short settle delay.
   */
  private async waitForIframes(win: any): Promise<void> {
    const maxWaitMs = 4000;
    const pollMs = 100;
    const start = Date.now();

    while (Date.now() - start < maxWaitMs) {
      try {
        const ready: boolean = await win.webContents.executeJavaScript(`
          (function() {
            if (document.readyState !== 'complete') return false;
            var frames = document.querySelectorAll('iframe');
            for (var i = 0; i < frames.length; i++) {
              var doc = frames[i].contentDocument;
              if (!doc) return false;
              if (doc.readyState !== 'complete') return false;
            }
            return true;
          })();
        `);
        if (ready) {
          break;
        }
      } catch (_e) {
        // Ignore transient failures; will retry.
      }
      await new Promise((resolve) => setTimeout(resolve, pollMs));
    }

    // Wait for fonts in every iframe to finish loading.
    try {
      await win.webContents.executeJavaScript(`
        Promise.all(Array.from(document.querySelectorAll('iframe')).map(function(f) {
          try {
            var d = f.contentDocument;
            if (d && d.fonts && d.fonts.ready) return d.fonts.ready;
          } catch (e) {}
          return Promise.resolve();
        })).then(function() { return true; });
      `);
    } catch (_e) {
      // Best-effort.
    }

    // Final settle for layout flush.
    await new Promise((resolve) => setTimeout(resolve, 350));
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private escapeAttr(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}
