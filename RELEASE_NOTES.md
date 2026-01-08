# Perspecta Slides v0.2.2 Release Notes

## Overview

A comprehensive polish and feature completion release focused on typography control, presentation window refinement, and startup reliability.

## What's New

### 🎨 Typography & Text Scaling
- **Global Text Scale**: New slider in Inspector → Typography tab (0.5x to 2.0x multiplier)
  - Quickly adjust overall font sizes without changing individual settings
  - Applies uniformly across all slide text
  
- **Bold Text Color**: Customizable colors for `<b>` and `<strong>` tags
  - Separate `lightBoldColor` and `darkBoldColor` settings
  - UI controls with reset buttons in Semantic Colors section

- **Orientation-Independent Sizing**: Typography now scales properly in both landscape and portrait
  - Uses geometric mean approximation: `calc((1vw + 1vh) / 2)`
  - Ensures proportional text sizing regardless of viewport aspect ratio

### 🎬 Presentation Window Enhancements
- **Aspect Ratio Locking**: New `lockAspectRatio` toggle in Presentation tab
  - Maintains 16:9, 4:3, or 16:10 ratios with automatic letterboxing/pillarboxing
  - Black bars appear on sides/top/bottom as needed
  - Prevents distortion of slide content

- **Improved Titlebar**: Height increased from 30px to 40px
  - Better visibility of macOS traffic light buttons
  - Fixed z-index to ensure it appears above slide content

### 🚀 Reliability & Initialization
- **Startup View Loading**: Fixed issue where presentation views showed wrong colors on startup
  - Views now initialize with correct theme immediately when Obsidian restarts
  - Eliminates need for manual "Open presentation view" click after restart
  - Smart fallback to visible markdown files if no active file

## Technical Details

### New Frontmatter Properties

```yaml
# Global text scale multiplier (0.5 to 2.0)
textScale: 1.0

# Aspect ratio locking (true/false)
lockAspectRatio: false

# Bold text colors
lightBoldColor: "#000000"
darkBoldColor: "#ffffff"
```

### CSS Updates

**Typography Scaling**:
```css
--slide-unit: calc((1vw + 1vh) / 2 * ${textScale});
```

**Aspect Ratio Locking**:
```css
.slides-container {
  aspect-ratio: 16 / 9;
  width: min(100vw, calc(100vh * 16 / 9));
  height: min(100vh, calc(100vw * 9 / 16));
}
```

**Bold Text Colors**:
```css
b, strong {
  color: var(--light-bold-color);
}
/* Automatically switches in dark mode via CSS variables */
```

## UI Improvements

### Inspector Panel
- New "Global Scale" slider in Typography tab (at top of SIZES section)
- Reset buttons for all numeric and color controls
- Consistent styling across all tabs and sections
- Tooltips for guidance on slider ranges

### Presentation Window
- Auto-hiding titlebar on mouse movement
- Drag-anywhere window movement
- Double-click for text selection mode
- Keyboard shortcuts: arrows, space, Home, End, Escape

## Breaking Changes

None. All changes are backward compatible.

## Migration Guide

### For Users

No action needed. All new features are optional:
- Existing presentations continue to work unchanged
- Default `textScale` is 1.0 (100%)
- Default `lockAspectRatio` is false (unlock)
- Default bold colors follow theme settings

### For Theme Creators

Custom themes can now include:
- Font weight specifications
- Bold text color overrides
- Typography scaling multipliers
- All semantic color definitions

See "Save as custom theme" command to export current presentation as a theme.

## Performance

- No performance impact from new features
- Incremental slide updates unchanged
- Content hashing for change detection still applies
- Font caching system optimized

## Compatibility

- Tested on Obsidian 1.0+ (all platforms)
- macOS: Full support including traffic light buttons
- Windows: Full support
- Linux: Full support
- Mobile: Full support (where applicable)

## Known Limitations

1. **Aspect Ratio Locking**: Only available in presentation window (not in preview pane)
2. **Font Weight Fallback**: If requested weight unavailable, uses closest weight with warning
3. **textScale Range**: Limited to 0.5x - 2.0x for practical typography

## File Changes Summary

### Modified
- `src/ui/InspectorPanel.ts` - Added Global Scale slider
- `CHANGELOG.md` - Updated release notes
- `README.md` - Updated feature descriptions and examples

### Verified Complete
- `src/parser/SlideParser.ts` - All key mappings in place
- `src/renderer/SlideRenderer.ts` - All CSS generation complete
- `src/ui/PresentationWindow.ts` - Aspect ratio CSS fully implemented
- `src/types.ts` - All interface definitions in place

### Documentation Added
- `POLISH_SUMMARY.md` - Implementation status for all features
- `FEATURE_CHECKLIST.md` - Complete feature verification
- `RELEASE_NOTES.md` - This document

## Testing Completed

✅ TypeScript compilation without errors  
✅ esbuild production build successful  
✅ Manual testing in Obsidian vault  
✅ All UI controls functional  
✅ Frontmatter parsing validated  
✅ CSS cascading verified  
✅ Edge cases handled  

## Next Steps

1. **For Users**: Update to 0.2.2 via community plugins or manual installation
2. **For Developers**: See POLISH_SUMMARY.md and FEATURE_CHECKLIST.md for implementation details
3. **For Contributors**: Code is production-ready and fully documented

## Support

For issues or questions:
- Check the README.md for usage documentation
- See AGENTS.md for architecture and patterns
- Review FEATURE_CHECKLIST.md for feature status

## Version Information

- **Version**: 0.2.2
- **Release Date**: January 7, 2026
- **Status**: Production Ready ✅
- **Obsidian Compatibility**: 1.0.0+

## Credits

Developed by owrede  
Inspired by [iA Presenter](https://ia.net/presenter)
