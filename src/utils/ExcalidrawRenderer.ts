import type { TFile, Vault } from 'obsidian';
import { exportToSvg } from '@excalidraw/utils';
import * as LZ from 'lz-string';
import { getDebugService } from './DebugService';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const window: any;

/**
 * Parse and render Excalidraw files to SVG
 * Supports both .excalidraw (JSON) and .excalidraw.md (markdown with JSON) files
 */
export interface ExcalidrawCacheEntry {
  dataUrl: string;
  cachedAt: number; // timestamp when cached
}

export class ExcalidrawRenderer {
  private svgCache: Map<string, ExcalidrawCacheEntry> = new Map();
  private failedDecompressionCache: Set<string> = new Set();
  private decompressionInProgress: Set<string> = new Set();

  constructor(private vault: Vault) {}

  private log(message: string, data?: any): void {
    getDebugService().log('excalidraw', message, data);
  }

  private warn(message: string, data?: any): void {
    getDebugService().warn('excalidraw', message, data);
  }

  private error(message: string, data?: any): void {
    getDebugService().error('excalidraw', message, data);
  }

  /**
   * Get cached SVG data URL if valid (not stale)
   * @param cacheKey The cache key (file path with optional frame reference)
   * @param fileMtime The modification time of the source file
   * @returns The cached data URL if valid, undefined if stale or not cached
   */
  getCachedSvg(cacheKey: string, fileMtime: number): string | undefined {
    const entry = this.svgCache.get(cacheKey);
    if (!entry) {
      return undefined;
    }
    
    // Check if cache is stale (file was modified after caching)
    if (fileMtime > entry.cachedAt) {
      this.log(`Cache stale for ${cacheKey}: file modified at ${fileMtime}, cached at ${entry.cachedAt}`);
      this.svgCache.delete(cacheKey);
      return undefined;
    }
    
    return entry.dataUrl;
  }

  /**
   * Check if a valid (non-stale) cache entry exists
   * @param cacheKey The cache key (file path with optional frame reference)
   * @param fileMtime The modification time of the source file
   */
  hasCachedSvg(cacheKey: string, fileMtime: number): boolean {
    return this.getCachedSvg(cacheKey, fileMtime) !== undefined;
  }

  /**
   * Get the raw SVG cache (used by SlideRenderer to look up converted SVGs)
   * Note: Use getCachedSvg() for mtime-aware cache access
   */
  getSvgCache(): Map<string, ExcalidrawCacheEntry> {
    return this.svgCache;
  }

  /**
   * Get the failed decompression cache (used by SlideRenderer to show helpful messages)
   */
  getFailedDecompressionFiles(): Set<string> {
    return this.failedDecompressionCache;
  }



  /**
   * Check if a file is an Excalidraw file
   */
  isExcalidrawFile(file: TFile): boolean {
    return (
      file.extension === 'excalidraw' ||
      (file.extension === 'md' && file.name.includes('.excalidraw'))
    );
  }

  /**
     * Attempt to auto-decompress using Obsidian Excalidraw plugin command
     * Opens file in background leaf to avoid navigating away from current view
     */
  private async attemptAutoDecompression(file: TFile): Promise<void> {
    // Guard: Don't start decompression if already in progress for this file
    if (this.decompressionInProgress.has(file.path)) {
      this.log(`⏳ Decompression already in progress for: ${file.path}`);
      return;
    }

    this.decompressionInProgress.add(file.path);
    this.log(`🔄 Starting auto-decompression for: ${file.path}`);

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const app = (window as any).app;
      if (!app) {
        this.log(`Cannot access Obsidian app for auto-decompression`);
        return;
      }

      // Check if Excalidraw plugin is available and fully loaded
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const excalidrawPlugin = app.plugins?.plugins?.['obsidian-excalidraw-plugin'];
      if (!excalidrawPlugin) {
        this.log(`❌ Excalidraw plugin not available`);
        return;
      }

      // Save the currently active leaf to restore focus after decompression
      const previousActiveLeaf = app.workspace.activeLeaf;

      // Create a new tab for the Excalidraw file
      const leaf = app.workspace.getLeaf('tab');
      if (!leaf) {
        this.log(`Could not create leaf for auto-decompression`);
        return;
      }

      // Open the file - this will open it in Excalidraw view since it's an .excalidraw.md file
      await leaf.openFile(file);
      
      // Wait for the Excalidraw view to initialize
      await new Promise(resolve => setTimeout(resolve, 500));

      // Make this leaf active so the command targets it
      app.workspace.setActiveLeaf(leaf, { focus: true });
      
      // Small delay to ensure leaf is active
      await new Promise(resolve => setTimeout(resolve, 100));

      // Execute the Excalidraw plugin's decompress command
      this.log(`Executing 'Decompress current Excalidraw file' command...`);
      const executed = await app.commands.executeCommandById('obsidian-excalidraw-plugin:decompress');
      
      if (executed) {
        this.log(`✅ Decompression command executed for: ${file.path}`);
        
        // Wait for the file to be written before marking as ready for re-processing
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Remove from failed cache so next render attempt can try parsing again
        this.failedDecompressionCache.delete(file.path);
        this.log(`✅ File ready for re-processing: ${file.path}`);
      } else {
        this.log(`❌ Decompression command not executed`);
        // Try alternative: use plugin's internal decompress if available
        if (excalidrawPlugin.decompressFile) {
          this.log(`Trying plugin.decompressFile()...`);
          try {
            await excalidrawPlugin.decompressFile(file);
            this.failedDecompressionCache.delete(file.path);
            this.log(`✅ Decompressed via plugin API: ${file.path}`);
          } catch (e) {
            this.log(`plugin.decompressFile() failed:`, e);
          }
        }
      }

      // Close the temporary tab
      await leaf.detach();

      // Restore focus to the original leaf if it still exists
      if (previousActiveLeaf && previousActiveLeaf.view) {
        app.workspace.setActiveLeaf(previousActiveLeaf, { focus: true });
      }
    } catch (e) {
      this.log(`Auto-decompression failed:`, e);
    } finally {
      // Always remove from in-progress set when done
      this.decompressionInProgress.delete(file.path);
    }
  }

  /**
   * Read and parse Excalidraw file content
   * Handles both raw JSON (.excalidraw) and markdown wrapped JSON (.excalidraw.md)
   * Supports both old and new Excalidraw format versions
   */
  private async parseExcalidrawFile(file: TFile): Promise<any> {
    const content = await this.vault.read(file);

    try {
      // If it's a raw JSON file, parse directly
      if (file.extension === 'excalidraw') {
        return JSON.parse(content);
      }

      // If it's a markdown file, extract JSON from code block or frontmatter
      if (file.extension === 'md' && file.name.includes('.excalidraw')) {
        this.log(`Parsing Excalidraw markdown file: ${file.path}`);

        // Try to extract from ```json ... ``` code block (old format)
        const jsonMatch = content.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[1]);
            this.log(`✅ Parsed from json code block`);
            return parsed;
          } catch (e) {
            this.log(`Json code block parse failed:`, e);
            // Not valid JSON in block, continue
          }
        }

        // Try to extract from ```excalidraw ... ``` code block (old format)
        const excalidrawMatch = content.match(/```excalidraw\s*\n([\s\S]*?)\n```/);
        if (excalidrawMatch) {
          try {
            const parsed = JSON.parse(excalidrawMatch[1]);
            this.log(`✅ Parsed from excalidraw code block`);
            return parsed;
          } catch (e) {
            this.log(`Excalidraw code block parse failed:`, e);
            // Not valid JSON, continue
          }
        }

        // Try to extract from ```compressed-json ... ``` code block (new format)
        const compressedMatch = content.match(/```compressed-json\s*\n([\s\S]*?)\n```/);
        if (compressedMatch) {
          try {
            // CRITICAL: Remove all newlines and carriage returns from compressed data
            // The Excalidraw plugin adds newlines every 256 chars for readability
            const rawData = compressedMatch[1];
            const compressedData = rawData.replace(/[\n\r]/g, '');
            this.log(`Found compressed-json block, raw length: ${rawData.length}, cleaned: ${compressedData.length}`);
            this.log(`Data preview: ${compressedData.substring(0, 50)}`);
            
            // Excalidraw uses LZ-string compression with Base64 encoding
            let decompressed: string | null = null;

            // Method 1: Try decompressFromBase64 (this is what Excalidraw uses)
            try {
              const result = LZ.decompressFromBase64(compressedData);
              if (result && result.length > 0) {
                decompressed = result;
                this.log(`✅ decompressFromBase64 succeeded, length: ${result.length}`);
              }
            } catch (e) {
              this.log(`decompressFromBase64 failed:`, e);
            }

            // Method 2: Decode from base64 first, then decompress with various methods
            if (!decompressed) {
              try {
                const decoded = atob(compressedData);
                this.log(`Base64 decoded, length: ${decoded.length}`);
                
                // Try decompress
                try {
                  const result = LZ.decompress(decoded);
                  if (result && result.length > 0) {
                    decompressed = result;
                    this.log(`✅ base64 + decompress succeeded`);
                  }
                } catch (e) {
                  this.log(`base64 + decompress failed:`, e);
                }
              } catch (e) {
                this.log(`base64 decode failed:`, e);
              }
            }

            // Method 3: Try decompressFromEncodedURIComponent
            if (!decompressed) {
              try {
                const result = LZ.decompressFromEncodedURIComponent(compressedData);
                if (result && result.length > 0) {
                  decompressed = result;
                  this.log(`✅ decompressFromEncodedURIComponent succeeded`);
                }
              } catch (e) {
                this.log(`decompressFromEncodedURIComponent failed:`, e);
              }
            }

            // Method 4: Try decompressFromUTF16
            if (!decompressed) {
              try {
                const result = LZ.decompressFromUTF16(compressedData);
                if (result && result.length > 0) {
                  decompressed = result;
                  this.log(`✅ decompressFromUTF16 succeeded`);
                }
              } catch (e) {
                this.log(`decompressFromUTF16 failed:`, e);
              }
            }

            // If any method worked, parse the JSON
            if (decompressed) {
              try {
                const parsed = JSON.parse(decompressed);
                this.log(`✅ Parsed from compressed-json via lz-string`);
                return parsed;
              } catch (e) {
                this.log(`Failed to parse decompressed JSON:`, e);
              }
            }

            // Fallback: try Obsidian Excalidraw plugin if available
            try {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const excalidrawPlugin = (window as any).app?.plugins?.plugins?.['obsidian-excalidraw-plugin'];
              if (excalidrawPlugin?.decompress) {
                this.log(`Trying Obsidian Excalidraw plugin decompression...`);
                const result = await excalidrawPlugin.decompress(compressedData);
                if (result) {
                  const parsed = JSON.parse(result);
                  this.log(`✅ Parsed from compressed-json (via Excalidraw plugin decompression)`);
                  return parsed;
                }
              }
            } catch (e) {
              this.log(`Excalidraw plugin decompression fallback failed:`, e);
            }

            // Only trigger auto-decompression if not already in progress or failed
            if (!this.failedDecompressionCache.has(file.path) && !this.decompressionInProgress.has(file.path)) {
              // Mark this file as failed decompression to prevent re-triggering
              this.failedDecompressionCache.add(file.path);
              this.log(
                `ℹ️ Cannot auto-decompress Excalidraw file: ${file.path}\n` +
                `Attempting to trigger Obsidian Excalidraw plugin decompression command...`
              );
              
              // Trigger auto-decompression via Obsidian Excalidraw plugin command
              void this.attemptAutoDecompression(file);
            } else {
              this.log(`⏳ Skipping decompression (already in progress or failed): ${file.path}`);
            }
          } catch (e) {
            this.log(`Compressed-json parsing failed:`, e);
          }
        }

        // Try to extract from frontmatter-like JSON (new format with YAML metadata)
        const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
        if (frontmatterMatch) {
          try {
            // Try parsing as JSON first
            const parsed = JSON.parse(frontmatterMatch[1]);
            this.log(`✅ Parsed from frontmatter JSON`);
            return parsed;
          } catch {
            // Might be YAML, try to extract JSON from it
            const yamlContent = frontmatterMatch[1];
            // Look for excalidraw data key in YAML
            const excalidrawYamlMatch = yamlContent.match(/excalidraw:\s*(.+)/);
            if (excalidrawYamlMatch) {
              try {
                const parsed = JSON.parse(excalidrawYamlMatch[1]);
                this.log(`✅ Parsed from frontmatter YAML excalidraw field`);
                return parsed;
              } catch {
                this.log(`Could not parse YAML excalidraw field as JSON`);
              }
            }
          }
        }

        // Last resort: try to parse entire content as JSON (edge case)
        try {
          const parsed = JSON.parse(content);
          this.log(`✅ Parsed entire file as JSON`);
          return parsed;
        } catch {
          this.log(`Entire file is not JSON`);
        }

        // If markdown file but contains no JSON, log file structure for debugging
        this.warn(
          `${file.path} is a markdown file but contains no extractable Excalidraw JSON. ` +
          `File structure: ${content.substring(0, 500)}...`
        );
      }

      throw new Error(`Could not extract JSON from ${file.path}`);
    } catch (e) {
      this.error(
        `Failed to parse Excalidraw file: ${file.path}`,
        e
      );
      throw e;
    }
  }

  /**
   * Reference type for filtering elements
   */
  public static readonly REF_TYPES = ['group', 'area', 'frame', 'clippedframe'] as const;
  
  /**
   * Filter elements by group reference
   * Shows all elements sharing the same group ID as the referenced element
   */
  private filterElementsByGroup(elements: any[], groupId: string): any[] {
    // Find the referenced element (could be by ID or by section heading text)
    let refElement = elements.find(el => el.id === groupId);
    
    // If not found by ID, try to find by section heading (text starting with #)
    if (!refElement) {
      refElement = elements.find(el => 
        el.type === 'text' && 
        el.text?.startsWith('# ') && 
        el.text.slice(2).trim() === groupId
      );
    }
    
    if (!refElement) {
      this.log(`⚠️ Group reference element not found: ${groupId}`);
      return elements;
    }

    // Get the group IDs this element belongs to
    const elementGroupIds = refElement.groupIds || [];
    if (elementGroupIds.length === 0) {
      this.log(`⚠️ Referenced element has no groups: ${groupId}`);
      // Return just this element if it has no groups
      return [refElement];
    }

    this.log(`Found group reference: ${groupId}, groupIds: ${elementGroupIds.join(', ')}`);

    // Get all elements that share any of the same group IDs
    const groupedElements = elements.filter(el => {
      const elGroupIds = el.groupIds || [];
      return elGroupIds.some((gid: string) => elementGroupIds.includes(gid));
    });
    
    this.log(`Group contains ${groupedElements.length} elements`);
    return groupedElements;
  }

  /**
   * Filter elements by area reference
   * Cropped view around the referenced element's bounding box
   */
  private filterElementsByArea(elements: any[], areaId: string): any[] {
    // Find the referenced element
    let refElement = elements.find(el => el.id === areaId);
    
    // If not found by ID, try to find by section heading
    if (!refElement) {
      refElement = elements.find(el => 
        el.type === 'text' && 
        el.text?.startsWith('# ') && 
        el.text.slice(2).trim() === areaId
      );
    }
    
    if (!refElement) {
      this.log(`⚠️ Area reference element not found: ${areaId}`);
      return elements;
    }

    this.log(`Found area reference: ${areaId}`);

    // Get bounding box of the reference element
    const refBounds = {
      x1: refElement.x,
      y1: refElement.y,
      x2: refElement.x + (refElement.width || 0),
      y2: refElement.y + (refElement.height || 0),
    };

    // Find all elements that intersect with this bounding box
    const areaElements = elements.filter(el => {
      if (el === refElement) return true; // Always include reference element
      
      const elBounds = {
        x1: el.x,
        y1: el.y,
        x2: el.x + (el.width || 0),
        y2: el.y + (el.height || 0),
      };
      
      // Check for intersection
      return !(elBounds.x2 < refBounds.x1 || 
               elBounds.x1 > refBounds.x2 || 
               elBounds.y2 < refBounds.y1 || 
               elBounds.y1 > refBounds.y2);
    });
    
    this.log(`Area contains ${areaElements.length} elements`);
    return areaElements;
  }

  /**
   * Filter elements by frame reference
   * Shows all elements belonging to the frame in their ENTIRETY (even if extending beyond frame).
   * Elements are rendered fully - no clipping. Uses normal padding.
   * The frame border is excluded so only content is visible.
   */
  private filterElementsByFrame(elements: any[], frameId: string): any[] {
    // Find frame by ID or by name
    let frameElement = elements.find(el => el.id === frameId && el.type === 'frame');
    if (!frameElement) {
      // Try finding by frame name
      frameElement = elements.find(el => el.type === 'frame' && el.name === frameId);
    }
    
    if (!frameElement) {
      this.log(`⚠️ Frame not found: ${frameId}`);
      return elements;
    }

    this.log(`Found frame: ${frameElement.id}, name: ${frameElement.name || 'unnamed'}`);

    // Get all elements that belong to this frame (have frameId property matching)
    // Elements are returned in full - no clipping, even if they extend beyond frame
    const frameElements = elements.filter(el => el.frameId === frameElement.id);
    
    // Do NOT include the frame element - just return the contents
    // This shows elements in their entirety without the frame border
    this.log(`Frame contains ${frameElements.length} elements (full elements, no clipping)`);
    return frameElements;
  }

  /**
   * Filter elements by clipped frame reference
   * Shows frame contents CLIPPED to the frame boundary (like a window/mask).
   * Elements extending beyond the frame are cut off at the edge.
   * Returns frame bounds for SVG clipping.
   */
  private filterElementsByClippedFrame(elements: any[], frameId: string): { 
    elements: any[]; 
    clipBounds: { x: number; y: number; width: number; height: number } | null 
  } {
    // Find frame by ID or by name
    let frameElement = elements.find(el => el.id === frameId && el.type === 'frame');
    if (!frameElement) {
      // Try finding by frame name
      frameElement = elements.find(el => el.type === 'frame' && el.name === frameId);
    }
    
    if (!frameElement) {
      this.log(`⚠️ Clipped frame not found: ${frameId}`);
      return { elements, clipBounds: null };
    }

    this.log(`Found clipped frame: ${frameElement.id}, name: ${frameElement.name || 'unnamed'}`);
    this.log(`Frame bounds: x=${frameElement.x}, y=${frameElement.y}, w=${frameElement.width}, h=${frameElement.height}`);

    // Get all elements that belong to this frame
    const frameElements = elements.filter(el => el.frameId === frameElement.id);
    
    // Return elements and the frame bounds for clipping
    const clipBounds = {
      x: frameElement.x,
      y: frameElement.y,
      width: frameElement.width,
      height: frameElement.height,
    };
    
    this.log(`Clipped frame contains ${frameElements.length} elements (will clip at frame boundary)`);
    return { elements: frameElements, clipBounds };
  }

  /**
   * Filter elements based on reference type and ID
   */
  private filterElements(
    elements: any[], 
    refType: 'group' | 'area' | 'frame' | 'clippedframe', 
    refId: string
  ): { 
    elements: any[]; 
    padding: number; 
    clipBounds: { x: number; y: number; width: number; height: number } | null 
  } {
    switch (refType) {
      case 'group':
        return { elements: this.filterElementsByGroup(elements, refId), padding: 10, clipBounds: null };
      case 'area':
        return { elements: this.filterElementsByArea(elements, refId), padding: 10, clipBounds: null };
      case 'frame':
        return { elements: this.filterElementsByFrame(elements, refId), padding: 10, clipBounds: null };
      case 'clippedframe': {
        // Zero padding for clipped frames, with clip bounds
        const result = this.filterElementsByClippedFrame(elements, refId);
        return { elements: result.elements, padding: 0, clipBounds: result.clipBounds };
      }
      default:
        return { elements, padding: 10, clipBounds: null };
    }
  }

  /**
   * Apply a clipping rectangle to an SVG string
   * Used for clippedframe references to mask content at frame boundary
   */
  private applyClipToSvg(
    svgString: string, 
    clipBounds: { x: number; y: number; width: number; height: number },
    elements: any[]
  ): string {
    // Calculate the bounding box of all elements to understand the SVG coordinate system
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const el of elements) {
      if (el.x !== undefined && el.y !== undefined) {
        minX = Math.min(minX, el.x);
        minY = Math.min(minY, el.y);
        maxX = Math.max(maxX, el.x + (el.width || 0));
        maxY = Math.max(maxY, el.y + (el.height || 0));
      }
    }
    
    // The SVG viewBox starts at the minimum element coordinates (no padding for clippedframe)
    // The clip rect needs to be in SVG coordinate space
    const clipX = clipBounds.x - minX;
    const clipY = clipBounds.y - minY;
    
    this.log(`Applying clip: frame(${clipBounds.x},${clipBounds.y},${clipBounds.width},${clipBounds.height}), elements minXY(${minX},${minY}), clipXY(${clipX},${clipY})`);

    // Create a unique ID for the clipPath
    const clipId = `clip-${Date.now()}`;
    
    // Create the clipPath definition
    const clipPathDef = `<defs><clipPath id="${clipId}"><rect x="${clipX}" y="${clipY}" width="${clipBounds.width}" height="${clipBounds.height}"/></clipPath></defs>`;
    
    // Insert clipPath after opening <svg> tag and wrap content in a group with clip-path
    // Find the end of the opening <svg ...> tag
    const svgOpenMatch = svgString.match(/<svg[^>]*>/);
    if (!svgOpenMatch) {
      this.warn('Could not find SVG opening tag for clipping');
      return svgString;
    }
    
    const svgOpenTag = svgOpenMatch[0];
    const svgOpenEnd = svgString.indexOf(svgOpenTag) + svgOpenTag.length;
    const beforeContent = svgString.slice(0, svgOpenEnd);
    const afterOpen = svgString.slice(svgOpenEnd);
    
    // Find the closing </svg> tag
    const closingTagIndex = afterOpen.lastIndexOf('</svg>');
    if (closingTagIndex === -1) {
      this.warn('Could not find SVG closing tag for clipping');
      return svgString;
    }
    
    const svgContent = afterOpen.slice(0, closingTagIndex);
    const closingTag = afterOpen.slice(closingTagIndex);
    
    // Wrap the content in a clipped group
    const clippedSvg = `${beforeContent}${clipPathDef}<g clip-path="url(#${clipId})">${svgContent}</g>${closingTag}`;
    
    // Update the viewBox to match the clip bounds
    const newViewBox = `${clipX} ${clipY} ${clipBounds.width} ${clipBounds.height}`;
    const finalSvg = clippedSvg.replace(/viewBox="[^"]*"/, `viewBox="${newViewBox}"`);
    
    this.log(`Applied clip with viewBox: ${newViewBox}`);
    return finalSvg;
  }

  /**
   * Convert Excalidraw file to SVG data URL
   * Returns data:image/svg+xml;base64,... for embedding in <img> tags
   * @param file The Excalidraw file to convert
   * @param refType Optional reference type (group, area, frame, clippedframe)
   * @param refId Optional reference ID to filter elements
   */
  async toSvgDataUrl(
    file: TFile, 
    refType?: 'group' | 'area' | 'frame' | 'clippedframe',
    refId?: string
  ): Promise<string> {
    try {
      const data = await this.parseExcalidrawFile(file);

      // Validate it's valid Excalidraw data
      if (!data.elements || !Array.isArray(data.elements)) {
        throw new Error('Invalid Excalidraw file format: missing elements array');
      }

      // Filter elements based on reference type if provided
      let elementsToExport = data.elements;
      let exportPadding = 10;
      let clipBounds: { x: number; y: number; width: number; height: number } | null = null;
      
      if (refType && refId) {
        this.log(`Filtering by ${refType}: ${refId}`);
        const filtered = this.filterElements(data.elements, refType, refId);
        elementsToExport = filtered.elements;
        exportPadding = filtered.padding;
        clipBounds = filtered.clipBounds;
      }

      // Export to SVG string
      const svg = await exportToSvg({
        elements: elementsToExport,
        appState: data.appState || {},
        files: data.files || {},
        exportPadding,
      });

      // Apply clipping for clippedframe references
      let svgString = svg.outerHTML;
      if (clipBounds) {
        svgString = this.applyClipToSvg(svgString, clipBounds, elementsToExport);
      }
      this.log(`SVG string length: ${svgString.length}`);
      
      const base64 = btoa(unescape(encodeURIComponent(svgString)));
      const dataUrl = `data:image/svg+xml;base64,${base64}`;

      // Cache it for SlideRenderer (include reference in cache key if present)
      // Store with current timestamp for cache invalidation based on file mtime
      const cacheKey = refType && refId 
        ? `${file.path}#^${refType}=${refId}` 
        : file.path;
      this.svgCache.set(cacheKey, {
        dataUrl,
        cachedAt: Date.now(),
      });
      this.log(`✅ Cached SVG for: ${cacheKey} at ${Date.now()}`);
      this.log(`Cache now contains: ${this.svgCache.size} items`);

      return dataUrl;
    } catch (e) {
      this.error(
        `Failed to convert Excalidraw to SVG: ${file.path}`,
        e
      );
      throw e;
    }
  }

  /**
   * Convert Excalidraw file to SVG blob URL
   * Returns a local blob: URL instead of data URL (better for large drawings)
   */
  async toSvgBlobUrl(file: TFile): Promise<string> {
    try {
      const data = await this.parseExcalidrawFile(file);

      if (!data.elements || !Array.isArray(data.elements)) {
        throw new Error('Invalid Excalidraw file format: missing elements array');
      }

      const svg = await exportToSvg({
        elements: data.elements,
        appState: data.appState || {},
        files: data.files || {},
        exportPadding: 10,
      });

      const svgString = svg.outerHTML;
      const blob = new Blob([svgString], { type: 'image/svg+xml' });
      const blobUrl = URL.createObjectURL(blob);

      this.log(
        `✅ Converted Excalidraw to SVG blob: ${file.path}`
      );

      return blobUrl;
    } catch (e) {
      this.error(
        `Failed to convert Excalidraw to SVG blob: ${file.path}`,
        e
      );
      throw e;
    }
  }
}
