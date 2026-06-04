import type { Setting, SliderComponent, ColorComponent, DropdownComponent, ExtraButtonComponent } from "obsidian";
export interface SliderResetSpec {
    name: string;
    desc: string;
    min: number;
    max: number;
    step: number;
    value: number;
    defaultValue: number;
    onChange: (v: number) => void;
    _capture?: (s: SliderComponent, r: ExtraButtonComponent) => void;
}
/** A slider with a reset extra-button that restores `defaultValue`. */
export declare function sliderWithReset(setting: Setting, spec: SliderResetSpec): Setting;
export interface ColorResetSpec {
    name: string;
    desc: string;
    value: string;
    defaultValue: string;
    onChange: (v: string) => void;
    _capture?: (c: ColorComponent, r: ExtraButtonComponent) => void;
}
/** A color picker with a reset extra-button that restores `defaultValue`. */
export declare function colorWithReset(setting: Setting, spec: ColorResetSpec): Setting;
export interface DropdownResetSpec {
    name: string;
    desc: string;
    options: Record<string, string>;
    value: string;
    defaultValue: string;
    onChange: (v: string) => void;
    _capture?: (d: DropdownComponent, r: ExtraButtonComponent) => void;
}
/** A dropdown with a reset extra-button that restores `defaultValue`. */
export declare function dropdownWithReset(setting: Setting, spec: DropdownResetSpec): Setting;
