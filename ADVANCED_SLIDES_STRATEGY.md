# Advanced Slides Compatibility Strategy

## Your Strategic Vision

Perspecta Slides is positioned as the "easy-to-use, beautiful-by-default" alternative to Advanced Slides. Rather than trying to replicate all Advanced Slides features, we're focusing on what makes Perspecta unique:

1. **Simplicity first** - Minimal configuration, maximum quality out of the box
2. **iA Presenter philosophy** - Content-focused, clean layouts
3. **Good themes matter** - Quality themes are the USP, not feature count
4. **Extensibility for power users** - Custom theme.css for advanced styling

---

## Implementation Decisions

### ✅ DONE: Support `Note:` Syntax (Advanced Slides)

Both iA Presenter and Advanced Slides modes now accept `note:` or `notes:` as speaker note markers.

**Impact:** Zero effort for Advanced Slides users migrating presentations.

```markdown
---
# My Slide

Content here

note:
This is a speaker note
```

---

### ✅ DONE: Theme Fallback for Unknown Themes

When a presentation specifies a theme that doesn't exist (e.g., Advanced Slides theme name), Perspecta automatically falls back to the default theme.

**Code:**
```typescript
// In getThemeByName()
if (requestedTheme not found && defaultTheme exists) {
  use defaultTheme
}
```

**Impact:** Advanced Slides presentations with `theme: black` will gracefully fall back instead of erroring. User can then customize or choose a different theme.

---

### ✅ DONE: Gradient Support in Semantic Colors

All color properties (titles, backgrounds, links, etc.) accept CSS gradients, not just solid colors.

**How to use:**

In YAML frontmatter:
```yaml
---
lightTitleText: "linear-gradient(90deg, #ff0000, #0000ff)"
darkBackground: "radial-gradient(circle, #1a1a1a, #2d2d2d)"
---
```

Or in custom theme.json:
```json
{
  "semanticColors": {
    "link": "linear-gradient(45deg, #ff6b6b, #ffa94d)"
  }
}
```

**Impact:** Users can create sophisticated, modern presentations while maintaining simplicity.

---

### ✅ ARCHITECTURE CLARIFICATION: No reveal.js

Perspecta does **NOT** use reveal.js - it's a completely independent implementation with custom HTML/CSS rendering.

**Implication:** Transitions and fragments (reveal.js features) are not supported and won't be without major architectural changes.

**Rationale:** 
- Perspecta's design philosophy prioritizes simplicity + quality themes over feature breadth
- Transitions/fragments are nice-to-have, not essential for the core USP
- Custom rendering gives complete control for consistent output

**Trade-off accepted:** No transitions/fragments in exchange for:
- Smaller footprint
- Simpler API
- Better default themes
- Easier to learn

---

### 🔄 POSTPONED: Theme Mapping

Theme mapping (black → berlin, white → zurich) was considered but postponed because:

1. **Low value for users** - Changing the theme is one of the first things users do anyway
2. **Incomplete utility** - Mapping only works if Perspecta themes are as good or better
3. **Better investment** - Focus on theme quality instead

**Future consideration:** Once Perspecta has a full suite of excellent themes, theme mapping becomes valuable for effortless migration.

---

### 📋 FUTURE: HTML Comment Directives (Low Priority)

Advanced Slides supports HTML comments for styling:
```markdown
<!-- .slide: class="dark" data-background="#222" -->
<!-- .element: class="fragment" -->
```

**Approach:**
1. **Parse silently** - Don't error on these, just ignore them gracefully
2. **Document conversion** - Show users how to convert to YAML format
3. **Support common directives** - Implement the most useful ones as needed

**Timeline:** After core functionality is stable and users request it.

---

### 🎨 FUTURE: Custom theme.css Files

For users who need advanced styling beyond semantic colors, custom `theme.css`:

```
my-custom-theme/
├── theme.json          # Semantic colors and gradients
├── theme.css           # Advanced CSS overrides (optional)
└── demo.md
```

This enables:
- Text gradients (requires special CSS)
- Animations and transitions
- Shadow effects
- Custom component styling

**Timeline:** Once theme system is proven and users request advanced styling.

---

## Migration Path for Advanced Slides Users

### Phase 1: Basic Compatibility (NOW)

Required changes to migrate from Advanced Slides:
- ✅ Rename `Note:` → `notes:` (or just use `note:` - both work now)
- ✅ Choose a Perspecta theme (or use fallback)
- ❌ Remove transition markup (ignore HTML comments)
- ❌ Convert `--` vertical slides to `###` column separators

### Phase 2: Optimize for Perspecta (First customization)

Optional improvements to take advantage of Perspecta features:
- ✅ Use semantic color properties for consistent styling
- ✅ Leverage auto-column detection for better layouts
- ✅ Add gradients to backgrounds for sophistication
- ✅ Create custom theme if advanced styling needed

### Phase 3: Advanced Customization (Power users)

For users who need more control:
- 🎨 Create custom theme with `theme.json` + `theme.css`
- 🎨 Use CSS variables for consistent theming
- 🎨 Export and share custom themes

---

## Messaging Strategy

### For Advanced Slides Users

**Why switch to Perspecta Slides?**

> Perspecta Slides prioritizes **content clarity and visual consistency** out of the box. You get beautiful presentations with minimal configuration—perfect if you want great-looking slides without learning CSS or spending hours tweaking themes.

**Realistic expectations:**

> Perspecta works differently from Advanced Slides (no transitions/fragments), but it trades those animations for something better: automatic multi-column layouts, semantic color systems, and exceptional default themes that make your presentations look professional with zero configuration.

---

## Feature Comparison Summary

| Feature | Advanced Slides | Perspecta Slides | Migration Notes |
|---------|-----------------|-----------------|-----------------|
| Markdown basics | ✅ | ✅ | Works as-is |
| Speaker notes | `Note:` | `Notes:` or `note:` | Rename (or no change) |
| Column layouts | ❌ | ✅ Auto-detect | Conversion needed |
| Themes | ✅ (reveal.js) | ✅ (custom) | Re-select theme |
| Transitions | ✅ | ❌ | Remove markup |
| Fragments | ✅ | ❌ | Remove markup |
| CSS styling | ✅ (unlimited) | ✅ (semantic + CSS) | Simplified but sufficient |
| Gradients | ❌ Direct | ✅ Direct | Use in color properties |
| Out-of-box quality | ⚠️ Needs work | ✅ Great | Immediate advantage |
| Learning curve | High | Low | Immediate advantage |

---

## What Perspecta Does Better

1. **Quality by default** - No configuration needed for good-looking slides
2. **Automatic layouts** - Multi-column detection without manual markup
3. **Semantic colors** - Consistent, maintainable color system
4. **Gradient support** - Rich colors without CSS knowledge
5. **Simple learning** - Minimal concepts to master
6. **iA Presenter style** - Content-focused, minimal distraction

## What Advanced Slides Does Better

1. **Transitions & animations** - Built-in reveal.js features
2. **Incremental reveal** - Fragments for progressive disclosure
3. **Feature breadth** - More styling options
4. **Vertical slide hierarchies** - Nested slide structures
5. **Flexibility** - Unlimited CSS customization

---

## Decision: Keep Perspecta's Identity

Rather than trying to become "Advanced Slides Lite," Perspecta should **double down on its strengths**:

- **Invest in themes** - Make default themes so good that customization is optional
- **Improve layouts** - Expand multi-column and template options
- **Simplify everything** - Keep the API minimal and intuitive
- **Document differences** - Help users understand the philosophy

This focused strategy is more sustainable and creates real value for a specific user persona: people who want beautiful, professional presentations with minimal effort.

---

## Success Metrics

✅ Advanced Slides users can migrate presentations in under 5 minutes
✅ Presentations look good with zero customization
✅ Users understand why Perspecta works differently
✅ Custom theme creation is documented and achievable
✅ Theme quality exceeds Advanced Slides defaults
