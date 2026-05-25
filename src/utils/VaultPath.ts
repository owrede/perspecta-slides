/**
 * Vault path utilities — single primitive for building Obsidian vault paths.
 *
 * Obsidian's vault uses forward-slash paths cross-platform. Path joins
 * elsewhere in the plugin used string concatenation with manual slash
 * handling, which silently produced corrupt paths on Windows
 * (FontManager.fixCorruptedPath existed exclusively to mop these up).
 *
 * Use `vaultPathJoin(...)` for every new vault-path construction. The
 * function is intentionally tiny — its value is consistency, not feature
 * richness.
 */

/**
 * Join path segments into a single vault path. Always uses forward slashes,
 * collapses repeated slashes, removes leading and trailing slashes from the
 * combined result. Empty / nullish segments are silently skipped.
 *
 * Examples:
 *   vaultPathJoin('perspecta-fonts', 'Inter', 'Inter-normal.woff2')
 *     → 'perspecta-fonts/Inter/Inter-normal.woff2'
 *   vaultPathJoin('perspecta-fonts/', '/Inter')
 *     → 'perspecta-fonts/Inter'
 *   vaultPathJoin('themes', undefined, 'fonts')
 *     → 'themes/fonts'
 */
export function vaultPathJoin(...parts: Array<string | undefined | null>): string {
  return parts
    .filter((p): p is string => typeof p === 'string' && p.length > 0)
    .map((p) => p.replace(/\\/g, '/')) // Windows separators → forward slashes
    .join('/')
    .replace(/\/+/g, '/') // collapse repeats
    .replace(/^\/+/, '') // strip leading
    .replace(/\/+$/, ''); // strip trailing
}

/**
 * Normalize an arbitrary path string for use as a vault path. Same
 * forward-slash + collapse-repeats rules as `vaultPathJoin`, but does not
 * strip leading/trailing slashes (some callers want a leading-slash form).
 */
export function normalizeVaultPath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+/g, '/');
}

/**
 * Return the last segment of a vault path (filename or final folder name).
 * Returns the empty string if `path` is empty.
 */
export function vaultPathBasename(path: string): string {
  const normalized = normalizeVaultPath(path).replace(/\/+$/, '');
  const idx = normalized.lastIndexOf('/');
  return idx === -1 ? normalized : normalized.slice(idx + 1);
}

/**
 * Return the parent path (everything before the last segment). Returns the
 * empty string if `path` has no slash.
 */
export function vaultPathDirname(path: string): string {
  const normalized = normalizeVaultPath(path).replace(/\/+$/, '');
  const idx = normalized.lastIndexOf('/');
  return idx === -1 ? '' : normalized.slice(0, idx);
}
