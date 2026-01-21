# Perspecta Slides

A powerful Obsidian plugin for creating beautiful presentations from Markdown. Write your slides in plain text, style them with themes, and present directly from Obsidian.

<img width="1728" height="1084" alt="Perspecta Slides UI" src="https://github.com/user-attachments/assets/7ba62593-ba0b-4efd-acdf-6b24dc58b4f0" />

## Features

### Presentation Design

- **Built-in theme** - Default theme with dynamic gradient backgrounds and light/dark mode support
- **Custom themes** - Save your design settings as reusable themes with bundled fonts
- **Google Fonts** - Download and cache fonts locally for offline presentations
- **Typography control** - Font selection, size scaling, weight, spacing, and line height
- **Semantic colors** - Customizable colors for links, bullets, blockquotes, tables, and code
- **Per-heading colors** - Different colors for H1, H2, H3, H4 headings
- **Gradient backgrounds** - Dynamic slide-position-based gradient backgrounds
- **Global text scale** - Scale all typography 0.5x to 2.0x without changing theme defaults

### Slide Layouts

- **Auto-detection** - Default layout intelligently detects columns from content structure
- **Column layouts** - 1, 2, or 3 columns with equal or weighted ratios (1+2, 2+1)
- **Image layouts** - Full-bleed, half-image (vertical/horizontal split), caption, and grid
- **Special layouts** - Cover, title, and section divider slides
- **Content margins** - Customizable header, footer, title, and content positioning
- **Layout backgrounds** - Per-layout background colors or gradients

### Images & Media

- **Obsidian integration** - Use `![[image.png]]` wiki-links or standard Markdown `![](image.jpg)`
- **Full-bleed images** - Edge-to-edge images with `object-fit: cover` for cinematic layouts
- **Image positioning** - Control focal point with `x` and `y` parameters
- **Background images** - Per-slide backgrounds with opacity control
- **Multiple images** - Grid and split layouts for photo-heavy slides
- **Image filters** - Darken, lighten, blur, grayscale, and sepia effects

### Excalidraw Integration

- **Native rendering** - Embed Excalidraw drawings directly with automatic SVG conversion
- **Frame references** - `![[drawing#^frame=FrameName]]` shows frame contents in full (elements not clipped)
- **Clipped frames** - `![[drawing#^clippedframe=FrameName]]` clips elements at frame boundary like a window
- **Group references** - `![[drawing#^group=elementID]]` shows grouped elements
- **Area references** - `![[drawing#^area=elementID]]` shows cropped view around element
- **Smart caching** - Automatic cache invalidation when Excalidraw files are modified

### Content Features

- **Speaker notes** - Regular paragraphs become notes visible only to you
- **Footnotes** - Reference footnotes with `[^id]` syntax, rendered with hanging numbers
- **Wiki-link stripping** - `[[page]]` renders as "page" when links are disabled
- **Newline support** - `\n` and actual newlines render as `<br />` in HTML
- **Comments** - Use `//` for hidden comments
- **Code blocks** - Automatic syntax highlighting
- **Tables** - Full Markdown table support with styled headers
- **Nested lists** - Multi-level lists with visual hierarchy

### Presentation Mode

- **Frameless window** - Clean, distraction-free presentation window
- **Aspect ratio locking** - 16:9, 4:3, or 16:10 with automatic letterboxing
- **Keyboard navigation** - Arrow keys, space, home/end, escape to exit
- **Click navigation** - Click left/right thirds to navigate slides
- **Smooth transitions** - Fade, slide, or instant transitions

### Editor Integration

- **Thumbnail navigator** - Visual slide overview in the left sidebar
- **Drag-and-drop reordering** - Rearrange slides visually
- **Inspector panel** - Edit properties, layouts, and design in the right sidebar
- **Live preview** - Changes update automatically with debounced refresh
- **Cursor sync** - Navigator highlights the slide at cursor position
- **Demo presentation** - Create demo presentation button for quick setup with auto font installation

### Export

- **HTML export** - Standalone HTML with embedded styles and navigation
- **Keyboard controls** - Exported presentations include full navigation
- **Theme toggle** - Light/dark mode switch in exported files
- **Help overlay** - Press `?` for keyboard shortcuts
- **External images** - Images extracted to separate folder for smaller HTML
- **Progress bar** - Visual slide position indicator in exported presentations

### Presenter View

- **Current slide** - Large view of what your audience sees
- **Speaker notes** - Prominently displayed with paragraph navigation
- **Timer** - Track elapsed time with play/pause/reset controls
- **Slide focus / Text focus** - Toggle between seeing slides or notes prominently
- **Dual-monitor support** - Electron-based presenter window for external displays

<img width="600" height="420" alt="Presenter View" src="https://github.com/user-attachments/assets/1c53b40c-1ab5-4d0f-a6c7-9f234480cb4b" />


## Known Issues

- **UI rendering with Obsidian 1.11 on Windows**  
  Issues with UI and font rendering in Obsidian 1.11 on Windows, related to the new Electron version.

- **Non-slide Markdown files**  
  Currently, any Markdown file can be opened as a preview/slide deck regardless of its content, which can lead to unexpected behavior or rendering issues.

- **Delayed initialization**  
  In some cases, the slide navigator (left sidebar), the inspector (right sidebar), or the preview window does not reflect the currently active file. Re-clicking the **“Open slide presentation”** icon in the Obsidian ribbon usually resolves this.

- **Themes and Obsidian Sync**  
   Custom themes that include images or fonts may not fully sync via Obsidian Sync due to binary file sync limitations. See [THEME_SYNC_GUIDE.md](THEME_SYNC_GUIDE.md) for comprehensive troubleshooting and best practices to ensure complete theme synchronization across devices.

- **Footnote slide layout overflow**  
  The footnotes slide layout does not currently handle large numbers of footnotes. If the content exceeds the available space, it is not automatically split across multiple slides.

- **Limited per-layout settings**  
  The plan is to provide each slide layout with a set of presentation-wide overrides stored in the theme. This would remove the need to repeat the same settings on individual slides.

- **Growing frontmatter due to overrides**  
  Presentation-wide overrides are currently stored in frontmatter. Heavy customization can lead to a large number of entries. Custom themes should persist overrides as new defaults so that values matching the theme defaults can be removed from the frontmatter.

---

## Disclaimer

- **Intended trade-off**  
  Perspecta Slides is designed as a *rapid* presentation tool once a theme has been adjusted to your needs. To reduce design effort for authors, it makes assumptions about slide layout (e.g. column detection, text placement in predefined slide layouts).

- **Not a “design anything” tool**  
  Design decisions are intentionally moved into the theme, minimizing layout instructions within individual slides. There is no design mode with freely placeable text areas. The plugin targets users for whom the provided presets and customization options are sufficient. Currently, slide layouts, design options, and overrides are hardcoded. Exposing layouts as separate slide-layout files may be considered in the future.

---

## Quick Start

### Basic Slide Structure

Separate slides with `---` (horizontal rule):

```markdown
# First Slide

Content here

---

# Second Slide

More content
```

### Speaker Notes vs. Visible Content

- **Headings** (`#`, `##`, etc.) → Visible on slide
- **Tab-indented content** → Visible on slide
- **Regular paragraphs** → Speaker notes (only you see them)

```markdown
# Welcome

This is content on the slide!

Notes:
This paragraph is a speaker note.

- This list appears in the speaker notes
- So does this one

More notes for the presenter.
```

### Images

```markdown
![[my-image.png]]
![[folder/photo.jpg]]
![Alt text](path/to/image.png)
```

### Excalidraw Drawings

Embed Excalidraw drawings with optional reference types:

```markdown
![[drawing.excalidraw]]
![[drawing#^frame=MyFrame]]
![[drawing#^clippedframe=MyFrame]]
![[drawing#^group=elementID]]
![[drawing#^area=elementID]]
```

| Reference Type | Description |
| --- | --- |
| `frame=` | Shows frame contents in full (elements extend beyond frame if needed) |
| `clippedframe=` | Clips elements at frame boundary like a window/mask, zero padding |
| `group=` | Shows all elements in the same group |
| `area=` | Cropped view around element's bounding box |

Frames can be referenced by name or ID. Groups and areas can reference elements by ID or section heading (`# Heading`).

### Comments

```markdown
// Hidden from everyone - slide and speaker notes
```

### Footnotes

```markdown
This statement needs a citation[^1].

[^1]: Source: Research Paper, 2024
```

---

## YAML Frontmatter

Configure your presentation at the top of the file:

```yaml
---
title: My Presentation
author: Your Name
theme: default

# Typography
titleFont: Helvetica
titleFontWeight: 700
bodyFont: Georgia
bodyFontWeight: 400
textScale: 1.0
lineHeight: 1.1

# Colors (optional overrides)
lightLinkColor: '#0066cc'
darkLinkColor: '#66b3ff'

# Header/Footer
headerLeft: 'Company Name'
footerRight: '{{slideNumber}}'

# Settings
aspectRatio: '16:9'
lockAspectRatio: true
transition: fade
mode: light
---
```

---

## Per-Slide Settings

Add metadata at the beginning of any slide:

```markdown
---

layout: title
mode: dark
background: hero-image.jpg
opacity: 50%

# Dark Title Slide

With a background image
```

### Available Layouts

| Layout                  | Description                                |
| ----------------------- | ------------------------------------------ |
| `default`               | Auto-detects columns from content          |
| `title`                 | Centered title slide                       |
| `section`               | Section divider with accent background     |
| `cover`                 | Opening/closing slide (no header/footer)   |
| `half-image`            | Vertical split (image + text side by side) |
| `half-image-horizontal` | Horizontal split (stacked)                 |
| `caption`               | Full image with title bar and caption      |
| `full-image`            | Edge-to-edge image(s)                      |
| `1-column`              | Single column layout                       |
| `2-columns`             | Two equal columns                          |
| `3-columns`             | Three equal columns                        |
| `2-columns-1+2`         | Narrow left, wide right                    |
| `2-columns-2+1`         | Wide left, narrow right                    |
| `footnotes`             | Slide with footnotes section at bottom     |

---

## Themes

### Built-in Theme

- **default** - Clean, professional theme with Inter font and dynamic gradient backgrounds

```yaml
---
theme: default
---
```

### Custom Themes

1. Customize your presentation using the Inspector panel
2. Run **"Save as custom theme"** from the command palette
3. Enter a name for your theme

Custom themes include fonts, colors, typography, and margin settings. They appear in dropdowns with a ★ marker.

#### Syncing Themes Across Devices

Custom themes are stored in the vault (`perspecta-themes/` folder) and can be synced via Obsidian Sync. However, binary files (fonts and images) may have sync issues on some devices.

**For reliable multi-device syncing:**
- See [THEME_SYNC_GUIDE.md](THEME_SYNC_GUIDE.md) for detailed setup instructions
- Text files (theme.json, theme.css) always sync reliably
- Fonts and images may need manual setup on secondary devices
- Prefer system fonts and minimize image sizes for better compatibility

---

## Commands

| Command                | Description                             |
| ---------------------- | --------------------------------------- |
| Open presentation view | Opens current file in presentation view |
| Toggle slide navigator | Show/hide thumbnail navigator           |
| Toggle slide inspector | Show/hide inspector panel               |
| Start presentation     | Fullscreen presentation window          |
| Start presenter view   | Speaker view with notes and timer       |
| Export to HTML         | Export as standalone HTML               |
| Save as custom theme   | Save current settings as theme          |
| Insert slide separator | Insert `---` at cursor                  |

---

## Keyboard Shortcuts

### In Presentation Mode

| Key                        | Action                         |
| -------------------------- | ------------------------------ |
| `→` `↓` `Space` `PageDown` | Next slide                     |
| `←` `↑` `PageUp`           | Previous slide                 |
| `Home`                     | First slide                    |
| `End`                      | Last slide                     |
| `Escape`                   | Exit fullscreen / Close window |

### In Presenter View

| Key     | Action              |
| ------- | ------------------- |
| `↑` `↓` | Navigate slides     |
| `←` `→` | Navigate paragraphs |

---

## Installation

> **Note**: Perspecta Slides is currently in early development. Installation via the BRAT plugin is required until it reaches the Obsidian Community Plugins registry.

### Install via BRAT (Recommended)

1. Install the [BRAT plugin](https://github.com/TfTHacker/obsidian42-brat) if you haven't already:
   - Open Settings → Community plugins
   - Click "Browse" and search for "BRAT"
   - Install and enable BRAT

2. Add Perspecta Slides to BRAT:
   - Open the BRAT plugin settings
   - Click "Add Beta Plugin"
   - Paste the repository URL: `https://github.com/owrede/perspecta-slides`
   - Click "Add Plugin"

3. Enable the plugin:
   - Go to Settings → Community plugins
   - Search for "Perspecta Slides"
   - Click the toggle to enable

### Manual Installation

1. Download the latest release from [GitHub Releases](https://github.com/owrede/perspecta-slides/releases)
2. Extract the files to `.obsidian/plugins/perspecta-slides/`
3. Reload Obsidian or go to Settings → Community plugins and enable "Perspecta Slides"

---

## License

MIT License - see [LICENSE](LICENSE) for details.
