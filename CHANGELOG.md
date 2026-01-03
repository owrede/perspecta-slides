# Changelog

All notable changes to Perspecta Slides will be documented in this file.

## [0.1.8] - 2026-01-03

- **New**: Support for 6 accent colors (Accent 1-6) with unified color pickers
- **New**: Support for dynamic background gradients in both light and dark modes
- **Themes**: Added 7 additional built-in themes (Garamond, LA, Milano, New York, Paris, San Francisco, Vancouver)
- **Fix**: Resolved issue where font colors were not applying to Helvetica and Swiss themes
- **Improved**: Theme-specific CSS classes correctly applied to presentation body for consistent typography
- **Improved**: Automatic selection of active appearance mode (Light/Dark) in Inspector panel
- **Improved**: Refactored all 12 built-in themes to use CSS variables for robust customization
- **Fix**: Corrected light/dark mode color mapping for Basel, Copenhagen, and Helvetica themes

## [0.1.7] - 2026-01-03

- **New**: `half-image` layout - vertical split with image on left or right (based on content order)
- **New**: `half-image-horizontal` layout - horizontal split with image on top or bottom
- **New**: Image position auto-detection: image first = image on left/top, text first = image on right/bottom
- **New**: Image metadata parsing - add properties on lines after images
- **New**: `size: cover | contain` - control how images fill their container
- **New**: `x:` and `y:` positioning - control image focal point (left/center/right, top/center/bottom, or %)
- **New**: `filter:` effects - darken, lighten, blur, grayscale, sepia
- **New**: `opacity:` control (0-100%)
- **Improved**: Half-image layouts now use edge-to-edge images with exact 50% splits
- **Improved**: Inspector panel now has 4 image layout buttons (Full, Caption, Half, Half horiz.)

## [0.1.6] - 2026-01-03

- **New**: Global font size offset setting (-50% to +50%) for scaling all text
- **New**: Content top offset setting (0-50%) to push column content down
- **New**: Reorganized Inspector tabs: Presentation, Design (theme/typography/colors), Slide (per-slide layout)
- **Improved**: Slide header now has proper margin-bottom spacing from headline

## [0.1.5] - 2026-01-03

- **Improved**: Presentation window now uses incremental updates - only redraws when displayed slide changes
- **Improved**: Editing a slide no longer causes presentation window to jump back to first slide
- **Improved**: Much smoother live updates while presenting - no flicker for unrelated edits
- **Changed**: Presentation window uses drag overlay for cleaner interaction
- **New**: Click+drag anywhere moves the window (default mode)
- **New**: Double-click enters text selection mode, Escape exits it
- **New**: Obsidian wiki-link image syntax (`![[image.png]]`) now supported
- **New**: Full-image layout fills entire slide with `object-fit: cover` (no letterboxing)
- **New**: Image metadata system (size, x, y positioning) for future enhancements
- **Fix**: Wiki-link images now resolve correctly using Obsidian vault paths
- **Technical**: Presentation window uses content hashing to detect changes

## [0.1.4] - 2026-01-03

- **New**: Frameless presentation window - clean, distraction-free presenting
- **New**: macOS traffic light buttons appear on hover and auto-hide after 3 seconds
- **New**: Window draggable by clicking any non-interactive area
- **New**: Double-click thumbnail in navigator to start presentation at that slide
- **New**: Click navigation in presentation (left third = back, right third = forward)
- **Improved**: ESC key behavior - exits fullscreen first, then closes window
- **Improved**: Keyboard navigation (arrows, space, PageUp/PageDown, Home/End)
- **Improved**: Presentation window opens at optimal 16:9 size for screen
- **Fix**: Keyboard events now work reliably in presentation window

## [0.1.3] - 2026-01-02

- **New**: Basel theme - Swiss serif typography with Noto Serif font
- **New**: Copenhagen theme - Nordic elegance with Albert Sans font and weight hierarchy
- **New**: Added 2 additional iA Presenter theme translations
- **Fix**: Fixed Berlin theme heading colors for proper light/dark mode compatibility
- **Fix**: Fixed Tokyo theme dark mode color contrast (white text on dark background)
- **Fix**: Fixed Zurich theme light/dark mode color definitions
- **Fix**: Corrected color variable bugs in multiple themes
- **Improved**: All built-in themes now have proper light/dark mode support
- **Improved**: Enhanced theme translation process from iA Presenter format
- **Themes**: Now includes 7 built-in themes (Zurich, Tokyo, Berlin, Minimal, Helvetica, Basel, Copenhagen)

## [0.1.2] - 2026-01-02

- **Major Fix**: Unified rendering pipeline for thumbnails and presentation preview
- **Major Fix**: Fixed theme application inconsistencies between contexts
- **Major Fix**: Implemented proper font scaling system with --slide-unit CSS variable
- **New**: Context-aware theme CSS generation (thumbnail vs preview vs export)
- **New**: Dynamic font scaling that adapts to container size
- **New**: Proper light/dark mode support for all themes
- **Fix**: Preview navigation now correctly updates current slide
- **Fix**: Speaker notes hidden from thumbnails and preview contexts
- **Fix**: Font sizes now proportional between thumbnails and preview
- **Fix**: Corrected color variable bugs in light/dark modes
- **Fix**: Tokyo theme gradient headings now display correctly
- **Fix**: Helvetica theme colors now work properly in both modes
- **Fix**: Removed conflicting slide-specific CSS from global styles
- **Improved**: Thumbnail text scaling now matches preview proportions
- **Improved**: All themes (Zurich, Tokyo, Berlin, Minimal, Helvetica) render consistently
- **Improved**: Better performance with iframe-based rendering
- **Technical**: Refactored SlideRenderer for context-dependent rendering
- **Technical**: Enhanced theme system with proper CSS cascade management

## [0.1.1] - 2026-01-02

- New: Tabbed settings interface with organized sections
- New: Changelog tab in settings showing version history
- New: GitHub Actions workflow for automated releases
- New: **Helvetica theme** - Classic typography focus with professional design
- Fix: Present/Presenter View buttons now use temp file approach for reliable browser launch
- Fix: Thumbnail iframes no longer cause console warnings
- Fix: Theme colors now properly apply to thumbnails and preview slides
- Fix: Removed hardcoded CSS fallbacks that were overriding theme variables
- Improved: Thumbnail Navigator redesigned with integrated SVG circle number badge
- Improved: Dynamic font sizing using --slide-unit CSS variable for responsive scaling
- Improved: PresentationView now uses iA Presenter container class pattern
- Improved: Theme system now properly applies colors to all slide elements

## [0.1.0] - 2026-01-01

- Initial release
- iA Presenter-compatible markdown parsing with tab-indented content
- Advanced Slides compatibility mode (note: marker)
- Thumbnail Navigator with drag-to-reorder slides
- Inspector Panel for slide and presentation settings
- Live preview within Obsidian
- HTML export with standalone presentations
- Present mode with fullscreen browser presentation
- Presenter View with speaker notes
- Built-in themes: Zurich, Tokyo, Berlin, Minimal
- Custom theme support from vault folder
- Multiple layout types: cover, title, section, columns, image layouts
- Keyboard navigation in presentation view
