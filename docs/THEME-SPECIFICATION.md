# Perspecta Slides Theme Specification

Based on iA Presenter theme concepts with extensions for column layouts and enhanced styling controls.

## Theme Directory Structure

Built-in themes use the new simplified format with `theme.json` and `theme.css`:

```
my-theme/
├── theme.json          # Theme metadata, fonts, and color presets
├── theme.css           # Theme-specific CSS styling
├── fonts/              # Custom font files (optional)
│   ├── MyFont-Regular.woff2
│   └── MyFont-Bold.woff2
└── assets/             # Images, patterns, backgrounds (optional)
    ├── pattern.svg
    └── background.jpg
```

Custom themes loaded from the vault support the legacy format (template.json + presets.json) for backward compatibility.

---

## theme.json

The new unified theme configuration file that replaces the separate `template.json` and `presets.json` files.

### Full Example

```json
{
  "name": "Zurich",
  "version": "2.0.0",
  "author": "Perspecta",
  "description": "Minimal Swiss design with fixed-size headings",
  
  "fonts": {
    "title": {
      "name": "Helvetica",
      "css": "Helvetica Neue, Helvetica, Arial, sans-serif"
    },
    "body": {
      "name": "Helvetica",
      "css": "Helvetica Neue, Helvetica, Arial, sans-serif"
    }
  },
  
  "cssClasses": "fixed-size-headings",
  
  "presets": {
    "light": {
      "text": {
        "h1": ["#000000"],
        "h2": ["#000000"],
        "h3": ["#333333"],
        "h4": ["#333333"],
        "body": "#333333",
        "header": "#666666",
        "footer": "#666666"
      },
      "backgrounds": {
        "general": { "type": "solid", "color": "#ffffff" },
        "cover": { "type": "solid", "color": "#ffffff" },
        "title": { "type": "solid", "color": "#ffffff" },
        "section": { "type": "solid", "color": "#000000" }
      },
      "accents": ["#000000", "#43aa8b", "#f9c74f", "#90be6d", "#f8961e", "#577590"]
    },
    "dark": {
      "text": {
        "h1": ["#ffffff"],
        "h2": ["#ffffff"],
        "h3": ["#ffffff"],
        "h4": ["#ffffff"],
        "body": "#ffffff",
        "header": "#999999",
        "footer": "#999999"
      },
      "backgrounds": {
        "general": { "type": "solid", "color": "#000000" },
        "cover": { "type": "solid", "color": "#000000" },
        "title": { "type": "solid", "color": "#000000" },
        "section": { "type": "solid", "color": "#ffffff" }
      },
      "accents": ["#ffffff", "#43aa8b", "#f9c74f", "#90be6d", "#f8961e", "#577590"]
    }
  }
}
```

### Top-Level Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | ✓ | Display name of the theme |
| `version` | string | ✓ | Semantic version (e.g., "2.0.0") |
| `author` | string | ✓ | Theme creator |
| `description` | string | ✓ | Brief description for theme picker |
| `fonts` | object | ✓ | Font definitions (see below) |
| `cssClasses` | string | | Space-separated CSS classes to apply |
| `presets` | object | ✓ | Light and dark mode presets |
| `overlays` | object | | Image overlay settings (optional) |

### cssClasses Options

- `fixed-size-headings` - All heading levels use the same size (Swiss style)
- `variable-size-headings` - H1 > H2 > H3 with decreasing sizes
- `elegant-theme` - Additional elegant styling classes

### Fonts Object

```json
{
  "fonts": {
    "title": {
      "name": "Display Name",
      "css": "Font Family, fallback1, fallback2"
    },
    "body": {
      "name": "Display Name",
      "css": "Font Family, fallback1, fallback2"
    }
  }
}
```

| Field | Description |
|-------|-------------|
| `name` | Human-readable font name for UI display |
| `css` | CSS `font-family` value with fallbacks |

---

## Presets Structure

Each theme defines both `light` and `dark` mode presets under `presets`.

### Text Colors

Heading colors support arrays for gradient text effects:

```json
{
  "text": {
    "h1": ["#000000"],              // Solid color
    "h2": ["#ff6b9d", "#c678dd"],   // Gradient (left to right)
    "h3": ["#333333"],
    "h4": ["#333333"],
    "body": "#333333",
    "header": "#666666",
    "footer": "#666666"
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `h1` | string[] | H1 heading color(s) - array enables gradients |
| `h2` | string[] | H2 heading color(s) |
| `h3` | string[] | H3 heading color(s) |
| `h4` | string[] | H4 heading color(s) |
| `body` | string | Body text color |
| `header` | string | Slide header text color |
| `footer` | string | Slide footer text color |

### Backgrounds Object

Layout-specific backgrounds with support for solid colors, gradients, and dynamic palettes:

```json
{
  "backgrounds": {
    "general": { "type": "solid", "color": "#ffffff" },
    "cover": { "type": "gradient", "colors": ["#D3E9F8", "#E4DBEA"] },
    "title": { "type": "solid", "color": "#f0f0f0" },
    "section": { "type": "solid", "color": "#000000" }
  }
}
```

| Layout | Description |
|--------|-------------|
| `general` | Default background for all slides |
| `cover` | Background for cover layout slides |
| `title` | Background for title layout slides |
| `section` | Background for section divider slides |

### Background Types

**Solid Background**
```json
{ "type": "solid", "color": "#ffffff" }
```

**Gradient Background**
```json
{ 
  "type": "gradient", 
  "colors": ["#D3E9F8", "#E4DBEA"] 
}
```
Renders as `linear-gradient(135deg, #D3E9F8, #E4DBEA)`.

**Dynamic Background**
```json
{
  "type": "dynamic",
  "colors": [
    "#D3E9F8", "#CFDEED", "#E4DBEA", "#E9CDD7",
    "#F1DEDD", "#F8E6DE", "#F5E8E5", "#F2E9DA",
    "#F1F0D8", "#E6F1E5", "#E2EDEB"
  ]
}
```
Dynamic backgrounds cycle through the color palette based on slide index, creating visual variety while maintaining theme coherence. Used prominently in themes like **Tokyo**.

### Accents Array

Six accent colors used for emphasis, links, section backgrounds, and other highlights:

```json
{
  "accents": ["#000000", "#43aa8b", "#f9c74f", "#90be6d", "#f8961e", "#577590"]
}
```

| Index | CSS Variable | Typical Use |
|-------|--------------|-------------|
| 0 | `--accent1` | Primary accent, section backgrounds |
| 1 | `--accent2` | Secondary accent, kickers |
| 2 | `--accent3` | Tertiary accent, links |
| 3 | `--accent4` | Quaternary accent |
| 4 | `--accent5` | Quinary accent |
| 5 | `--accent6` | Senary accent |

---

## Generated CSS Variables

The theme system generates CSS custom properties from the theme.json presets:

```css
:root {
  /* Fonts */
  --title-font: "Helvetica Neue", sans-serif;
  --body-font: "Helvetica Neue", sans-serif;
  
  /* Legacy color variables (for backward compatibility) */
  --dark-body-text: #ffffff;
  --light-body-text: #333333;
  --dark-title-text: #ffffff;
  --light-title-text: #000000;
  --dark-background: #000000;
  --light-background: #ffffff;
  
  /* Accent colors */
  --dark-accent1: #ffffff;
  --light-accent1: #000000;
  --accent1: #000000;
  --accent2: #43aa8b;
  --accent3: #f9c74f;
  --accent4: #90be6d;
  --accent5: #f8961e;
  --accent6: #577590;
  
  /* Per-heading colors (light mode) */
  --light-h1-color: #000000;
  --light-h2-color: #000000;
  --light-h3-color: #333333;
  --light-h4-color: #333333;
  --light-header-text: #666666;
  --light-footer-text: #666666;
  
  /* Per-heading colors (dark mode) */
  --dark-h1-color: #ffffff;
  --dark-h2-color: #ffffff;
  --dark-h3-color: #ffffff;
  --dark-h4-color: #ffffff;
  --dark-header-text: #999999;
  --dark-footer-text: #999999;
  
  /* Layout-specific backgrounds (light mode) */
  --light-bg-cover: #ffffff;
  --light-bg-title: #ffffff;
  --light-bg-section: #000000;
  
  /* Layout-specific backgrounds (dark mode) */
  --dark-bg-cover: #000000;
  --dark-bg-title: #000000;
  --dark-bg-section: #ffffff;
  
  /* Background gradients (if dynamic) */
  --light-bg-gradient: none;
  --dark-bg-gradient: none;
}
```

---

## theme.css

The CSS file provides theme-specific styling. Use the generated CSS variables for colors and fonts.

### Example: Zurich Theme CSS

```css
/* Zurich Theme - Minimal Swiss Design */

/* Fixed-size headings - all headings same size */
.slide h1, .slide h2, .slide h3, 
.slide h4, .slide h5, .slide h6 {
  font-size: 2.5rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}

/* Cover slides - centered, large text */
.cover-container .slide-content {
  justify-content: center;
  align-items: center;
  text-align: center;
}

.layout-cover h1, .layout-cover h2 {
  font-size: 4.5rem;
}

/* Section slides - accent background */
.section-container {
  background: var(--accent1) !important;
}

.layout-section {
  color: var(--light-background);
}

/* Kicker styling */
.kicker {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  color: var(--accent2);
}
```

### Advanced CSS: Gradient Text

For gradient text effects (like Tokyo theme):

```css
.slide h1, .slide h2 {
  background: linear-gradient(135deg, var(--accent1), var(--accent2));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
```

### Advanced CSS: Glow Effects

```css
pre {
  background: #282c34;
  border: 1px solid rgba(255, 107, 157, 0.2);
  box-shadow: 0 0 20px rgba(255, 107, 157, 0.1);
}
```

---

## Layout Container Classes

Each layout type has a container class and a content class:

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

---

## Slide Structure

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

---

## Built-in Themes

Perspecta Slides includes 14 built-in themes:

| Theme | Style | Fonts | Special Features |
|-------|-------|-------|------------------|
| **Zurich** | Minimal Swiss | Helvetica | Fixed-size headings |
| **Tokyo** | Neon/Dynamic | System UI | Dynamic gradient backgrounds, gradient text |
| **Berlin** | Professional | Source Sans Pro | Deep blue tones, gradient cover |
| **Minimal** | Ultra-clean | Inter | Maximum whitespace |
| **Helvetica** | Classic | Helvetica | Traditional corporate |
| **Basel** | Swiss Grid | System | Grid-focused layout |
| **Copenhagen** | Nordic | System | Clean Scandinavian |
| **Garamond** | Elegant | EB Garamond | Serif typography |
| **LA** | Warm | System | California vibes |
| **Milano** | Fashion | System | High contrast |
| **New York** | Editorial | System | Magazine style |
| **Paris** | Romantic | Cormorant Garamond | Soft, elegant |
| **San Francisco** | Tech | SF Pro | Apple-inspired |
| **Vancouver** | Nature | System | Organic, natural |

---

## Custom Fonts

To include custom fonts in a theme:

1. Add font files to the `fonts/` directory
2. Reference in theme.json:
   ```json
   {
     "fonts": {
       "title": {
         "name": "My Custom Font",
         "css": "My Custom Font, sans-serif"
       }
     }
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

---

## Legacy Format (Custom Themes)

Custom themes loaded from the vault still support the legacy iA Presenter-compatible format with `template.json` and `presets.json`. See the ThemeLoader for conversion logic.

### Legacy template.json

```json
{
  "Name": "My Theme",
  "Version": "1.0.0",
  "Author": "Your Name",
  "ShortDescription": "A brief tagline...",
  "Css": "theme.css",
  "TitleFont": "Display Font Name",
  "BodyFont": "Body Font Name",
  "CssClasses": "fixed-size-headings"
}
```

### Legacy presets.json

```json
{
  "Presets": [
    {
      "Name": "Default",
      "Appearance": "light",
      "TitleFont": "Helvetica Neue",
      "BodyFont": "Helvetica Neue",
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
      "Accent6": "#577590"
    }
  ]
}
```

---

## TypeScript Types

The theme system is defined in `src/themes/ThemeSchema.ts`:

```typescript
interface ThemeJsonFile {
  name: string;
  version: string;
  author: string;
  description: string;
  fonts: {
    title: ThemeFontDef;
    body: ThemeFontDef;
  };
  cssClasses?: string;
  presets: {
    light: ThemeModePreset;
    dark: ThemeModePreset;
  };
  overlays?: ThemeOverlay;
}

interface ThemeFontDef {
  name: string;
  css: string;
}

interface ThemeModePreset {
  text: ThemeTextColors;
  backgrounds: ThemeBackgrounds;
  accents: string[];
}

interface ThemeTextColors {
  h1: string[];
  h2: string[];
  h3: string[];
  h4: string[];
  body: string;
  header: string;
  footer: string;
}

interface ThemeBackground {
  type: 'solid' | 'gradient' | 'dynamic';
  color?: string;
  colors?: string[];
}

interface ThemeBackgrounds {
  general: ThemeBackground;
  cover: ThemeBackground;
  title: ThemeBackground;
  section: ThemeBackground;
}
```
