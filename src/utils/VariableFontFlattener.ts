// Inlined harfbuzz-subset WASM via esbuild's "base64" loader. The .wasm file
// becomes a base64 string at bundle time so we don't have to ship the binary
// alongside main.js.
// We vendor this file from `node_modules/harfbuzzjs/dist/harfbuzz-subset.wasm`
// because the package's `exports` field forbids deep imports.
import hbSubsetWasmBase64 from '../wasm/harfbuzz-subset.wasm';

/**
 * Pins a variable font to a static instance at a specific weight + italic
 * combination, returning a Uint8Array of the flattened TTF.
 *
 * Why: Microsoft Office (PowerPoint Mac and Windows both) does not honor
 * embedded variable fonts. The font's typeface name appears in the picker
 * but the renderer silently falls back to Calibri because the OS/2 weight
 * detection logic only understands classic static-instance TTFs. Google
 * Slides and macOS Quick Look use newer font engines and render the
 * variable font correctly — which is why the same PPTX rendered Inter in
 * Google but Calibri in PowerPoint.
 *
 * This module uses harfbuzz's subset/instance API (the same code path as the
 * `hb-subset --instance "wght=400"` CLI) to produce a real static TTF that
 * MS Office can use.
 */

interface HbExports {
  memory: WebAssembly.Memory;
  malloc(size: number): number;
  free(ptr: number): void;
  hb_subset_input_create_or_fail(): number;
  hb_subset_input_destroy(input: number): void;
  hb_subset_input_set(input: number, what: number): number;
  hb_subset_input_unicode_set(input: number): number;
  hb_subset_input_set_flags(input: number, flags: number): void;
  hb_subset_input_get_flags(input: number): number;
  hb_subset_input_pin_axis_location(
    input: number,
    face: number,
    axisTag: number,
    value: number
  ): number;
  hb_subset_input_pin_axis_to_default(
    input: number,
    face: number,
    axisTag: number
  ): number;
  hb_blob_create(
    data: number,
    length: number,
    mode: number,
    userData: number,
    destroy: number
  ): number;
  hb_blob_destroy(blob: number): void;
  hb_blob_get_data(blob: number, length: number): number;
  hb_blob_get_length(blob: number): number;
  hb_face_create(blob: number, index: number): number;
  hb_face_destroy(face: number): void;
  hb_face_reference_blob(face: number): number;
  hb_subset_or_fail(face: number, input: number): number;
  hb_set_clear(set: number): void;
  hb_set_invert(set: number): void;
  hb_set_add(set: number, value: number): void;
  hb_set_del(set: number, value: number): void;
}

// HarfBuzz subset-input set tags (hb-subset.h)
const HB_SUBSET_SETS_DROP_TABLE_TAG = 3;
const HB_SUBSET_SETS_NAME_ID = 4;
const HB_SUBSET_SETS_LAYOUT_FEATURE_TAG = 6;

let hbPromise: Promise<{ exports: HbExports; heap: Uint8Array }> | null = null;

async function loadHarfbuzzSubset(): Promise<{
  exports: HbExports;
  heap: Uint8Array;
}> {
  if (hbPromise) {return hbPromise;}
  hbPromise = (async () => {
    const wasmBytes = base64ToBytes(hbSubsetWasmBase64);
    const { instance } = await WebAssembly.instantiate(wasmBytes, {});
    const exports = instance.exports as unknown as HbExports;
    const heap = new Uint8Array(exports.memory.buffer);
    return { exports, heap };
  })();
  return hbPromise;
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = typeof atob !== 'undefined'
    ? atob(b64)
    : Buffer.from(b64, 'base64').toString('binary');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/** Pack a 4-char tag into the uint32 harfbuzz expects (big-endian ASCII). */
function hbTag(s: string): number {
  return s
    .padEnd(4, ' ')
    .split('')
    .reduce((acc, ch) => (acc << 8) + ch.charCodeAt(0), 0) >>> 0;
}

export interface FlattenOptions {
  /** Target weight on the `wght` axis (e.g. 400, 700). */
  weight?: number;
  /**
   * Italic flavor: 0 = roman, 1 = italic. Only applied if the font has an
   * `ital` axis or a separate `slnt` axis. Variable fonts typically have one
   * or the other.
   */
  italic?: boolean;
  /**
   * Optional width axis target (`wdth`, default 100 = normal).
   */
  width?: number;
}

/**
 * Rebuild a TTF, dropping variation-only tables and stripping name records
 * with nameID >= 256. The TTF format is a header + table directory + tables;
 * we recompute the directory (offsets/lengths) and the head.checkSumAdjustment.
 *
 * Background: after `hb_subset_or_fail` instances a variable font, the
 * resulting bytes can still contain a STAT table (Style Attributes) and a
 * pile of nameID 256+ records that name the variation axes ("Weight",
 * "Thin", "Bold", "Italic"…). Microsoft Office's font loader treats these
 * as malformed and silently drops the font — even though Google Slides,
 * Quick Look, and modern font tools accept it. Removing them is what makes
 * the font usable in PowerPoint.
 */
function stripVariationLeftovers(bytes: Uint8Array): Uint8Array {
  if (bytes.length < 12) {return bytes;}
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const numTables = dv.getUint16(4);

  const dropTags = new Set([
    'STAT',
    'avar',
    'cvar',
    'fvar',
    'gvar',
    'HVAR',
    'MVAR',
    'VVAR',
  ]);

  interface TableEntry {
    tag: string;
    checksum: number;
    offset: number;
    length: number;
    data: Uint8Array;
  }

  const entries: TableEntry[] = [];
  let headData: Uint8Array | null = null;
  let nameIdx = -1;

  for (let i = 0; i < numTables; i++) {
    const dirOff = 12 + i * 16;
    const tag = String.fromCharCode(
      bytes[dirOff],
      bytes[dirOff + 1],
      bytes[dirOff + 2],
      bytes[dirOff + 3]
    );
    const checksum = dv.getUint32(dirOff + 4);
    const offset = dv.getUint32(dirOff + 8);
    const length = dv.getUint32(dirOff + 12);
    if (dropTags.has(tag)) {continue;}

    const data = bytes.subarray(offset, offset + length);
    entries.push({ tag, checksum, offset, length, data });
    if (tag === 'head') {headData = data.slice();} // mutable copy
    if (tag === 'name') {nameIdx = entries.length - 1;}
  }

  // Rewrite `name` to keep only records with nameID <= 25.
  if (nameIdx >= 0) {
    const rebuilt = rebuildNameTable(entries[nameIdx].data);
    if (rebuilt) {
      entries[nameIdx] = {
        tag: 'name',
        checksum: 0, // recomputed below
        offset: 0,
        length: rebuilt.length,
        data: rebuilt,
      };
    }
  }

  if (!headData) {return bytes;} // unexpected; bail.

  // Zero out checkSumAdjustment in head (offset 8 within head table) before
  // computing checksums; we'll patch it in at the end.
  const headDv = new DataView(headData.buffer, headData.byteOffset, headData.byteLength);
  headDv.setUint32(8, 0);
  const headEntry = entries.find((e) => e.tag === 'head')!;
  headEntry.data = headData;
  headEntry.length = headData.length;

  // Compute table sizes, offsets, and per-table checksums.
  const newNumTables = entries.length;
  let cursor = 12 + newNumTables * 16;
  for (const e of entries) {
    e.offset = cursor;
    e.checksum = checksumTable(e.data);
    cursor += pad4(e.length);
  }
  const totalSize = cursor;

  const out = new Uint8Array(totalSize);
  const outDv = new DataView(out.buffer);

  // sfnt header: keep scaler type (TTF=0x00010000 or OTF "OTTO"), update num/range fields.
  out.set(bytes.subarray(0, 12), 0);
  outDv.setUint16(4, newNumTables);
  // Recompute searchRange / entrySelector / rangeShift for searchability.
  const log2 = Math.floor(Math.log2(newNumTables));
  const searchRange = (1 << log2) * 16;
  outDv.setUint16(6, searchRange);
  outDv.setUint16(8, log2);
  outDv.setUint16(10, newNumTables * 16 - searchRange);

  // Sort entries by tag for the directory (sfnt spec mandates alphabetical
  // ordering of table records).
  entries.sort((a, b) => (a.tag < b.tag ? -1 : a.tag > b.tag ? 1 : 0));

  // Recompute offsets after sort.
  let cur = 12 + newNumTables * 16;
  for (const e of entries) {
    e.offset = cur;
    cur += pad4(e.length);
  }

  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const dirOff = 12 + i * 16;
    out[dirOff] = e.tag.charCodeAt(0);
    out[dirOff + 1] = e.tag.charCodeAt(1);
    out[dirOff + 2] = e.tag.charCodeAt(2);
    out[dirOff + 3] = e.tag.charCodeAt(3);
    outDv.setUint32(dirOff + 4, e.checksum);
    outDv.setUint32(dirOff + 8, e.offset);
    outDv.setUint32(dirOff + 12, e.length);
    out.set(e.data, e.offset);
    // Padding bytes are already zero (Uint8Array initialised to 0).
  }

  // Compute and patch head.checkSumAdjustment = 0xB1B0AFBA - checksum(font).
  const fontChecksum = checksumTable(out);
  const adjustment = (0xb1b0afba - fontChecksum) >>> 0;
  const headEntryFinal = entries.find((e) => e.tag === 'head')!;
  outDv.setUint32(headEntryFinal.offset + 8, adjustment);

  return out;
}

function pad4(n: number): number {
  return (n + 3) & ~3;
}

/**
 * Patch OS/2.fsSelection, head.macStyle, and the `name` table style records
 * (nameID 2 and 4 + nameID 17 if present) so the static font correctly
 * reports its slot to font-resolution machinery.
 *
 * Without this, all four slots of a flattened Inter still report
 * "Style: Regular" and PowerPoint groups them as four duplicate Regulars,
 * never showing Bold/Italic. With it, slot lookup works as expected.
 */
function applyStyleFlags(
  bytes: Uint8Array,
  opts: { weight: number; italic: boolean }
): Uint8Array {
  const isBold = opts.weight >= 600;
  const isItalic = opts.italic;
  const styleName =
    isBold && isItalic
      ? 'Bold Italic'
      : isBold
        ? 'Bold'
        : isItalic
          ? 'Italic'
          : 'Regular';

  // Read directory to find OS/2, head, name tables.
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const numTables = dv.getUint16(4);
  let os2Off = -1, headOff = -1, nameOff = -1;
  let nameTableLength = 0;
  let osDirIdx = -1, headDirIdx = -1, nameDirIdx = -1;
  for (let i = 0; i < numTables; i++) {
    const dirOff = 12 + i * 16;
    const tag = String.fromCharCode(
      bytes[dirOff],
      bytes[dirOff + 1],
      bytes[dirOff + 2],
      bytes[dirOff + 3]
    );
    const offset = dv.getUint32(dirOff + 8);
    const length = dv.getUint32(dirOff + 12);
    if (tag === 'OS/2') {
      os2Off = offset;
      osDirIdx = i;
    } else if (tag === 'head') {
      headOff = offset;
      headDirIdx = i;
    } else if (tag === 'name') {
      nameOff = offset;
      nameTableLength = length;
      nameDirIdx = i;
    }
  }
  if (os2Off < 0 || headOff < 0 || nameOff < 0) {return bytes;}

  // 1. Rewrite OS/2.fsSelection (offset 62, uint16) and weight class (offset 4).
  //    Bit 0 = ITALIC, bit 5 = BOLD, bit 6 = REGULAR.
  //    We always set USE_TYPO_METRICS (bit 7) since the source had it.
  let fsSel = 0;
  if (isItalic) {fsSel |= 0x01;}
  if (isBold) {fsSel |= 0x20;}
  if (!isBold && !isItalic) {fsSel |= 0x40;}
  fsSel |= 0x0080; // USE_TYPO_METRICS — inherited from Inter source

  const outDv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  outDv.setUint16(os2Off + 4, opts.weight);
  outDv.setUint16(os2Off + 62, fsSel);

  // 2. head.macStyle (offset 44, uint16) — bit 0 = Bold, bit 1 = Italic.
  let macStyle = 0;
  if (isBold) {macStyle |= 0x01;}
  if (isItalic) {macStyle |= 0x02;}
  outDv.setUint16(headOff + 44, macStyle);

  // 3. Rewrite the name table. We need to update nameID 2 (style) and
  //    nameID 4 (full name = "Family Style"). Since name records have
  //    variable-length strings, we rebuild the whole name table.
  const nameBytes = bytes.subarray(nameOff, nameOff + nameTableLength);
  const newName = rewriteNameStyles(nameBytes, styleName);

  if (!newName) {return bytes;}

  // Reassemble the font with the new name table. Easiest: walk all tables,
  // recompute offsets, write a new sfnt.
  interface Entry { tag: string; data: Uint8Array; checksum: number; offset: number; }
  const entries: Entry[] = [];
  const oldNameDataLen = nameTableLength;
  for (let i = 0; i < numTables; i++) {
    const dirOff = 12 + i * 16;
    const tag = String.fromCharCode(
      bytes[dirOff], bytes[dirOff + 1], bytes[dirOff + 2], bytes[dirOff + 3]
    );
    const off = dv.getUint32(dirOff + 8);
    const len = dv.getUint32(dirOff + 12);
    let data: Uint8Array;
    if (tag === 'name') {
      data = newName;
    } else {
      data = bytes.subarray(off, off + len);
    }
    entries.push({ tag, data, checksum: 0, offset: 0 });
  }
  entries.sort((a, b) => (a.tag < b.tag ? -1 : a.tag > b.tag ? 1 : 0));

  const newNumTables = entries.length;
  let cur = 12 + newNumTables * 16;
  for (const e of entries) {
    e.offset = cur;
    e.checksum = checksumTable(e.data);
    cur += pad4(e.data.length);
  }
  const total = cur;

  const result = new Uint8Array(total);
  const resDv = new DataView(result.buffer);
  result.set(bytes.subarray(0, 12), 0);
  resDv.setUint16(4, newNumTables);
  const log2 = Math.floor(Math.log2(newNumTables));
  const searchRange = (1 << log2) * 16;
  resDv.setUint16(6, searchRange);
  resDv.setUint16(8, log2);
  resDv.setUint16(10, newNumTables * 16 - searchRange);

  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const dirOff = 12 + i * 16;
    result[dirOff] = e.tag.charCodeAt(0);
    result[dirOff + 1] = e.tag.charCodeAt(1);
    result[dirOff + 2] = e.tag.charCodeAt(2);
    result[dirOff + 3] = e.tag.charCodeAt(3);
    resDv.setUint32(dirOff + 4, e.checksum);
    resDv.setUint32(dirOff + 8, e.offset);
    resDv.setUint32(dirOff + 12, e.data.length);
    result.set(e.data, e.offset);
  }

  // Zero head.checkSumAdjustment, compute font checksum, patch.
  const headEntryFinal = entries.find((e) => e.tag === 'head')!;
  resDv.setUint32(headEntryFinal.offset + 8, 0);
  const fontChecksum = checksumTable(result);
  resDv.setUint32(headEntryFinal.offset + 8, (0xb1b0afba - fontChecksum) >>> 0);

  return result;
}

/**
 * Rewrite the `name` table so all "Style" (nameID 2) records use `styleName`
 * and all "Full Name" (nameID 4) records use "Family Style". Family name
 * (nameID 1) is preserved as-is, since Microsoft groups variants under the
 * same family.
 */
function rewriteNameStyles(name: Uint8Array, styleName: string): Uint8Array | null {
  const dv = new DataView(name.buffer, name.byteOffset, name.byteLength);
  const format = dv.getUint16(0);
  const count = dv.getUint16(2);
  const stringOffset = dv.getUint16(4);
  if (format !== 0) {return null;}

  interface NameRec {
    platformID: number;
    encodingID: number;
    languageID: number;
    nameID: number;
    str: Uint8Array;
  }

  const recs: NameRec[] = [];
  const familyName: { ascii?: string; utf16be?: string } = {};
  for (let i = 0; i < count; i++) {
    const rec = 6 + i * 12;
    const platformID = dv.getUint16(rec);
    const encodingID = dv.getUint16(rec + 2);
    const languageID = dv.getUint16(rec + 4);
    const nameID = dv.getUint16(rec + 6);
    const length = dv.getUint16(rec + 8);
    const off = dv.getUint16(rec + 10);
    const str = name.subarray(stringOffset + off, stringOffset + off + length);
    if (nameID === 1) {
      // Cache family per encoding.
      if (platformID === 1) {familyName.ascii = decodeAscii(str);}
      else if (platformID === 0 || platformID === 3) {familyName.utf16be = decodeUtf16BE(str);}
    }
    recs.push({ platformID, encodingID, languageID, nameID, str });
  }

  // Now rewrite nameID 2 and nameID 4.
  for (const r of recs) {
    if (r.nameID === 2) {
      r.str = encodeForPlatform(styleName, r.platformID);
    } else if (r.nameID === 4) {
      const fam =
        r.platformID === 1
          ? familyName.ascii || 'Inter'
          : familyName.utf16be || 'Inter';
      r.str = encodeForPlatform(`${fam} ${styleName}`, r.platformID);
    } else if (r.nameID === 6) {
      // PostScript name: Family-Style with no space, no special chars.
      const fam =
        r.platformID === 1
          ? familyName.ascii || 'Inter'
          : familyName.utf16be || 'Inter';
      const psName = `${fam}-${styleName.replace(/\s+/g, '')}`;
      r.str = encodeForPlatform(psName, r.platformID);
    }
  }

  // Build pool + record table.
  const pool: number[] = [];
  const strIndex = new Map<string, number>();
  const offs: number[] = [];
  for (const r of recs) {
    const key = `${r.str.length}:${Array.from(r.str).join(',')}`;
    let off = strIndex.get(key);
    if (off === undefined) {
      off = pool.length;
      for (const b of r.str) {pool.push(b);}
      strIndex.set(key, off);
    }
    offs.push(off);
  }

  const newCount = recs.length;
  const headerSize = 6 + newCount * 12;
  const total = headerSize + pool.length;
  const out = new Uint8Array(total);
  const outDv = new DataView(out.buffer);
  outDv.setUint16(0, 0);
  outDv.setUint16(2, newCount);
  outDv.setUint16(4, headerSize);

  for (let i = 0; i < newCount; i++) {
    const r = recs[i];
    const recOff = 6 + i * 12;
    outDv.setUint16(recOff, r.platformID);
    outDv.setUint16(recOff + 2, r.encodingID);
    outDv.setUint16(recOff + 4, r.languageID);
    outDv.setUint16(recOff + 6, r.nameID);
    outDv.setUint16(recOff + 8, r.str.length);
    outDv.setUint16(recOff + 10, offs[i]);
  }
  for (let i = 0; i < pool.length; i++) {
    out[headerSize + i] = pool[i];
  }
  return out;
}

function decodeAscii(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) {s += String.fromCharCode(b);}
  return s;
}

function decodeUtf16BE(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i + 1 < bytes.length; i += 2) {
    s += String.fromCharCode((bytes[i] << 8) | bytes[i + 1]);
  }
  return s;
}

function encodeForPlatform(s: string, platformID: number): Uint8Array {
  if (platformID === 1) {
    // Macintosh: ASCII (we keep within ASCII for style names).
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) {out[i] = s.charCodeAt(i) & 0xff;}
    return out;
  }
  // Windows / Unicode: UTF-16 BE.
  const out = new Uint8Array(s.length * 2);
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    out[i * 2] = (c >> 8) & 0xff;
    out[i * 2 + 1] = c & 0xff;
  }
  return out;
}

function checksumTable(data: Uint8Array): number {
  let sum = 0;
  const len = data.length;
  let i = 0;
  // Process full 4-byte chunks
  for (; i + 4 <= len; i += 4) {
    const word =
      (data[i] << 24) | (data[i + 1] << 16) | (data[i + 2] << 8) | data[i + 3];
    sum = (sum + word) >>> 0;
  }
  // Tail: pad with zeros to 4 bytes
  if (i < len) {
    let tail = 0;
    for (let k = 0; k < 4; k++) {
      const byte = i + k < len ? data[i + k] : 0;
      tail = (tail << 8) | byte;
    }
    sum = (sum + tail) >>> 0;
  }
  return sum;
}

/**
 * Rebuild the `name` table keeping only records with nameID <= 25 (the
 * standard OpenType name IDs: family, style, full name, version, etc.).
 * Records with nameID 256+ are variation-axis value names that are
 * meaningless for a static instance and confuse Microsoft Office.
 *
 * The name table format is fixed-size header + N x 12-byte records + string
 * pool. Strings are stored by reference (offset + length); after filtering
 * records we compact the string pool and rewrite offsets.
 */
function rebuildNameTable(name: Uint8Array): Uint8Array | null {
  if (name.length < 6) {return null;}
  const dv = new DataView(name.buffer, name.byteOffset, name.byteLength);
  const format = dv.getUint16(0);
  const count = dv.getUint16(2);
  const stringOffset = dv.getUint16(4);
  if (format !== 0) {return null;} // langTagRecord format 1 is rare; we don't handle it.

  interface NameRec {
    platformID: number;
    encodingID: number;
    languageID: number;
    nameID: number;
    str: Uint8Array;
  }

  const kept: NameRec[] = [];
  for (let i = 0; i < count; i++) {
    const rec = 6 + i * 12;
    const platformID = dv.getUint16(rec);
    const encodingID = dv.getUint16(rec + 2);
    const languageID = dv.getUint16(rec + 4);
    const nameID = dv.getUint16(rec + 6);
    const length = dv.getUint16(rec + 8);
    const off = dv.getUint16(rec + 10);
    if (nameID > 25) {continue;}
    const str = name.subarray(stringOffset + off, stringOffset + off + length);
    kept.push({ platformID, encodingID, languageID, nameID, str });
  }

  if (kept.length === 0) {return null;}

  // Build a new string pool, deduplicating identical strings.
  const pool: number[] = [];
  const strIndex = new Map<string, number>();
  const recOffsets: number[] = [];
  for (const k of kept) {
    const key = `${k.str.length}:${Array.from(k.str).join(',')}`;
    let off = strIndex.get(key);
    if (off === undefined) {
      off = pool.length;
      for (const b of k.str) {pool.push(b);}
      strIndex.set(key, off);
    }
    recOffsets.push(off);
  }

  const newCount = kept.length;
  const headerSize = 6 + newCount * 12;
  const totalSize = headerSize + pool.length;
  const out = new Uint8Array(totalSize);
  const outDv = new DataView(out.buffer);
  outDv.setUint16(0, 0); // format
  outDv.setUint16(2, newCount);
  outDv.setUint16(4, headerSize);

  for (let i = 0; i < newCount; i++) {
    const k = kept[i];
    const recOff = 6 + i * 12;
    outDv.setUint16(recOff, k.platformID);
    outDv.setUint16(recOff + 2, k.encodingID);
    outDv.setUint16(recOff + 4, k.languageID);
    outDv.setUint16(recOff + 6, k.nameID);
    outDv.setUint16(recOff + 8, k.str.length);
    outDv.setUint16(recOff + 10, recOffsets[i]);
  }
  for (let i = 0; i < pool.length; i++) {
    out[headerSize + i] = pool[i];
  }
  return out;
}

/**
 * Returns true if the given TTF bytes contain an `fvar` table (i.e. it is a
 * variable font). Static fonts don't need flattening and should be passed
 * through unchanged.
 */
export function isVariableFont(bytes: Uint8Array): boolean {
  if (bytes.length < 12) {return false;}
  const nTables = (bytes[4] << 8) | bytes[5];
  for (let i = 0; i < nTables; i++) {
    const off = 12 + i * 16;
    if (off + 4 > bytes.length) {break;}
    const tag = String.fromCharCode(bytes[off], bytes[off + 1], bytes[off + 2], bytes[off + 3]);
    if (tag === 'fvar') {return true;}
  }
  return false;
}

/**
 * Flatten a variable font to a static TTF at the requested axis location.
 * Returns null if the operation fails — the caller should fall back to
 * embedding the variable font as-is (and accept the Office-fallback risk).
 */
export async function flattenVariableFont(
  ttfBytes: Uint8Array,
  opts: FlattenOptions = {}
): Promise<Uint8Array | null> {
  if (!isVariableFont(ttfBytes)) {
    return ttfBytes;
  }

  const { exports: hb, heap } = await loadHarfbuzzSubset();

  // Allocate the source font in WASM heap.
  const fontPtr = hb.malloc(ttfBytes.byteLength);
  // The heap view can be stale if memory has grown — refresh it.
  const heapView = new Uint8Array(hb.memory.buffer);
  heapView.set(ttfBytes, fontPtr);

  const blob = hb.hb_blob_create(fontPtr, ttfBytes.byteLength, 2, 0, 0);
  const face = hb.hb_face_create(blob, 0);
  hb.hb_blob_destroy(blob);

  const input = hb.hb_subset_input_create_or_fail();
  if (input === 0) {
    hb.hb_face_destroy(face);
    hb.free(fontPtr);
    return null;
  }

  try {
    // Keep all unicodes (we're instancing, not subsetting glyphs).
    const unicodes = hb.hb_subset_input_unicode_set(input);
    hb.hb_set_clear(unicodes);
    hb.hb_set_invert(unicodes);

    // Keep all layout features so OpenType shaping still works.
    const layoutFeatures = hb.hb_subset_input_set(input, HB_SUBSET_SETS_LAYOUT_FEATURE_TAG);
    hb.hb_set_clear(layoutFeatures);
    hb.hb_set_invert(layoutFeatures);

    // Keep only the standard name IDs (0..25). Variable fonts carry extra
    // name records for their axis values (e.g. nameID 257 = "Weight",
    // 303 = "Thin", 309 = "Bold", 320 = "Italic"). After we flatten to a
    // static instance these are nonsense — and Microsoft Office uses them to
    // decide whether to LIST the font in the picker. If MS sees a font with
    // unmapped axis-value names AND no fvar table, it considers the font
    // malformed and drops it silently. Strip them so only "Inter / Regular /
    // Inter Regular / Inter-Regular" survives.
    const nameIds = hb.hb_subset_input_set(input, HB_SUBSET_SETS_NAME_ID);
    hb.hb_set_clear(nameIds);
    for (let id = 0; id <= 25; id++) {
      hb.hb_set_add(nameIds, id);
    }

    // Drop tables that only make sense for variable fonts. `STAT` is the
    // style attributes table whose entries reference axes that no longer
    // exist after pinning; leaving it in confuses MS Office's font loader.
    const dropTables = hb.hb_subset_input_set(input, HB_SUBSET_SETS_DROP_TABLE_TAG);
    for (const tag of ['STAT', 'avar', 'cvar', 'fvar', 'gvar', 'HVAR', 'MVAR', 'VVAR']) {
      hb.hb_set_add(dropTables, hbTag(tag));
    }

    // Pin axes. We use pin_axis_location which removes the axis from the
    // resulting font's fvar table — that's what makes it a true static font.
    const weight = opts.weight ?? 400;
    const okWeight = hb.hb_subset_input_pin_axis_location(
      input,
      face,
      hbTag('wght'),
      weight
    );
    if (!okWeight) {
      // Font has no wght axis or pinning failed — try the default location.
      hb.hb_subset_input_pin_axis_to_default(input, face, hbTag('wght'));
    }

    // Optional width (most variable fonts ship with wdth, default 100).
    hb.hb_subset_input_pin_axis_location(
      input,
      face,
      hbTag('wdth'),
      opts.width ?? 100
    );

    // Italic axis (`ital` is 0 or 1, `slnt` is degrees from -20 to 0).
    if (opts.italic) {
      const okItal = hb.hb_subset_input_pin_axis_location(
        input,
        face,
        hbTag('ital'),
        1
      );
      if (!okItal) {
        // Inter and some others use slnt instead of ital.
        hb.hb_subset_input_pin_axis_location(input, face, hbTag('slnt'), -10);
      }
    } else {
      hb.hb_subset_input_pin_axis_location(input, face, hbTag('ital'), 0);
      hb.hb_subset_input_pin_axis_location(input, face, hbTag('slnt'), 0);
    }

    const subsetFace = hb.hb_subset_or_fail(face, input);
    if (subsetFace === 0) {
      hb.hb_face_destroy(face);
      hb.free(fontPtr);
      return null;
    }

    const resultBlob = hb.hb_face_reference_blob(subsetFace);
    const offset = hb.hb_blob_get_data(resultBlob, 0);
    const len = hb.hb_blob_get_length(resultBlob);

    if (len === 0) {
      hb.hb_blob_destroy(resultBlob);
      hb.hb_face_destroy(subsetFace);
      hb.hb_face_destroy(face);
      hb.free(fontPtr);
      return null;
    }

    // Copy the bytes OUT of the wasm heap before any further allocation
    // invalidates the view.
    const currentHeap = new Uint8Array(hb.memory.buffer);
    let out = new Uint8Array(len);
    out.set(currentHeap.subarray(offset, offset + len));

    hb.hb_blob_destroy(resultBlob);
    hb.hb_face_destroy(subsetFace);
    hb.hb_face_destroy(face);
    hb.free(fontPtr);

    // Post-process: hb-subset's set-modification API for NAME_ID and
    // DROP_TABLE_TAG turned out to be ineffective in this build (the
    // resulting font still carries STAT + nameID 256+ records). Strip them
    // directly: this is what makes MS Office actually accept the font.
    out = stripVariationLeftovers(out);

    // Then update the OS/2 and head style flags + name records so PowerPoint
    // reads the font as the correct (Bold / Italic / Bold-Italic) flavor.
    out = applyStyleFlags(out, {
      weight: opts.weight ?? 400,
      italic: !!opts.italic,
    });

    return out;
  } finally {
    hb.hb_subset_input_destroy(input);
  }
}
