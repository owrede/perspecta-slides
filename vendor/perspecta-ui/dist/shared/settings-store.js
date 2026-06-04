/**
 * Typed settings store: merge-with-defaults load, typed get/set that persists,
 * and a restart-required key set. Generalized from vault-memory's SettingsStore.
 */
export class PerspectaSettingsStore {
    host;
    defaults;
    current;
    restartKeys;
    listeners = new Set();
    constructor(host, defaults, restartRequiredKeys = []) {
        this.host = host;
        this.defaults = defaults;
        this.current = { ...defaults };
        this.restartKeys = new Set(restartRequiredKeys);
    }
    /** Subscribe to changes (fires on load and every set). Returns an unsubscribe. */
    onChange(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }
    emit() {
        const snap = this.snapshot();
        for (const l of this.listeners)
            l(snap);
    }
    async load() {
        const raw = await this.host.loadData();
        this.current =
            raw && typeof raw === "object" && !Array.isArray(raw)
                ? { ...this.defaults, ...raw }
                : { ...this.defaults };
        this.emit();
        return this.current;
    }
    async save() {
        await this.host.saveData(this.current);
    }
    get(key) {
        return this.current[key];
    }
    async set(key, value) {
        this.current = { ...this.current, [key]: value };
        await this.save();
        this.emit();
    }
    isRestartRequired(key) {
        return this.restartKeys.has(key);
    }
    snapshot() {
        return { ...this.current };
    }
}
