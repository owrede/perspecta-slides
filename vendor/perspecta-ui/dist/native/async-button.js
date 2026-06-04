/**
 * Configure a button so it auto-disables and shows progress text while its
 * async handler runs, then restores on success OR error. Replaces the
 * hand-rolled setDisabled/setButtonText/restore dance.
 */
export function wireAsyncButton(button, spec) {
    button.setButtonText(spec.label);
    if (spec.cta)
        button.setCta();
    button.onClick(async () => {
        button.setDisabled(true);
        button.setButtonText(spec.runningLabel);
        try {
            await spec.onClick();
        }
        catch (err) {
            spec.onError?.(err);
        }
        finally {
            button.setDisabled(false);
            button.setButtonText(spec.label);
        }
    });
    return button;
}
