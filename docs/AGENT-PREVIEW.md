# Agent Preview

A workflow that lets an AI agent (Claude Code, or any CDP-aware tooling) see what a Perspecta slide actually looks like, without screenshotting the user's Obsidian window or guessing about layout outcomes.

## What problem this solves

When an agent generates a slide deck, tunes theme variables, or refactors layout code, it has no native way to verify the visual result. Reading TypeScript and CSS only gets you so far — proportions, contrast, overlap, font fallback issues are visual problems that demand a visual answer.

This workflow gives the agent a single command:

```
node scripts/capture-slide.mjs --file "path/to/deck.md" --slide N
```

…and returns a clean 1920×1080 PNG of exactly that slide, regardless of what the user has on screen.

## How it works

Obsidian is an Electron app. Electron exposes the [Chrome DevTools Protocol](https://chromedevtools.github.io/devtools-protocol/) (CDP) when started with `--remote-debugging-port`. The Perspecta plugin already has a `PresentationWindow` class that opens a borderless Electron window containing only the rendered slide.

The script wires the two together:

1. Connects to Obsidian's main renderer over CDP.
2. Calls `app.plugins.plugins['perspecta-slides'].startPresentationAtSlide(file, slideIndex)` to open the presentation window.
3. Waits for the new window to appear as its own CDP target.
4. Takes a `Page.captureScreenshot` of that window (the whole window *is* the slide — no chrome, no sidebar, fixed 1920×1080 dimensions).
5. Closes the window.

Because the presentation window has fixed dimensions and contains nothing but the slide, there is no clipping math, no DPR juggling, and no dependence on the user's Obsidian layout.

## Setup

### 1. Start Obsidian with CDP enabled

```bash
./scripts/start-obsidian-debug.sh
```

This kills any running Obsidian instance and relaunches it with `--remote-debugging-port=9222`. The helper waits until the CDP endpoint responds.

Override the Obsidian location if needed:

```bash
OBSIDIAN_APP=/Applications/Obsidian-Beta.app ./scripts/start-obsidian-debug.sh
```

### 2. Confirm the vault and plugin are ready

The script defaults to matching the Obsidian window whose title contains `Perspecta-Dev`. If your test vault is named differently, pass `--vault <substring>`. The Perspecta plugin must be enabled in that vault.

## Usage

```bash
# Capture the cover (slide 0) of the demo deck.
node scripts/capture-slide.mjs \
  --file "Perspecta Slides Demo/Skill Demo — Perspecta in 5 Minuten.md" \
  --slide 0

# Capture slide 5 of the same deck, custom output path.
node scripts/capture-slide.mjs \
  --file "Perspecta Slides Demo/Skill Demo — Perspecta in 5 Minuten.md" \
  --slide 5 \
  --out /tmp/slide-5.png

# Keep the presentation window open after capture (for debugging).
node scripts/capture-slide.mjs --file "..." --keep-open
```

### Output

The script prints a JSON blob to stdout with metadata about what was captured:

```json
{
  "path": "/tmp/perspecta-slide.png",
  "bytes": 37094,
  "file": "...",
  "slideIndex": 0,
  "url": "about:blank",
  "title": "Presenting... Perspecta in 5 Minuten",
  "windowSize": { "w": 1920, "h": 1080 },
  "dpr": 1
}
```

The PNG is the dimensions reported by `windowSize` (typically 1920×1080).

### Flags

| Flag | Default | Meaning |
|---|---|---|
| `--file <path>` | *required* | Vault-relative path to the Markdown file |
| `--slide <n>` | `0` | Zero-based slide index |
| `--out <path>` | `/tmp/perspecta-slide.png` | Output PNG path |
| `--vault <s>` | `Perspecta-Dev` | Substring matching the Obsidian window title |
| `--port <n>` | `9222` | CDP port (also `OBSIDIAN_DEBUG_PORT` env var) |
| `--keep-open` | `false` | Skip closing the presentation window |

## Why not headless Playwright

A headless variant — rendering slides outside of Obsidian via the plugin's `renderSingleSlideHTML()` plus a headless Chromium — was considered. It has the advantage of reproducibility without a running Obsidian, but it loses the live state: a user's inspector edits, font cache, theme overrides, and current Obsidian theme are not reflected.

The CDP-into-PresentationWindow approach trades reproducibility for fidelity. The agent sees what the user sees, in the user's current configuration.

A headless renderer can be added later as a complementary path; this one is the higher-fidelity option and is sufficient for "did my change produce what I expected" checks.

## Security note

`--remote-debugging-port=9222` exposes Obsidian's full browser context on localhost. Anyone with local access can drive the app, read its DOM, and inspect its state. Use this only on a trusted machine, and shut Obsidian down when you're done with agent workflows.

## Future work

Once D1's typography-variable refactor lands fully in user workflows, an agent loop can:

1. Take a baseline screenshot.
2. Edit a theme variable (e.g. `--body-size: 3.2`).
3. Reload the presentation window.
4. Take a new screenshot.
5. Compare visually — "is the body text now visibly larger but still inside the safe area?"

That iteration is what makes the agent useful as a design-tuning collaborator, not just a slide author.
