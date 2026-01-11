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
export class ExcalidrawRenderer {
  private svgCache: Map<string, string> = new Map();
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
   * Get the SVG cache (used by SlideRenderer to look up converted SVGs)
   */
  getSvgCache(): Map<string, string> {
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
   * Filter elements to only those contained within a specific frame
   * In Excalidraw, frames have type "frame" and contain elements via frameId property
   * 
   * Note: We exclude the frame element itself to avoid rendering the frame border
   * and label. Obsidian's Excalidraw preview also excludes these.
   */
  private filterElementsByFrame(elements: any[], frameId: string): any[] {
    // Find the frame element (for logging only, we don't include it in export)
    const frameElement = elements.find(el => el.id === frameId && el.type === 'frame');
    if (!frameElement) {
      this.log(`⚠️ Frame not found: ${frameId}`);
      // Return all elements if frame not found
      return elements;
    }

    this.log(`Found frame: ${frameId}, name: ${frameElement.name || 'unnamed'}`);

    // Get all elements that belong to this frame (have frameId property matching)
    // Exclude the frame element itself to hide the frame border and label
    const frameElements = elements.filter(el => el.frameId === frameId);
    
    this.log(`Frame contains ${frameElements.length} elements (frame border/label excluded)`);
    return frameElements;
  }

  /**
   * Convert Excalidraw file to SVG data URL
   * Returns data:image/svg+xml;base64,... for embedding in <img> tags
   * @param file The Excalidraw file to convert
   * @param frameId Optional frame ID to export only elements within that frame
   */
  async toSvgDataUrl(file: TFile, frameId?: string): Promise<string> {
    try {
      const data = await this.parseExcalidrawFile(file);

      // Validate it's valid Excalidraw data
      if (!data.elements || !Array.isArray(data.elements)) {
        throw new Error('Invalid Excalidraw file format: missing elements array');
      }

      // Filter elements by frame if frameId is provided
      let elementsToExport = data.elements;
      if (frameId) {
        this.log(`Filtering by frame: ${frameId}`);
        elementsToExport = this.filterElementsByFrame(data.elements, frameId);
      }

      // Export to SVG string
      const svg = await exportToSvg({
        elements: elementsToExport,
        appState: data.appState || {},
        files: data.files || {},
        exportPadding: 10,
      });

      // Convert SVG to data URL
      const svgString = svg.outerHTML;
      this.log(`SVG string length: ${svgString.length}`);
      
      const base64 = btoa(unescape(encodeURIComponent(svgString)));
      const dataUrl = `data:image/svg+xml;base64,${base64}`;

      // Cache it for SlideRenderer (include frameId in cache key if present)
      const cacheKey = frameId ? `${file.path}#^frame=${frameId}` : file.path;
      this.svgCache.set(cacheKey, dataUrl);
      this.log(`✅ Cached SVG for: ${cacheKey}`);
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
