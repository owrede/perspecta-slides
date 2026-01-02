# Changelog

All notable changes to Perspecta Slides will be documented in this file.

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
