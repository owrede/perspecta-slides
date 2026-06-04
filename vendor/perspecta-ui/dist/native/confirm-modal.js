import { Modal, ButtonComponent } from "obsidian";
/**
 * Render the recurring `.modal-button-container` two-button footer into a modal
 * content element. Returns the two ButtonComponents for further wiring/testing.
 */
export function modalButtonFooter(containerEl, spec) {
    const footer = containerEl.createDiv({ cls: "modal-button-container" });
    const cancelBtn = new ButtonComponent(footer)
        .setButtonText(spec.cancelText ?? "Cancel")
        .onClick(() => spec.onCancel?.());
    const confirmBtn = new ButtonComponent(footer).setButtonText(spec.confirmText);
    if (spec.destructive)
        confirmBtn.setWarning();
    else
        confirmBtn.setCta();
    confirmBtn.onClick(() => spec.onConfirm());
    return { confirmBtn, cancelBtn };
}
/**
 * A yes/no confirmation modal. `ask()` returns a promise resolving true
 * (confirmed) or false (cancelled/closed). Replaces ad-hoc confirm dialogs.
 */
export class ConfirmModal extends Modal {
    spec;
    result = false;
    resolver = null;
    constructor(app, spec) {
        super(app);
        this.spec = spec;
    }
    /** Open and await the user's choice. */
    ask() {
        return new Promise((resolve) => {
            this.resolver = resolve;
            this.open();
        });
    }
    onOpen() {
        this.titleEl.setText(this.spec.title);
        this.contentEl.createEl("p", { text: this.spec.message });
        modalButtonFooter(this.contentEl, {
            confirmText: this.spec.confirmText ?? "Confirm",
            cancelText: this.spec.cancelText,
            destructive: this.spec.destructive,
            onConfirm: () => { this.result = true; this.close(); },
            onCancel: () => { this.result = false; this.close(); },
        });
    }
    onClose() {
        this.contentEl.empty();
        this.resolver?.(this.result);
        this.resolver = null;
    }
}
