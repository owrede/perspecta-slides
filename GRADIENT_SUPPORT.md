# Gradient Color Support in Perspecta Slides

## Overview

Perspecta Slides supports **CSS gradients** in all semantic color properties, allowing users to create rich, modern presentations while maintaining the simplicity-first philosophy.

## How It Works

All color properties in Perspecta accept either:
1. **Solid colors** (hex, rgb, named colors)
2. **CSS gradients** (linear, radial, conic)

### Implementation Details

Colors are stored as CSS variable values, which means they support anything valid in CSS:

```yaml
---
lightTitleText: "#000"                    # Solid color ✅
lightTitleText: "linear-gradient(90deg, #ff0000, #0000ff)"  # Gradient ✅
lightBackground: "radial-gradient(circle, white 0%, #f0f0f0 100%)"  # Gradient ✅
---
```

## Examples

### 1. Simple Horizontal Gradient on Titles

```yaml
---
lightTitleText: "linear-gradient(to right, #ff6b6b, #ffa94d)"
darkTitleText: "linear-gradient(to right, #ff9999, #ffcc99)"
---
```

Result: Titles fade from red-orange on the left to amber on the right.

### 2. Diagonal Gradient Background

```yaml
---
lightBackground: "linear-gradient(135deg, #ffffff 0%, #f0f0f0 100%)"
darkBackground: "linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)"
---
```

Result: Background has a subtle diagonal fade from light to darker.

### 3. Rainbow Gradient for Links

```yaml
---
lightLinkColor: "linear-gradient(90deg, #ff0000, #ff7f00, #ffff00, #00ff00, #0000ff, #4b0082, #9400d3)"
---
```

Result: Links display in rainbow colors (useful for special sections).

### 4. Radial Gradient for Body Text

```yaml
---
lightBodyText: "radial-gradient(ellipse at 50% 0%, #000000, #333333)"
---
```

Result: Text is darker at the top, fades slightly toward bottom.

### 5. Multi-Color Linear Gradient

```yaml
---
lightBlockquoteBorder: "linear-gradient(to bottom, #ff6b6b, #ff8787, #ffa5a5)"
---
```

Result: Blockquote borders fade through shades of pink/red.

## Limitations & Considerations

### 1. Text Gradient Limitations

While CSS supports text gradients, **text-to-text gradients have browser limitations**:

```css
/* This works in modern browsers but requires special syntax */
h1 {
  background: linear-gradient(90deg, red, blue);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
```

**Workaround:** For sophisticated text gradients, use `custom-theme/theme.css`:

```css
/* In your custom theme's theme.css file */
h1 {
  background: linear-gradient(90deg, #ff0000, #0000ff);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  font-weight: bold;
}
```

### 2. Readability with Gradients

Be careful with gradients on text - they can reduce readability:

```yaml
---
# ❌ Bad - text gradient might be hard to read
lightBodyText: "linear-gradient(90deg, #000000, #ffffff)"

# ✅ Good - solid color is always readable
lightBodyText: "#333333"
---
```

### 3. Performance

Complex gradients with many color stops might have minimal performance impact, but keep them reasonable:

```yaml
---
# ✅ Good - 2-3 color stops
background: "linear-gradient(to right, #fff, #f0f0f0)"

# ⚠️ Excessive - too many stops
background: "linear-gradient(90deg, #f00 0%, #f10 11%, #f20 22%, #f30 33%, ...)"
---
```

## Advanced: Custom Theme CSS

For the most control over gradients and advanced styling, use `custom-theme/theme.css`:

```
my-theme/
├── theme.json          # Semantic colors + gradients
├── theme.css           # Advanced CSS overrides
└── demo.md
```

**File: `theme.json`**
```json
{
  "presets": {
    "light": {
      "text": {
        "h1": ["#000000"],
        "body": ["#333333"]
      },
      "backgrounds": {
        "general": {
          "type": "solid",
          "color": "#ffffff"
        }
      }
    }
  }
}
```

**File: `theme.css`** (optional, but powerful)
```css
/* Advanced gradient styling */
h1 {
  background: linear-gradient(45deg, #ff0000, #ffff00, #00ff00, #0000ff);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  font-weight: bold;
  font-size: 2.5em;
}

/* Animated gradient (if we support animations in future) */
@keyframes gradient-shift {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

.highlight {
  background: linear-gradient(-45deg, #ff6b6b, #ffa94d, #ffd43b);
  background-size: 200% 200%;
  animation: gradient-shift 3s ease infinite;
  padding: 10px 20px;
  border-radius: 5px;
}
```

## Gradient Types Supported

### 1. Linear Gradients

```yaml
# Direction keywords
background: "linear-gradient(to right, #ff0000, #0000ff)"
background: "linear-gradient(to bottom, #ff0000, #0000ff)"
background: "linear-gradient(to top, #ff0000, #0000ff)"
background: "linear-gradient(to left, #ff0000, #0000ff)"

# Diagonal
background: "linear-gradient(135deg, #ff0000, #0000ff)"
background: "linear-gradient(45deg, #ff0000, #0000ff)"

# Degrees (0 = up, 90 = right, 180 = down, 270 = left)
background: "linear-gradient(45deg, #ff0000, #0000ff)"
```

### 2. Radial Gradients

```yaml
# Simple
background: "radial-gradient(circle, white 0%, #f0f0f0 100%)"

# Ellipse
background: "radial-gradient(ellipse, white 0%, gray 100%)"

# With position
background: "radial-gradient(circle at 50% 0%, white 0%, gray 100%)"
background: "radial-gradient(ellipse at 80% 20%, white, blue)"
```

### 3. Conic Gradients (Modern Browsers)

```yaml
# Creates pie-chart style gradients
background: "conic-gradient(red, yellow, lime, aqua, blue, magenta, red)"

# With position
background: "conic-gradient(from 45deg at 20% 30%, red, yellow, lime)"
```

## Best Practices

### ✅ Do

1. **Use gradients for background colors** - they work perfectly
2. **Test readability** - especially with text gradients
3. **Keep gradients subtle** - they support your content, not overshadow it
4. **Use custom theme.css** for advanced styling beyond semantic colors

### ❌ Don't

1. **Use gradients everywhere** - focus on minimalism
2. **Sacrifice readability** for visual effects
3. **Use overly complex gradients** - simple is better
4. **Forget that printed/exported slides might look different** - test export

## Examples: Built-in Themes with Gradients

### Theme: Zurich Plus (with gradients)

```yaml
---
theme: zurich
lightBackground: "linear-gradient(135deg, #ffffff 0%, #f5f5f5 100%)"
lightTitleText: "linear-gradient(90deg, #1a1a1a, #333333)"
---
```

### Theme: Kyoto Plus (with gradients)

```yaml
---
theme: kyoto
darkBackground: "linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)"
darkTitleText: "linear-gradient(90deg, #ffffff, #e0e0e0)"
darkAccentColor: "linear-gradient(45deg, #ff6b9d, #c44569)"
---
```

## Testing Gradients

To test how your gradients look:

1. **Create a test slide** with gradient colors
2. **View in presentation** (light and dark modes)
3. **Check readability** of all text
4. **Export to PDF** to see how it looks in different formats
5. **Adjust** color stops or angles if needed

## CSS Gradient Resources

For more gradient inspiration and tools:
- [CSS Gradient](https://cssgradient.io/) - Visual gradient editor
- [Gradient Magic](https://www.gradientmagic.com/) - Pre-made gradients
- [MDN: CSS Gradients](https://developer.mozilla.org/en-US/docs/Web/CSS/gradient) - Technical reference

---

## Summary

Gradients in Perspecta Slides provide a way to add visual sophistication while maintaining the philosophy of "beautiful presentations with minimal effort." They work in all semantic color properties and can be combined with custom `theme.css` for unlimited customization.

**Key benefits:**
- ✅ Support both solid colors AND gradients
- ✅ Simple syntax (just paste CSS gradient string)
- ✅ Works with existing semantic color system
- ✅ Advanced customization via theme.css
- ✅ Maintains focus on content and readability
