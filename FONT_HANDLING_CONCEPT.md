# Clean Font Handling Concept

## Overview
Font handling flows through 5 main stages: **Discovery → Download → Cache → Apply → Export**. Each stage has clear responsibilities and uses metadata to communicate rather than filesystem operations.

---

## 1. DISCOVERY STAGE
**User action**: Pastes Google Fonts URL into settings downloader

**System flow**:
- Parse URL to extract font name (e.g., "Outfit")
- **DO NOT** make assumptions about available weights/styles
- Query Google Fonts API for metadata about this specific font
- Present user with checklist: weights (100, 200, 300... 900) × styles (normal, italic)
- User selects desired weights/styles (e.g., 400/500/600/700 normal only)

**Key principle**: Let the user decide what to download, not the system

---

## 2. DOWNLOAD STAGE
**User action**: Clicks "Download"

**System flow**:
1. For each weight+style combination user selected:
   - Construct Google Fonts API URL with exact parameters
   - Download .woff2 file
   - Save with standardized filename: `{FontName}-{weight}-{style}.woff2`
2. After ALL downloads complete:
   - Update cache metadata with what was downloaded
   - Save to plugin settings
3. Show completion: "Downloaded Outfit: 400/500/600/700 normal"

**Key principle**: Download only what user requested. One file per weight+style combo.

---

## 3. CACHE METADATA
**Stored in plugin settings** (NOT filesystem-based):
```typescript
CachedFont {
  name: "Outfit"              // Key for lookups
  displayName: "Outfit"        // User-customizable
  sourceUrl: "https://fonts.google.com/specimen/Outfit"
  weights: [400, 500, 600, 700]  // ACTUAL downloaded weights
  styles: ["normal"]              // ACTUAL downloaded styles
  files: [
    { weight: 400, style: "normal", localPath: "perspecta-fonts/Outfit/Outfit-400-normal.woff2", format: "woff2" },
    { weight: 500, style: "normal", localPath: "perspecta-fonts/Outfit/Outfit-500-normal.woff2", format: "woff2" },
    // ... etc
  ]
  cachedAt: 1704067200000
}
```

**Key principle**: Cache metadata drives all UI decisions. The UI never scans the filesystem.

---

## 4. APPLY STAGE (In Inspector/Renderer)

### Inspector Font UI
1. Show dropdown of all cached fonts
2. When font selected:
   - Look up its metadata from cache
   - Show weight dropdown with ONLY `font.weights`
   - When weight selected:
     - Show style dropdown with ONLY `font.files.filter(f => f.weight === selectedWeight).map(f => f.style)`
3. When style selected:
   - Update frontmatter with `{fontName, fontWeight}`

**Key principle**: UI always reflects what's actually available. No guessing, no false info.

### CSS Generation (SlideRenderer)
1. For each font used in presentation, look up cache metadata
2. Generate `@font-face` rules only for downloaded files:
   ```css
   @font-face {
     font-family: 'Outfit';
     src: url('file:///path/to/Outfit-400-normal.woff2') format('woff2');
     font-weight: 400;
     font-style: normal;
   }
   ```
3. If user set `fontWeight: 600` but 600 not available:
   - Use fallback: find closest available weight (prefer heavier)
   - Log warning: "Font 'Outfit' weight 600 not available, using 700"

**Key principle**: Only load files that exist. Warn on missing weights.

---

## 5. EXPORT STAGE (Custom Theme → Built-in Theme)

### Theme Exporter
When user exports presentation as custom theme:
1. Scan presentation for fonts used + their weight/style settings
2. For each font, copy ONLY the files needed:
   ```
   custom-theme/
   ├── fonts/
   │   └── Outfit/
   │       ├── Outfit-400-normal.woff2
   │       ├── Outfit-600-normal.woff2
   │       └── metadata.json  // List of what's included
   ├── theme.json
   └── theme.css
   ```
3. Update `theme.json` to reference fonts and their available weights/styles
4. Include this metadata in the theme

### Converting Custom Theme to Built-in
1. Copy entire theme folder into `src/themes/builtin/`
2. Run build process (TypeScript compilation registers it)
3. Theme is now available to all users via plugin installation

**Key principle**: Export only what's needed. Theme metadata is self-contained.

---

## 6. DEBUG LOGGING
Single debug topic `font-handling` covers:
- **Discovery**: API queries, font metadata parsing
- **Download**: File download progress, success/failure
- **Cache**: Cache hits/misses, metadata updates
- **Apply**: Font selection, weight fallbacks, CSS generation
- **Export**: File copying, metadata generation

Example logs:
```
[font-handling] Discovered Outfit: weights=[100-900], styles=[normal,italic]
[font-handling] User selected: 400/500/600/700 normal
[font-handling] Downloading Outfit-400-normal.woff2...
[font-handling] Downloaded 4 files in 3.2s
[font-handling] Updated cache: Outfit=[400,500,600,700] normal
[font-handling] Inspector: Outfit selected, showing weights [400,500,600,700]
[font-handling] Inspector: Weight 600 selected, showing styles [normal]
[font-handling] CSS: Generating @font-face for 4 Outfit variants
[font-handling] CSS: Weight 800 not available for Outfit, using 700
[font-handling] Export: Copying Outfit files for weights [400,600]
```

---

## Key Principles Summary

1. **Metadata-driven UI**: Cache metadata tells the UI what's available, not filesystem scanning
2. **One file per variant**: Each weight+style combo is one `.woff2` file
3. **User decides downloads**: Don't assume; let user pick weights/styles
4. **Warn on missing weights**: If user wants weight not downloaded, warn and use fallback
5. **Export optimized**: Copy only fonts actually used in theme
6. **Consolidated logging**: Single `font-handling` debug topic covers all stages
7. **Separation of concerns**:
   - FontManager: Download & metadata
   - Inspector: Font selection UI
   - SlideRenderer: CSS generation & weight fallbacks
   - ThemeExporter: Theme generation & file optimization
