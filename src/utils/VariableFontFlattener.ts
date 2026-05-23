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
}

let hbPromise: Promise<{ exports: HbExports; heap: Uint8Array }> | null = null;

async function loadHarfbuzzSubset(): Promise<{
  exports: HbExports;
  heap: Uint8Array;
}> {
  if (hbPromise) return hbPromise;
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
 * Returns true if the given TTF bytes contain an `fvar` table (i.e. it is a
 * variable font). Static fonts don't need flattening and should be passed
 * through unchanged.
 */
export function isVariableFont(bytes: Uint8Array): boolean {
  if (bytes.length < 12) return false;
  const nTables = (bytes[4] << 8) | bytes[5];
  for (let i = 0; i < nTables; i++) {
    const off = 12 + i * 16;
    if (off + 4 > bytes.length) break;
    const tag = String.fromCharCode(bytes[off], bytes[off + 1], bytes[off + 2], bytes[off + 3]);
    if (tag === 'fvar') return true;
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
    // Already static — pass through.
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
    const layoutFeatures = hb.hb_subset_input_set(input, 6 /* LAYOUT_FEATURE_TAG */);
    hb.hb_set_clear(layoutFeatures);
    hb.hb_set_invert(layoutFeatures);

    // Keep all name IDs (so the family/style names survive).
    const nameIds = hb.hb_subset_input_set(input, 4 /* NAME_ID */);
    hb.hb_set_clear(nameIds);
    hb.hb_set_invert(nameIds);

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
    const out = new Uint8Array(len);
    out.set(currentHeap.subarray(offset, offset + len));

    hb.hb_blob_destroy(resultBlob);
    hb.hb_face_destroy(subsetFace);
    hb.hb_face_destroy(face);
    hb.free(fontPtr);

    return out;
  } finally {
    hb.hb_subset_input_destroy(input);
  }
}
