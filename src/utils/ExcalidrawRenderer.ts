import { TFile, Vault } from 'obsidian';
import { exportToSvg } from '@excalidraw/utils';

/**
 * Parse and render Excalidraw files to SVG
 * Supports both .excalidraw (JSON) and .excalidraw.md (markdown with JSON) files
 */
export class ExcalidrawRenderer {
  private svgCache: Map<string, string> = new Map();

  constructor(private vault: Vault) {}

  /**
   * Get the SVG cache (used by SlideRenderer to look up converted SVGs)
   */
  getSvgCache(): Map<string, string> {
    return this.svgCache;
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
   * Read and parse Excalidraw file content
   * Handles both raw JSON (.excalidraw) and markdown wrapped JSON (.excalidraw.md)
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
        // Try to extract from ```json ... ``` code block
        const jsonMatch = content.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[1]);
        }

        // Try to extract from frontmatter-like JSON (some Excalidraw MD variants)
        const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
        if (frontmatterMatch) {
          try {
            return JSON.parse(frontmatterMatch[1]);
          } catch {
            // Not JSON, continue
          }
        }

        // Last resort: try to parse entire content as JSON
        // (some .excalidraw.md files are just JSON wrapped in markdown)
        try {
          return JSON.parse(content);
        } catch {
          // Continue to error handling
        }
      }

      throw new Error(`Could not extract JSON from ${file.path}`);
    } catch (e) {
      console.error(
        `[Perspecta] Failed to parse Excalidraw file: ${file.path}`,
        e
      );
      throw e;
    }
  }

  /**
   * Convert Excalidraw file to SVG data URL
   * Returns data:image/svg+xml;base64,... for embedding in <img> tags
   */
  async toSvgDataUrl(file: TFile): Promise<string> {
    try {
      const data = await this.parseExcalidrawFile(file);

      // Validate it's valid Excalidraw data
      if (!data.elements || !Array.isArray(data.elements)) {
        throw new Error('Invalid Excalidraw file format: missing elements array');
      }

      // Export to SVG string
      const svg = await exportToSvg({
        elements: data.elements,
        appState: data.appState || {},
        files: data.files || {},
        exportPadding: 10,
      });

      // Convert SVG to data URL
      const svgString = svg.outerHTML;
      const base64 = btoa(unescape(encodeURIComponent(svgString)));
      const dataUrl = `data:image/svg+xml;base64,${base64}`;

      // Cache it for SlideRenderer
      this.svgCache.set(file.path, dataUrl);

      console.log(
        `[Perspecta] ✅ Converted Excalidraw to SVG: ${file.path}`
      );

      return dataUrl;
    } catch (e) {
      console.error(
        `[Perspecta] Failed to convert Excalidraw to SVG: ${file.path}`,
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

      console.log(
        `[Perspecta] ✅ Converted Excalidraw to SVG blob: ${file.path}`
      );

      return blobUrl;
    } catch (e) {
      console.error(
        `[Perspecta] Failed to convert Excalidraw to SVG blob: ${file.path}`,
        e
      );
      throw e;
    }
  }
}
