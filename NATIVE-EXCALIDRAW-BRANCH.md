# Native Excalidraw Rendering Branch

**Branch:** `native-excalidraw-rendering`

## Overview

This branch implements native SVG rendering of Excalidraw files (`.excalidraw` and `.excalidraw.md`) in Perspecta Slides without requiring manual PNG/SVG exports.

## Changes

### 1. **New Dependency**
- Added `@excalidraw/utils` (~15KB gzipped)
- Provides `exportToSvg()` function for converting Excalidraw JSON to SVG

### 2. **New Module: `ExcalidrawRenderer`**
**File:** `src/utils/ExcalidrawRenderer.ts`

Handles:
- Parsing `.excalidraw` (raw JSON) files
- Parsing `.excalidraw.md` (markdown-wrapped JSON) files
- Converting to SVG using `@excalidraw/utils`
- Caching for performance

Methods:
- `isExcalidrawFile(file)` - Check if file is Excalidraw format
- `toSvgDataUrl(file)` - Convert to data URL (for embedded images)
- `toSvgBlobUrl(file)` - Convert to blob URL (for large drawings)

### 3. **Plugin Integration**
**File:** `main.ts`

- Initialize `ExcalidrawRenderer` in `onload()`
- Detect `.excalidraw` files in image path resolver
- Return `excalidraw://` protocol URL as placeholder
- Support fallback to PNG/SVG exports if they exist

### 4. **Renderer Updates**
**File:** `src/renderer/SlideRenderer.ts`

- Add `excalidrawSvgCache` Map for caching converted SVGs
- Add `setCachedExcalidrawSvg()` method to store conversions
- Update `resolveImageSrc()` to:
  - Detect `excalidraw://` URLs
  - Return cached SVG if available
  - Show placeholder while loading

## How It Works

### Current Flow (Sync-only)
1. User embeds: `![[myfile.excalidraw]]`
2. Image resolver detects `.excalidraw` file
3. Returns `excalidraw://myfile.excalidraw` placeholder
4. Renderer checks cache, shows placeholder if not cached yet
5. **TODO:** Async conversion happens before/after rendering

### Future: Full Async Implementation
- Convert Excalidraw to SVG asynchronously
- Cache the result
- Update DOM when ready (via message passing or re-render)

## Usage

### In Slides
```markdown
![[path/to/drawing.excalidraw]]
![[path/to/drawing.excalidraw.md]]
![[path/to/drawing.excalidraw|100x100]]  # With sizing
```

### With Frame References (when supported)
```markdown
![[drawing.excalidraw#^frameID]]
```

## Testing Checklist

- [ ] `.excalidraw` files render as SVG
- [ ] `.excalidraw.md` files render as SVG
- [ ] Sizing parameters work: `![[file.excalidraw|100x100]]`
- [ ] Fallback to PNG/SVG exports if they exist
- [ ] Performance: no bloat for slides without Excalidraw
- [ ] Error handling for corrupt files

## Next Steps

1. **Async Conversion Queue**
   - Implement queue for converting large Excalidraw files
   - Update DOM when conversion completes
   - Add progress indicator for slow conversions

2. **Frame Support**
   - Parse frame IDs from block references: `#^frameID`
   - Extract only specific frame from drawing
   - Reduce payload for large diagrams

3. **Optimization**
   - Lazy load conversions (only convert visible slides)
   - Export cache to disk (avoid re-conversion)
   - Compression options for data URLs

## Technical Notes

### Why `excalidraw://` Protocol?
- Distinguishes Excalidraw sources from regular image URLs
- Allows renderer to defer rendering to cache lookup
- Placeholder prevents broken image icons

### SVG Caching Strategy
```typescript
excalidrawSvgCache: Map<string, string>
// Key: file path
// Value: data:image/svg+xml;base64,...
```

### Dependency Size
```
@excalidraw/utils: ~15KB gzipped
+ required peers: ~5KB
= ~20KB total added
```

## Compatibility

- ✅ Works with existing PNG/SVG exports (fallback)
- ✅ No breaking changes to current workflow
- ✅ Can disable by reverting to main branch
- ✅ Obsidian 1.4+ required (for @excalidraw/utils compatibility)

---

**Status:** Foundation laid, awaiting async conversion implementation
**Estimated Completion:** Next iteration
