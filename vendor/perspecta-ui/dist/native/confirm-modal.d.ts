import { Modal, ButtonComponent, type App } from "obsidian";
export interface ModalFooterSpec {
    confirmText: string;
    cancelText?: string;
    onConfirm: () => void;
    onCancel?: () => void;
    /** mark confirm as warning (destructive) rather than cta. */
    destructive?: boolean;
}
/**
 * Render the recurring `.modal-button-container` two-button footer into a modal
 * content element. Returns the two ButtonComponents for further wiring/testing.
 */
export declare function modalButtonFooter(containerEl: HTMLElement, spec: ModalFooterSpec): {
    confirmBtn: ButtonComponent;
    cancelBtn: ButtonComponent;
};
export interface ConfirmSpec {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    destructive?: boolean;
}
/**
 * A yes/no confirmation modal. `ask()` returns a promise resolving true
 * (confirmed) or false (cancelled/closed). Replaces ad-hoc confirm dialogs.
 */
export declare class ConfirmModal extends Modal {
    private spec;
    private result;
    private resolver;
    constructor(app: App, spec: ConfirmSpec);
    /** Open and await the user's choice. */
    ask(): Promise<boolean>;
    onOpen(): void;
    onClose(): void;
}
