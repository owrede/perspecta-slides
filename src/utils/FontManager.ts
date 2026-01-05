import { App, TFile, TFolder, requestUrl } from 'obsidian';

/**
 * Cached font metadata
 */
export interface CachedFont {
  name: string;           // Font family name (e.g., "Barlow")
  displayName: string;    // User-defined display name (defaults to font family name)
  sourceUrl: string;      // Original Google Fonts URL
  weights: number[];      // Available weights (e.g., [400, 700])
  styles: string[];       // Available styles (e.g., ["normal", "italic"])
  files: CachedFontFile[];
  cachedAt: number;       // Timestamp when cached
}

export interface CachedFontFile {
  weight: number;
  style: string;
  localPath: string;      // Path in vault (e.g., "perspecta-fonts/Barlow-normal.woff2")
  format: string;         // Font format (e.g., "woff2")
}

/**
 * Font cache stored in plugin data
 */
export interface FontCache {
  fonts: Record<string, CachedFont>; // Keyed by font name
}

const DEFAULT_FONT_CACHE_FOLDER = 'perspecta-fonts';
const GOOGLE_FONTS_API_BASE = 'https://fonts.googleapis.com/css2';

/**
 * Manages downloading and caching of Google Fonts
 */
export class FontManager {
  private app: App;
  private cache: FontCache = { fonts: {} };
  private saveCallback: (cache: FontCache) => Promise<void>;
  private debugMode: boolean = false;
  private fontCacheFolder: string;

  constructor(app: App, initialCache: FontCache | null, saveCallback: (cache: FontCache) => Promise<void>, fontCacheFolder?: string) {
    this.app = app;
    this.cache = initialCache || { fonts: {} };
    this.saveCallback = saveCallback;
    this.fontCacheFolder = fontCacheFolder || DEFAULT_FONT_CACHE_FOLDER;
  }

  /**
   * Set the font cache folder path
   */
  setFontCacheFolder(folder: string): void {
    this.fontCacheFolder = folder || DEFAULT_FONT_CACHE_FOLDER;
  }

  /**
   * Get the current font cache folder path
   */
  getFontCacheFolder(): string {
    return this.fontCacheFolder;
  }

  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
  }

  private log(...args: unknown[]): void {
    if (this.debugMode) {
      console.log('[FontManager]', ...args);
    }
  }

  /**
   * Parse a Google Fonts URL and extract the font name
   * Supports: https://fonts.google.com/specimen/Barlow
   */
  static parseGoogleFontsUrl(url: string): string | null {
    // Match: https://fonts.google.com/specimen/FontName
    const specimenMatch = url.match(/fonts\.google\.com\/specimen\/([^/?#]+)/i);
    if (specimenMatch) {
      // Convert URL-encoded name (e.g., "Open+Sans" -> "Open Sans")
      return decodeURIComponent(specimenMatch[1].replace(/\+/g, ' '));
    }

    // Match: https://fonts.googleapis.com/css2?family=FontName
    const cssMatch = url.match(/fonts\.googleapis\.com\/css2?\?family=([^:&]+)/i);
    if (cssMatch) {
      return decodeURIComponent(cssMatch[1].replace(/\+/g, ' '));
    }

    return null;
  }

  /**
   * Check if a string is a Google Fonts URL
   */
  static isGoogleFontsUrl(value: string): boolean {
    return /fonts\.google\.com\/specimen\//i.test(value) ||
           /fonts\.googleapis\.com\/css/i.test(value);
  }

  /**
   * Get a cached font by name
   */
  getCachedFont(fontName: string): CachedFont | null {
    return this.cache.fonts[fontName] || null;
  }

  /**
   * Get all cached fonts
   */
  getAllCachedFonts(): CachedFont[] {
    return Object.values(this.cache.fonts);
  }

  /**
   * Check if a font is cached
   */
  isCached(fontName: string): boolean {
    return fontName in this.cache.fonts;
  }

  /**
   * Download and cache a Google Font
   * @param url Google Fonts URL (specimen or CSS URL)
   * @param displayName Optional custom display name for the font
   * @returns The font name if successful, null if failed
   */
  async cacheGoogleFont(url: string, displayName?: string): Promise<string | null> {
    const fontName = FontManager.parseGoogleFontsUrl(url);
    if (!fontName) {
      console.error('Invalid Google Fonts URL:', url);
      return null;
    }

    // Check if already cached
    if (this.isCached(fontName)) {
      return fontName;
    }

    try {
      // Ensure cache folder exists
      await this.ensureCacheFolder();

      // Fetch font CSS with multiple weights and both normal + italic styles
      // Google Fonts API requires tuples sorted: all normal (0,wght) first, then all italic (1,wght)
      const weights = [400, 500, 600, 700];
      const normalParams = weights.map(w => `0,${w}`);
      const italicParams = weights.map(w => `1,${w}`);
      const weightParams = [...normalParams, ...italicParams].join(';');
      const cssUrl = `${GOOGLE_FONTS_API_BASE}?family=${encodeURIComponent(fontName)}:ital,wght@${weightParams}&display=swap`;
      
      this.log('Fetching font CSS:', cssUrl);
      
      // Request with a browser-like User-Agent to get woff2 format
      const cssResponse = await requestUrl({
        url: cssUrl,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        }
      });

      if (cssResponse.status !== 200) {
        console.error('Failed to fetch Google Fonts CSS:', cssResponse.status);
        return null;
      }

      const cssText = cssResponse.text;
      this.log('Font CSS response length:', cssText.length);
      
      // Parse @font-face rules and download font files
      const { fontFiles, allWeights, allStyles } = await this.parseCssAndDownloadFonts(cssText, fontName);
      
      if (fontFiles.length === 0) {
        console.error('No font files found in CSS for font:', fontName);
        return null;
      }

      // Use all weights from CSS (for variable fonts, this is all available weights)
      const downloadedWeights = [...new Set(allWeights)].sort((a, b) => a - b);
      const downloadedStyles = [...new Set(allStyles)].sort();
      
      this.log('Downloaded weights:', downloadedWeights, 'styles:', downloadedStyles);

      // Store in cache
      const cachedFont: CachedFont = {
        name: fontName,
        displayName: displayName || fontName,
        sourceUrl: url,
        weights: downloadedWeights,
        styles: downloadedStyles,
        files: fontFiles,
        cachedAt: Date.now()
      };

      this.cache.fonts[fontName] = cachedFont;
      await this.saveCallback(this.cache);

      return fontName;

    } catch (error) {
      console.error('Error caching Google Font:', error);
      if (error instanceof Error) {
        console.error('Error details:', error.message, error.stack);
      }
      return null;
    }
  }

  /**
   * Parse CSS and download font files
   * Handles variable fonts (single file for all weights) efficiently
   * Returns font files, all parsed weights, and all parsed styles from CSS
   */
  private async parseCssAndDownloadFonts(css: string, fontName: string): Promise<{ fontFiles: CachedFontFile[], allWeights: number[], allStyles: string[] }> {
    const fontFiles: CachedFontFile[] = [];
    const downloadedUrls = new Map<string, string>(); // URL -> localPath mapping
    const allWeights: number[] = [];
    const allStyles: string[] = [];
    
    // Match @font-face blocks (use [\s\S] to match across newlines)
    const fontFaceRegex = /@font-face\s*\{([\s\S]*?)\}/g;
    let match;

    while ((match = fontFaceRegex.exec(css)) !== null) {
      const block = match[1];
      
      // Extract font-weight
      const weightMatch = block.match(/font-weight:\s*(\d+)/);
      const weight = weightMatch ? parseInt(weightMatch[1]) : 400;
      allWeights.push(weight);

      // Extract font-style
      const styleMatch = block.match(/font-style:\s*(\w+)/);
      const style = styleMatch ? styleMatch[1] : 'normal';
      allStyles.push(style);

      // Extract src URL and format - handles both quoted and unquoted URLs
      // Example: src: url(https://...) format('woff2');
      // Also handles truetype (.ttf) and opentype (.otf) formats
      const srcMatch = block.match(/src:\s*url\(([^)]+)\)\s*format\(['"]([^'"]+)['"]\)/);
      if (!srcMatch) continue;

      const fontUrl = srcMatch[1].replace(/['"]/g, '');
      // Map format names to file extensions
      const formatMap: Record<string, string> = {
        'woff2': 'woff2',
        'woff': 'woff',
        'truetype': 'ttf',
        'opentype': 'otf',
      };
      const format = formatMap[srcMatch[2]] || srcMatch[2];

      // Check if we already downloaded this URL (variable fonts use same file for all weights)
      if (downloadedUrls.has(fontUrl)) {
        // Already downloaded - reuse existing file but track this weight/style combo
        const existingPath = downloadedUrls.get(fontUrl)!;
        // Don't add duplicate entries, the file handles all weights
        continue;
      }

      // Include weight in filename to handle non-variable fonts with separate files per weight
      const fileName = `${fontName.replace(/\s+/g, '-')}-${weight}-${style}.${format}`;
      const localPath = `${this.fontCacheFolder}/${fileName}`;
      downloadedUrls.set(fontUrl, localPath);

      try {
        // Check if file already exists
        const existingFile = this.app.vault.getAbstractFileByPath(localPath);
        
        if (existingFile instanceof TFile) {
          // File exists - just add to fontFiles
          fontFiles.push({
            weight,
            style,
            localPath,
            format
          });
        } else {
          // Download and save
          const fontResponse = await requestUrl({
            url: fontUrl,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
            }
          });

          if (fontResponse.status === 200) {
            await this.app.vault.createBinary(localPath, fontResponse.arrayBuffer);

            fontFiles.push({
              weight,
              style,
              localPath,
              format
            });
          }
        }
      } catch (e) {
        this.log('Failed to download font file:', e);
      }
    }

    return { fontFiles, allWeights, allStyles };
  }

  /**
   * Ensure the font cache folder exists
   */
  private async ensureCacheFolder(): Promise<void> {
    const folder = this.app.vault.getAbstractFileByPath(this.fontCacheFolder);
    if (!folder) {
      try {
        await this.app.vault.createFolder(this.fontCacheFolder);
      } catch (e) {
        // Folder might already exist (race condition) - ignore
        if (!(e instanceof Error && e.message.includes('Folder already exists'))) {
          throw e;
        }
      }
    }
  }

  /**
   * Generate @font-face CSS for a cached font (uses base64 for iframe compatibility)
   */
  async generateFontFaceCSS(fontName: string): Promise<string> {
    return this.generateFontFaceCSSForExport(fontName);
  }

  /**
   * Generate @font-face CSS with data URLs for export (self-contained)
   * For variable fonts, generates a single @font-face with weight range
   */
  async generateFontFaceCSSForExport(fontName: string): Promise<string> {
    const font = this.getCachedFont(fontName);
    if (!font) return '';

    const rules: string[] = [];
    const processedFiles = new Set<string>();

    for (const file of font.files) {
      // Skip if we've already processed this file (for variable fonts with one file)
      if (processedFiles.has(file.localPath)) continue;
      processedFiles.add(file.localPath);

      const fontFile = this.app.vault.getAbstractFileByPath(file.localPath);
      if (!(fontFile instanceof TFile)) {
        this.log('Font file not found:', file.localPath);
        continue;
      }

      try {
        const data = await this.app.vault.readBinary(fontFile);
        const base64 = this.arrayBufferToBase64(data);
        
        // Map file extensions to MIME types and format strings
        const mimeTypes: Record<string, string> = {
          'woff2': 'font/woff2',
          'woff': 'font/woff',
          'ttf': 'font/ttf',
          'otf': 'font/otf',
        };
        const formatStrings: Record<string, string> = {
          'woff2': 'woff2',
          'woff': 'woff',
          'ttf': 'truetype',
          'otf': 'opentype',
        };
        const mimeType = mimeTypes[file.format] || 'font/woff2';
        const formatString = formatStrings[file.format] || file.format;

        // Each file has its own weight (non-variable fonts have separate files per weight)
        rules.push(`
@font-face {
  font-family: '${font.name}';
  font-style: ${file.style};
  font-weight: ${file.weight};
  font-display: swap;
  src: url('data:${mimeType};base64,${base64}') format('${formatString}');
}`);
      } catch (e) {
        this.log('Failed to read font file for export:', file.localPath);
      }
    }

    return rules.join('\n');
  }

  /**
   * Convert ArrayBuffer to base64
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Update the display name of a cached font
   */
  async updateDisplayName(fontName: string, displayName: string): Promise<void> {
    const font = this.getCachedFont(fontName);
    if (!font) return;

    font.displayName = displayName;
    await this.saveCallback(this.cache);
  }

  /**
   * Remove a cached font
   */
  async removeFont(fontName: string): Promise<void> {
    const font = this.getCachedFont(fontName);
    if (!font) return;

    // Delete font files from vault
    for (const file of font.files) {
      const fontFile = this.app.vault.getAbstractFileByPath(file.localPath);
      if (fontFile instanceof TFile) {
        await this.app.vault.delete(fontFile);
      }
    }

    // Remove from cache
    delete this.cache.fonts[fontName];
    await this.saveCallback(this.cache);
  }

  /**
   * Clear all cached fonts
   */
  async clearCache(): Promise<void> {
    // Delete all font files
    for (const fontName of Object.keys(this.cache.fonts)) {
      await this.removeFont(fontName);
    }

    // Delete cache folder if empty
    const folder = this.app.vault.getAbstractFileByPath(this.fontCacheFolder);
    if (folder instanceof TFolder && folder.children.length === 0) {
      await this.app.vault.delete(folder);
    }
  }
}
