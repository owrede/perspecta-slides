# Theme Syncing with Obsidian Sync

## Overview

Custom themes created with Perspecta Slides can be synced across devices using Obsidian Sync. However, because themes can contain binary files (fonts, images), proper configuration is needed to ensure complete synchronization.

## Theme Folder Structure

A custom theme folder (`perspecta-themes/theme-name/`) contains:

```
perspecta-themes/
└── my-theme/
    ├── theme.json          # Theme configuration (TEXT)
    ├── theme.css           # Theme styles (TEXT)
    ├── demo.md             # Sample presentation (TEXT)
    ├── fonts/              # Font files (BINARY)
    │   ├── font1.woff2
    │   └── font2.ttf
    └── images/             # Theme images (BINARY)
        ├── logo.png
        └── bg.webp
```

## Obsidian Sync Configuration

### Option 1: Full Sync (Recommended for Small Themes)

If your theme is small (< 50MB total), sync everything normally:
- No special configuration needed
- Themes will sync automatically

### Option 2: Selective Sync (For Large Themes)

For themes with many/large fonts or images, you can selectively sync:

**In Obsidian Settings → Sync → Excluded folders/files:**
- Exclude: `perspecta-themes/*/fonts/` (excludes all font files)
- Exclude: `perspecta-themes/*/images/` (excludes all image files)

**Then manually sync on primary device:**
1. Create the theme normally with all assets
2. Export/backup the complete theme folder
3. On secondary devices, manually copy the theme folder with all assets

### Option 3: Asset-Only Sync

If you want to keep themes in sync but manage fonts/images manually:

**Exclude from Obsidian Sync:**
- `perspecta-themes/*/fonts/`
- `perspecta-themes/*/images/`

**For teams/multi-device setups:**
- Use a shared cloud service (Google Drive, OneDrive, etc.) for theme assets
- Keep theme.json and theme.css synced via Obsidian Sync
- Reference fonts from your Local Fonts folder instead

## Troubleshooting Sync Issues

### Theme appears incomplete on another device

**Symptoms:**
- Colors/CSS applied correctly
- Fonts missing (displays system default)
- Images not showing in preview

**Solution:**
1. Check which files are missing in secondary device
2. **Full Sync Method:**
   - Disable Obsidian Sync temporarily
   - Manually copy entire theme folder from primary device
   - Re-enable Obsidian Sync
3. **Partial Sync Method:**
   - Confirm `perspecta-themes/` folder is NOT in excluded folders
   - Restart Obsidian
   - Check Sync status in settings (may take time for large files)

### Fonts not loading

**Check:**
1. Are font files in `perspecta-themes/theme-name/fonts/`?
2. Is the fonts folder being synced?
3. Try using system fonts instead of custom fonts for multi-device compatibility

### Images showing as broken

**Check:**
1. Are image files in `perspecta-themes/theme-name/images/`?
2. Is the images folder being synced?
3. Verify image paths in `theme.json` use relative paths (`images/filename.png`)

## Best Practices

### For Multi-Device Syncing

1. **Use System Fonts** when possible (more compatible)
   - Avoid custom Google Fonts if syncing is critical
   - Or: Use "Add Local Font" to store fonts in vault

2. **Optimize Image Sizes**
   - Keep images under 1MB each (compress PNGs/JPEGs)
   - Use WebP format for smaller file sizes
   - Avoid high-resolution images if they're just decorative

3. **Test Sync**
   - After creating a theme, verify it syncs:
     - Check Settings → Sync → Synced files
     - Look for `perspecta-themes/your-theme/` folder
     - Verify all files are listed

4. **Backup Important Themes**
   - Export themes to external storage
   - Version control themes in git/GitHub
   - Create snapshots before major updates

### For Theme Development

When creating themes:
- Keep theme.json configuration clean (no unnecessary data)
- Use relative paths for all assets (`images/logo.png` not `/images/logo.png`)
- Test on all devices BEFORE committing to production

## Sync Status Reference

**What ALWAYS syncs:**
- `theme.json` (text configuration)
- `theme.css` (text styles)
- `demo.md` (markdown file)

**What may have sync issues:**
- Font files (`.woff2`, `.ttf`, `.otf`) - large binary files
- Images (`.png`, `.jpg`, `.webp`) - binary files
- High-resolution assets

## Obsidian Sync Limitations

- Binary file sync is slower than text file sync
- Very large files (>50MB) may not sync reliably
- Sync speed depends on internet connection
- Deleted files sync with slight delay

## Getting Help

If theme sync issues persist:

1. **Check Obsidian Community:**
   - Search for "Obsidian Sync" + your issue
   - Ask in Obsidian forums

2. **Verify Theme Integrity:**
   - Run Obsidian's "Check vault health" (Settings → Data)
   - Look for corruption messages

3. **Manual Workaround:**
   - Keep primary device as "source of truth"
   - Periodically export complete theme folder
   - Share via cloud storage to other devices

## Technical Notes

- Perspecta Slides uses Obsidian vault APIs for file operations
- All theme files are stored in the vault (no external services)
- Obsidian Sync is handled by Obsidian, not by the plugin
- Binary files may be deduplicated by Obsidian Sync for efficiency
