import type { App } from 'obsidian';
import JSZip from 'jszip';
import { decompress as woff2Decompress } from 'wawoff2';
import ttf2eot from 'ttf2eot';
import { FontManager } from './FontManager';
import { flattenVariableFont, isVariableFont } from './VariableFontFlattener';

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
   * @param majorFont typeface to set as the theme's major (heading) font —
   *        Microsoft Office only honors embedded fonts that are also declared
   *        in theme1.xml's <a:majorFont>/<a:minorFont>. Without this patch,
   *        Mac and Windows PowerPoint show the typeface name in the picker
   *        but render Calibri (the PptxGenJS default theme font) instead.
   * @param minorFont typeface to set as the theme's minor (body) font
   */
  async embedFonts(
    pptxBuffer: ArrayBuffer,
    typefaces: string[],
    majorFont?: string,
    minorFont?: string
  ): Promise<ArrayBuffer> {
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
    await this.patchThemeFonts(zip, majorFont, minorFont);
    return await zip.generateAsync({
      type: 'arraybuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });
  }

  /**
   * Replace the theme's <a:majorFont> and <a:minorFont> latin typefaces so
   * that Microsoft Office's font-resolution path picks up our embedded fonts.
   * The replacement is conservative: we only swap the `typeface` attribute of
   * the <a:latin> elements; the surrounding `<a:ea>`, `<a:cs>`, and
   * `<a:font script="...">` entries are left untouched so non-latin scripts
   * keep their fallbacks.
   *
   * Patches every ppt/theme/theme*.xml entry — PptxGenJS emits one theme file
   * per slide-master and we don't want a single straggler to break the chain.
   */
  private async patchThemeFonts(
    zip: JSZip,
    majorFont?: string,
    minorFont?: string
  ): Promise<void> {
    if (!majorFont && !minorFont) return;

    const themeFiles = Object.keys(zip.files).filter((p) =>
      /^ppt\/theme\/theme\d+\.xml$/.test(p)
    );
    for (const path of themeFiles) {
      const xml = await zip.file(path)?.async('string');
      if (!xml) continue;
      let patched = xml;

      if (majorFont) {
        patched = patched.replace(
          /(<a:majorFont>[\s\S]*?<a:latin\s+typeface=")[^"]+("[^>]*\/>)/,
          `$1${this.escapeXml(majorFont)}$2`
        );
      }
      if (minorFont) {
        patched = patched.replace(
          /(<a:minorFont>[\s\S]*?<a:latin\s+typeface=")[^"]+("[^>]*\/>)/,
          `$1${this.escapeXml(minorFont)}$2`
        );
      }

      if (patched !== xml) {
        zip.file(path, patched);
      }
    }
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
      // Determine slot bytes. If any source variant is a variable font, we
      // flatten it four times — one per (weight, italic) target — so that
      // Microsoft Office's font resolver sees four genuine static TTFs.
      const hasVariable = font.variants.some((v) => isVariableFont(v.ttfBuffer));
      const slotSpecs: Array<{
        name: 'regular' | 'bold' | 'italic' | 'boldItalic';
        weight: number;
        italic: boolean;
      }> = [
        { name: 'regular', weight: 400, italic: false },
        { name: 'bold', weight: 700, italic: false },
        { name: 'italic', weight: 400, italic: true },
        { name: 'boldItalic', weight: 700, italic: true },
      ];

      const slotEntries: string[] = [];
      let firstSlotTtf: Uint8Array | null = null;
      for (const spec of slotSpecs) {
        let bytes: Uint8Array | null = null;
        if (hasVariable) {
          // Pick any variable-font source (usually only one) and flatten it
          // at the requested instance location.
          const vfVariant = font.variants.find((v) => isVariableFont(v.ttfBuffer));
          if (vfVariant) {
            try {
              bytes = await flattenVariableFont(vfVariant.ttfBuffer, {
                weight: spec.weight,
                italic: spec.italic,
              });
            } catch (err) {
              console.warn(
                `[PptxFontEmbedder] Variable-font flatten failed for ${font.typeface} (${spec.name}):`,
                err
              );
            }
          }
        } else {
          // Static font fleet — pick the closest existing variant for this slot.
          const picked = this.pickVariant(font.variants, spec.weight, spec.italic);
          if (picked) bytes = picked.ttfBuffer;
        }

        if (!bytes) continue;

        // PowerPoint's font-embed loader expects EOT-wrapped font data, NOT
        // raw TTF. This is the actual root cause of the long-running "font
        // appears in PPTX but Office renders Calibri" symptom: a Microsoft-
        // generated PPTX shows file5.fntdata starting with EOT magic 0x504C,
        // and PowerPoint silently rejects anything that doesn't match. Quick
        // Look, Google Slides, and LibreOffice all accept raw TTF directly,
        // which is why the same PPTX rendered correctly there. We only
        // discovered this by diffing a Microsoft-produced reference PPTX.
        // Capture the raw TTF panose BEFORE wrapping (EOT's panose is at a
        // different offset so we'd have to re-extract anyway).
        if (!firstSlotTtf) firstSlotTtf = bytes;
        let eotBytes: Uint8Array;
        try {
          eotBytes = ttf2eot(bytes);
        } catch (err) {
          console.warn(
            `[PptxFontEmbedder] ttf2eot failed for ${font.typeface} (${spec.name}):`,
            err
          );
          continue;
        }

        const target = `fonts/font${fontFileIndex}.fntdata`;
        const fontPath = `ppt/${target}`;
        const rid = `rId${nextRid++}`;

        filesToAdd.push({ path: fontPath, bytes: eotBytes });
        newRels.push({ id: rid, target });
        slotEntries.push(`<p:${spec.name} r:id="${rid}"/>`);

        fontFileIndex++;
      }

      if (slotEntries.length === 0) continue;

      // Panose comes from the original TTF (firstSlotTtf), captured above
      // before EOT wrapping moved everything to different offsets.
      const panose = firstSlotTtf ? extractPanoseHex(firstSlotTtf) : null;
      const panoseAttr = panose ? ` panose="${panose}"` : '';
      const pitchFamilyAttr = this.derivePitchFamilyAttr(panose);

      fontElements.push(
        `<p:embeddedFont><p:font typeface="${this.escapeXml(font.typeface)}"${panoseAttr}${pitchFamilyAttr}/>${slotEntries.join('')}</p:embeddedFont>`
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
    // The OOXML schema requires this element to appear in a specific order:
    //   sldMasterIdLst → notesMasterIdLst → handoutMasterIdLst → sldIdLst →
    //   sldSz → notesSz → smartTags → embeddedFontLst → custShowLst →
    //   photoAlbum → kinsoku → defaultTextStyle → modifyVerifier → extLst
    // PowerPoint (especially on Mac) silently drops embedded fonts when the
    // element appears out of order. We insert right after </p:notesSz> when
    // present, otherwise after </p:sldSz>, otherwise just before any of the
    // later children, falling back to before </p:presentation>.
    const embeddedFontLst = `<p:embeddedFontLst>${fontElements.join('')}</p:embeddedFontLst>`;
    let newPresXml = presXml;
    if (presXml.includes('<p:embeddedFontLst')) {
      newPresXml = presXml.replace(
        /<p:embeddedFontLst[\s\S]*?<\/p:embeddedFontLst>/,
        embeddedFontLst
      );
    } else {
      // Order: sldSz comes first, then notesSz, then embeddedFontLst.
      // We need to find whichever appears LAST among the legal-predecessor
      // elements so we don't accidentally insert too early.
      const predecessorPatterns = [
        /<p:notesSz[^/]*\/>/,
        /<\/p:notesSz>/,
        /<p:sldSz[^/]*\/>/,
        /<\/p:sldSz>/,
        /<\/p:sldIdLst>/,
      ];
      let bestEnd = -1;
      for (const re of predecessorPatterns) {
        const match = newPresXml.match(re);
        if (match && match.index !== undefined) {
          const end = match.index + match[0].length;
          if (end > bestEnd) bestEnd = end;
        }
      }
      if (bestEnd >= 0) {
        newPresXml =
          newPresXml.slice(0, bestEnd) + embeddedFontLst + newPresXml.slice(bestEnd);
      } else {
        newPresXml = newPresXml.replace(
          /<\/p:presentation>\s*$/,
          embeddedFontLst + '</p:presentation>'
        );
      }
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

  /**
   * Derive PowerPoint's `pitchFamily` attribute from the panose classification.
   * Default 0x22 (34) = "Variable Pitch + Roman family" matches most modern
   * sans-serif and serif fonts. We could be smarter (panose bSerifStyle byte
   * tells us serif vs sans), but PptxGenJS's text runs hardcode 34 too — so
   * staying consistent here keeps Office's matcher happy.
   */
  private derivePitchFamilyAttr(panose: string | null): string {
    if (!panose) return '';
    // pitchFamily 34 = variable-pitch roman; 18 = variable-pitch swiss (sans).
    // The byte at panose offset 1 (bSerifStyle) tells us — 0..10 vary widely;
    // 0/11/12 = sans, 1..10 = various serif. Default to 34.
    return ' pitchFamily="34" charset="0"';
  }
}

/**
 * Read the 10-byte Panose classification from a TTF's OS/2 table and format
 * it as the uppercase hex string PPTX expects (e.g. "020F0502020204030204").
 * Returns null if the font is malformed or the table is absent.
 */
function extractPanoseHex(ttf: Uint8Array): string | null {
  if (ttf.length < 12) return null;
  const dv = new DataView(ttf.buffer, ttf.byteOffset, ttf.byteLength);
  const numTables = dv.getUint16(4);
  for (let i = 0; i < numTables; i++) {
    const dirOff = 12 + i * 16;
    const tag = String.fromCharCode(
      ttf[dirOff],
      ttf[dirOff + 1],
      ttf[dirOff + 2],
      ttf[dirOff + 3]
    );
    if (tag !== 'OS/2') continue;
    const off = dv.getUint32(dirOff + 8);
    // panose lives at OS/2 offset 32, 10 bytes long.
    if (off + 42 > ttf.length) return null;
    let hex = '';
    for (let j = 0; j < 10; j++) {
      hex += ttf[off + 32 + j].toString(16).padStart(2, '0').toUpperCase();
    }
    return hex;
  }
  return null;
}
