# Changelog

All notable changes to Perspecta Slides will be documented in this file.

## [0.2.15] - 2026-01-17

### Added
- Enhanced Custom Theme export with organized asset structure (images/, fonts/, css/, data/ subfolders)
- Deterministic collision-free asset naming with short hashes (theme-name-image-a1b2c3.png)
- Type-safe AssetReference system supporting multiple asset types (image, css, json, font)
- Comprehensive documentation (1800+ lines) for Custom Theme export architecture and usage

### Improved
- Demo file image path references now use actual copied paths (fixed reference rewriting bug)
- Image assets now organized in images/ subfolder for better theme folder organization
- Asset naming prevents collisions when multiple assets share the same basename
- Helper methods for asset management: generateShortHash(), isImageExtension(), getAssetType()
- exportTheme() now passes actual path maps to createDemoFile() for accurate reference rewriting
- copyImages() enhanced with subfolder organization, deterministic hashing, and collision tracking

### Technical
- New AssetReference interface: `{ originalPath, type, location, isWikiLink?, fullMatch }`
- Improved exportTheme() flow to capture and pass image path maps
- Enhanced copyImages() with images/ subfolder, deterministic hashing, and collision prevention
- Updated createDemoFile() to accept and use actual path maps

### Compatibility
- 100% backward compatible with existing custom themes; no breaking changes
- Full Obsidian Sync compatibility with vault-relative paths and deterministic structure
- Legacy theme.json format continues to load and work without changes

## [0.2.14] - 2026-01-13

- New: Explicit column delimiter "--" on its own line for hard column breaks in default layout
- New: Refactored column detection system with 5-priority architecture (explicit, H3, H2, empty lines, single column)
- New: Inspector panel sections now collapsible with persistent state saved in localStorage
- New: "Hide Overlay" per-slide toggle to disable presentation overlays on specific slides
- Improved: Column content matching now handles multi-line content (lists, paragraphs) with word-based matching (60%+ similarity)
- Improved: Fixed CSS input field styling for Obsidian 1.11 Electron update (transparent backgrounds, reduced padding)
- Improved: Metadata key parsing now supports kebab-case keys (e.g., "hide-overlay")
- Removed: "Custom CSS Class" option from slide overrides (no longer supported)
- Technical: New autoDetectColumnsNew() method with cleaner, maintainable column detection logic

## [0.2.13] - 2026-01-12

- New: HTML export now supports Excalidraw drawings with embedded SVG
- Fix: Footnotes now render on individual slides by default (not just collected view)

## [0.2.12] - 2026-01-12

- New: Soft line breaks in lists - Shift+Return (indented continuation lines) now render as <br /> within list items
- New: Literal \n support - typing backslash+n in text renders as line break
- Improved: Theme switching now clears all styling properties for clean theme application
- Improved: Theme change preserves only content (title, author, headers/footers) and presentation settings

## [0.2.11] - 2026-01-11

- New: Excalidraw reference types support - group=, area=, frame=, clippedframe=
- New: group= reference shows all elements sharing the same Excalidraw group
- New: area= reference shows cropped view around element bounding box
- New: frame= reference shows frame contents in their entirety (elements not clipped even if extending beyond frame)
- New: clippedframe= reference clips elements at frame boundary like a window/mask, zero padding
- New: Frames can be referenced by ID or name
- New: Group/area can reference elements by ID or section heading (# Heading)
- New: Excalidraw cache invalidation based on file modification time
- Technical: Each reference type uses separate cache keys for proper invalidation
- Changed: Soft line breaks now use standard Markdown syntax (Shift+Return / two trailing spaces) instead of \n

## [0.2.10] - 2026-01-10

- New: "Create Demo Presentation" button in Settings → Presentation tab showcasing the default theme
- New: Auto-install Inter font when creating demo presentation for seamless setup
- New: Obsidian wiki-link stripping when links are disabled - [[page]] renders as "page", [[page|text]] renders as "text"
- Improved: H3+ headlines in default layout now treated as slide content (column separators) instead of headers
- Improved: Single-column default layout now uses consistent CSS styling (ratio-equal class) matching 1-column layout
- Added: MIT License file
- Removed: Description text from "Enable Obsidian Links" toggle for cleaner UI

## [0.2.9] - 2026-01-10

- Updated: README with revised slide content and speaker notes sections
- Updated: Removed kickers section from README documentation
- Improved: Added comprehensive notes section for presenter workflow

## [0.2.8] - 2026-01-09

- Changed: Added new "Default" theme as the only built-in theme with Inter font and dynamic gradient backgrounds
- Improved: Cleaner codebase with all third-party references removed
- Improved: Default theme features dynamic slide-position-based gradient backgrounds

## [0.2.7] - 2026-01-09

- New: Footnotes now respect column layouts - footnote width automatically limited to first column width
- New: Smart footnote width calculation for 2-column, 3-column, and ratio layouts (1+2, 2+1)

## [0.2.6] - 2026-01-09

- New: Footnote support - reference footnotes with [^id] syntax and define with [^id]: content
- New: Footnotes render as superscript in slide content with theme link color and bold styling
- New: Per-slide footnotes section with hanging numbers, separator line, and proper content margin alignment
- New: Multi-line footnote definitions supported (indented continuation lines)
- New: Named footnotes supported (e.g., [^note1], [^reference])
- Improved: Presentation preview now debounces updates to 1 second, reducing flicker during typing
- Improved: Preview updates only refresh slide content, not the entire view
- Improved: Footnotes grow upward from footer area with 2.25em spacing
- Improved: Footnote numbers "hang" outside content margin for clean text alignment
- Fix: PresentationView parser now uses correct content mode from plugin settings
- Fix: Content no longer incorrectly treated as speaker notes in preview when using advanced-slides mode
- Fix: Removed console.log debug messages from inter-window communication

## [0.2.5] - 2026-01-08

- New: HTML export functionality - export presentations to standalone HTML with embedded styles and navigation
- New: Export command "Export presentation to HTML" creates folder with index.html and external images
- New: Exported presentations include responsive navigation: keyboard controls, click-based navigation, URL hash support
- New: Speaker notes embedded as HTML comments in exported slides for searching without displaying
- New: Exported presentations include help overlay (press ?) with keyboard shortcut reference
- New: Images extracted as separate files to images/ subdirectory
- New: Theme colors and custom fonts fully embedded in exported HTML
- New: Double-click fullscreen support in exported presentations
- New: Progress bar showing current slide position in exported presentations

## [0.2.4] - 2026-01-07

- Fix: PresenterWindow refactored with improved layout stability
- Improved: Speaker view layout reorganization for better readability

## [0.2.3] - 2026-01-07

- Fix: Variable font files now stored as single file per style (not expanded per weight)
- Fix: Bold text (weight 700) now persists when changing body font weight
- Fix: @font-face CSS now always includes weight 700 for body font to support <strong> and <b> tags
- Fix: Font cache reload after deletion - can now re-download deleted fonts immediately
- New: Font download dialog now accepts plain font names (e.g., "Saira", "Open Sans") instead of requiring URLs
- New: Font names with spaces are fully supported in both download and display
- New: Fonts sorted alphabetically in Settings Downloaded Fonts list
- New: Fonts sorted alphabetically in all Inspector font dropdowns
- Improved: Font expansion logic simplified - variable fonts detected by checking weights array from cache

## [0.2.2] - 2026-01-07

- Fix: Unsafe type assertions on view casts - added instanceof checks throughout codebase
- Fix: Image path resolution in presentation window - plain filenames and wiki-link paths now properly resolve
- New: Lock Aspect Ratio toggle in Inspector Presentation tab - maintains slideshow aspect ratio with letterbox/pillarbox
- New: Aspect ratio locking respects 16:9, 4:3, and 16:10 formats with centered slides
- New: Global Text Scale slider in Inspector Typography tab (0.5x to 2.0x)
- New: Typography scaling uses geometric mean approximation for orientation-independent sizing
- New: Bold text color customization with lightBoldColor and darkBoldColor frontmatter properties
- New: Startup view initialization fixed - presentation views load with correct theme colors on Obsidian restart

## [0.2.1] - 2026-01-06

- Fix: Caption layout header and footer text now properly vertically centered
- Fix: Font weight dropdown now validates available weights when switching fonts
- Fix: Font weight dropdown defaults to first available weight if selection is invalid
- Fix: SlideRenderer validates font weights before applying CSS, uses closest valid weight
- Fix: Font file paths now normalized to remove double slashes from caching
- New: Comprehensive debug logging for font loading pipeline (Settings → Debug → Font Loading)
- Fix: Font cache path normalization in FontManager constructor and setter methods
- Fix: "File already exists" errors when re-adding fonts - uses modifyBinary() for existing files
- New: Proper nested list support with visual hierarchy (different bullet styles per level)

## [0.2.0] - 2026-01-06

- New: Semantic colors replace generic accent colors (link, bullet, blockquote border, table header, code border, progress bar)
- New: Save current presentation as self-contained theme package with all assets
- New: Theme export includes: theme.json, theme.css, fonts/, images, and <themename>-demo.md
- New: Images automatically copied with <themename>- prefix for uniqueness
- New: Demo markdown file with clean frontmatter (only theme reference) and updated image paths
- New: All slider values become theme defaults - can be reset via "Reset" icons
- New: Sensible CSS defaults when no theme is loaded
- New: Custom themes saved to configurable folder (default: perspecta-themes/)
- New: Custom themes include all settings: fonts, colors, typography, margins, and spacing
- New: Bundled fonts - custom themes automatically include cached Google Fonts in fonts/ subfolder
- New: Existing themes can be overwritten after user confirmation
- New: Custom themes appear in all theme dropdowns with ★ marker
- New: Semantic Colors section with explicit color pickers for links, bullets, blockquotes, tables, code, progress bar
- Improved: Font dropdowns now show theme default font name (e.g., "Theme Default (Barlow)")
- Improved: Header/Footer font dropdowns show inherited font (e.g., "Inherit from Body (Helvetica)")
- Improved: Theme color and typography settings from custom themes now apply correctly to slides
- New: ThemeLoader supports loading from new theme.json format (Perspecta custom themes)
- New: Custom theme fonts loaded from theme's fonts/ folder (not just global cache)
- New: Theme presets data preserved for per-heading colors and layout-specific backgrounds
- New: ThemeExporter creates complete, shareable theme packages ready to become built-in themes
- Fix: Theme resolution unified across all components (main, Inspector, PresentationView)

## [0.1.9] - 2026-01-04

- New: Google Fonts integration - download and cache fonts locally for offline use
- New: Typography tab in Inspector with FONTS, SIZES, SPACING, and OFFSETS sections
- New: Font debugging toggle in Settings → Debug tab
- New: Heading colors now addable/removable - headlines use Title color by default
- New: Layout backgrounds now addable/removable - layouts use theme Background by default
- Improved: Inspector reorganized into 4 tabs: Presentation, Typography, Theme, Slide
- Improved: Slide tab "Appearance" section renamed to "Overrides" with Mode reset button
- Improved: Slide background settings moved from Images tab to Slide tab
- Fix: Text input fields in Inspector now save on blur instead of onChange (fixes single character bug)
- Fix: Font names properly quoted in CSS variables for correct font loading
- Removed: Images and Text tabs from Inspector (functionality consolidated)

## [0.1.8] - 2026-01-03

- New: Support for dynamic background gradients in both light and dark modes
- Fix: Resolved issue where font colors were not applying to themes
- Improved: Theme-specific CSS classes correctly applied to presentation body
- Improved: Automatic selection of active appearance mode (Light/Dark) in Inspector panel

## [0.1.7] - 2026-01-03

- New: half-image layout - vertical split with image on left or right
- New: half-image-horizontal layout - horizontal split with image on top or bottom
- New: Image position auto-detection based on content order
- New: Image metadata parsing - size (cover/contain), focal point (x, y), and filters
- Improved: Inspector panel now has 4 image layout buttons

## [0.1.6] - 2026-01-03

- New: Global font size offset setting (-50% to +50%) for scaling all text
- New: Content top offset setting (0-50%) to push column content down
- New: Reorganized Inspector tabs: Presentation, Design (theme/typography/colors), Slide (per-slide layout)
- Improved: Slide header now has proper margin-bottom spacing from headline

## [0.1.5] - 2026-01-03

- Improved: Presentation window now uses incremental updates - only redraws when displayed slide changes
- Improved: Editing a slide no longer causes presentation window to jump back to first slide
- Improved: Much smoother live updates while presenting - no flicker for unrelated edits
- Changed: Presentation window uses drag overlay for cleaner interaction
- New: Click+drag anywhere moves the window (default mode)
- New: Double-click enters text selection mode, Escape exits it
- New: Obsidian wiki-link image syntax (![[image.png]]) now supported
- New: Full-image layout fills entire slide with object-fit: cover (no letterboxing)
- New: Image metadata system (size, x, y positioning) for future enhancements
- Fix: Wiki-link images now resolve correctly using Obsidian vault paths
- Technical: Presentation window uses content hashing to detect changes

## [0.1.4] - 2026-01-03

- New: Frameless presentation window - clean, distraction-free presenting
- New: macOS traffic light buttons appear on hover and auto-hide after 3 seconds
- New: Window draggable by clicking any non-interactive area
- New: Double-click thumbnail in navigator to start presentation at that slide
- New: Click navigation in presentation (left third = back, right third = forward)
- Improved: ESC key behavior - exits fullscreen first, then closes window
- Improved: Keyboard navigation (arrows, space, PageUp/PageDown, Home/End)
- Improved: Presentation window opens at optimal 16:9 size for screen
- Fix: Keyboard events now work reliably in presentation window

## [0.1.3] - 2026-01-02

- Improved: Built-in themes now have proper light/dark mode support
- Improved: Theme loading and color variable handling

## [0.1.2] - 2026-01-02

- Major Fix: Unified rendering pipeline for thumbnails and preview
- Major Fix: Fixed theme application inconsistencies
- Major Fix: Implemented proper font scaling with --slide-unit CSS variable
- New: Context-aware theme CSS generation
- New: Dynamic font scaling that adapts to container size
- Fix: Preview navigation now correctly updates current slide
- Fix: Speaker notes hidden from thumbnails and preview
- Improved: Thumbnail text scaling matches preview proportions

## [0.1.1] - 2026-01-02

- New: Tabbed settings interface with organized sections
- New: Changelog tab in settings showing version history
- New: GitHub Actions workflow for automated releases
- Fix: Present/Presenter View buttons now use temp file approach for reliable browser launch
- Fix: Thumbnail iframes no longer cause console warnings
- Improved: Thumbnail Navigator redesigned with integrated SVG circle number badge
- Improved: Dynamic font sizing using --slide-unit CSS variable for responsive scaling
- Improved: PresentationView now uses container class pattern

## [0.1.0] - 2026-01-01

- Initial release
- Markdown parsing with tab-indented content for slide visibility
- Advanced Slides compatibility mode (note: marker)
- Thumbnail Navigator with drag-to-reorder slides
- Inspector Panel for slide and presentation settings
- Live preview within Obsidian
- HTML export with standalone presentations
- Present mode with fullscreen browser presentation
- Presenter View with speaker notes
- Built-in Default theme with dynamic gradient backgrounds
- Custom theme support from vault folder
- Multiple layout types: cover, title, section, columns, image layouts
- Keyboard navigation in presentation view
