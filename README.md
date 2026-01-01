# Perspecta Slides

An Obsidian plugin for creating presentations from Markdown, inspired by [iA Presenter](https://ia.net/presenter).

## Features

- **iA Presenter-style syntax**: Write presentations using familiar Markdown with the same conventions as iA Presenter
- **Thumbnail navigator**: See all your slides at a glance in the left sidebar
- **Inspector panel**: Edit slide properties, layouts, and design settings in the right sidebar
- **Themes**: Customizable themes with support for colors, fonts, and layouts
- **HTML export**: Export your presentations as standalone HTML files
- **Speaker notes**: Regular paragraphs become speaker notes visible only to you
- **Presentation mode**: Present directly from Obsidian

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

```markdown
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

# Colors
accent1: "#000000"
accent2: "#43aa8b"
accent3: "#f9c74f"

# Header/Footer
headerLeft: "Company Name"
footerRight: "{{slideNumber}}"

# Settings
aspectRatio: "16:9"
showSlideNumbers: true
showProgress: true
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

- `default` - Standard content slide
- `title` - Centered title slide
- `section` - Section divider (dark background)
- `v-split` - Vertical split (text + image side by side)
- `caption` - Image with caption below
- `full-image` - Full-bleed image
- `grid` - Grid layout for multiple images

## Commands

- **Open presentation view**: Opens the current file in presentation view
- **Toggle slide navigator**: Show/hide the thumbnail navigator
- **Toggle slide inspector**: Show/hide the inspector panel
- **Export presentation to HTML**: Export as standalone HTML
- **Start presentation**: Open presentation in a new window
- **Insert slide separator**: Insert `---` at cursor

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
