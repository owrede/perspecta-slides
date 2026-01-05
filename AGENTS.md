# Perspecta Slides - Agent Instructions

## Build & Deploy

After making changes, always:

1. Build and copy to test vault:
   ```bash
   npm run build && npm run copy
   ```

## Commands

- `npm run dev` - Development build + copy to test vault
- `npm run build` - Production build (runs tsc + esbuild, no copy - used by CI)
- `npm run copy` - Copy built files to local test vault

## Project Structure

- `main.ts` - Plugin entry point
- `src/parser/` - Markdown to slide parsing
- `src/renderer/` - Slide HTML rendering
- `src/ui/` - Obsidian views (ThumbnailNavigator, InspectorPanel, PresentationView)
- `src/themes/` - Built-in themes (zurich, kyoto, berlin, minimal)
- `src/types.ts` - TypeScript interfaces
