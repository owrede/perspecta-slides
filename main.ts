import type { WorkspaceLeaf } from 'obsidian';
import { App, Plugin, MarkdownView, Notice, addIcon, FileSystemAdapter, TFile } from 'obsidian';

import type {
  PerspecaSlidesSettings,
  Presentation,
  Theme,
  PresentationFrontmatter,
} from './src/types';
import { DEFAULT_SETTINGS } from './src/types';
import { SlideParser } from './src/parser/SlideParser';
import type { ImagePathResolver } from './src/renderer/SlideRenderer';
import { SlideRenderer } from './src/renderer/SlideRenderer';
import type { getTheme } from './src/themes';
import { ThumbnailNavigatorView, THUMBNAIL_VIEW_TYPE } from './src/ui/ThumbnailNavigator';
import { InspectorPanelView, INSPECTOR_VIEW_TYPE } from './src/ui/InspectorPanel';
import { PresentationView, PRESENTATION_VIEW_TYPE } from './src/ui/PresentationView';
import { PerspectaSlidesSettingTab, CreateDemoModal } from './src/ui/SettingsTab';
import { PresentationWindow } from './src/ui/PresentationWindow';
import { PresenterWindow } from './src/ui/PresenterWindow';
import type { PresentationCache, SlideDiff } from './src/utils/SlideHasher';
import {
  buildPresentationCache,
  diffPresentations,
  requiresFullRender,
} from './src/utils/SlideHasher';
import type { FontCache } from './src/utils/FontManager';
import { FontManager } from './src/utils/FontManager';
import { ThemeExporter, SaveThemeModal } from './src/utils/ThemeExporter';
import { ThemeLoader } from './src/themes/ThemeLoader';
import { getBuiltInThemeNames } from './src/themes/builtin';
import { DebugService, setDebugService } from './src/utils/DebugService';
import { ExportService } from './src/utils/ExportService';
import { ExcalidrawRenderer } from './src/utils/ExcalidrawRenderer';

const SLIDES_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>`;

/**
 * Detect the system color scheme (light or dark)
 * Uses window.matchMedia which works in Obsidian's Electron context
 */
function getSystemColorScheme(): 'light' | 'dark' {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
}

export default class PerspectaSlidesPlugin extends Plugin {
  settings: PerspecaSlidesSettings = DEFAULT_SETTINGS;
  parser: SlideParser = new SlideParser();
  fontManager: FontManager | null = null;
  themeLoader: ThemeLoader | null = null;
  debugService: DebugService = new DebugService();
  exportService: ExportService | null = null;
  excalidrawRenderer: ExcalidrawRenderer | null = null;
  private settingsTab: PerspectaSlidesSettingTab | null = null;
  private presentationWindow: PresentationWindow | null = null;
  private presenterWindow: PresenterWindow | null = null;
  private currentPresentationFile: TFile | null = null;
  private presentationCache: PresentationCache | null = null;
  private cachedFilePath: string | null = null;
  private currentTheme: Theme | null = null;
  private lastUsedSlideDocument: TFile | null = null;
  private rerenderDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private excalidrawConversionsInProgress: Set<string> = new Set(); // Track files being converted

  /**
   * Log Excalidraw-related debug messages
   */
  private logExcalidraw(message: string, data?: any): void {
    this.debugService.log('excalidraw', message, data);
  }

  private warnExcalidraw(message: string, data?: any): void {
    this.debugService.warn('excalidraw', message, data);
  }

  private errorExcalidraw(message: string, data?: any): void {
    this.debugService.error('excalidraw', message, data);
  }

  /**
   * Excalidraw reference types supported:
   * - group=ID: Shows all elements sharing the same group
   * - area=ID: Cropped view around element's bounding box
   * - frame=ID: Shows contents of a frame (frame border may be visible)
   * - clippedframe=ID: Like frame but clips elements at frame edges with zero padding
   */
  private extractExcalidrawReference(path: string): { 
    filePath: string; 
    refType: 'group' | 'area' | 'frame' | 'clippedframe' | null;
    refId: string | null;
  } {
    // Match any of the reference types: group=, area=, frame=, clippedframe=
    const refMatch = path.match(/#\^(group|area|frame|clippedframe)=([^#&|]+)/);
    if (refMatch) {
      const filePath = path.split('#')[0];
      return { 
        filePath, 
        refType: refMatch[1] as 'group' | 'area' | 'frame' | 'clippedframe',
        refId: refMatch[2] 
      };
    }
    return { filePath: path.split('#')[0], refType: null, refId: null };
  }

  /**
   * Image path resolver for Obsidian wiki-links
   * Resolves ![[image.png]] paths to actual resource URLs
   */
  imagePathResolver: ImagePathResolver = (path: string, isWikiLink: boolean): string => {
    if (!isWikiLink) {
      // Standard markdown paths - return as-is (may be URL or relative path)
      return path;
    }

    // For wiki-links, resolve through Obsidian's system
    try {
      // Extract Excalidraw reference if present (group=, area=, frame=, clippedframe=)
      const { filePath: pathWithoutRef, refType, refId } = this.extractExcalidrawReference(path);
      
      // Strip other block references from path (e.g., "path#^blockid" -> "path")
      const pathWithoutBlock = pathWithoutRef.split('#')[0];
      
      // Decode any URL-encoded characters in the path (e.g., %20 for space)
      const decodedPath = decodeURIComponent(pathWithoutBlock);

      // Get the current file for context
      const activeFile = this.app.workspace.getActiveFile();
      const sourcePath = activeFile?.path || '';

      // Resolve the link to a file
      let linkedFile = this.app.metadataCache.getFirstLinkpathDest(decodedPath, sourcePath);

      if (!linkedFile) {
        // Try with original path as fallback
        linkedFile = this.app.metadataCache.getFirstLinkpathDest(pathWithoutBlock, sourcePath);
      }

      if (linkedFile) {
        // Check if this is an Excalidraw file (either .excalidraw or .md in Excalidraw folder)
        const isExcalidrawFile = 
          linkedFile.extension === 'excalidraw' || 
          (linkedFile.extension === 'md' && 
            (linkedFile.path.includes('Excalidraw/') || linkedFile.name.includes('.excalidraw')));

        if (isExcalidrawFile) {
          // Build cache key including reference type and ID if present
          const cacheKey = refType && refId 
            ? `${linkedFile.path}#^${refType}=${refId}` 
            : linkedFile.path;
          this.logExcalidraw(`Resolving Excalidraw drawing: ${cacheKey}`);

          // Check if SVG is already cached (and not stale) or conversion is in progress
          // Use file mtime to invalidate cache when Excalidraw file is modified
          const fileMtime = linkedFile.stat.mtime;
          const isCached = this.excalidrawRenderer?.hasCachedSvg(cacheKey, fileMtime);
          const isConverting = this.excalidrawConversionsInProgress.has(cacheKey);

          if (!isCached && !isConverting && this.excalidrawRenderer) {
            this.logExcalidraw(`Starting async conversion for: ${cacheKey}`);
            this.excalidrawConversionsInProgress.add(cacheKey);

            // Start async conversion immediately (non-blocking)
            // Once complete, trigger a re-render so the cached SVG is displayed
            void (async () => {
              try {
                await this.excalidrawRenderer!.toSvgDataUrl(
                  linkedFile, 
                  refType ?? undefined, 
                  refId ?? undefined
                );
                this.logExcalidraw(`✅ Converted to SVG: ${cacheKey}`);
                // Trigger re-render to display the now-cached SVG
                void this.rerenderPresentationWindow();
              } catch (e) {
                this.errorExcalidraw(`Failed to convert Excalidraw to SVG: ${cacheKey}`, e);
              } finally {
                // Remove from in-progress set
                this.excalidrawConversionsInProgress.delete(cacheKey);
              }
            })();
          } else if (isCached) {
            this.logExcalidraw(`SVG already cached for: ${cacheKey}`);
          } else if (isConverting) {
            this.logExcalidraw(`Conversion already in progress for: ${cacheKey}`);
          }

          // For any reference type, skip PNG/SVG export lookup and use native rendering
          if (refType && refId) {
            this.logExcalidraw(`${refType} reference detected, using native rendering: ${cacheKey}`);
            return `excalidraw://${cacheKey}`;
          }

          // Fallback: For Excalidraw .md files, look for PNG/SVG exports
          const basePath = linkedFile.path.replace(/\.md$/, '');

          // Try .png first (export without extension suffix)
          let pngPath = basePath + '.png';
          let exportFile = this.app.vault.getAbstractFileByPath(pngPath);
          if (exportFile instanceof TFile) {
            const resourcePath = this.app.vault.getResourcePath(exportFile);
            this.logExcalidraw(`✅ Found PNG export: ${pngPath}`);
            return resourcePath;
          }

          // Try .svg
          let svgPath = basePath + '.svg';
          exportFile = this.app.vault.getAbstractFileByPath(svgPath);
          if (exportFile instanceof TFile) {
            const resourcePath = this.app.vault.getResourcePath(exportFile);
            this.logExcalidraw(`✅ Found SVG export: ${svgPath}`);
            return resourcePath;
          }

          // For .excalidraw files, also try with .excalidraw suffix
          if (linkedFile.extension === 'excalidraw') {
            pngPath = linkedFile.path + '.png';
            exportFile = this.app.vault.getAbstractFileByPath(pngPath);
            if (exportFile instanceof TFile) {
              const resourcePath = this.app.vault.getResourcePath(exportFile);
              this.logExcalidraw(`✅ Found PNG export: ${pngPath}`);
              return resourcePath;
            }

            svgPath = linkedFile.path + '.svg';
            exportFile = this.app.vault.getAbstractFileByPath(svgPath);
            if (exportFile instanceof TFile) {
              const resourcePath = this.app.vault.getResourcePath(exportFile);
              this.logExcalidraw(`✅ Found SVG export: ${svgPath}`);
              return resourcePath;
            }
          }

          // No export found - use Excalidraw renderer fallback
          this.logExcalidraw(
            `ℹ️ No Excalidraw export found for: ${linkedFile.path}\n` +
            `Returning placeholder for async conversion.`
          );

          // Return placeholder URL
          return `excalidraw://${linkedFile.path}`;
        }

        // For non-Excalidraw files, get the resource path directly
        return this.app.vault.getResourcePath(linkedFile);
      } else {
        console.warn(`[Perspecta] Could not resolve wiki-link: ${path}`);
      }
    } catch (e) {
      console.warn('[Perspecta] Failed to resolve image path:', path, e);
    }

    // Fallback - return original path
    return path;
  };

  /**
   * Image path resolver for presentation window (external Electron window)
   * Returns file:// URLs instead of app:// URLs since the presentation window
   * doesn't have access to Obsidian's custom protocol handler
   */
  presentationImagePathResolver: ImagePathResolver = (
    path: string,
    _isWikiLink: boolean
  ): string => {
    // Handle URLs - pass through as-is
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }

    // Handle absolute paths - pass through as-is
    if (path.startsWith('file://') || path.startsWith('/')) {
      return path;
    }

    // For wiki-links and plain filenames, resolve to file:// URL
    try {
      // Extract Excalidraw reference if present (group=, area=, frame=, clippedframe=)
      const { filePath: pathWithoutRef, refType, refId } = this.extractExcalidrawReference(path);
      
      // Strip other block references from path (e.g., "path#^blockid" -> "path")
      const pathWithoutBlock = pathWithoutRef.split('#')[0];
      
      // Decode any URL-encoded characters in the path (e.g., %20 for space)
      const decodedPath = decodeURIComponent(pathWithoutBlock);

      // Get the current file for context
      const activeFile = this.app.workspace.getActiveFile();
      const sourcePath = activeFile?.path || '';

      // Resolve the link to a file (try decoded first, then original)
      let linkedFile = this.app.metadataCache.getFirstLinkpathDest(decodedPath, sourcePath);
      if (!linkedFile) {
        linkedFile = this.app.metadataCache.getFirstLinkpathDest(pathWithoutBlock, sourcePath);
      }

      if (linkedFile) {
        // Check if this is an Excalidraw file (either .excalidraw or .md in Excalidraw folder)
        const isExcalidrawFile = 
          linkedFile.extension === 'excalidraw' || 
          (linkedFile.extension === 'md' && 
            (linkedFile.path.includes('Excalidraw/') || linkedFile.name.includes('.excalidraw')));

        if (isExcalidrawFile) {
          // Build cache key including reference type and ID if present
          const cacheKey = refType && refId 
            ? `${linkedFile.path}#^${refType}=${refId}` 
            : linkedFile.path;

          // For any reference type, skip PNG/SVG export lookup and use native rendering
          if (refType && refId) {
            this.logExcalidraw(`${refType} reference detected, using native rendering: ${cacheKey}`);
            
            // Check if SVG is already cached or conversion is in progress
            const fileMtime = linkedFile.stat.mtime;
            const isCached = this.excalidrawRenderer?.hasCachedSvg(cacheKey, fileMtime);
            const isConverting = this.excalidrawConversionsInProgress.has(cacheKey);

            if (!isCached && !isConverting && this.excalidrawRenderer) {
              this.logExcalidraw(`Starting async conversion for: ${cacheKey}`);
              this.excalidrawConversionsInProgress.add(cacheKey);

              void (async () => {
                try {
                  await this.excalidrawRenderer!.toSvgDataUrl(
                    linkedFile as TFile, 
                    refType, 
                    refId
                  );
                  this.logExcalidraw(`✅ Converted to SVG: ${cacheKey}`);
                  void this.rerenderPresentationWindow();
                } catch (e) {
                  this.errorExcalidraw(`Failed to convert Excalidraw to SVG: ${cacheKey}`, e);
                } finally {
                  this.excalidrawConversionsInProgress.delete(cacheKey);
                }
              })();
            }

            return `excalidraw://${cacheKey}`;
          }

          // For Excalidraw .md files without reference, look for PNG/SVG exports
          const basePath = linkedFile.path.replace(/\.md$/, '');
          let exportFile: TFile | null = null;

          // Try .png first
          let pngPath = basePath + '.png';
          let file = this.app.vault.getAbstractFileByPath(pngPath);
          if (file instanceof TFile) {
            exportFile = file;
          }

          // Try .svg
          if (!exportFile) {
            const svgPath = basePath + '.svg';
            file = this.app.vault.getAbstractFileByPath(svgPath);
            if (file instanceof TFile) {
              exportFile = file;
            }
          }

          // For .excalidraw files, also try with suffix
          if (!exportFile && linkedFile.extension === 'excalidraw') {
            pngPath = linkedFile.path + '.png';
            file = this.app.vault.getAbstractFileByPath(pngPath);
            if (file instanceof TFile) {
              exportFile = file;
            }

            if (!exportFile) {
              const svgPath = linkedFile.path + '.svg';
              file = this.app.vault.getAbstractFileByPath(svgPath);
              if (file instanceof TFile) {
                exportFile = file;
              }
            }
          }

          // If export found, use it
           if (exportFile) {
             const adapter = this.app.vault.adapter;
             if (adapter instanceof FileSystemAdapter) {
               const basePath = adapter.getBasePath();
               const fullPath = `${basePath}/${exportFile.path}`;
               return `file://${encodeURI(fullPath).replace(/#/g, '%23')}`;
             }
           }

           // No export found - use native Excalidraw rendering via async conversion
           this.logExcalidraw(
             `ℹ️ No Excalidraw export found for: ${linkedFile.path}\n` +
             `Returning placeholder for async conversion.`
           );

           // Check if SVG is already cached or conversion is in progress
           const fileMtime = linkedFile.stat.mtime;
           const isCached = this.excalidrawRenderer?.hasCachedSvg(cacheKey, fileMtime);
           const isConverting = this.excalidrawConversionsInProgress.has(cacheKey);

           if (!isCached && !isConverting && this.excalidrawRenderer) {
             this.logExcalidraw(`Starting async conversion for: ${cacheKey}`);
             this.excalidrawConversionsInProgress.add(cacheKey);

             // Start async conversion immediately (non-blocking)
             void (async () => {
               try {
                 await this.excalidrawRenderer!.toSvgDataUrl(
                   linkedFile, 
                   refType ?? undefined, 
                   refId ?? undefined
                 );
                 this.logExcalidraw(`✅ Converted to SVG: ${cacheKey}`);
                 // Trigger re-render to display the now-cached SVG
                 void this.rerenderPresentationWindow();
               } catch (e) {
                 this.errorExcalidraw(`Failed to convert Excalidraw to SVG: ${cacheKey}`, e);
               } finally {
                 // Remove from in-progress set
                 this.excalidrawConversionsInProgress.delete(cacheKey);
               }
             })();
             } else if (isCached) {
             this.logExcalidraw(`SVG already cached for: ${cacheKey}`);
             } else if (isConverting) {
             this.logExcalidraw(`Conversion already in progress for: ${cacheKey}`);
             }

             // Return placeholder URL
             return `excalidraw://${cacheKey}`;
        } else {
          // For non-Excalidraw files
          const adapter = this.app.vault.adapter;
          if (adapter instanceof FileSystemAdapter) {
            const basePath = adapter.getBasePath();
            const fullPath = `${basePath}/${linkedFile.path}`;
            // Return as file:// URL with proper encoding
            return `file://${encodeURI(fullPath).replace(/#/g, '%23')}`;
          }
        }
      }
    } catch (e) {
      console.warn('[Perspecta] Failed to resolve image path for presentation:', path, e);
    }

    // Fallback - return original path
    return path;
  };

  /**
   * Create a context-aware image path resolver for presentations
   * Uses the provided source file path for resolving wiki-links to images
   */
  private createPresentationImageResolver(sourcePath: string): ImagePathResolver {
    return (path: string, isWikiLink: boolean): string => {
      // Handle URLs - pass through as-is
      if (path.startsWith('http://') || path.startsWith('https://')) {
        return path;
      }

      // Handle absolute paths - pass through as-is
      if (path.startsWith('file://') || path.startsWith('/')) {
        return path;
      }

      // For wiki-links and plain filenames, resolve to file:// URL using the source file context
      try {
        // Extract Excalidraw reference if present (group=, area=, frame=, clippedframe=)
        const { filePath: pathWithoutRef, refType, refId } = this.extractExcalidrawReference(path);
        
        // Strip other block references from path (e.g., "path#^blockid" -> "path")
        const pathWithoutBlock = pathWithoutRef.split('#')[0];
        
        // Decode any URL-encoded characters in the path (e.g., %20 for space)
        const decodedPath = decodeURIComponent(pathWithoutBlock);

        // Resolve the link to a file using the SOURCE FILE as context, not the active file
        // This is the key fix: use sourcePath instead of activeFile.path
        let linkedFile = this.app.metadataCache.getFirstLinkpathDest(decodedPath, sourcePath);
        if (!linkedFile) {
          linkedFile = this.app.metadataCache.getFirstLinkpathDest(pathWithoutBlock, sourcePath);
        }

        if (linkedFile) {
          // Check if this is an Excalidraw file (either .excalidraw or .md in Excalidraw folder)
          const isExcalidrawFile = 
            linkedFile.extension === 'excalidraw' || 
            (linkedFile.extension === 'md' && 
              (linkedFile.path.includes('Excalidraw/') || linkedFile.name.includes('.excalidraw')));

          if (isExcalidrawFile) {
            // Build cache key including reference type and ID if present
            const cacheKey = refType && refId 
              ? `${linkedFile.path}#^${refType}=${refId}` 
              : linkedFile.path;

            // For any reference type, skip PNG/SVG export lookup and use native rendering
            if (refType && refId) {
              this.logExcalidraw(`${refType} reference detected, using native rendering: ${cacheKey}`);
              
              // Check if SVG is already cached or conversion is in progress
              const fileMtime = linkedFile.stat.mtime;
              const isCached = this.excalidrawRenderer?.hasCachedSvg(cacheKey, fileMtime);
              const isConverting = this.excalidrawConversionsInProgress.has(cacheKey);

              if (!isCached && !isConverting && this.excalidrawRenderer) {
                this.logExcalidraw(`Starting async conversion for: ${cacheKey}`);
                this.excalidrawConversionsInProgress.add(cacheKey);

                // Start async conversion immediately (non-blocking)
                void (async () => {
                  try {
                    await this.excalidrawRenderer!.toSvgDataUrl(
                      linkedFile, 
                      refType ?? undefined, 
                      refId ?? undefined
                    );
                    this.logExcalidraw(`✅ Converted to SVG: ${cacheKey}`);
                    // Trigger re-render to display the now-cached SVG
                    void this.rerenderPresentationWindow();
                  } catch (e) {
                    this.errorExcalidraw(`Failed to convert Excalidraw to SVG: ${cacheKey}`, e);
                  } finally {
                    // Remove from in-progress set
                    this.excalidrawConversionsInProgress.delete(cacheKey);
                  }
                })();
              } else if (isCached) {
                this.logExcalidraw(`SVG already cached for: ${cacheKey}`);
              } else if (isConverting) {
                this.logExcalidraw(`Conversion already in progress for: ${cacheKey}`);
              }

              // Return placeholder URL
              return `excalidraw://${cacheKey}`;
            } else {
              // No reference - check for PNG/SVG export
              let exportFile: TFile | null = null;
              const basePath = linkedFile.path.replace(/\.excalidraw$/, '');
              
              // Try .png
              let pngPath = basePath + '.png';
              let file = this.app.vault.getAbstractFileByPath(pngPath);
              if (file instanceof TFile) {
                exportFile = file;
              }

              // Try .svg
              if (!exportFile) {
                const svgPath = basePath + '.svg';
                file = this.app.vault.getAbstractFileByPath(svgPath);
                if (file instanceof TFile) {
                  exportFile = file;
                }
              }

              // For .excalidraw files, also try with suffix
              if (!exportFile && linkedFile.extension === 'excalidraw') {
                pngPath = linkedFile.path + '.png';
                file = this.app.vault.getAbstractFileByPath(pngPath);
                if (file instanceof TFile) {
                  exportFile = file;
                }

                if (!exportFile) {
                  const svgPath = linkedFile.path + '.svg';
                  file = this.app.vault.getAbstractFileByPath(svgPath);
                  if (file instanceof TFile) {
                    exportFile = file;
                  }
                }
              }

              // If export found, use it
              if (exportFile) {
                const adapter = this.app.vault.adapter;
                if (adapter instanceof FileSystemAdapter) {
                  const basePath = adapter.getBasePath();
                  const fullPath = `${basePath}/${exportFile.path}`;
                  return `file://${encodeURI(fullPath).replace(/#/g, '%23')}`;
                }
              }

              // No export found - use native Excalidraw rendering via async conversion
              this.logExcalidraw(
                `ℹ️ No Excalidraw export found for: ${linkedFile.path}\n` +
                `Returning placeholder for async conversion.`
              );

              // Check if SVG is already cached or conversion is in progress
              const fileMtime = linkedFile.stat.mtime;
              const isCached = this.excalidrawRenderer?.hasCachedSvg(cacheKey, fileMtime);
              const isConverting = this.excalidrawConversionsInProgress.has(cacheKey);

              if (!isCached && !isConverting && this.excalidrawRenderer) {
                this.logExcalidraw(`Starting async conversion for: ${cacheKey}`);
                this.excalidrawConversionsInProgress.add(cacheKey);

                // Start async conversion immediately (non-blocking)
                void (async () => {
                  try {
                    await this.excalidrawRenderer!.toSvgDataUrl(
                      linkedFile, 
                      refType ?? undefined, 
                      refId ?? undefined
                    );
                    this.logExcalidraw(`✅ Converted to SVG: ${cacheKey}`);
                    // Trigger re-render to display the now-cached SVG
                    void this.rerenderPresentationWindow();
                  } catch (e) {
                    this.errorExcalidraw(`Failed to convert Excalidraw to SVG: ${cacheKey}`, e);
                  } finally {
                    // Remove from in-progress set
                    this.excalidrawConversionsInProgress.delete(cacheKey);
                  }
                })();
              } else if (isCached) {
                this.logExcalidraw(`SVG already cached for: ${cacheKey}`);
              } else if (isConverting) {
                this.logExcalidraw(`Conversion already in progress for: ${cacheKey}`);
              }

              // Return placeholder URL
              return `excalidraw://${cacheKey}`;
            }
          } else {
            // For non-Excalidraw files
            const adapter = this.app.vault.adapter;
            if (adapter instanceof FileSystemAdapter) {
              const basePath = adapter.getBasePath();
              const fullPath = `${basePath}/${linkedFile.path}`;
              // Return as file:// URL with proper encoding
              return `file://${encodeURI(fullPath).replace(/#/g, '%23')}`;
            }
          }
        }
      } catch (e) {
        console.warn('[Perspecta] Failed to resolve image path for presentation:', path, e);
      }

      // Fallback - return original path
      return path;
    };
  };

  async onload() {
    await this.loadSettings();

    // Initialize debug service with settings
    this.debugService.setTopicConfig(this.settings.debugTopics || {});
    setDebugService(this.debugService);

    // Initialize font manager
    this.fontManager = new FontManager(
      this.app,
      this.settings.fontCache ? { fonts: this.settings.fontCache.fonts } : null,
      async (cache: FontCache) => {
        this.settings.fontCache = { fonts: cache.fonts };
        await this.saveSettings();
      },
      this.settings.fontCacheFolder
    );
    // Font handling uses the new consolidated debug topic instead of a separate setting
    // this.fontManager.setDebugMode(this.settings.debugFontHandling);

    // Initialize Excalidraw renderer for native SVG conversion
    this.excalidrawRenderer = new ExcalidrawRenderer(this.app.vault);

    // Initialize export service with Excalidraw support
    this.exportService = new ExportService(
      this.app,
      this.fontManager,
      this.presentationImagePathResolver
    );
    this.exportService.setExcalidrawRenderer(this.excalidrawRenderer);

    // Initialize theme loader with built-in themes first
    this.themeLoader = new ThemeLoader(this.app, this.settings.customThemesFolder);
    await this.themeLoader.loadThemes();

    // Reload custom themes when layout is ready (vault file index is complete)
    this.app.workspace.onLayoutReady(async () => {
      if (this.themeLoader) {
        await this.themeLoader.loadThemes();
      }

      // Initialize restored views with theme data
      // Fixes: When Obsidian restores workspace with visible views (navigator, presenter, inspector),
      // they may not have theme data yet because no file was actively focused.
      const activeFile = this.app.workspace.getActiveFile();
      if (activeFile && activeFile.extension === 'md') {
        // There's an active file - initialize with its content
        await this.updateSidebarsWithContext(activeFile, true);
      } else {
        // Check if any views are already open (restored from session)
        const hasRestoredViews =
          this.app.workspace.getLeavesOfType(THUMBNAIL_VIEW_TYPE).length > 0 ||
          this.app.workspace.getLeavesOfType(INSPECTOR_VIEW_TYPE).length > 0 ||
          this.app.workspace.getLeavesOfType(PRESENTATION_VIEW_TYPE).length > 0;

        if (hasRestoredViews) {
          // Find any visible markdown file to initialize with
          const visibleFile = this.findVisibleMarkdownFile();
          if (visibleFile) {
            await this.updateSidebarsWithContext(visibleFile, true);
          }
        }
      }
    });

    // Try to access ipcMain from Electron for IPC handling
    try {
      const electron = require('electron');
      const { ipcMain } = electron;

      if (ipcMain) {
        // Listen for slide changes from the presenter window
        ipcMain.on('presenter:slide-changed', (event: any, slideIndex: number) => {
          // Call the callback if presenter window is open
          if (this.presenterWindow?.isOpen()) {
            if (this.presenterWindow['onSlideChanged']) {
              this.presenterWindow['onSlideChanged'](slideIndex);
            }
          }
        });

        // Listen for request to open presentation window
        ipcMain.on('presenter:open-presentation', (event: any) => {
          if (this.presenterWindow?.isOpen()) {
            if (this.presenterWindow['onOpenPresentationWindow']) {
              this.presenterWindow['onOpenPresentationWindow']();
            }
          }
        });
      }
    } catch (e) {
      // IPC setup failed silently
    }

    // Listen for system color scheme changes and refresh all views
    if (typeof window !== 'undefined' && window.matchMedia) {
      const colorSchemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleColorSchemeChange = () => {
        // Refresh the active presentation if there is one
        const activeFile = this.app.workspace.getActiveFile();
        if (activeFile && activeFile.extension === 'md') {
          void this.updateSidebars(activeFile);
        }
        // Also update the presentation window if it's open
        if (this.presentationWindow?.isOpen() && this.currentPresentationFile) {
          void this.refreshPresentationWindow();
        }
      };
      colorSchemeQuery.addEventListener('change', handleColorSchemeChange);
      this.register(() => colorSchemeQuery.removeEventListener('change', handleColorSchemeChange));
    }

    addIcon('presentation', SLIDES_ICON);

    this.registerView(THUMBNAIL_VIEW_TYPE, (leaf) => new ThumbnailNavigatorView(leaf));

    this.registerView(INSPECTOR_VIEW_TYPE, (leaf) => new InspectorPanelView(leaf));

    this.registerView(PRESENTATION_VIEW_TYPE, (leaf) => new PresentationView(leaf));

    this.addCommand({
      id: 'open-presentation-view',
      name: 'Open presentation view',
      checkCallback: (checking: boolean) => {
        const file = this.app.workspace.getActiveFile();
        if (file && file.extension === 'md') {
          if (!checking) {
            void this.openPresentationView(file);
          }
          return true;
        }
        return false;
      },
    });

    this.addCommand({
      id: 'toggle-thumbnail-navigator',
      name: 'Toggle slide navigator',
      callback: () => {
        void this.toggleThumbnailNavigator();
      },
    });

    this.addCommand({
      id: 'toggle-inspector',
      name: 'Toggle slide inspector',
      callback: () => {
        void this.toggleInspector();
      },
    });

    this.addCommand({
      id: 'start-presentation',
      name: 'Start presentation',
      checkCallback: (checking: boolean) => {
        const file = this.app.workspace.getActiveFile();
        if (file && file.extension === 'md') {
          if (!checking) {
            void this.startPresentation(file);
          }
          return true;
        }
        return false;
      },
    });

    this.addCommand({
      id: 'convert-to-presentation',
      name: 'Convert to presentation',
      checkCallback: (checking: boolean) => {
        const file = this.app.workspace.getActiveFile();
        if (file && file.extension === 'md') {
          if (!checking) {
            void this.convertToPresentation(file);
          }
          return true;
        }
        return false;
      },
    });

    this.addCommand({
      id: 'insert-slide-separator',
      name: 'Insert slide separator',
      editorCallback: (editor) => {
        const cursor = editor.getCursor();
        editor.replaceRange('\n---\n\n', cursor);
        editor.setCursor({ line: cursor.line + 3, ch: 0 });
      },
    });

    this.addCommand({
      id: 'save-as-custom-theme',
      name: 'Save as custom theme',
      checkCallback: (checking: boolean) => {
        const file = this.app.workspace.getActiveFile();
        if (file && file.extension === 'md') {
          if (!checking) {
            void this.saveAsCustomTheme(file);
          }
          return true;
        }
        return false;
      },
    });

    this.addCommand({
      id: 'open-presenter-view',
      name: 'Open presenter view',
      checkCallback: (checking: boolean) => {
        const file = this.app.workspace.getActiveFile();
        if (file && file.extension === 'md') {
          if (!checking) {
            void this.openPresenterView(file);
          }
          return true;
        }
        return false;
      },
    });

    this.addCommand({
      id: 'open-presenter-presentation-fullscreen',
      name: 'Open presentation fullscreen on secondary display',
      checkCallback: (checking: boolean) => {
        const file = this.app.workspace.getActiveFile();
        if (file && file.extension === 'md') {
          if (!checking) {
            void this.openPresenterViewWithPresentation(file, true);
          }
          return true;
        }
        return false;
      },
    });

    this.addCommand({
      id: 'export-presentation',
      name: 'Export presentation to HTML',
      checkCallback: (checking: boolean) => {
        const file = this.app.workspace.getActiveFile();
        if (file && file.extension === 'md') {
          if (!checking) {
            void this.exportPresentation(file);
          }
          return true;
        }
        return false;
      },
    });

    this.addRibbonIcon('presentation', 'Open presentation view', () => {
      console.log('[Presentation Button] Clicked');
      const file = this.app.workspace.getActiveFile();
      if (file && file.extension === 'md') {
        void this.openPresentationView(file);
      } else {
        new Notice('Please open a markdown file first');
      }
    });

    this.addRibbonIcon('presentation', 'Open presenter view (speaker notes)', () => {
      const file = this.app.workspace.getActiveFile();
      if (file && file.extension === 'md') {
        new Notice('Opening presenter view...');
        void this.openPresenterView(file);
      } else {
        new Notice('Please open a markdown file first');
      }
    });

    this.settingsTab = new PerspectaSlidesSettingTab(this.app, this);
    this.addSettingTab(this.settingsTab);
    this.settingsTab.setOnCreateDemo(async (modalOnOk, modalOnGoToDemo) => {
      await this.createDemoPresentation(modalOnOk, modalOnGoToDemo);
    });

    this.registerEvent(
      this.app.workspace.on('file-open', (file) => {
        if (file && file.extension === 'md') {
          void this.updateSidebars(file);
        }
      })
    );

    this.registerEvent(
      this.app.workspace.on('editor-change', (editor) => {
        const file = this.app.workspace.getActiveFile();
        if (file) {
          // Get content directly from editor (not saved file)
          const content = editor.getValue();
          this.debounceUpdateSidebarsWithContent(file, content);
          this.debounceUpdatePresentationWindowWithContent(file, content);
        }
      })
    );

    // Track cursor position to update slide selection
    this.registerEvent(
      this.app.workspace.on('active-leaf-change', () => {
        const activeFile = this.app.workspace.getActiveFile();
        if (activeFile && activeFile.extension === 'md') {
          this.lastUsedSlideDocument = activeFile;
        }
        this.setupCursorTracking();
        this.updateInspectorFocus();
      })
    );

    // Handle format insertion from inspector
    (this.app.workspace as any).on('perspecta:insert-format', (format: string) => {
      const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (activeView) {
        const editor = activeView.editor;
        const cursor = editor.getCursor();

        if (format.includes('text')) {
          // Placeholder replacement like **text**
          editor.replaceSelection(format);
          // Move cursor to middle if it's a wrapper
          if (format.startsWith('**') && format.endsWith('**')) {
            const pos = editor.getCursor();
            editor.setCursor({ line: pos.line, ch: pos.ch - 2 });
          } else if (format.startsWith('*') && format.endsWith('*')) {
            const pos = editor.getCursor();
            editor.setCursor({ line: pos.line, ch: pos.ch - 1 });
          } else if (format.startsWith('==') && format.endsWith('==')) {
            const pos = editor.getCursor();
            editor.setCursor({ line: pos.line, ch: pos.ch - 2 });
          }
        } else if (format.startsWith('\n\n---\n\n')) {
          // Slide separator
          editor.replaceRange(format, cursor);
          editor.setCursor({ line: cursor.line + 3, ch: 0 });
        } else {
          // Simple prefix like "# " or "	- "
          const lineContent = editor.getLine(cursor.line);
          editor.replaceRange(format, { line: cursor.line, ch: 0 }, { line: cursor.line, ch: 0 });
          editor.setCursor({ line: cursor.line, ch: lineContent.length + format.length });
        }
        editor.focus();
      }
    });

    // Initial setup
    this.setupCursorTracking();
  }

  private cursorTrackingCleanup: (() => void) | null = null;
  private lastTrackedLine: number = -1;
  private lastTrackedFile: string = '';

  private setupCursorTracking() {
    // Clean up previous listener
    if (this.cursorTrackingCleanup) {
      this.cursorTrackingCleanup();
      this.cursorTrackingCleanup = null;
    }

    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!activeView) {
      return;
    }

    const editor = activeView.editor;
    const file = activeView.file;
    if (!file || file.extension !== 'md') {
      return;
    }

    // Use interval-based polling for cursor position (works with CM6)
    const pollInterval = setInterval(() => {
      const currentView = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (!currentView || currentView.file?.path !== file.path) {
        return;
      }

      const cursor = currentView.editor.getCursor();
      const currentLine = cursor.line;

      // Only trigger if line changed
      if (currentLine !== this.lastTrackedLine || file.path !== this.lastTrackedFile) {
        this.lastTrackedLine = currentLine;
        this.lastTrackedFile = file.path;
        void this.handleCursorPositionChange(file, currentLine);
      }
    }, 150);

    this.cursorTrackingCleanup = () => {
      clearInterval(pollInterval);
    };

    // Update inspector focus immediately
    this.updateInspectorFocus();

    // Also try CodeMirror 5 approach as fallback
    const cm = (editor as any).cm;
    if (cm?.on) {
      const handleCursorChange = () => {
        const cursor = editor.getCursor();
        if (cursor.line !== this.lastTrackedLine || file.path !== this.lastTrackedFile) {
          this.lastTrackedLine = cursor.line;
          this.lastTrackedFile = file.path;
          void this.handleCursorPositionChange(file, cursor.line);
        }
      };
      cm.on('cursorActivity', handleCursorChange);
      const originalCleanup = this.cursorTrackingCleanup;
      this.cursorTrackingCleanup = () => {
        originalCleanup?.();
        cm.off('cursorActivity', handleCursorChange);
      };
    }
  }

  onunload() {
    if (this.presentationWindow) {
      this.presentationWindow.close();
    }
    if (this.presenterWindow) {
      this.presenterWindow.close();
    }

    this.app.workspace.detachLeavesOfType(THUMBNAIL_VIEW_TYPE);
    this.app.workspace.detachLeavesOfType(INSPECTOR_VIEW_TYPE);
    this.app.workspace.detachLeavesOfType(PRESENTATION_VIEW_TYPE);
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    // Apply content mode to parser
    this.parser.setDefaultContentMode(this.settings.defaultContentMode);
    // Apply debug mode to parser
    this.parser.setDebugMode(this.settings.debugSlideRendering);
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  private async openPresentationView(file: TFile) {
    const existing = this.app.workspace.getLeavesOfType(PRESENTATION_VIEW_TYPE);

    let leaf: WorkspaceLeaf;
    if (existing.length > 0) {
      leaf = existing[0];
    } else {
      const activeLeaf = this.app.workspace.getLeaf(false);
      leaf = this.app.workspace.getLeaf('split', 'vertical');
    }

    await leaf.setViewState({
      type: PRESENTATION_VIEW_TYPE,
      active: true,
    });

    const view = leaf.view;
    if (!(view instanceof PresentationView)) {
      return;
    }

    // Ensure parser uses the correct content mode from settings
    view.setDefaultContentMode(this.settings.defaultContentMode);

    await view.loadFile(file);

    // Track this as the last used slide document for initialization context
    this.lastUsedSlideDocument = file;

    await this.app.workspace.revealLeaf(leaf);

    if (this.settings.showThumbnailNavigator) {
      await this.ensureThumbnailNavigator();
    }
    if (this.settings.showInspector) {
      await this.ensureInspector();
    }

    // Use first slide as context for initialization (not cursor-dependent)
    await this.updateSidebarsWithContext(file, true);
  }

  async openPresenterView(file: TFile, fullscreenOnSecondary: boolean = false) {
    try {
      const content = await this.app.vault.read(file);
      const presentation = this.parser.parse(content);
      const themeName = presentation.frontmatter.theme || this.settings.defaultTheme;
      const theme = this.getThemeByName(themeName);

      // Close any existing presenter window
      if (this.presenterWindow?.isOpen()) {
        this.presenterWindow.close();
      }

      this.presenterWindow = new PresenterWindow();
      // Create a context-aware resolver that uses the source file path
      const contextAwareResolverForPresenter = this.createPresentationImageResolver(file.path);
      this.presenterWindow.setImagePathResolver(contextAwareResolverForPresenter);

      const customFontCSS = await this.getCustomFontCSS(presentation.frontmatter);
      const fontWeightsCache = this.buildFontWeightsCache();

      this.presenterWindow.setCustomFontCSS(customFontCSS);
      this.presenterWindow.setFontWeightsCache(fontWeightsCache);

      // Restore window bounds if available
      if (this.settings.presenterWindowBounds) {
        this.presenterWindow.setWindowBounds(this.settings.presenterWindowBounds);
      }

      // Set up callback to sync slide changes with presentation window
      this.presenterWindow.setOnSlideChanged((slideIndex: number) => {
        // Update presentation window to the same slide
        if (this.presentationWindow?.isOpen()) {
          this.presentationWindow.goToSlide(slideIndex);
        }
      });

      // Set up callback to save window bounds
      this.presenterWindow.setOnWindowBoundsChanged((bounds: any) => {
        this.settings.presenterWindowBounds = bounds;
        void this.saveSettings();
      });

      // Set up callback to open presentation window when timer is started
      this.presenterWindow.setOnOpenPresentationWindow(() => {
        void this.startPresentation(file);
      });

      await this.presenterWindow.open(presentation, theme || null, file, 0, fullscreenOnSecondary);

      // Track as last used document
      this.lastUsedSlideDocument = file;
    } catch (error) {
      console.error('[PresenterWindow] Failed to open:', error);
      new Notice(
        `Failed to open presenter view: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private async openPresenterViewWithPresentation(file: TFile, fullscreen: boolean = false) {
    // Open presenter window first
    await this.openPresenterView(file, fullscreen);

    // Then open presentation window on secondary display if applicable
    if (fullscreen && this.presenterWindow?.isOpen()) {
      const content = await this.app.vault.read(file);
      const presentation = this.parser.parse(content);
      const themeName = presentation.frontmatter.theme || this.settings.defaultTheme;
      const theme = this.getThemeByName(themeName);

      if (this.presentationWindow?.isOpen()) {
        this.presentationWindow.close();
      }

      this.presentationWindow = new PresentationWindow();
      // Create a context-aware resolver that uses the source file path
      const contextAwareResolver = this.createPresentationImageResolver(file.path);
      this.presentationWindow.setImagePathResolver(contextAwareResolver);

      const customFontCSS = await this.getCustomFontCSS(presentation.frontmatter);
      const fontWeightsCache = this.buildFontWeightsCache();

      this.presentationWindow.setCustomFontCSS(customFontCSS);
      this.presentationWindow.setFontWeightsCache(fontWeightsCache);
      
      // Pass Excalidraw SVG cache and failed decompression files to presentation window
      if (this.excalidrawRenderer) {
        this.presentationWindow.setExcalidrawSvgCache(this.excalidrawRenderer.getSvgCache());
        this.presentationWindow.setFailedDecompressionFiles(this.excalidrawRenderer.getFailedDecompressionFiles());
      }

      // Sync presentation window slide changes back to presenter window
      this.presentationWindow.setOnSlideChanged((slideIndex: number) => {
        if (this.presenterWindow?.isOpen()) {
          this.presenterWindow.notifySlideChange(slideIndex);
        }
      });

      await this.presentationWindow.open(presentation, theme || null, file, 0);
    }
  }

  private async exportPresentation(file: TFile) {
    try {
      const content = await this.app.vault.read(file);
      const presentation = this.parser.parse(content);
      const themeName = presentation.frontmatter.theme || this.settings.defaultTheme;
      const theme = this.getThemeByName(themeName);
      const customFontCSS = await this.getCustomFontCSS(presentation.frontmatter);

      if (!this.exportService) {
        new Notice('Export service not initialized');
        return;
      }

      await this.exportService.export(presentation, theme || null, file, customFontCSS);
    } catch (error) {
      console.error('Export failed:', error);
      new Notice(
        `Failed to export presentation: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private async convertToPresentation(file: TFile) {
    try {
      const content = await this.app.vault.read(file);
      let newContent = content;
      let hadFrontmatter = false;
      let hadSlides = false;

      // Check if file already has frontmatter
      if (content.startsWith('---')) {
        hadFrontmatter = true;
        // Check if there are slide separators
        const slideSeparators = content.match(/\n---\n/g);
        hadSlides = slideSeparators !== null && slideSeparators.length > 0;
      }

      // If no frontmatter, add minimal frontmatter
      if (!hadFrontmatter) {
        newContent = '---\ntheme: default\n---\n\n' + content;
      }

      // If no slides found, add at least one slide separator and a blank slide
      if (!hadSlides) {
        // Ensure content ends with newlines, add slide separator
        if (!newContent.endsWith('\n\n')) {
          newContent = newContent.trimEnd() + '\n\n';
        }
        newContent += '---\n\n# Slide 1\n\nAdd your content here...';
      }

      // Write the modified content
      if (newContent !== content) {
        await this.app.vault.modify(file, newContent);
        new Notice(
          hadFrontmatter && hadSlides
            ? 'File is ready for presentation'
            : hadFrontmatter
              ? 'Added slide structure'
              : 'Added frontmatter and slide structure'
        );
      } else {
        new Notice('File is ready for presentation');
      }

      // Open presentation view
      await this.openPresentationView(file);

      // Open navigator if setting allows
      if (this.settings.showThumbnailNavigator) {
        await this.ensureThumbnailNavigator();
      }

      // Open inspector if setting allows
      if (this.settings.showInspector) {
        await this.ensureInspector();
      }

      // Start presentation window
      await this.startPresentation(file);
    } catch (error) {
      console.error('Convert to presentation failed:', error);
      new Notice(
        `Failed to convert to presentation: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private async toggleThumbnailNavigator() {
    const existing = this.app.workspace.getLeavesOfType(THUMBNAIL_VIEW_TYPE);

    if (existing.length > 0) {
      existing[0].detach();
    } else {
      await this.ensureThumbnailNavigator();
      // Wait for the view to be fully initialized before updating
      await this.waitForView(THUMBNAIL_VIEW_TYPE);

      // Use active file, or fall back to visible markdown file, or previously used file
      let file = this.app.workspace.getActiveFile();

      // If no active file, try to find a visible markdown file
      if (!file || file.extension !== 'md') {
        file = this.findVisibleMarkdownFile();
      }

      // If no visible file, use the last file that was actually used
      if (!file && this.lastUsedSlideDocument) {
        file = this.lastUsedSlideDocument;
      }

      if (file && file.extension === 'md') {
        // Force first slide context when opening navigator without active cursor
        await this.updateSidebarsWithContext(file, true);
      }
    }
  }

  private async toggleInspector() {
    const existing = this.app.workspace.getLeavesOfType(INSPECTOR_VIEW_TYPE);

    if (existing.length > 0) {
      existing[0].detach();
    } else {
      await this.ensureInspector();
      // Wait for the view to be fully initialized before updating
      await this.waitForView(INSPECTOR_VIEW_TYPE);

      // Use active file, or fall back to visible markdown file, or previously used file
      let file = this.app.workspace.getActiveFile();

      // If no active file, try to find a visible markdown file
      if (!file || file.extension !== 'md') {
        file = this.findVisibleMarkdownFile();
      }

      // If no visible file, use the last file that was actually used
      if (!file && this.lastUsedSlideDocument) {
        file = this.lastUsedSlideDocument;
      }

      if (file && file.extension === 'md') {
        // Force first slide context when opening inspector without active cursor
        await this.updateSidebarsWithContext(file, true);
      }
    }
  }

  /**
   * Wait for a view type to be available and ready
   */
  private async waitForView(viewType: string, maxAttempts: number = 10): Promise<boolean> {
    for (let i = 0; i < maxAttempts; i++) {
      const leaves = this.app.workspace.getLeavesOfType(viewType);
      if (leaves.length > 0 && leaves[0].view) {
        return true;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return false;
  }

  private async ensureThumbnailNavigator() {
    const existing = this.app.workspace.getLeavesOfType(THUMBNAIL_VIEW_TYPE);
    if (existing.length > 0) {
      return;
    }

    const leaf = this.app.workspace.getLeftLeaf(false);
    if (leaf) {
      await leaf.setViewState({
        type: THUMBNAIL_VIEW_TYPE,
        active: true,
      });
    }
  }

  private async ensureInspector() {
    const existing = this.app.workspace.getLeavesOfType(INSPECTOR_VIEW_TYPE);
    if (existing.length > 0) {
      return;
    }

    const leaf = this.app.workspace.getRightLeaf(false);
    if (leaf) {
      await leaf.setViewState({
        type: INSPECTOR_VIEW_TYPE,
        active: true,
      });
    }
  }

  /**
   * Find a visible markdown file in the workspace.
   * Searches all workspace leaves to find a TFile with markdown extension.
   */
  private findVisibleMarkdownFile(): TFile | null {
    const allLeaves = this.app.workspace.getLeavesOfType('markdown');

    // Return the first visible markdown file found
    for (const leaf of allLeaves) {
      if (leaf.view instanceof MarkdownView) {
        const file = leaf.view.file;
        if (file && file.extension === 'md') {
          return file;
        }
      }
    }

    return null;
  }

  private updateTimeout: ReturnType<typeof setTimeout> | null = null;
  private lastSlideCount: number = 0;

  private debounceUpdateSidebars(file: TFile) {
    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
    }
    this.updateTimeout = setTimeout(async () => {
      const content = await this.app.vault.read(file);
      void this.updateSidebarsIncrementalWithContent(file, content);
    }, 50);
  }

  private pendingContent: string | null = null;

  private debounceUpdateSidebarsWithContent(file: TFile, content: string) {
    this.pendingContent = content;
    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
    }
    // Use very short delay (30ms) for responsive updates from editor
    this.updateTimeout = setTimeout(() => {
      if (this.pendingContent) {
        void this.updateSidebarsIncrementalWithContent(file, this.pendingContent);
        this.pendingContent = null;
      }
    }, 30);
  }

  /**
   * Incrementally update sidebars using content-based diffing.
   * Only re-renders slides that actually changed.
   */
  private async updateSidebarsIncrementalWithContent(file: TFile, content: string) {
    const presentation = this.parser.parse(content);

    // Determine current slide index
    const currentSlideIndex = Math.max(
      0,
      Math.min(
        this.lastCursorSlideIndex >= 0 ? this.lastCursorSlideIndex : 0,
        presentation.slides.length - 1
      )
    );

    // Check if we have a valid cache for this file
    const hasCacheForThisFile = this.presentationCache && this.cachedFilePath === file.path;

    // Compute diff if we have a cache
    let diff: SlideDiff | null = null;
    if (hasCacheForThisFile && this.presentationCache) {
      diff = diffPresentations(this.presentationCache, presentation);

      // If no changes detected, skip all updates
      if (diff.type === 'none') {
        // Still update inspector to reflect cursor position
        const inspectorLeaves = this.app.workspace.getLeavesOfType(INSPECTOR_VIEW_TYPE);
        for (const leaf of inspectorLeaves) {
          const view = leaf.view;
          if (!(view instanceof InspectorPanelView)) {
            continue;
          }
          if (presentation.slides[currentSlideIndex]) {
            view.setCurrentSlide(presentation.slides[currentSlideIndex], currentSlideIndex);
          }
        }
        return;
      }

      // If theme changed or major structural changes, do full re-render
      if (requiresFullRender(diff)) {
        this.presentationCache = buildPresentationCache(presentation);
        this.cachedFilePath = file.path;
        this.lastSlideCount = presentation.slides.length;
        await this.updateSidebars(file);
        return;
      }
    }

    const theme = this.getThemeByName(presentation.frontmatter.theme || this.settings.defaultTheme);

    // Handle based on diff type
    if (diff && diff.type === 'content-only') {
      // Content-only changes: update only modified slides
      const success = await this.applyContentOnlyUpdate(
        diff,
        presentation,
        theme,
        currentSlideIndex
      );
      if (!success) {
        // Fallback to full re-render
        await this.updateSidebarsWithPresentation(file, presentation, theme, currentSlideIndex);
      }
    } else if (diff && diff.type === 'structural') {
      // Structural changes: handle adds/removes
      await this.applyStructuralUpdate(diff, presentation, theme, file, currentSlideIndex);
    } else {
      // No cache or first load: do full render with the parsed presentation
      this.lastSlideCount = presentation.slides.length;
      await this.updateSidebarsWithPresentation(file, presentation, theme, currentSlideIndex);
    }

    // Update cache for next comparison
    this.presentationCache = buildPresentationCache(presentation);
    this.cachedFilePath = file.path;
    this.lastSlideCount = presentation.slides.length;
  }

  /**
   * Apply content-only updates (no structural changes)
   */
  private async applyContentOnlyUpdate(
    diff: SlideDiff,
    presentation: Presentation,
    theme: ReturnType<typeof getTheme>,
    currentSlideIndex: number
  ): Promise<boolean> {
    const modifiedSlides = diff.modifiedIndices.map((i) => presentation.slides[i]);

    // Update thumbnail navigator (only modified slides)
    const thumbnailLeaves = this.app.workspace.getLeavesOfType(THUMBNAIL_VIEW_TYPE);
    for (const leaf of thumbnailLeaves) {
      const view = leaf.view;
      if (!(view instanceof ThumbnailNavigatorView)) {
        continue;
      }
      view.setImagePathResolver(this.imagePathResolver);
      if (theme) {
        view.setTheme(theme);
      }
      // Update only modified slides
      const success = view.updateSlides(diff.modifiedIndices, modifiedSlides);
      if (!success) {
        return false;
      }
    }

    // Update presentation view - always update the presentation object and current slide
    const presentationLeaves = this.app.workspace.getLeavesOfType(PRESENTATION_VIEW_TYPE);
    for (const leaf of presentationLeaves) {
      const view = leaf.view;
      if (!(view instanceof PresentationView)) {
        continue;
      }
      // Set both fallback and factory: factory uses sourceFile context when available, fallback for other cases
      view.setImagePathResolver(this.imagePathResolver);
      view.setResolverFactory((sourcePath) => this.createPresentationImageResolver(sourcePath));
      // Update all modified slides in the view's internal state
      for (let i = 0; i < diff.modifiedIndices.length; i++) {
        const idx = diff.modifiedIndices[i];
        const slide = modifiedSlides[i];
        // Update the slide - this updates internal state and re-renders if current
        view.updateSlide(idx, slide);
      }
    }

    // Update inspector with current slide
    const inspectorLeaves = this.app.workspace.getLeavesOfType(INSPECTOR_VIEW_TYPE);
    for (const leaf of inspectorLeaves) {
      const view = leaf.view;
      if (!(view instanceof InspectorPanelView)) {
        continue;
      }
      if (presentation.slides[currentSlideIndex]) {
        view.setCurrentSlide(presentation.slides[currentSlideIndex], currentSlideIndex);
      }
    }

    return true;
  }

  /**
   * Apply structural updates (slides added or removed)
   */
  private async applyStructuralUpdate(
    diff: SlideDiff,
    presentation: Presentation,
    theme: ReturnType<typeof getTheme>,
    file: TFile,
    currentSlideIndex: number
  ) {
    const thumbnailLeaves = this.app.workspace.getLeavesOfType(THUMBNAIL_VIEW_TYPE);

    // For now, if there are too many changes or complex reordering, do full re-render
    // This is a reasonable tradeoff for simplicity
    if (diff.addedIndices.length > 3 || diff.removedIndices.length > 3) {
      await this.updateSidebars(file);
      return;
    }

    for (const leaf of thumbnailLeaves) {
      const view = leaf.view;
      if (!(view instanceof ThumbnailNavigatorView)) {
        continue;
      }
      view.setImagePathResolver(this.imagePathResolver);

      // Update internal presentation reference WITHOUT triggering a full re-render
      view.updatePresentationRef(presentation, file, theme);

      // For structural changes, we need to be careful about order
      // Simplest approach: remove then add, then renumber

      // Remove slides (process in reverse order to maintain indices)
      const sortedRemoved = [...diff.removedIndices].sort((a, b) => b - a);
      for (const idx of sortedRemoved) {
        view.removeSlideAt(idx);
      }

      // Add slides
      for (const idx of diff.addedIndices) {
        view.insertSlideAt(idx, presentation.slides[idx]);
      }

      // Renumber all slides
      view.renumberSlides();
    }

    // Update presentation view
    const presentationLeaves = this.app.workspace.getLeavesOfType(PRESENTATION_VIEW_TYPE);
    for (const leaf of presentationLeaves) {
      const view = leaf.view;
      if (!(view instanceof PresentationView)) {
        continue;
      }
      view.setImagePathResolver(this.imagePathResolver);
      view.setPresentationImagePathResolver(this.presentationImagePathResolver);
      // Ensure parser uses correct content mode for live updates
      view.setDefaultContentMode(this.settings.defaultContentMode);
      view.setPresentation(presentation, theme);
      view.goToSlide(currentSlideIndex, false);
    }

    // Update inspector
    const inspectorLeaves = this.app.workspace.getLeavesOfType(INSPECTOR_VIEW_TYPE);
    for (const leaf of inspectorLeaves) {
      const view = leaf.view;
      if (!(view instanceof InspectorPanelView)) {
        continue;
      }
      view.setPresentation(presentation, file);
      if (presentation.slides[currentSlideIndex]) {
        view.setCurrentSlide(presentation.slides[currentSlideIndex], currentSlideIndex);
      }
    }
  }

  /**
   * Update sidebars for a document, with intelligent context selection.
   * If forceFirstSlide is true, always start with slide 0.
   * Otherwise, use cursor position or default to slide 0.
   */
  private async updateSidebarsWithContext(file: TFile, forceFirstSlide: boolean = false) {
    const content = await this.app.vault.read(file);
    const presentation = this.parser.parse(content);
    const theme = this.getThemeByName(presentation.frontmatter.theme || this.settings.defaultTheme);

    let currentSlideIndex: number;
    if (forceFirstSlide) {
      // Force first slide for initialization (when document not focused)
      currentSlideIndex = 0;
    } else {
      // Use cursor position or default to first slide
      currentSlideIndex = Math.max(
        0,
        Math.min(
          this.lastCursorSlideIndex >= 0 ? this.lastCursorSlideIndex : 0,
          presentation.slides.length - 1
        )
      );
    }

    await this.updateSidebarsWithPresentation(file, presentation, theme, currentSlideIndex);
  }

  private async updateSidebars(file: TFile) {
    // Track as last used slide document for initialization fallback
    if (file.extension === 'md') {
      this.lastUsedSlideDocument = file;
    }

    await this.updateSidebarsWithContext(file, false);
  }

  private async updateSidebarsWithPresentation(
    file: TFile,
    presentation: Presentation,
    theme: ReturnType<typeof getTheme>,
    currentSlideIndex: number
  ) {
    this.currentTheme = theme || null;
    // Update slide count tracking
    this.lastSlideCount = presentation.slides.length;

    const thumbnailLeaves = this.app.workspace.getLeavesOfType(THUMBNAIL_VIEW_TYPE);
    // Generate custom font CSS for cached fonts
    const customFontCSS = await this.getCustomFontCSS(presentation.frontmatter);
    // Build font weights cache for validation
    const fontWeightsCache = this.buildFontWeightsCache();

    for (const leaf of thumbnailLeaves) {
      const view = leaf.view;
      if (!(view instanceof ThumbnailNavigatorView)) {
        continue;
      }
      view.setImagePathResolver(this.imagePathResolver);
      view.setCustomFontCSS(customFontCSS);
      view.setFontWeightsCache(fontWeightsCache);
      // Pass Excalidraw SVG cache and failed decompression files for native rendering
      if (this.excalidrawRenderer) {
        view.setExcalidrawSvgCache(this.excalidrawRenderer.getSvgCache());
        view.setFailedDecompressionFiles(this.excalidrawRenderer.getFailedDecompressionFiles());
      }
      view.setPresentation(presentation, file, theme);
      view.setOnSlideSelect((index) => {
        void this.navigateToSlide(index, presentation, file);
      });
      view.setOnSlideReorder((fromIndex, toIndex) => {
        void this.reorderSlides(file, fromIndex, toIndex);
      });
      view.setOnStartPresentation((index) => {
        void this.startPresentationAtSlide(file, index);
      });
      view.setOnAddSlide(() => {
        void this.addSlideAtEnd(file);
      });
      view.setOnSlideHiddenChanged((index, hidden) => {
        void this.updateSlideHiddenState(file, index, hidden);
      });
      // Preserve selection
      view.selectSlide(currentSlideIndex);
    }

    const inspectorLeaves = this.app.workspace.getLeavesOfType(INSPECTOR_VIEW_TYPE);
    for (const leaf of inspectorLeaves) {
      const view = leaf.view;
      if (!(view instanceof InspectorPanelView)) {
        continue;
      }

      if (this.fontManager) {
        view.setFontManager(this.fontManager);
      }
      if (this.themeLoader) {
        view.setThemeLoader(this.themeLoader);
      }
      view.setPresentation(presentation, file);
      if (presentation.slides.length > 0 && presentation.slides[currentSlideIndex]) {
        view.setCurrentSlide(presentation.slides[currentSlideIndex], currentSlideIndex);
      }
      view.setOnSlideMetadataChange((slideIndex, metadata) => {
        void this.updateSlideMetadata(file, slideIndex, metadata);
      });
      view.setOnPresentationChange((frontmatter, persistent) => {
        if (persistent) {
          void this.updatePresentationFrontmatter(file, frontmatter);
        } else {
          void this.updatePreviewsLive(file, frontmatter);
        }
      });
    }

    const presentationLeaves = this.app.workspace.getLeavesOfType(PRESENTATION_VIEW_TYPE);
    for (const leaf of presentationLeaves) {
      const view = leaf.view;
      if (!(view instanceof PresentationView)) {
        continue;
      }
      // Set both fallback and factory: factory uses sourceFile context when available, fallback for other cases
      view.setImagePathResolver(this.imagePathResolver);
      view.setResolverFactory((sourcePath) => this.createPresentationImageResolver(sourcePath));
      view.setCustomFontCSS(customFontCSS);
      view.setFontWeightsCache(fontWeightsCache);
      // Pass Excalidraw SVG cache and failed decompression files for native rendering
      if (this.excalidrawRenderer) {
        view.setExcalidrawSvgCache(this.excalidrawRenderer.getSvgCache());
        view.setFailedDecompressionFiles(this.excalidrawRenderer.getFailedDecompressionFiles());
      }
      if (this.themeLoader) {
        view.setThemeLoader(this.themeLoader);
      }
      // Ensure parser uses correct content mode for live updates
      view.setDefaultContentMode(this.settings.defaultContentMode);
      view.setPresentation(presentation, theme, file);
      // Wire up slide change callback for navigation controls (prev/next buttons)
      view.setOnSlideChange((index) => {
        void this.navigateToSlide(index, presentation, file, true);
      });
      // Wire up reload callback for full refresh
      view.setOnReload(() => {
        void this.updateSidebars(file);
      });
      // Wire up font CSS callback for presentation window
      // Accepts frontmatter parameter so it uses fresh data from startPresentation
      view.setOnGetFontCSS(async (frontmatter) => {
        return this.getCustomFontCSS(frontmatter);
      });
      // Wire up start presentation callback to use the same code path as double-click
      view.setOnStartPresentation((f, slideIndex) => {
        void this.startPresentationAtSlide(f, slideIndex);
      });
      // Wire up presenter view callback
      view.setOnStartPresenterView(async (f) => {
        await this.openPresenterView(f);
      });
      // Wire up HTML export callback
      view.setOnExportHTML(async (f) => {
        await this.exportPresentation(f);
      });
      // Preserve current slide position (without triggering callback)
      view.goToSlide(currentSlideIndex, false);
    }
  }

  private async navigateToSlide(
    index: number,
    presentation: Presentation,
    file?: TFile,
    fromPresentationView: boolean = false
  ) {
    // Only update presentation view if not triggered from it (to avoid loop)
    if (!fromPresentationView) {
      const presentationLeaves = this.app.workspace.getLeavesOfType(PRESENTATION_VIEW_TYPE);
      for (const leaf of presentationLeaves) {
        if (leaf.view instanceof PresentationView) {
          leaf.view.goToSlide(index);
        }
      }
    }

    const inspectorLeaves = this.app.workspace.getLeavesOfType(INSPECTOR_VIEW_TYPE);
    for (const leaf of inspectorLeaves) {
      if (leaf.view instanceof InspectorPanelView) {
        if (presentation.slides[index]) {
          leaf.view.setCurrentSlide(presentation.slides[index], index);
        }
      }
    }

    const thumbnailLeaves = this.app.workspace.getLeavesOfType(THUMBNAIL_VIEW_TYPE);
    for (const leaf of thumbnailLeaves) {
      if (leaf.view instanceof ThumbnailNavigatorView) {
        leaf.view.selectSlide(index);
      }
    }

    // Move cursor in the markdown editor to the corresponding slide section
    // Find the markdown view for the specific file, not just the active view
    let markdownLeaf: WorkspaceLeaf | null = null;
    let markdownView: MarkdownView | null = null;

    if (file) {
      // Find the markdown leaf that has this file open
      this.app.workspace.iterateAllLeaves((leaf) => {
        if (leaf.view instanceof MarkdownView && leaf.view.file?.path === file.path) {
          markdownLeaf = leaf;
          markdownView = leaf.view;
        }
      });
    }

    // Fallback to active view if no specific file
    if (!markdownView) {
      markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
    }

    if (markdownView && markdownView.file) {
      const content = await this.app.vault.cachedRead(markdownView.file);
      // Use the slide's original index (accounting for filtered-out empty slides)
      const slideOriginalIndex = presentation.slides[index]?.index ?? index;
      const lineNumber = this.getLineNumberForSlide(content, slideOriginalIndex);
      const editor = markdownView.editor;

      // Update lastCursorSlideIndex to prevent feedback loop
      this.lastCursorSlideIndex = index;

      // Activate the markdown tab so cursor is visible and ready for typing
      if (markdownLeaf) {
        this.app.workspace.setActiveLeaf(markdownLeaf, { focus: true });
      }

      // Determine cursor column - if it's a headline, place cursor before first letter
      const lines = content.split('\n');
      const targetLine = lines[lineNumber] || '';
      let cursorColumn = 0;

      // Check if line is a headline (# , ## , ### , etc.)
      const headingMatch = targetLine.match(/^(#{1,6})\s+/);
      if (headingMatch) {
        // Place cursor right after "# " (before the first letter)
        cursorColumn = headingMatch[0].length;
      }

      // Move cursor to the appropriate position
      editor.setCursor({ line: lineNumber, ch: cursorColumn });

      // Scroll the line into view
      editor.scrollIntoView(
        {
          from: { line: lineNumber, ch: cursorColumn },
          to: { line: lineNumber, ch: cursorColumn },
        },
        true
      );

      // Focus the editor so typing goes directly into it
      editor.focus();
    }
  }

  private lastCursorSlideIndex: number = -1;

  private async handleCursorPositionChange(file: TFile, lineNumber: number) {
    const content = await this.app.vault.cachedRead(file);
    const slideIndex = this.getSlideIndexAtLine(content, lineNumber);

    // Only update if slide changed
    if (slideIndex === this.lastCursorSlideIndex) {
      return;
    }
    this.lastCursorSlideIndex = slideIndex;

    const presentation = this.parser.parse(content);

    if (slideIndex >= 0 && slideIndex < presentation.slides.length) {
      // Update thumbnail navigator selection
      const thumbnailLeaves = this.app.workspace.getLeavesOfType(THUMBNAIL_VIEW_TYPE);
      for (const leaf of thumbnailLeaves) {
        const view = leaf.view;
        if (!(view instanceof ThumbnailNavigatorView)) {
          continue;
        }
        view.selectSlide(slideIndex);
      }

      // Update inspector panel
      const inspectorLeaves = this.app.workspace.getLeavesOfType(INSPECTOR_VIEW_TYPE);
      for (const leaf of inspectorLeaves) {
        const view = leaf.view;
        if (!(view instanceof InspectorPanelView)) {
          continue;
        }
        view.setCurrentSlide(presentation.slides[slideIndex], slideIndex);
      }

      // Update presentation view (without triggering callback to avoid cursor repositioning)
      const presentationLeaves = this.app.workspace.getLeavesOfType(PRESENTATION_VIEW_TYPE);
      for (const leaf of presentationLeaves) {
        const view = leaf.view;
        if (!(view instanceof PresentationView)) {
          continue;
        }
        view.goToSlide(slideIndex, false);
      }
    }
  }

  private isSlideSeparator(line: string): boolean {
    // Must be exactly `---` (3 or more dashes) at the start of the line, with optional trailing whitespace
    return /^---+\s*$/.test(line);
  }

  private findFrontmatterEnd(lines: string[]): number {
    let inFrontmatter = false;
    for (let i = 0; i < lines.length; i++) {
      if (i === 0 && lines[i].trim() === '---') {
        inFrontmatter = true;
        continue;
      }
      if (inFrontmatter && lines[i].trim() === '---') {
        return i + 1;
      }
    }
    return 0;
  }

  private getSlideIndexAtLine(content: string, lineNumber: number): number {
    const lines = content.split('\n');
    const frontmatterEnd = this.findFrontmatterEnd(lines);

    // If cursor is in frontmatter, return slide 0
    if (lineNumber < frontmatterEnd) {
      return 0;
    }

    // Count slide separators before the cursor line, ignoring those inside code blocks
    let slideIndex = 0;
    let inCodeBlock = false;

    for (let i = frontmatterEnd; i <= lineNumber && i < lines.length; i++) {
      const line = lines[i];

      // Track code block state (``` at start of line)
      if (line.startsWith('```')) {
        inCodeBlock = !inCodeBlock;
        continue;
      }

      // Only count separators outside code blocks
      if (!inCodeBlock && this.isSlideSeparator(line)) {
        slideIndex++;
      }
    }

    return slideIndex;
  }

  private isSlideMetadataLine(line: string): boolean {
    const trimmed = line.trim();
    if (trimmed === '') {
      return false;
    }
    // Match patterns like "layout: title", "mode: dark", "background: image.jpg", "opacity: 50%", "class: custom"
    return /^(layout|mode|background|opacity|class):\s*.+$/i.test(trimmed);
  }

  private getLineNumberForSlide(content: string, slideIndex: number): number {
    const lines = content.split('\n');
    const frontmatterEnd = this.findFrontmatterEnd(lines);

    // Helper to skip metadata block and blank lines, return first content line
    const skipToContent = (startLine: number): number => {
      let i = startLine;
      // Skip blank lines first
      while (i < lines.length && lines[i].trim() === '') {
        i++;
      }
      // Skip metadata lines (layout:, mode:, etc.)
      while (i < lines.length && this.isSlideMetadataLine(lines[i])) {
        i++;
      }
      // Skip any blank lines after metadata
      while (i < lines.length && lines[i].trim() === '') {
        i++;
      }
      return i < lines.length ? i : startLine;
    };

    // Slide 0 starts right after frontmatter
    if (slideIndex === 0) {
      return skipToContent(frontmatterEnd);
    }

    // Find the nth slide separator, ignoring those inside code blocks
    let separatorCount = 0;
    let inCodeBlock = false;

    for (let i = frontmatterEnd; i < lines.length; i++) {
      const line = lines[i];

      // Track code block state (``` at start of line)
      if (line.startsWith('```')) {
        inCodeBlock = !inCodeBlock;
        continue;
      }

      // Only count separators outside code blocks
      if (!inCodeBlock && this.isSlideSeparator(line)) {
        separatorCount++;
        if (separatorCount === slideIndex) {
          return skipToContent(i + 1);
        }
      }
    }

    return frontmatterEnd;
  }

  private async startPresentation(file: TFile) {
    await this.startPresentationAtSlide(file, 0);
  }

  private async startPresentationAtSlide(file: TFile, slideIndex: number) {
    try {
      const content = await this.app.vault.read(file);
      const presentation = this.parser.parse(content);
      const theme = this.getThemeByName(
        presentation.frontmatter.theme || this.settings.defaultTheme
      );

      // Close existing presentation window if open
      if (this.presentationWindow && this.presentationWindow.isOpen()) {
        this.presentationWindow.close();
      }

      // Generate custom font CSS for cached fonts
      const customFontCSS = await this.getCustomFontCSS(presentation.frontmatter);

      // Build font weights cache for weight validation/fallback
      const fontWeightsCache = new Map<string, number[]>();
      if (this.fontManager) {
        for (const cachedFont of this.fontManager.getAllCachedFonts()) {
          fontWeightsCache.set(cachedFont.name, cachedFont.weights);
        }
      }

      // Create new presentation window
      // Use presentationImagePathResolver which returns file:// URLs for the external window
      this.presentationWindow = new PresentationWindow();
      this.presentationWindow.setImagePathResolver(this.presentationImagePathResolver);
      this.presentationWindow.setCustomFontCSS(customFontCSS);
      this.presentationWindow.setFontWeightsCache(fontWeightsCache);

      // Pass Excalidraw SVG cache and failed decompression files to presentation window
      if (this.excalidrawRenderer) {
        this.presentationWindow.setExcalidrawSvgCache(this.excalidrawRenderer.getSvgCache());
        this.presentationWindow.setFailedDecompressionFiles(this.excalidrawRenderer.getFailedDecompressionFiles());
      }

      // Sync presentation window slide changes back to presenter window
      this.presentationWindow.setOnSlideChanged((slideIndex: number) => {
        if (this.presenterWindow?.isOpen()) {
          this.presenterWindow.notifySlideChange(slideIndex);
        }
      });

      await this.presentationWindow.open(presentation, theme || null, file, slideIndex);

      this.currentPresentationFile = file;
    } catch (e) {
      console.error('Failed to start presentation:', e);
      new Notice('Could not start presentation: ' + (e as Error).message);
    }
  }

  private presentationUpdateTimeout: ReturnType<typeof setTimeout> | null = null;
  private pendingPresentationContent: string | null = null;

  private debounceUpdatePresentationWindow(file: TFile) {
    if (this.presentationUpdateTimeout) {
      clearTimeout(this.presentationUpdateTimeout);
    }
    this.presentationUpdateTimeout = setTimeout(async () => {
      const content = await this.app.vault.read(file);
      void this.updatePresentationWindowWithContent(file, content);
    }, 250);
  }

  private debounceUpdatePresentationWindowWithContent(file: TFile, content: string) {
    this.pendingPresentationContent = content;
    if (this.presentationUpdateTimeout) {
      clearTimeout(this.presentationUpdateTimeout);
    }
    this.presentationUpdateTimeout = setTimeout(() => {
      if (this.pendingPresentationContent) {
        void this.updatePresentationWindowWithContent(file, this.pendingPresentationContent);
        this.pendingPresentationContent = null;
      }
    }, 250);
  }

  private async updatePresentationWindowWithContent(file: TFile, content: string) {
    // Only update if we have an active presentation window for this file
    if (!this.presentationWindow || !this.presentationWindow.isOpen()) {
      return;
    }

    if (!this.currentPresentationFile || this.currentPresentationFile.path !== file.path) {
      return;
    }

    // Update the presentation window with new content
    const presentation = this.parser.parse(content);
    const theme = this.getThemeByName(presentation.frontmatter.theme || this.settings.defaultTheme);

    // Regenerate custom font CSS in case fonts changed in frontmatter
    const customFontCSS = await this.getCustomFontCSS(presentation.frontmatter);
    this.presentationWindow.setCustomFontCSS(customFontCSS);

    await this.presentationWindow.updateContent(presentation, theme || null);
  }

  /**
   * Refresh the presentation window (e.g., when system color scheme changes)
   */
  private async refreshPresentationWindow() {
    if (!this.presentationWindow || !this.presentationWindow.isOpen()) {
      return;
    }
    if (!this.currentPresentationFile) {
      return;
    }
    const content = await this.app.vault.read(this.currentPresentationFile);
    await this.updatePresentationWindowWithContent(this.currentPresentationFile, content);
  }

  /**
    * Re-render the presentation window and editor view (used when async conversions complete)
    * Re-parses and re-renders current slides with updated cache
    */
  private async rerenderPresentationWindow() {
    this.logExcalidraw(`rerenderPresentationWindow() called`);
    
    // Debounce re-renders to avoid flickering from multiple conversions
    if (this.rerenderDebounceTimer) {
      this.logExcalidraw(`⏱️ Re-render already pending, skipping duplicate`);
      return;
    }
    
    // Determine which file to re-render - prefer currentPresentationFile (fullscreen),
    // then fall back to lastUsedSlideDocument (editor view)
    const targetFile = this.currentPresentationFile || this.lastUsedSlideDocument;
    if (!targetFile) {
      this.logExcalidraw(`❌ No presentation file currently in use`);
      return;
    }

    // Schedule re-render with a small delay to batch multiple conversions
    this.rerenderDebounceTimer = setTimeout(async () => {
      this.rerenderDebounceTimer = null;

      try {
        // Try to re-render fullscreen presentation window if open
        if (this.presentationWindow?.isOpen() && this.currentPresentationFile) {
          this.logExcalidraw(`✅ Triggering fullscreen presentation window re-render`);
          const content = await this.app.vault.read(this.currentPresentationFile);
          await this.updatePresentationWindowWithContent(this.currentPresentationFile, content);
        }

        // Re-render the editor view if open for this file
        const presentationLeaves = this.app.workspace.getLeavesOfType(PRESENTATION_VIEW_TYPE);
        for (const leaf of presentationLeaves) {
          const view = leaf.view;
          if (!(view instanceof PresentationView)) {
            continue;
          }
          // Check if this view is showing the target file (access private file property)
          const viewFile = (view as any).file as TFile | null;
          if (viewFile?.path === targetFile.path) {
            this.logExcalidraw(`✅ Triggering editor view re-render for: ${targetFile.path}`);
            // Force re-render by calling private render() method
            (view as any).render();
          }
        }

        // Re-render thumbnail navigator for this file
        const thumbnailLeaves = this.app.workspace.getLeavesOfType(THUMBNAIL_VIEW_TYPE);
        for (const leaf of thumbnailLeaves) {
          const view = leaf.view;
          if (!(view instanceof ThumbnailNavigatorView)) {
            continue;
          }
          // Check if this view is showing the target file
          const viewPresentation = view.getPresentation();
          // Thumbnail navigator doesn't expose its file directly, so we re-render if its presentation is loaded
          if (viewPresentation) {
            this.logExcalidraw(`✅ Triggering thumbnail navigator re-render for: ${targetFile.path}`);
            // Force re-render by calling private render() method
            (view as any).render();
          }
        }

        this.logExcalidraw(`✅ Re-render complete`);
      } catch (e) {
        this.errorExcalidraw(`Error during re-render:`, e);
      }
    }, 100); // 100ms delay to batch conversions
  }

  async reorderSlides(file: TFile, fromIndex: number, toIndex: number) {
    const content = await this.app.vault.read(file);
    const presentation = this.parser.parse(content);

    if (
      fromIndex < 0 ||
      fromIndex >= presentation.slides.length ||
      toIndex < 0 ||
      toIndex >= presentation.slides.length ||
      fromIndex === toIndex
    ) {
      return;
    }

    // Prevent reordering the auto-generated footnotes slide (has footnotes but no elements)
    const lastSlideIndex = presentation.slides.length - 1;
    const lastSlide = presentation.slides[lastSlideIndex];
    const isAutoGeneratedFootnotesSlide =
      lastSlide.elements.length === 0 && lastSlide.footnotes && lastSlide.footnotes.length > 0;
    if (
      isAutoGeneratedFootnotesSlide &&
      (fromIndex === lastSlideIndex || toIndex === lastSlideIndex)
    ) {
      new Notice('Cannot reorder the auto-generated footnotes slide - it must remain at the end');
      return;
    }

    // Get the raw content of each slide
    const slideContents: string[] = [];
    const lines = content.split('\n');
    const currentSlideStart = 0;
    let inFrontmatter = false;
    let frontmatterEnd = 0;

    // Find where frontmatter ends
    for (let i = 0; i < lines.length; i++) {
      if (i === 0 && lines[i].trim() === '---') {
        inFrontmatter = true;
        continue;
      }
      if (inFrontmatter && lines[i].trim() === '---') {
        frontmatterEnd = i + 1;
        break;
      }
    }

    // Extract frontmatter
    const frontmatter = lines.slice(0, frontmatterEnd).join('\n');
    const bodyContent = lines.slice(frontmatterEnd).join('\n');

    // Split by slide separator, preserving exact content
    const separatorPattern = /(\n---+\s*\n)/;
    const parts = bodyContent.split(separatorPattern);

    // parts is: [slide0, sep0, slide1, sep1, slide2, ...]
    // Extract slide contents (even indices) and separators (odd indices)
    const slideRawContents: string[] = [];
    const separators: string[] = [];
    for (let i = 0; i < parts.length; i++) {
      if (i % 2 === 0) {
        slideRawContents.push(parts[i]);
      } else {
        separators.push(parts[i]);
      }
    }

    // Reorder slides
    const [movedSlide] = slideRawContents.splice(fromIndex, 1);
    slideRawContents.splice(toIndex, 0, movedSlide);

    // Reconstruct the document preserving original separator style
    // Use the first separator as template, or default to '\n---\n'
    const sep = separators[0] || '\n---\n';
    const newBody = slideRawContents.join(sep);
    const newContent = frontmatter + (frontmatter ? '\n' : '') + newBody;

    await this.app.vault.modify(file, newContent);
    new Notice(`Moved slide ${fromIndex + 1} to position ${toIndex + 1}`);

    // Navigate to the moved slide at its new position
    const newPresentation = this.parser.parse(newContent);
    await this.navigateToSlide(toIndex, newPresentation, file);
  }

  async addSlideAtEnd(file: TFile) {
    const content = await this.app.vault.read(file);

    // Find the first footnote definition in the document (if any)
    // Footnote definitions look like: [^id]: content
    const lines = content.split('\n');
    let firstFootnoteLineIndex = -1;

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].match(/^\[\^([^\]]+)\]:\s*(.*)$/)) {
        firstFootnoteLineIndex = i;
        break;
      }
    }

    let newContent: string;
    let newSlideIndex: number;

    if (firstFootnoteLineIndex >= 0) {
      // Found footnote definitions - insert new slide BEFORE them
      // Count empty lines before first footnote
      let emptyLinesBefore = 0;
      for (let i = firstFootnoteLineIndex - 1; i >= 0; i--) {
        if (lines[i].trim() === '') {
          emptyLinesBefore++;
        } else {
          break;
        }
      }

      // Remove existing empty lines and add exactly 5 (or more if there were already more)
      const targetEmptyLines = Math.max(5, emptyLinesBefore);
      const contentEndIndex = firstFootnoteLineIndex - emptyLinesBefore;
      const beforeFootnotes = lines.slice(0, contentEndIndex).join('\n').trimEnd();
      const footnoteDefinitions = lines.slice(firstFootnoteLineIndex).join('\n');

      // Build new content with new slide and proper spacing
      // Must insert --- separator BEFORE footnote definitions so they're not part of the new slide
      // beforeFootnotes already ends with the last slide's --- separator, so just add the new slide content
      const emptyLinesPadding = '\n'.repeat(targetEmptyLines);
      newContent =
        beforeFootnotes +
        '\n\nlayout: default\n\n# New Slide\n\nAdd your content here...' +
        emptyLinesPadding +
        '\n---\n\n' +
        footnoteDefinitions;

      // Parse to get the new slide index
      const tempPresentation = this.parser.parse(newContent);
      newSlideIndex = tempPresentation.slides.length - 1;
    } else {
      // No footnote definitions, append at end as usual
      newContent =
        content.trimEnd() +
        '\n\n---\n\nlayout: default\n\n# New Slide\n\nAdd your content here...\n';

      // Parse to get the new slide index
      const tempPresentation = this.parser.parse(newContent);
      newSlideIndex = tempPresentation.slides.length - 1;
    }

    // Modify the file
    await this.app.vault.modify(file, newContent);

    // Navigate to the new slide (this handles cursor positioning, navigator selection, etc.)
    const tempPresentation = this.parser.parse(newContent);
    await this.navigateToSlide(newSlideIndex, tempPresentation, file);
  }

  async updateSlideMetadata(file: TFile, slideIndex: number, metadata: Record<string, any>) {
    const content = await this.app.vault.read(file);
    const lines = content.split('\n');

    // Find frontmatter end
    let inFrontmatter = false;
    let frontmatterEnd = 0;
    for (let i = 0; i < lines.length; i++) {
      if (i === 0 && lines[i].trim() === '---') {
        inFrontmatter = true;
        continue;
      }
      if (inFrontmatter && lines[i].trim() === '---') {
        frontmatterEnd = i + 1;
        break;
      }
    }

    const frontmatter = lines.slice(0, frontmatterEnd).join('\n');
    const bodyContent = lines.slice(frontmatterEnd).join('\n');

    // Split by slide separator, preserving the separator pattern
    const separatorPattern = /(\n---+\s*\n)/;
    const parts = bodyContent.split(separatorPattern);

    // parts is now: [slide0, sep0, slide1, sep1, slide2, ...]
    // Extract just the slide contents (even indices) and separators (odd indices)
    const slideRawContents: string[] = [];
    const separators: string[] = [];
    for (let i = 0; i < parts.length; i++) {
      if (i % 2 === 0) {
        slideRawContents.push(parts[i]);
      } else {
        separators.push(parts[i]);
      }
    }

    if (slideIndex < 0 || slideIndex >= slideRawContents.length) {
      return;
    }

    // Get the slide content
    const slideContent = slideRawContents[slideIndex];
    const slideLines = slideContent.split('\n');

    // Find or create metadata block at start of slide
    let metadataEndLine = 0;
    const existingMetadata: Record<string, string> = {};

    // Check for existing metadata lines at start
    for (let i = 0; i < slideLines.length; i++) {
      const line = slideLines[i].trim();
      if (line === '') {
        metadataEndLine = i;
        break;
      }
      const match = line.match(/^([\w-]+):\s*(.*)$/i);
      if (match) {
        existingMetadata[match[1].toLowerCase()] = match[2];
        metadataEndLine = i + 1;
      } else if (!line.startsWith('#') && !line.startsWith('!') && !line.startsWith('-')) {
        // Not a metadata line and not content, check if it looks like metadata
        break;
      } else {
        // This is content, no more metadata
        break;
      }
    }

    // Merge new metadata with existing
    const finalMetadata: Record<string, string> = { ...existingMetadata };
    for (const [key, value] of Object.entries(metadata)) {
      // Convert camelCase to kebab-case for markdown
      let writeKey = key;
      if (key === 'hideOverlay') {
        writeKey = 'hide-overlay';
      }
      
      if (value === undefined || value === null || value === '') {
        delete finalMetadata[writeKey];
        delete finalMetadata[key]; // Also remove old key variant if it exists
      } else if (typeof value === 'boolean') {
        finalMetadata[writeKey] = value ? 'true' : 'false';
      } else if (typeof value === 'number') {
        if (key === 'backgroundOpacity') {
          finalMetadata['opacity'] = `${Math.round(value * 100)}%`;
        } else {
          finalMetadata[writeKey] = String(value);
        }
      } else {
        finalMetadata[writeKey] = String(value);
      }
    }

    // Build new metadata lines
    const metadataLines: string[] = [];
    for (const [key, value] of Object.entries(finalMetadata)) {
      if (value) {
        metadataLines.push(`${key}: ${value}`);
      }
    }

    // Get content after metadata
    const contentLines = slideLines.slice(metadataEndLine);

    // Remove leading empty lines from content
    while (contentLines.length > 0 && contentLines[0].trim() === '') {
      contentLines.shift();
    }

    // Reconstruct slide
    let newSlideContent = '';
    if (metadataLines.length > 0) {
      newSlideContent = metadataLines.join('\n') + '\n\n' + contentLines.join('\n');
    } else {
      newSlideContent = contentLines.join('\n');
    }

    slideRawContents[slideIndex] = newSlideContent;

    // Reconstruct the document using original separators
    let newBody = slideRawContents[0];
    for (let i = 1; i < slideRawContents.length; i++) {
      // Use original separator if available, otherwise default
      const separator = separators[i - 1] || '\n---\n';
      newBody += separator + slideRawContents[i];
    }
    const newContent = frontmatter + (frontmatter ? '\n' : '') + newBody;

    await this.app.vault.modify(file, newContent);

    // Immediately refresh views for responsive updates
    this.updateSidebarsIncrementalWithContent(file, newContent);
  }

  async updateSlideHiddenState(file: TFile, slideIndex: number, hidden: boolean) {
    const content = await this.app.vault.read(file);
    const lines = content.split('\n');

    // Find frontmatter end
    let inFrontmatter = false;
    let frontmatterEnd = 0;
    for (let i = 0; i < lines.length; i++) {
      if (i === 0 && lines[i].trim() === '---') {
        inFrontmatter = true;
        continue;
      }
      if (inFrontmatter && lines[i].trim() === '---') {
        frontmatterEnd = i + 1;
        break;
      }
    }

    const frontmatter = lines.slice(0, frontmatterEnd).join('\n');
    const bodyContent = lines.slice(frontmatterEnd).join('\n');

    // Split by slide separator
    const separatorPattern = /(\n---+\s*\n)/;
    const parts = bodyContent.split(separatorPattern);

    const slideRawContents: string[] = [];
    const separators: string[] = [];
    for (let i = 0; i < parts.length; i++) {
      if (i % 2 === 0) {
        slideRawContents.push(parts[i]);
      } else {
        separators.push(parts[i]);
      }
    }

    if (slideIndex < 0 || slideIndex >= slideRawContents.length) {
      return;
    }

    // Get the slide content
    const slideContent = slideRawContents[slideIndex];
    const slideLines = slideContent.split('\n');

    // Find layout metadata line
    let layoutLineIndex = -1;
    for (let i = 0; i < slideLines.length; i++) {
      const line = slideLines[i].trim();
      if (line.match(/^layout\s*:/i)) {
        layoutLineIndex = i;
        break;
      }
      // Stop if we hit non-metadata
      if (
        line === '' ||
        (!line.match(/^\w+\s*:/) && !line.startsWith('#') && !line.startsWith('!'))
      ) {
        break;
      }
    }

    if (hidden) {
      // Add or modify layout to include "(hidden)"
      if (layoutLineIndex >= 0) {
        // Modify existing layout line
        const currentLine = slideLines[layoutLineIndex];
        const match = currentLine.match(/^(layout\s*:\s*)(.*)$/i);
        if (match) {
          const layoutValue = match[2].trim();
          if (!layoutValue.includes('(hidden)')) {
            if (layoutValue) {
              slideLines[layoutLineIndex] = `${match[1]}${layoutValue} (hidden)`;
            } else {
              slideLines[layoutLineIndex] = `${match[1]}(hidden)`;
            }
          }
        }
      } else {
        // Add new layout line with (hidden)
        slideLines.unshift('layout: (hidden)');
      }
    } else {
      // Remove "(hidden)" from layout
      if (layoutLineIndex >= 0) {
        const currentLine = slideLines[layoutLineIndex];
        const match = currentLine.match(/^(layout\s*:\s*)(.*)$/i);
        if (match) {
          const layoutValue = match[2]
            .trim()
            .replace(/\s*\(hidden\)\s*/, '')
            .trim();
          if (layoutValue) {
            slideLines[layoutLineIndex] = `${match[1]}${layoutValue}`;
          } else {
            // If layout becomes empty, remove the line
            slideLines.splice(layoutLineIndex, 1);
          }
        }
      }
    }

    slideRawContents[slideIndex] = slideLines.join('\n');

    // Reconstruct the document
    let newBody = slideRawContents[0];
    for (let i = 1; i < slideRawContents.length; i++) {
      const separator = separators[i - 1] || '\n---\n';
      newBody += separator + slideRawContents[i];
    }
    const newContent = frontmatter + (frontmatter ? '\n' : '') + newBody;

    // Clear presentation cache to trigger full re-render
    // (dynamic background colors depend on visible slide count, so we need full recalc)
    this.presentationCache = null;
    this.cachedFilePath = null;

    await this.app.vault.modify(file, newContent);
    // vault.modify triggers editor-change event which calls debounceUpdateSidebarsWithContent
    // No need to call updateSidebars explicitly
  }

  async updatePresentationFrontmatter(file: TFile, updates: Record<string, any>) {
    const content = await this.app.vault.read(file);
    const lines = content.split('\n');

    // Find frontmatter boundaries
    let hasFrontmatter = false;
    let frontmatterStart = -1;
    let frontmatterEnd = -1;

    for (let i = 0; i < lines.length; i++) {
      if (i === 0 && lines[i].trim() === '---') {
        hasFrontmatter = true;
        frontmatterStart = 0;
        continue;
      }
      if (hasFrontmatter && frontmatterStart >= 0 && lines[i].trim() === '---') {
        frontmatterEnd = i;
        break;
      }
    }

    // Parse existing frontmatter
    const existingFM: Record<string, string> = {};
    if (hasFrontmatter && frontmatterEnd > frontmatterStart) {
      for (let i = frontmatterStart + 1; i < frontmatterEnd; i++) {
        const line = lines[i];
        const colonIndex = line.indexOf(':');
        if (colonIndex > 0) {
          const key = line.slice(0, colonIndex).trim();
          let value = line.slice(colonIndex + 1).trim();
          // Remove quotes
          if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
          ) {
            value = value.slice(1, -1);
          }
          existingFM[key] = value;
        }
      }
    }

    // Merge updates
    for (const [key, value] of Object.entries(updates)) {
      // Convert camelCase to kebab-case for YAML
      const yamlKey = key
        .replace(/([A-Z])/g, '-$1')
        .toLowerCase()
        .replace(/^-/, '');

      if (value === undefined || value === null || value === '') {
        delete existingFM[yamlKey];
        delete existingFM[key];
      } else if (typeof value === 'boolean') {
        existingFM[yamlKey] = value ? 'true' : 'false';
      } else if (Array.isArray(value)) {
        // Serialize arrays as comma-separated values
        existingFM[yamlKey] = value.join(', ');
      } else {
        existingFM[yamlKey] = String(value);
      }
    }

    // Build new frontmatter
    const fmLines = ['---'];
    for (const [key, value] of Object.entries(existingFM)) {
      // Quote values that need it
      if (value.includes(':') || value.includes('#') || value.startsWith(' ')) {
        fmLines.push(`${key}: "${value}"`);
      } else {
        fmLines.push(`${key}: ${value}`);
      }
    }
    fmLines.push('---');

    // Get body content
    const bodyStart = hasFrontmatter ? frontmatterEnd + 1 : 0;
    const bodyLines = lines.slice(bodyStart);

    // Reconstruct document
    const newContent = fmLines.join('\n') + '\n' + bodyLines.join('\n');

    await this.app.vault.modify(file, newContent);
    // Note: No explicit updateSidebars call needed here - the file modification
    // triggers the editor-change event which handles the update with debouncing
  }

  private updatePreviewsLive(file: TFile, updates: Record<string, any>) {
    // Update all views without writing to disk
    const thumbnailLeaves = this.app.workspace.getLeavesOfType(THUMBNAIL_VIEW_TYPE);
    for (const leaf of thumbnailLeaves) {
      const view = leaf.view;
      if (!(view instanceof ThumbnailNavigatorView)) {
        continue;
      }
      const presentation = view.getPresentation();
      if (presentation) {
        Object.assign(presentation.frontmatter, updates);
        view.updateSlides(
          Array.from({ length: presentation.slides.length }, (_, i) => i),
          presentation.slides
        );
      }
    }

    const presentationLeaves = this.app.workspace.getLeavesOfType(PRESENTATION_VIEW_TYPE);
    for (const leaf of presentationLeaves) {
      const view = leaf.view;
      if (!(view instanceof PresentationView)) {
        continue;
      }
      const presentation = view.getPresentation();
      if (presentation) {
        Object.assign(presentation.frontmatter, updates);
        view.updateCurrentSlideOnly();
      }
    }

    if (this.presentationWindow && this.presentationWindow.isOpen()) {
      const presentation = this.presentationWindow.getPresentation();
      if (presentation) {
        Object.assign(presentation.frontmatter, updates);
        // Trigger a re-render of the current slide in the window
        void this.presentationWindow.updateContent(presentation, this.currentTheme || null);
      }
    }
  }

  private updateInspectorFocus() {
    const activeFile = this.app.workspace.getActiveFile();
    const inspectorLeaves = this.app.workspace.getLeavesOfType(INSPECTOR_VIEW_TYPE);

    for (const leaf of inspectorLeaves) {
      const view = leaf.view;
      if (!(view instanceof InspectorPanelView)) {
        continue;
      }
      const isFocused = activeFile !== null && view.getTargetFile()?.path === activeFile.path;
      view.setFocused(isFocused);
    }
  }

  /**
   * Generate @font-face CSS for cached fonts used in the presentation
   * Uses base64 data URLs for iframe compatibility
   */
  async getCustomFontCSS(frontmatter: PresentationFrontmatter): Promise<string> {
    const cssRules: string[] = [];
    const debug = this.debugService;

    // First, check if using a custom theme with bundled fonts
    const themeName = frontmatter.theme || this.settings.defaultTheme;
    const theme = this.getThemeByName(themeName);

    if (theme && !theme.isBuiltIn && this.themeLoader) {
      // Load fonts from the custom theme's fonts/ folder
      const themeFontCSS = await this.themeLoader.generateThemeFontCSS(theme);
      if (themeFontCSS) {
        debug.log('font-handling', `Added theme font CSS (${themeName})`);
        cssRules.push(themeFontCSS);
      }
    }

    // Check for any fonts from the global font cache
    // (e.g., if frontmatter overrides the theme's fonts with other cached fonts)
    if (this.fontManager) {
      const fontsToCheck = [
        frontmatter.titleFont,
        frontmatter.bodyFont,
        frontmatter.headerFont,
        frontmatter.footerFont,
      ].filter(Boolean) as string[];

      debug.log('font-handling', `Checking fonts for CSS generation: ${fontsToCheck.join(', ')}`);

      // Deduplicate font names and collect ALL weights for each font across all roles
      const uniqueFonts = [...new Set(fontsToCheck)];

      for (const fontName of uniqueFonts) {
        const isCached = this.fontManager.isCached(fontName);
        debug.log('font-handling', `Font "${fontName}" cached: ${isCached}`);

        if (isCached) {
          // Collect all used weights for this font across ALL roles it's used in
          const usedWeights = new Set<number>();

          if (fontName === frontmatter.titleFont) {
            // Add title weight (default 700 if not specified)
            usedWeights.add(frontmatter.titleFontWeight ?? 700);
          }
          if (fontName === frontmatter.bodyFont) {
            // Add body weight (default 400 if not specified)
            const bodyWeight = frontmatter.bodyFontWeight ?? 400;
            usedWeights.add(bodyWeight);
            // IMPORTANT: Always include weight 700 for body font to support <strong> and <b> tags
            // (unless body font weight is already 700)
            if (bodyWeight !== 700) {
              usedWeights.add(700);
            }
          }
          if (fontName === frontmatter.headerFont) {
            // Add header weight (default 400 if not specified)
            usedWeights.add(frontmatter.headerFontWeight ?? 400);
          }
          if (fontName === frontmatter.footerFont) {
            // Add footer weight (default 400 if not specified)
            usedWeights.add(frontmatter.footerFontWeight ?? 400);
          }

          // If no specific weight is used for this font, include all available weights
          // (this ensures the font is available even if weight selection isn't specified)
          const weightsToInclude = usedWeights.size > 0 ? Array.from(usedWeights) : undefined;

          const css = await this.fontManager.generateFontFaceCSS(fontName, weightsToInclude);
          if (css) {
            debug.log(
              'font-handling',
              `Generated @font-face CSS for "${fontName}" (${css.length} bytes)${weightsToInclude ? ` with weights [${weightsToInclude.join(', ')}]` : ' with all available weights'}`
            );
            cssRules.push(css);
          } else {
            debug.warn('font-handling', `Failed to generate CSS for cached font "${fontName}"`);
          }
        } else {
          debug.warn('font-handling', `Font "${fontName}" not found in cache`);
        }
      }
    } else {
      debug.warn('font-handling', 'FontManager not initialized');
    }

    const result = cssRules.join('\n');
    debug.log(
      'font-handling',
      `Total custom font CSS: ${result.length} bytes, ${cssRules.length} rules`
    );
    return result;
  }

  /**
   * Build a map of font names to their available weights
   * Used by SlideRenderer to validate and sanitize font weights
   */
  private buildFontWeightsCache(): Map<string, number[]> {
    const cache = new Map<string, number[]>();

    if (this.fontManager) {
      const cachedFonts = this.fontManager.getAllCachedFonts();
      for (const font of cachedFonts) {
        cache.set(font.name, font.weights || []);
      }
    }

    return cache;
  }

  /**
   * Get a theme by name, checking both built-in and custom themes
   * This should be used instead of getTheme() to support custom themes
   */
  getThemeByName(name: string): Theme | undefined {
    // Try the requested theme first
    if (this.themeLoader && name) {
      const theme = this.themeLoader.getTheme(name);
      if (theme) {
        return theme;
      }
    }

    // If requested theme not found, try default theme
    // This handles cases like Advanced Slides theme names that don't exist in Perspecta
    if (this.themeLoader && this.settings.defaultTheme && this.settings.defaultTheme !== name) {
      const defaultTheme = this.themeLoader.getTheme(this.settings.defaultTheme);
      if (defaultTheme) {
        return defaultTheme;
      }
    }

    // No theme found - return undefined (will use CSS defaults)
    return undefined;
  }

  /**
   * Save current presentation settings as a custom theme
   */
  async saveAsCustomTheme(file: TFile): Promise<void> {
    const content = await this.app.vault.read(file);
    const presentation = this.parser.parse(content);

    // IMPORTANT: Use the Inspector's current presentation if available (has all user changes)
    // Otherwise fall back to parsing from file (which may not have unsaved Inspector changes)
    let frontmatter = presentation.frontmatter;

    const inspectorLeaves = this.app.workspace.getLeavesOfType(INSPECTOR_VIEW_TYPE);
    for (const leaf of inspectorLeaves) {
      const view = leaf.view;
      if (view instanceof InspectorPanelView) {
        const inspectorPresentation = view.getPresentation();
        if (inspectorPresentation) {
          // Use the Inspector's presentation which has all current changes
          frontmatter = inspectorPresentation.frontmatter;
          console.log('[ThemeSave] Using Inspector presentation frontmatter with current changes');
          break;
        }
      }
    }

    // Get list of existing theme names (built-in + custom)
    const builtInNames = getBuiltInThemeNames();
    const customThemeNames = this.themeLoader?.getCustomThemes().map((t) => t.template.Name) || [];

    const modal = new SaveThemeModal(
      this.app,
      builtInNames,
      customThemeNames,
      this.settings.customThemesFolder,
      async (themeName: string, overwrite: boolean) => {
        const exporter = new ThemeExporter(
          this.app,
          this.fontManager,
          this.settings.customThemesFolder
        );

        await exporter.exportTheme(
          themeName,
          frontmatter,
          content,
          file,
          frontmatter.theme,
          overwrite
        );

        // Reload themes after saving
        if (this.themeLoader) {
          await this.themeLoader.loadThemes();
        }
      }
    );

    modal.open();
  }

  /**
   * Create a demo presentation from the built-in default theme
   */
  private async createDemoPresentation(
    modalOnOk: () => void,
    modalOnGoToDemo: () => void
  ): Promise<void> {
    try {
      // Install Inter font in background if not already installed
      if (this.fontManager) {
        const interFont = this.fontManager.getCachedFont('Inter');
        if (!interFont) {
          // Install Inter font without user interaction (silent install)
          try {
            await this.fontManager.cacheGoogleFont('Inter', [400, 700], ['normal'], 'Inter');
          } catch (e) {
            console.warn('Failed to auto-install Inter font:', e);
            // Continue anyway - the demo will still work
          }
        }
      }

      // Create the demo folder
      const demFolderPath = 'Perspecta Slides Demo';
      let demoFolder = this.app.vault.getFolderByPath(demFolderPath);
      if (!demoFolder) {
        demoFolder = await this.app.vault.createFolder(demFolderPath);
      }

      // Read the default theme demo content from the vault
      const demoContent = `---
theme: default
header-left: Perspecta Slides
footer-left: Default Slide Template
title-font-size: -40
content-top: 21.2
title-top: 6.4
header-top: 3
light-h2-color: "#918a83"
body-font-size: -20
list-item-spacing: 1.2
headline-spacing-after: 1.3
light-bold-color: "#2f4e98"
title-font: Inter
body-font: Inter
body-font-weight: 400
title-font-weight: 700
content-left: 6
content-right: 6
title: Default Theme
mode: dark
use-dynamic-background: dark
dark-dynamic-background: "#450a0a, #431407, #451a03, #422006, #1a2e05, #052e16, #022c22, #042f2e, #083344, #082f49, #172554, #1e1b4b, #2e1065, #3b0764, #4a044e, #500724, #4c0519"
light-dynamic-background: "#fecaca, #fed7aa, #fde68a, #fef08a, #d9f99d, #bbf7d0, #a7f3d0, #99f6e4, #a5f3fc, #bae6fd, #bfdbfe, #c7d2fe, #ddd6fe, #e9d5ff, #f5d0fe, #fbcfe8, #fecdd3"
lock-aspect-ratio: true
dark-background: "#2b2b2b"
light-background: "#f2ebe3"
line-height: 1.35
dark-bg-cover: "#2b2b2b"
---
layout: cover
opacity: 30%
background: clouds.png
mode: dark

# Perspecta Slides

## Default Theme

GitHub: [owrede/perspecta-slides](https://github.com/owrede/perspecta-slides/)

Enjoy!

---
layout: section
# Default Layout Slide

---
layout: default (hidden)
# This is a hidden slide

Hiding slides is possible by adding ´ (hidden)´ after the ´layout:´ slide override info —or— you can just hide/unhide with the eye-icon in the slide list.

Hidden slides do not use the dynamic background (and they do not interrupt the gradient) and do not count in the total slide count.

---
layout: default
# Default Slide Layout
## Automatic columns for the lazy

Content (#/## headlines, parapgraphs, images) are  detected as potential column element. The auto-detect will create one, two or three columns.

If you need to give the image a little more space...

![[default-clouds.png|Clouds]]

---
layout: 2-columns-1+2
# Default Slide Layout
## Automatic columns for the lazy

... you could use the »2-columns-1+2« layout.[^1]

![[default-clouds.png|Clouds]]

---
layout: default
# Default Slide Layout
## Paragraphs

The slide layout »default« is special compared to the other Layouts because it offers an auto-detection of columns (one, two or three columns)[^2]

To add some a new lines in text without triggering the auto-detection you can use  \\n\\n\\\\n\\n\\nThis will be translated to a new line in the rendered slide. 

**\\\\n → New line**\\n\\nNew lines via \\\\n will connect the text, so that the auto-detection would not detect a new paragraph.

---
layout: default
# Default Slide Layout
## Headlines (###)

### Alternative

- If headlines of level 3 (###) are detected on a slide, then these headlines will be used as column separator for that slide. 
- A second headline of level 3 will create a second column.
### Second Column

![[default-clouds.png|Clouds]]

---
layout: section
# Column Layouts

---
layout: 1-column
# One Column
## Subheadline

- A single column design is the most common way of presenting thoughts in slides. Usually this would be used with a larger typeface.

- Paragraph 2

- Paragraph 3

---
layout: 2-columns
# Two Columns

- Paragraph 1

- Paragraph 2

- *More text in two colums will simply end up in the last column. No additional columne.*

---
layout: 3-columns
# Three Columns

- Paragraph 1

- Paragraph 2

- Paragraph 3

---
layout: 2-columns-2+1
# 2 Columns
## 2/3 + 1/3 

![[default-clouds.png|Clouds]]

Soft giants adrift, \\n
painting shadows on the earth— \\n
sky's fleeting canvas.

---
layout: 2-columns-1+2
# 2 Columns
## 1/3 + 2/3 

Soft giants adrift, \\n
painting shadows on the earth— \\n
sky's fleeting canvas.

![[default-clouds.png|Clouds]]

---
layout: section
# Image Slides

---
layout: half-image
# Half-Image Slide
## Image to the right

![[default-clouds.png|Clouds]]

---
layout: half-image

![[default-clouds.png|Clouds]]
# Half-Image Slide
## Image to the left

---
layout: caption
# Caption Slide

![[clouds.png|Clouds]]

With some caption text.

---
layout: full-image

![[default-clouds.png|Clouds]]

---
layout: half-image-horizontal
# Image
## Image below

![[default-clouds.png|Clouds]]

---
layout: half-image-horizontal

![[default-clouds.png|Clouds]]
# Image
## Image below

---
layout: footnotes
# Footnotes




---
[^1]: By the way: The standard Obsidian footnotes are supported on slides (option globally). The footnote box will stay inside the first column.
[^2]: The auto-detect feature is for quick presentations that try to get to a decent presentation without any extra work. You may want to consider other predefined slide layouts to better control the slide design.`;

      // Create the demo file
      const demoFileName = 'Default Theme Demo.md';
      const demoFile = await this.app.vault.create(
        demoFolder.path + '/' + demoFileName,
        demoContent
      );

      // Show confirmation modal
      const modal = new CreateDemoModal(this.app, modalOnOk, async () => {
        // Hide the settings dialog
        const settingsDialogs = document.querySelectorAll('.mod-settings');
        settingsDialogs.forEach((dialog) => {
          if (dialog instanceof HTMLElement) {
            dialog.style.display = 'none';
          }
        });

        // Close the settings leaf
        const settingsLeaves = this.app.workspace.getLeavesOfType('settings');
        for (const leaf of settingsLeaves) {
          await leaf.detach();
        }

        // Open the demo file
        await this.app.workspace.openLinkText(demoFile.path, '', false);

        // Ensure both sidebars are open
        // Toggle navigator if not visible
        const navigatorLeaves = this.app.workspace.getLeavesOfType(THUMBNAIL_VIEW_TYPE);
        if (navigatorLeaves.length === 0) {
          await this.toggleThumbnailNavigator();
        }

        // Toggle inspector if not visible
        const inspectorLeaves = this.app.workspace.getLeavesOfType(INSPECTOR_VIEW_TYPE);
        if (inspectorLeaves.length === 0) {
          await this.toggleInspector();
        }

        // Open presentation preview (not fullscreen)
        await this.openPresentationView(demoFile);
      });
      modal.open();
    } catch (error) {
      console.error('Failed to create demo presentation:', error);
      new Notice('Failed to create demo presentation: ' + (error as Error).message);
    }
  }
}
