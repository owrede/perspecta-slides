export interface InfoBoxSpec {
    variant?: "info" | "warning";
    /** Optional bold title line. */
    title?: string;
    /** Body text. */
    body: string;
}
/**
 * Render an info/warning callout into containerEl. Unifies the per-plugin
 * info-box / warning-banner DOM (perspecta-info-box, slides-info-box,
 * vm-cli-missing-banner) into one styled component.
 */
export declare function renderInfoBox(containerEl: HTMLElement, spec: InfoBoxSpec): HTMLElement;
