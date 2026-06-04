import type { ButtonComponent } from "obsidian";
export interface AsyncButtonSpec {
    /** Idle button text. */
    label: string;
    /** Text shown while onClick runs. */
    runningLabel: string;
    /** The async work; the button auto-disables until it settles. */
    onClick: () => Promise<unknown>;
    /** Optional: mark as a primary (cta) button. */
    cta?: boolean;
    /** Optional: called with the error if onClick throws (after restore). */
    onError?: (err: unknown) => void;
}
/**
 * Configure a button so it auto-disables and shows progress text while its
 * async handler runs, then restores on success OR error. Replaces the
 * hand-rolled setDisabled/setButtonText/restore dance.
 */
export declare function wireAsyncButton(button: ButtonComponent, spec: AsyncButtonSpec): ButtonComponent;
