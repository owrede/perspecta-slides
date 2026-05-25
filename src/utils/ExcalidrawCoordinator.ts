/**
 * ExcalidrawCoordinator — single owner of all Excalidraw-related runtime
 * state in the plugin.
 *
 * Pre-extraction, main.ts carried this state directly:
 *   - an `ExcalidrawRenderer | null` field (parses & rasterises drawings)
 *   - a `Set<string>` tracking in-flight conversions
 *   - `logExcalidraw` / `warnExcalidraw` / `errorExcalidraw` debug helpers
 *   - cache-handoff plumbing (`setExcalidrawSvgCache`, `setFailedDecompressionFiles`)
 *     repeated at four call sites that needed to pass the renderer's caches
 *     into a presentation window or thumbnail view
 *
 * Consolidating into one object has three concrete payoffs:
 *
 *   1. `main.ts` no longer needs to know how the conversion pipeline
 *      tracks state — it asks the coordinator to "attach to this view"
 *      and the coordinator forwards the right cache references.
 *   2. The async-conversion completion callback is wired up once at
 *      construction (`onSvgConverted`), so the resolver factory doesn't
 *      need to know about re-rendering, and the plugin doesn't need to
 *      know about conversion bookkeeping.
 *   3. `ExportService` and `PdfExportService` keep their existing
 *      `setExcalidrawRenderer(renderer)` API — the coordinator exposes
 *      the underlying renderer for that handoff. We didn't change those
 *      services' shapes; refactoring them is a separate concern.
 *
 * The coordinator is intentionally NOT View-aware. It doesn't know about
 * `PresentationView`, `ThumbnailNavigatorView`, etc. The plugin keeps
 * the re-render orchestration that iterates over leaves, and passes its
 * trigger as a callback.
 */

import type { TFile, Vault } from 'obsidian';
import { ExcalidrawRenderer, type ExcalidrawCacheEntry } from './ExcalidrawRenderer';
import type { DebugService } from './DebugService';

/**
 * Anything that exposes the two cache-receiving methods —
 * PresentationWindow, ThumbnailNavigatorView, PresentationView all do.
 * Duck-typed so this module doesn't need to import every consumer.
 */
export interface ExcalidrawCacheConsumer {
  setExcalidrawSvgCache: (cache: Map<string, ExcalidrawCacheEntry>) => void;
  setFailedDecompressionFiles: (files: Set<string>) => void;
}

export interface ExcalidrawCoordinatorOptions {
  vault: Vault;
  debugService: DebugService;
  /**
   * Called whenever an async SVG conversion completes. The plugin uses
   * this to trigger a re-render of any open presentation window or
   * editor view that may be showing the now-resolvable Excalidraw
   * image. Fired without arguments — the consumer is expected to
   * re-render whatever needs re-rendering.
   */
  onSvgConverted: () => void;
}

export class ExcalidrawCoordinator {
  private renderer: ExcalidrawRenderer;
  private debugService: DebugService;
  private onSvgConverted: () => void;
  private conversionsInProgress: Set<string> = new Set();

  constructor(opts: ExcalidrawCoordinatorOptions) {
    this.renderer = new ExcalidrawRenderer(opts.vault);
    this.debugService = opts.debugService;
    this.onSvgConverted = opts.onSvgConverted;
  }

  /**
   * The underlying renderer. Exposed for export services that already
   * accept an `ExcalidrawRenderer` directly. New code should prefer the
   * coordinator's higher-level methods.
   */
  getRenderer(): ExcalidrawRenderer {
    return this.renderer;
  }

  /**
   * Forward both the SVG cache and the failed-decompression list to a
   * view or window that needs to display Excalidraw drawings. Replaces
   * the four-line pattern of two `setExcalidraw…` calls guarded by a
   * null check that used to be open-coded at every call site.
   */
  attachCaches(consumer: ExcalidrawCacheConsumer): void {
    consumer.setExcalidrawSvgCache(this.renderer.getSvgCache());
    consumer.setFailedDecompressionFiles(this.renderer.getFailedDecompressionFiles());
  }

  /**
   * Has an SVG for this cache key been produced and is it still fresh
   * compared to the source file's mtime? Mirrors the renderer's own
   * predicate; exposed here so the resolver factory doesn't need a
   * direct renderer reference.
   */
  hasCachedSvg(cacheKey: string, fileMtime: number): boolean {
    return this.renderer.hasCachedSvg(cacheKey, fileMtime);
  }

  /** Is a conversion already running for this cache key? */
  isConverting(cacheKey: string): boolean {
    return this.conversionsInProgress.has(cacheKey);
  }

  /**
   * Trigger async SVG conversion for the given Excalidraw file (with
   * optional ref-type/ref-id for partial-drawing references like
   * `#^group=…`). Fire-and-forget: the coordinator tracks the in-flight
   * state, logs progress, and fires `onSvgConverted` when the SVG lands
   * in the cache.
   *
   * No-op if a conversion is already running for the same cache key.
   */
  startConversion(
    linkedFile: TFile,
    refType: 'group' | 'area' | 'frame' | 'clippedframe' | null,
    refId: string | null,
    cacheKey: string
  ): void {
    if (this.conversionsInProgress.has(cacheKey)) {
      return;
    }
    this.log(`Starting async conversion for: ${cacheKey}`);
    this.conversionsInProgress.add(cacheKey);

    void (async () => {
      try {
        await this.renderer.toSvgDataUrl(
          linkedFile,
          refType ?? undefined,
          refId ?? undefined
        );
        this.log(`✅ Converted to SVG: ${cacheKey}`);
        this.onSvgConverted();
      } catch (e) {
        this.error(`Failed to convert Excalidraw to SVG: ${cacheKey}`, e);
      } finally {
        this.conversionsInProgress.delete(cacheKey);
      }
    })();
  }

  /** Debug-channel log on the `excalidraw` topic. */
  log(message: string, data?: unknown): void {
    this.debugService.log('excalidraw', message, data);
  }

  /** Debug-channel error on the `excalidraw` topic. */
  error(message: string, data?: unknown): void {
    this.debugService.error('excalidraw', message, data);
  }
}
