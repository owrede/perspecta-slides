const BADGE_CLASS = "perspecta-ui-corner-badge";
/**
 * A non-interactive pill stuck to the top-left of a leaf's view container,
 * overlaying the content (sticky to the view edge). Generalized from
 * perspecta-workflow's WorkflowBadge: configurable label + aria-label, so any
 * plugin can mark a view. Fails silently if the container can't be found.
 */
export class CornerBadge {
    label;
    ariaLabel;
    constructor(label, ariaLabel = label) {
        this.label = label;
        this.ariaLabel = ariaLabel;
    }
    containerOf(leaf) {
        return leaf?.view?.containerEl;
    }
    /** Attach the badge to a leaf if not already present. Returns true on success. */
    attach(leaf) {
        const container = this.containerOf(leaf);
        if (!container)
            return false;
        if (container.querySelector(`.${BADGE_CLASS}`))
            return true;
        const el = container.createDiv({ cls: BADGE_CLASS, text: this.label });
        if (getComputedStyle(container).position === "static")
            container.style.position = "relative";
        el.setAttribute("aria-label", this.ariaLabel);
        return true;
    }
    /** Remove any badge from a leaf's container. */
    detach(leaf) {
        const container = this.containerOf(leaf);
        container?.querySelectorAll(`.${BADGE_CLASS}`).forEach((n) => n.remove());
    }
}
