import type { App } from 'obsidian';
import JSZip from 'jszip';
import { decompress as woff2Decompress } from 'wawoff2';
import { FontManager } from './FontManager';

/**
 * Font format detected from the raw bytes (NOT from filename — we want to be
 * robust against mislabeled files).
 */
type FontFormat = 'ttf' | 'otf' | 'woff' | 'woff2' | 'unknown';

interface ResolvedFontVariant {
  weight: number;
  italic: boolean;
  ttfBuffer: Uint8Array;
}

interface ResolvedFont {
  /** Font family name as it appears in PPTX text (typeface attribute). */
  typeface: string;
  variants: ResolvedFontVariant[];
}

/**
 * Post-processes a PPTX zip blob produced by PptxGenJS, embedding the actual
 * TTF/OTF font bytes for each requested font family so the deck renders
 * correctly on machines that don't have those fonts installed.
 *
 * The OOXML embedding model uses /ppt/fonts/font{N}.fntdata for the raw TTF
 * stream plus three sibling entries in /ppt/presentation.xml:
 *   <p:embeddedFontLst>
 *     <p:embeddedFont>
 *       <p:font typeface="Inter"/>
 *       <p:regular r:id="rId12"/>
 *       <p:bold r:id="rId13"/>
 *     </p:embeddedFont>
 *   </p:embeddedFontLst>
 * plus relationship entries in /ppt/_rels/presentation.xml.rels and a content
 * type registration in [Content_Types].xml.
 */
export class PptxFontEmbedder {
  constructor(
    private app: App,
    private fontManager: FontManager
  ) {}

  /**
   * Embed the given typeface names into an existing PPTX archive. Returns a
   * new ArrayBuffer with the modified zip. If no fonts could be resolved, the
   * input is returned unchanged.
   *
   * @param pptxBuffer the zipped PPTX as produced by PptxGenJS
   * @param typefaces the unique typeface names referenced in the deck
   */
  async embedFonts(pptxBuffer: ArrayBuffer, typefaces: string[]): Promise<ArrayBuffer> {
    if (typefaces.length === 0) return pptxBuffer;

    const resolved: ResolvedFont[] = [];
    for (const typeface of typefaces) {
      const font = await this.resolveFont(typeface);
      if (font) resolved.push(font);
    }

    if (resolved.length === 0) {
      console.log('[PptxFontEmbedder] No fonts resolved — skipping embedding');
      return pptxBuffer;
    }

    const zip = await JSZip.loadAsync(pptxBuffer);
    await this.injectFonts(zip, resolved);
    return await zip.generateAsync({
      type: 'arraybuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Font resolution
  // ──────────────────────────────────────────────────────────────────────────

  private async resolveFont(typeface: string): Promise<ResolvedFont | null> {
    const cached = this.fontManager.getCachedFont(typeface);
    if (!cached || !cached.files || cached.files.length === 0) {
      console.log(`[PptxFontEmbedder] No cached font for "${typeface}"`);
      return null;
    }

    const variants: ResolvedFontVariant[] = [];

    for (const file of cached.files) {
      try {
        const raw = await this.app.vault.adapter.readBinary(file.localPath);
        const bytes = new Uint8Array(raw);
        const format = this.sniffFormat(bytes);
        if (format === 'unknown') {
          console.warn(
            `[PptxFontEmbedder] Unknown font format for ${file.localPath} — skipping`
          );
          continue;
        }

        const ttfBytes = await this.toTTF(bytes, format);
        if (!ttfBytes) {
          console.warn(
            `[PptxFontEmbedder] Could not convert ${file.localPath} (${format}) to TTF — skipping`
          );
          continue;
        }

        variants.push({
          weight: file.weight || 400,
          italic: (file.style || '').toLowerCase().includes('italic'),
          ttfBuffer: ttfBytes,
        });
      } catch (err) {
        console.warn(`[PptxFontEmbedder] Failed to read ${file.localPath}:`, err);
      }
    }

    if (variants.length === 0) return null;
    return { typeface, variants };
  }

  private sniffFormat(bytes: Uint8Array): FontFormat {
    if (bytes.length < 4) return 'unknown';
    const sig = (bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3];
    // TTF: 0x00010000, "true" (0x74727565), or "OTTO" (0x4F54544F) for OTF
    if (sig === 0x00010000 || sig === 0x74727565) return 'ttf';
    if (sig === 0x4f54544f) return 'otf';
    if (sig === 0x774f4646) return 'woff';
    if (sig === 0x774f4632) return 'woff2';
    return 'unknown';
  }

  private async toTTF(bytes: Uint8Array, format: FontFormat): Promise<Uint8Array | null> {
    switch (format) {
      case 'ttf':
      case 'otf':
        // PPTX's `<Default Extension="fntdata"/>` content type accepts both
        // sfnt-flavors (TTF and CFF/OTF). We embed as-is.
        return bytes;
      case 'woff2': {
        try {
          const result = await woff2Decompress(bytes);
          return result instanceof Uint8Array ? result : new Uint8Array(result);
        } catch (e) {
          console.warn('[PptxFontEmbedder] WOFF2 decompression failed:', e);
          return null;
        }
      }
      case 'woff':
        // WOFF v1 decoding (just gzip-deflated sfnt) is rare enough to defer.
        console.warn('[PptxFontEmbedder] WOFF v1 not yet supported — skipping');
        return null;
      default:
        return null;
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // OOXML injection
  // ──────────────────────────────────────────────────────────────────────────

  private async injectFonts(zip: JSZip, fonts: ResolvedFont[]): Promise<void> {
    // Read the three files we need to mutate.
    const presPath = 'ppt/presentation.xml';
    const relsPath = 'ppt/_rels/presentation.xml.rels';
    const ctPath = '[Content_Types].xml';

    const presXml = await zip.file(presPath)?.async('string');
    const relsXml = await zip.file(relsPath)?.async('string');
    const ctXml = await zip.file(ctPath)?.async('string');

    if (!presXml || !relsXml || !ctXml) {
      console.warn('[PptxFontEmbedder] Required PPTX parts missing — aborting embed');
      return;
    }

    // Find the highest existing rId in the relationships file.
    let nextRid = this.findMaxRid(relsXml) + 1;

    // Build embeddedFontLst, relationships, and a list of files to add.
    const fontElements: string[] = [];
    const newRels: { id: string; target: string }[] = [];
    const filesToAdd: { path: string; bytes: Uint8Array }[] = [];

    let fontFileIndex = 1;
    for (const font of fonts) {
      // PPTX defines at most one font file per slot (regular, bold, italic,
      // boldItalic). Pick the closest variant for each slot.
      const slotMap: Record<string, ResolvedFontVariant | undefined> = {
        regular: this.pickVariant(font.variants, 400, false),
        bold: this.pickVariant(font.variants, 700, false),
        italic: this.pickVariant(font.variants, 400, true),
        boldItalic: this.pickVariant(font.variants, 700, true),
      };

      const slotEntries: string[] = [];
      for (const [slotName, variant] of Object.entries(slotMap)) {
        if (!variant) continue;
        const target = `fonts/font${fontFileIndex}.fntdata`;
        const fontPath = `ppt/${target}`;
        const rid = `rId${nextRid++}`;

        filesToAdd.push({ path: fontPath, bytes: variant.ttfBuffer });
        newRels.push({ id: rid, target });
        slotEntries.push(`<p:${slotName} r:id="${rid}"/>`);

        fontFileIndex++;
      }

      if (slotEntries.length === 0) continue;
      fontElements.push(
        `<p:embeddedFont><p:font typeface="${this.escapeXml(font.typeface)}"/>${slotEntries.join('')}</p:embeddedFont>`
      );
    }

    if (filesToAdd.length === 0) {
      console.log('[PptxFontEmbedder] Resolved fonts had no embeddable variants');
      return;
    }

    // 1. Update [Content_Types].xml — register .fntdata extension.
    let newCtXml = ctXml;
    if (!ctXml.includes('Extension="fntdata"')) {
      newCtXml = ctXml.replace(
        /<\/Types>\s*$/,
        '<Default Extension="fntdata" ContentType="application/x-fontdata"/></Types>'
      );
    }
    zip.file(ctPath, newCtXml);

    // 2. Update ppt/_rels/presentation.xml.rels — add relationships.
    const newRelEntries = newRels
      .map(
        (r) =>
          `<Relationship Id="${r.id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/font" Target="${r.target}"/>`
      )
      .join('');
    const newRelsXml = relsXml.replace(/<\/Relationships>\s*$/, newRelEntries + '</Relationships>');
    zip.file(relsPath, newRelsXml);

    // 3. Update ppt/presentation.xml — insert <p:embeddedFontLst>.
    // The element must appear in the schema-defined order: after sldIdLst,
    // notesSz/sldSz, and defaultTextStyle but before custShowLst/extLst.
    // Safe insertion point: just before </p:presentation>.
    const embeddedFontLst = `<p:embeddedFontLst>${fontElements.join('')}</p:embeddedFontLst>`;
    let newPresXml = presXml;
    if (presXml.includes('<p:embeddedFontLst')) {
      // Replace existing list (in case we re-embed).
      newPresXml = presXml.replace(/<p:embeddedFontLst[\s\S]*?<\/p:embeddedFontLst>/, embeddedFontLst);
    } else {
      newPresXml = presXml.replace(/<\/p:presentation>\s*$/, embeddedFontLst + '</p:presentation>');
    }
    zip.file(presPath, newPresXml);

    // 4. Add the font file bytes.
    for (const { path, bytes } of filesToAdd) {
      zip.file(path, bytes, { binary: true });
    }

    console.log(
      `[PptxFontEmbedder] Embedded ${fonts.length} typeface(s), ${filesToAdd.length} font file(s)`
    );
  }

  private pickVariant(
    variants: ResolvedFontVariant[],
    targetWeight: number,
    italic: boolean
  ): ResolvedFontVariant | undefined {
    // Exact match first, then nearest weight in same italic slot.
    const exact = variants.find((v) => v.weight === targetWeight && v.italic === italic);
    if (exact) return exact;
    const sameStyle = variants.filter((v) => v.italic === italic);
    if (sameStyle.length === 0) return undefined;
    return sameStyle.reduce((best, v) =>
      Math.abs(v.weight - targetWeight) < Math.abs(best.weight - targetWeight) ? v : best
    );
  }

  private findMaxRid(relsXml: string): number {
    const matches = relsXml.matchAll(/Id="rId(\d+)"/g);
    let max = 0;
    for (const m of matches) {
      const n = parseInt(m[1], 10);
      if (n > max) max = n;
    }
    return max;
  }

  private escapeXml(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
