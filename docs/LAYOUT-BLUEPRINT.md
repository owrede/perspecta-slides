# Perspecta Slides — Layout Blueprint

**Status:** Normative source of truth for the layout system.
**Audience:** Plugin maintainers, theme authors, and anyone editing the renderer, the inspector, or the markdown parser.
**Relationship to code:** This document defines what the layout system *should* be. Where the current code diverges from it, the code is wrong and must be brought into alignment — not the other way around. Known divergences are catalogued in §8.

---

## 0. About this Blueprint

### 0.1 Purpose

Perspecta Slides is a constrained-template layout system. Users write Markdown; the renderer chooses a template; visual variation comes from a small, well-defined set of knobs. This works only as long as everyone — code authors, theme designers, and users — shares the same mental model of what those knobs are and what they do.

This blueprint exists so that:

- Every contributor can answer "what does this variable affect?" without reading the renderer.
- Every change to the layout system is first decided here, then implemented.
- Refactoring the renderer never silently changes user-visible behaviour, because the blueprint stays stable across implementations.
- Theme authors and external tools (e.g. design mockups in pencil.dev) can predict what is and isn't expressible.

### 0.2 When to update

Update this blueprint **before** changing the layout system in code. The accepted order is:

1. Propose a blueprint change in a PR. Review the concept, not the implementation.
2. Once the blueprint change is merged, write the code change. The code change is reviewed against the new blueprint.
3. Never the other way round.

Cosmetic value tweaks (default font weight, spacing constants) do **not** require a blueprint update. Adding a new variable, layout, or freedom does.

### 0.3 Out of scope

- Specific numeric defaults for the bundled "Default" theme — those live in `src/themes/builtin/index.ts`.
- Implementation of the parser — see `PERSPECTA-SLIDES-SPEC.md`.
- Theme file format on disk — see `THEME-SPECIFICATION.md`.
- Image resolution — see `IMAGE-SYSTEM.md`.

---

## 1. Conceptual Model

### 1.1 What Perspecta is

Perspecta is a **template-based slide renderer**. A slide is a piece of Markdown plus optional per-slide metadata. The renderer:

1. Picks a **layout template** based on the slide's metadata, falling back to auto-detection from the Markdown structure.
2. Maps Markdown elements into **fixed slots** defined by the template.
3. Styles everything using **CSS variables** sourced from the active theme, the presentation frontmatter, and per-slide overrides.

### 1.2 What Perspecta is not

- **Not a freeform layout tool.** Users do not place text boxes. They write content and choose a template family.
- **Not a CSS toolkit.** Themes do not ship arbitrary CSS rules that alter slot positions; they ship values for a fixed set of variables.
- **Not a deck programmability surface.** There is no scripting on slides. Variation is the deliberate selection from a constrained design space.

### 1.3 The variation principle

> **Design happens through deviation from a known base, not through placement.**

Every theme starts from the same canvas, the same grid, the same slot system, the same Markdown→element mapping. Themes differ only in the **values** they set for the variables defined in this blueprint. A new theme cannot invent new slots; it can only shift, recolor, and rescale the ones that exist.

This is a feature, not a limitation. It is what allows a user to write `## Headline` in a Markdown file and get a sensible slide without thinking about boxes.

### 1.4 The four layers

Every slide is composed of four conceptual layers, from outside in:

| Layer | Concern | Who controls it |
|---|---|---|
| **1. Canvas** | Slide aspect ratio and overall scaling | Presentation frontmatter |
| **2. Grid** | Safe area: top, bottom, left, right insets | Theme (defaults), frontmatter (overrides) |
| **3. Slots** | Title region and body region(s) within the safe area | Layout family + theme + frontmatter |
| **4. Content** | Headings, lists, images, blockquotes | Markdown source |

Each layer is described in §2.

---

## 2. The Slide Anatomy

### 2.1 The canvas

The canvas is the slide as a whole. It has exactly one user-controllable property: **aspect ratio** (`aspectRatio` in frontmatter). Supported values are `16:9`, `4:3`, `16:10`.

The canvas defines a scaling atom, the **slide-unit**:

> **slide-unit** is the geometric mean of canvas width and height, divided by a fixed reference, scaled by the optional `textScale` factor.

Practical interpretation: `1 slide-unit ≈ 1% of the average slide dimension`. A 1920×1080 canvas yields ≈ 15 px per slide-unit. The renderer expresses every absolute measurement as a multiple of slide-unit. This guarantees that the same layout renders proportionally identical on any canvas size.

The canvas itself is otherwise opaque: no rules sit *on* the canvas, only the grid and slots that live inside it.

### 2.2 The grid (safe area)

The grid is a rectangular safe area inside the canvas, defined by four insets from the canvas edges. All visible slide content lives inside the safe area, with these exceptions:

- The slide background (color, gradient, or image) covers the full canvas, edge to edge.
- In image-driven layouts (Family C, §3.3), the image extends beyond the safe area.

The four insets:

| Inset | Meaning | Symmetry expectation |
|---|---|---|
| `content-left` | Distance from left edge | Symmetric with `content-right` by convention; both can be set independently |
| `content-right` | Distance from right edge | — |
| `header-top` | Distance from top edge to the **center line** of the header strip | Asymmetric with `footer-bottom`; this is intentional (visual weight) |
| `footer-bottom` | Distance from bottom edge to the **center line** of the footer strip | — |

The header strip sits at `header-top`, spans horizontally from `content-left` to canvas-width minus `content-right`, and contains three slots: `header-left`, `header-middle`, `header-right`. The footer strip is the mirror, at `footer-bottom`. Header and footer strips are single-row, single-line; they do not wrap and do not stretch vertically.

The grid is the **only** absolute placement system in Perspecta. Everything inside the grid is positioned relative to it.

### 2.3 The slots

Within the grid, content is placed into named slots. The slots that exist depend on the layout family (§3). The two foundational slots, used by all slot-based layouts, are:

| Slot | Vertical extent | Horizontal extent | Purpose |
|---|---|---|---|
| **slot-header** (title slot) | Top at `title-top` from canvas top. Bottom is intrinsic (grows with content). | Spans the grid width. | Holds the slide's H1 / H2 / kicker. |
| **slot-columns** (body slot) | Top at `content-top` from canvas top. Bottom at `footer-bottom + columns-bottom-offset`. | Spans the grid width. | Holds 1–3 vertical columns of body content. |

**Important properties of slots:**

- The two slots are **independently positioned** from the canvas top. There is no "distance between title and body" variable. Increasing `content-top` does not push `slot-header` down; it just leaves more empty space.
- Slots **may overlap** if values are set adversarially (e.g. `title-top: 20`, `content-top: 18`). The renderer does not clip or warn. Themes are responsible for choosing values that don't collide given expected content.
- A slot **does not vertically center** its contents. Content starts at the slot top and grows downward.
- The body slot **stretches all columns to equal height** (it is a horizontal flex container with `align-items: stretch`).

The body slot's columns are determined by the layout (§3.2):

| Column configuration | Used by |
|---|---|
| 1 column, full width | `default` (single content block), `1-column` |
| 2 equal columns | `default` (auto-detected), `2-columns` |
| 3 equal columns | `default` (auto-detected), `3-columns` |
| 2 columns, narrow + wide (ratio 1:2) | `2-columns-1+2` |
| 2 columns, wide + narrow (ratio 2:1) | `2-columns-2+1` |

The **gap between columns** is a theme-controlled value (one for 2-column, one for 3-column). It is the same regardless of which 2-column variant is used.

### 2.4 The content layer

The content layer is what comes out of the user's Markdown and gets placed into slots. See §5 for the mapping. Content has no positioning agency: it lives where the slot places it, sized by theme variables, with no inline overrides for individual elements.

---

## 3. Layout Families

Layouts come in four families. The family determines the **geometric template**; the specific layout name within a family determines minor variants (column count, image position).

### 3.1 Family A — Centered (no slot system)

**Layouts:** `cover`, `title`, `section`

These layouts do not use the slot system. Instead, all content is collected into a single centered block, vertically and horizontally centered within the grid. There is no separate title slot or body slot; H1/H2 sit alongside any other content in the centered block.

**When to use:** opening slides, act breaks, single-sentence statements. Content should be sparse — typically a headline and at most one supporting line.

**Distinguishing properties:**
- Headings are larger than in slot-based layouts (cover/title H1 ≈ 9 units vs default H1 ≈ 7 units).
- The slide has an independent background variable per layout (`light-bg-cover`, `light-bg-title`, `light-bg-section` and their dark counterparts), falling back to the general slide background.

**What differentiates the three:**
- `cover` — semantic role: presentation opener. Default styling identical to `title`.
- `title` — semantic role: deck-internal title slide (act opener, chapter break).
- `section` — semantic role: separator between thematic acts.

The differentiation is **semantic and stylistic**, not geometric. A theme may give each of the three its own background or color treatment, but the geometry is the same.

### 3.2 Family B — Slot-based

**Layouts:** `default`, `1-column`, `2-columns`, `3-columns`, `2-columns-1+2`, `2-columns-2+1`

These layouts use the full slot system (§2.3): `slot-header` plus `slot-columns` with 1–3 columns.

**Auto-detection:** when the layout is `default`, the renderer infers column count from the Markdown structure. Multiple H3 blocks with parallel tab-indented content typically auto-resolve into multiple columns. Auto-detection can be suppressed with the `default;no-autocolumn` meta value.

**Distinguishing properties:**

| Layout | Columns | Column ratio | Auto-detected? |
|---|---|---|---|
| `default` | 1–3 (inferred) | equal | yes |
| `1-column` | 1 | full width | no |
| `2-columns` | 2 | equal | no |
| `3-columns` | 3 | equal | no |
| `2-columns-1+2` | 2 | 1:2 (left narrow) | no |
| `2-columns-2+1` | 2 | 2:1 (right narrow) | no |

### 3.3 Family C — Image-driven

**Layouts:** `full-image`, `half-image`, `caption`, `grid`

These layouts treat one or more images as the dominant visual element. The grid still defines a safe area, but image content extends to the canvas edges.

**Distinguishing properties:**

| Layout | Image extent | Text region |
|---|---|---|
| `full-image` | Full canvas | Header/footer strips overlay the image with a semi-transparent backdrop; no body slot. |
| `half-image` | Half the canvas (left or right) | A single-column text region on the opposite side, respecting the grid insets on that side. |
| `caption` | Most of the canvas | A short caption strip below or above the image. |
| `grid` | Multiple images in a grid pattern | No body text region; captions may sit per image. |

Header and footer strips remain in place across all Family C layouts, with a contrasting backdrop where they overlap image content.

### 3.4 Family D — Special

**Layouts:** `footnotes`

A dedicated layout for a footnotes-aggregation slide, typically auto-generated at the end of a presentation when slides reference footnotes that aren't shown inline. The footnotes layout uses its own structure: a left-aligned title, a table-like list of footnote entries, no slot system.

This family exists because the footnotes slide has unique semantic and visual requirements (dense list, hanging numbers, smaller body type). Other special-purpose layouts (e.g. a future "agenda" or "thank you" template) would belong here.

### 3.5 What a layout cannot be

The layout system is closed by design. The following are **not expressible** with any layout, and adding them requires a blueprint change:

- A free-floating element placed anywhere on the slide (e.g. an arrow between columns, a corner badge).
- A column with a different background from its neighbours.
- A layout with more than 3 columns.
- A title slot at the bottom of the slide, or a body slot above the title.
- Columns with intrinsic (not stretched) heights.
- Nested layouts (a column that itself contains columns).
- Per-column inset overrides.
- Multi-line headers or footers.
- A header or footer with only one of left/middle/right populated and the others removed from the layout flow.

---

## 4. Degrees of Freedom

This is the contract between the user, the theme, and the renderer. Every variable that affects slide appearance is listed here, with its scope of overridability.

### 4.1 The override hierarchy

A variable's effective value is resolved in this order, last-wins:

1. **Renderer constant** (lowest priority, used only when no theme defines the variable).
2. **Theme CSS** (`:root` block in theme css; applies to all slides using this theme).
3. **Presentation frontmatter** (applies to all slides in this presentation).
4. **Per-slide meta block** (highest priority for the variables it supports; applies to one slide).

The per-slide meta block is intentionally limited (§5.3): not every variable can be overridden per-slide. This is by design — most variables are deck-wide design decisions, not per-slide decisions.

### 4.2 Variable catalogue

Variables are grouped by what they control. Each row states the variable's intent, where it can be set, and which layouts it affects. Defaults are **not** listed here; defaults live in `src/themes/builtin/index.ts`.

#### 4.2.1 Canvas & global scaling

| Variable | Affects | Theme | Frontmatter | Per-slide |
|---|---|---|---|---|
| `aspectRatio` | Canvas shape | — | ✅ | — |
| `textScale` | Multiplier into slide-unit; scales everything proportionally | — | ✅ | — |

#### 4.2.2 Grid (safe area)

| Variable | Affects | Theme | Frontmatter | Per-slide |
|---|---|---|---|---|
| `content-left` | Left inset of safe area | ✅ | ✅ | — |
| `content-right` | Right inset of safe area | ✅ | ✅ | — |
| `header-top` | Header strip vertical position | ✅ | ✅ | — |
| `footer-bottom` | Footer strip vertical position | ✅ | ✅ | — |

#### 4.2.3 Slots (slot-based layouts only)

| Variable | Affects | Theme | Frontmatter | Per-slide |
|---|---|---|---|---|
| `title-top` | Top of slot-header | ✅ | ✅ | — |
| `content-top` | Top of slot-columns | ✅ | ✅ | — |
| `column-gap-2` | Gap between columns (2-column layouts) | ✅ | — | — |
| `column-gap-3` | Gap between columns (3-column layouts) | ✅ | — | — |
| `columns-bottom-offset` | Distance from slot-columns bottom to footer-bottom | ✅ | — | — |

#### 4.2.4 Typography — Fonts

| Variable | Affects | Theme | Frontmatter | Per-slide |
|---|---|---|---|---|
| `title-font` (family) | Headings | ✅ (via preset) | ✅ | — |
| `title-font-weight` | Heading weight | ✅ | — | — |
| `body-font` (family) | Body, lists, blockquote, tables | ✅ (via preset) | ✅ | — |
| `body-font-weight` | Body weight | ✅ | — | — |
| `header-font` (family) | Header strip | ✅ | ✅ | — |
| `header-font-weight` | Header weight | ✅ | ✅ | — |
| `footer-font` (family) | Footer strip | ✅ | ✅ | — |
| `footer-font-weight` | Footer weight | ✅ | ✅ | — |

#### 4.2.5 Typography — Size scales

All headings and body text in the renderer derive their pixel size from a **multiplier of slide-unit**, multiplied by a per-family scale factor, multiplied by a global scale factor. The blueprint defines the multipliers as theme variables; current code has them hard-coded (see §8).

| Variable | Affects | Theme | Frontmatter | Per-slide |
|---|---|---|---|---|
| `h1-size-default` | H1 multiplier in slot-based layouts | ✅ | — | — |
| `h2-size-default` | H2 multiplier in slot-based layouts | ✅ | — | — |
| `h3-size-default` | H3 multiplier | ✅ | — | — |
| `h4-size-default` | H4 multiplier | ✅ | — | — |
| `h5-size-default` | H5 multiplier | ✅ | — | — |
| `h6-size-default` | H6 multiplier | ✅ | — | — |
| `h1-size-centered` | H1 multiplier in cover/title layouts | ✅ | — | — |
| `h2-size-centered` | H2 multiplier in cover/title layouts | ✅ | — | — |
| `section-title-size` | Heading multiplier in section layout | ✅ | — | — |
| `body-size` | Body, lists multiplier | ✅ | — | — |
| `blockquote-size` | Blockquote multiplier | ✅ | — | — |
| `header-size` | Header strip multiplier | ✅ | — | — |
| `footer-size` | Footer strip multiplier | ✅ | — | — |
| `footnote-size` | Inline footnotes and footnote slide entries | ✅ | — | — |
| `caption-size` | Image caption multiplier | ✅ | — | — |
| `title-font-scale` | Frontmatter-level scale on all title elements (% offset) | — | ✅ `titleFontSize` | — |
| `body-font-scale` | Frontmatter-level scale on all body elements | — | ✅ `bodyFontSize` | — |
| `header-font-scale` | Frontmatter-level scale on header strip | — | ✅ `headerFontSize` | — |
| `footer-font-scale` | Frontmatter-level scale on footer strip | — | ✅ `footerFontSize` | — |
| `font-scale` (global, legacy) | Multiplies everything; for backwards compatibility | — | ✅ `fontSizeOffset` | — |

#### 4.2.6 Typography — Rhythm

| Variable | Affects | Theme | Frontmatter | Per-slide |
|---|---|---|---|---|
| `line-height` | Line height for headings, body, lists | ✅ | ✅ | — |
| `headline-spacing-before` | Margin above any heading | ✅ | ✅ | — |
| `headline-spacing-after` | Margin below any heading | ✅ | ✅ | — |
| `list-item-spacing` | Margin between list items | ✅ | ✅ | — |

#### 4.2.7 Color — Backgrounds

| Variable | Affects | Theme | Frontmatter | Per-slide |
|---|---|---|---|---|
| `light-background`, `dark-background` | Slide background (default) | ✅ | ✅ | ✅ `background` (single value, mode-agnostic) |
| `light-bg-cover`, `dark-bg-cover` | Background for `cover` layout | ✅ | ✅ | — |
| `light-bg-title`, `dark-bg-title` | Background for `title` layout | ✅ | ✅ | — |
| `light-bg-section`, `dark-bg-section` | Background for `section` layout | ✅ | ✅ | — |
| `light-bg-gradient`, `dark-bg-gradient` | Dynamic gradient palette (when enabled) | ✅ | ✅ `lightDynamicBackground`, `darkDynamicBackground` | — |
| `useDynamicBackground` | Enables gradient-walk across slides | — | ✅ | — |
| `dynamicBackgroundRestartAtSection` | Resets gradient at each section slide | — | ✅ | — |
| Background filter | `darken` / `lighten` / `blur` / `none` over a background image | — | — | ✅ `filter` |
| Background opacity | Opacity of background image | — | — | ✅ `opacity` |

#### 4.2.8 Color — Text

| Variable | Affects | Theme | Frontmatter | Per-slide |
|---|---|---|---|---|
| `light-body-text`, `dark-body-text` | Body color in each mode | ✅ | ✅ | — |
| `light-title-text`, `dark-title-text` | Default heading color | ✅ | ✅ | — |
| `light-h1-color` … `light-h4-color` and dark equivalents | Per-level heading color (overrides title-text) | ✅ | ✅ | — |
| `light-header-text`, `dark-header-text` | Header strip color | ✅ | ✅ | — |
| `light-footer-text`, `dark-footer-text` | Footer strip color | ✅ | ✅ | — |

#### 4.2.9 Color — Semantic

| Variable | Affects | Theme | Frontmatter | Per-slide |
|---|---|---|---|---|
| `light-link-color`, `dark-link-color` | Hyperlinks | ✅ | ✅ | — |
| `light-bullet-color`, `dark-bullet-color` | List bullets | ✅ | ✅ | — |
| `light-blockquote-border`, `dark-blockquote-border` | Blockquote left border | ✅ | ✅ | — |
| `light-table-header-bg`, `dark-table-header-bg` | Table header row background | ✅ | ✅ | — |
| `light-code-border`, `dark-code-border` | Code block border | ✅ | ✅ | — |
| `light-progress-bar`, `dark-progress-bar` | Progress bar fill | ✅ | ✅ | — |

#### 4.2.10 Mode

| Variable | Affects | Theme | Frontmatter | Per-slide |
|---|---|---|---|---|
| `mode` | Selects light/dark token set | — | ✅ (`light` / `dark` / `system`) | ✅ (`light` / `dark`) |

When unset, `mode` resolves to Obsidian's active color scheme. See `ColorScheme.ts`.

### 4.3 What is deliberately not overridable

The following are constants of the layout system. They are **not** variables and cannot be set in any theme or frontmatter:

- The fact that header and footer strips span the grid width.
- The fact that columns stretch to equal height.
- The fact that body content starts at the top of its slot and grows downward.
- The semantic meaning of layout family names (`cover` = opener, `section` = act break).
- The 1:2 / 2:1 ratios for asymmetric column layouts — adding other ratios requires a new layout name and a blueprint change.
- The fact that slot-header and slot-columns are independently positioned from the canvas top.

---

## 5. Markdown → Slide Mapping

### 5.1 Slide separation

A presentation is a Markdown file. Slides are separated by horizontal-rule lines on their own:

- `---` or `----` (3 or 4 dashes) → normal slide break.
- `-----` or more (5+ dashes) → act break. Behaves as a slide break, plus opens a new act for UI grouping.

Chapter labels live in the per-slide meta block as the `chapter:` key (§5.3), **not** inline on the separator line. The inline form (`----- Foo`) was removed because it prevented Obsidian's Live Preview from rendering the HR. A slide that sets `chapter:` opens (or renames) the running chapter; following slides inherit it until another slide sets `chapter:` again. An explicitly empty value (`chapter:` with nothing after the colon) clears the running chapter.

Blank lines around separators are **not** required since 0.3.x. A per-slide meta block may start on the very next line after the separator.

Code fences (` ``` ` and `~~~`) are honoured by the splitter: a `---`/`-----` line inside a fenced block is content, not a separator.

The YAML frontmatter at the top of the file (delimited by `---` on its own lines) is parsed separately and never counts as a slide separator.

### 5.2 Content modes

Two content modes determine how Markdown is split between slide-visible content and speaker notes. The mode is selected via `contentMode` in frontmatter; the default is `perspecta`.

**Mode `perspecta` (default, since 0.3.x):**
- All content is slide-visible by default.
- A `^Kicker` line above a heading becomes a kicker (eyebrow text).
- A line starting with `//` is a comment, hidden from both slide and notes.
- A speaker-notes marker line begins the notes section. Everything after it on this slide is hidden from the slide and shown only in the presenter view.

**Mode `advanced-slides`:**
- All content is slide-visible by default.
- A speaker-notes marker line begins the notes section.

**Speaker-notes markers (both modes):**
A marker line is a line whose trimmed, case-insensitive content matches one of these forms (with internal `-` and whitespace treated as equivalent, ending with `:` and nothing else after the colon):

| English | German |
|---|---|
| `note:` | `notiz:` |
| `notes:` | `notizen:` |
| `speaker note:` / `speaker notes:` | `sprechertext:` |
| `speaker-note:` / `speaker-notes:` | `sprecher-notiz:` / `sprechernotiz:` |
| `presenter note:` / `presenter notes:` | |
| `presenter-note:` / `presenter-notes:` | |
| `moderator note:` / `moderator notes:` | |
| `moderator-note:` / `moderator-notes:` | |
| `moderation:` | |

The canonical form used in generated content (skills, demo decks) is `notes:`. The others exist for user-typed compatibility.

> **Note on tab indentation (historical):** before 0.3.x, the perspecta mode used tab-indent as the slide-visible marker (a legacy of the iA-Presenter compatibility era). That convention conflicted with normal Markdown indentation (nested lists became invisible) and was removed. Tab indentation is now plain Markdown indentation with no parser semantics.

### 5.3 Per-slide meta block

Immediately after a slide separator, before the slide's content, an optional meta block may appear. The block is a sequence of `key: value` lines, terminated by the first blank line (or any line that does not match the meta syntax, such as a heading).

The meta block is **not** YAML, **not** HTML comments, and **not** the same as frontmatter. It is a flat list of recognized keys.

| Key | Values | Purpose |
|---|---|---|
| `layout` | Any layout name from §3 (optionally `<name> (hidden)`) | Selects layout family and variant; `(hidden)` hides the slide from rendering |
| `background` | Color, image path, or named color | Per-slide background |
| `opacity` | `0`–`100%` | Opacity of background image |
| `mode` | `light` / `dark` | Per-slide mode override |
| `hide-overlay` or `hideOverlay` | `true` / `false` | Hides header/footer strips on this slide |
| `filter` | `darken` / `lighten` / `blur` / `none` | Filter applied over a background image |
| `chapter` | Free text | Opens (or renames) the running chapter/act. Inherits to following slides until another `chapter:` is set. Empty value clears the chapter. See §5.6 for the `{{chapter}}` placeholder. |

Unrecognized keys are ignored (silently). This is by design: forward compatibility for future keys.

### 5.4 Element placement

For slot-based layouts, the following elements come out of Markdown and land in the named slot:

| Markdown element | Lands in | Notes |
|---|---|---|
| `^Kicker` | `slot-header`, above H1 | One line only |
| `# Heading 1` | `slot-header` | The first H1 typically; multiple H1s are not designed for |
| `## Heading 2` | `slot-header` | Same slot as H1, smaller |
| `### Heading 3` | `slot-columns` column heading | When auto-column detection is active, each H3 typically starts a column |
| `#### / ##### / ######` | `slot-columns` body | Subordinate headings within a column |
| Tab-indented paragraph / list / blockquote | `slot-columns` column body | The indentation marks slide-visible content in `perspecta` mode |
| `![alt](path)` or `![[wikilink]]` | `slot-columns` (or as background in image layouts) | — |
| Footnote reference `[^1]` | Footnote area at slot-columns bottom | Definitions are aggregated; see §3.4 |

In centered layouts (Family A), all elements collapse into the single centered block.

In image-driven layouts (Family C), text elements land in the text region (where present); images land in the image region.

### 5.5 Column resolution

For slot-based layouts:

- If the layout is `default`, the renderer infers column count from the structure of slide-visible content. Multiple parallel H3 sections, or multiple top-level lists separated by blank lines, typically yield multiple columns. Inference can be suppressed with `layout: default;no-autocolumn`.
- If the layout is `1-column`, `2-columns`, `3-columns`, `2-columns-1+2`, or `2-columns-2+1`, the column count is fixed by the layout name. Content is distributed across columns based on the order of H3 blocks (or, when no H3s, by explicit `--` column-break markers on their own lines).

The `--` column-break (two dashes on a line by itself within a slide) forces a column transition. It is independent of the slide separator (which is 3+ dashes).

### 5.6 Content placeholders

A small placeholder syntax lets slide content reference deck/slide-level metadata without duplicating it. Placeholders use double-brace syntax — `{{name}}` — and are substituted at parse time, after slides have been split and metadata resolved. They work in any text-bearing element (headings, paragraphs, list items, blockquotes, kicker, speaker notes).

Current placeholders:

| Placeholder | Substituted with | Empty when |
|---|---|---|
| `{{chapter}}` | The label of the act/chapter the slide belongs to (see §5.1) | The slide is outside any named chapter |

**Unknown placeholders are left intact.** A typo like `{{chpter}}` renders as the literal string `{{chpter}}` rather than disappearing silently, so authoring mistakes are visible.

Names are case-insensitive (`{{Chapter}}` works), whitespace inside the braces is tolerated (`{{ chapter }}` works), and the recognised charset is `[a-z][a-z0-9_-]*` (to leave room for future placeholders like `{{slide-number}}` without re-thinking the lexer).

This is a deliberately minimal mechanism. It is not a templating engine: no conditionals, no loops, no nested expressions. Adding more variables happens in one place (the parser's substitution table) and requires a one-line entry in the table here.

---

## 6. Theme System

### 6.1 What a theme is

A theme is a bundle that provides values for the variables in §4. A theme contains:

- **Template metadata** — name, author, version, font family identifiers.
- **One or more presets** — each preset is a named color/font configuration (e.g. "Light", "Dark", "Brand"). The first preset is the default.
- **Theme CSS** — a single CSS block setting variables that the renderer reads. The theme CSS is injected into every slide's iframe at render time.
- **Optional bundled fonts** — font files referenced by the theme.

Themes ship either as **built-in** (in `src/themes/builtin/`) or as **user-installed** themes (in the vault's configured themes folder).

### 6.2 The default theme contract

Exactly one theme is the **plugin default**: the built-in `Default` theme. Its `name` (lowercased) is `default` and its key in the built-in registry is also `default`. This theme:

- Provides values for **every variable** in §4. It is the safety net: when no other theme is loaded, the renderer still has a complete variable set.
- Is the value of `PLUGIN_DEFAULT_THEME` in `src/types.ts`, which in turn is the initial value of `settings.defaultTheme`.
- Is what `settings.defaultTheme` falls back to when `frontmatter.theme` is unset.

In the inspector's theme dropdown, the entry labelled "(Use plugin default)" maps to `frontmatter.theme = undefined`. The built-in `Default` theme is **not** listed separately under that name, to avoid two visually identical "Default" entries.

### 6.3 What a theme may do

- Set any variable listed as theme-overridable in §4.2.
- Bundle font files and reference them in `title-font` / `body-font`.
- Define multiple presets (the first preset is used as the active preset; multi-preset selection is a future UI affordance).
- Provide its own dynamic-gradient palette via `light-bg-gradient` / `dark-bg-gradient`.

### 6.4 What a theme must not do

- Define CSS rules that target slide structure (selectors like `.slot-columns`, `.slide`, `.layout-default`). Themes operate through variables, not selectors.
- Override variables that §4.2 marks as not theme-overridable (e.g. per-slide-only variables).
- Introduce new slots, new layouts, or new structural elements.
- Use position properties (`position: absolute`, `top:`, etc.) — placement is the layout system's responsibility.
- Reference internal class names of the renderer; those are implementation details and may change.

### 6.5 Theme authoring workflow

1. Start from the default theme as a template.
2. Set values for the variables you wish to differentiate.
3. Test with at least one representative slide per layout family (a cover, a 2-column body slide, a half-image slide).
4. Verify in both `mode: light` and `mode: dark`.
5. Export through the Inspector's theme exporter, which produces a self-contained theme package.

---

## 7. Extension Points

### 7.1 Adding a new theme variable

When you want themes to control something that is currently hard-coded:

1. **Propose in this blueprint first.** Add a row to the relevant table in §4.2 with the variable's name, what it affects, and where it's overridable.
2. **Provide a value in the built-in default theme.** No variable is allowed to exist without a default.
3. **Wire the variable into the renderer** as `var(--variable-name, <fallback>)`. The fallback should match the built-in default, so a theme with no value still renders.
4. **If user-facing**, expose it in the Inspector and add the frontmatter property in `types.ts`.
5. **Update tests** if they exist; otherwise verify manually against the demo deck.

### 7.2 Adding a new layout

A new layout means a new slot configuration or a new family member. This is a significant change.

1. **Propose in this blueprint.** Decide which family it joins, or whether it constitutes a new family. Define its slots, its content expectations, and its variables.
2. **Implement the renderer pathway.** New CSS classes (`.layout-<name>`), new HTML structure if needed.
3. **Add it to the layout enum** in `types.ts` and to the parser's recognized values.
4. **Document it** in `PERSPECTA-SLIDES-SPEC.md` (user-facing) in addition to this blueprint (system-facing).
5. **Update the perspecta-slides skill** so AI-generated decks can use it.

### 7.3 Adding a new per-slide meta key

Per-slide meta keys are restrictive on purpose. To add one:

1. **Confirm it cannot be a frontmatter key instead.** Most design decisions are deck-wide, not per-slide.
2. **Propose in this blueprint** (§5.3 table).
3. **Update the parser** (`extractSlideMetadata` in `SlideParser.ts`).
4. **Wire it into the renderer** if it affects styling, or into the layout-selection logic if it affects placement.

### 7.4 Adding a new frontmatter property

1. **Propose in this blueprint** (corresponding §4.2 table).
2. **Add to `PresentationFrontmatter` interface** in `types.ts`.
3. **Wire into `generateCSSVariables`** in `SlideRenderer.ts` if it sets a CSS variable.
4. **Add an Inspector control** for it.

### 7.5 What requires a major version bump

- Removing or renaming any blueprint-listed variable.
- Removing a layout name.
- Changing the semantic meaning of a per-slide meta key.
- Changing column-resolution rules in a way that re-renders existing decks differently.

---

## 8. Implementation Drift

This section catalogues where the current code (as of the blueprint's creation date) diverges from the blueprint. Each entry has:

- **What:** the divergence.
- **Why it matters:** the practical consequence.
- **Resolution plan:** what to do.

These items form the refactoring backlog. They should be resolved in dependency order (D1 first), and each resolution should be a separate PR.

### D1. Heading size multipliers are hard-coded in the renderer

**Resolved.** CSS variables `--h1-size-default` … `--h6-size-default`, `--h1-size-centered`, `--h2-size-centered`, `--body-size`, `--blockquote-size`, `--kicker-size`, `--header-size`, `--footer-size`, `--footnote-size`, `--caption-size`, `--caption-title-size`, `--footnotes-title-size`, `--footnotes-list-size`, `--section-title-size` are now consumed by the renderer with `var(--name, <fallback>)` patterns. The built-in default theme provides values for all of them. Themes can now differentiate their typographic character.

### D2. Theme-level font-size offsets are dead code

**Resolved.** The `*-font-size-offset` variables and `--text-scale` were removed from the built-in default theme's CSS. The canonical mechanism for theme-level size control is now the per-element multipliers introduced in D1; frontmatter scales (`titleFontSize`, `bodyFontSize`, etc.) compose on top via `*-font-scale`.

### D3. Column gaps are hard-coded

**Resolved.** `--column-gap-2` and `--column-gap-3` are now consumed by `.slot-columns` (default 2-col gap) and `.slot-columns.columns-3` respectively. Defaults in the built-in theme preserve previous spacing (3 and 5 slide-units).

### D4. `columns-bottom-offset` is hard-coded

**Resolved.** The body-slot's bottom edge is now `(footer-bottom + columns-bottom-offset) * slide-unit`. Default `columns-bottom-offset: 4` in the built-in theme.

### D5. Single-color background falls back to gradient position 0

**Resolved.** Earlier behaviour: `LightBackgroundColor` was derived from the first color of the dynamic-gradient palette. Now: explicit single-color defaults in `createDefaultTheme()`. The dynamic gradient is independent.

### D6. `setPresentation` signatures were inconsistent

**Resolved.** All views now use `setPresentation(presentation, theme?, file?)`.

### D7. Mode detection used OS-level `prefers-color-scheme`

**Resolved.** A single `getObsidianColorScheme()` utility reads `body.theme-dark`. All call sites converted. The OS-level listener was replaced with the Obsidian `css-change` event.

### D8. The Inspector's theme dropdown had two "Default" entries

**Resolved.** The entry for `frontmatter.theme = undefined` is labelled "(Use plugin default)". The built-in `Default` theme is filtered out of the user-themes list to avoid duplication.

### D9. `generateDefaultCSS()` was not wired up

**Resolved.** `SlideRenderer` falls back to `generateDefaultCSS()` when no theme is loaded.

### D10. `--text-scale` variable in default theme CSS is unused

**Resolved.** Removed from the built-in default theme CSS. `textScale` remains as a frontmatter-only property that is folded directly into the `--slide-unit` computation by the renderer.

### D11. The `general-background.colors` in default theme has 17 entries

**Resolved.** Confirmed canonical: the 17-step gradient is the bundled dynamic-background palette for the default theme. Documented in §4.2.7. A theme that ships a `useDynamicBackground`-friendly palette should provide an `LightBgGradient` / `DarkBgGradient` of at least two steps; the renderer interpolates between them based on slide position.

### D12. `headlineSpacingBefore`, `headlineSpacingAfter` listed as em

**Resolved.** Type-doc comments in `types.ts` and Inspector section descriptions now say "slide-units (1 unit ≈ 1% of slide diagonal)". Numeric semantics unchanged.

### D13. Layout enum and parser do not share a single source

**Resolved.** A `LAYOUTS` constant in `types.ts` is the single source of truth; `SlideLayout` is derived as `typeof LAYOUTS[number]`. The parser imports `isValidLayout()` and logs unknown layout values to the debug channel (without rejecting them — forward compatibility).

---

## 9. Glossary

**Aspect ratio** — The width-to-height ratio of the canvas. Set per-presentation via frontmatter. Supported: `16:9`, `4:3`, `16:10`.

**Body slot** — Synonymous with `slot-columns`. The region of the slide that holds main content, divided into 1–3 columns.

**Canvas** — The rectangular area of one slide. Sized by the renderer to fit its container; proportions controlled by aspect ratio.

**Centered layout** — A layout in Family A (cover, title, section). No slot system; content is vertically and horizontally centered.

**Column-gap** — The horizontal space between adjacent columns in a multi-column body slot.

**Content mode** — How the parser distinguishes slide-visible content from speaker notes. Either `perspecta` (default) or `advanced-slides`.

**Default theme** — The built-in theme named `Default`, registered as `default` in the built-in theme map. It is the safety net that supplies values for every variable.

**Effective mode** — The resolved value of `mode` for a slide, after applying per-slide override, then frontmatter, then Obsidian color scheme.

**Family** — A grouping of layouts sharing a geometric template. Four families: A (Centered), B (Slot-based), C (Image-driven), D (Special).

**Frontmatter** — The YAML block at the top of the presentation Markdown file. Provides presentation-wide configuration.

**Grid** — The rectangular safe area inside the canvas, bounded by `content-left`, `content-right`, `header-top`, `footer-bottom`.

**Header strip / footer strip** — Horizontal regions at the top and bottom of the grid, containing three slots each (left, middle, right). Single-row, content-driven from frontmatter.

**Layout** — A specific named template. One of: `cover`, `title`, `section`, `default`, `1-column`, `2-columns`, `3-columns`, `2-columns-1+2`, `2-columns-2+1`, `full-image`, `half-image`, `caption`, `grid`, `footnotes`.

**Meta block** — The optional `key: value` block at the start of a slide, between the separator and the slide content.

**Mode** — `light` or `dark`. Selects which color tokens are active.

**Preset** — A named configuration within a theme. A theme has one or more presets; the first is the default. Multi-preset selection is not yet a user-facing affordance.

**Safe area** — Synonymous with the grid. The bounded region where slot content lives.

**Slide-unit** — The scaling atom. Approximately 1% of the average slide dimension. All renderer measurements are multiples of slide-unit.

**Slot** — A named placement region within a layout. The two primary slots are `slot-header` and `slot-columns`.

**Slot-based layout** — A layout in Family B (default, 1-column, 2-columns, 3-columns, asymmetric variants). Uses the full slot system.

**Theme** — A bundle of variable values, template metadata, optional CSS, and optional bundled fonts that determines a presentation's visual style.

**Title slot** — Synonymous with `slot-header`. The region that holds H1/H2 in slot-based layouts.
