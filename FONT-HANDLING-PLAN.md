# Font Handling — Robustness Plan

Working document. Captures the audit of today's font pipeline, the decisions
we have made, and the staged work to make font handling rock-solid across
font technologies (OTF / TTF / WOFF2, static / variable), platforms
(Windows / macOS / Linux), and export targets (live editor, HTML, PDF, PPTX).

Status: planning. No code changes yet beyond the variable-font detection
hotfix already shipped (`FontManager.generateFontFaceCSSForExport`).

---

## 1. Current architecture (as-is)

Three font ingestion paths run side-by-side, sharing the same on-disk layout
but diverging in metadata fidelity:

1. **Google Fonts** — `FontManager.cacheGoogleFont` requests the Google
   stylesheet, parses `@font-face` blocks, downloads files into
   `<vault>/perspecta-fonts/<Family>/...`.
2. **Local folder** — `FontManager.cacheLocalFont` scans a vault folder,
   detects weight / style from filename heuristics, copies files into the
   same `perspecta-fonts/<Family>/...` layout.
3. **Theme-bundled** — `ThemeLoader.generateThemeFontCSS` reads files from
   `<theme>/fonts/` at render time and inlines them as base64 in the
   `@font-face` rules.

Cache metadata lives in plugin `data.json` (`CachedFont` records). Files
live in the vault. At render time, three CSS layers stack:

- Theme CSS (variables, theme-bundled `@font-face` inlined as base64)
- Frontmatter CSS variables (override `--title-font`, `--title-font-weight`, …)
- Slide content (uses `var(--title-font, …)` / `var(--title-font-weight, …)`)

For PDF and HTML export the same `customFontCSS` payload is built once per
presentation and handed to the renderer.

---

## 2. Failure modes we have observed or can predict

### 2.0 Font field has two incompatible meanings (data-model bug)

**Severity**: P1 — likely root cause of theme-font flakiness in addition to
the variable-font issue.

Across the codebase, "font" is sometimes a **family name** (`Inter`) and
sometimes a **CSS stack** (`'Inter', sans-serif`). The same field
holds both depending on origin:

- `ThemeLoader.convertThemeJsonToPreset()` at
  [ThemeLoader.ts:234](src/themes/ThemeLoader.ts) writes the CSS stack form
  into `preset.TitleFont` / `preset.BodyFont`
  (e.g. `'Inter', sans-serif`).
- `InspectorPanel.applyThemeDefaults()` at
  [InspectorPanel.ts:1435](src/ui/InspectorPanel.ts) copies that stack
  string directly into `frontmatter.titleFont` / `frontmatter.bodyFont`.
- `SlideRenderer.generateCSSVariables()` at
  [SlideRenderer.ts:3202](src/renderer/SlideRenderer.ts) then wraps the
  already-quoted stack in another set of quotes:
  `--title-font: '${frontmatter.titleFont}', sans-serif;`
  producing invalid CSS like `''Inter', sans-serif', sans-serif`.

Effect: after resetting/applying a theme through the Inspector, the
`--title-font` variable contains malformed CSS. The browser ignores it and
falls back to whatever the cascade resolves next — sometimes the
theme-bundled `@font-face`, sometimes system Inter, sometimes the
generic `sans-serif`. This explains why theme-font behavior feels
non-deterministic.

Fix direction (Phase 1): **frontmatter stores canonical family names
only**. CSS-stack composition happens exactly once, in the renderer's
variable layer. Theme presets either expose two fields (`familyName`
+ `cssStack`) or store the canonical family and derive the stack on
read.

### 2.1 Variable-font detection is heuristic and fragile

**Status**: hotfixed (see commit context; `font.weights.length > uniqueWeightStylePairs` added as a secondary signal). Not yet root-caused.

Google Fonts often returns one `@font-face` block per `(weight, style)`
combination, all pointing to the same woff2 file, all declaring
`font-weight: 100` (the nominal axis default). Today's detection
("same path appears with multiple different weights") sees only weight 100
on a single file pair and concludes "static font" — emits
`font-weight: 100;` in the generated `@font-face`. The browser then
renders every weight as Thin 100 because that is the only declared
weight for the family.

The hotfix patches the symptom. The root cause is that the cache record
does not store whether the font is variable — the renderer has to re-derive
it from file metadata that may not contain enough signal.

### 2.2 OTF vs. TTF — format quirks across engines

- **Chromium / Electron** (Obsidian, PDF print): renders OTF (CFF/CFF2)
  generally fine. Edge cases: very old OTFs with non-standard tables can
  fail silently. `printToPDF`'s font subsetter occasionally drops CFF2
  glyphs, leaving the PDF rendered with the OS fallback for those glyphs.
- **macOS Safari/WebKit**: OTF is first-class.
- **Linux Chromium**: depends on the bundled font config — sometimes ignores
  `font-weight` ranges on OTF variable fonts.
- **PowerPoint Mac**: cannot embed TTFs with `cmap format 12` and refuses
  certain CFF-based OTFs. We already wrap embedded fonts as EOT for the
  `.pptx` path (recent commits `24f39b0`, `f99f1b6`, `73443c1`).
- **woff2** is the safest universal target for web/PDF rendering. PPTX
  remains its own world.

### 2.3 Family-name collisions: theme-bundled vs. system-installed

A theme bundles `Inter` via base64. The user also has `Inter` installed
system-wide. The browser is supposed to prefer locally declared `@font-face`
sources over system fonts, but in practice:

- Subtle version drift between the bundled Inter and the OS Inter can
  produce different metrics in editor vs. PDF.
- If the bundled `@font-face` fails to load for any reason (corrupt base64,
  unsupported format on the platform), the browser silently falls back to
  the system font — looks fine in the editor, surprises the author at
  export time.
- Two themes can both declare `font-family: 'Inter'` with different files.
  Whichever is loaded last wins for the rest of the page.

### 2.4 Weight fallback is silent

`SlideRenderer.validateFontWeight` finds the closest available weight when
the requested one is missing — no UI surface. If a theme presets
`titleFontWeight: 800` but the theme-bundled font only ships 400/700, the
user sees Title in 700 and has no idea the configured 800 was unavailable.

### 2.5 Theme fonts are not validated at load time

`bundledFonts` manifest entries in `theme.json` are trusted blindly by
`ThemeLoader.generateThemeFontCSS`. A missing file, a wrong `format`
declaration, or an incorrect `weight` value silently degrades the theme
without surfacing the problem. Theme authors discover issues only when
they look closely at rendered output.

### 2.6 Path fragility — Windows + portable themes

- `FontManager.fixCorruptedPath` exists specifically to repair concatenation
  bugs on Windows where the cache folder name got duplicated into a
  filename. The fact that we have a *repair* function means the construction
  is broken — there is no single `vaultPathJoin(...)` primitive that all
  call sites use.
- Theme paths today resolve via `theme.basePath + fileRef.path`. The
  manifest allows arbitrary relative paths; nothing enforces that bundled
  fonts live under `fonts/`. Moving or zipping a theme can desync paths
  if the manifest references something outside the theme folder root.

### 2.7 PDF export: per-iframe font duplication

`PdfExportService.generatePrintHTML` wraps every slide as an `<iframe srcdoc="...">`. Each srcdoc inlines the full `customFontCSS` (base64 of every cached font weight used in the deck). For a 21-slide deck with Inter as variable font (~700 KB base64 expansion) that is ~14 MB of duplicated font data injected via `document.write`. Electron handles it, but:

- `executeJavaScript` round-trip overhead grows linearly
- We've seen flaky `printToPDF` captures when the HTML is very large
- Subsetting per-slide based on actually used glyphs is not done — every slide carries the whole font

A cleaner architecture is to inject fonts **once** in the parent print HTML and let iframes inherit. Or stop using iframes at all and render directly into the print document.

### 2.8 HTML export — no fallback chain

`ExportService.generateEmbeddedFontCSS` returns the cached font CSS as-is.
There is no graceful degradation if a file failed to embed. No alternate
format declaration (e.g., woff2 + woff fallback for older browsers).
For self-contained HTML shared externally this is a real risk.

### 2.9 Built-in default theme references Inter without bundling it

`src/themes/builtin/index.ts` declares Inter as title and body font, but
`ThemeLoader.generateThemeFontCSS` only generates bundled-font CSS for
non-builtin themes (`if (theme.isBuiltIn) return ''`). If the user has not
also cached Inter through Font Settings, the active default theme silently
falls back to whatever the cascade picks. The product invariant we want
("themes own their fonts; moving a theme keeps it functional") is violated
by our own default.

Fix direction: either bundle Inter inside the built-in theme record
(base64 in code, or shipped as a `.theme` archive alongside the plugin),
or change the default theme to use a true system font stack
(`system-ui, -apple-system, ...`) so that the "Inter" expectation only
exists when the user has cached Inter on their own.

### 2.10 Cache record is undertyped

`CachedFont` carries `weights`, `styles`, `files[]` but no explicit
`isVariable`, no `variationAxes`, no `weightRange`, no checksum. Every
consumer has to rederive the variability classification — and as 2.1
shows, they get it wrong.

### 2.11 Font CSS regenerates from binaries on hot UI paths

**Severity**: P2 perf.

`main.ts` calls `getCustomFontCSS(frontmatter)` from sidebar refresh,
file open, editor changes, and external-window updates
(see `main.ts:1842`, `main.ts:1917`, `main.ts:2593`). Each call walks the
font cache and `ThemeLoader.generateThemeFontCSS` re-reads every bundled
font binary from the vault and re-base64-encodes it. For an
Inter-variable-font deck that is ~700 KB binary read + base64 expansion
per refresh.

Fix direction (Phase 1 / Phase 3): memoize generated font CSS by
`(themeId, fontCacheRevision, requestedRoles)`. Invalidate only when
the theme changes, fonts are added/removed/rebuilt, or the active
deck's font roles change.

### 2.12 Multiple authoritative font sources

There is no single resolver for "what font does this deck actually use".
PPTX export consults `FontManager`. Preview rendering consults
`ThemeLoader.generateThemeFontCSS`. Frontmatter overrides consult
`SlideRenderer.generateCSSVariables`. Theme defaults consult
`ThemeLoader.generateCSSVariables`. Each can independently miss or
double-load a font, which is why the system feels "almost fixed" while
still breaking in particular targets.

Fix direction (Phase 1): a single `ThemeRuntimeService` (or equivalent
inside `FontManager` + `ThemeLoader`) returns, for a given deck:

- Canonical family name per role (title / body / header / footer)
- Available weights per family for that deck
- The `@font-face` CSS to inline (cached, see 2.11)
- The PPTX embedding records

Every consumer goes through that service. No re-derivation.

---

## 3. Decisions (locked in)

These were chosen during the planning conversation:

| Decision | Value |
|---|---|
| Theme-font namespace strictness | **Theme-bundled fonts only** are namespaced. User-cached fonts (Google / local) keep their plain family name so users who want the system font can still get it. |
| OTF → woff2 conversion | **On-demand at export only** (HTML / PDF / PPTX). Cache stays in original format. No mandatory conversion at ingest. |
| Cache migration UX | **User-triggered** via Settings ("Rebuild font cache" button). Not automatic on plugin start. |
| `.theme` ZIP bundle | Recommended as **hybrid distribution format** — installable archive that extracts into a theme folder; authors work in the folder and export to `.theme`. |

---

## 4. Staged plan

Phase ordering is open — the user explicitly asked to write the plan first,
then add a second analysis before sequencing. Each phase below is intended
to be a shippable PR on its own.

### Phase 1 — Make the data model explicit + single resolver

**Goal**: stop guessing — at variable-font level, at family-name level,
and at "who owns the font" level. Addresses §2.0, §2.1, §2.10, §2.11, §2.12.

**1a. Separate canonical family name from CSS stack** (§2.0)

- Theme JSON schema gains an explicit `familyName` next to the existing
  `css` value (or we promote `fonts.title.name` to be the contract and
  treat `fonts.title.css` as renderer-only).
- `ThemePreset` exposes both: `TitleFontFamily` ("Inter") and
  `TitleFontStack` (the full CSS stack).
- `InspectorPanel.applyThemeDefaults` writes only the **family name** into
  frontmatter.
- `SlideRenderer.generateCSSVariables` is the **sole** place that composes
  the CSS stack: `var(--title-font, '<family>', sans-serif)`. No
  double-quoting possible.
- Backward compatibility: if frontmatter still contains a CSS stack
  (existing decks), detect this and extract the leading family on read.

**1b. Cache record carries explicit font classification** (§2.1, §2.10)

- Extend `CachedFont`:
  - `isVariable: boolean`
  - `weightRange: [min, max] | null` (only when `isVariable === true`)
  - `variationAxes?: { tag: string; min: number; max: number; default: number }[]`
    (future-proof for slnt, opsz, …)
  - `bytes: number` per file (UX: cache size)
  - `sha256?: string` per file (integrity, theme bundle verification later)
- `cacheGoogleFont` and `cacheLocalFont` set these at ingest time by
  sniffing the SFNT `fvar` table directly.
- `generateFontFaceCSSForExport` reads `isVariable` / `weightRange`.
  The current hotfix heuristic is removed.

**1c. Single resolver** (§2.12)

- Introduce `ThemeRuntimeService` (or a `resolveDeckFonts(presentation, theme)`
  function on the existing FontManager — naming flexible):
  - Input: active theme + presentation frontmatter
  - Output: `{ titleFamily, bodyFamily, headerFamily, footerFamily,
    availableWeights: Map<family,number[]>, faceCSS: string, pptxRecords: ... }`
  - All four consumers (SlideRenderer, ExportService, PdfExportService,
    PptxExportService) go through it.

**1d. Memoize generated font CSS** (§2.11)

- Cache `faceCSS` output by
  `(themeId@version, fontCacheRevision, sortedRequestedFamilies, weightsSignature)`.
- Invalidate on theme reload, font cache mutation, frontmatter font-role
  change.
- Eliminates per-keystroke base64 work in sidebar updates.

**1e. Migration**

- Settings pane gains a "Rebuild font cache" action that re-scans all
  cached fonts and refreshes the metadata. Required for upgrading existing
  installs (per locked decision §3).
- Also re-classifies any frontmatter that still contains a CSS stack
  (one-shot rewrite, opt-in, with diff preview).

**Risk**: medium. Data-shape changes are additive but the family-name
split touches Inspector behavior and theme JSON. Backward compatibility
needed for both directions.

### Phase 2 — Validation surface + theme-font namespace + built-in honesty

**Goal**: surface silent failures, prevent system/theme font collisions,
and make the built-in default theme honour the "themes own their fonts"
contract. Addresses §2.3, §2.4, §2.5, §2.9.

**Built-in default theme** (§2.9):

- Either bundle Inter inside the built-in theme (base64 in code so the
  plugin ships self-contained), **or** change the default to a pure
  system stack and treat "Inter" as a user-installable upgrade.
- Recommendation: bundle. Keeps the demo presentation honest and matches
  the product invariant.

- Theme-bundled fonts register with a suffixed family name internally:
  `'Inter [perspecta:default]'`. Theme CSS variables (`--title-font`,
  `--body-font`) are rewritten by `ThemeLoader` to point at the namespaced
  name. User frontmatter input still says `Inter`; the mapping happens
  at the renderer's variable-generation step, only for fonts that the
  active theme bundles.
- User-cached fonts (Google / local) keep their plain name. If the user
  explicitly references `Inter` and a theme also bundles `Inter`, the
  user's choice wins for that role and the theme-bundled one stays
  registered but unused. No silent collision.
- Theme load validates every `bundledFonts` entry:
  - File exists at the declared path
  - Format declaration matches actual file (sniff first bytes)
  - Weight / style values are sane
- Renderer reports weight fallbacks back to the InspectorPanel.
  - Small ⚠ badge next to the weight dropdown when fallback is active
  - Tooltip says e.g. "Requested 800, using 700 (closest available)"

**Risk**: medium. CSS-variable rewriting changes the contract slightly;
existing decks that hard-code `font-family: 'Inter'` in raw markdown will
still work because the namespaced name is only used as the resolved
target of CSS variables.

### Phase 3 — Cross-platform & format hardening

**Goal**: make path handling and OTF/TTF support deterministic.

- Introduce `vaultPathJoin(...parts: string[]): string` as the single
  primitive for building vault paths. Used by all FontManager code,
  ThemeLoader, PdfExportService, ExportService. `fixCorruptedPath` becomes
  unnecessary for newly cached fonts and can be kept only for legacy
  records during migration.
- On-demand woff2 conversion for export:
  - If a cached font is OTF/TTF and the target is HTML/PDF, transcode to
    woff2 just for that export run (via `fonteditor-core` or `wawoff2`
    WASM). Cache the conversion result in-memory for the duration of the
    export. Originals stay on disk.
  - PPTX path keeps its current EOT logic (locked in by recent fixes).
- Sanity-check fonts at cache time:
  - Parse SFNT magic, confirm format
  - Read `name` table to confirm declared family name matches manifest
  - Reject files that fail to parse (don't silently cache broken bytes)
- PDF export: inject the deck's `@font-face` CSS once into the **parent**
  HTML (the print container), not into every per-slide iframe. Iframes
  inherit fonts from the parent for our use case because we control both
  the host and the framed content.

**Risk**: medium. The PDF rework touches existing reliable code — needs
careful before/after comparison. Conversion adds a dependency.

### Phase 4 — `.theme` ZIP bundle distribution

**Goal**: ship and install themes as a single file with integrity.

- Spec:
  - `.theme` is a ZIP archive
  - Root contains `theme.json` (manifest, `bundleVersion: 2`)
  - `theme.css` next to it
  - `fonts/` subdir holds all bundled fonts (manifest paths are relative
    to bundle root, MUST stay inside the bundle)
  - Optional `presets/`, `previews/`, etc. as already supported
  - Optional `MANIFEST.sha256` for integrity check at install time
- Install flow: user opens `.theme` from disk → Plugin extracts to
  `<vault>/perspecta-themes/<name>/` (using `vaultPathJoin`). If the
  destination exists, prompt to overwrite or rename.
- Export flow: from any theme folder in the vault, "Export as .theme"
  command generates the ZIP and writes it next to the folder. Round-trip
  is lossless.
- Versioning: `theme.json.bundleVersion` distinguishes the new format
  from legacy folder-based themes. ThemeLoader supports both indefinitely.
- Distribution: nothing in the plugin code links to specific archives;
  the user can share `.theme` files however they want (GitHub releases,
  Obsidian Discord, etc.).

**Risk**: low–medium. Mostly additive. Existing theme folders keep working.

---

## 5. Open questions to resolve before coding

These will be revisited after the user's second analysis is folded in:

- Should `.theme` allow theme-bundled **scripts** in any form? Today it's
  just CSS / fonts / JSON; that's probably the right limit.
- For namespaced theme fonts (Phase 2): should the namespace include the
  theme version, so swapping theme versions in the same deck doesn't reuse
  stale `@font-face` rules? Likely yes — `'Inter [perspecta:default@1.2]'`.
- For on-demand OTF→woff2 conversion: tolerable bundle-size cost of pulling
  in a WASM transcoder? `wawoff2` is ~300 KB compressed. Acceptable if it
  eliminates a class of bugs.
- For Variable Font support in PPTX: punt entirely (PPTX gets a snapshot
  weight per usage), or attempt static instance extraction?

---

## 6. Second analysis — integration log

A code review surfaced findings in two clusters: font-specific (folded
into §2 and §4 above) and broader Obsidian-compliance / architecture
(captured in §8 below).

Font-specific findings already integrated:

- **Family-name vs. CSS-stack confusion** — added as §2.0 (P1 data-model
  bug). Explicitly addressed in Phase 1a.
- **Built-in theme references Inter without bundling** — added as §2.9.
  Explicitly addressed in Phase 2.
- **Font CSS regenerated from binary on hot UI paths** — added as §2.11.
  Explicitly addressed in Phase 1d (memoization).
- **Multiple authoritative font sources** — added as §2.12. Explicitly
  addressed in Phase 1c (single resolver).

---

## 7. Out of scope (explicitly)

- ICU / line-breaking concerns — unrelated to font binary handling
- Right-to-left script support — separate work item
- Variable-font animation / interpolation over time — interesting but no
  driving use case in slides today
- Font subsetting (per-deck glyph subsets) — significant complexity,
  noted as a possible future optimization, not in this plan

---

## 8. Adjacent findings (Obsidian compliance + architecture)

These came out of the same code review but are not font-pipeline issues.
They are listed here so they don't get lost; tracking them in a separate
plan is fine. Many of them will become easier *after* Phase 1 of the font
plan because that work removes the most repeated culprits from `main.ts`.

### 8.1 `isDesktopOnly: false` is incorrect (P1)

`manifest.json:9` declares the plugin mobile-compatible, but the code uses
Electron's `BrowserWindow`, `printToPDF`, Node `require`, and Obsidian's
filesystem adapter — none of which exist on mobile. Per Obsidian's manifest
docs, this flag covers exactly Node/Electron API usage.

Two ways to fix:

- Set `isDesktopOnly: true`. Simplest, accurate today.
- Hard-gate every desktop-only feature behind `Platform.isDesktop` and
  expose a graceful mobile experience. Larger effort.

Recommendation: flip to `true` immediately (one-line change, ship as
patch), revisit only when mobile becomes a real product goal.

### 8.2 IPC listeners never removed (P1)

`main.ts:739` registers `ipcMain.on(...)` handlers directly during plugin
load. They are not added through Obsidian's `registerEvent()` and are not
removed in `onunload()`. Reloading the plugin (which happens during dev
and during settings changes) duplicates handlers — slide-change and
window-open events fire multiple times, leaked references accumulate.

Fix: keep one IPC owner per channel. Track handlers explicitly so
`onunload()` can call `ipcMain.removeListener(channel, handler)` for
each. Or wrap in a disposable that the plugin tracks.

### 8.3 Cursor tracker uses raw `setInterval` (P2)

`main.ts:1077` polls every 150ms via `setInterval`. Obsidian's events docs
recommend `this.registerInterval(setInterval(...))` so the handle is
automatically cleared on unload. Today's `onunload()` does not clean
`cursorTrackingCleanup`, so plugin reloads leak the interval.

Fix: wrap in `this.registerInterval(...)`. One-line change.

### 8.4 Read-modify-write file edits should use `vault.process()` (P2)

Locations like `main.ts:2875` and `main.ts:3006` perform `read()` →
mutate string → `modify()` flows. Obsidian's Vault docs recommend
`vault.process(file, transform)` for synchronous transforms, which avoids
lost-update races with concurrent editor edits. For async transforms,
the cached-read + process-recheck pattern in Obsidian's docs applies.

Fix: audit each such site, switch to `process()` where the transform is
synchronous. Leave the async ones for a separate pass with the documented
recheck pattern.

### 8.5 `main.ts` is too large (architecture)

3600+ lines mixing command registration, workspace sync, view orchestration,
exports, font CSS generation, and document mutation. Recommended split,
in increasing scope:

- Command registration and lifecycle in `main.ts` (smallest possible)
- Workspace / view orchestration in `src/orchestration/`
- Document mutations in `src/mutations/` (the read-modify-write sites
  from §8.4)
- Export orchestration in `src/exports/orchestrator.ts`
- Presentation-window orchestration in `src/ui/PresentationOrchestrator.ts`
- Font CSS generation **stays out of `main.ts`** by definition once
  Phase 1c of the font plan lands (the resolver lives in
  `FontManager` or `ThemeRuntimeService`).

This is a follow-up after the font plan lands, not a prerequisite. Touching
this without a clear motivation is risky.

### 8.6 Lint backlog (process)

`npm run lint` currently reports 928 errors + 676 warnings. It is noise,
not a gate. Approach: ratchet — pick a directory or rule set, fix to zero
there, add a CI check that prevents regressions in that area, expand
scope from there.

`npm run typecheck` fails because `@excalidraw/utils` declaration files
reference missing packages. Should be either patched via
`paths`/`skipLibCheck` (already on in build) or worked around with a
shim.

These are tracked here only so they don't disappear; they belong in a
separate dev-experience workstream.

### 8.7 Plugin bundle size

`main.js` ships at ~22 MB. Drivers: inlined fonts in builtin themes (once
Phase 2 of the font plan lands, this could grow further if Inter is
bundled in code), WASM dependencies, PPTX dependencies. Worth a separate
audit pass with `esbuild --metafile` once Phase 1 lands and the font path
is stable.

---

## 9. Suggested sequencing

Putting it together, my recommendation for the order to actually do this:

1. **Patch §8.1 immediately** — `isDesktopOnly: true` is a one-line fix
   and should ship without waiting on anything else.
2. **Phase 1** (data model + resolver + memoization) — eliminates §2.0,
   §2.1, §2.10, §2.11, §2.12 and is the foundation for everything else.
3. **Phase 2** (validation + namespace + built-in honesty) — eliminates
   §2.3, §2.4, §2.5, §2.9.
4. **§8.2 and §8.3** (IPC + interval cleanup) — small, independent,
   should land alongside Phase 1/2 in whichever PR is open.
5. **Phase 3** (cross-platform + format hardening + PDF rework).
6. **§8.4** (vault.process migration) — independent of font work.
7. **Phase 4** (`.theme` ZIP bundle).
8. **§8.5** (main.ts split) — only after Phase 1 has pulled font code out
   of `main.ts`, so the split is cleaner.

Open for re-ordering before any code is written.
