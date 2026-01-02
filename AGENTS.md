# Perspecta Slides - Agent Instructions

## Build & Deploy

After making changes, always:

1. Build the plugin:
   ```bash
   npm run build
   ```

2. Copy to test vault:
   ```bash
   cp main.js manifest.json styles.css "/Users/wrede/Documents/Obsidian Vaults/Perspecta-Dev/.obsidian/plugins/perspecta-slides/"
   ```

## Commands

- `npm run dev` - Development build with watch
- `npm run build` - Production build (runs tsc + esbuild)

## Project Structure

- `main.ts` - Plugin entry point
- `src/parser/` - Markdown to slide parsing
- `src/renderer/` - Slide HTML rendering
- `src/ui/` - Obsidian views (ThumbnailNavigator, InspectorPanel, PresentationView)
- `src/themes/` - Built-in themes (zurich, tokyo, berlin, minimal)
- `src/types.ts` - TypeScript interfaces
