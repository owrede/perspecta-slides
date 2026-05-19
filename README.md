# Perspecta Slides

Write Markdown. Get presentations. **Without ever touching a layout tool.**

<img width="1728" height="1084" alt="Perspecta Slides UI" src="https://github.com/user-attachments/assets/7ba62593-ba0b-4efd-acdf-6b24dc58b4f0" />

---

## What Perspecta is — and what it isn't

Perspecta is **not** PowerPoint. It is not Keynote. There are no text boxes to drag, no alignment guides, no `Send to back`. The slide you see is not something you composed pixel by pixel — it is the result of your **Markdown content** being placed into a **predefined template** by the renderer.

This is a deliberate choice. Here is why.

### The problem with traditional slide tools

In PowerPoint or Keynote, every slide is its own little design project. You decide where the title goes, how big the body text should be, where the bullet list aligns, what color the background fades into. Multiply by 30 slides and you have spent half a day arranging boxes instead of writing the talk. Worse, no two slides look quite the same — alignment drifts, font sizes diverge, your deck visibly degrades as your fatigue grows.

The slide became the artifact you laboured over. The talk became an afterthought.

### Perspecta's bargain

Perspecta offers you a different trade. You give up the freedom to place individual elements. In exchange, you get:

- **Consistency by construction.** Every slide in a deck looks like it belongs in the same deck, because the same theme governs them all.
- **Speed.** A slide is a Markdown block, separated from the next by `---`. Writing five slides takes about as long as writing five paragraphs.
- **Editability.** You can rewrite the whole talk in five minutes the night before, because nothing is locked into hand-placed boxes.
- **Version control.** Your slides are plain text. `git diff` works. Search works. Find-and-replace works.
- **Focus on the talk, not the file.** The design happens once — in the theme. From then on, every slide is just "what do I want to say?"

### How design happens, then

Design lives in the **theme**. A theme is a small set of values — fonts, colors, sizes, margins, line heights — that the renderer applies to every slide. You can pick a theme, tweak it through the Inspector panel, save it as your own. You can have a "client pitch" theme and a "team standup" theme and a "lightning talk" theme. Each deck inherits its character from its theme.

Within a deck, you have a few semantic choices — which **layout family** a slide uses (cover, two columns, full image, section break), which color **mode** (light, dark, system), what **background** to set. These are deviations from the theme's defaults. Everything else is content.

This works for the vast majority of presentations. It does not work if you need a Sankey diagram squeezed into the corner of a slide, or precise hand-tuned typography for a museum exhibit. For those, use the right tool. For everything else — internal updates, conference talks, lecture series, workshop decks, demo slides — Perspecta gets out of your way and lets you write.

---

## Quick start

Create a new note in your vault. Write this:

```markdown
---
title: My First Deck
---

# Hello World

This is a Markdown paragraph and becomes a speaker note.

	Tab-indent a line to put it on the slide.

---

## Second slide

	- List items appear on the slide when tab-indented
	- Plain paragraphs above stay as speaker notes
```

Open the file. Click the slide icon in the ribbon. You have a presentation.

Two slides, separated by `---`. Headings are visible. Tab-indented content is visible. Everything else is a speaker note that only you see in the presenter view.

That is, almost in its entirety, the writing workflow.

---

## How a slide is built

Each slide has four conceptual layers:

```
┌─ Canvas        — the slide's rectangle (16:9 by default)
├─ Grid          — safe area inside the canvas (margins, header/footer position)
├─ Slots         — title region and body region (1–3 columns)
└─ Content       — your headings, lists, blockquotes, images
```

Themes set the canvas, the grid, and the size/color of content. Layouts select which slot configuration is used. You write the content.

For a complete description of the layout system — what each variable controls, what is and isn't expressible — see **[docs/LAYOUT-BLUEPRINT.md](docs/LAYOUT-BLUEPRINT.md)**. It is the source of truth for the system's architecture.

---

## Layout families

A slide picks a layout via `layout:` in its meta block (or auto-detects one). The choices are grouped into four families:

| Family | Layouts | Purpose |
|---|---|---|
| **Centered** | `cover`, `title`, `section` | Openers and act breaks. Sparse content, large headings, centered. |
| **Slot-based** | `default`, `1-column`, `2-columns`, `3-columns`, `2-columns-1+2`, `2-columns-2+1` | The workhorse. A title region and one to three body columns. |
| **Image-driven** | `full-image`, `half-image`, `half-image-horizontal`, `caption`, `grid` | When the image is the message. |
| **Special** | `footnotes` | A dedicated end-of-deck slide for aggregated references. |

You do not need to specify a layout. The `default` layout intelligently detects how many columns your content wants based on the structure of your Markdown.

---

## Setting things per deck and per slide

### Deck-wide (YAML frontmatter)

At the top of your file, between two lines of `---`:

```yaml
---
title: My Presentation
author: Your Name
theme: default
aspectRatio: '16:9'
mode: system
---
```

Frontmatter controls everything that applies to the whole deck: theme, aspect ratio, default mode, header/footer text, typography overrides. The Inspector panel exposes most of these as form controls.

### Per-slide (meta block)

Immediately after the slide separator, before the content, a small block of `key: value` lines:

```markdown
---

layout: full-image
background: hero.jpg
mode: dark

# A bold title over an image
```

Recognized keys: `layout`, `background`, `opacity`, `mode`, `hide-overlay`, `filter`.

This is **not** YAML. It is a flat list of simple keys, terminated by a blank line.

---

## Content conventions

Perspecta uses a Markdown convention to distinguish what lands on the slide from what stays as speaker notes:

- **Headings** (`#`, `##`, `###`, …) → always on the slide.
- **Tab-indented lines** (or 4 spaces) → on the slide.
- **Plain paragraphs** → speaker notes, visible only in the presenter view.
- **`^Kicker text`** → a small eyebrow line above a heading.
- **`// commented line`** → hidden from both slide and notes.
- **`notes:` on its own line** → everything after this is explicitly a speaker note.

Need a different convention? Set `contentMode: advanced-slides` in the frontmatter to switch to a mode where all content is visible by default.

For separating slides: `---` or `----` (three or four dashes) is a normal slide break. `-----` or more (five or more dashes) is an **act break** — it marks the start of a new narrative section. A future "light table" view will visualize these breaks; for now, the parser accepts the convention so you can start writing it today.

---

## Images

```markdown
![[my-image.png]]          ← Obsidian wikilink
![alt text](path.png)      ← standard Markdown
```

Images placed in a body column become inline figures. Images on slides with `layout: full-image`, `half-image`, or `caption` become the slide's dominant visual.

---

## Excalidraw

Excalidraw drawings render natively. You can reference parts of a drawing:

| Reference | Meaning |
|---|---|
| `![[drawing.excalidraw]]` | The full drawing |
| `![[drawing#^frame=Name]]` | A specific frame, including elements extending beyond it |
| `![[drawing#^clippedframe=Name]]` | A frame's contents clipped to its boundary |
| `![[drawing#^group=ID]]` | All elements in a named group |
| `![[drawing#^area=ID]]` | A cropped view around an element |

---

## Themes

A theme is a small bundle of values — fonts, colors, sizes, margins — that the renderer applies to every slide using it. Perspecta ships with one **built-in theme**, named `Default`. Any further themes you create are **custom themes**, stored in your vault under `perspecta-themes/`.

**To create a custom theme:** open a presentation, tune the Inspector until it looks the way you want, then run **"Save as custom theme"** from the command palette. The theme will appear in dropdowns marked with a ★.

**To switch themes mid-deck:** the Inspector offers two modes:
- *Apply theme only (keep overrides)* — non-destructive re-application; your existing frontmatter overrides remain.
- *Apply and reset overrides* — clears overrides so the new theme's defaults take effect.

**Sharing themes across devices:** custom themes live in the vault and can be synced via Obsidian Sync. Binary fonts and images may have sync caveats on some devices. See **[docs/THEME-SYNC-GUIDE.md](docs/THEME-SYNC-GUIDE.md)** for the full guide.

For the theme file format, see **[docs/THEME-SPECIFICATION.md](docs/THEME-SPECIFICATION.md)**.

---

## Commands

| Command | Description |
|---|---|
| Open presentation view | Opens current file in presentation view |
| Toggle slide navigator | Show/hide thumbnail navigator |
| Toggle slide inspector | Show/hide inspector panel |
| Start presentation | Fullscreen presentation window |
| Start presenter view | Speaker view with notes and timer |
| Export to HTML | Export as standalone HTML |
| Save as custom theme | Save current settings as a theme |
| Insert slide separator | Insert `---` at the cursor |

---

## Keyboard shortcuts

**In presentation mode:**

| Key | Action |
|---|---|
| `→` `↓` `Space` `PageDown` | Next slide |
| `←` `↑` `PageUp` | Previous slide |
| `Home` / `End` | First / last slide |
| `Escape` | Exit |

**In presenter view:**

| Key | Action |
|---|---|
| `↑` `↓` | Navigate slides |
| `←` `→` | Navigate speaker-note paragraphs |

---

## Installation

> **Note:** Perspecta Slides is currently in early development. Installation via the BRAT plugin is required until it reaches the Obsidian Community Plugins registry.

**Via BRAT (recommended):**

1. Install [BRAT](https://github.com/TfTHacker/obsidian42-brat) from Community Plugins.
2. In BRAT settings: *Add Beta Plugin* → paste `https://github.com/owrede/perspecta-slides`.
3. Enable Perspecta Slides under *Community plugins*.

**Manual:**

1. Download the latest release from [GitHub Releases](https://github.com/owrede/perspecta-slides/releases).
2. Extract to `.obsidian/plugins/perspecta-slides/`.
3. Reload Obsidian and enable the plugin.

---

## Documentation

Deeper-dive references, kept close to the code:

- **[docs/LAYOUT-BLUEPRINT.md](docs/LAYOUT-BLUEPRINT.md)** — the layout system as a normative blueprint: variables, families, freedoms, extension points.
- **[docs/PERSPECTA-SLIDES-SPEC.md](docs/PERSPECTA-SLIDES-SPEC.md)** — Markdown syntax reference.
- **[docs/THEME-SPECIFICATION.md](docs/THEME-SPECIFICATION.md)** — theme file format.
- **[docs/THEME-SYNC-GUIDE.md](docs/THEME-SYNC-GUIDE.md)** — multi-device theme sync.
- **[docs/IMAGE-SYSTEM.md](docs/IMAGE-SYSTEM.md)** — image resolution and rendering.
- **[docs/INCREMENTAL-UPDATES.md](docs/INCREMENTAL-UPDATES.md)** — live-update internals.
- **[CHANGELOG.md](CHANGELOG.md)** — version history.

---

## Known limitations

- **Obsidian 1.11 on Windows** — known font and UI rendering issues, related to the new Electron version.
- **Any Markdown file opens as a deck** — there is currently no check that a file is intended as a presentation.
- **Sidebar sometimes stale** — re-clicking the *Open slide presentation* ribbon icon usually fixes it.
- **Footnotes slide overflow** — large numbers of footnotes do not split across pages.
- **Frontmatter can grow** — heavy per-deck customization accumulates many frontmatter keys. Save as a custom theme to fold these into defaults.

---

## License

MIT — see [LICENSE](LICENSE).
