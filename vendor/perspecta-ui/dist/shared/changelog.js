const VERSION_RE = /^##\s*\[([^\]]+)\](?:\s*-\s*(\S+))?/;
const GROUP_RE = /^###\s+(.+)$/;
const BULLET_RE = /^[-*]\s+(.+)$/;
/**
 * Parse Keep-a-Changelog markdown into entries, newest first (source order).
 * `### Group` headings are flattened into each bullet as `Group: bullet`.
 * Bullets with no preceding group within a version are kept verbatim.
 */
export function parseChangelog(md) {
    const entries = [];
    let current = null;
    let group = null;
    for (const rawLine of md.split("\n")) {
        const line = rawLine.trimEnd();
        const v = VERSION_RE.exec(line);
        if (v) {
            if (current)
                entries.push(current);
            current = { version: v[1], date: v[2], changes: [] };
            group = null;
            continue;
        }
        if (!current)
            continue;
        const g = GROUP_RE.exec(line);
        if (g) {
            group = g[1].trim();
            continue;
        }
        const b = BULLET_RE.exec(line);
        if (b) {
            current.changes.push(group ? `${group}: ${b[1].trim()}` : b[1].trim());
        }
    }
    if (current)
        entries.push(current);
    return entries;
}
