/**
 * SFNT font inspector — minimal parser for OpenType/TrueType containers.
 *
 * Used at font-ingest time to detect variable fonts (`fvar` table) and to
 * read variation-axis ranges. Replaces the heuristic variable-font detection
 * that previously lived in FontManager.generateFontFaceCSSForExport.
 *
 * Scope:
 *   • Plain SFNT containers: TTF (`0x00010000` magic) and OTF (`OTTO` magic).
 *   • TTC (font collections) — not supported. Returns `null` rather than
 *     misleading data.
 *   • WOFF / WOFF2 — compressed wrappers. Not parsed here; callers should
 *     trust other signals (Google Fonts CSS structure, multi-block detection).
 *
 * Intentionally minimal — only what's needed to answer
 * "is this variable? if so, what is the wght range?".
 */

import type { VariationAxis } from './FontManager';

export interface SfntInspection {
  isVariable: boolean;
  /** All variation axes present. Empty array for static fonts. */
  axes: VariationAxis[];
  /** wght axis range, if present. Convenience for the common case. */
  weightRange: [number, number] | null;
}

const SFNT_TTF_MAGIC = 0x00010000;
const SFNT_OTF_MAGIC = 0x4f54544f; // 'OTTO'
const SFNT_TTC_MAGIC = 0x74746366; // 'ttcf'

const FVAR_TAG = 0x66766172; // 'fvar'

/**
 * Inspect raw font bytes. Returns `null` if the bytes are not a plain
 * SFNT container (e.g. WOFF2, TTC, or garbage). Callers should treat
 * `null` as "no information available — use other signals".
 */
export function inspectSfnt(buffer: ArrayBuffer): SfntInspection | null {
  const view = new DataView(buffer);

  if (buffer.byteLength < 12) {return null;}

  const magic = view.getUint32(0, false);
  if (magic === SFNT_TTC_MAGIC) {
    // Font collection. Could recurse into the first face, but not worth it
    // for our usage — slide fonts are virtually never shipped as TTC.
    return null;
  }
  if (magic !== SFNT_TTF_MAGIC && magic !== SFNT_OTF_MAGIC) {
    return null;
  }

  const numTables = view.getUint16(4, false);
  // Table directory entries start at offset 12, each is 16 bytes.
  const directoryEnd = 12 + numTables * 16;
  if (buffer.byteLength < directoryEnd) {return null;}

  let fvarOffset = -1;
  let fvarLength = 0;
  for (let i = 0; i < numTables; i++) {
    const entryOffset = 12 + i * 16;
    const tag = view.getUint32(entryOffset, false);
    if (tag === FVAR_TAG) {
      fvarOffset = view.getUint32(entryOffset + 8, false);
      fvarLength = view.getUint32(entryOffset + 12, false);
      break;
    }
  }

  if (fvarOffset < 0) {
    return { isVariable: false, axes: [], weightRange: null };
  }

  // Parse fvar header. Layout (OpenType spec):
  //   uint16 majorVersion
  //   uint16 minorVersion
  //   Offset16 axesArrayOffset (from start of fvar table)
  //   uint16 (reserved)
  //   uint16 axisCount
  //   uint16 axisSize          // size of each VariationAxisRecord, usually 20
  //   uint16 instanceCount
  //   uint16 instanceSize
  // Then axisCount VariationAxisRecords:
  //   Tag      axisTag
  //   Fixed    minValue        // 16.16 signed fixed
  //   Fixed    defaultValue
  //   Fixed    maxValue
  //   uint16   flags
  //   uint16   axisNameID

  if (fvarLength < 16) {return { isVariable: false, axes: [], weightRange: null };}

  const axesArrayOffset = view.getUint16(fvarOffset + 4, false);
  const axisCount = view.getUint16(fvarOffset + 8, false);
  const axisSize = view.getUint16(fvarOffset + 10, false);

  if (axisCount === 0 || axisSize < 20) {
    return { isVariable: false, axes: [], weightRange: null };
  }

  const axes: VariationAxis[] = [];
  let weightRange: [number, number] | null = null;

  const recordsStart = fvarOffset + axesArrayOffset;
  if (recordsStart + axisCount * axisSize > buffer.byteLength) {
    return { isVariable: true, axes: [], weightRange: null };
  }

  for (let i = 0; i < axisCount; i++) {
    const recOffset = recordsStart + i * axisSize;
    const tagBytes = view.getUint32(recOffset, false);
    const tag = String.fromCharCode(
      (tagBytes >> 24) & 0xff,
      (tagBytes >> 16) & 0xff,
      (tagBytes >> 8) & 0xff,
      tagBytes & 0xff
    );
    const min = readFixed1616(view, recOffset + 4);
    const def = readFixed1616(view, recOffset + 8);
    const max = readFixed1616(view, recOffset + 12);
    axes.push({ tag, min, max, default: def });
    if (tag === 'wght') {
      weightRange = [min, max];
    }
  }

  return { isVariable: true, axes, weightRange };
}

function readFixed1616(view: DataView, offset: number): number {
  // 16.16 signed fixed-point. The fractional part is virtually always zero
  // for weight axes (100, 400, 700, ...), so we can round defensively.
  const raw = view.getInt32(offset, false);
  return Math.round(raw / 65536);
}
