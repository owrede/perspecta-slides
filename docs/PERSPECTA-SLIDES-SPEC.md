# Perspecta Slides Specification

**Use this specification when creating presentations for Perspecta Slides in Obsidian.**

## Overview

Perspecta Slides uses Markdown with YAML frontmatter to create presentations. Slides are separated by `---` (horizontal rules). The plugin supports two content modes: `ia-presenter` (default) and `advanced-slides`.

---

## Frontmatter (Required)

Every presentation starts with YAML frontmatter:

```yaml
---
title: "Presentation Title"
author: "Author Name"
theme: zurich
contentMode: advanced-slides

# Typography (optional)
titleFont: "Helvetica, Arial, sans-serif"
bodyFont: "Georgia, serif"
fontSizeOffset: 0
contentTopOffset: 0

# Colors (optional - override theme)
accent1: "#000000"
accent2: "#43aa8b"
accent3: "#f9c74f"

# Header/Footer (optional)
headerLeft: "Company Name"
headerMiddle: ""
headerRight: ""
footerLeft: ""
footerMiddle: ""
showSlideNumbers: true

# Settings
aspectRatio: "16:9"
transition: fade
---
```

### Key Frontmatter Properties

| Property | Values | Description |
|----------|--------|-------------|
| `theme` | `zurich`, `tokyo`, `berlin`, `minimal`, `helvetica`, `basel`, `copenhagen` | Visual theme |
| `contentMode` | `ia-presenter`, `advanced-slides` | How content vs notes are distinguished |
| `fontSizeOffset` | -50 to 50 | Percentage to scale all fonts |
| `contentTopOffset` | 0 to 20 | Push column content down (%) |
| `transition` | `fade`, `slide`, `none` | Slide transition effect |
| `aspectRatio` | `16:9`, `4:3`, `16:10` | Slide aspect ratio |

---

## Slide Structure

### Slide Separator

Use `---` on its own line to separate slides:

```markdown
# First Slide

Content here

---

# Second Slide

More content
```

### Per-Slide Metadata

Add metadata at the start of any slide (after the separator):

```markdown
---

layout: title
mode: dark
background: image.jpg
opacity: 50%
class: my-custom-class

# Slide Title
```

---

## Layouts

### Standard Layouts

| Layout | Use Case |
|--------|----------|
| `default` | Standard content slide, auto-detects columns |
| `title` | Centered title slide with large heading |
| `cover` | Opening/closing slide, centered |
| `section` | Chapter divider with accent background |

### Column Layouts

| Layout | Description |
|--------|-------------|
| `1-column` | Single column, no auto-detection |
| `2-columns` | Two equal columns (50/50) |
| `3-columns` | Three equal columns |
| `2-columns-1+2` | Narrow left (1/3), wide right (2/3) |
| `2-columns-2+1` | Wide left (2/3), narrow right (1/3) |

### Image Layouts

| Layout | Description |
|--------|-------------|
| `full-image` | Image(s) fill entire slide edge-to-edge |
| `half-image` | Vertical split: left/right halves (image first = image on left) |
| `half-image-horizontal` | Horizontal split: top/bottom halves (image first = image on top) |
| `caption` | Image with title bar on top, optional caption below |

---

## Content Syntax (advanced-slides mode)

In `advanced-slides` mode, all content is visible on the slide by default. Use `note:` to mark speaker notes.

### Headings

```markdown
# H1 - Main Title (largest)
## H2 - Section Title
### H3 - Subsection / Column Header
#### H4 - Smaller heading
##### H5 - Even smaller
###### H6 - Smallest
```

### Text Formatting

```markdown
**Bold text**
*Italic text*
==Highlighted text==
`inline code`
[Link text](https://example.com)
```

### Lists

```markdown
- Bullet point
- Another point
  - Nested point

1. Numbered item
2. Second item
```

### Images

```markdown
![[image-name.png]]
![[folder/image.jpg]]
![Alt text](path/to/image.png)
![](https://example.com/image.jpg)
```

### Code Blocks

````markdown
```javascript
const greeting = "Hello World";
console.log(greeting);
```
````

### Speaker Notes

```markdown
# Slide Title

Visible content here.

note:
This is a speaker note - only visible in presenter view.
More notes can go here.
```

---

## Multi-Column Content

Columns are auto-detected when you use multiple H3 headings:

```markdown
---

layout: default

### Column 1
Content for first column

### Column 2
Content for second column

### Column 3
Content for third column
```

Or explicitly set the layout:

```markdown
---

layout: 2-columns

### Left Side
- Point A
- Point B

### Right Side
- Point X
- Point Y
```

---

## Image Layouts

### Full-Image (Single)

```markdown
---

layout: full-image

![[hero-image.jpg]]
```

### Full-Image (Multiple)

```markdown
---

layout: full-image

![[image1.jpg]]
![[image2.jpg]]
![[image3.jpg]]
![[image4.jpg]]
```

- 2 images: side-by-side
- 3 images: three columns
- 4 images: 2×2 grid
- 5 images: 2 on top, 3 on bottom
- 6 images: 3×2 grid

### Caption Layout

```markdown
---

layout: caption

# Photo Title

![[landscape.jpg]]

Photo credit: Photographer Name
```

### Half-Image Layout (Vertical Split)

Image on left, text on right (because image comes first):

```markdown
---

layout: half-image

![[diagram.png]]

## Explanation

This diagram shows the architecture.

- Component A
- Component B
```

Text on left, image on right (because text comes first):

```markdown
---

layout: half-image

## Explanation

This diagram shows the architecture.

![[diagram.png]]
```

### Half-Image Horizontal Layout (Horizontal Split)

Image on top, text on bottom:

```markdown
---

layout: half-image-horizontal

![[hero-image.jpg]]

## Key Points

- Point one
- Point two
```

Text on top, image on bottom:

```markdown
---

layout: half-image-horizontal

## Key Points

- Point one
- Point two

![[supporting-image.jpg]]
```

---

## Light/Dark Mode

Set per-slide appearance:

```markdown
---

layout: section
mode: dark

# Dark Section Divider
```

---

## Complete Example Presentation

```markdown
---
title: "Product Launch 2024"
author: "Marketing Team"
theme: zurich
contentMode: advanced-slides
fontSizeOffset: -5
headerLeft: "Acme Corp"
showSlideNumbers: true
transition: fade
---

layout: cover
mode: dark

# Product Launch 2024
## Revolutionizing the Industry

---

layout: section

# The Problem

---

# Current Challenges

### Pain Point 1
Users struggle with complex interfaces

### Pain Point 2
Slow processing times

### Pain Point 3
Limited integrations

note:
Emphasize the frustration users feel daily.

---

layout: full-image

![[product-hero.jpg]]

---

layout: caption

# The Solution

![[product-screenshot.png]]

Introducing ProductX - Simple. Fast. Connected.

---

# Key Features

### Speed
- 10x faster processing
- Real-time updates
- Instant sync

### Simplicity
- One-click actions
- Intuitive design
- Zero learning curve

### Integration
- 500+ connectors
- Open API
- Custom webhooks

---

layout: 2-columns-1+2

### Pricing

Starting at $99/month

![[pricing-table.png]]

---

layout: title
mode: dark

# Thank You

Questions?

contact@acme.com
```

---

## Best Practices

1. **Start with a cover slide** - Use `layout: cover` with `mode: dark` for impact
2. **Use section dividers** - Break content into logical chapters with `layout: section`
3. **Limit text per slide** - Aim for 3-5 bullet points maximum
4. **Use columns for comparisons** - H3 headings auto-create columns
5. **Full-bleed images** - Use `layout: full-image` for visual impact
6. **Consistent theme** - Stick to one theme throughout
7. **Speaker notes** - Add `note:` sections for presentation guidance
8. **Test font scaling** - Adjust `fontSizeOffset` if text is too large/small

---

## Theme Reference

| Theme | Style |
|-------|-------|
| `zurich` | Minimal Swiss design, clean typography |
| `tokyo` | Dark theme with vibrant neon accents |
| `berlin` | Professional, deep blue tones |
| `minimal` | Ultra-clean with generous whitespace |
| `helvetica` | Classic typography focus |
| `basel` | Swiss serif with Noto Serif font |
| `copenhagen` | Nordic elegance, Albert Sans font |
