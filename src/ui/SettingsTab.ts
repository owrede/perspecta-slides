/**
 * Perspecta Slides Settings Tab
 *
 * Tabbed settings interface for the plugin.
 * Manages configuration across multiple categories:
 * - Changelog
 * - Presentation defaults
 * - Content mode
 * - Export options
 *
 * @module ui/SettingsTab
 */

import { App, PluginSettingTab, Setting } from 'obsidian';
import type PerspectaSlidesPlugin from '../../main';
import { renderChangelogToContainer } from '../changelog';
import { getThemeNames } from '../themes';
import { ContentMode } from '../types';

type SettingsTabId = 'changelog' | 'presentation' | 'content' | 'export' | 'debug';

export class PerspectaSlidesSettingTab extends PluginSettingTab {
	plugin: PerspectaSlidesPlugin;
	private currentTab: SettingsTabId = 'changelog';

	constructor(app: App, plugin: PerspectaSlidesPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		// Plugin title
		containerEl.createEl('h1', { text: 'Perspecta Slides', cls: 'perspecta-slides-settings-title' });

		// Version info
		const buildInfo = containerEl.createDiv({ cls: 'setting-item-description' });
		buildInfo.style.marginTop = '6px';
		buildInfo.style.marginBottom = '18px';
		buildInfo.setText(`Version: v${this.plugin.manifest.version}`);

		// Create tab navigation
		const tabNav = containerEl.createDiv({ cls: 'perspecta-slides-settings-tabs' });

		const tabs: { id: SettingsTabId; label: string }[] = [
			{ id: 'changelog', label: 'Changelog' },
			{ id: 'presentation', label: 'Presentation' },
			{ id: 'content', label: 'Content' },
			{ id: 'export', label: 'Export' },
			{ id: 'debug', label: 'Debug' },
		];

		tabs.forEach(tab => {
			const tabEl = tabNav.createEl('button', {
				cls: `perspecta-slides-settings-tab ${this.currentTab === tab.id ? 'is-active' : ''}`,
				text: tab.label
			});
			tabEl.addEventListener('click', () => {
				this.currentTab = tab.id;
				this.display();
			});
		});

		// Render content based on current tab
		const content = containerEl.createDiv({ cls: 'perspecta-slides-settings-content' });
		
		switch (this.currentTab) {
			case 'changelog':
				this.displayChangelog(content);
				break;
			case 'presentation':
				this.displayPresentationSettings(content);
				break;
			case 'content':
				this.displayContentSettings(content);
				break;
			case 'export':
				this.displayExportSettings(content);
				break;
			case 'debug':
				this.displayDebugSettings(content);
				break;
		}
	}

	private displayChangelog(containerEl: HTMLElement): void {
		renderChangelogToContainer(containerEl);
	}

	private displayPresentationSettings(containerEl: HTMLElement): void {
		containerEl.createEl('h2', { text: 'Presentation Defaults' });

		new Setting(containerEl)
			.setName('Default theme')
			.setDesc('The theme to use when no theme is specified in the presentation frontmatter.')
			.addDropdown(dropdown => {
				getThemeNames().forEach(name => {
					dropdown.addOption(name, name.charAt(0).toUpperCase() + name.slice(1));
				});
				dropdown.setValue(this.plugin.settings.defaultTheme);
				dropdown.onChange(async (value) => {
					this.plugin.settings.defaultTheme = value;
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName('Default aspect ratio')
			.setDesc('The default aspect ratio for presentations.')
			.addDropdown(dropdown => {
				dropdown.addOption('16:9', '16:9 (Widescreen)');
				dropdown.addOption('4:3', '4:3 (Standard)');
				dropdown.addOption('16:10', '16:10');
				dropdown.addOption('auto', 'Auto');
				dropdown.setValue(this.plugin.settings.defaultAspectRatio);
				dropdown.onChange(async (value: '16:9' | '4:3' | '16:10' | 'auto') => {
					this.plugin.settings.defaultAspectRatio = value;
					await this.plugin.saveSettings();
				});
			});

		containerEl.createEl('h2', { text: 'Sidebar Panels' });

		new Setting(containerEl)
			.setName('Show thumbnail navigator')
			.setDesc('Show the slide thumbnail navigator in the left sidebar when opening presentations.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showThumbnailNavigator)
				.onChange(async (value) => {
					this.plugin.settings.showThumbnailNavigator = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Show inspector')
			.setDesc('Show the slide inspector in the right sidebar when opening presentations.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showInspector)
				.onChange(async (value) => {
					this.plugin.settings.showInspector = value;
					await this.plugin.saveSettings();
				}));
	}

	private displayContentSettings(containerEl: HTMLElement): void {
		containerEl.createEl('h2', { text: 'Content Mode' });

		new Setting(containerEl)
			.setName('Default content mode')
			.setDesc('How to distinguish slide content from speaker notes.')
			.addDropdown(dropdown => {
				dropdown.addOption('ia-presenter', 'iA Presenter (tab = visible)');
				dropdown.addOption('advanced-slides', 'Advanced Slides (note: = notes)');
				dropdown.setValue(this.plugin.settings.defaultContentMode);
				dropdown.onChange(async (value: ContentMode) => {
					this.plugin.settings.defaultContentMode = value;
					this.plugin.parser.setDefaultContentMode(value);
					await this.plugin.saveSettings();
				});
			});

		containerEl.createEl('h2', { text: 'Debug Options' });

		new Setting(containerEl)
			.setName('Debug slide rendering')
			.setDesc('Enable console logging for slide parsing and column auto-detection.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.debugSlideRendering)
				.onChange(async (value) => {
					this.plugin.settings.debugSlideRendering = value;
					this.plugin.parser.setDebugMode(value);
					await this.plugin.saveSettings();
				}));

		// Content mode explanation
		const modeInfoBox = containerEl.createDiv({ cls: 'perspecta-slides-info-box' });
		modeInfoBox.createEl('h4', { text: 'Content Mode Explanation' });
		
		const iaInfo = modeInfoBox.createDiv();
		iaInfo.createEl('strong', { text: 'iA Presenter mode:' });
		const iaList = iaInfo.createEl('ul');
		iaList.createEl('li', { text: 'Tab-indented content appears on slide' });
		iaList.createEl('li', { text: 'Regular paragraphs become speaker notes' });
		iaList.createEl('li', { text: 'Headings always appear on slide' });
		
		const advancedInfo = modeInfoBox.createDiv();
		advancedInfo.createEl('strong', { text: 'Advanced Slides mode:' });
		const advancedList = advancedInfo.createEl('ul');
		advancedList.createEl('li', { text: 'All content appears on slide by default' });
		advancedList.createEl('li', { text: 'Lines starting with "note:" become speaker notes' });
		advancedList.createEl('li', { text: 'Supports more advanced markdown features' });

		containerEl.createEl('h2', { text: 'Custom Themes' });

		new Setting(containerEl)
			.setName('Custom themes folder')
			.setDesc('Folder in your vault for custom themes. Each theme is a subfolder with template.json, presets.json, and CSS.')
			.addText(text => text
				.setPlaceholder('perspecta-themes')
				.setValue(this.plugin.settings.customThemesFolder)
				.onChange(async (value) => {
					this.plugin.settings.customThemesFolder = value.trim() || 'perspecta-themes';
					await this.plugin.saveSettings();
				}));
	}

	private displayExportSettings(containerEl: HTMLElement): void {
		containerEl.createEl('h2', { text: 'Export Options' });

		new Setting(containerEl)
			.setName('Include speaker notes in export')
			.setDesc('Include speaker notes when exporting presentations to HTML. Notes will be hidden but accessible via presenter view.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.exportIncludeSpeakerNotes)
				.onChange(async (value) => {
					this.plugin.settings.exportIncludeSpeakerNotes = value;
					await this.plugin.saveSettings();
				}));

		// Usage section
		containerEl.createEl('h2', { text: 'Usage' });

		const usageEl = containerEl.createDiv({ cls: 'perspecta-slides-usage' });
		usageEl.createEl('p', { 
			text: 'Create presentations using Markdown with iA Presenter-style syntax:' 
		});

		const codeEl = usageEl.createEl('pre');
		codeEl.createEl('code', { 
			text: `---
title: My Presentation
theme: zurich
---

# Welcome Slide

This text is a speaker note (only you see it).

\t- Tab-indented content appears on slide
\t- Like this list

---

## Second Slide

### Visible heading

Regular paragraphs are speaker notes.

---

![](image.png)

This creates an image slide.`
		});
	}

	private displayDebugSettings(containerEl: HTMLElement): void {
		containerEl.createEl('h2', { text: 'Debug Options' });

		new Setting(containerEl)
			.setName('Debug slide rendering')
			.setDesc('Enable console logging for slide parsing and column auto-detection.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.debugSlideRendering)
				.onChange(async (value) => {
					this.plugin.settings.debugSlideRendering = value;
					this.plugin.parser.setDebugMode(value);
					await this.plugin.saveSettings();
				}));

		// Debug info section
		const debugInfoBox = containerEl.createDiv({ cls: 'perspecta-slides-info-box' });
		debugInfoBox.createEl('h4', { text: 'Debug Information' });
		
		const info = debugInfoBox.createDiv();
		info.createEl('p', { 
			text: 'When debug mode is enabled, detailed information about slide parsing and auto-column detection will be logged to the browser console (F12). This includes:'
		});
		
		const debugList = info.createEl('ul');
		debugList.createEl('li', { text: 'Element parsing and type detection' });
		debugList.createEl('li', { text: 'Column auto-detection logic' });
		debugList.createEl('li', { text: 'Content-to-element mapping' });
		debugList.createEl('li', { text: 'Column assignment results' });
		
		info.createEl('p', { 
			text: 'Use this when troubleshooting layout issues or unexpected slide behavior.'
		});
	}
}
