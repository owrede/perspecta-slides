const RESET_ICON = "rotate-ccw";
/** A slider with a reset extra-button that restores `defaultValue`. */
export function sliderWithReset(setting, spec) {
    let slider;
    setting.setName(spec.name).setDesc(spec.desc);
    setting.addSlider((s) => {
        slider = s;
        s.setLimits(spec.min, spec.max, spec.step).setValue(spec.value).setDynamicTooltip()
            .onChange((v) => spec.onChange(v));
    });
    setting.addExtraButton((b) => {
        b.setIcon(RESET_ICON).setTooltip("Reset to default").onClick(() => {
            slider.setValue(spec.defaultValue);
            spec.onChange(spec.defaultValue);
        });
        spec._capture?.(slider, b);
    });
    return setting;
}
/** A color picker with a reset extra-button that restores `defaultValue`. */
export function colorWithReset(setting, spec) {
    let picker;
    setting.setName(spec.name).setDesc(spec.desc);
    setting.addColorPicker((c) => {
        picker = c;
        c.setValue(spec.value).onChange((v) => spec.onChange(v));
    });
    setting.addExtraButton((b) => {
        b.setIcon(RESET_ICON).setTooltip("Reset to default").onClick(() => {
            picker.setValue(spec.defaultValue);
            spec.onChange(spec.defaultValue);
        });
        spec._capture?.(picker, b);
    });
    return setting;
}
/** A dropdown with a reset extra-button that restores `defaultValue`. */
export function dropdownWithReset(setting, spec) {
    let dropdown;
    setting.setName(spec.name).setDesc(spec.desc);
    setting.addDropdown((d) => {
        dropdown = d;
        for (const [val, label] of Object.entries(spec.options))
            d.addOption(val, label);
        d.setValue(spec.value).onChange((v) => spec.onChange(v));
    });
    setting.addExtraButton((b) => {
        b.setIcon(RESET_ICON).setTooltip("Reset to default").onClick(() => {
            dropdown.setValue(spec.defaultValue);
            spec.onChange(spec.defaultValue);
        });
        spec._capture?.(dropdown, b);
    });
    return setting;
}
