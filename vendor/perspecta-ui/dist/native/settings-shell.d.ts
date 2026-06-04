import type { ChangelogEntry, ChangelogModel } from "../shared/changelog.js";
/** A plugin-ish object exposing the manifest fields the header needs. */
export interface ManifestHost {
    manifest: {
        name: string;
        version: string;
        dir?: string;
    };
}
export interface ShellTab {
    id: string;
    label: string;
    render(containerEl: HTMLElement): void;
}
export interface SettingsShellSpec {
    plugin: ManifestHost;
    displayName: string;
    changelog: ChangelogModel;
    tabs: ShellTab[];
    /** debug tab — forced LAST; supply only its render (id/label fixed). */
    debugTab: {
        render(containerEl: HTMLElement): void;
    };
    defaultTab?: string;
}
/** Render the title + `vX.Y.Z` header at the top of a settings container. */
export declare function renderVersionHeader(containerEl: HTMLElement, host: ManifestHost, displayName: string): void;
/** Render a flat changelog list (the minimal renderer used by the changelog tab). */
export declare function renderChangelogList(containerEl: HTMLElement, entries: ChangelogEntry[]): void;
/**
 * Render the full settings shell into containerEl: version header, a tab bar,
 * the active tab's body, with a Changelog tab and a Debug tab appended LAST.
 * Switching a tab re-renders the whole shell (state lives in a closure).
 */
export declare function renderSettingsShell(containerEl: HTMLElement, spec: SettingsShellSpec): void;
