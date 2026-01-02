# Perspecta Slides Theme Specification

Based on iA Presenter theme concepts with extensions for column layouts.

## Theme Directory Structure

A theme is a self-contained directory that can be copied to share the complete theme:

```
my-theme/
├── template.json       # Theme metadata and configuration
├── presets.json        # Color presets (light/dark modes)
├── theme.css           # Main CSS styling
├── template.png        # Theme thumbnail preview (optional)
├── logo.png            # Default logo for this theme (optional)
├── fonts/              # Custom font files (optional)
│   ├── MyFont-Regular.woff2
│   └── MyFont-Bold.woff2
└── assets/             # Images, patterns, backgrounds (optional)
    ├── pattern.svg
    └── background.jpg
```

## template.json

Theme metadata and configuration:

```json
{
  "Name": "My Theme",
  "Version": "1.0.0",
  "Author": "Your Name",
  "ShortDescription": "A brief tagline...",
  "LongDescription": "Detailed description of the theme.\n- Feature 1\n- Feature 2",
  "Css": "theme.css",
  "TitleFont": "Display Font Name",
  "BodyFont": "Body Font Name",
  "CssClasses": "fixed-size-headings",
  "LayoutExamples": [
    {
      "Name": "Example Slide",
      "Markdown": "# Sample Title\n\n\tSample content"
    }
  ]
}
```

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `Name` | string | Display name of the theme |
| `Version` | string | Semantic version (e.g., "1.0.0") |
| `Author` | string | Theme creator |
| `ShortDescription` | string | Brief tagline for theme picker |
| `LongDescription` | string | Full description with features |
| `Css` | string | Filename of the theme CSS |
| `TitleFont` | string | Display name of title font |
| `BodyFont` | string | Display name of body font |
| `CssClasses` | string | Space-separated CSS classes to apply |
| `LayoutExamples` | array | Example slides for theme preview |

### CssClasses Options

- `fixed-size-headings` - All heading levels use the same size (Swiss style)
- `variable-size-headings` - H1 > H2 > H3 with decreasing sizes

## presets.json

Color presets define the theme's color palette:

```json
{
  "Presets": [
    {
      "Name": "Default",
      "TitleFont": "Helvetica Neue",
      "BodyFont": "Helvetica Neue",
      "Appearance": "light",
      
      "DarkBodyTextColor": "#000000",
      "LightBodyTextColor": "#ffffff",
      "DarkTitleTextColor": "#000000",
      "LightTitleTextColor": "#ffffff",
      "DarkBackgroundColor": "#000000",
      "LightBackgroundColor": "#ffffff",
      
      "DarkAccent1": "#000000",
      "LightAccent1": "#ffffff",
      "Accent1": "#000000",
      "Accent2": "#43aa8b",
      "Accent3": "#f9c74f",
      "Accent4": "#90be6d",
      "Accent5": "#f8961e",
      "Accent6": "#577590",
      
      "LightBgGradient": ["#color1", "#color2", "..."],
      "DarkBgGradient": ["#color1", "#color2", "..."]
    }
  ]
}
```

### Preset Fields

| Field | Description |
|-------|-------------|
| `Name` | Preset name (e.g., "Default", "Light", "Dark") |
| `Appearance` | Default appearance: "light" or "dark" |
| `TitleFont` | Font family for titles |
| `BodyFont` | Font family for body text |
| `DarkBodyTextColor` | Body text on dark backgrounds |
| `LightBodyTextColor` | Body text on light backgrounds |
| `DarkTitleTextColor` | Title text on dark backgrounds |
| `LightTitleTextColor` | Title text on light backgrounds |
| `DarkBackgroundColor` | Dark mode background |
| `LightBackgroundColor` | Light mode background |
| `DarkAccent1` | Accent 1 for dark mode |
| `LightAccent1` | Accent 1 for light mode |
| `Accent1`-`Accent6` | Six accent colors for variety |
| `LightBgGradient` | Array of colors for light background gradients |
| `DarkBgGradient` | Array of colors for dark background gradients |

## theme.css

The CSS file styles all slide elements. CSS variables are automatically generated from presets.

### Available CSS Variables

```css
:root {
  /* Fonts */
  --title-font: "Helvetica Neue", sans-serif;
  --body-font: "Helvetica Neue", sans-serif;
  
  /* Colors from preset */
  --dark-body-text: #000000;
  --light-body-text: #ffffff;
  --dark-title-text: #000000;
  --light-title-text: #ffffff;
  --dark-background: #000000;
  --light-background: #ffffff;
  
  --dark-accent1: #000000;
  --light-accent1: #ffffff;
  --accent1: #000000;
  --accent2: #43aa8b;
  --accent3: #f9c74f;
  --accent4: #90be6d;
  --accent5: #f8961e;
  --accent6: #577590;
  
  /* Code highlighting */
  --code-background: #f5f5f5;
  --code-text: #333333;
  --code-comment: #6b7279;
  --code-string: #6959a1;
  /* ... more code tokens */
}
```

### Layout Container Classes

Each layout has a container class and a content class:

| Layout | Container Class | Content Class |
|--------|-----------------|---------------|
| Cover | `.cover-container` | `.layout-cover` |
| Title | `.title-container` | `.layout-title` |
| Section | `.section-container` | `.layout-section` |
| Default | `.default-container` | `.layout-default` |
| 1-Column | `.columns-container` | `.layout-1-column` |
| 2-Columns | `.columns-container` | `.layout-2-columns` |
| 3-Columns | `.columns-container` | `.layout-3-columns` |
| 2-Columns (1+2) | `.columns-container` | `.layout-2-columns-1-2` |
| 2-Columns (2+1) | `.columns-container` | `.layout-2-columns-2-1` |
| Full Image | `.image-container` | `.layout-full-image` |
| Half Image | `.split-container` | `.layout-half-image` |
| Caption | `.caption-container` | `.layout-caption` |
| Grid | `.grid-container` | `.layout-grid` |

### Appearance Classes

- `.light` - Light mode slide
- `.dark` - Dark mode slide

### Slide Structure

```html
<div class="slide-background default-container light">
  <!-- Background layer -->
</div>

<div class="slide default-container light" data-index="0">
  <div class="slide-header">
    <span class="header-left">Company</span>
    <span class="header-middle"></span>
    <span class="header-right">Logo</span>
  </div>
  
  <div class="slide-content layout-default">
    <div class="slot-header">
      <span class="kicker">Kicker Text</span>
      <h1>Title</h1>
    </div>
    <div class="slot-columns columns-2">
      <div class="column" data-column="1">...</div>
      <div class="column" data-column="2">...</div>
    </div>
  </div>
  
  <div class="slide-footer">
    <span class="footer-left"></span>
    <span class="footer-middle"></span>
    <span class="footer-right">1 / 10</span>
  </div>
</div>
```

### Slot Classes

Content is organized into slots:

| Slot | Class | Description |
|------|-------|-------------|
| Header | `.slot-header` | Title, kicker, headings |
| Columns | `.slot-columns` | Column container |
| Column | `.column` | Individual column |
| Image | `.slot-image` | Image container |
| Text | `.slot-text` | Text content area |
| Title Bar | `.slot-title-bar` | Caption layout title |
| Caption | `.slot-caption` | Caption text |

### Column Modifiers

```css
.slot-columns.columns-1 { /* Single column */ }
.slot-columns.columns-2 { /* Two equal columns */ }
.slot-columns.columns-3 { /* Three equal columns */ }
.slot-columns.ratio-1-2 { /* 1/3 + 2/3 split */ }
.slot-columns.ratio-2-1 { /* 2/3 + 1/3 split */ }
```

## Custom Fonts

To include custom fonts:

1. Add font files to the `fonts/` directory
2. Reference in template.json:
   ```json
   {
     "TitleFont": "My Custom Font",
     "BodyFont": "My Custom Font"
   }
   ```
3. Define @font-face in theme.css:
   ```css
   @font-face {
     font-family: 'My Custom Font';
     src: url('fonts/MyFont-Regular.woff2') format('woff2');
     font-weight: 400;
     font-style: normal;
   }
   ```

## Using Theme Assets in CSS

Reference images from the theme directory:

```css
.section-container {
  background-image: url('assets/pattern.svg');
}

.slide-header .logo {
  background-image: url('logo.png');
}
```

## Example: Minimal Theme

### template.json
```json
{
  "Name": "Minimal",
  "Version": "1.0.0",
  "Author": "Perspecta",
  "ShortDescription": "Less is more",
  "LongDescription": "Ultra-clean design with generous whitespace.",
  "Css": "theme.css",
  "TitleFont": "Inter",
  "BodyFont": "Inter",
  "CssClasses": "variable-size-headings"
}
```

### presets.json
```json
{
  "Presets": [
    {
      "Name": "Default",
      "Appearance": "light",
      "TitleFont": "Inter",
      "BodyFont": "Inter",
      "DarkBodyTextColor": "#111111",
      "LightBodyTextColor": "#fafafa",
      "DarkTitleTextColor": "#111111",
      "LightTitleTextColor": "#fafafa",
      "DarkBackgroundColor": "#111111",
      "LightBackgroundColor": "#ffffff",
      "Accent1": "#111111",
      "Accent2": "#666666",
      "Accent3": "#0066cc",
      "Accent4": "#00aa55",
      "Accent5": "#ff6600",
      "Accent6": "#9933cc"
    }
  ]
}
```

### theme.css
```css
/* Minimal Theme */

.slide {
  padding: 8%;
}

.slide h1 {
  font-size: clamp(2.5rem, 5vw, 5rem);
  font-weight: 600;
  letter-spacing: -0.03em;
}

.section-container {
  background: var(--accent1) !important;
}

.section-container .slide-content {
  color: var(--light-background);
}

.slot-columns {
  gap: 4rem;
}
```

## Migration from Built-in Themes

Built-in themes are bundled with the plugin. Custom themes are loaded from the configured themes folder in your vault.

To create a custom theme:
1. Create a folder in your themes directory
2. Add template.json, presets.json, and theme.css
3. Reload Perspecta Slides
4. Select your theme from the theme picker
