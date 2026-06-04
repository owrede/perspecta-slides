import type { Setting } from "obsidian";
import type { PerspectaSettingsStore } from "../shared/settings-store.js";
interface BaseSpec<T extends object, K extends keyof T> {
    key: K;
    name: string;
    desc: string;
    /** test-only: receive the created component instance. */
    _capture?: (c: unknown) => void;
}
/** Bind a boolean setting key to a toggle, persisting on change. */
export declare function wiredToggle<T extends object, K extends keyof T>(setting: Setting, store: PerspectaSettingsStore<T>, spec: BaseSpec<T, K>): Setting;
/** Bind a string setting key to a text input, persisting on change. */
export declare function wiredText<T extends object, K extends keyof T>(setting: Setting, store: PerspectaSettingsStore<T>, spec: BaseSpec<T, K> & {
    placeholder?: string;
}): Setting;
export {};
