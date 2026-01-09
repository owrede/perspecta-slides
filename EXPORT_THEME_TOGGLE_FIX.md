# Export Theme Toggle Fix

## Problem
The HTML export functionality had a broken theme toggle that prevented light/dark mode from working correctly in exported presentations.

## Root Causes

### 1. Missing JavaScript Variable Declaration
The JavaScript toggle function referenced `document.documentElement` but didn't declare it in the IIFE scope. This caused the toggle to fail silently.

**Fix**: Added `const html = document.documentElement;` at the start of the IIFE in `getExportJS()`.

### 2. CSS Variables Not Cascading to iframes
iframes have their own separate document context, so CSS variables defined in the main document's `:root` don't inherit. The exported slides are rendered inside iframes with `srcdoc`, so they couldn't access the main document's CSS variables.

**Fix**: Injected full CSS variable definitions directly into each iframe's HTML via `injectThemeCSSVariables()`.

### 3. Missing CSS Variable Mappings
The iframe stylesheets only defined specific variables like `--dark-background`, `--dark-body-text`, etc., but had no CSS rules that mapped generic variable names (like `--background`, `--body-text`) based on the `html.light`/`html.dark` class.

**Fix**: Added two-tier CSS variable system:
- `:root` defines raw colors: `--light-background`, `--dark-background`, `--light-h1-color`, `--dark-h1-color`, etc.
- `:root` also defines defaults for generic names mapped to dark mode: `--background: var(--dark-background)`, etc.
- `html.light` remaps generic names to light colors: `--background: var(--light-background)`, etc.

This allows the JavaScript toggle to simply add/remove the `html.light` class, and CSS variable cascading automatically updates all generic variables.

### 4. Test Page Variable Mismatch  
The test page defaulted `:root` CSS variables to **light mode** values, but the page styling started in **dark mode**. This created a visual mismatch where the "Dynamic" column (using generic CSS variables) showed light colors even though the page appeared dark.

**Fix**: Changed test page `:root` defaults to reference **dark mode** variables by default, matching the initial page styling. This ensures the "Dynamic" column matches either the "Dark" or "Light" columns depending on the current mode.

## Architecture

### CSS Variable Strategy
```
:root (defaults)
├── --light-background, --dark-background, etc. (raw definitions)
├── --background: var(--dark-background) (default to dark)
├── --h1-color: var(--dark-h1-color)
└── ... (16 generic variables all defaulting to dark)

html.light (overrides)
├── --background: var(--light-background) (switch to light)
├── --h1-color: var(--light-h1-color)
└── ... (16 generic variables remapped to light)
```

### JavaScript Toggle Flow
1. User clicks theme toggle button
2. JavaScript adds/removes `html.light` class on iframe document element
3. CSS cascade automatically remaps all generic variables
4. No need to update multiple variables - single class change triggers all updates

### Layered CSS Approach
Two complementary stylesheets are injected:

1. **injectThemeCSSVariables()** - Variable definitions and mappings
   - Defines all raw color variables
   - Maps generic names based on `html.light`/`html.dark` class
   - Lightweight, focused on variable management

2. **injectThemeToggleCSS()** - Element-level styling with `!important`
   - Applies colors to all HTML elements (p, h1-h6, a, table, code, etc.)
   - Uses `!important` to override inline styles
   - Ensures toggle works reliably on all content
   - Handles special cases like per-slide dark/light overrides

## Files Changed
- `src/utils/ExportService.ts`
  - `injectThemeCSSVariables()` - Added CSS variable mappings
  - `generateThemeTestHTML()` - Fixed default to dark mode variables
  - Updated method comments to explain the new architecture

## Testing
The test page (`export-theme-test` command in Obsidian) now correctly shows:
- **Light column** - Light mode colors (fixed values)
- **Dynamic column** - Current colors from CSS variables (matches active mode)
- **Dark column** - Dark mode colors (fixed values)

Both "Dynamic" and the active mode column should match perfectly when toggling between dark and light modes.

## Performance Notes
- Minimal CSS size increase (variable mappings are compact)
- Single class toggle is performant
- CSS cascade handles the color updates efficiently
- No JavaScript color updates needed per-element
