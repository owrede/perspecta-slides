# Perspecta Slides - Image System Design

## Overview

Images in Perspecta Slides fill their containers completely using `object-fit: cover`, ensuring no letterboxing or pillarboxing. This creates a cinematic, professional look where images always fill the available space.

## Supported Image Syntax

### Obsidian Wiki Links (Recommended)
```markdown
![[image.png]]
![[folder/image.jpg]]
![[My Image.png]]
```

### Standard Markdown
```markdown
![alt text](image.png)
![](path/to/image.jpg)
```

### External URLs
```markdown
![](https://example.com/image.jpg)
```

## Image Metadata (Future)

Following lines after an image can specify metadata (similar to iA Presenter):

```markdown
![[hero-image.jpg]]
size: cover          # cover (default) | contain
x: center            # left | center (default) | right | 25% | 50px
y: center            # top | center (default) | bottom | 25% | 50px
zoom: 100%           # 100% (default) | 150% | 200%
filter: none         # none | darken | lighten | blur | grayscale | sepia
opacity: 100%        # 0-100%
caption: Photo by X  # On-image caption
```

## Image Layouts

### `full-image` Layout
First image fills the entire slide. No padding, no margins.

```markdown
---
layout: full-image

![[hero.jpg]]
```

**Rendering:**
- Image uses `object-fit: cover` to fill entire slide
- `object-position` defaults to `center center`
- Can be adjusted with `x:` and `y:` metadata

### Multiple Images in `full-image`
Multiple images split the space:
- 2 images: horizontal split (50/50)
- 3+ images: grid layout

### `half-image` Layout
Half for image(s), half for text content.

### `caption` Layout  
Full image with title bar at top and optional caption at bottom.

### Background Images
Any layout can have a background image via slide metadata:

```markdown
---
layout: default
background: ![[bg.jpg]]
backgroundOpacity: 50%

# Title
Content here
```

## Implementation Notes

### Parser Changes
1. Detect `![[...]]` Obsidian syntax in addition to `![](...)` 
2. Parse metadata lines following images (indented or key: value format)
3. Store metadata in `SlideElement.imageData`

### Renderer Changes
1. All images use `object-fit: cover` by default
2. Apply `object-position` from x/y metadata
3. Apply CSS filters from filter/opacity metadata
4. Render captions as overlays when specified

### Obsidian Integration
- Use `app.vault.getResourcePath()` to resolve `![[...]]` paths
- Handle both absolute and relative paths
- Support attachments folder configuration

## CSS for Cover Behavior

```css
.image-slot {
  position: relative;
  overflow: hidden;
}

.image-slot img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: var(--image-x, center) var(--image-y, center);
}

/* Full image layout - no padding */
.layout-full-image {
  padding: 0 !important;
}

.layout-full-image .slide-body {
  margin: 0;
}

.layout-full-image .slide-content {
  padding: 0;
}

.layout-full-image .image-slot {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}
```

## Phase 1 Implementation (Current)

1. ✅ Support standard markdown image syntax `![](path)`
2. 🔄 Add Obsidian `![[image]]` syntax support
3. 🔄 Ensure `full-image` layout fills entire slide with `object-fit: cover`
4. ⏳ Basic x/y positioning metadata

## Phase 2 (Future)

- Zoom control
- Filter effects (darken, lighten, blur, etc.)
- On-image captions
- Image cropping UI in inspector
