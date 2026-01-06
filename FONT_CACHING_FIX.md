# Font Caching Fix

## Issue

When adding a local font (.otf, .ttf, etc.) via Settings → Fonts, the font would be cached successfully but would not appear in:
1. The "Downloaded Fonts" list in settings
2. The font selection dropdown in the Inspector panel (Typography tab)

## Root Cause

The FontManager maintains an in-memory cache (`this.cache`) that is initialized from the plugin settings on plugin load. When a new font is added:

1. The font is successfully cached to disk and added to `this.cache.fonts`
2. The `saveCallback` is called, which updates the plugin's settings
3. But the in-memory cache in the FontManager instance is not automatically reloaded from the updated settings
4. When the Settings UI re-renders or the Inspector tries to display fonts, it calls `getAllCachedFonts()` which returns data from the stale in-memory cache

Additionally, the Inspector panel holds a reference to the FontManager but doesn't know when to refresh its display after a new font is added.

## Solution

### 1. Added `reloadCache()` Method

Added a new method to FontManager to explicitly reload the in-memory cache from updated settings:

```typescript
reloadCache(cacheData: FontCache | null): void {
  this.cache = cacheData || { fonts: {} };
}
```

This allows the Settings UI to sync the in-memory cache with the persisted settings after a font is added.

### 2. Cache Reload After Font Addition

Updated both `cacheGoogleFont()` and `cacheLocalFont()` handlers in SettingsTab to:
1. Call `fontManager.reloadCache()` with the updated settings cache
2. Refresh all open Inspector panels to re-render with the new font list

**Before:**
```typescript
const result = await fontManager.cacheLocalFont(path);
if (result) {
  this.display(); // Just re-render settings
}
```

**After:**
```typescript
const result = await fontManager.cacheLocalFont(path);
if (result) {
  fontManager.reloadCache(this.plugin.settings.fontCache || { fonts: {} });
  
  // Refresh open Inspector panels
  const inspectorLeaves = this.app.workspace.getLeavesOfType('perspecta-inspector');
  for (const leaf of inspectorLeaves) {
    (leaf.view as any)?.render?.();
  }
  
  this.display(); // Re-render settings
}
```

### 3. Improved Logging

Added debug logging to FontManager's `cacheLocalFont()` to help diagnose font file discovery:
- Log all files found in the folder
- Log the number of font files found
- Log the auto-detected font name and the source filename
- Log successful caching with file count

This makes it easier to debug font discovery issues in the future.

### 4. Fixed Font Name Auto-detection Regex

Updated the regex for auto-detecting font names from filenames:

**Before:**
```typescript
const match = firstFile.basename.match(/^([^-]+)/);
```

**After:**
```typescript
const match = firstFile.basename.match(/^([^-.]+)/);
```

This properly handles filenames like:
- `Clan.otf` → "Clan" ✓
- `Clan-Bold.otf` → "Clan" ✓
- `ClanoT-Bold.otf` → "ClanoT" ✓

## Changes Made

### Modified Files
1. **src/utils/FontManager.ts**
   - Added `reloadCache()` method
   - Improved `cacheLocalFont()` logging for font file discovery
   - Fixed font name auto-detection regex to handle files without dashes

2. **src/ui/SettingsTab.ts**
   - Added `fontManager.reloadCache()` call after `cacheGoogleFont()`
   - Added `fontManager.reloadCache()` call after `cacheLocalFont()`
   - Added Inspector panel refresh after font addition for both Google and local fonts
   - Inspector renders immediately when new fonts are added

## Testing

To test the fix:

1. Go to **Settings → Fonts**
2. Scroll to "Add Local Font"
3. Enter the path to a folder containing .otf, .ttf, or other font files
4. Click "Add Local Font"
5. **Expected:**
   - The font immediately appears in the "Downloaded Fonts" list
   - If the Inspector panel is open, the font immediately appears in the Typography font dropdown
   - If multiple Inspector panels are open, all refresh

## Example Flow

Adding font "Clan" from `/fonts/clan/`:

1. User enters `/fonts/clan/` in the "Folder path" field
2. User clicks "Add Local Font"
3. `cacheLocalFont()` is called:
   - Finds `Clan.otf` in the folder
   - Auto-detects font name as "Clan"
   - Creates `perspecta-fonts/Clan/` subfolder
   - Copies `Clan.otf` to `perspecta-fonts/Clan/Clan-400-normal.otf`
   - Saves font metadata to plugin settings
4. Back in SettingsTab:
   - `fontManager.reloadCache()` syncs the in-memory cache with updated settings
   - Inspector panels are refreshed via `render()`
   - Settings display is refreshed via `this.display()`
5. Result:
   - Font appears in "Downloaded Fonts" list
   - Font appears in all open Inspector font dropdowns
   - Success notice is shown

## Future Improvements

Potential enhancements:

1. **Font List Live Update** - Add a callback system to notify all views when fonts change, rather than manually calling `render()`
2. **Font Validation** - Validate font files before copying to catch corrupted fonts early
3. **Font Preview** - Show font preview in the "Downloaded Fonts" list
4. **Bulk Font Import** - Allow importing multiple fonts at once

## See Also

- [Font Organization](FONT_ORGANIZATION.md)
- [FontManager Source](src/utils/FontManager.ts)
- [Settings Tab Source](src/ui/SettingsTab.ts)
- [Inspector Panel Source](src/ui/InspectorPanel.ts)
