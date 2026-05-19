/**
 * Single source of truth for the active color scheme.
 *
 * We read Obsidian's own theme class (body.theme-dark / body.theme-light) rather than
 * the OS-level `prefers-color-scheme` media query. The two can diverge — a user can run
 * macOS in Dark mode but switch Obsidian to Light, or vice versa — and slide rendering
 * should always follow Obsidian, not the OS.
 */
export function getObsidianColorScheme(): 'light' | 'dark' {
  if (typeof document === 'undefined' || !document.body) {
    return 'light';
  }
  return document.body.classList.contains('theme-dark') ? 'dark' : 'light';
}
