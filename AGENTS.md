# Perspecta Slides - Agent Instructions

## Build & Deploy

After making changes, always:

1. Build and copy to test vault:
   ```bash
   npm run build && npm run copy
   ```

## Commands

- `npm run dev` - Development build + copy to test vault
- `npm run build` - Production build (runs tsc + esbuild, no copy - used by CI)
- `npm run copy` - Copy built files to local test vault

## Project Structure

- `main.ts` - Plugin entry point
- `src/parser/` - Markdown to slide parsing
- `src/renderer/` - Slide HTML rendering
- `src/ui/` - Obsidian views and windows:
  - `ThumbnailNavigator.ts` - Slide thumbnails panel
  - `InspectorPanel.ts` - Presentation settings editor
  - `PresentationView.ts` - Slide editor view
  - `PresentationWindow.ts` - Fullscreen presentation external window
  - `PresenterWindow.ts` - Speaker view with speaker notes (Electron window)
- `src/themes/` - Built-in themes (zurich, kyoto, berlin, minimal)
- `src/types.ts` - TypeScript interfaces

## Important Patterns

### Initialization Context (main.ts)

Intelligent context initialization that tracks documents only when actually used:

1. **Force First Slide for Initialization**
   - `updateSidebarsWithContext(file, true)` - Forces slide 0 as context
   - Used when opening presentation view or toggling navigator/inspector
   - Ensures theme and frontmatter settings load immediately

2. **Multi-Level Fallback (Without Artificial Tracking)**
   - Priority: Active file → Visible file → Last used file
   - `findVisibleMarkdownFile()` - Temporary search, NOT stored as "last used"
   - `lastUsedSlideDocument` - Only stores files that were actually used
   - Ensures views initialize even without active focus

3. **Track Only When Actually Used**
   - `lastUsedSlideDocument` set ONLY when:
     - File is opened with `openPresentationView()`
     - File receives focus (`active-leaf-change`)
     - File is edited (cursor position changes)
   - NOT set on startup or when visible file is found for fallback
   - Maintains accurate usage history

4. **Normal Cursor-Based Selection**
   - `updateSidebarsWithContext(file, false)` - Uses cursor position
   - Used for normal editing and updates
   - Updates `lastUsedSlideDocument` on focus change
   - Preserves existing behavior for cursor-driven slide selection

See `INITIALIZATION_CONTEXT_FIX.md` for detailed explanation of the initialization system.

### Aspect Ratio Locking in Presentation Window (PresentationWindow.ts)

When `lockAspectRatio: true` is set in frontmatter:

1. **Calculate Optimal Size**
   - Use CSS `aspect-ratio` property to enforce ratio
   - Calculate dimensions using: `min(viewport_size, other_dimension * aspect_ratio)`
   - Ensures slides fit within window without distortion

2. **Handle Letterboxing/Pillarboxing**
   - `.presentation-container` has black background (#000)
   - Flexbox centering centers the slide container
   - Black borders appear automatically where needed

3. **Key CSS Pattern**
   ```css
   .slides-container {
     aspect-ratio: W / H;  /* 16 / 9, 4 / 3, etc. */
     width: min(100vw, calc(100vh * W / H));
     height: min(100vh, calc(100vw * H / W));
   }
   ```

4. **Support All Ratios**
   - 16:9, 4:3, 16:10 are calculated from frontmatter
   - 'auto' aspect ratio skips locking (no CSS applied)

See `ASPECT_RATIO_LOCK_FIX.md` for detailed explanation.

### Startup Theme Loading (main.ts)

When Obsidian restores workspace with previously open views (navigator, preview, inspector):

1. **Problem**: Views are restored before file focus is established, so theme data isn't loaded
2. **Solution**: In `onLayoutReady()` after theme loading completes
   - Check if there's an active focused file → initialize with `updateSidebarsWithContext(file, true)`
   - Otherwise check if views are open → find visible markdown file and initialize
   - Forces first slide context to ensure theme colors load immediately
3. **Result**: Views display correct colors/typography on startup without requiring manual "Open presentation view" click

See `STARTUP_THEME_LOADING_ISSUE.md` for detailed explanation.

### Presenter View (PresenterWindow.ts)

External Electron window for speaker view with three layout zones:

1. **Toolbar** (top 50px)
   - Mode toggle (text focus / slide focus)
   - Timer with play/pause/reset controls
   - Launch presentation button

2. **Main Content** (flexible layout)
   - **Slide thumbnail** (collapsible, hides on small windows)
   - **Text display area** (center) - Large paragraph text with colored highlight
   - **Speaker notes** (bottom-right, hides on very small windows)

3. **Navigation**
   - **↑↓ (Up/Down arrows)** - Navigate between slides
   - **←→ (Left/Right arrows)** - Navigate paragraphs (across content + notes)
   - Paragraphs extracted from `slide.rawContent` (split by markdown blocks) and `slide.speakerNotes` (array)

4. **Responsive Design**
   - Wide (>1200px): All three zones visible
   - Medium: Thumbnail hidden
   - Narrow (<800px): Only text area visible
   - Text focus mode: Always maximizes text area

See `PRESENTER_VIEW_IMPLEMENTATION.md` for detailed explanation.
