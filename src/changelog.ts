// ============================================================================
// Changelog Data - Single Source of Truth
// This file is used to generate both the settings UI changelog and CHANGELOG.md
// ============================================================================

export interface ChangelogEntry {
  version: string;
  date?: string;
  changes: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '0.2.10',
    date: '2026-01-10',
    changes: [
      'New: "Create Demo Presentation" button in Settings → Presentation tab showcasing the default theme',
      'New: Auto-install Inter font when creating demo presentation for seamless setup',
      'New: Newline support - \\n and actual newlines in slide content now render as <br /> in HTML',
      'New: Obsidian wiki-link stripping when links are disabled - [[page]] renders as "page", [[page|text]] renders as "text"',
      'Improved: H3+ headlines in default layout now treated as slide content (column separators) instead of headers',
      'Improved: Single-column default layout now uses consistent CSS styling (ratio-equal class) matching 1-column layout',
      'Added: MIT License file',
      'Removed: Description text from "Enable Obsidian Links" toggle for cleaner UI',
    ],
  },
  {
    version: '0.2.9',
    date: '2026-01-10',
    changes: [
      'Updated: README with revised slide content and speaker notes sections',
      'Updated: Removed kickers section from README documentation',
      'Improved: Added comprehensive notes section for presenter workflow',
    ],
  },
  {
    version: '0.2.8',
    date: '2026-01-09',
    changes: [
      'Changed: Added new "Default" theme as the only built-in theme with Inter font and dynamic gradient backgrounds',
      'Improved: Cleaner codebase with all third-party references removed',
      'Improved: Default theme features dynamic slide-position-based gradient backgrounds',
    ],
  },
  {
    version: '0.2.7',
    date: '2026-01-09',
    changes: [
      'New: Footnotes now respect column layouts - footnote width automatically limited to first column width',
      'New: Smart footnote width calculation for 2-column, 3-column, and ratio layouts (1+2, 2+1)',
    ],
  },
  {
    version: '0.2.6',
    date: '2026-01-09',
    changes: [
      'New: Footnote support - reference footnotes with [^id] syntax and define with [^id]: content',
      'New: Footnotes render as superscript in slide content with theme link color and bold styling',
      'New: Per-slide footnotes section with hanging numbers, separator line, and proper content margin alignment',
      'New: Multi-line footnote definitions supported (indented continuation lines)',
      'New: Named footnotes supported (e.g., [^note1], [^reference])',
      'Improved: Presentation preview now debounces updates to 1 second, reducing flicker during typing',
      'Improved: Preview updates only refresh slide content, not the entire view',
      'Improved: Footnotes grow upward from footer area with 2.25em spacing',
      'Improved: Footnote numbers "hang" outside content margin for clean text alignment',
      'Fix: PresentationView parser now uses correct content mode from plugin settings',
      'Fix: Content no longer incorrectly treated as speaker notes in preview when using advanced-slides mode',
      'Fix: Removed console.log debug messages from inter-window communication',
    ],
  },
  {
    version: '0.2.5',
    date: '2026-01-08',
    changes: [
      'New: HTML export functionality - export presentations to standalone HTML with embedded styles and navigation',
      'New: Export command "Export presentation to HTML" creates folder with index.html and external images',
      'New: Exported presentations include responsive navigation: keyboard controls, click-based navigation, URL hash support',
      'New: Speaker notes embedded as HTML comments in exported slides for searching without displaying',
      'New: Exported presentations include help overlay (press ?) with keyboard shortcut reference',
      'New: Images extracted as separate files to images/ subdirectory',
      'New: Theme colors and custom fonts fully embedded in exported HTML',
      'New: Double-click fullscreen support in exported presentations',
      'New: Progress bar showing current slide position in exported presentations',
    ],
  },
  {
    version: '0.2.4',
    date: '2026-01-07',
    changes: [
      'Fix: PresenterWindow refactored with improved layout stability',
      'Improved: Speaker view layout reorganization for better readability',
    ],
  },
  {
    version: '0.2.3',
    date: '2026-01-07',
    changes: [
      'Fix: Variable font files now stored as single file per style (not expanded per weight)',
      'Fix: Bold text (weight 700) now persists when changing body font weight',
      'Fix: @font-face CSS now always includes weight 700 for body font to support <strong> and <b> tags',
      'Fix: Font cache reload after deletion - can now re-download deleted fonts immediately',
      'New: Font download dialog now accepts plain font names (e.g., "Saira", "Open Sans") instead of requiring URLs',
      'New: Font names with spaces are fully supported in both download and display',
      'New: Fonts sorted alphabetically in Settings Downloaded Fonts list',
      'New: Fonts sorted alphabetically in all Inspector font dropdowns',
      'Improved: Font expansion logic simplified - variable fonts detected by checking weights array from cache',
    ],
  },
  {
    version: '0.2.2',
    date: '2026-01-07',
    changes: [
      'Fix: Unsafe type assertions on view casts - added instanceof checks throughout codebase',
      'Fix: Image path resolution in presentation window - plain filenames and wiki-link paths now properly resolve',
      'New: Lock Aspect Ratio toggle in Inspector Presentation tab - maintains slideshow aspect ratio with letterbox/pillarbox',
      'New: Aspect ratio locking respects 16:9, 4:3, and 16:10 formats with centered slides',
      'New: Global Text Scale slider in Inspector Typography tab (0.5x to 2.0x)',
      'New: Typography scaling uses geometric mean approximation for orientation-independent sizing',
      'New: Bold text color customization with lightBoldColor and darkBoldColor frontmatter properties',
      'New: Startup view initialization fixed - presentation views load with correct theme colors on Obsidian restart',
    ],
  },
  {
    version: '0.2.1',
    date: '2026-01-06',
    changes: [
      'Fix: Caption layout header and footer text now properly vertically centered',
      'Fix: Font weight dropdown now validates available weights when switching fonts',
      'Fix: Font weight dropdown defaults to first available weight if selection is invalid',
      'Fix: SlideRenderer validates font weights before applying CSS, uses closest valid weight',
      'Fix: Font file paths now normalized to remove double slashes from caching',
      'New: Comprehensive debug logging for font loading pipeline (Settings → Debug → Font Loading)',
      'Fix: Font cache path normalization in FontManager constructor and setter methods',
      'Fix: "File already exists" errors when re-adding fonts - uses modifyBinary() for existing files',
      'New: Proper nested list support with visual hierarchy (different bullet styles per level)',
    ],
  },
  {
    version: '0.1.8',
    date: '2026-01-03',
    changes: [
      'New: Support for dynamic background gradients in both light and dark modes',
      'Fix: Resolved issue where font colors were not applying to themes',
      'Improved: Theme-specific CSS classes correctly applied to presentation body',
      'Improved: Automatic selection of active appearance mode (Light/Dark) in Inspector panel',
    ],
  },
  {
    version: '0.1.7',
    date: '2026-01-03',
    changes: [
      'New: half-image layout - vertical split with image on left or right',
      'New: half-image-horizontal layout - horizontal split with image on top or bottom',
      'New: Image position auto-detection based on content order',
      'New: Image metadata parsing - size (cover/contain), focal point (x, y), and filters',
      'Improved: Inspector panel now has 4 image layout buttons',
    ],
  },
  {
    version: '0.1.6',
    date: '2026-01-03',
    changes: [
      'New: Global font size offset setting (-50% to +50%) for scaling all text',
      'New: Content top offset setting (0-50%) to push column content down',
      'New: Reorganized Inspector tabs: Presentation, Design (theme/typography/colors), Slide (per-slide layout)',
      'Improved: Slide header now has proper margin-bottom spacing from headline',
    ],
  },
  {
    version: '0.1.5',
    date: '2026-01-03',
    changes: [
      'Improved: Presentation window now uses incremental updates - only redraws when displayed slide changes',
      'Improved: Editing a slide no longer causes presentation window to jump back to first slide',
      'Improved: Much smoother live updates while presenting - no flicker for unrelated edits',
      'Changed: Presentation window uses drag overlay for cleaner interaction',
      'New: Click+drag anywhere moves the window (default mode)',
      'New: Double-click enters text selection mode, Escape exits it',
      'New: Obsidian wiki-link image syntax (![[image.png]]) now supported',
      'New: Full-image layout fills entire slide with object-fit: cover (no letterboxing)',
      'New: Image metadata system (size, x, y positioning) for future enhancements',
      'Fix: Wiki-link images now resolve correctly using Obsidian vault paths',
      'Technical: Presentation window uses content hashing to detect changes',
    ],
  },
  {
    version: '0.1.4',
    date: '2026-01-03',
    changes: [
      'New: Frameless presentation window - clean, distraction-free presenting',
      'New: macOS traffic light buttons appear on hover and auto-hide after 3 seconds',
      'New: Window draggable by clicking any non-interactive area',
      'New: Double-click thumbnail in navigator to start presentation at that slide',
      'New: Click navigation in presentation (left third = back, right third = forward)',
      'Improved: ESC key behavior - exits fullscreen first, then closes window',
      'Improved: Keyboard navigation (arrows, space, PageUp/PageDown, Home/End)',
      'Improved: Presentation window opens at optimal 16:9 size for screen',
      'Fix: Keyboard events now work reliably in presentation window',
    ],
  },
  {
    version: '0.1.3',
    date: '2026-01-02',
    changes: [
      'Improved: Built-in themes now have proper light/dark mode support',
      'Improved: Theme loading and color variable handling',
    ],
  },
  {
    version: '0.1.2',
    date: '2026-01-02',
    changes: [
      'Major Fix: Unified rendering pipeline for thumbnails and preview',
      'Major Fix: Fixed theme application inconsistencies',
      'Major Fix: Implemented proper font scaling with --slide-unit CSS variable',
      'New: Context-aware theme CSS generation',
      'New: Dynamic font scaling that adapts to container size',
      'Fix: Preview navigation now correctly updates current slide',
      'Fix: Speaker notes hidden from thumbnails and preview',
      'Improved: Thumbnail text scaling matches preview proportions',
    ],
  },
  {
    version: '0.1.1',
    date: '2026-01-02',
    changes: [
      'New: Tabbed settings interface with organized sections',
      'New: Changelog tab in settings showing version history',
      'New: GitHub Actions workflow for automated releases',
      'Fix: Present/Presenter View buttons now use temp file approach for reliable browser launch',
      'Fix: Thumbnail iframes no longer cause console warnings',
      'Improved: Thumbnail Navigator redesigned with integrated SVG circle number badge',
      'Improved: Dynamic font sizing using --slide-unit CSS variable for responsive scaling',
      'Improved: PresentationView now uses container class pattern',
    ],
  },
  {
    version: '0.1.0',
    date: '2026-01-01',
    changes: [
      'Initial release',
      'Markdown parsing with tab-indented content for slide visibility',
      'Advanced Slides compatibility mode (note: marker)',
      'Thumbnail Navigator with drag-to-reorder slides',
      'Inspector Panel for slide and presentation settings',
      'Live preview within Obsidian',
      'HTML export with standalone presentations',
      'Present mode with fullscreen browser presentation',
      'Presenter View with speaker notes',
      'Built-in Default theme with dynamic gradient backgrounds',
      'Custom theme support from vault folder',
      'Multiple layout types: cover, title, section, columns, image layouts',
      'Keyboard navigation in presentation view',
    ],
  },
];

/**
 * Render the changelog into an HTML container element (for Obsidian settings)
 */
export function renderChangelogToContainer(containerEl: HTMLElement): void {
  containerEl.createEl('h2', { text: 'Changelog' });

  for (const entry of CHANGELOG) {
    const versionDiv = containerEl.createDiv({ cls: 'perspecta-slides-changelog-version' });
    const dateStr = entry.date ? ` — ${entry.date}` : '';
    versionDiv.createEl('h3', { text: `v${entry.version}${dateStr}` });

    const list = versionDiv.createEl('ul');
    for (const change of entry.changes) {
      list.createEl('li', { text: change });
    }
  }
}

/**
 * Generate markdown changelog content (for CHANGELOG.md)
 */
export function generateChangelogMarkdown(): string {
  const lines: string[] = [
    '# Changelog',
    '',
    'All notable changes to Perspecta Slides will be documented in this file.',
    '',
  ];

  for (const entry of CHANGELOG) {
    lines.push(`## [${entry.version}]${entry.date ? ` - ${entry.date}` : ''}`);
    lines.push('');
    for (const change of entry.changes) {
      lines.push(`- ${change}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
