/** One released version's notes. */
export interface ChangelogEntry {
    version: string;
    date?: string;
    changes: string[];
}
/** Either a flat list, or named sections (e.g. plugin + CLI changelogs). */
export type ChangelogModel = ChangelogEntry[] | {
    sections: {
        title: string;
        entries: ChangelogEntry[];
    }[];
};
/**
 * Parse Keep-a-Changelog markdown into entries, newest first (source order).
 * `### Group` headings are flattened into each bullet as `Group: bullet`.
 * Bullets with no preceding group within a version are kept verbatim.
 */
export declare function parseChangelog(md: string): ChangelogEntry[];
