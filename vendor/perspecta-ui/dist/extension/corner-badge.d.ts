import type { WorkspaceLeaf } from "obsidian";
/**
 * A non-interactive pill stuck to the top-left of a leaf's view container,
 * overlaying the content (sticky to the view edge). Generalized from
 * perspecta-workflow's WorkflowBadge: configurable label + aria-label, so any
 * plugin can mark a view. Fails silently if the container can't be found.
 */
export declare class CornerBadge {
    private readonly label;
    private readonly ariaLabel;
    constructor(label: string, ariaLabel?: string);
    private containerOf;
    /** Attach the badge to a leaf if not already present. Returns true on success. */
    attach(leaf: WorkspaceLeaf | null): boolean;
    /** Remove any badge from a leaf's container. */
    detach(leaf: WorkspaceLeaf | null): void;
}
