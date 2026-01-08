# Startup Theme Loading Issue

## The Problem You're Experiencing

When you open Obsidian with previously open views (slide navigator, presentation preview, inspector), the slides display with **incorrect font colors** (all black instead of the theme-specified colors). Clicking "Open presentation view" fixes this immediately.

## Root Cause Analysis

The issue is a **timing and initialization order problem**:

### 1. **Views are Restored Before Content Updates Trigger**

When Obsidian restores your workspace:
- The slides navigator, presentation view, and inspector are restored as empty shells
- No markdown file is automatically active/focused
- The views exist but have no presentation data

### 2. **`updateSidebars()` Never Gets Called**

The sidebars are populated by `updateSidebars()`, which is triggered by:
1. `file-open` event (user opens a file)
2. `editor-change` event (user edits the file)
3. `active-leaf-change` event (user switches focus)

**But during startup, if the markdown file is visible but NOT the active/focused leaf**, none of these events fire for that file.

### 3. **No Context = No Theme**

When `updateSidebarsWithPresentation()` is called, it:
- Parses the presentation frontmatter
- Loads the theme with `getThemeByName()`
- Passes the theme to the views: `view.setPresentation(presentation, theme)`

If this method is never called, **the theme is never set on the views**, so they render with default CSS (black text).

### 4. **Why "Open Presentation View" Fixes It**

The ribbon button calls `openPresentationView()`, which explicitly calls:
```typescript
updateSidebarsWithContext(file, true)  // Force first slide context
```

This triggers the full initialization chain, loading the theme and updating all views.

## Current Initialization Flow (main.ts: lines 149-381)

```
onload()
  → registerView() for each view type [lines 200-213]
  → registerEvent('file-open') → calls updateSidebars() [line 315]
  → registerEvent('editor-change') → calls debounceUpdateSidebarsWithContent() [line 326]
  → registerEvent('active-leaf-change') [line 334-342]
      → calls setupCursorTracking()
      → updates lastUsedSlideDocument
      → calls updateInspectorFocus()
  → setupCursorTracking() [line 380]
```

**Missing:** No explicit initialization of visible/restored views after layout is ready.

## Solution: Add Layout-Ready Initialization

After `onLayoutReady()` (which completes around line 178), we need to:

1. **Detect if there's a visible/focused markdown file** with restored views
2. **Call `updateSidebarsWithContext(file, true)`** to force initialization with the first slide
3. **Ensure this happens after themes are loaded** (which already happens in onLayoutReady)

### Implementation Approach

```typescript
// After themeLoader.loadThemes() completes (line 176)
this.app.workspace.onLayoutReady(async () => {
  if (this.themeLoader) {
    await this.themeLoader.loadThemes();
  }
  
  // NEW: Initialize views if there's a visible markdown file
  const activeFile = this.app.workspace.getActiveFile();
  if (activeFile && activeFile.extension === 'md') {
    // There's an active file - initialize with its content
    await this.updateSidebarsWithContext(activeFile, true);
  } else {
    // Check if any views are already open (restored from session)
    const hasRestoredViews = 
      this.app.workspace.getLeavesOfType(THUMBNAIL_VIEW_TYPE).length > 0 ||
      this.app.workspace.getLeavesOfType(INSPECTOR_VIEW_TYPE).length > 0 ||
      this.app.workspace.getLeavesOfType(PRESENTATION_VIEW_TYPE).length > 0;
    
    if (hasRestoredViews) {
      // Find any visible markdown file to initialize with
      const visibleFile = this.findVisibleMarkdownFile();
      if (visibleFile) {
        await this.updateSidebarsWithContext(visibleFile, true);
      }
    }
  }
});
```

## Why This Works

1. **Happens after theme loading**: onLayoutReady waits for the vault to be indexed and themes to load
2. **Initializes with first slide**: `forceFirstSlide: true` ensures theme colors load (not dependent on cursor position)
3. **Non-breaking**: Only triggers if views exist and are empty
4. **Matches user expectation**: Views show correct colors immediately on startup

## User Experience Impact

| Scenario | Before | After |
|----------|--------|-------|
| Open Obsidian with restored views (visible but not focused) | Theme colors missing until "Open presentation view" is clicked | Theme colors correct immediately |
| Open Obsidian with focused markdown file | Works correctly | Works correctly (unchanged) |
| Open Obsidian with no markdown files | Views empty (correct) | Views empty (correct, unchanged) |

## Files to Modify

- **main.ts**: Add initialization logic in `onLayoutReady()` callback (line 174-178)

## Notes

- The fix leverages existing `updateSidebarsWithContext()` method (line 846)
- Uses existing `findVisibleMarkdownFile()` method for fallback detection
- No new state needed, no breaking changes to existing event handlers
- Minimal performance impact (single layout-ready scan + one initialization)
