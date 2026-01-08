# Advanced Slides Concepts Explained

## 1. What is Theme Mapping? Why is it Needed?

### Definition
**Theme Mapping** is the process of converting theme names from one presentation system to another. It's essentially a lookup table that translates theme identifiers between systems.

### Why It's Needed

**Advanced Slides uses built-in reveal.js themes:**
```yaml
---
theme: black        # Built-in reveal.js theme
---
```

Available themes in Advanced Slides: `black`, `white`, `league`, `sky`, `beige`, `simple`, `serif`, `blood`, `night`, `moon`, `solarized`, etc.

**Perspecta Slides uses custom themes:**
```yaml
---
theme: zurich       # Custom Perspecta theme
---
```

Available themes: `zurich`, `kyoto`, `berlin`, `minimal`, plus user-created custom themes.

### The Problem

When an Advanced Slides presentation specifies:
```yaml
---
theme: black
---
```

Perspecta Slides won't recognize this. It will either:
1. Fall back to default theme (not ideal)
2. Not apply any theme (looks wrong)
3. Throw an error

### The Solution: Mapping Table

Create a mapping that translates Advanced Slides theme names to Perspecta equivalents:

```typescript
// File: src/utils/ThemeMappings.ts
const ADVANCED_SLIDES_TO_PERSPECTA_THEMES: Record<string, string> = {
  // Dark themes
  'black': 'berlin',        // Dark professional → Berlin
  'night': 'berlin',        // Dark night → Berlin
  'blood': 'berlin',        // Dark red → Berlin (customize colors after)
  'moon': 'kyoto',          // Dark moon → Kyoto
  
  // Light themes
  'white': 'zurich',        // Light clean → Zurich
  'league': 'zurich',       // Light league → Zurich
  'beige': 'minimal',       // Beige/warm → Minimal
  'simple': 'zurich',       // Simple clean → Zurich
  'serif': 'minimal',       // Traditional serif → Minimal
  'sky': 'kyoto',           // Blue sky → Kyoto
  'solarized': 'kyoto',     // Solarized colors → Kyoto
};
```

### Implementation

When Perspecta loads a presentation:
```typescript
let themeName = frontmatter.theme;

// If it's an Advanced Slides theme name, map it
if (ADVANCED_SLIDES_TO_PERSPECTA_THEMES[themeName]) {
  themeName = ADVANCED_SLIDES_TO_PERSPECTA_THEMES[themeName];
}

const theme = getTheme(themeName);
```

### User Experience

**Before mapping:**
- Advanced Slides user opens their "black" theme presentation
- Perspecta ignores `theme: black` 
- Presentation looks weird

**After mapping:**
- Advanced Slides user opens their "black" theme presentation
- Perspecta automatically maps `black` → `berlin`
- Presentation looks similar (dark professional look)
- User can then customize via Perspecta's Inspector if desired

---

## 2. What Are HTML Comment Directives?

### Definition
**HTML comment directives** are special comments in markdown that tell reveal.js (Advanced Slides) how to render the slide. They look like HTML comments but contain instructions.

### Examples from Advanced Slides

#### Slide-Level Directives
```markdown
---
# My Slide

<!-- .slide: class="dark" data-background="#222" transition="fade" -->

Content here
```

This tells reveal.js:
- Add CSS class `dark` to the slide
- Set background color to `#222`
- Use fade transition when entering this slide

#### Element-Level Directives
```markdown
---
# My Slide

- Item 1 <!-- .element: class="fragment" data-fragment-index="0" -->
- Item 2 <!-- .element: class="fragment" data-fragment-index="1" -->
```

This tells reveal.js:
- Make item 1 appear first as a "fragment"
- Make item 2 appear next as a "fragment"
- Create incremental reveal effect

#### Attribute Syntax
```html
<!-- .slide: property="value" property2="value2" -->
```

Common reveal.js properties:
- `transition="fade|slide|convex|concave|zoom"`
- `class="classname"`
- `data-background="#color"` or `data-background="image.jpg"`
- `data-background-size="cover|contain|auto"`
- `data-background-position="left|center|right"`

### How Perspecta Could Support This

**Option 1: Convert to YAML**
```markdown
---
class: dark
background: "#222"
transition: fade
---
```

**Option 2: Parse and Ignore**
```markdown
<!-- .slide: class="dark" data-background="#222" -->
```
Perspecta could parse these comments and either:
- Ignore them (silent compatibility)
- Convert them to YAML directives
- Store them for users to customize

**Option 3: Custom Implementation**
Perspecta could implement basic CSS class support:
```markdown
---
# My Slide
<!-- .element: class="highlight" -->

Important content
```

---

## 3. How Does Advanced Slides Store Complex CSS Styling?

### Reveal.js Styling Architecture

Advanced Slides is built on reveal.js, which has a sophisticated styling system:

#### 1. **Theme Files (SCSS/CSS)**
Each theme is a complete CSS file that defines:
```scss
// Black theme (simplified)
$backgroundColor: #111;
$mainColor: #fff;
$mainFontSize: 42px;
$mainFont: 'Helvetica Neue', sans-serif;

// All heading styles
h1, h2, h3, h4, h5, h6 {
  color: $mainColor;
  font-family: $mainFont;
}

// Slide styling
.reveal {
  background: $backgroundColor;
}

// And hundreds more rules...
```

#### 2. **HTML Inline Styles**
Users can apply inline CSS via HTML comments:
```markdown
<!-- .slide: data-background="linear-gradient(to right, red, blue)" -->

<!-- .element: style="color: red; font-weight: bold;" -->
```

#### 3. **Custom CSS Files**
Users can create custom CSS that overrides theme styles:
```css
/* In a custom CSS file loaded by reveal.js */
.reveal h1 {
  color: purple;
  text-shadow: 0 0 10px rgba(0,0,0,0.5);
}

.custom-class {
  background: rgba(255,255,255,0.1);
  padding: 20px;
}
```

#### 4. **Data Attributes**
Reveal.js uses data attributes for behavior:
```html
<section class="reveal">
  <div class="slide" 
       data-background="image.jpg"
       data-background-size="cover"
       data-transition="fade">
    Content
  </div>
</section>
```

### How Perspecta Stores Styling (Different Approach)

Instead of CSS-heavy styling, Perspecta uses a **semantic color system**:

```yaml
---
# Perspecta approach
lightTitleText: "#000"
darkTitleText: "#fff"
lightBodyText: "#333"
darkBodyText: "#ccc"
lightLinkColor: "#0066cc"
darkLinkColor: "#66b3ff"
lightBackground: "#ffffff"
darkBackground: "#222222"
lightTableHeaderBg: "#f0f0f0"
darkTableHeaderBg: "#333333"
---
```

This is more **constrained** (less flexible) but more **maintainable** and **consistent**.

### Comparison

| Aspect | Advanced Slides | Perspecta Slides |
|--------|-----------------|-----------------|
| Styling method | CSS/SCSS themes | YAML semantic colors |
| Customization | Unlimited (any CSS) | Limited to predefined properties |
| Consistency | Can be chaotic | Always consistent |
| Complexity | High (need CSS knowledge) | Low (structured properties) |
| Theme sharing | CSS files | YAML + color values |
| Flexibility | Very high | Medium |
| User-friendliness | Moderate (need CSS) | High (no CSS needed) |

### What Gets Lost in Migration?

Advanced Slides styling that Perspecta doesn't support:
```css
/* Advanced Slides custom CSS */
h1 {
  text-shadow: 0 0 20px rgba(255,0,0,0.8);
  letter-spacing: 3px;
  font-variant: small-caps;
}

.custom-box {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 15px;
  padding: 20px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.3);
}
```

### Workaround Solution

**For complex styling, Perspecta could:**

1. **Create a custom theme file** for the user
2. **Store custom CSS** in the theme's `theme.css`
3. **Inject it** into slides during rendering

Example custom theme:
```
custom-theme/
├── theme.json          # Semantic colors
├── theme.css           # Additional CSS
└── demo.md
```

File: `custom-theme/theme.css`
```css
/* Custom styles for this theme */
h1 {
  letter-spacing: 2px;
}

.highlight {
  background: linear-gradient(90deg, #f093fb 0%, #f5576c 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
```

---

## About reveal.js: Why Perspecta Doesn't Use It

**Question:** Doesn't Perspecta use reveal.js already?

**Answer:** No. Perspecta Slides is **completely independent** from reveal.js:

- **Advanced Slides**: Built on reveal.js (battle-tested presentation library)
- **Perspecta Slides**: Custom HTML/CSS rendering in iframes

### Why Perspecta Doesn't Use reveal.js

1. **Different philosophy**: Perspecta prioritizes simplicity + semantic colors, not maximum flexibility
2. **Smaller footprint**: No dependency on large JavaScript library
3. **Better control**: Complete rendering control for consistent output
4. **Optimized for iA Presenter style**: Designed specifically for easy, good-looking presentations out of the box

### Could Perspecta Adopt reveal.js Features?

Theoretically yes, but practically it would require:
- Rewriting the entire rendering system
- Complete architectural change
- Loss of current design philosophy
- Significant development effort

**Trade-off Analysis:**
| Aspect | With reveal.js | Without reveal.js (current) |
|--------|---|---|
| Transitions | ✅ Built-in | ❌ Not supported |
| Fragments | ✅ Built-in | ❌ Not supported |
| Vertical slides | ✅ Built-in | ❌ Not supported |
| Custom themes | ✅ CSS-based (complex) | ✅ Semantic colors (simple) |
| Out-of-box quality | ⚠️ Needs theme | ✅ Great by default |
| Learning curve | High (reveal.js API) | Low (simple markdown) |
| File size | Large | Small |

**Verdict:** Transitions/fragments are nice-to-have, not essential for Perspecta's core USP of "beautiful presentations with minimal effort."

---

## Summary for Advanced Slides Users

| Concept | What it is | Impact on Migration |
|---------|-----------|---------------------|
| **Theme fallback** | Unknown themes use default theme instead of error | Minimal - transparent to user |
| **HTML comment directives** | Special comments with styling instructions | Moderate - can be converted to YAML |
| **CSS styling** | Advanced, flexible styling system | Managed - Perspecta uses constrained semantic colors + custom theme.css |
| **Transitions/Fragments** | reveal.js features | Not supported - trade-off for simplicity |

### Recommended Implementation Order

1. ✅ **Theme mapping** (easy, high value)
2. ✅ **Support `note:` syntax** (done - already implemented)
3. **Parse HTML comment directives** (medium effort, medium value)
4. **Basic CSS class support** (medium effort, medium value)
5. **Custom CSS injection** (higher effort, lower priority)
