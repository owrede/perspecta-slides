import { ItemView, WorkspaceLeaf, Setting, TFile, setIcon, Modal, App } from 'obsidian';
import { Presentation, Slide, SlideLayout, SlideMetadata, PresentationFrontmatter } from '../types';
import { getThemeNames, getTheme } from '../themes';
import { FontManager } from '../utils/FontManager';

/**
 * Modal dialog showing Markdown editing help for slide creation
 */
class EditingHelpModal extends Modal {
  constructor(app: App) {
    super(app);
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.addClass('perspecta-editing-help-modal');

    contentEl.createEl('h2', { text: 'Slide Editing Reference' });

    // Speaker Notes section
    this.createSection(contentEl, 'Speaker Notes', [
      { syntax: 'Notes:', description: 'Start speaker notes section' },
      { syntax: 'Text below Notes:', description: 'Content shown in presenter view only' },
    ]);

    // Text on Slide section
    this.createSection(contentEl, 'Text on Slide', [
      { syntax: '---', description: 'Slide break (new slide)' },
      { syntax: '# Title', description: 'Main title (H1)' },
      { syntax: '## Subtitle', description: 'Subtitle (H2)' },
      { syntax: '### Heading', description: 'Section heading (H3)' },
      { syntax: '#### Subheading', description: 'Subheading (H4)' },
      { syntax: '^Kicker text', description: 'Kicker above title' },
      { syntax: '- List item', description: 'Bullet list' },
      { syntax: '1. Numbered item', description: 'Numbered list' },
      { syntax: '> Quote', description: 'Blockquote' },
      { syntax: '![alt](image.jpg)', description: 'Embed image' },
    ]);

    // Formatting section
    this.createSection(contentEl, 'Text Formatting', [
      { syntax: '**bold**', description: 'Bold text' },
      { syntax: '*italic*', description: 'Italic text' },
      { syntax: '==highlight==', description: 'Highlighted text' },
      { syntax: '~~strikethrough~~', description: 'Strikethrough text' },
      { syntax: '[text](url)', description: 'Hyperlink' },
      { syntax: '// comment', description: 'Hidden comment (not shown on slide)' },
    ]);

    // Code & Math section
    this.createSection(contentEl, 'Code & Math', [
      { syntax: '`inline code`', description: 'Inline code' },
      { syntax: '```lang\\ncode\\n```', description: 'Code block with syntax highlighting' },
      { syntax: '$E = mc^2$', description: 'Inline LaTeX math' },
      { syntax: '$$\\nequation\\n$$', description: 'Block LaTeX math' },
    ]);

    // Columns section
    this.createSection(contentEl, 'Column Layouts', [
      { syntax: '|', description: 'Column separator (split content into columns)' },
      { syntax: 'Content | Content', description: 'Two equal columns' },
      { syntax: 'A | B | C', description: 'Three columns' },
    ]);

    // Slide Directives section
    this.createSection(contentEl, 'Slide Directives', [
      { syntax: '<!-- layout: cover -->', description: 'Set slide layout' },
      { syntax: '<!-- mode: dark -->', description: 'Dark mode slide' },
      { syntax: '<!-- background: #color -->', description: 'Custom background' },
      { syntax: '<!-- class: custom -->', description: 'Add CSS class to slide' },
    ]);

    // Close button
    const footer = contentEl.createDiv({ cls: 'modal-button-container' });
    const closeBtn = footer.createEl('button', { text: 'Close', cls: 'mod-cta' });
    closeBtn.addEventListener('click', () => this.close());
  }

  private createSection(container: HTMLElement, title: string, items: { syntax: string; description: string }[]) {
    const section = container.createDiv({ cls: 'editing-help-section' });
    section.createEl('h3', { text: title });
    
    const table = section.createEl('table', { cls: 'editing-help-table' });
    for (const item of items) {
      const row = table.createEl('tr');
      const syntaxCell = row.createEl('td', { cls: 'syntax-cell' });
      syntaxCell.createEl('code', { text: item.syntax });
      row.createEl('td', { text: item.description, cls: 'description-cell' });
    }
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

export const INSPECTOR_VIEW_TYPE = 'perspecta-inspector';

type InspectorTab = 'presentation' | 'typography' | 'theme' | 'slide';

export class InspectorPanelView extends ItemView {
  private presentation: Presentation | null = null;
  private currentSlide: Slide | null = null;
  private currentSlideIndex: number = 0;
  private currentTab: InspectorTab = 'slide';
  private currentFile: TFile | null = null;
  private isFocusedOnFile: boolean = false;
  private onSlideMetadataChange: ((slideIndex: number, metadata: Partial<SlideMetadata>) => void) | null = null;
  private onPresentationChange: ((frontmatter: Partial<PresentationFrontmatter>, persistent: boolean) => void) | null = null;
  private fontManager: FontManager | null = null;
  private themeAppearanceMode: 'light' | 'dark' = 'light';

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }

  setFontManager(fontManager: FontManager) {
    this.fontManager = fontManager;
  }

  getViewType(): string {
    return INSPECTOR_VIEW_TYPE;
  }

  getDisplayText(): string {
    return 'Slide Inspector';
  }

  getIcon(): string {
    return 'sliders-horizontal';
  }

  async onOpen() {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass('perspecta-inspector');

    this.renderEmptyState(container as HTMLElement);
  }

  async onClose() {
    // Cleanup
  }

  setPresentation(presentation: Presentation, file?: TFile) {
    this.presentation = presentation;
    if (file) {
      this.currentFile = file;
    }
    // Set appearance mode based on presentation frontmatter
    const fm = presentation.frontmatter;
    if (fm.mode === 'dark') {
      this.themeAppearanceMode = 'dark';
    } else if (fm.mode === 'light') {
      this.themeAppearanceMode = 'light';
    }
    this.render();
  }

  public getTargetFile(): TFile | null {
    return this.currentFile;
  }

  setCurrentSlide(slide: Slide, index?: number) {
    this.currentSlide = slide;
    if (index !== undefined) {
      this.currentSlideIndex = index;
    }
    this.render();
  }

  setCurrentFile(file: TFile) {
    this.currentFile = file;
  }

  setFocused(isFocused: boolean) {
    if (this.isFocusedOnFile !== isFocused) {
      this.isFocusedOnFile = isFocused;
      this.render();
    }
  }

  setOnSlideMetadataChange(callback: (slideIndex: number, metadata: Partial<SlideMetadata>) => void) {
    this.onSlideMetadataChange = callback;
  }

  setOnPresentationChange(callback: (frontmatter: Partial<PresentationFrontmatter>, persistent: boolean) => void) {
    this.onPresentationChange = callback;
  }

  private render() {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();

    if (!this.presentation) {
      this.renderEmptyState(container);
      return;
    }

    // Tab bar
    const tabBar = container.createDiv({ cls: 'inspector-tabs' });
    this.createTab(tabBar, 'presentation', 'Presentation');
    this.createTab(tabBar, 'typography', 'Typography');
    this.createTab(tabBar, 'theme', 'Theme');
    this.createTab(tabBar, 'slide', 'Slide');

    // Tab content
    const content = container.createDiv({ cls: 'inspector-content' });

    switch (this.currentTab) {
      case 'presentation':
        this.renderPresentationTab(content);
        break;
      case 'typography':
        this.renderTypographyTab(content);
        break;
      case 'theme':
        this.renderThemeTab(content);
        break;
      case 'slide':
        this.renderSlideTab(content);
        break;
    }
  }

  private createTab(container: HTMLElement, id: InspectorTab, label: string) {
    const tab = container.createDiv({
      cls: `inspector-tab ${this.currentTab === id ? 'active' : ''}`
    });
    tab.createSpan({ text: label });

    tab.addEventListener('click', () => {
      this.currentTab = id;
      this.render();
    });
  }

  private renderEmptyState(container: HTMLElement) {
    const empty = container.createDiv({ cls: 'empty-state' });
    empty.createEl('div', { cls: 'empty-icon', text: '⚙️' });
  }

  // ============================================
  // PRESENTATION TAB - Global presentation settings
  // ============================================
  private renderPresentationTab(container: HTMLElement) {
    const fm = this.presentation?.frontmatter;
    if (!fm) return;

    // Section: PRESENTATION INFO
    this.createSectionHeader(container, 'PRESENTATION INFO');

    new Setting(container)
      .setName('Title')
      .addText(text => {
        text
          .setPlaceholder('Presentation Title')
          .setValue(fm.title || '');
        text.inputEl.addEventListener('blur', () => {
          this.updateFrontmatter({ title: text.getValue() });
        });
      });

    new Setting(container)
      .setName('Author')
      .addText(text => {
        text
          .setPlaceholder('Author Name')
          .setValue(fm.author || '');
        text.inputEl.addEventListener('blur', () => {
          this.updateFrontmatter({ author: text.getValue() });
        });
      });

    new Setting(container)
      .setName('Date')
      .addText(text => {
        text
          .setPlaceholder('YYYY-MM-DD')
          .setValue(fm.date || '');
        text.inputEl.addEventListener('blur', () => {
          this.updateFrontmatter({ date: text.getValue() });
        });
      });

    new Setting(container)
      .setName('Aspect Ratio')
      .addDropdown(dropdown => {
        dropdown.addOption('16:9', '16:9 (Widescreen)');
        dropdown.addOption('4:3', '4:3 (Standard)');
        dropdown.addOption('16:10', '16:10');
        dropdown.setValue(fm.aspectRatio || '16:9');
        dropdown.onChange(value => this.updateFrontmatter({ aspectRatio: value as any }));
      });

    // Section: HEADER AND FOOTER
    this.createSectionHeader(container, 'HEADER AND FOOTER');

    new Setting(container)
      .setName('Header Left')
      .addText(text => {
        text
          .setPlaceholder('Company Name')
          .setValue(fm.headerLeft || '');
        text.inputEl.addEventListener('blur', () => {
          this.updateFrontmatter({ headerLeft: text.getValue() });
        });
      });

    new Setting(container)
      .setName('Header Middle')
      .addText(text => {
        text
          .setPlaceholder('Presentation Title')
          .setValue(fm.headerMiddle || '');
        text.inputEl.addEventListener('blur', () => {
          this.updateFrontmatter({ headerMiddle: text.getValue() });
        });
      });

    new Setting(container)
      .setName('Header Right')
      .addText(text => {
        text
          .setPlaceholder('')
          .setValue(fm.headerRight || '');
        text.inputEl.addEventListener('blur', () => {
          this.updateFrontmatter({ headerRight: text.getValue() });
        });
      });

    new Setting(container)
      .setName('Footer Left')
      .addText(text => {
        text
          .setPlaceholder('')
          .setValue(fm.footerLeft || '');
        text.inputEl.addEventListener('blur', () => {
          this.updateFrontmatter({ footerLeft: text.getValue() });
        });
      });

    new Setting(container)
      .setName('Footer Middle')
      .addText(text => {
        text
          .setPlaceholder('')
          .setValue(fm.footerMiddle || '');
        text.inputEl.addEventListener('blur', () => {
          this.updateFrontmatter({ footerMiddle: text.getValue() });
        });
      });

    new Setting(container)
      .setName('Show Slide Numbers')
      .addToggle(toggle => toggle
        .setValue(fm.showSlideNumbers !== false)
        .onChange(value => this.updateFrontmatter({ showSlideNumbers: value })));

    // Section: IMAGE OVERLAY
    this.createSectionHeader(container, 'IMAGE OVERLAY');

    new Setting(container)
      .setName('Overlay Image')
      .addText(text => {
        text
          .setPlaceholder('path/to/overlay.png')
          .setValue(fm.imageOverlay || '');
        text.inputEl.addEventListener('blur', () => {
          this.updateFrontmatter({ imageOverlay: text.getValue() || undefined });
        });
      })
      .addExtraButton(btn => btn
        .setIcon('rotate-ccw')
        .setTooltip('Clear overlay')
        .onClick(() => this.updateFrontmatter({ imageOverlay: undefined })));

    new Setting(container)
      .setName('Overlay Opacity')
      .addSlider(slider => slider
        .setLimits(0, 100, 5)
        .setValue(fm.imageOverlayOpacity ?? 50)
        .setDynamicTooltip()
        .onChange(value => this.updateFrontmatter({ imageOverlayOpacity: value })))
      .addExtraButton(btn => btn
        .setIcon('rotate-ccw')
        .setTooltip('Reset to default (50%)')
        .onClick(() => this.updateFrontmatter({ imageOverlayOpacity: undefined })));

    // Editing Help Button
    const helpSection = container.createDiv({ cls: 'inspector-section editing-help-section' });
    const helpBtn = helpSection.createEl('button', {
      cls: 'editing-help-button',
      text: 'Editing Help'
    });
    setIcon(helpBtn.createSpan({ cls: 'editing-help-icon' }), 'help-circle');
    helpBtn.addEventListener('click', () => {
      new EditingHelpModal(this.app).open();
    });
  }

  // ============================================
  // TYPOGRAPHY TAB - Fonts and text settings
  // ============================================
  private renderTypographyTab(container: HTMLElement) {
    const fm = this.presentation?.frontmatter;
    if (!fm) return;

    const theme = getTheme(fm.theme || 'zurich');
    const themePreset = theme?.presets[0];

    // Section: FONTS
    this.createSectionHeader(container, 'FONTS');

    const cachedFonts = this.fontManager?.getAllCachedFonts() || [];
    const cachedFontNames = new Set(cachedFonts.map(f => f.name));

    const titleFontMissing = fm.titleFont && !cachedFontNames.has(fm.titleFont);
    const bodyFontMissing = fm.bodyFont && !cachedFontNames.has(fm.bodyFont);

    new Setting(container)
      .setName('Title Font')
      .addDropdown(dropdown => {
        dropdown.addOption('', 'Theme Default');
        if (titleFontMissing && fm.titleFont) {
          dropdown.addOption(fm.titleFont, `${fm.titleFont} (missing)`);
        }
        cachedFonts.forEach(font => {
          dropdown.addOption(font.name, font.displayName);
        });
        dropdown.setValue(fm.titleFont || '');
        dropdown.onChange(value => {
          this.updateFrontmatter({ titleFont: value || undefined });
        });
      })
      .addExtraButton(btn => btn
        .setIcon('rotate-ccw')
        .setTooltip('Reset to theme default')
        .onClick(() => this.updateFrontmatter({ titleFont: undefined })));

    new Setting(container)
      .setName('Body Font')
      .addDropdown(dropdown => {
        dropdown.addOption('', 'Theme Default');
        if (bodyFontMissing && fm.bodyFont) {
          dropdown.addOption(fm.bodyFont, `${fm.bodyFont} (missing)`);
        }
        cachedFonts.forEach(font => {
          dropdown.addOption(font.name, font.displayName);
        });
        dropdown.setValue(fm.bodyFont || '');
        dropdown.onChange(value => {
          this.updateFrontmatter({ bodyFont: value || undefined });
        });
      })
      .addExtraButton(btn => btn
        .setIcon('rotate-ccw')
        .setTooltip('Reset to theme default')
        .onClick(() => this.updateFrontmatter({ bodyFont: undefined })));

    if (cachedFonts.length === 0 && !titleFontMissing && !bodyFontMissing) {
      const helpText = container.createDiv({ cls: 'setting-item-description perspecta-font-help' });
      helpText.setText('No custom fonts available. Add fonts in Settings → Fonts tab.');
    }

    // Section: SIZES
    this.createSectionHeader(container, 'SIZES');

    new Setting(container)
      .setName('Font Size Offset')
      .addSlider(slider => slider
        .setLimits(-50, 50, 5)
        .setValue(fm.fontSizeOffset ?? 0)
        .setDynamicTooltip()
        .onChange(value => this.updateFrontmatter({ fontSizeOffset: value })))
      .addExtraButton(btn => btn
        .setIcon('rotate-ccw')
        .setTooltip('Reset to default')
        .onClick(() => this.updateFrontmatter({ fontSizeOffset: undefined })));

    new Setting(container)
      .setName('Header Font Size')
      .addSlider(slider => {
        slider
          .setLimits(0.5, 2, 0.05)
          .setValue(fm.headerFontSize ?? 0.7)
          .setDynamicTooltip()
          .onChange(value => {
            this.updateFrontmatter({ headerFontSize: value }, false);
          });
        slider.sliderEl.addEventListener('pointerup', () => {
          this.updateFrontmatter({ headerFontSize: slider.getValue() }, true);
        });
      })
      .addExtraButton(btn => btn
        .setIcon('rotate-ccw')
        .setTooltip('Reset to default (0.7em)')
        .onClick(() => this.updateFrontmatter({ headerFontSize: undefined }, true)));

    new Setting(container)
      .setName('Footer Font Size')
      .addSlider(slider => {
        slider
          .setLimits(0.5, 2, 0.05)
          .setValue(fm.footerFontSize ?? 0.7)
          .setDynamicTooltip()
          .onChange(value => {
            this.updateFrontmatter({ footerFontSize: value }, false);
          });
        slider.sliderEl.addEventListener('pointerup', () => {
          this.updateFrontmatter({ footerFontSize: slider.getValue() }, true);
        });
      })
      .addExtraButton(btn => btn
        .setIcon('rotate-ccw')
        .setTooltip('Reset to default (0.7em)')
        .onClick(() => this.updateFrontmatter({ footerFontSize: undefined }, true)));

    // Section: SPACING
    this.createSectionHeader(container, 'SPACING');

    new Setting(container)
      .setName('List Item Spacing')
      .addSlider(slider => {
        slider
          .setLimits(0, 2, 0.1)
          .setValue(fm.listItemSpacing ?? 0)
          .setDynamicTooltip()
          .onChange(value => {
            this.updateFrontmatter({ listItemSpacing: value }, false);
          });
        slider.sliderEl.addEventListener('pointerup', () => {
          this.updateFrontmatter({ listItemSpacing: slider.getValue() }, true);
        });
      })
      .addExtraButton(btn => btn
        .setIcon('rotate-ccw')
        .setTooltip('Reset to default (0em)')
        .onClick(() => this.updateFrontmatter({ listItemSpacing: 0 }, true)));

    new Setting(container)
      .setName('Headline Spacing Before')
      .addSlider(slider => {
        slider
          .setLimits(0, 3, 0.1)
          .setValue(fm.headlineSpacingBefore ?? 0)
          .setDynamicTooltip()
          .onChange(value => {
            this.updateFrontmatter({ headlineSpacingBefore: value }, false);
          });
        slider.sliderEl.addEventListener('pointerup', () => {
          this.updateFrontmatter({ headlineSpacingBefore: slider.getValue() }, true);
        });
      })
      .addExtraButton(btn => btn
        .setIcon('rotate-ccw')
        .setTooltip('Reset to default (0em)')
        .onClick(() => this.updateFrontmatter({ headlineSpacingBefore: undefined }, true)));

    new Setting(container)
      .setName('Headline Spacing After')
      .addSlider(slider => {
        slider
          .setLimits(0, 3, 0.1)
          .setValue(fm.headlineSpacingAfter ?? 0)
          .setDynamicTooltip()
          .onChange(value => {
            this.updateFrontmatter({ headlineSpacingAfter: value }, false);
          });
        slider.sliderEl.addEventListener('pointerup', () => {
          this.updateFrontmatter({ headlineSpacingAfter: slider.getValue() }, true);
        });
      })
      .addExtraButton(btn => btn
        .setIcon('rotate-ccw')
        .setTooltip('Reset to default (0em)')
        .onClick(() => this.updateFrontmatter({ headlineSpacingAfter: undefined }, true)));

    // Section: OFFSETS
    this.createSectionHeader(container, 'OFFSETS');

    new Setting(container)
      .setName('Content Top Offset')
      .addSlider(slider => slider
        .setLimits(0, 20, 0.25)
        .setValue(fm.contentTopOffset ?? 0)
        .setDynamicTooltip()
        .onChange(value => this.updateFrontmatter({ contentTopOffset: value })))
      .addExtraButton(btn => btn
        .setIcon('rotate-ccw')
        .setTooltip('Reset to default')
        .onClick(() => this.updateFrontmatter({ contentTopOffset: undefined })));
  }

  /**
   * Create a section header with uppercase title and gray separator line
   */
  private createSectionHeader(container: HTMLElement, title: string) {
    const header = container.createDiv({ cls: 'inspector-section-header' });
    header.createEl('span', { text: title, cls: 'section-title' });
    header.createEl('div', { cls: 'section-separator' });
  }

  // ============================================
  // THEME TAB - Theme and colors
  // ============================================
  private renderThemeTab(container: HTMLElement) {
    const fm = this.presentation?.frontmatter;
    if (!fm) return;

    const theme = getTheme(fm.theme || 'zurich');
    const themePreset = theme?.presets[0];

    // Section: THEME
    this.createSectionHeader(container, 'THEME');

    new Setting(container)
      .setName('Theme')
      .addDropdown(dropdown => {
        getThemeNames().forEach(name => {
          dropdown.addOption(name, name.charAt(0).toUpperCase() + name.slice(1));
        });
        dropdown.setValue(fm.theme || 'zurich');
        dropdown.onChange(async value => {
          await this.updateFrontmatter({ theme: value });
          this.render();
        });
      });

    new Setting(container)
      .setName('Appearance')
      .addDropdown(dropdown => {
        dropdown.addOption('light', '☀️ Light');
        dropdown.addOption('dark', '🌙 Dark');
        dropdown.addOption('system', '💻 System');
        dropdown.setValue(fm.mode || 'light');
        dropdown.onChange(value => {
          this.themeAppearanceMode = value === 'dark' ? 'dark' : 'light';
          this.updateFrontmatter({ mode: value as any });
        });
      });

    new Setting(container)
      .setName('Slide Transition')
      .addDropdown(dropdown => {
        dropdown.addOption('fade', 'Fade');
        dropdown.addOption('slide', 'Slide');
        dropdown.addOption('none', 'None');
        dropdown.setValue(fm.transition || 'fade');
        dropdown.onChange(value => this.updateFrontmatter({ transition: value as any }));
      });

    // Section: THEME COLORS
    this.createSectionHeader(container, 'THEME COLORS');

    // Appearance toggle (Light/Dark) for color editing
    const appearanceRow = container.createDiv({ cls: 'appearance-toggle-row' });
    appearanceRow.createEl('span', { text: 'Editing', cls: 'setting-label' });
    const toggleContainer = appearanceRow.createDiv({ cls: 'appearance-toggle' });

    const lightBtn = toggleContainer.createEl('button', {
      cls: `appearance-btn ${this.themeAppearanceMode === 'light' ? 'active' : ''}`,
      text: 'Light'
    });
    const darkBtn = toggleContainer.createEl('button', {
      cls: `appearance-btn ${this.themeAppearanceMode === 'dark' ? 'active' : ''}`,
      text: 'Dark'
    });

    const colorPickersContainer = container.createDiv({ cls: 'color-pickers-container' });

    const renderColorPickers = (mode: 'light' | 'dark') => {
      colorPickersContainer.empty();
      const currentFm = this.presentation?.frontmatter;
      if (!currentFm) return;

      const theme = getTheme(currentFm.theme || 'zurich');
      const themePreset = theme?.presets[0];

      const defaultTitleColor = mode === 'light' ? (themePreset?.LightTitleTextColor || '#000000') : (themePreset?.DarkTitleTextColor || '#ffffff');
      const defaultBodyColor = mode === 'light' ? (themePreset?.LightBodyTextColor || '#333333') : (themePreset?.DarkBodyTextColor || '#e0e0e0');
      const defaultBgColor = mode === 'light' ? (themePreset?.LightBackgroundColor || '#ffffff') : (themePreset?.DarkBackgroundColor || '#1a1a2e');

      // Titles color
      const titlesRow = colorPickersContainer.createDiv({ cls: 'color-row' });
      titlesRow.createEl('span', { text: 'Titles', cls: 'color-label' });
      const titlesPickerContainer = titlesRow.createDiv({ cls: 'color-picker-wrapper' });
      new Setting(titlesPickerContainer)
        .addColorPicker(picker => picker
          .setValue((mode === 'light' ? currentFm.lightTitleText : currentFm.darkTitleText) || defaultTitleColor)
          .onChange(value => {
            if (mode === 'light') {
              this.updateFrontmatter({ lightTitleText: value });
            } else {
              this.updateFrontmatter({ darkTitleText: value });
            }
          }))
        .addExtraButton(btn => btn
          .setIcon('rotate-ccw')
          .setTooltip('Reset to theme default')
          .onClick(() => {
            if (mode === 'light') {
              this.updateFrontmatter({ lightTitleText: undefined });
            } else {
              this.updateFrontmatter({ darkTitleText: undefined });
            }
            renderColorPickers(mode);
          }));

      // Body color
      const bodyRow = colorPickersContainer.createDiv({ cls: 'color-row' });
      bodyRow.createEl('span', { text: 'Body', cls: 'color-label' });
      const bodyPickerContainer = bodyRow.createDiv({ cls: 'color-picker-wrapper' });
      new Setting(bodyPickerContainer)
        .addColorPicker(picker => picker
          .setValue((mode === 'light' ? currentFm.lightBodyText : currentFm.darkBodyText) || defaultBodyColor)
          .onChange(value => {
            if (mode === 'light') {
              this.updateFrontmatter({ lightBodyText: value });
            } else {
              this.updateFrontmatter({ darkBodyText: value });
            }
          }))
        .addExtraButton(btn => btn
          .setIcon('rotate-ccw')
          .setTooltip('Reset to theme default')
          .onClick(() => {
            if (mode === 'light') {
              this.updateFrontmatter({ lightBodyText: undefined });
            } else {
              this.updateFrontmatter({ darkBodyText: undefined });
            }
            renderColorPickers(mode);
          }));

      // Background color
      const bgRow = colorPickersContainer.createDiv({ cls: 'color-row' });
      bgRow.createEl('span', { text: 'Background', cls: 'color-label' });
      const bgPickerContainer = bgRow.createDiv({ cls: 'color-picker-wrapper' });

      const useDynamic = currentFm.useDynamicBackground;
      const isDynamicForThisMode = useDynamic === 'both' || useDynamic === mode;

      if (isDynamicForThisMode) {
        const gradientPreview = bgPickerContainer.createDiv({ cls: 'dynamic-gradient-preview' });
        let colors: string[];
        const fmColors = mode === 'light' ? currentFm.lightDynamicBackground : currentFm.darkDynamicBackground;
        if (fmColors && fmColors.length > 0) {
          colors = fmColors;
        } else {
          const themeGradient = mode === 'light' ? themePreset?.LightBgGradient : themePreset?.DarkBgGradient;
          colors = themeGradient || (mode === 'light' ? ['#ffffff', '#f0f0f0', '#e0e0e0'] : ['#1a1a2e', '#2d2d44', '#3d3d5c']);
        }
        gradientPreview.style.background = `linear-gradient(to right, ${colors.join(', ')})`;
        gradientPreview.setAttribute('title', 'Dynamic: background progresses across slides');

        const disableBtn = bgPickerContainer.createEl('button', {
          cls: 'dynamic-toggle-btn active',
          text: 'Dynamic'
        });
        disableBtn.addEventListener('click', () => {
          const currentUseDynamic = this.presentation?.frontmatter?.useDynamicBackground;
          let newValue: 'light' | 'dark' | 'both' | 'none' = 'none';
          if (currentUseDynamic === 'both') {
            newValue = mode === 'light' ? 'dark' : 'light';
          }
          this.updateFrontmatter({ useDynamicBackground: newValue });
          renderColorPickers(mode);
        });
      } else {
        new Setting(bgPickerContainer)
          .addColorPicker(picker => picker
            .setValue((mode === 'light' ? currentFm.lightBackground : currentFm.darkBackground) || defaultBgColor)
            .onChange(value => {
              if (mode === 'light') {
                this.updateFrontmatter({ lightBackground: value });
              } else {
                this.updateFrontmatter({ darkBackground: value });
              }
            }))
          .addExtraButton(btn => btn
            .setIcon('rotate-ccw')
            .setTooltip('Reset to theme default')
            .onClick(() => {
              if (mode === 'light') {
                this.updateFrontmatter({ lightBackground: undefined });
              } else {
                this.updateFrontmatter({ darkBackground: undefined });
              }
              renderColorPickers(mode);
            }));

        const enableBtn = bgPickerContainer.createEl('button', {
          cls: 'dynamic-toggle-btn',
          text: 'Dynamic'
        });
        enableBtn.addEventListener('click', () => {
          const currentUseDynamic = this.presentation?.frontmatter?.useDynamicBackground;
          let newValue: 'light' | 'dark' | 'both' | 'none';
          if (currentUseDynamic === 'none' || !currentUseDynamic) {
            newValue = mode;
          } else if (currentUseDynamic === 'light' && mode === 'dark') {
            newValue = 'both';
          } else if (currentUseDynamic === 'dark' && mode === 'light') {
            newValue = 'both';
          } else {
            newValue = mode;
          }
          this.updateFrontmatter({ useDynamicBackground: newValue });
          renderColorPickers(mode);
        });
      }
    };

    renderColorPickers(this.themeAppearanceMode);

    lightBtn.addEventListener('click', () => {
      this.themeAppearanceMode = 'light';
      lightBtn.addClass('active');
      darkBtn.removeClass('active');
      renderColorPickers('light');
    });

    darkBtn.addEventListener('click', () => {
      this.themeAppearanceMode = 'dark';
      darkBtn.addClass('active');
      lightBtn.removeClass('active');
      renderColorPickers('dark');
    });

    // Section: ACCENT COLORS
    this.createSectionHeader(container, 'ACCENT COLORS');

    new Setting(container)
      .setName('Primary (Accent 1)')
      .addColorPicker(picker => picker
        .setValue(fm.accent1 || themePreset?.Accent1 || '#e63946')
        .onChange(value => this.updateFrontmatter({ accent1: value })))
      .addExtraButton(btn => btn
        .setIcon('rotate-ccw')
        .setTooltip('Reset to theme default')
        .onClick(() => this.updateFrontmatter({ accent1: undefined })));

    new Setting(container)
      .setName('Secondary (Accent 2)')
      .addColorPicker(picker => picker
        .setValue(fm.accent2 || themePreset?.Accent2 || '#43aa8b')
        .onChange(value => this.updateFrontmatter({ accent2: value })))
      .addExtraButton(btn => btn
        .setIcon('rotate-ccw')
        .setTooltip('Reset to theme default')
        .onClick(() => this.updateFrontmatter({ accent2: undefined })));

    new Setting(container)
      .setName('Tertiary (Accent 3)')
      .addColorPicker(picker => picker
        .setValue(fm.accent3 || themePreset?.Accent3 || '#f9c74f')
        .onChange(value => this.updateFrontmatter({ accent3: value })))
      .addExtraButton(btn => btn
        .setIcon('rotate-ccw')
        .setTooltip('Reset to theme default')
        .onClick(() => this.updateFrontmatter({ accent3: undefined })));

    new Setting(container)
      .setName('Accent 4')
      .addColorPicker(picker => picker
        .setValue(fm.accent4 || themePreset?.Accent4 || '#f94144')
        .onChange(value => this.updateFrontmatter({ accent4: value })))
      .addExtraButton(btn => btn
        .setIcon('rotate-ccw')
        .setTooltip('Reset to theme default')
        .onClick(() => this.updateFrontmatter({ accent4: undefined })));

    new Setting(container)
      .setName('Accent 5')
      .addColorPicker(picker => picker
        .setValue(fm.accent5 || themePreset?.Accent5 || '#f3722c')
        .onChange(value => this.updateFrontmatter({ accent5: value })))
      .addExtraButton(btn => btn
        .setIcon('rotate-ccw')
        .setTooltip('Reset to theme default')
        .onClick(() => this.updateFrontmatter({ accent5: undefined })));

    new Setting(container)
      .setName('Accent 6')
      .addColorPicker(picker => picker
        .setValue(fm.accent6 || themePreset?.Accent6 || '#f8961e')
        .onChange(value => this.updateFrontmatter({ accent6: value })))
      .addExtraButton(btn => btn
        .setIcon('rotate-ccw')
        .setTooltip('Reset to theme default')
        .onClick(() => this.updateFrontmatter({ accent6: undefined })));

    // Section: HEADING COLORS
    this.createSectionHeader(container, 'HEADING COLORS');

    const headingsContainer = container.createDiv({ cls: 'heading-colors-container' });
    this.renderHeadingColors(headingsContainer, this.themeAppearanceMode);

    // Section: LAYOUT BACKGROUNDS
    this.createSectionHeader(container, 'LAYOUT BACKGROUNDS');

    const layoutBgContainer = container.createDiv({ cls: 'layout-bg-container' });
    this.renderLayoutBackgrounds(layoutBgContainer, this.themeAppearanceMode);
  }

  private renderHeadingColors(container: HTMLElement, mode: 'light' | 'dark') {
    container.empty();
    const fm = this.presentation?.frontmatter;
    if (!fm) return;

    const theme = getTheme(fm.theme || 'zurich');
    const themePreset = theme?.presets[0];
    const defaultTitleColor = mode === 'light' 
      ? (themePreset?.LightTitleTextColor || '#000000') 
      : (themePreset?.DarkTitleTextColor || '#ffffff');

    const headingConfigs = [
      { level: 1, label: 'Headline #', lightKey: 'lightH1Color' as const, darkKey: 'darkH1Color' as const },
      { level: 2, label: 'Headline ##', lightKey: 'lightH2Color' as const, darkKey: 'darkH2Color' as const },
      { level: 3, label: 'Headline ###', lightKey: 'lightH3Color' as const, darkKey: 'darkH3Color' as const },
      { level: 4, label: 'Headline ####', lightKey: 'lightH4Color' as const, darkKey: 'darkH4Color' as const },
    ];

    // Find which headings have custom colors set
    const customHeadings = headingConfigs.filter(config => {
      const key = mode === 'light' ? config.lightKey : config.darkKey;
      const value = fm[key] as string[] | undefined;
      return value && value.length > 0;
    });

    // Show custom heading colors
    for (const config of customHeadings) {
      const key = mode === 'light' ? config.lightKey : config.darkKey;
      const value = (fm[key] as string[] | undefined)?.[0] || defaultTitleColor;

      const row = container.createDiv({ cls: 'heading-color-row' });
      row.createEl('span', { text: config.label, cls: 'color-label' });
      
      const pickerWrapper = row.createDiv({ cls: 'color-picker-wrapper' });
      new Setting(pickerWrapper)
        .addColorPicker(picker => picker
          .setValue(value)
          .onChange(newValue => {
            const update: Partial<PresentationFrontmatter> = {};
            (update as any)[key] = [newValue];
            this.updateFrontmatter(update);
          }))
        .addExtraButton(btn => btn
          .setIcon('x')
          .setTooltip('Remove custom color (use Title color)')
          .onClick(() => {
            const update: Partial<PresentationFrontmatter> = {};
            (update as any)[key] = undefined;
            this.updateFrontmatter(update);
            this.renderHeadingColors(container, mode);
          }));
    }

    // Show "Add heading color" dropdown for remaining headings
    const availableHeadings = headingConfigs.filter(config => {
      const key = mode === 'light' ? config.lightKey : config.darkKey;
      const value = fm[key] as string[] | undefined;
      return !value || value.length === 0;
    });

    if (availableHeadings.length > 0) {
      const addRow = container.createDiv({ cls: 'add-heading-color-row' });
      const addBtn = addRow.createEl('button', {
        cls: 'add-heading-color-btn',
        text: '+ Add heading color'
      });
      
      const dropdown = addRow.createEl('select', { cls: 'heading-level-select mod-hidden' });
      availableHeadings.forEach(config => {
        const opt = dropdown.createEl('option', { value: String(config.level), text: config.label });
      });

      addBtn.addEventListener('click', () => {
        addBtn.addClass('mod-hidden');
        dropdown.removeClass('mod-hidden');
        dropdown.focus();
      });

      dropdown.addEventListener('change', () => {
        const level = parseInt(dropdown.value);
        const config = headingConfigs.find(c => c.level === level);
        if (config) {
          const key = mode === 'light' ? config.lightKey : config.darkKey;
          const update: Partial<PresentationFrontmatter> = {};
          (update as any)[key] = [defaultTitleColor];
          this.updateFrontmatter(update);
          this.renderHeadingColors(container, mode);
        }
      });

      dropdown.addEventListener('blur', () => {
        dropdown.addClass('mod-hidden');
        addBtn.removeClass('mod-hidden');
      });
    }

    if (customHeadings.length === 0) {
      const helpText = container.createDiv({ cls: 'setting-item-description' });
      helpText.setText('Headlines use the Title color by default. Add custom colors for specific heading levels.');
    }
  }

  private renderLayoutBackgrounds(container: HTMLElement, mode: 'light' | 'dark') {
    container.empty();
    const fm = this.presentation?.frontmatter;
    if (!fm) return;

    const theme = getTheme(fm.theme || 'zurich');
    const themePreset = theme?.presets[0];

    const layoutConfigs = [
      { label: 'Cover Slides', lightKey: 'lightBgCover' as const, darkKey: 'darkBgCover' as const },
      { label: 'Title Slides', lightKey: 'lightBgTitle' as const, darkKey: 'darkBgTitle' as const },
      { label: 'Section Slides', lightKey: 'lightBgSection' as const, darkKey: 'darkBgSection' as const },
    ];

    // Find which layouts have custom backgrounds set
    const customLayouts = layoutConfigs.filter(config => {
      const key = mode === 'light' ? config.lightKey : config.darkKey;
      return fm[key] !== undefined;
    });

    // Show custom layout backgrounds
    for (const config of customLayouts) {
      const key = mode === 'light' ? config.lightKey : config.darkKey;
      const defaultBg = mode === 'light' 
        ? (themePreset?.LightBackgroundColor || '#ffffff') 
        : (themePreset?.DarkBackgroundColor || '#1a1a2e');
      const value = fm[key] || defaultBg;

      const row = container.createDiv({ cls: 'layout-bg-row' });
      row.createEl('span', { text: config.label, cls: 'color-label' });
      
      const pickerWrapper = row.createDiv({ cls: 'color-picker-wrapper' });
      new Setting(pickerWrapper)
        .addColorPicker(picker => picker
          .setValue(value)
          .onChange(newValue => {
            const update: Partial<PresentationFrontmatter> = {};
            (update as any)[key] = newValue;
            this.updateFrontmatter(update);
          }))
        .addExtraButton(btn => btn
          .setIcon('x')
          .setTooltip('Remove custom background (use theme Background)')
          .onClick(() => {
            const update: Partial<PresentationFrontmatter> = {};
            (update as any)[key] = undefined;
            this.updateFrontmatter(update);
            this.renderLayoutBackgrounds(container, mode);
          }));
    }

    // Show "Add layout background" dropdown for remaining layouts
    const availableLayouts = layoutConfigs.filter(config => {
      const key = mode === 'light' ? config.lightKey : config.darkKey;
      return fm[key] === undefined;
    });

    if (availableLayouts.length > 0) {
      const addRow = container.createDiv({ cls: 'add-layout-bg-row' });
      const addBtn = addRow.createEl('button', {
        cls: 'add-layout-bg-btn',
        text: '+ Add layout background'
      });
      
      const dropdown = addRow.createEl('select', { cls: 'layout-select mod-hidden' });
      availableLayouts.forEach(config => {
        dropdown.createEl('option', { value: config.label, text: config.label });
      });

      addBtn.addEventListener('click', () => {
        addBtn.addClass('mod-hidden');
        dropdown.removeClass('mod-hidden');
        dropdown.focus();
      });

      dropdown.addEventListener('change', () => {
        const config = layoutConfigs.find(c => c.label === dropdown.value);
        if (config) {
          const key = mode === 'light' ? config.lightKey : config.darkKey;
          const defaultBg = mode === 'light' 
            ? (themePreset?.LightBackgroundColor || '#ffffff') 
            : (themePreset?.DarkBackgroundColor || '#1a1a2e');
          const update: Partial<PresentationFrontmatter> = {};
          (update as any)[key] = defaultBg;
          this.updateFrontmatter(update);
          this.renderLayoutBackgrounds(container, mode);
        }
      });

      dropdown.addEventListener('blur', () => {
        dropdown.addClass('mod-hidden');
        addBtn.removeClass('mod-hidden');
      });
    }

    if (customLayouts.length === 0) {
      const helpText = container.createDiv({ cls: 'setting-item-description' });
      helpText.setText('Layouts use the theme Background color by default. Add custom backgrounds for specific slide types.');
    }
  }

  // ============================================
  // SLIDE TAB - Per-slide layout and overrides
  // ============================================
  private renderSlideTab(container: HTMLElement) {
    if (!this.currentSlide) {
      container.createEl('p', {
        cls: 'help-text centered',
        text: 'Select a slide to edit its design.'
      });
      return;
    }

    // Current slide indicator
    const slideInfo = container.createDiv({ cls: 'current-slide-info' });
    slideInfo.createEl('span', {
      cls: 'slide-badge',
      text: `Slide ${this.currentSlideIndex + 1}`
    });

    const title = this.getSlideTitle();
    if (title) {
      slideInfo.createEl('span', { cls: 'slide-title-preview', text: title });
    }

    // STANDARD SLIDES
    const standardSection = container.createDiv({ cls: 'inspector-section' });
    standardSection.createEl('h5', { text: 'Standard Slides' });

    const standardGrid = standardSection.createDiv({ cls: 'layout-picker' });

    const standardLayouts: { id: SlideLayout; label: string; icon: string }[] = [
      { id: 'default', label: 'Default', icon: 'square' },
      { id: 'cover', label: 'Cover', icon: 'presentation' },
      { id: 'title', label: 'Title', icon: 'heading-1' },
      { id: 'section', label: 'Section', icon: 'heading-2' },
    ];

    standardLayouts.forEach(layout => {
      const isActive = (this.currentSlide?.metadata.layout || 'default') === layout.id;
      const btn = standardGrid.createDiv({
        cls: `layout-option ${isActive ? 'active' : ''}`
      });
      const iconEl = btn.createDiv({ cls: 'layout-icon' });
      setIcon(iconEl, layout.icon);
      btn.createDiv({ cls: 'layout-label', text: layout.label });

      btn.addEventListener('click', () => {
        this.updateSlideMetadata({ layout: layout.id });
      });
    });

    // TEXT SLIDES (Column Layouts)
    const columnSection = container.createDiv({ cls: 'inspector-section' });
    columnSection.createEl('h5', { text: 'Text Slides' });

    const columnGrid = columnSection.createDiv({ cls: 'layout-picker' });

    const columnLayouts: { id: SlideLayout; label: string; icon: string }[] = [
      { id: '1-column', label: '1 Col', icon: 'square' },
      { id: '2-columns', label: '2 Col', icon: 'columns-2' },
      { id: '3-columns', label: '3 Col', icon: 'columns-3' },
      { id: '2-columns-1+2', label: '1+2', icon: 'panel-left' },
      { id: '2-columns-2+1', label: '2+1', icon: 'panel-right' },
    ];

    columnLayouts.forEach(layout => {
      const isActive = this.currentSlide?.metadata.layout === layout.id;
      const btn = columnGrid.createDiv({
        cls: `layout-option ${isActive ? 'active' : ''}`
      });
      const iconEl = btn.createDiv({ cls: 'layout-icon' });
      setIcon(iconEl, layout.icon);
      btn.createDiv({ cls: 'layout-label', text: layout.label });

      btn.addEventListener('click', () => {
        this.updateSlideMetadata({ layout: layout.id });
      });
    });

    // IMAGE SLIDES
    const imageSection = container.createDiv({ cls: 'inspector-section' });
    imageSection.createEl('h5', { text: 'Image Slides' });

    const imageGrid = imageSection.createDiv({ cls: 'layout-picker' });

    const imageLayouts: { id: SlideLayout; label: string; icon: string }[] = [
      { id: 'full-image', label: 'Full', icon: 'image' },
      { id: 'caption', label: 'Caption', icon: 'image' },
      { id: 'half-image', label: 'Half', icon: 'panel-left-close' },
      { id: 'half-image-horizontal', label: 'Half horiz.', icon: 'panel-top-close' },
    ];

    imageLayouts.forEach(layout => {
      const isActive = this.currentSlide?.metadata.layout === layout.id;
      const btn = imageGrid.createDiv({
        cls: `layout-option ${isActive ? 'active' : ''}`
      });
      const iconEl = btn.createDiv({ cls: 'layout-icon' });
      setIcon(iconEl, layout.icon);
      btn.createDiv({ cls: 'layout-label', text: layout.label });

      btn.addEventListener('click', () => {
        this.updateSlideMetadata({ layout: layout.id });
      });
    });

    // OVERRIDES section (renamed from Appearance)
    const overridesSection = container.createDiv({ cls: 'inspector-section' });
    overridesSection.createEl('h5', { text: 'Overrides' });

    // Mode toggle with reset
    const modeRow = overridesSection.createDiv({ cls: 'mode-row' });
    modeRow.createEl('span', { text: 'Mode', cls: 'setting-label' });
    
    const modeToggle = modeRow.createDiv({ cls: 'mode-toggle' });
    
    const hasExplicitMode = this.currentSlide?.metadata.mode !== undefined;

    const lightBtn = modeToggle.createDiv({
      cls: `mode-option ${hasExplicitMode && this.currentSlide?.metadata.mode === 'light' ? 'active' : ''}`
    });
    lightBtn.createSpan({ text: '☀️ Light' });
    lightBtn.addEventListener('click', () => this.updateSlideMetadata({ mode: 'light' }));

    const darkBtn = modeToggle.createDiv({
      cls: `mode-option ${hasExplicitMode && this.currentSlide?.metadata.mode === 'dark' ? 'active' : ''}`
    });
    darkBtn.createSpan({ text: '🌙 Dark' });
    darkBtn.addEventListener('click', () => this.updateSlideMetadata({ mode: 'dark' }));

    const resetModeBtn = modeRow.createEl('button', {
      cls: 'mode-reset-btn clickable-icon',
      attr: { 'aria-label': 'Reset to presentation default' }
    });
    setIcon(resetModeBtn, 'rotate-ccw');
    resetModeBtn.addEventListener('click', () => {
      this.updateSlideMetadata({ mode: undefined });
    });

    // Slide Background (moved from Images tab)
    new Setting(overridesSection)
      .setName('Background Image')
      .addText(text => {
        text
          .setPlaceholder('background.jpg')
          .setValue(this.currentSlide?.metadata.background || '');
        text.inputEl.addEventListener('blur', () => {
          this.updateSlideMetadata({ background: text.getValue() }, true);
        });
      });

    new Setting(overridesSection)
      .setName('Background Opacity')
      .addSlider(slider => slider
        .setLimits(0, 100, 5)
        .setValue((this.currentSlide?.metadata.backgroundOpacity ?? 1) * 100)
        .setDynamicTooltip()
        .onChange(value => this.updateSlideMetadata({ backgroundOpacity: value / 100 })));

    // Custom class
    new Setting(overridesSection)
      .setName('Custom CSS Class')
      .addText(text => {
        text
          .setPlaceholder('my-special-slide')
          .setValue(this.currentSlide?.metadata.class || '');
        text.inputEl.addEventListener('blur', () => {
          this.updateSlideMetadata({ class: text.getValue() }, true);
        });
      });
  }

  // ============================================
  // Helper methods
  // ============================================

  private getSlideTitle(): string | null {
    if (!this.currentSlide) return null;
    const heading = this.currentSlide.elements.find(e => e.type === 'heading');
    return heading ? heading.content.substring(0, 30) : null;
  }

  private updateSlideMetadata(metadata: Partial<SlideMetadata>, skipRender: boolean = false) {
    if (!this.currentSlide) return;

    // Update local state
    Object.assign(this.currentSlide.metadata, metadata);

    // Notify parent to update markdown file
    if (this.onSlideMetadataChange) {
      this.onSlideMetadataChange(this.currentSlideIndex, metadata);
    }

    // Only re-render for non-text changes to avoid losing focus
    if (!skipRender) {
      this.render();
    }
  }

  private updateFrontmatter(frontmatter: Partial<PresentationFrontmatter>, persistent: boolean = true) {
    if (!this.presentation) return;

    // Update local state
    for (const key in frontmatter) {
      const value = (frontmatter as any)[key];
      if (value === undefined) {
        delete (this.presentation.frontmatter as any)[key];
      } else {
        (this.presentation.frontmatter as any)[key] = value;
      }
    }

    // Notify parent
    if (this.onPresentationChange) {
      this.onPresentationChange(frontmatter, persistent);
    }

    // Refresh the UI ONLY if persistent is true
    if (persistent) {
      this.render();
    }
  }
}
