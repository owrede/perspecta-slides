import type { App } from 'obsidian';
import { TFile, TFolder, requestUrl } from 'obsidian';
import { getDebugService } from './DebugService';

/**
 * Cached font metadata
 */
export interface CachedFont {
  name: string; // Font family name (e.g., "Barlow")
  displayName: string; // User-defined display name (defaults to font family name)
  sourceUrl: string; // Original Google Fonts URL
  weights: number[]; // Available weights (e.g., [400, 700])
  styles: string[]; // Available styles (e.g., ["normal", "italic"])
  files: CachedFontFile[];
  cachedAt: number; // Timestamp when cached
}

export interface CachedFontFile {
  weight: number;
  style: string;
  localPath: string; // Path in vault (e.g., "perspecta-fonts/Barlow-normal.woff2")
  format: string; // Font format (e.g., "woff2")
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
 * Result of font discovery - shows what's available to download
 */
export interface FontDiscoveryResult {
  fontName: string;
  allWeights: number[];
  allStyles: string[];
}

/**
 * Manages downloading and caching of Google Fonts
 */
export class FontManager {
  private app: App;
  private cache: FontCache = { fonts: {} };
  private saveCallback: (cache: FontCache) => Promise<void>;
  private debugMode: boolean = false;
  private fontCacheFolder: string;

  constructor(
    app: App,
    initialCache: FontCache | null,
    saveCallback: (cache: FontCache) => Promise<void>,
    fontCacheFolder?: string
  ) {
    this.app = app;
    this.cache = this.normalizeCacheLoadedFromStorage(initialCache || { fonts: {} });
    this.saveCallback = saveCallback;
    // Remove trailing slash to avoid double slashes when concatenating paths
    this.fontCacheFolder = (fontCacheFolder || DEFAULT_FONT_CACHE_FOLDER).replace(/\/$/, '');
  }

  /**
   * Normalize cache paths when loaded from storage
   * Handles Windows path issues where paths may have been corrupted
   */
  private normalizeCacheLoadedFromStorage(cache: FontCache): FontCache {
    for (const font of Object.values(cache.fonts)) {
      // Normalize all cached file paths
      font.files = font.files.map((file) => ({
        ...file,
        localPath: this.fixCorruptedPath(file.localPath),
      }));
    }
    return cache;
  }

  /**
   * Fix corrupted paths on Windows where folder paths may have been concatenated incorrectly
   * Example: "SRC/perspecta/fontsSRC/perspecta/fonts/Saira/..." -> "SRC/perspecta/fonts/Saira/..."
   */
  private fixCorruptedPath(path: string): string {
    // Convert backslashes to forward slashes
    let fixed = path.replace(/\\/g, '/');

    // Windows concatenation bug: path gets doubled in the middle
    // Pattern: "...fonts<UPPERCASE><REST>/perspecta/fonts/..."
    // The font cache folder path got inserted into a filename
    // Example: "SRC/perspecta/fonts" + "SRC/perspecta/fonts/Jost/-normal.woff2"
    // Results in: "SRC/perspecta/fontsSRC/perspecta/fonts/Jost/-normal.woff2"
    
    // Strategy: detect the pattern "fonts<UPPERCASE>" and look ahead to see if the
    // rest of the path matches the start of the cache folder name, then remove the duplication
    
    // Pattern 1: Simple case - "fontsSRC/perspecta/fonts" should become just "fonts/..."
    // Look for: (fonts)([A-Z]\w*)(/perspecta/fonts/)
    // Replace with: fonts/
    fixed = fixed.replace(/fonts([A-Z][a-zA-Z0-9]*)(\/[a-z][a-z\-]*\/fonts)/gi, 'fonts');
    
    // Pattern 2: Handle case where just the first segment got corrupted
    // "fontsSRC" with following path starting with the actual path components
    // Match: any segment that's "fonts" + uppercase + rest where rest is a path segment
    const parts = fixed.split('/');
    const cleaned: string[] = [];
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      
      // Check if this part looks like "fontsSRC" pattern
      // Where it's "fonts" + something that shouldn't be there
      if (part.match(/^fonts[A-Z]/)) {
        // Extract just the "fonts" part, and push the remainder as next part
        const match = part.match(/^(fonts)([A-Z].*)/);
        if (match) {
          cleaned.push(match[1]); // Push "fonts"
          // The remainder will be processed in next iteration when we continue the loop
          // by adjusting the array
          parts.splice(i + 1, 0, match[2]);
        }
      } else {
        cleaned.push(part);
      }
    }

    return cleaned.join('/');
  }

  /**
   * Set the font cache folder path
   */
  setFontCacheFolder(folder: string): void {
    // Remove trailing slash to avoid double slashes when concatenating paths
    this.fontCacheFolder = (folder || DEFAULT_FONT_CACHE_FOLDER).replace(/\/$/, '');
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
      const debug = getDebugService();
      debug.log('font-handling', '[FontManager]', ...args);
    }
  }

  /**
   * Parse a Google Fonts URL or plain font name and extract the font name
   * Supports:
   * - Plain font names: "Barlow", "Open Sans", "Noto Sans"
   * - URLs: https://fonts.google.com/specimen/Barlow
   * - URLs: https://fonts.google.com/specimen/Open+Sans
   * - URLs: https://fonts.google.com/noto/specimen/Noto+Sans (Noto fonts)
   * - URLs: https://fonts.googleapis.com/css2?family=Barlow
   */
  static parseGoogleFontsUrl(urlOrName: string): string | null {
    const input = urlOrName.trim();

    // Check if it's a URL
    if (input.includes('fonts.google.com') || input.includes('fonts.googleapis.com')) {
      // Match: https://fonts.google.com/noto/specimen/FontName (Noto fonts have special path)
      const notoMatch = input.match(/fonts\.google\.com\/noto\/specimen\/([^/?#]+)/i);
      if (notoMatch) {
        // Convert URL-encoded name (e.g., "Noto+Sans" -> "Noto Sans")
        return decodeURIComponent(notoMatch[1].replace(/\+/g, ' '));
      }

      // Match: https://fonts.google.com/specimen/FontName
      const specimenMatch = input.match(/fonts\.google\.com\/specimen\/([^/?#]+)/i);
      if (specimenMatch) {
        // Convert URL-encoded name (e.g., "Open+Sans" -> "Open Sans")
        return decodeURIComponent(specimenMatch[1].replace(/\+/g, ' '));
      }

      // Match: https://fonts.googleapis.com/css2?family=FontName
      const cssMatch = input.match(/fonts\.googleapis\.com\/css2?\?family=([^:&]+)/i);
      if (cssMatch) {
        return decodeURIComponent(cssMatch[1].replace(/\+/g, ' '));
      }

      return null;
    }

    // If not a URL, assume it's a plain font name
    // Font names can contain spaces and special characters
    // Just validate it's not empty and return as-is
    return input.length > 0 ? input : null;
  }

  /**
   * Check if a string is a valid Google Fonts input (URL or plain font name)
   */
  static isGoogleFontsUrl(value: string): boolean {
    const input = value.trim();

    // Check if it's a valid URL
    if (
      /fonts\.google\.com\/(noto\/)?specimen\//i.test(input) ||
      /fonts\.googleapis\.com\/css/i.test(input)
    ) {
      return true;
    }

    // Check if it's a plain font name (non-empty string without special chars that suggest it's invalid)
    // Allow letters, numbers, spaces, and common typographic characters (dash, underscore)
    if (input.length > 0 && /^[a-z0-9\s\-_]+$/i.test(input)) {
      return true;
    }

    return false;
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
   * Reload the font cache from the provided data
   * Used to sync the in-memory cache with updated settings
   */
  reloadCache(cacheData: FontCache | null): void {
    this.cache = cacheData || { fonts: {} };
  }

  /**
   * DISCOVERY STAGE: Query Google Fonts API to see what weights and styles are available
   * This is called before downloading to let user choose what to download
   * @param url Google Fonts URL (specimen or CSS URL)
   * @returns Discovery result with available weights/styles, or null if failed
   */
  async discoverGoogleFont(url: string): Promise<FontDiscoveryResult | null> {
    const debug = getDebugService();
    const fontName = FontManager.parseGoogleFontsUrl(url);
    if (!fontName) {
      debug.error('font-handling', `Invalid Google Fonts URL: ${url}`);
      console.error('[FontManager] Invalid Google Fonts URL:', url);
      return null;
    }

    try {
      debug.log('font-handling', `[font-discovery] Starting discovery for "${fontName}"...`);

      // Fetch font CSS with ALL available weights and both normal + italic styles
      const allWeights = [100, 200, 300, 400, 500, 600, 700, 800, 900];
      const normalParams = allWeights.map((w) => `0,${w}`);
      const italicParams = allWeights.map((w) => `1,${w}`);
      const weightParams = [...normalParams, ...italicParams].join(';');
      const cssUrl = `${GOOGLE_FONTS_API_BASE}?family=${encodeURIComponent(fontName)}:ital,wght@${weightParams}&display=swap`;

      debug.log('font-handling', `[font-discovery] Querying Google Fonts API...`);
      debug.log('font-handling', `[font-discovery] API URL: ${cssUrl}`);

      const cssResponse = await requestUrl({
        url: cssUrl,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        },
      });

      debug.log('font-handling', `[font-discovery] API response status: ${cssResponse.status}`);

      if (cssResponse.status !== 200) {
        debug.error(
          'font-handling',
          `Failed to fetch Google Fonts CSS: HTTP ${cssResponse.status}`
        );
        console.error('[FontManager] HTTP error from Google Fonts API:', cssResponse.status);
        return null;
      }

      // Parse CSS to discover available weights and styles
      debug.log(
        'font-handling',
        `[font-discovery] Parsing CSS response, length: ${cssResponse.text.length}`
      );
      const { allWeights: discoveredWeights, allStyles } = this.parseDiscoveryCSS(
        cssResponse.text,
        fontName
      );

      debug.log(
        'font-handling',
        `[font-discovery] Parsed discovery: weights=[${discoveredWeights.sort((a, b) => a - b)}], styles=[${allStyles.sort()}]`
      );
      debug.log(
        'font-handling',
        `[font-discovery] Discovered ${fontName}: weights=[${discoveredWeights.sort((a, b) => a - b)}], styles=[${allStyles.sort()}]`
      );

      return {
        fontName,
        allWeights: discoveredWeights,
        allStyles,
      };
    } catch (error) {
      debug.error(
        'font-handling',
        `Error discovering Google Font: ${error instanceof Error ? error.message : String(error)}`
      );
      console.error('[FontManager] Discovery error:', error);
      return null;
    }
  }

  /**
   * Parse CSS to extract available weights and styles (for discovery)
   */
  private parseDiscoveryCSS(
    cssText: string,
    fontName: string
  ): { allWeights: number[]; allStyles: string[] } {
    const debug = getDebugService();
    const allWeights = new Set<number>();
    const allStyles = new Set<string>();

    const fontFaceRegex = /@font-face\s*\{([^}]*)\}/gs;
    let match: RegExpExecArray | null;

    while ((match = fontFaceRegex.exec(cssText)) !== null) {
      const fontFaceContent = match[1];

      // Extract font-weight
      const weightMatch = fontFaceContent.match(/font-weight:\s*(\d+)/i);
      if (weightMatch) {
        allWeights.add(parseInt(weightMatch[1]));
      }

      // Extract font-style
      const styleMatch = fontFaceContent.match(/font-style:\s*(normal|italic)/i);
      if (styleMatch) {
        allStyles.add(styleMatch[1].toLowerCase());
      }
    }

    // Ensure we have at least some defaults
    if (allWeights.size === 0) {
      allWeights.add(400);
    }
    if (allStyles.size === 0) {
      allStyles.add('normal');
    }

    return {
      allWeights: Array.from(allWeights),
      allStyles: Array.from(allStyles),
    };
  }

  /**
   * Download and cache a Google Font
   * @param url Google Fonts URL (specimen or CSS URL)
   * @param selectedWeights Weights to download (user selected from discovery)
   * @param selectedStyles Styles to download (user selected from discovery)
   * @param displayName Optional custom display name for the font
   * @returns The font name if successful, null if failed
   */
  async cacheGoogleFont(
    url: string,
    selectedWeights?: number[],
    selectedStyles?: string[],
    displayName?: string
  ): Promise<string | null> {
    const debug = getDebugService();
    const fontName = FontManager.parseGoogleFontsUrl(url);
    if (!fontName) {
      debug.error('font-handling', `Invalid Google Fonts URL: ${url}`);
      return null;
    }

    // Check if already cached
    if (this.isCached(fontName)) {
      debug.log('font-handling', `Font "${fontName}" already cached`);
      return fontName;
    }

    // Use defaults if not specified (backward compatibility)
    const weightsToDownload = selectedWeights || [400];
    const stylesToDownload = selectedStyles || ['normal'];

    try {
      debug.log('font-handling', `[font-download] Starting download for "${fontName}"...`);
      debug.log(
        'font-handling',
        `[font-download] Selected weights: [${weightsToDownload}], styles: [${stylesToDownload}]`
      );

      // Ensure cache folder exists
      await this.ensureCacheFolder();

      // Clean up existing font folder if it exists (to avoid conflicts with partial downloads)
      const fontFolderPath = `${this.fontCacheFolder}/${fontName.replace(/\s+/g, '-')}`.replace(/\\/g, '/');
      const existingFolder = this.app.vault.getAbstractFileByPath(fontFolderPath);
      if (existingFolder instanceof TFolder) {
        debug.log(
          'font-handling',
          `[font-download] Removing existing font folder: ${fontFolderPath}`
        );

        // Recursively delete all files in the folder
        const deleteRecursively = async (folder: TFolder) => {
          for (const child of [...folder.children]) {
            if (child instanceof TFolder) {
              await deleteRecursively(child);
            } else {
              await this.app.vault.delete(child);
            }
          }
          await this.app.vault.delete(folder);
        };

        try {
          await deleteRecursively(existingFolder);
          debug.log('font-handling', `[font-download] Successfully removed existing font folder`);
        } catch (e) {
          debug.warn(
            'font-handling',
            `[font-download] Failed to remove existing font folder: ${e instanceof Error ? e.message : String(e)}`
          );
          console.warn('[FontManager] Failed to remove existing font folder:', e);
        }
      }

      // Fetch font CSS with ONLY the selected weights and styles
      // Google Fonts API requires tuples in specific order: normal (0,weight) FIRST, then italic (1,weight)
      // Format: 0,weight (normal) or 1,weight (italic)
      const params: string[] = [];

      // Always add normal weights first (0,weight)
      if (stylesToDownload.includes('normal')) {
        for (const weight of weightsToDownload) {
          params.push(`0,${weight}`);
        }
      }

      // Then add italic weights if requested (1,weight)
      if (stylesToDownload.includes('italic')) {
        for (const weight of weightsToDownload) {
          params.push(`1,${weight}`);
        }
      }

      const weightParams = params.join(';');
      const cssUrl = `${GOOGLE_FONTS_API_BASE}?family=${encodeURIComponent(fontName)}:ital,wght@${weightParams}&display=swap`;

      debug.log('font-handling', `[font-download] Requesting from Google Fonts API...`);
      debug.log('font-handling', `[font-download] CSS URL: ${cssUrl}`);

      // Request with a browser-like User-Agent to get woff2 format
      const cssResponse = await requestUrl({
        url: cssUrl,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        },
      });

      debug.log('font-handling', `[font-download] CSS Response status: ${cssResponse.status}`);

      if (cssResponse.status !== 200) {
        debug.error(
          'font-handling',
          `Failed to fetch Google Fonts CSS: HTTP ${cssResponse.status}`
        );
        return null;
      }

      const cssText = cssResponse.text;
      debug.log(
        'font-handling',
        `[font-download] Received CSS response (${cssText.length} bytes), downloading files...`
      );

      // Parse @font-face rules and download font files
      // This will download only the files present in the CSS response
      const {
        fontFiles,
        allWeights: parsedWeights,
        allStyles,
        fileMap,
      } = await this.parseCssAndDownloadFonts(cssText, fontName);

      if (fontFiles.length === 0) {
        debug.error('font-handling', `No font files found in CSS for font "${fontName}"`);
        return null;
      }

      // For variable fonts: don't expand to multiple weight entries.
      // Variable fonts have one file per style that covers all weights.
      const finalFontFiles = this.expandVariableFontFiles(
        fontFiles,
        weightsToDownload,
        stylesToDownload,
        fileMap
      );

      // Deduplicate: remove duplicate (weight, style, localPath) entries
      // This prevents duplicates from re-downloads or cache merges
      const uniqueFilesMap = new Map<string, CachedFontFile>();
      for (const file of finalFontFiles) {
        const key = `${file.weight}|${file.style}|${file.localPath}`;
        uniqueFilesMap.set(key, file);
      }
      const deduplicatedFiles = Array.from(uniqueFilesMap.values());

      // Use requested weights (variable fonts support all requested weights)
      // Use styles that were actually downloaded
      const downloadedWeights = weightsToDownload.sort((a, b) => a - b);
      const downloadedStyles = [...new Set(deduplicatedFiles.map((f) => f.style))].sort();

      debug.log(
        'font-handling',
        `[font-caching] Downloaded: weights=[${downloadedWeights}], styles=[${downloadedStyles}], files=${finalFontFiles.length}`
      );

      // Store in cache
      const cachedFont: CachedFont = {
        name: fontName,
        displayName: displayName || fontName,
        sourceUrl: url,
        weights: downloadedWeights,
        styles: downloadedStyles,
        files: deduplicatedFiles,
        cachedAt: Date.now(),
      };

      this.cache.fonts[fontName] = cachedFont;
      await this.saveCallback(this.cache);

      debug.log(
        'font-handling',
        `[font-caching] Successfully cached "${fontName}": ${downloadedWeights.length} weights, ${downloadedStyles.length} styles`
      );
      return fontName;
    } catch (error) {
      debug.error(
        'font-handling',
        `Error caching Google Font: ${error instanceof Error ? error.message : String(error)}`
      );
      console.error('[FontManager] Caching error:', error);
      if (error instanceof Error) {
        console.error('[FontManager] Error details:', error.message, error.stack);
        debug.log('font-handling', `Stack trace: ${error.stack}`);
      }
      return null;
    }
  }

  /**
   * Cache a local font from a folder path
   * Scans the folder for .otf, .ttf, .woff, .woff2 files and creates a cached font entry
   * @param folderPath Path to folder containing font files (relative to vault root)
   * @param fontName Optional font family name (auto-detected from filenames if not provided)
   * @returns The font name if successful, null if failed
   */
  async cacheLocalFont(folderPath: string, fontName?: string): Promise<string | null> {
    const debug = getDebugService();
    debug.log(
      'font-handling',
      `[font-local] cacheLocalFont called with path: ${folderPath}, fontName: ${fontName}`
    );
    this.log('Caching local font from folder:', folderPath);

    try {
      const folder = this.app.vault.getAbstractFileByPath(folderPath);
      debug.log(
        'font-handling',
        `[font-local] Folder lookup result: ${folder?.path}, isFolder: ${folder instanceof TFolder}`
      );

      if (!folder || !(folder instanceof TFolder)) {
        debug.error('font-handling', `[font-local] Folder not found: ${folderPath}`);
        return null;
      }

      // Find all font files in the folder
      const fontExtensions = ['otf', 'ttf', 'woff', 'woff2'];

      this.log(
        'Searching for fonts in folder, found files:',
        folder.children.map((f) => f.name)
      );
      const fontFilesInFolder = folder.children.filter(
        (f) => f instanceof TFile && fontExtensions.includes(f.extension.toLowerCase())
      ) as TFile[];

      debug.log('font-handling', `[font-local] Found ${fontFilesInFolder.length} font files`);
      this.log(
        'Found',
        fontFilesInFolder.length,
        'font files:',
        fontFilesInFolder.map((f) => f.basename)
      );

      if (fontFilesInFolder.length === 0) {
        debug.error('font-handling', `[font-local] No font files found in folder: ${folderPath}`);
        return null;
      }

      // Auto-detect font name from first file if not provided
      // E.g., "ClanOT-Bold.otf" -> "ClanOT", "Clan.otf" -> "Clan"
      if (!fontName) {
        const firstFile = fontFilesInFolder[0];
        const match = firstFile.basename.match(/^([^-.]+)/);
        fontName = match ? match[1] : firstFile.basename;
        this.log(
          'Auto-detected font name from file:',
          firstFile.basename,
          '-> fontName:',
          fontName
        );
      }

      this.log('Caching font with name:', fontName);

      // Parse font files to extract weight and style info
      const fontFiles: CachedFontFile[] = [];
      const weights: number[] = [];
      const styles: string[] = [];

      // Weight name mapping
      const weightMap: Record<string, number> = {
        thin: 100,
        hairline: 100,
        extralight: 200,
        ultralight: 200,
        light: 300,
        regular: 400,
        normal: 400,
        book: 400,
        news: 400,
        medium: 500,
        semibold: 600,
        demibold: 600,
        bold: 700,
        extrabold: 800,
        ultrabold: 800,
        black: 900,
        heavy: 900,
        ultra: 950,
      };

      // Ensure cache folder exists and create font-specific subfolder
      await this.ensureCacheFolder();
      const fontFolderPath = `${this.fontCacheFolder}/${fontName.replace(/\s+/g, '-')}`.replace(/\\/g, '/');
      await this.ensureFontFolder(fontFolderPath);

      for (const file of fontFilesInFolder) {
        const baseName = file.basename.toLowerCase();

        // Detect weight from filename
        let weight = 400;
        for (const [name, w] of Object.entries(weightMap)) {
          if (baseName.includes(name)) {
            weight = w;
            break;
          }
        }

        // Detect style from filename
        const isItalic =
          baseName.includes('ita') || baseName.includes('italic') || baseName.includes('oblique');
        const style = isItalic ? 'italic' : 'normal';

        // Copy file to font-specific subfolder
        const format = file.extension.toLowerCase();
        const destFileName = `${fontName.replace(/\s+/g, '-')}-${weight}-${style}.${format}`;
        const destPath = `${fontFolderPath}/${destFileName}`;

        // Check if destination exists
        const existing = this.app.vault.getAbstractFileByPath(destPath);
        let fileCopied = false;

        try {
          const data = await this.app.vault.readBinary(file);
          if (existing instanceof TFile) {
            // File exists, overwrite it
            await this.app.vault.modifyBinary(existing, data);
            debug.log('font-handling', `[font-local] Overwrote existing font file: ${destPath}`);
          } else {
            // File doesn't exist, create it
            await this.app.vault.createBinary(destPath, data);
            debug.log('font-handling', `[font-local] Created new font file: ${destPath}`);
          }
          fileCopied = true;
        } catch (error) {
          console.error('[FontManager] Error copying font file:', destFileName, error);
          // Check if file exists anyway (in case error was from overwrite attempt)
          const fileExists = this.app.vault.getAbstractFileByPath(destPath) instanceof TFile;
          if (!fileExists) {
            // File truly doesn't exist and we couldn't copy it, skip this file
            continue;
          }
          // File exists even though copy failed, continue to register it below
          fileCopied = true;
        }

        // Add to fontFiles if copy succeeded or file already exists
        if (fileCopied) {
          fontFiles.push({
            weight,
            style,
            localPath: destPath,
            format,
          });

          if (!weights.includes(weight)) {
            weights.push(weight);
          }
          if (!styles.includes(style)) {
            styles.push(style);
          }
        }
      }

      // Create cached font entry
      const cachedFont: CachedFont = {
        name: fontName,
        displayName: fontName,
        sourceUrl: `local:${folderPath}`,
        weights: weights.sort((a, b) => a - b),
        styles: [...new Set(styles)],
        files: fontFiles,
        cachedAt: Date.now(),
      };

      this.cache.fonts[fontName] = cachedFont;
      debug.log('font-handling', `[font-local] Added font to cache: ${fontName}`);
      await this.saveCallback(this.cache);

      this.log('Successfully cached local font:', fontName, 'with', fontFiles.length, 'files');
      return fontName;
    } catch (error) {
      console.error('[FontManager] Error caching local font:', error);
      return null;
    }
  }

  /**
   * Check if a path is a local font folder (contains font files)
   */
  async isLocalFontFolder(folderPath: string): Promise<boolean> {
    const folder = this.app.vault.getAbstractFileByPath(folderPath);
    if (!folder || !(folder instanceof TFolder)) {
      return false;
    }

    const fontExtensions = ['otf', 'ttf', 'woff', 'woff2'];
    return folder.children.some(
      (f) => f instanceof TFile && fontExtensions.includes(f.extension.toLowerCase())
    );
  }

  /**
   * Parse CSS and download font files
   * Handles variable fonts (single file for all weights) efficiently
   * Returns font files, all parsed weights, all parsed styles from CSS, and file map (URL -> {localPath, format})
   */
  private async parseCssAndDownloadFonts(
    css: string,
    fontName: string
  ): Promise<{
    fontFiles: CachedFontFile[];
    allWeights: number[];
    allStyles: string[];
    fileMap: Map<string, { localPath: string; format: string }>;
  }> {
    const debug = getDebugService();
    const fontFiles: CachedFontFile[] = [];
    const downloadedUrls = new Map<string, string>(); // URL -> localPath mapping
    const fileMap = new Map<string, { localPath: string; format: string }>(); // URL -> {localPath, format} mapping
    const allWeights: number[] = [];
    const allStyles: string[] = [];

    // Create font-specific subfolder
    const fontFolderPath = `${this.fontCacheFolder}/${fontName.replace(/\s+/g, '-')}`.replace(/\\/g, '/');
    await this.ensureFontFolder(fontFolderPath);

    debug.log('font-handling', `[font-parsing] Parsing CSS for ${fontName}...`);
    debug.log('font-handling', `[font-parsing] CSS length: ${css.length} chars, first 200: ${css.substring(0, 200)}`);

    // Match @font-face blocks (use [\s\S] to match across newlines)
    const fontFaceRegex = /@font-face\s*\{([\s\S]*?)\}/g;
    let match;
    let fontFaceCount = 0;

    while ((match = fontFaceRegex.exec(css)) !== null) {
      fontFaceCount++;
      const block = match[1];

      // Extract font-weight
      const weightMatch = block.match(/font-weight:\s*(\d+)/);
      const weight = weightMatch ? parseInt(weightMatch[1]) : 400;
      debug.log(
        'font-handling',
        `[font-parsing] Block ${fontFaceCount}: raw weight match = ${weightMatch ? weightMatch[0] : 'null'}, parsed weight = ${weight}`
      );
      allWeights.push(weight);

      // Extract font-style
      const styleMatch = block.match(/font-style:\s*(\w+)/);
      const style = styleMatch ? styleMatch[1] : 'normal';
      allStyles.push(style);

      // Extract src URL and format - handles both quoted and unquoted URLs
      // Example: src: url(https://...) format('woff2');
      // Also handles truetype (.ttf) and opentype (.otf) formats
      const srcMatch = block.match(/src:\s*url\(([^)]+)\)\s*format\(['"]([^'"]+)['"]\)/);
      if (!srcMatch) {
        debug.warn(
          'font-handling',
          `[font-parsing] No src URL found in @font-face block for weight ${weight}, style ${style}`
        );
        continue;
      }

      const fontUrl = srcMatch[1].replace(/['"]/g, '');
      // Map format names to file extensions
      const formatMap: Record<string, string> = {
        woff2: 'woff2',
        woff: 'woff',
        truetype: 'ttf',
        opentype: 'otf',
      };
      const format = formatMap[srcMatch[2]] || srcMatch[2];

      debug.log(
        'font-handling',
        `[font-parsing] Found @font-face: weight=${weight}, style=${style}, format=${format}`
      );

      // Check if we already downloaded this URL (variable fonts use same file for all weights)
      if (downloadedUrls.has(fontUrl)) {
        // Already downloaded - reuse existing file but track this weight/style combo
        const existingPath = downloadedUrls.get(fontUrl)!;
        debug.log(
          'font-handling',
          `[font-parsing] URL already downloaded (variable font), reusing: ${existingPath}`
        );
        // Don't add another entry - variable fonts are already tracked with their weight range
        // The first weight/style combo will be used to generate the @font-face rule
        continue;
      }

      // For font file naming, don't include weight since variable fonts support all weights
      // Static fonts will have a single weight entry anyway
      const fileName = `${fontName.replace(/\s+/g, '-')}-${style}.${format}`;
      // Normalize path separators: always use forward slashes for vault paths (cross-platform)
      const localPath = `${fontFolderPath}/${fileName}`.replace(/\\/g, '/');
      downloadedUrls.set(fontUrl, localPath);
      fileMap.set(fontUrl, { localPath, format });

      try {
        // Check if file already exists
        const existingFile = this.app.vault.getAbstractFileByPath(localPath);

        if (existingFile instanceof TFile) {
          // File exists - just add to fontFiles
          fontFiles.push({
            weight,
            style,
            localPath,
            format,
          });
          debug.log('font-handling', `[font-download] Using cached file: ${localPath}`);
        } else {
          // Download and save
          debug.log('font-handling', `[font-download] Downloading ${weight}/${style}...`);

          const fontResponse = await requestUrl({
            url: fontUrl,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            },
          });

          debug.log(
            'font-handling',
            `[font-download] Response status: ${fontResponse.status}, size: ${fontResponse.arrayBuffer.byteLength} bytes`
          );

          if (fontResponse.status === 200) {
            await this.app.vault.createBinary(localPath, fontResponse.arrayBuffer);

            fontFiles.push({
              weight,
              style,
              localPath,
              format,
            });

            const sizeKb = (fontResponse.arrayBuffer.byteLength / 1024).toFixed(1);
            debug.log(
              'font-handling',
              `[font-download] Downloaded ${weight}/${style}: ${sizeKb} KB`
            );
          } else {
            debug.error(
              'font-handling',
              `[font-download] HTTP ${fontResponse.status} for weight ${weight}/${style}`
            );
          }
        }
      } catch (e) {
        debug.error(
          'font-handling',
          `[font-download] Error downloading ${weight}/${style}: ${e instanceof Error ? e.message : String(e)}`
        );
        console.error('[FontManager] Download error for weight', weight, 'style', style, ':', e);
      }
    }

    debug.log(
      'font-handling',
      `[font-parsing] Completed: found ${fontFaceCount} @font-faces, extracted weights ${allWeights}, styles ${allStyles}`
    );
    debug.log('font-handling', `[font-download] Cached ${fontFiles.length} font files`);

    return { fontFiles, allWeights, allStyles, fileMap };
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
   * Ensure a font-specific subfolder exists within the cache folder
   */
  private async ensureFontFolder(folderPath: string): Promise<void> {
    const folder = this.app.vault.getAbstractFileByPath(folderPath);
    if (!folder) {
      try {
        await this.app.vault.createFolder(folderPath);
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
   * @param fontName Font name to generate CSS for
   * @param usedWeights Optional array of weights to include. If not specified, includes all weights.
   */
  async generateFontFaceCSS(fontName: string, usedWeights?: number[]): Promise<string> {
    return this.generateFontFaceCSSForExport(fontName, usedWeights);
  }

  /**
   * Generate @font-face CSS with data URLs for export (self-contained)
   * For variable fonts, generates a single @font-face with weight range
   * @param fontName Font name to generate CSS for
   * @param usedWeights Optional array of weights to include. If not specified, includes all weights.
   */
  async generateFontFaceCSSForExport(fontName: string, usedWeights?: number[]): Promise<string> {
    const debug = getDebugService();
    const font = this.getCachedFont(fontName);

    if (!font) {
      debug.warn('font-handling', `Font "${fontName}" not found in cache for CSS generation`);
      return '';
    }

    // Filter files to only include used weights (if specified)
    let filesToInclude = font.files;
    if (usedWeights && usedWeights.length > 0) {
      debug.log(
        'font-handling',
        `Cache has ${font.files.length} files with weights: ${font.files.map((f) => `${f.weight}/${f.style}`).join(', ')}`
      );
      filesToInclude = font.files.filter((f) => usedWeights.includes(f.weight));
      debug.log(
        'font-handling',
        `Filtering to used weights [${usedWeights.join(', ')}]: ${filesToInclude.length} of ${font.files.length} files`
      );
      
      // Fallback: if no files match the requested weights, use all files
      // This handles cases where cache was created with different weights
      if (filesToInclude.length === 0) {
        debug.warn(
          'font-handling',
          `No files match requested weights [${usedWeights.join(', ')}], using all cached files`
        );
        filesToInclude = font.files;
      }
    }

    debug.log(
      'font-handling',
      `Generating @font-face CSS for "${fontName}" with ${filesToInclude.length} files`
    );

    // Log each file being processed for debugging
    for (const file of filesToInclude) {
      debug.log(
        'font-handling',
        `  File: ${file.localPath}, weight: ${file.weight}, style: ${file.style}`
      );
    }

    const rules: string[] = [];
    const fileDataCache: Map<string, ArrayBuffer> = new Map(); // Cache file data to avoid re-reading

    // Filter out files that don't exist in vault (handles corrupted cache paths)
    const validFiles: typeof filesToInclude = [];
    for (const file of filesToInclude) {
      const normalizedPath = file.localPath.replace(/\/+/g, '/');
      const fontFile = this.app.vault.getAbstractFileByPath(normalizedPath);
      if (fontFile instanceof TFile) {
        validFiles.push(file);
      } else {
        debug.warn('font-handling', `Removing non-existent cached file from consideration: ${normalizedPath}`);
      }
    }

    if (validFiles.length === 0) {
      debug.warn('font-handling', `No valid cached files found for font "${fontName}"`);
      return '';
    }

    // Group files by (style, localPath)
    // For variable fonts, all weights use the same file, so we use the font's weights array for the range
    const fileGroups = new Map<
      string,
      { files: typeof validFiles; minWeight: number; maxWeight: number }
    >();

    for (const file of validFiles) {
      const key = `${file.style}|${file.localPath}`;
      if (!fileGroups.has(key)) {
        fileGroups.set(key, { files: [], minWeight: Infinity, maxWeight: -Infinity });
      }
      const group = fileGroups.get(key)!;
      group.files.push(file);
      group.minWeight = Math.min(group.minWeight, file.weight);
      group.maxWeight = Math.max(group.maxWeight, file.weight);
    }

    // For variable fonts with cached weights, use the actual weights from cache (not just file weights)
    // This ensures @font-face declares the full range (e.g., "font-weight: 100 900") even if only 1 file
    // BUT only do this for actual variable fonts (multiple DIFFERENT weights pointing to the same file)
    for (const group of fileGroups.values()) {
      // Only expand weight range if this is a true variable font:
      // - Multiple files in the group with DIFFERENT weights (not just duplicates)
      // For non-variable fonts (separate file per weight, or duplicate entries), keep single weight
      const uniqueWeightsInGroup = new Set(group.files.map((f) => f.weight));
      const isVariableFont = uniqueWeightsInGroup.size > 1;

      if (isVariableFont && font.weights && font.weights.length > 0) {
        group.minWeight = Math.min(...font.weights);
        group.maxWeight = Math.max(...font.weights);
      }
    }

    // Generate @font-face rules, deduplicating variable fonts
    for (const group of fileGroups.values()) {
      const firstFile = group.files[0];
      const normalizedPath = firstFile.localPath.replace(/\/+/g, '/');

      debug.log(
        'font-handling',
        `Processing font file group: ${normalizedPath} (styles: ${firstFile.style}, weights: ${group.minWeight}-${group.maxWeight})`
      );

      const fontFile = this.app.vault.getAbstractFileByPath(normalizedPath);
      if (!(fontFile instanceof TFile)) {
        debug.warn('font-handling', `Font file not found in vault: ${normalizedPath}`);
        continue;
      }

      try {
        // Get file data, using cache to avoid re-reading same file multiple times
        let data: ArrayBuffer;
        if (fileDataCache.has(normalizedPath)) {
          data = fileDataCache.get(normalizedPath)!;
          debug.log('font-handling', `Using cached file data for: ${normalizedPath}`);
        } else {
          data = await this.app.vault.readBinary(fontFile);
          fileDataCache.set(normalizedPath, data);
        }

        const base64 = this.arrayBufferToBase64(data);

        // Map file extensions to MIME types and format strings
        const mimeTypes: Record<string, string> = {
          woff2: 'font/woff2',
          woff: 'font/woff',
          ttf: 'font/ttf',
          otf: 'font/otf',
        };
        const formatStrings: Record<string, string> = {
          woff2: 'woff2',
          woff: 'woff',
          ttf: 'truetype',
          otf: 'opentype',
        };
        const mimeType = mimeTypes[firstFile.format] || 'font/woff2';
        const formatString = formatStrings[firstFile.format] || firstFile.format;

        // For variable fonts (multiple DIFFERENT weights per file), use weight range; otherwise use single weight
        const uniqueWeightsInGroup = new Set(group.files.map((f) => f.weight));
        const isVariableFont = uniqueWeightsInGroup.size > 1;
        const fontWeightDecl = isVariableFont
          ? `font-weight: ${group.minWeight} ${group.maxWeight};`
          : `font-weight: ${firstFile.weight};`;

        const rule = `
    @font-face {
    font-family: '${font.name}';
    font-style: ${firstFile.style};
    ${fontWeightDecl}
    font-display: swap;
    src: url('data:${mimeType};base64,${base64}') format('${formatString}');
    }`;
        rules.push(rule);
        debug.log(
          'font-handling',
          `Generated @font-face for ${font.name} style ${firstFile.style} ${isVariableFont ? `weight range ${group.minWeight}-${group.maxWeight}` : `weight ${firstFile.weight}`}`
        );
      } catch (e) {
        debug.error(
          'font-handling',
          `Failed to read font file: ${normalizedPath}, Error: ${e instanceof Error ? e.message : String(e)}`
        );
      }
    }

    const result = rules.join('\n');
    debug.log(
      'font-handling',
      `Generated ${rules.length} @font-face rules for "${fontName}" (${result.length} bytes total)`
    );
    return result;
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
   * Expand variable font files to cover all requested weights/styles
   *
   * For variable fonts, Google Fonts returns CSS with only one @font-face block,
   * but we requested multiple weights/styles. This function creates entries for all
   * requested weights/styles pointing to the downloaded variable font file.
   *
   * @param fontFiles Files that were actually parsed from the CSS
   * @param requestedWeights Weights that user requested
   * @param requestedStyles Styles that user requested
   * @param fileMap Map of URL -> {localPath, format} for downloaded files
   * @returns Expanded list with entries for all requested weights/styles
   */
  private expandVariableFontFiles(
    fontFiles: CachedFontFile[],
    requestedWeights: number[],
    requestedStyles: string[],
    fileMap: Map<string, { localPath: string; format: string }>
  ): CachedFontFile[] {
    const debug = getDebugService();

    // Variable fonts: expand cache entries to cover all requested weights
    // Even though there's only 1 file per style, we create entries for all weights
    // so that weight filtering works correctly during CSS generation
    const expandedFiles: CachedFontFile[] = [];

    for (const file of fontFiles) {
      // For each style in the original files, create entries for ALL requested weights
      for (const weight of requestedWeights) {
        expandedFiles.push({
          weight,
          style: file.style,
          localPath: file.localPath,
          format: file.format,
        });
      }
    }

    debug.log(
      'font-handling',
      `[font-expand] Variable font expanded from ${fontFiles.length} to ${expandedFiles.length} entries (${requestedWeights.length} weights × ${fontFiles.length} styles)`
    );

    return expandedFiles;
  }

  /**
   * Update the display name of a cached font
   */
  async updateDisplayName(fontName: string, displayName: string): Promise<void> {
    const font = this.getCachedFont(fontName);
    if (!font) {
      return;
    }

    font.displayName = displayName;
    await this.saveCallback(this.cache);
  }

  /**
   * Remove a cached font
   */
  async removeFont(fontName: string): Promise<void> {
    const font = this.getCachedFont(fontName);
    if (!font) {
      return;
    }

    const debug = getDebugService();
    const fontFolders = new Set<string>();

    // Delete font files from vault and track their folders
    for (const file of font.files) {
      const fontFile = this.app.vault.getAbstractFileByPath(file.localPath);
      if (fontFile instanceof TFile) {
        // Extract folder path (everything except the filename)
        const folderPath = file.localPath.substring(0, file.localPath.lastIndexOf('/'));
        fontFolders.add(folderPath);

        await this.app.vault.delete(fontFile);
        debug.log('font-handling', `[font-cleanup] Deleted file: ${file.localPath}`);
      }
    }

    // Clean up empty font-specific folders
    for (const folderPath of fontFolders) {
      try {
        const folder = this.app.vault.getAbstractFileByPath(folderPath);
        if (folder instanceof TFolder) {
          // Only delete if folder is empty
          if (folder.children.length === 0) {
            await this.app.vault.delete(folder);
            debug.log('font-handling', `[font-cleanup] Deleted empty folder: ${folderPath}`);
          }
        }
      } catch (e) {
        debug.warn(
          'font-handling',
          `[font-cleanup] Failed to delete folder ${folderPath}: ${e instanceof Error ? e.message : String(e)}`
        );
      }
    }

    // Remove from cache
    delete this.cache.fonts[fontName];
    await this.saveCallback(this.cache);
    debug.log('font-handling', `[font-cleanup] Removed "${fontName}" from cache`);
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
