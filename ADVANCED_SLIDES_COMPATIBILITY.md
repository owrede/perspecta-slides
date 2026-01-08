# Perspecta Slides vs Advanced Slides Compatibility Analysis

## Executive Summary

This document analyzes compatibility between **Advanced Slides** (reveal.js-based) and **Perspecta Slides** to help users migrating from Advanced Slides have a smooth transition.

**Key Finding**: Perspecta Slides uses a fundamentally different architecture (custom HTML rendering vs reveal.js) and has different design philosophy. While many concepts are compatible, users will need to understand the differences.

---

## Advanced Slides Core Features

### Markdown Syntax
- **Slide breaks**: `---` (same as Perspecta)
- **Vertical slides**: `--` (creates nested slides in reveal.js)
- **Speaker notes**: `Note:` (different from Perspecta's `Notes:`)
- **Headings**: `#`, `##`, `###` for hierarchy (same as Perspecta)

### Styling & Appearance
- **Theme selection**: YAML frontmatter `theme:` property
- **Slide-specific CSS classes**: `<!-- .slide: class="custom" -->`
- **Element-specific classes**: `<!-- .element: class="fragment" -->`
- **Transitions**: `<!-- .slide: transition="fade" -->`
- **Backgrounds**: `<!-- .slide: background="url" -->` or inline in slide

### Features Built into reveal.js
- **Fragments**: Incremental reveal of content (`<!-- .element: class="fragment" -->`)
- **Speaker view**: Separate speaker notes and timer
- **Transitions**: Slide and element transitions
- **Vertical navigation**: Nested slide hierarchies
- **Animations**: Fragment animations

### Advanced Features
- **Math support**: LaTeX via `$...$` and `$$...$$` (similar to Perspecta)
- **Code highlighting**: Fenced code blocks with language (same as Perspecta)
- **Embedded media**: Videos, iframes
- **Plugins**: reveal.js plugins for additional functionality
- **Custom CSS**: Can add custom styling

---

## Perspecta Slides Architecture

### Core Design
- **Rendering**: Custom HTML/CSS in iframes (NOT reveal.js)
- **Slide breaks**: `---` (same)
- **Vertical nesting**: NOT SUPPORTED (uses columns instead)
- **Speaker notes**: `Notes:` marker in content (same concept, different name)

### Styling & Appearance
- **Theme system**: YAML frontmatter with granular semantic colors
- **Layout system**: 
  - Single column (default)
  - Multi-column auto-detection (via `###` headers or empty line separation)
  - Explicit column layout via `layout: columns` directive
- **Aspect ratio locking**: Built-in support with letterboxing

### Features
- **Semantic colors**: Unified color system for typography, links, bullets, tables, code
- **Font control**: Custom Google Fonts with weight selection
- **Typography controls**: Title, body, header, footer fonts with size adjustments
- **Margins & spacing**: Fine-grained control via frontmatter
- **Image resolution**: Wiki-link and relative path support
- **Table rendering**: Custom styled tables with configurable borders
- **No built-in animations**: Focus on content clarity

---

## Compatibility Matrix

| Feature | Advanced Slides | Perspecta Slides | Migration Path |
|---------|-----------------|------------------|-----------------|
| Basic slide breaks (`---`) | ✅ Yes | ✅ Yes | Direct |
| Headings (`#`, `##`, `###`) | ✅ Yes | ✅ Yes | Direct |
| Speaker notes | ✅ `Note:` | ✅ `Notes:` | Rename `Note:` → `Notes:` |
| Math LaTeX | ✅ Yes | ✅ Yes | Direct |
| Code blocks | ✅ Yes | ✅ Yes | Direct |
| Unordered lists | ✅ Yes | ✅ Yes | Direct |
| Ordered lists | ✅ Yes | ✅ Yes | Direct |
| Blockquotes | ✅ Yes | ✅ Yes | Direct |
| Tables | ✅ Yes | ✅ Yes | Direct |
| Images (markdown) | ✅ Yes | ✅ Yes | Direct |
| Images (wiki-links) | ❌ No | ✅ Yes | N/A |
| Fragments/incremental reveal | ✅ Yes (via HTML) | ❌ No | **Migration needed** |
| Vertical slides | ✅ Yes (`--`) | ❌ No | Use columns instead |
| Slide transitions | ✅ Yes | ❌ No | Remove or ignore |
| CSS classes on slides | ✅ Yes (HTML comments) | ⚠️ Partial (can add via `class:` directive) | Partial support |
| Speaker view | ✅ Yes | ❌ No | Not applicable |
| Theme selection | ✅ Yes | ✅ Yes | Different syntax |
| Custom backgrounds | ✅ Yes | ✅ Yes (simpler) | Different approach |

---

## Detailed Incompatibilities & Solutions

### 1. **Vertical Slides (`--` syntax)**

**Advanced Slides**: Uses `--` to create nested/vertical slides
```markdown
# Main Topic

Content here

--

Subtopic in same section
```

**Perspecta Slides**: No vertical nesting support. Uses multi-column layout instead.

**Migration Solution**:
- Convert vertical slide content into columns within a single slide
- Use `###` headers to create column breaks:
```markdown
# Main Topic

Content here

### Subtopic

Subtopic in column 2
```

---

### 2. **Speaker Notes Syntax**

**Advanced Slides**: 
```markdown
---
Note: This is a speaker note
```

**Perspecta Slides**:
```markdown
---
Notes: This is a speaker note
```

**Migration Solution**: Simple find-and-replace: `Note:` → `Notes:`

---

### 3. **Fragments (Incremental Reveal)**

**Advanced Slides**: 
```markdown
- Item 1 <!-- .element: class="fragment" -->
- Item 2 <!-- .element: class="fragment" -->
```

**Perspecta Slides**: No native fragment support - all content is visible.

**Migration Solution**: 
- Remove fragment markup - content will show all at once
- Reorganize into separate slides if incremental reveal is critical
- Consider using separate columns to group related content

---

### 4. **HTML Comments for Slide Directives**

**Advanced Slides**:
```markdown
<!-- .slide: class="dark" data-background="url" transition="fade" -->
```

**Perspecta Slides**: Uses YAML frontmatter and special directives instead.

**Migration Path**:
```markdown
---
mode: dark
background: url
---
```

**Supported Perspecta directives**:
- `layout: cover|title|section|default|columns`
- `mode: light|dark`
- `background: image.jpg`
- `class: custom-class`
- `aspectRatio: 16:9|4:3|16:10`

---

### 5. **Transitions & Animations**

**Advanced Slides**: Full reveal.js transition/animation support
```markdown
<!-- .slide: transition="fade" -->
<!-- .element: class="fade-in" -->
```

**Perspecta Slides**: No transitions. All slides are instant.

**Migration Solution**: Remove all transition markup - not compatible.

---

### 6. **Theme System**

**Advanced Slides**: Reveal.js themes + custom CSS
```yaml
---
theme: black
---
```

**Perspecta Slides**: Custom theme system with semantic colors
```yaml
---
theme: zurich
lightTitleText: "#000"
darkTitleText: "#fff"
---
```

**Migration Solution**:
- Theme names won't match (Advanced Slides: `black`, `white`, `league`, etc.)
- Perspecta themes: `zurich`, `kyoto`, `berlin`, `minimal`
- Users must select a Perspecta theme and customize if needed
- Built-in theme mapping tool could be created

---

### 7. **CSS Classes & Custom Styling**

**Advanced Slides**: 
```html
<!-- .slide: class="dark-bg" -->
<!-- .element: class="highlight" -->
```

**Perspecta Slides**: 
```yaml
class: dark-bg
```

**Migration Solution**: Limited support - Perspecta's slide-level CSS classes are supported, but element-level styling requires custom theme creation.

---

### 8. **Background Images**

**Advanced Slides**:
```html
<!-- .slide: data-background="image.jpg" data-background-size="cover" -->
```

**Perspecta Slides**:
```yaml
background: image.jpg
```

**Status**: ✅ Compatible - both support simple background images

---

### 9. **Embedded Media (Video, iFrame)**

**Advanced Slides**: Full HTML/iframe support via reveal.js
```html
<video data-src="video.mp4"></video>
<iframe src="https://example.com"></iframe>
```

**Perspecta Slides**: Limited to standard markdown (images, links)

**Migration Solution**: Convert iframes to links, videos to image thumbnails with links. Perspecta could be extended to support embedded media.

---

### 10. **Speaker View & Presenter Mode**

**Advanced Slides**: Built-in speaker view with notes, timer, slide preview

**Perspecta Slides**: Inspector panel shows speaker notes in editor, but no dedicated presenter view

**Migration Solution**: Not directly compatible. Perspecta uses markdown editor notes instead of separate view.

---

## Migration Checklist for Advanced Slides Users

### Quick Win (No changes needed)
- [ ] Basic slide structure with `---`
- [ ] Headings, lists, blockquotes
- [ ] Code blocks with syntax highlighting
- [ ] Tables
- [ ] Markdown images
- [ ] Math LaTeX expressions

### Minor Changes Required
- [ ] Rename `Note:` → `Notes:` for speaker notes
- [ ] Update YAML frontmatter (especially `theme:`)
- [ ] Convert HTML comment directives to YAML format

### Significant Changes
- [ ] Remove all `<!-- .element: class="fragment" -->` markup
- [ ] Remove all `<!-- .slide: transition="..." -->` markup
- [ ] Convert vertical slides (`--`) to multi-column layouts
- [ ] Remove custom CSS class styling or recreate as custom theme

### Not Supported
- [ ] Fragments/incremental reveal
- [ ] Transitions/animations
- [ ] Speaker view presenter mode
- [ ] Embedded video/iframe
- [ ] Complex nested slide hierarchies

---

## Recommended Improvements for Better Compatibility

### High Priority (Easy wins)
1. **Support `Note:` as alias for `Notes:`** - Allow both syntaxes
2. **Create Advanced Slides → Perspecta theme mapping** - Provide conversion guide
3. **Auto-convert fragment classes** - Strip them on import without warning
4. **Support HTML comment directives** - Parse `<!-- .slide: ... -->` comments

### Medium Priority
1. **Fragment support via UI toggle** - Show/hide content progressively
2. **Basic CSS class support** - Allow element-level styling
3. **Video/iframe embedding** - Extend markdown parser

### Lower Priority (Large effort)
1. **Transition effects** - Would require significant renderer changes
2. **Speaker view mode** - Separate window/tab for presenter
3. **Vertical slide hierarchies** - Redesign layout system

---

## Conclusion

**Migration Difficulty**: ⚠️ **Moderate**

Perspecta Slides can handle most Advanced Slides content (headings, lists, code, tables, math), but users need to understand:

1. **No animations/transitions** - Content is static
2. **No vertical slides** - Use columns instead
3. **Different theme system** - Must select Perspecta themes
4. **Different note syntax** - `Note:` → `Notes:`
5. **No incremental reveal** - All content visible at once

**Best Use Case for Migration**: Users who want cleaner, more content-focused presentations without animations and who are willing to adapt their layout approach.

**Quickest Win**: Start with high-priority improvements list above to reduce friction.
