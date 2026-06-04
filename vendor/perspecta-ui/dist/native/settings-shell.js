/** Render the title + `vX.Y.Z` header at the top of a settings container. */
export function renderVersionHeader(containerEl, host, displayName) {
    containerEl.createEl("h1", { cls: "perspecta-ui-settings-title", text: displayName });
    containerEl.createDiv({
        cls: "perspecta-ui-settings-version",
        text: `Version: v${host.manifest.version}`,
    });
}
function renderEntries(containerEl, entries) {
    for (const entry of entries) {
        const block = containerEl.createDiv({ cls: "perspecta-ui-changelog-version" });
        block.createEl("h3", { text: entry.date ? `v${entry.version} — ${entry.date}` : `v${entry.version}` });
        const list = block.createEl("ul");
        for (const change of entry.changes)
            list.createEl("li", { text: change });
    }
}
/** Render a flat changelog list (the minimal renderer used by the changelog tab). */
export function renderChangelogList(containerEl, entries) {
    containerEl.createEl("h2", { text: "Changelog" });
    renderEntries(containerEl, entries);
}
function renderChangelogModel(containerEl, model) {
    if (Array.isArray(model)) {
        renderChangelogList(containerEl, model);
        return;
    }
    for (const section of model.sections) {
        containerEl.createEl("h2", { text: section.title });
        renderEntries(containerEl, section.entries);
    }
}
/**
 * Render the full settings shell into containerEl: version header, a tab bar,
 * the active tab's body, with a Changelog tab and a Debug tab appended LAST.
 * Switching a tab re-renders the whole shell (state lives in a closure).
 */
export function renderSettingsShell(containerEl, spec) {
    const tabs = [
        ...spec.tabs,
        { id: "changelog", label: "Changelog", render: (el) => renderChangelogModel(el, spec.changelog) },
        { id: "debug", label: "Debug", render: spec.debugTab.render },
    ];
    let active = spec.defaultTab ?? tabs[0].id;
    const draw = () => {
        containerEl.empty();
        renderVersionHeader(containerEl, spec.plugin, spec.displayName);
        const nav = containerEl.createDiv({ cls: "perspecta-ui-settings-tabs" });
        for (const tab of tabs) {
            const btn = nav.createEl("button", {
                cls: `perspecta-ui-settings-tab${tab.id === active ? " is-active" : ""}`,
                text: tab.label,
            });
            btn.addEventListener("click", () => { active = tab.id; draw(); });
        }
        const body = containerEl.createDiv({ cls: "perspecta-ui-settings-content" });
        tabs.find((t) => t.id === active)?.render(body);
    };
    draw();
}
