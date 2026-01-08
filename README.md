# Perspecta Slides

An Obsidian plugin for creating presentations from Markdown, inspired by [iA Presenter](https://ia.net/presenter).

## Features

- **iA Presenter-style syntax**: Write presentations using familiar Markdown with the same conventions as iA Presenter
- **Thumbnail navigator**: See all your slides at a glance in the left sidebar with drag-and-drop reordering
- **Inspector panel**: Edit slide properties, layouts, and design settings in the right sidebar
- **Multiple themes**: Built-in themes with customizable colors and fonts
- **Custom themes**: Save your design settings as reusable custom themes with bundled fonts
- **Google Fonts**: Download and cache fonts locally for offline presentations
- **HTML export**: Export your presentations as standalone HTML files
- **Speaker notes**: Regular paragraphs become speaker notes visible only to you
- **Presentation mode**: Present directly from Obsidian in a frameless window with aspect ratio locking
- **Presenter view**: See current slide, next slide preview, speaker notes, and timer in one view
- **Transitions**: Fade and slide transitions between slides
- **Code highlighting**: Automatic syntax highlighting for code blocks
- **Kickers**: Small text above headings using `^` syntax
- **Live sync**: Changes in the editor automatically update the preview with incremental updates
- **Obsidian image support**: Use `![[image.png]]` wiki-links or standard `![](image.jpg)` syntax
- **Full-bleed images**: Edge-to-edge images with `object-fit: cover` for cinematic layouts
- **Header/footer slots**: Customizable header and footer with left, middle, and right positions
- **Typography control**: Per-slide font selection, size scaling, spacing, and line height adjustments
- **Semantic colors**: Customizable colors for links, bullets, blockquotes, code, and more

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
titleFontWeight: 700
bodyFont: Georgia
bodyFontWeight: 400
textScale: 1.0           # Multiplier for all text sizes (0.65 = 65%, 1.5 = 150%)
titleFontSize: 0         # Percentage offset: -20 = 20% smaller, 10 = 10% larger
bodyFontSize: 0
lineHeight: 1.1

# Semantic Colors
lightLinkColor: "#0066cc"
darkLinkColor: "#66b3ff"
lightBoldColor: "#000000"
darkBoldColor: "#ffffff"

# Header/Footer
headerLeft: "Company Name"
headerMiddle: "Presentation Title"
headerRight: ""
footerLeft: ""
footerMiddle: ""
footerRight: "Page {{slideNumber}}"

# Settings
aspectRatio: "16:9"
lockAspectRatio: false   # Lock aspect ratio with letterbox/pillarbox
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

Perspecta Slides comes with built-in themes you can use or customize:

- **zurich** - Minimal Swiss design with clean typography
- **kyoto** - Dynamic gradient theme with soft pastel colors
- **berlin** - Professional theme with deep blue tones
- **minimal** - Ultra-clean minimal design with generous whitespace

Set your theme in the frontmatter:

```yaml
---
theme: kyoto
---
```

### Custom Themes

Create your own reusable themes from your current presentation settings:

1. Customize your presentation using the Inspector (fonts, colors, typography, margins)
2. Run **"Perspecta Slides: Save as custom theme"** from the command palette
3. Enter a name for your theme
4. Your theme is saved to the custom themes folder (default: `perspecta-themes/`)

Custom themes include:
- Font selections and weights (including cached Google Fonts)
- All color settings (light/dark mode, accents, per-heading colors)
- Typography settings (sizes, spacing, line height)
- Margin settings (header, footer, title, content positions)

Custom themes appear in theme dropdowns with a ★ marker. Manage your custom themes in **Settings → Themes**.

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
- **Save as custom theme**: Save current presentation settings as a reusable theme

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
