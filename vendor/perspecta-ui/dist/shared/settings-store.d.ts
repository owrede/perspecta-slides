/** The minimal Obsidian Plugin surface the store needs. */
export interface SettingsHost {
    loadData(): Promise<unknown>;
    saveData(data: unknown): Promise<void>;
}
/**
 * Typed settings store: merge-with-defaults load, typed get/set that persists,
 * and a restart-required key set. Generalized from vault-memory's SettingsStore.
 */
export declare class PerspectaSettingsStore<T extends object> {
    private readonly host;
    private readonly defaults;
    private current;
    private readonly restartKeys;
    private readonly listeners;
    constructor(host: SettingsHost, defaults: T, restartRequiredKeys?: ReadonlyArray<keyof T>);
    /** Subscribe to changes (fires on load and every set). Returns an unsubscribe. */
    onChange(listener: (s: T) => void): () => void;
    private emit;
    load(): Promise<T>;
    save(): Promise<void>;
    get<K extends keyof T>(key: K): T[K];
    set<K extends keyof T>(key: K, value: T[K]): Promise<void>;
    isRestartRequired(key: keyof T): boolean;
    snapshot(): T;
}
