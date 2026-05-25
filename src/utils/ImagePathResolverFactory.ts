/**
 * ImagePathResolverFactory — single source of truth for resolving
 * `![[...]]` and `![...]()` image paths in slide markdown.
 *
 * Pre-extraction, main.ts carried three near-identical resolver
 * implementations (~600 lines): one for the in-editor sidebar/inspector
 * (uses Obsidian's `app:` resource URLs), one for the external Electron
 * presentation window (needs `file://` URLs because it doesn't have
 * Obsidian's custom protocol handler), and one for the presentation
 * window with an explicit source path (needed when the active file isn't
 * the slide deck being rendered). Every bugfix had to be made three
 * times; the three paths inevitably drifted.
 *
 * This module unifies them around one resolver function parameterised by
 * a small config. URL mode (`app:` vs `file://`), source-path strategy
 * (active file vs explicit), and the Excalidraw async-conversion trigger
 * are explicit knobs.
 *
 * The factory also owns three small helpers that used to live on the
 * plugin: `extractExcalidrawReference`, `convertToFileUrl`, and the
 * is-Excalidraw-file detection. None of those depend on plugin state.
 *
 * Phase-2 behaviour normalisations (vs the pre-extraction code paths):
 *   - URL passthrough (`http(s)://`, `file://`, leading `/`) now applies
 *     to all resolvers including the inspector path. Pre-extraction, the
 *     inspector resolver fell through and tried to resolve URLs as
 *     vault wiki-links, which silently returned the original string —
 *     same result but with extra `metadataCache` work and a `warn` log.
 *   - Excalidraw async conversion is now eagerly triggered on first
 *     resolve, for all three configurations. The external-window
 *     resolvers only triggered conversion in the export-fallback branch,
 *     so the very first render of an Excalidraw slide always showed a
 *     placeholder until the next render cycle. The inspector already
 *     behaved this way.
 *   - The placeholder `excalidraw://` URL now always carries the cache
 *     key (which encodes the ref-type/ref-id when present). The
 *     pre-extraction inspector resolver used the bare file path for
 *     unreffed Excalidraws, which could be ambiguous when the same file
 *     was referenced multiple ways on different slides.
 */

import type { App, TFile } from 'obsidian';
import { FileSystemAdapter } from 'obsidian';
import { join as pathJoin } from 'path';
import type { ImagePathResolver } from '../renderer/SlideRenderer';
import type { ExcalidrawCoordinator } from './ExcalidrawCoordinator';

/**
 * Excalidraw reference types supported on a wiki-link:
 *   ![[deck.excalidraw#^group=hero]]
 *   ![[deck.excalidraw#^area=summary]]
 *   ![[deck.excalidraw#^frame=intro]]
 *   ![[deck.excalidraw#^clippedframe=zoom]]
 */
export type ExcalidrawRefType = 'group' | 'area' | 'frame' | 'clippedframe';

export interface ExcalidrawReference {
  filePath: string;
  refType: ExcalidrawRefType | null;
  refId: string | null;
}

/** Extract a possible Excalidraw reference from a wiki-link path. Pure. */
export function extractExcalidrawReference(path: string): ExcalidrawReference {
  const refMatch = path.match(/#\^(group|area|frame|clippedframe)=([^#&|]+)/);
  if (refMatch) {
    return {
      filePath: path.split('#')[0],
      refType: refMatch[1] as ExcalidrawRefType,
      refId: refMatch[2],
    };
  }
  return { filePath: path.split('#')[0], refType: null, refId: null };
}

/**
 * Convert an absolute filesystem path to a `file://` URL with
 * platform-correct slash + percent-encoding handling. Windows needs an
 * extra leading slash before the drive letter; `#` must be percent-
 * encoded so it isn't mistaken for a URL fragment.
 */
export function convertToFileUrl(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  const urlPath =
    process.platform === 'win32' && normalized[1] === ':' ? `/${normalized}` : normalized;
  return `file://${encodeURI(urlPath).replace(/#/g, '%23')}`;
}

/**
 * Heuristic Excalidraw file detection. Obsidian's official Excalidraw
 * plugin stores drawings as `.md` files (with embedded JSON or
 * compressed-json) — pure extension check is insufficient.
 */
export function isExcalidrawFile(file: TFile): boolean {
  if (file.extension === 'excalidraw') {
    return true;
  }
  if (file.extension !== 'md') {
    return false;
  }
  return file.path.includes('Excalidraw/') || file.name.includes('.excalidraw');
}

/**
 * Dependencies the factory needs from the plugin. Passed once at
 * construction so resolvers stay closure-cheap.
 *
 * `excalidraw` is null before the coordinator has been initialised
 * (e.g. very early in `onload`); resolvers handle this by falling
 * through the Excalidraw branch without triggering conversion.
 */
export interface ImagePathResolverDeps {
  app: App;
  excalidraw: ExcalidrawCoordinator | null;
}

/**
 * Per-resolver configuration. Two callers (the inspector sidebar vs the
 * external presentation window) need different URL forms; the third axis
 * is whether the source path comes from `activeFile` (sidebar follows
 * focus) or from a static parameter (presentation window pins itself to
 * the deck it opened).
 */
export interface ImagePathResolverConfig {
  /**
   * `app`: use Obsidian's `vault.getResourcePath()` (returns `app:`
   * URLs that work inside the Obsidian webview).
   *
   * `file`: use `convertToFileUrl()` against the FileSystemAdapter's
   * base path (returns `file://` URLs for the Electron presentation
   * window, which doesn't have the `app:` protocol handler).
   */
  urlMode: 'app' | 'file';
  /**
   * `active-file`: read source path from `app.workspace.getActiveFile()`
   * on every resolve. Right for the sidebar, which follows the user's
   * focus.
   *
   * `explicit`: use the passed `sourcePath` for every resolve. Right
   * for the presentation window once it's pinned to a deck file.
   */
  sourcePath: { kind: 'active-file' } | { kind: 'explicit'; path: string };
}

/**
 * Build an ImagePathResolver. The returned function is called many times
 * per render (once per `<img>` / wiki-link), so it does no allocation
 * beyond what's intrinsic to URL resolution.
 */
export function createImagePathResolver(
  deps: ImagePathResolverDeps,
  config: ImagePathResolverConfig
): ImagePathResolver {
  return (path: string, isWikiLink: boolean): string => {
    // Plain Markdown images (`![alt](url)`) and absolute paths: pass
    // through unchanged. Wiki-link form is the only path that needs
    // metadataCache resolution.
    if (!isWikiLink) {
      return path;
    }
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }
    if (path.startsWith('file://') || path.startsWith('/')) {
      return path;
    }

    try {
      const { filePath: pathWithoutRef, refType, refId } = extractExcalidrawReference(path);
      const pathWithoutBlock = pathWithoutRef.split('#')[0];
      const decodedPath = decodeURIComponent(pathWithoutBlock);

      const sourcePath =
        config.sourcePath.kind === 'active-file'
          ? deps.app.workspace.getActiveFile()?.path ?? ''
          : config.sourcePath.path;

      // Try decoded form first (handles `%20` for space etc.), then the
      // raw form as fallback for vaults with literal `%` in filenames.
      let linkedFile = deps.app.metadataCache.getFirstLinkpathDest(decodedPath, sourcePath);
      if (!linkedFile) {
        linkedFile = deps.app.metadataCache.getFirstLinkpathDest(pathWithoutBlock, sourcePath);
      }

      if (!linkedFile) {
        console.warn(`[Perspecta] Could not resolve wiki-link: ${path}`);
        return path;
      }

      if (isExcalidrawFile(linkedFile)) {
        return resolveExcalidraw(linkedFile, refType, refId, deps, config);
      }

      // Non-Excalidraw file: standard URL form.
      return toResourceUrl(linkedFile, deps.app, config.urlMode);
    } catch (e) {
      console.warn('[Perspecta] Failed to resolve image path:', path, e);
      return path;
    }
  };
}

/**
 * Excalidraw branch: build cache key, trigger async SVG conversion if
 * not cached / not in flight, and return a URL the slide renderer can
 * resolve. The renderer recognises `excalidraw://` and looks the result
 * up in the conversion cache.
 *
 * If a `.png` or `.svg` sibling file exists next to the Excalidraw file,
 * the bare-file case prefers that as a fast path (no SVG conversion
 * needed). Reference-typed forms (`#^group=...` etc.) always go through
 * conversion because the sibling files render the whole drawing.
 */
function resolveExcalidraw(
  linkedFile: TFile,
  refType: ExcalidrawRefType | null,
  refId: string | null,
  deps: ImagePathResolverDeps,
  config: ImagePathResolverConfig
): string {
  const cacheKey = refType && refId ? `${linkedFile.path}#^${refType}=${refId}` : linkedFile.path;

  if (deps.excalidraw) {
    deps.excalidraw.log(`Resolving Excalidraw drawing: ${cacheKey}`);
    triggerConversionIfNeeded(linkedFile, refType, refId, cacheKey, deps.excalidraw);
  }

  // Reference forms always render through the live Excalidraw engine.
  if (refType && refId) {
    deps.excalidraw?.log(`${refType} reference detected, using native rendering: ${cacheKey}`);
    return `excalidraw://${cacheKey}`;
  }

  // Bare file: try the export-sibling fast path first.
  const exportFile = findExcalidrawExport(linkedFile, deps.app);
  if (exportFile) {
    return toResourceUrl(exportFile, deps.app, config.urlMode);
  }

  deps.excalidraw?.log(
    `ℹ️ No Excalidraw export found for: ${linkedFile.path}\n` +
      `Returning placeholder for async conversion.`
  );
  return `excalidraw://${cacheKey}`;
}

/**
 * Look up a `.png` or `.svg` sibling file next to an Excalidraw drawing.
 * Obsidian's Excalidraw plugin writes these automatically on save when
 * the user enables "auto-export"; using them avoids the cost of running
 * the Excalidraw renderer.
 *
 * For `.md`-format Excalidraws the sibling has the base name without
 * `.md`; for legacy `.excalidraw` files the sibling can be either the
 * base name or the full name with the suffix appended.
 */
function findExcalidrawExport(linkedFile: TFile, app: App): TFile | null {
  const candidates: string[] = [];
  const basePath = linkedFile.path.replace(/\.md$/, '').replace(/\.excalidraw$/, '');
  candidates.push(basePath + '.png', basePath + '.svg');
  if (linkedFile.extension === 'excalidraw') {
    candidates.push(linkedFile.path + '.png', linkedFile.path + '.svg');
  }
  for (const candidate of candidates) {
    const file = app.vault.getAbstractFileByPath(candidate);
    // Lazy import-free TFile check: getAbstractFileByPath returns
    // TAbstractFile, but only TFile has the `stat` / `path` shape we
    // need. constructor.name check is brittle; use duck-typing via
    // presence of `stat`.
    if (file && 'stat' in file) {
      return file as TFile;
    }
  }
  return null;
}

/**
 * Convert a vault file to a URL according to the resolver's URL mode.
 * `app` mode goes through Obsidian's resource path API; `file` mode
 * needs the FileSystemAdapter base path to build an absolute filesystem
 * path before percent-encoding.
 *
 * Returns the file's path unchanged if `file` mode is requested but the
 * vault isn't filesystem-backed (e.g. mobile / web — the presentation
 * window doesn't work there anyway).
 */
function toResourceUrl(file: TFile, app: App, urlMode: 'app' | 'file'): string {
  if (urlMode === 'app') {
    return app.vault.getResourcePath(file);
  }
  const adapter = app.vault.adapter;
  if (adapter instanceof FileSystemAdapter) {
    const fullPath = pathJoin(adapter.getBasePath(), file.path);
    return convertToFileUrl(fullPath);
  }
  return file.path;
}

/**
 * Kick off SVG conversion for an Excalidraw file if it isn't already
 * cached or in flight. Fire-and-forget; the coordinator's onSvgConverted
 * callback is fired when the SVG lands in the cache, which the plugin
 * uses to re-render any open presentation window or editor view.
 */
function triggerConversionIfNeeded(
  linkedFile: TFile,
  refType: ExcalidrawRefType | null,
  refId: string | null,
  cacheKey: string,
  coordinator: ExcalidrawCoordinator
): void {
  const fileMtime = linkedFile.stat.mtime;
  if (coordinator.hasCachedSvg(cacheKey, fileMtime)) {
    coordinator.log(`SVG already cached for: ${cacheKey}`);
    return;
  }
  if (coordinator.isConverting(cacheKey)) {
    coordinator.log(`Conversion already in progress for: ${cacheKey}`);
    return;
  }
  coordinator.startConversion(linkedFile, refType, refId, cacheKey);
}
