const RESTART_NOTICE = "(Restart required to apply.)";
/** Bind a boolean setting key to a toggle, persisting on change. */
export function wiredToggle(setting, store, spec) {
    const restart = store.isRestartRequired(spec.key);
    setting
        .setName(spec.name)
        .setDesc(restart ? `${spec.desc} ${RESTART_NOTICE}` : spec.desc)
        .addToggle((toggle) => {
        spec._capture?.(toggle);
        toggle
            .setValue(store.get(spec.key))
            .onChange(async (v) => {
            await store.set(spec.key, v);
        });
    });
    return setting;
}
/** Bind a string setting key to a text input, persisting on change. */
export function wiredText(setting, store, spec) {
    const restart = store.isRestartRequired(spec.key);
    setting
        .setName(spec.name)
        .setDesc(restart ? `${spec.desc} ${RESTART_NOTICE}` : spec.desc)
        .addText((text) => {
        spec._capture?.(text);
        if (spec.placeholder)
            text.setPlaceholder(spec.placeholder);
        text
            .setValue(String(store.get(spec.key) ?? ""))
            .onChange(async (v) => {
            await store.set(spec.key, v);
        });
    });
    return setting;
}
