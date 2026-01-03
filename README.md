# Perspecta Slides

An Obsidian plugin for creating presentations from Markdown, inspired by [iA Presenter](https://ia.net/presenter).

## Features

- **iA Presenter-style syntax**: Write presentations using familiar Markdown with the same conventions as iA Presenter
- **Thumbnail navigator**: See all your slides at a glance in the left sidebar with drag-and-drop reordering
- **Inspector panel**: Edit slide properties, layouts, and design settings in the right sidebar
- **Multiple themes**: Built-in themes (Zurich, Tokyo, Berlin, Minimal, Helvetica, Basel, Copenhagen) with customizable colors and fonts
- **HTML export**: Export your presentations as standalone HTML files
- **Speaker notes**: Regular paragraphs become speaker notes visible only to you
- **Presentation mode**: Present directly from Obsidian in a frameless window
- **Presenter view**: See current slide, next slide preview, speaker notes, and timer in one view
- **Transitions**: Fade and slide transitions between slides
- **Code highlighting**: Automatic syntax highlighting for code blocks
- **Kickers**: Small text above headings using `^` syntax
- **Live sync**: Changes in the editor automatically update the preview with incremental updates
- **Obsidian image support**: Use `![[image.png]]` wiki-links or standard `![](image.jpg)` syntax
- **Full-bleed images**: Edge-to-edge images with `object-fit: cover` for cinematic layouts
- **Header/footer slots**: Customizable header and footer with left, middle, and right positions

## Markdown Syntax

Perspecta Slides follows iA Presenter's Markdown conventions:

### Slide Separators

Use `---` (horizontal rule) to separate slides:

```markdown
# First Slide

Content here

---

# Second Slide

More content
```

### Speech vs. Text on Slide

- **Regular paragraphs** = Speaker notes (only you see them)
- **Headings** (`#`, `##`, etc.) = Visible on slide
- **Tab-indented content** = Visible on slide
- **Kickers** (`^text`) = Small text above headings

```markdown
^Small kicker text
# Visible Title

This paragraph is a speaker note - only you see it during presentation.

	- This list item appears on the slide (tab-indented)
	- So does this one

More speaker notes here.
```

### Comments

Use `//` at the start of a line for comments that are hidden from everyone:

```markdown
// This is a comment - hidden from slide and speaker notes
```

### Images

Both Obsidian wiki-links and standard Markdown syntax are supported:

```markdown
![[my-image.png]]
![[folder/photo.jpg]]
![Alt text](path/to/image.png)
![](https://example.com/image.jpg)
```

Images automatically fill their containers using `object-fit: cover` for a cinematic look.

## YAML Frontmatter

Configure your presentation with YAML frontmatter:

```yaml
---
title: My Presentation
author: Your Name
theme: zurich

# Typography
titleFont: Helvetica
bodyFont: Georgia
fontSizeOffset: 0     # Percentage: -20 = 20% smaller, 10 = 10% larger
contentTopOffset: 0   # Percentage: push column content down (0-20%)

# Colors
accent1: "#000000"
accent2: "#43aa8b"
accent3: "#f9c74f"

# Header/Footer
headerLeft: "Company Name"
headerMiddle: "Presentation Title"
headerRight: ""
footerLeft: ""
footerMiddle: ""
footerRight: "{{slideNumber}}"

# Settings
aspectRatio: "16:9"
showSlideNumbers: true
showProgress: true
transition: fade
---
```

## Per-Slide Settings

Add metadata at the beginning of any slide:

```markdown
---

layout: title
mode: dark
background: image.jpg
opacity: 50%

# Dark Title Slide

With a background image
```

### Available Layouts

- `default` - Standard content slide (auto-detects columns)
- `title` - Centered title slide
- `section` - Section divider
- `cover` - Opening/closing slide
- `half-image` - Vertical split (image + text side by side)
- `half-image-horizontal` - Horizontal split (image + text stacked)
- `caption` - Image with title bar and caption
- `full-image` - Full-bleed image(s)
- `grid` - Grid layout for multiple items

## Themes

Perspecta Slides includes seven built-in themes:

- **zurich** - Minimal Swiss design with clean typography
- **tokyo** - Dark theme with vibrant neon accents
- **berlin** - Professional theme with deep blue tones
- **minimal** - Ultra-clean minimal design with generous whitespace
- **helvetica** - Classic typography focus with professional design
- **basel** - Swiss serif typography with Noto Serif font
- **copenhagen** - Nordic elegance with Albert Sans font

Set your theme in the frontmatter:

```yaml
---
theme: tokyo
---
```

## Transitions

Three transition styles are available:

- `fade` - Smooth opacity transition (default)
- `slide` - Slides move horizontally
- `none` - Instant transition

```yaml
---
transition: slide
---
```

## Commands

- **Open presentation view**: Opens the current file in presentation view
- **Toggle slide navigator**: Show/hide the thumbnail navigator
- **Toggle slide inspector**: Show/hide the inspector panel
- **Export presentation to HTML**: Export as standalone HTML
- **Start presentation**: Open presentation in a new window (fullscreen)
- **Insert slide separator**: Insert `---` at cursor

## Presenter View

The Presenter View gives you a professional presentation experience:

- **Current slide**: Large view of what your audience sees
- **Next slide preview**: See what's coming up
- **Speaker notes**: Your notes displayed prominently
- **Timer**: Track elapsed time during your presentation
- **Navigation**: Controls for moving through slides

Access it via the "Presenter View" button in the toolbar.

## Installation

### From Obsidian Community Plugins

1. Open Settings → Community plugins
2. Click "Browse" and search for "Perspecta Slides"
3. Install and enable the plugin

### Manual Installation

1. Download the latest release from GitHub
2. Extract to your vault's `.obsidian/plugins/perspecta-slides/` folder
3. Enable the plugin in Settings → Community plugins

## Development

```bash
# Clone the repository
git clone https://github.com/owrede/perspecta-slides.git

# Install dependencies
npm install

# Build for development (with watch)
npm run dev

# Build for production
npm run build
```

## License

MIT License - see [LICENSE](LICENSE) for details.

## Credits

Inspired by [iA Presenter](https://ia.net/presenter) by iA Inc.
