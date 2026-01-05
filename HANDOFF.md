# Perspecta Slides - Handoff Document

**Last Updated:** January 2, 2026

## Project Overview

Perspecta Slides is an Obsidian plugin for creating presentations from markdown files, inspired by iA Presenter's content model.

## Current State

The plugin is functional with core features implemented. Build succeeds and plugin loads in Obsidian.

## Architecture

### Key Files

| File | Purpose |
|------|---------|
| `main.ts` | Plugin entry point, commands, event handlers, sidebar management |
| `src/parser/SlideParser.ts` | Parses markdown → `Presentation` object with slides, elements, speaker notes |
| `src/renderer/SlideRenderer.ts` | Renders slides to HTML for export and iframe thumbnails |
| `src/ui/PresentationView.ts` | Live preview within Obsidian (not iframe-based) |
| `src/ui/ThumbnailNavigator.ts` | Left sidebar with draggable slide thumbnails |
| `src/ui/InspectorPanel.ts` | Right sidebar with presentation/slide settings |
| `src/themes/` | Theme system (iA Presenter compatible) |
| `src/types.ts` | TypeScript interfaces |

### Data Flow

```
Markdown File
     ↓
SlideParser.parse() → Presentation { frontmatter, slides[] }
     ↓
┌────────────────────────────────────────┐
│  ThumbnailNavigator  │  PresentationView  │  InspectorPanel  │
│  (iframe thumbnails) │  (live DOM render) │  (settings UI)   │
└────────────────────────────────────────┘
     ↓
SlideRenderer.renderHTML() → Standalone HTML for export/presentation
```

## Theme System (iA Presenter Compatible)

Themes are self-contained directories that can be copied to share the complete theme.

### Theme Directory Structure

```
my-theme/
├── template.json       # Theme metadata and configuration
├── presets.json        # Color presets (light/dark modes)
├── theme.css           # Main CSS styling
├── template.png        # Theme thumbnail preview (optional)
├── logo.png            # Default logo for this theme (optional)
├── fonts/              # Custom font files (optional)
└── assets/             # Images, patterns, backgrounds (optional)
```

### template.json (Theme Metadata)

```json
{
  "Name": "My Theme",
  "Version": "1.0.0",
  "Author": "Your Name",
  "ShortDescription": "A brief tagline",
  "LongDescription": "Detailed description",
  "Css": "theme.css",
  "TitleFont": "Helvetica",
  "BodyFont": "Helvetica",
  "CssClasses": "fixed-size-headings"
}
```

### presets.json (Color Presets)

```json
{
  "Presets": [{
    "Name": "Default",
    "Appearance": "light",
    "TitleFont": "Helvetica",
    "BodyFont": "Helvetica",
    "DarkBodyTextColor": "#000000",
    "LightBodyTextColor": "#ffffff",
    "DarkTitleTextColor": "#000000",
    "LightTitleTextColor": "#ffffff",
    "DarkBackgroundColor": "#000000",
    "LightBackgroundColor": "#ffffff",
    "Accent1": "#000000",
    "Accent2": "#43aa8b",
    "Accent3": "#f9c74f",
    "Accent4": "#90be6d",
    "Accent5": "#f8961e",
    "Accent6": "#577590",
    "LightBgGradient": ["#color1", "#color2"],
    "DarkBgGradient": ["#color1", "#color2"]
  }]
}
```

### Built-in Themes

- **Zurich** - Minimal Swiss design, fixed-size headings
- **Kyoto** - Dynamic gradient theme with soft pastel colors
- **Berlin** - Professional blue tones
- **Minimal** - Ultra-clean with generous whitespace

## Layout System

### Container Classes (iA Presenter Pattern)

Each layout has a container class on the outer element and a layout class on content:

| Layout | Container Class | Content Class |
|--------|-----------------|---------------|
| Cover | `.cover-container` | `.layout-cover` |
| Title | `.title-container` | `.layout-title` |
| Section | `.section-container` | `.layout-section` |
| Default | `.default-container` | `.layout-default` |
| Columns | `.columns-container` | `.layout-1-column`, etc. |
| Full Image | `.image-container` | `.layout-full-image` |
| Half Image | `.split-container` | `.layout-half-image` |
| Caption | `.caption-container` | `.layout-caption` |
| Grid | `.grid-container` | `.layout-grid` |

### Slide Layouts

**STANDARD SLIDES:**
- `cover` - Opening slide, centered content
- `title` - Title slide with large heading
- `section` - Chapter/section divider
- `default` - Standard with auto-column detection

**COLUMN SLIDES:**
- `1-column` - Single column
- `2-columns` - Two equal columns
- `3-columns` - Three equal columns
- `2-columns-1+2` - Left narrow (1/3), right wide (2/3)
- `2-columns-2+1` - Left wide (2/3), right narrow (1/3)

**IMAGE SLIDES:**
- `full-image` - Images fill entire slide
- `half-image` - Half for image(s), half for text
- `caption` - Full image with title bar and caption

**GRID SLIDES:**
- `grid` - Auto-grid for multiple items

## Content Modes

### ia-presenter (default)
- Tab-indented content = visible on slide
- Unindented paragraphs = speaker notes
- `//` at line start = comment (hidden)
- `^text` = kicker (small text above heading)

### advanced-slides
- All content visible until `note:` line
- Everything after `note:` = speaker notes

## Slide Metadata

At start of each slide (before content):

```markdown
layout: cover
background: image.jpg
opacity: 50%
filter: darken
mode: dark
class: my-custom-class
```

## Build & Deploy

```bash
npm run build
cp main.js manifest.json styles.css "/Users/wrede/Documents/Obsidian Vaults/Perspecta-Dev/.obsidian/plugins/perspecta-slides/"
```

## Code Patterns

### Adding a new layout

1. Add to `SlideLayout` type in `types.ts`
2. Add container class mapping in `SlideRenderer.getContainerClass()`
3. Add rendering method in `SlideRenderer` (e.g., `renderMyLayout()`)
4. Add case in `SlideRenderer.renderSlideContent()`
5. Add matching method in `PresentationView`
6. Add CSS for container and layout classes
7. Add to Inspector layout picker

### Adding a new theme

1. Create directory in vault's custom themes folder
2. Add `template.json` with theme metadata
3. Add `presets.json` with color presets
4. Add CSS file referenced in template.json
5. Reload plugin to discover theme

## Known Issues / Potential Improvements

1. **Image handling** - Images in vault need proper path resolution for export
2. **Math rendering** - KaTeX/MathJax not currently bundled
3. **Code highlighting** - No syntax highlighting in export
4. **Presenter View sync** - Currently standalone
5. **Custom themes** - Theme discovery from vault folder needs testing
6. **PresentationView** - Needs update to use new container class pattern

## Documentation

- [Theme Specification](docs/THEME-SPECIFICATION.md) - Complete theme format documentation
