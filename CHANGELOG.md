# Changelog

All notable changes to Perspecta Slides will be documented in this file.

## [0.5.0] - 2026-05-25

### Added
- **Bundled Inter font for the Default theme** — Inter ships with the plugin (Regular, Italic, Medium, SemiBold, Bold) instead of borrowing the host system's font stack, so the Default theme renders the same on every machine. The font is namespaced (`Inter [perspecta:Default]`) and managed through the same Phase-2 mechanism as custom-theme fonts.

### Changed
- **Flicker-free live design updates** — changing typography, spacing, or theme colors in the inspector now patches the CSS variables inside the live slide iframes in place instead of reloading them. The preview, thumbnail navigator, and the external presentation window all update without the blank-and-repaint flash. Changes that alter slide structure or the light/dark mode still do a full rebuild.
- **Hardened presentation window** — the external presentation window now runs with `nodeIntegration: false` and `contextIsolation: true` behind a contextBridge preload. The previous 500 ms callback-injection polling and `require('electron')` in injected HTML are gone; the renderer talks to the host over a channel-restricted bridge.

### Fixed
- **Double redraw on design changes** — adjusting a slider (e.g. font size) redrew the preview and every thumbnail twice. Render suppression is now order-independent, so the self-write that follows a live patch no longer triggers a second redraw.
- **Stale build loaded by Obsidian** — the build now copies artifacts into the dev vault's plugin directory after every build, so a reload always picks up the fresh code (the build output directory and the vault plugin directory were separate locations).

### Internal
- `main.ts` split from ~3645 to ~2290 lines by extracting focused modules (slide serialization, image-path resolution, Excalidraw coordination, IPC listener management, cursor tracking, slide mutation, deck font resolution).

## [0.4.0] - 2026-05-24

### Added
- **PPTX export** — new menu item "Export as PPTX" produces an editable PowerPoint file with native text frames (headings, paragraphs, bullets, numbered lists, code blocks, blockquotes, kickers) instead of flattened images. Built on PptxGenJS.
- **Image-aware PPTX layouts** — `full-image`, `half-image`, `half-image-horizontal`, `caption`, `grid` layouts route the image into a primary slot with text alongside. Slide-level `background: image.png` becomes a slide-spanning background image.
- **Dynamic-background gradients in PPTX** — `use-dynamic-background` color sequences are interpolated per visible slide and applied as solid backgrounds (PPTX has no deck-spanning gradient concept; we discretize at export).
- **Font embedding in PPTX** — typefaces from the deck's theme and frontmatter are embedded as TTF data in the PPTX zip. WOFF2 fonts are decompressed via wawoff2. Variable fonts are pinned to per-slot static instances (regular / bold / italic / bold-italic) via HarfBuzz hb-subset, with axis residue (`STAT`, `fvar`, `gvar`, axis-value names) stripped so the result is structurally clean. Theme1.xml's major/minor font entries are patched to match.
- Speaker notes carried into PPTX as native notes-slide entries.

### Compatibility — embedded PPTX fonts
- Verified rendering correctly in: Google Slides, macOS Quick Look.
- Verified NOT rendering in: Microsoft PowerPoint for Mac (renders Calibri fallback; appears to ignore third-party embedded fonts regardless of structural correctness).
- Not yet verified: Windows PowerPoint, Keynote, LibreOffice Impress.
- Workaround for Mac PowerPoint recipients: install the source font system-wide (Font Book).

## [0.3.4] - 2026-05-23

### Fixed
- PDF export now produces a real PDF of the actual deck instead of a blank A4 page. The previous "Print / PDF" item ran `window.print()` against the Obsidian shell, which captured the UI chrome and dropped the slide iframes. The new path opens an offscreen Electron window, waits for iframes and fonts to settle, then calls `webContents.printToPDF` with the deck's native aspect ratio (16:9 → 13.33″×7.5″ landscape, 4:3 → 10″×7.5″, 16:10 → 13.33″×8.33″). One slide per page, theme and content preserved, written next to the source `.md`

### Changed
- Renamed the menu item "Print / PDF" to "Export as PDF" to reflect that it produces a file directly without opening a print dialog

## [0.3.3] - 2026-05-19

### Fixed
- "Tidy all slides" and every separator rewrite no longer leave a blank line between the separator and a following meta block. A separator is now bound tightly to the meta block beneath it (`---\nlayout: cover`, not `---\n\nlayout: cover`). When the next chunk starts with regular content (heading, paragraph, list, …) the blank line is kept

## [0.3.2] - 2026-05-19

### Fixed
- Slide and chapter separators now always have a blank line above them in the markdown. Without this, Markdown reads `text\n---` as a Setext H2 heading and Obsidian's Live Preview shows no horizontal-rule divider. This affected every operation that rewrote separators (drag-and-drop reorder, Inspector edits, hide/show via eye icon, the new Tidy command) as well as the "Insert slide separator" command when invoked mid-line
- All separator-rebuilding callsites now go through a single helper (`joinSlideChunksWithSeparators`) that frames every separator with `\n\n` on both sides

## [0.3.1] - 2026-05-19

### Added
- Chapter labels: a slide can open a chapter by setting `chapter: My Chapter` in its meta block; the label propagates to every following slide until another `chapter:` is set or an empty value clears it
- `{{chapter}}` placeholder usable in any slide-visible text (headings, lists, paragraphs, speaker notes); substitutes to the active chapter label, or empty if none. Unknown placeholders like `{{typo}}` render verbatim so mistakes stay visible
- Inspector field "Chapter" for editing the chapter label of the current slide without touching the markdown
- Agent slide-preview workflow: a CDP-based script that captures any slide in a clean 1920×1080 PNG via the plugin's PresentationWindow (see `docs/AGENT-PREVIEW.md`)
- Command "Perspecta: Tidy all slides (canonical meta block)" — normalises every slide's meta block in the active deck (semantic key order, single blank line before content, no leading blank lines, collapsed multi-blank-lines in content)
- Expanded speaker-notes markers: in addition to `note:` / `notes:`, the parser now recognises `speaker note(s):`, `presenter note(s):`, `moderator note(s):`, `moderation:`, plus German `notiz`, `notizen`, `sprechertext`, `sprecher(-)notiz`. Hyphens and whitespace are treated equivalently; the canonical form in generated content remains `notes:`

### Improved
- `mode: dark` slides now render with the correct dark background everywhere — Navigator thumbnails no longer flash bright when a dark deck is open
- Slide separators are now code-fence aware: `---` and `-----` lines inside a fenced code block are content, not slide breaks. Blank lines around separators are no longer required either — `layout: default` may start on the line immediately after `---`
- Meta-block operations (Inspector edits, eye-icon hide/show) now run through a tidy step automatically, so accidental blank lines inside the meta block no longer turn meta into content (or vice versa)
- Sidebar drag-and-drop now moves the correct slide across chapter boundaries (the old splitter was blind to chapter separators, which shifted off-by-N)
- Markdown cursor sync with the navigator no longer drifts when the deck contains act/chapter breaks

### Fixed
- Two-column layouts now also work when the column headlines are H2 (the parser's heuristic already supported this, but the upstream visibility marker was swallowing the body)
- Tab indentation no longer hides content: previously a slide whose bullets weren't tab-indented rendered blank (the old iA-Presenter-era marker). Indentation is now plain Markdown indentation, only `note:` / `notes:` (and the new variants) divide slide content from notes
- Slides with `----- Chapter` inline labels no longer appear as broken horizontal-rules in Obsidian's Live Preview — chapter labels moved to the meta block as the `chapter:` key

### Migration notes
- Old `----- Chapter Name` inline labels on separator lines no longer parse as chapter labels. Move the label down to the slide's meta block: `-----` on one line, then `chapter: Chapter Name` on the next
- Decks that relied on tab-indented content being slide-visible (and non-indented content being notes) need a one-time edit: drop the tab indentation, and add a `notes:` line wherever speaker notes should start

## [0.3.0] - 2026-05-19

### Added
- Added `docs/LAYOUT-BLUEPRINT.md` — normative architectural document for the layout system, including the four-layer model (canvas → grid → slots → content), layout families, freedom-of-override hierarchy, and extension-point guidance
- Added 18 new theme-overridable CSS variables for typography sizes, replacing previously hard-coded multipliers: `--h1-size-default` through `--h6-size-default`, `--h1-size-centered`, `--h2-size-centered`, `--body-size`, `--blockquote-size`, `--kicker-size`, `--header-size`, `--footer-size`, `--footnote-size`, `--caption-size`, `--caption-title-size`, `--footnotes-title-size`, `--footnotes-list-size`, `--section-title-size`
- Added theme-overridable column-geometry variables: `--column-gap-2`, `--column-gap-3`, `--columns-bottom-offset`
- Added `LAYOUTS` constant and `isValidLayout()` helper in `src/types.ts` as the single source of truth for layout names
- Added `src/utils/ColorScheme.ts` providing a single `getObsidianColorScheme()` utility (reads Obsidian's theme class instead of OS-level prefers-color-scheme)
- Added `PLUGIN_DEFAULT_THEME` constant and explicit default-theme contract
- Added five-dash separator convention (`-----` or more) as an act-break marker; behaves as a slide break today and surfaces as a narrative-section boundary for future light-table UI

### Improved
- Restructured README to lead with the conceptual model ("not a layout tool — here's why and what you get instead") before features and reference
- Moved `THEME_SYNC_GUIDE.md` to `docs/THEME-SYNC-GUIDE.md` to align with other documentation locations
- Themes can now define their typographic character: a "compact dense" theme and an "airy editorial" theme are now visually differentiable beyond just font choice
- Themes can now control column rhythm (gap between columns, distance from body to footer)
- The built-in Default theme's CSS reorganized into clearly grouped sections matching the blueprint (weights, type scale, rhythm, grid, slots, columns)
- Inspector spacing/margins descriptions now say "slide-units (1 unit ≈ 1% of slide diagonal)" instead of the misleading "em"
- `setPresentation` argument order unified across `ThumbnailNavigatorView`, `PresentationView`, and `InspectorPanelView` to `(presentation, theme?, file?)`

### Fixed
- Fixed Default-theme inconsistency where Navigator, Preview, and Presentation Window each rendered the same slide with different background colors
- Fixed `DEFAULT_SETTINGS.defaultTheme = ''` resulting in slides with no theme variables, exposing the surrounding container's color through transparent iframes
- Fixed Inspector theme dropdown having two visually identical "Default" entries; the empty-string option is now labelled `(Use plugin default)` and the built-in Default theme is filtered out of the user-themes list
- Fixed Default theme's `LightBackgroundColor` / `DarkBackgroundColor` being derived from the dynamic gradient's first color (rosa / dark red); these are now explicit neutral defaults (`#ffffff` / `#1a1a1a`)
- Fixed `getEffectiveMode` falling back to `'light'` regardless of system theme; it now follows Obsidian's theme class
- Fixed `PresentationView.renderSlides()` ignoring the theme passed via `setPresentation()` and re-looking-up from frontmatter
- Fixed `generateDefaultCSS()` being exported but never called, leaving the no-theme code path without CSS variables

### Technical
- Removed dead `--title-font-size-offset`, `--body-font-size-offset`, `--header-font-size-offset`, `--footer-font-size-offset`, `--text-scale` variables from the Default theme's CSS (they were not consumed by the renderer)
- Removed four duplicate `getSystemColorScheme()` implementations in favour of a single utility
- Replaced OS-level `prefers-color-scheme` change listener with Obsidian's `css-change` workspace event
- Parser now logs unknown layout values to the debug channel without rejecting them (forward compatibility)
- All visual defaults preserved through `var(--name, <fallback>)` patterns; existing themes that don't set the new variables render identically

## [0.2.24] - 2026-02-04

### Added
- Added explicit bundled font manifest support in `theme.json` (`bundledFonts`) for self-contained custom themes
- Added non-destructive theme apply mode in Inspector: "Apply theme only (keep overrides)"
- Added explicit reset mode in Inspector: "Apply and reset overrides"
- Added optional "Install to cache" action for bundled theme fonts in Inspector
- Added frontmatter-linked asset export and rewrite for `logo`, `imageOverlay`, and `imageOverlays[].path`
- Added implementation notes for agents in `.amp/agent-notes/THEME_SELF_CONTAINED_SYNC_FIX_2026-02-04.md`

### Improved
- Improved custom theme export to resolve effective settings (frontmatter + base theme fallbacks) before packaging
- Improved bundled font loading to use manifest metadata first, with legacy fallback for older theme packages
- Improved cross-device theme portability for Obsidian Sync scenarios
- Improved sync docs and usage guidance for self-contained theme workflows

### Fixed
- Fixed missing bundled-font cases where fallback theme fonts were used but not copied into exported theme package
- Fixed fragile font-family inference from filename parsing in theme font loading
- Fixed destructive theme re-application being the only path when switching/reapplying themes
- Fixed potential cross-family cache pollution during bundled font installation from theme packages

## [0.2.23] - 2026-02-02

### Improved
- Layout-specific background support now extends to ALL layouts (not just cover/title/section)
- Column layouts can now have dedicated backgrounds (1-column, 2-columns, 3-columns, ratio layouts)
- Image layouts can now have dedicated backgrounds (full-image, half-image, caption layouts)
- Grid and footnotes layouts now support dedicated backgrounds
- Refactored background key mapping for cleaner, maintainable code

### Technical
- Added `getLayoutBackgroundKey()` method in SlideRenderer for centralized layout-to-key mapping
- Extended PresentationFrontmatter interface with all layout-specific background properties
- Unified background handling across all 13+ layout types

## [0.2.22] - 2026-01-25

### Fixed
- Fixed image loading on Windows in Presenter Window: File:// URLs now properly handle Windows path separators and drive letters (C:/)
- Fixed net::ERR_FAILED errors for image resources on Windows by normalizing paths and using platform-aware file:// URL construction
- Images now load correctly in external windows on both Windows and Mac

### Technical
- Added `convertToFileUrl()` helper method for cross-platform file:// URL generation
- Replaced string path concatenation with `require('path').join()` for platform-aware path handling
- All image resolvers now use consistent path normalization

## [0.2.21] - 2026-01-21

### Improved
- Inspector panel "Slide" tab now has collapsible layout sections for better space utilization
- Consolidated 4 separate layout sections (Standard, Text, Image, Special) into single collapsible "Slide Layouts" section
- Layout buttons now display horizontally (icon left, label right) instead of vertically stacked
- Layout grid now uses 2-column layout instead of stretching full width - more efficient space usage
- "Overrides" section in Slide tab is now collapsible, matching "Slide Layouts" section behavior
- Collapsed section states are persisted across sessions in localStorage

### UI
- Reduced vertical space usage in Inspector panel by eliminating redundant section headers

## [0.2.20] - 2026-01-19

### Fixed
- Fixed image loading in preview window: PresentationView now uses context-aware Obsidian resource paths (app://) with proper directory context
- Fixed image loading in external windows: PresentationWindow and PresenterWindow now use context-aware file:// URLs with proper source file context
- Fixed wiki-link resolution context: Images now resolve relative to presentation file directory, not active file
- Fixed multi-column slide layout: H1/H2 titles now correctly stay in header section instead of being assigned to columns
- Fixed explicit column delimiter handling: "--" lines no longer appear as content in slides
- Fixed explicit column delimiter support for 3+ columns: Now dynamically determines maxColumnIndex instead of hardcoding limit of 2
- Fixed H3 heading treatment in explicit column layouts: H3 headings no longer treated as column separators when explicit "--" delimiters are present
- Fixed missing columnIndex assignment: Images, code blocks, tables, and math blocks now correctly assigned in parseSlideAdvancedMode with explicit column layouts

### Improved
- Column break delimiter logic now consistently skips "--" delimiters across all parsing modes
- All image views (thumbnail navigator, preview, presentation window, presenter window) now show images correctly
- Resolver factory pattern enables context-aware resolution for each view type
- Column delimiters now take priority over automatic pattern detection

### Technical
- Added context-aware resolver wrapping for PresentationView with presentation file directory context
- Enhanced createPresentationImageResolver(sourcePath) for external window image resolution
- Resolver factory pattern allows different URL schemes for internal views (app://) vs external windows (file://)
- Improved wiki-link resolution using presentation file path context via Obsidian metadata cache

### Compatibility
- Cross-platform compatible (Windows, Mac, Linux)
- All image resolution uses standard Obsidian APIs for maximum compatibility

## [0.2.18] - 2026-01-18

### Fixed
- Fixed font weight changes not applying correctly: Corrected body font weight logic to not force weight 700 when 700 is already selected
- Fixed variable font weight range declaration: @font-face now declares full weight range (e.g., `font-weight: 400 700`) for variable fonts
- Fixed font cache filtering for variable fonts: Now includes all cached weights to properly detect variable fonts instead of filtering to requested weights only
- Fixed expandVariableFontFiles() to validate weight/style combinations: Only creates cache entries for weights that actually exist for each style (e.g., Cardo doesn't have Bold Italic)
- Fixed font cache deduplication: Removed duplicate (weight, style, path) entries that prevented weight changes from working

### Improved
- Font weight switching now works correctly for all fonts including variable fonts
- Better handling of fonts with incomplete weight/style combinations (e.g., Cardo Regular/Bold/Italic without Bold Italic)
- Variable fonts now properly declare their full weight range in @font-face CSS

### Technical
- Added variable font detection in generateFontFaceCSSForExport() by checking if same file path has multiple weights
- Improved expandVariableFontFiles() to validate weight/style combinations against actual downloaded files
- Enhanced weight filtering logic to distinguish between variable and static fonts

### Notes
- Google Fonts may not provide all weights for download (e.g., Cardo Bold). Use "Add Local Font" feature with TTF files if needed
- All font weight fixes are cross-platform safe (Windows, Mac, Linux)

## [0.2.17] - 2026-01-18

### Fixed
- Fixed critical Windows font path corruption: Improved `fixCorruptedPath()` to correctly detect and repair doubled path segments (e.g., `SRC/perspecta/fontsSRC/perspecta/fonts/` → `SRC/perspecta/fonts/`)
- Fixed font loading on Windows: Path normalization for cached font files (forward slashes)
- Fixed variable font weight support: Cache now stores all requested weights for proper weight filtering
- Fixed font CSS generation fallback: Uses all cached files if no exact weight matches (handles variable fonts)
- Fixed settings input focus: Removed interfering event handlers that caused focus loss
- Fixed valid file detection: Skips non-existent cached files to prevent generation errors

## [0.2.16] - 2026-01-18

### Fixed
- Font loading improvements for Windows path handling
- Variable font weight expansion in cache

### Improved
- Variable fonts now properly support all weight ranges (100-900) in presentations
- Font weight changes in inspector now apply correctly across all contexts
- Better error handling for corrupted cache entries on Windows and cross-platform

### Technical
- Enhanced path normalization in FontManager with Windows backslash-to-forward-slash conversion
- Improved variable font expansion: Creates cache entries for all requested weights while maintaining single file per style
- Added validity checks before processing cached font files in CSS generation

### Compatibility
- All fixes are cross-platform safe (Windows, Mac, Linux)
- No breaking changes; fully backward compatible

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
