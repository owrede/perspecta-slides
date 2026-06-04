import { setIcon } from "obsidian";
const ICONS = {
    info: "info",
    warning: "alert-triangle",
};
/**
 * Render an info/warning callout into containerEl. Unifies the per-plugin
 * info-box / warning-banner DOM (perspecta-info-box, slides-info-box,
 * vm-cli-missing-banner) into one styled component.
 */
export function renderInfoBox(containerEl, spec) {
    const variant = spec.variant ?? "info";
    const box = containerEl.createDiv({ cls: `perspecta-ui-info-box perspecta-ui-info-box-${variant}` });
    const icon = box.createSpan({ cls: "perspecta-ui-info-box-icon" });
    setIcon(icon, ICONS[variant]);
    const content = box.createDiv({ cls: "perspecta-ui-info-box-content" });
    if (spec.title)
        content.createEl("strong", { text: spec.title });
    content.createEl("p", { text: spec.body });
    return box;
}
