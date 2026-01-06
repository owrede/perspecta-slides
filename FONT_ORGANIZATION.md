# Font Organization

This document describes how fonts are organized in the Perspecta Slides plugin.

## Folder Structure

Fonts are now organized in font-specific subfolders within the cache folder for better organization and easier management.

### Before
```
perspecta-fonts/
├── Barlow-400-normal.woff2
├── Barlow-700-normal.woff2
├── Barlow-400-italic.woff2
├── Barlow-700-italic.woff2
├── OpenSans-400-normal.woff2
├── OpenSans-700-normal.woff2
└── ...
```

### After
```
perspecta-fonts/
├── Barlow/
│   ├── Barlow-400-normal.woff2
│   ├── Barlow-700-normal.woff2
│   ├── Barlow-400-italic.woff2
│   └── Barlow-700-italic.woff2
├── Open-Sans/
│   ├── Open-Sans-400-normal.woff2
│   ├── Open-Sans-700-normal.woff2
│   └── ...
└── ...
```

## Benefits

1. **Better Organization** - All files for a single font are grouped together
2. **Easier Cleanup** - Delete a font folder to completely remove a font
3. **Scale Better** - Works better when managing many fonts
4. **Clearer Structure** - Easier to understand the cache at a glance
5. **Font Name Safety** - Font names with spaces are converted to hyphens (e.g., "Open Sans" → "Open-Sans")

## How It Works

### Google Fonts

When you download a font from Google Fonts:

1. Font name is parsed from the URL (e.g., "Barlow" from `fonts.google.com/specimen/Barlow`)
2. Font-specific subfolder is created: `perspecta-fonts/Barlow/`
3. All font files are downloaded into: `perspecta-fonts/Barlow/Barlow-{weight}-{style}.{format}`

### Local Fonts

When you cache a local font folder:

1. Font name is either provided or auto-detected from filenames
2. Font-specific subfolder is created: `perspecta-fonts/{FontName}/`
3. All font files are copied into: `perspecta-fonts/{FontName}/{FontName}-{weight}-{style}.{format}`

## Font File Naming

Font files within each subfolder follow this naming convention:

```
{FontName}-{weight}-{style}.{format}
```

- **FontName**: Font family name (spaces replaced with hyphens)
- **Weight**: Font weight (100, 200, 300, 400, 500, 600, 700, 800, 900)
- **Style**: Either "normal" or "italic"
- **Format**: File format (woff2, woff, ttf, otf)

### Examples

- `Barlow-400-normal.woff2` - Regular Barlow in WOFF2 format
- `Open-Sans-700-italic.woff2` - Bold italic Open Sans in WOFF2 format
- `Noto-Sans-CJK-500-normal.ttf` - Medium Noto Sans CJK in TrueType format

## Managing Fonts

### Add a Font

Fonts are added through **Settings → Fonts** by providing a Google Fonts URL:

```
https://fonts.google.com/specimen/Barlow
```

The plugin will:
1. Download the font
2. Create `perspecta-fonts/Barlow/`
3. Store all font files inside this folder
4. Update the plugin cache

### Delete a Font

To delete a cached font:

1. Go to **Settings → Fonts**
2. Find the font in the list
3. Click the delete button (trash icon)
4. The entire font folder is deleted (e.g., `perspecta-fonts/Barlow/`)

### Inspect Fonts

You can manually inspect cached fonts in your vault:

1. Open **File Explorer** in Obsidian
2. Navigate to the `perspecta-fonts/` folder
3. Each subfolder contains one font with all its variants

## Storage Information

When a font is cached, its metadata is stored in the plugin's data:

```json
{
  "fonts": {
    "Barlow": {
      "name": "Barlow",
      "displayName": "Barlow",
      "sourceUrl": "https://fonts.google.com/specimen/Barlow",
      "weights": [400, 700],
      "styles": ["normal", "italic"],
      "files": [
        {
          "weight": 400,
          "style": "normal",
          "localPath": "perspecta-fonts/Barlow/Barlow-400-normal.woff2",
          "format": "woff2"
        },
        ...
      ],
      "cachedAt": 1704369600000
    }
  }
}
```

## Migration Notes

If you have fonts cached from an older version of Perspecta Slides:

- **Old fonts still work** - The plugin can read fonts from both the old flat structure and new subfolder structure
- **New fonts use subfolders** - Any fonts downloaded after this update will use the new folder structure
- **Manual migration** - You can optionally reorganize old fonts into subfolders:
  1. Create a subfolder with the font name: `perspecta-fonts/{FontName}/`
  2. Move all files for that font into the subfolder
  3. Update the plugin cache by reloading the plugin

## Implementation Details

### Code Changes

The `FontManager` class was updated to:

1. Create font-specific subfolders when downloading Google Fonts
2. Create font-specific subfolders when caching local fonts
3. Update path generation to use subfolder structure
4. Maintain backward compatibility with old flat structure

### Methods

**ensureFontFolder(folderPath: string)**
- Creates a font-specific subfolder if it doesn't exist
- Safely handles race conditions (folder already exists)
- Used during font download and local font caching

**parseCssAndDownloadFonts(css: string, fontName: string)**
- Updated to create font subfolder before downloading
- Uses subfolder path for all font file downloads
- Updated to use `ensureFontFolder()` instead of relying on generic folder creation

**cacheLocalFont(folderPath: string, fontName?: string)**
- Updated to create font subfolder before copying files
- Uses subfolder path for all font file copies

## Troubleshooting

### Font files appear in wrong location

If you see font files directly in `perspecta-fonts/` without a subfolder:
- The font was likely cached with an older version
- Delete and re-download the font to apply new organization
- Or manually create a subfolder and reorganize files

### Font not found after update

If a font cached before this update stops working:
- The plugin supports both old and new locations
- Check that the `localPath` in the font metadata is correct
- Try deleting and re-adding the font

### Storage space concerns

Font-specific subfolders don't increase storage space - they just organize existing files better. Storage usage remains the same.

## See Also

- [Font Manager Documentation](src/utils/FontManager.ts)
- [Settings Tab - Fonts](src/ui/SettingsTab.ts)
- [Types - Font Interfaces](src/types.ts)
