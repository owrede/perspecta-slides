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

import { App, PluginSettingTab, Setting, Notice, setIcon, TFolder } from 'obsidian';
import type PerspectaSlidesPlugin from '../../main';
import { renderChangelogToContainer } from '../changelog';
import { getThemeNames } from '../themes';
import { ContentMode, Theme } from '../types';
import { FontManager, CachedFont } from '../utils/FontManager';

type SettingsTabId = 'changelog' | 'presentation' | 'themes' | 'fonts' | 'content' | 'export' | 'debug';

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
			{ id: 'themes', label: 'Themes' },
			{ id: 'fonts', label: 'Fonts' },
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
			case 'themes':
				this.displayThemesSettings(content);
				break;
			case 'fonts':
				this.displayFontsSettings(content);
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
				// Add "Default" option for no theme (uses CSS defaults)
				dropdown.addOption('', '(Default - No Theme)');
				// Add custom themes
				if (this.plugin.themeLoader) {
					const customThemes = this.plugin.themeLoader.getCustomThemes();
					customThemes.forEach(theme => {
						const name = theme.template.Name.toLowerCase();
						const displayName = theme.template.Name;
						dropdown.addOption(name, displayName);
					});
				}
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

	private displayThemesSettings(containerEl: HTMLElement): void {
		containerEl.createEl('h2', { text: 'Custom Themes Folder' });

		new Setting(containerEl)
			.setName('Storage folder')
			.setDesc('Folder in your vault where custom themes are stored. Each theme is a subfolder with theme.json and theme.css.')
			.addText(text => text
				.setPlaceholder('perspecta-themes')
				.setValue(this.plugin.settings.customThemesFolder)
				.onChange(async (value) => {
					this.plugin.settings.customThemesFolder = value.trim() || 'perspecta-themes';
					if (this.plugin.themeLoader) {
						this.plugin.themeLoader.setCustomThemesFolder(this.plugin.settings.customThemesFolder);
						await this.plugin.themeLoader.loadThemes();
					}
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Reload themes')
			.setDesc('Reload custom themes from the storage folder.')
			.addButton(button => button
				.setButtonText('Reload')
				.onClick(async () => {
					if (this.plugin.themeLoader) {
						await this.plugin.themeLoader.loadThemes();
						new Notice('Custom themes reloaded');
						this.display();
					}
				}));

		containerEl.createEl('h2', { text: 'Custom Themes' });

		const themeLoader = this.plugin.themeLoader;
		if (!themeLoader) {
			containerEl.createEl('p', { text: 'Theme loader not initialized.' });
			return;
		}

		const customThemes = themeLoader.getCustomThemes();

		if (customThemes.length === 0) {
			const emptyState = containerEl.createDiv({ cls: 'perspecta-slides-info-box' });
			emptyState.createEl('p', { 
				text: 'No custom themes found. Use "Perspecta Slides: Save as custom theme" command to create one from your current presentation settings.' 
			});
		} else {
			const themeList = containerEl.createDiv({ cls: 'perspecta-theme-list' });

			for (const theme of customThemes) {
				const themeItem = themeList.createDiv({ cls: 'perspecta-theme-item' });

				const themeInfo = themeItem.createDiv({ cls: 'perspecta-theme-info' });
				themeInfo.createEl('div', { cls: 'perspecta-theme-name', text: theme.template.Name });
				
				const themeMeta = themeInfo.createDiv({ cls: 'perspecta-theme-meta' });
				themeMeta.createEl('span', { text: `Fonts: ${theme.template.TitleFont} / ${theme.template.BodyFont}` });
				if (theme.template.Author) {
					themeMeta.createEl('span', { text: ` • By: ${theme.template.Author}` });
				}

				const themeActions = themeItem.createDiv({ cls: 'perspecta-theme-actions' });

				const deleteBtn = themeActions.createEl('button', { cls: 'perspecta-font-btn perspecta-font-btn-danger' });
				setIcon(deleteBtn, 'trash-2');
				deleteBtn.setAttribute('aria-label', 'Delete theme');
				deleteBtn.addEventListener('click', async (e) => {
					e.stopPropagation();
					e.preventDefault();
					if (!theme.basePath) {
						new Notice('Cannot delete theme: missing path');
						return;
					}
					if (confirm(`Delete theme "${theme.template.Name}"? This will remove the theme folder and all its files.`)) {
						try {
							await this.deleteCustomTheme(theme.basePath);
							new Notice(`Theme "${theme.template.Name}" deleted`);
							if (this.plugin.themeLoader) {
								await this.plugin.themeLoader.loadThemes();
							}
							this.display();
						} catch (err) {
							console.error('Failed to delete theme:', err);
							new Notice(`Failed to delete theme: ${err}`);
						}
					}
				});
			}
		}

		// Info about creating themes
		const infoBox = containerEl.createDiv({ cls: 'perspecta-slides-info-box' });
		infoBox.createEl('h4', { text: 'Creating Custom Themes' });
		infoBox.createEl('p', { 
			text: 'To create a custom theme, open a presentation markdown file, adjust settings in the Inspector (fonts, colors, typography, margins), then run "Perspecta Slides: Save as custom theme" from the command palette.' 
		});
	}

	private async deleteCustomTheme(themePath: string): Promise<void> {
		const folder = this.app.vault.getAbstractFileByPath(themePath);
		if (folder instanceof TFolder) {
			// Recursively delete all children (files and subfolders)
			const deleteRecursively = async (f: TFolder) => {
				for (const child of [...f.children]) {
					if (child instanceof TFolder) {
						await deleteRecursively(child);
					} else {
						await this.app.vault.delete(child);
					}
				}
				await this.app.vault.delete(f);
			};
			await deleteRecursively(folder);
		} else {
			throw new Error(`Theme folder not found: ${themePath}`);
		}
	}

	private displayFontsSettings(containerEl: HTMLElement): void {
		const fontManager = this.plugin.fontManager;
		if (!fontManager) {
			containerEl.createEl('p', { text: 'Font manager not initialized.' });
			return;
		}

		containerEl.createEl('h2', { text: 'Font Storage Folder' });

		new Setting(containerEl)
			.setName('Storage folder')
			.setDesc('Folder in your vault where downloaded font files are stored.')
			.addText(text => text
				.setPlaceholder('perspecta-fonts')
				.setValue(this.plugin.settings.fontCacheFolder)
				.onChange(async (value) => {
					this.plugin.settings.fontCacheFolder = value.trim() || 'perspecta-fonts';
					if (this.plugin.fontManager) {
						this.plugin.fontManager.setFontCacheFolder(this.plugin.settings.fontCacheFolder);
					}
					await this.plugin.saveSettings();
				}));

		containerEl.createEl('h2', { text: 'Add Google Font' });

		const addFontSection = containerEl.createDiv({ cls: 'perspecta-add-font-section' });

		let fontUrl = '';
		let displayName = '';

		new Setting(addFontSection)
			.setName('Google Fonts URL')
			.setDesc('Paste a Google Fonts URL (e.g., https://fonts.google.com/specimen/Barlow)')
			.addText(text => text
				.setPlaceholder('https://fonts.google.com/specimen/...')
				.onChange(value => {
					fontUrl = value;
				}));

		new Setting(addFontSection)
			.setName('Display name')
			.setDesc('Optional custom name for the font (leave empty to use the font family name)')
			.addText(text => text
				.setPlaceholder('My Custom Font')
				.onChange(value => {
					displayName = value;
				}));

		new Setting(addFontSection)
			.addButton(button => button
				.setButtonText('Download Font')
				.setCta()
				.onClick(async () => {
					if (!fontUrl.trim()) {
						new Notice('Please enter a Google Fonts URL');
						return;
					}

					if (!FontManager.isGoogleFontsUrl(fontUrl)) {
						new Notice('Invalid Google Fonts URL');
						return;
					}

					const parsedName = FontManager.parseGoogleFontsUrl(fontUrl);
					if (!parsedName) {
						new Notice('Could not parse font name from URL');
						return;
					}

					if (fontManager.isCached(parsedName)) {
						new Notice(`Font "${parsedName}" is already downloaded`);
						return;
					}

					new Notice(`Downloading font "${parsedName}"...`);
					
					const result = await fontManager.cacheGoogleFont(fontUrl, displayName.trim() || undefined);
					if (result) {
						new Notice(`Font "${displayName.trim() || result}" downloaded successfully`);
						this.display();
					} else {
						new Notice('Failed to download font');
					}
				}));

		containerEl.createEl('h2', { text: 'Add Local Font' });

		const addLocalFontSection = containerEl.createDiv({ cls: 'perspecta-add-font-section' });

		let localFontPath = '';
		let localFontName = '';

		new Setting(addLocalFontSection)
			.setName('Font folder path')
			.setDesc('Path to a folder containing .otf, .ttf, .woff, or .woff2 files (relative to vault root)')
			.addText(text => text
				.setPlaceholder('sample-data/Fonts/MyFont')
				.onChange(value => {
					localFontPath = value;
				}));

		new Setting(addLocalFontSection)
			.setName('Font family name')
			.setDesc('Optional custom name (auto-detected from filenames if empty)')
			.addText(text => text
				.setPlaceholder('MyFont')
				.onChange(value => {
					localFontName = value;
				}));

		new Setting(addLocalFontSection)
			.addButton(button => button
				.setButtonText('Add Local Font')
				.setCta()
				.onClick(async () => {
					if (!localFontPath.trim()) {
						new Notice('Please enter a folder path');
						return;
					}

					const isValidFolder = await fontManager.isLocalFontFolder(localFontPath.trim());
					if (!isValidFolder) {
						new Notice('Folder not found or contains no font files (.otf, .ttf, .woff, .woff2)');
						return;
					}

					new Notice('Adding local font...');
					
					const result = await fontManager.cacheLocalFont(localFontPath.trim(), localFontName.trim() || undefined);
					if (result) {
						new Notice(`Font "${result}" added successfully`);
						this.display();
					} else {
						new Notice('Failed to add local font');
					}
				}));

		containerEl.createEl('h2', { text: 'Downloaded Fonts' });

		const cachedFonts = fontManager.getAllCachedFonts();

		if (cachedFonts.length === 0) {
			const emptyState = containerEl.createDiv({ cls: 'perspecta-slides-info-box' });
			emptyState.createEl('p', { text: 'No fonts downloaded yet. Add a Google Fonts URL above to get started.' });
		} else {
			const fontList = containerEl.createDiv({ cls: 'perspecta-font-list' });

			for (const font of cachedFonts) {
				const fontItem = fontList.createDiv({ cls: 'perspecta-font-item' });

				const fontInfo = fontItem.createDiv({ cls: 'perspecta-font-info' });
				fontInfo.createEl('div', { cls: 'perspecta-font-display-name', text: font.displayName });
				
				const fontMeta = fontInfo.createDiv({ cls: 'perspecta-font-meta' });
				fontMeta.createEl('span', { text: `Family: ${font.name}` });
				fontMeta.createEl('span', { text: ` • Weights: ${font.weights.join(', ')}` });

				const fontActions = fontItem.createDiv({ cls: 'perspecta-font-actions' });

				const editBtn = fontActions.createEl('button', { cls: 'perspecta-font-btn' });
				setIcon(editBtn, 'pencil');
				editBtn.setAttribute('aria-label', 'Edit display name');
				editBtn.addEventListener('click', async () => {
					const newName = prompt('Enter new display name:', font.displayName);
					if (newName && newName.trim() !== font.displayName) {
						await fontManager.updateDisplayName(font.name, newName.trim());
						new Notice(`Font renamed to "${newName.trim()}"`);
						this.display();
					}
				});

				const deleteBtn = fontActions.createEl('button', { cls: 'perspecta-font-btn perspecta-font-btn-danger' });
				setIcon(deleteBtn, 'trash-2');
				deleteBtn.setAttribute('aria-label', 'Delete font');
				deleteBtn.addEventListener('click', async () => {
					if (confirm(`Delete font "${font.displayName}"? This will remove the cached font files.`)) {
						await fontManager.removeFont(font.name);
						new Notice(`Font "${font.displayName}" deleted`);
						this.display();
					}
				});
			}
		}

		if (cachedFonts.length > 0) {
			containerEl.createEl('h2', { text: 'Cache Management' });

			new Setting(containerEl)
				.setName('Clear all fonts')
				.setDesc('Remove all downloaded fonts from the cache.')
				.addButton(button => button
					.setButtonText('Clear Cache')
					.setWarning()
					.onClick(async () => {
						if (confirm('Delete all cached fonts? This cannot be undone.')) {
							await fontManager.clearCache();
							new Notice('Font cache cleared');
							this.display();
						}
					}));
		}
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

		new Setting(containerEl)
			.setName('Debug font loading')
			.setDesc('Enable console logging for Google Fonts downloading and caching.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.debugFontLoading)
				.onChange(async (value) => {
					this.plugin.settings.debugFontLoading = value;
					if (this.plugin.fontManager) {
						this.plugin.fontManager.setDebugMode(value);
					}
					await this.plugin.saveSettings();
				}));

		// Debug info section
		const debugInfoBox = containerEl.createDiv({ cls: 'perspecta-slides-info-box' });
		debugInfoBox.createEl('h4', { text: 'Debug Information' });
		
		const info = debugInfoBox.createDiv();
		info.createEl('p', { 
			text: 'When debug modes are enabled, detailed information will be logged to the browser console (F12).'
		});
		
		const debugList = info.createEl('ul');
		debugList.createEl('li', { text: 'Slide rendering: Element parsing, column auto-detection, layout logic' });
		debugList.createEl('li', { text: 'Font loading: Font file downloads, caching, CSS generation' });
		
		info.createEl('p', { 
			text: 'Use these when troubleshooting layout issues or font loading problems.'
		});
	}
}
