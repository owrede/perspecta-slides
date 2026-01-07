import { ItemView, WorkspaceLeaf, Setting, TFile, setIcon, Modal, App } from 'obsidian';
import { Presentation, Slide, SlideLayout, SlideMetadata, PresentationFrontmatter } from '../types';
import { getThemeNames, getTheme } from '../themes';
import { ThemeLoader } from '../themes/ThemeLoader';
import { FontManager } from '../utils/FontManager';
import { SlideParser } from '../parser/SlideParser';

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

    // Slide Directives section (placed at start of slide, after ---)
    this.createSection(contentEl, 'Slide Directives', [
      { syntax: 'layout: cover', description: 'Set slide layout (cover, title, section, etc.)' },
      { syntax: 'mode: dark', description: 'Dark mode slide' },
      { syntax: 'background: image.jpg', description: 'Background image' },
      { syntax: 'class: custom', description: 'Add CSS class to slide' },
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

/**
 * Modal dialog for editing dynamic gradient colors
 */
class GradientEditorModal extends Modal {
  private colors: string[];
  private restartAtSection: boolean;
  private mode: 'light' | 'dark';
  private onSave: (colors: string[], restartAtSection: boolean) => void;

  constructor(
    app: App, 
    colors: string[], 
    restartAtSection: boolean,
    mode: 'light' | 'dark',
    onSave: (colors: string[], restartAtSection: boolean) => void
  ) {
    super(app);
    this.colors = [...colors];
    this.restartAtSection = restartAtSection;
    this.mode = mode;
    this.onSave = onSave;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.addClass('perspecta-gradient-editor-modal');

    contentEl.createEl('h2', { text: `Edit Dynamic Gradient (${this.mode === 'light' ? 'Light' : 'Dark'} Mode)` });

    // Description
    contentEl.createEl('p', { 
      text: 'Enter one hex color per line. The gradient will interpolate across slides from first to last color.',
      cls: 'modal-description'
    });

    // Gradient preview
    const previewContainer = contentEl.createDiv({ cls: 'gradient-preview-container' });
    const preview = previewContainer.createDiv({ cls: 'gradient-preview-large' });
    
    const updatePreview = (colorsText: string) => {
      const colors = colorsText.split('\n').map(c => c.trim()).filter(c => /^#[0-9a-fA-F]{6}$/.test(c));
      if (colors.length >= 2) {
        preview.style.background = `linear-gradient(to right, ${colors.join(', ')})`;
      } else if (colors.length === 1) {
        preview.style.background = colors[0];
      } else {
        preview.style.background = '#ccc';
      }
    };

    // Textarea for colors
    const textarea = contentEl.createEl('textarea', { 
      cls: 'gradient-colors-textarea',
      attr: { rows: '8', placeholder: '#ffffff\n#f0f0f0\n#e0e0e0' }
    });
    textarea.value = this.colors.join('\n');
    updatePreview(textarea.value);

    textarea.addEventListener('input', () => {
      updatePreview(textarea.value);
    });

    // Restart at section toggle
    const toggleContainer = contentEl.createDiv({ cls: 'gradient-toggle-container' });
    new Setting(toggleContainer)
      .setName('Restart at section slides')
      .setDesc('Gradient restarts at each section slide, interpolating between sections')
      .addToggle(toggle => toggle
        .setValue(this.restartAtSection)
        .onChange(value => {
          this.restartAtSection = value;
        }));

    // Buttons
    const footer = contentEl.createDiv({ cls: 'modal-button-container' });
    
    const cancelBtn = footer.createEl('button', { text: 'Cancel' });
    cancelBtn.addEventListener('click', () => this.close());

    const saveBtn = footer.createEl('button', { text: 'Save', cls: 'mod-cta' });
    saveBtn.addEventListener('click', () => {
      const newColors = textarea.value
        .split('\n')
        .map(c => c.trim())
        .filter(c => /^#[0-9a-fA-F]{6}$/.test(c));
      
      if (newColors.length < 2) {
        // Show error - need at least 2 colors for a gradient
        const errorEl = contentEl.querySelector('.gradient-error') as HTMLElement;
        if (errorEl) {
          errorEl.style.display = 'block';
        } else {
          const error = contentEl.createDiv({ cls: 'gradient-error', text: 'Please enter at least 2 valid hex colors (e.g., #ff0000)' });
          error.style.color = 'var(--text-error)';
        }
        return;
      }

      this.onSave(newColors, this.restartAtSection);
      this.close();
    });
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
  private themeLoader: ThemeLoader | null = null;
  private themeAppearanceMode: 'light' | 'dark' = 'light';

  private parser: SlideParser;

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
    this.parser = new SlideParser();
  }

  setFontManager(fontManager: FontManager) {
    this.fontManager = fontManager;
  }

  setThemeLoader(themeLoader: ThemeLoader) {
    this.themeLoader = themeLoader;
  }

  /**
   * Get a theme by name, using themeLoader if available
   */
  private getThemeByName(name: string): ReturnType<typeof getTheme> {
    if (this.themeLoader) {
      const theme = this.themeLoader.getTheme(name);
      if (theme) return theme;
    }
    return getTheme(name);
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

    // Try to load the presentation from the active file
    const activeFile = this.app.workspace.getActiveFile();
    if (activeFile && activeFile.extension === 'md' && !this.presentation) {
      try {
        const content = await this.app.vault.read(activeFile);
        const presentation = this.parser.parse(content);
        this.setPresentation(presentation, activeFile);
      } catch (e) {
        // If parsing fails, just show the empty state
        this.renderEmptyState(container as HTMLElement);
      }
    } else {
      this.renderEmptyState(container as HTMLElement);
    }
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
    this.createTab(tabBar, 'slide', 'Slide');
    this.createTab(tabBar, 'theme', 'Theme');
    this.createTab(tabBar, 'typography', 'Typography');

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
          .setPlaceholder('')
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

    new Setting(container)
      .setName('Lock Aspect Ratio')
      .addToggle(toggle => toggle
        .setValue(fm.lockAspectRatio || false)
        .onChange(value => this.updateFrontmatter({ lockAspectRatio: value })));

    // Section: HEADER AND FOOTER
    this.createSectionHeader(container, 'HEADER AND FOOTER');

    new Setting(container)
      .setName('Header Left')
      .addText(text => {
        text
          .setPlaceholder('')
          .setValue(fm.headerLeft || '');
        text.inputEl.addEventListener('blur', () => {
          this.updateFrontmatter({ headerLeft: text.getValue() });
        });
      });

    new Setting(container)
      .setName('Header Middle')
      .addText(text => {
        text
          .setPlaceholder('')
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

    const cachedFonts = (this.fontManager?.getAllCachedFonts() || []).sort((a, b) => 
      a.displayName.localeCompare(b.displayName)
    );
    const cachedFontNames = new Set(cachedFonts.map(f => f.name));

    // Helper to get weights for a font
    const getFontWeights = (fontName: string | undefined): number[] => {
      if (!fontName) return [];
      const font = cachedFonts.find(f => f.name === fontName);
      return font?.weights || [];
    };

    // Helper to get styles for a font
    const getFontStyles = (fontName: string | undefined): string[] => {
      if (!fontName) return [];
      const font = cachedFonts.find(f => f.name === fontName);
      return font?.styles || [];
    };

    // Helper to render weight dropdown (only if multiple weights available)
    const renderWeightDropdown = (
      parentContainer: HTMLElement,
      fontName: string | undefined,
      currentWeight: number | undefined,
      onWeightChange: (weight: number | undefined) => void
    ) => {
      const weights = getFontWeights(fontName);
      if (weights.length <= 1) return; // Don't show if only one weight

      new Setting(parentContainer)
        .setName('Weight')
        .setClass('weight-setting')
        .addDropdown(dropdown => {
          weights.forEach(w => {
            const label = this.getWeightLabel(w);
            dropdown.addOption(w.toString(), label);
          });
          // Only use currentWeight if it's valid for this font, otherwise use first available weight
          const validWeight = (currentWeight && weights.includes(currentWeight)) ? currentWeight : weights[0] || 400;
          dropdown.setValue(validWeight.toString());
          dropdown.onChange(value => onWeightChange(parseInt(value)));
        });
    };

    // ========== FONTS SECTION ==========
    this.createSectionHeader(container, 'FONTS');

    // Get theme's default fonts for display
    const theme = this.getThemeByName(fm.theme || '');
    const themeTitleFont = theme?.template.TitleFont || 'Helvetica';
    const themeBodyFont = theme?.template.BodyFont || 'Helvetica';

    const titleFontMissing = fm.titleFont && !cachedFontNames.has(fm.titleFont);
    const bodyFontMissing = fm.bodyFont && !cachedFontNames.has(fm.bodyFont);

    // Title Font
    new Setting(container)
      .setName('Title Font')
      .addDropdown(dropdown => {
        dropdown.addOption('', `Theme Default (${themeTitleFont})`);
        if (titleFontMissing && fm.titleFont) {
          dropdown.addOption(fm.titleFont, `${fm.titleFont} (missing)`);
        }
        cachedFonts.forEach(font => {
          dropdown.addOption(font.name, font.displayName);
        });
        dropdown.setValue(fm.titleFont || '');
        dropdown.onChange(value => {
          this.updateFrontmatter({ titleFont: value || undefined, titleFontWeight: undefined });
          this.render(); // Re-render to show/hide weight dropdown
        });
      })
      .addExtraButton(btn => btn
        .setIcon('rotate-ccw')
        .setTooltip('Reset to theme default')
        .onClick(() => {
          this.updateFrontmatter({ titleFont: undefined, titleFontWeight: undefined });
          this.render();
        }));

    // Title Font Weight (if applicable)
    renderWeightDropdown(container, fm.titleFont, fm.titleFontWeight,
      (weight) => this.updateFrontmatter({ titleFontWeight: weight }));

    // Body Font
    new Setting(container)
      .setName('Body Font')
      .addDropdown(dropdown => {
        dropdown.addOption('', `Theme Default (${themeBodyFont})`);
        if (bodyFontMissing && fm.bodyFont) {
          dropdown.addOption(fm.bodyFont, `${fm.bodyFont} (missing)`);
        }
        cachedFonts.forEach(font => {
          dropdown.addOption(font.name, font.displayName);
        });
        dropdown.setValue(fm.bodyFont || '');
        dropdown.onChange(value => {
          this.updateFrontmatter({ bodyFont: value || undefined, bodyFontWeight: undefined });
          this.render();
        });
      })
      .addExtraButton(btn => btn
        .setIcon('rotate-ccw')
        .setTooltip('Reset to theme default')
        .onClick(() => {
          this.updateFrontmatter({ bodyFont: undefined, bodyFontWeight: undefined });
          this.render();
        }));

    // Body Font Weight (if applicable)
    renderWeightDropdown(container, fm.bodyFont, fm.bodyFontWeight,
      (weight) => this.updateFrontmatter({ bodyFontWeight: weight }));

    // Header Font (inherits from Body by default)
    const effectiveBodyFont = fm.bodyFont || themeBodyFont;
    new Setting(container)
      .setName('Header Font')
      .addDropdown(dropdown => {
        dropdown.addOption('', `Inherit from Body (${effectiveBodyFont})`);
        cachedFonts.forEach(font => {
          dropdown.addOption(font.name, font.displayName);
        });
        dropdown.setValue(fm.headerFont || '');
        dropdown.onChange(value => {
          this.updateFrontmatter({ headerFont: value || undefined, headerFontWeight: undefined });
          this.render();
        });
      })
      .addExtraButton(btn => btn
        .setIcon('rotate-ccw')
        .setTooltip('Reset to inherit from Body')
        .onClick(() => {
          this.updateFrontmatter({ headerFont: undefined, headerFontWeight: undefined });
          this.render();
        }));

    // Header Font Weight (if applicable)
    renderWeightDropdown(container, fm.headerFont, fm.headerFontWeight,
      (weight) => this.updateFrontmatter({ headerFontWeight: weight }));

    // Footer Font (inherits from Body by default)
    new Setting(container)
      .setName('Footer Font')
      .addDropdown(dropdown => {
        dropdown.addOption('', `Inherit from Body (${effectiveBodyFont})`);
        cachedFonts.forEach(font => {
          dropdown.addOption(font.name, font.displayName);
        });
        dropdown.setValue(fm.footerFont || '');
        dropdown.onChange(value => {
          this.updateFrontmatter({ footerFont: value || undefined, footerFontWeight: undefined });
          this.render();
        });
      })
      .addExtraButton(btn => btn
        .setIcon('rotate-ccw')
        .setTooltip('Reset to inherit from Body')
        .onClick(() => {
          this.updateFrontmatter({ footerFont: undefined, footerFontWeight: undefined });
          this.render();
        }));

    // Footer Font Weight (if applicable)
    renderWeightDropdown(container, fm.footerFont, fm.footerFontWeight,
      (weight) => this.updateFrontmatter({ footerFontWeight: weight }));

    if (cachedFonts.length === 0 && !titleFontMissing && !bodyFontMissing) {
      const helpText = container.createDiv({ cls: 'setting-item-description perspecta-font-help' });
      helpText.setText('No custom fonts available. Add fonts in Settings → Fonts tab.');
    }

    // ========== SIZES SECTION ==========
    this.createSectionHeader(container, 'SIZES');

    // Description
    container.createDiv({ cls: 'section-description', text: 'Changes in % from defaults' });

    // Global Text Scale
    new Setting(container)
      .setName('Global Scale')
      .setDesc('Multiplier for all text sizes (0.5 = half size, 1.5 = 1.5x size)')
      .addSlider(slider => {
        slider
          .setLimits(0.5, 2, 0.05)
          .setValue(fm.textScale ?? 1)
          .setDynamicTooltip()
          .onChange(value => this.updateFrontmatter({ textScale: value }, false));
        slider.sliderEl.addEventListener('pointerup', () => {
          const val = slider.getValue();
          this.updateFrontmatter({ textScale: val === 1 ? undefined : val }, true);
        });
      })
      .addExtraButton(btn => btn
        .setIcon('rotate-ccw')
        .setTooltip('Reset to 1.0x')
        .onClick(() => this.updateFrontmatter({ textScale: undefined }, true)));

    // Title Size
    new Setting(container)
      .setName('Title')
      .addSlider(slider => {
        slider
          .setLimits(-50, 50, 5)
          .setValue(fm.titleFontSize ?? 0)
          .setDynamicTooltip()
          .onChange(value => this.updateFrontmatter({ titleFontSize: value }, false));
        slider.sliderEl.addEventListener('pointerup', () => {
          this.updateFrontmatter({ titleFontSize: slider.getValue() }, true);
        });
      })
      .addExtraButton(btn => btn
        .setIcon('rotate-ccw')
        .setTooltip('Reset to 0%')
        .onClick(() => this.updateFrontmatter({ titleFontSize: undefined }, true)));

    // Body Size
    new Setting(container)
      .setName('Body')
      .addSlider(slider => {
        slider
          .setLimits(-50, 50, 5)
          .setValue(fm.bodyFontSize ?? 0)
          .setDynamicTooltip()
          .onChange(value => this.updateFrontmatter({ bodyFontSize: value }, false));
        slider.sliderEl.addEventListener('pointerup', () => {
          this.updateFrontmatter({ bodyFontSize: slider.getValue() }, true);
        });
      })
      .addExtraButton(btn => btn
        .setIcon('rotate-ccw')
        .setTooltip('Reset to 0%')
        .onClick(() => this.updateFrontmatter({ bodyFontSize: undefined }, true)));

    // Header Size
    new Setting(container)
      .setName('Header')
      .addSlider(slider => {
        slider
          .setLimits(-50, 50, 5)
          .setValue(fm.headerFontSize ?? 0)
          .setDynamicTooltip()
          .onChange(value => this.updateFrontmatter({ headerFontSize: value }, false));
        slider.sliderEl.addEventListener('pointerup', () => {
          this.updateFrontmatter({ headerFontSize: slider.getValue() }, true);
        });
      })
      .addExtraButton(btn => btn
        .setIcon('rotate-ccw')
        .setTooltip('Reset to 0%')
        .onClick(() => this.updateFrontmatter({ headerFontSize: undefined }, true)));

    // Footer Size
    new Setting(container)
      .setName('Footer')
      .addSlider(slider => {
        slider
          .setLimits(-50, 50, 5)
          .setValue(fm.footerFontSize ?? 0)
          .setDynamicTooltip()
          .onChange(value => this.updateFrontmatter({ footerFontSize: value }, false));
        slider.sliderEl.addEventListener('pointerup', () => {
          this.updateFrontmatter({ footerFontSize: slider.getValue() }, true);
        });
      })
      .addExtraButton(btn => btn
        .setIcon('rotate-ccw')
        .setTooltip('Reset to 0%')
        .onClick(() => this.updateFrontmatter({ footerFontSize: undefined }, true)));

    // ========== SPACING SECTION ==========
    this.createSectionHeader(container, 'SPACING');

    // Description
    container.createDiv({ cls: 'section-description', text: 'Values in em' });

    // Headline (before)
    new Setting(container)
      .setName('Headline (before)')
      .addSlider(slider => {
        slider
          .setLimits(0, 3, 0.1)
          .setValue(fm.headlineSpacingBefore ?? 0)
          .setDynamicTooltip()
          .onChange(value => this.updateFrontmatter({ headlineSpacingBefore: value }, false));
        slider.sliderEl.addEventListener('pointerup', () => {
          const val = slider.getValue();
          this.updateFrontmatter({ headlineSpacingBefore: val === 0 ? undefined : val }, true);
        });
      })
      .addExtraButton(btn => btn
        .setIcon('rotate-ccw')
        .setTooltip('Reset to 0em')
        .onClick(() => this.updateFrontmatter({ headlineSpacingBefore: undefined }, true)));

    // Headline (after)
    new Setting(container)
      .setName('Headline (after)')
      .addSlider(slider => {
        slider
          .setLimits(0, 3, 0.1)
          .setValue(fm.headlineSpacingAfter ?? 0.5)
          .setDynamicTooltip()
          .onChange(value => this.updateFrontmatter({ headlineSpacingAfter: value }, false));
        slider.sliderEl.addEventListener('pointerup', () => {
          const val = slider.getValue();
          this.updateFrontmatter({ headlineSpacingAfter: val === 0.5 ? undefined : val }, true);
        });
      })
      .addExtraButton(btn => btn
        .setIcon('rotate-ccw')
        .setTooltip('Reset to 0.5em')
        .onClick(() => this.updateFrontmatter({ headlineSpacingAfter: undefined }, true)));

    // List Item (after)
    new Setting(container)
      .setName('List Item (after)')
      .addSlider(slider => {
        slider
          .setLimits(0, 2, 0.1)
          .setValue(fm.listItemSpacing ?? 1.0)
          .setDynamicTooltip()
          .onChange(value => this.updateFrontmatter({ listItemSpacing: value }, false));
        slider.sliderEl.addEventListener('pointerup', () => {
          const val = slider.getValue();
          this.updateFrontmatter({ listItemSpacing: val === 1.0 ? undefined : val }, true);
        });
      })
      .addExtraButton(btn => btn
        .setIcon('rotate-ccw')
        .setTooltip('Reset to 1.0em')
        .onClick(() => this.updateFrontmatter({ listItemSpacing: undefined }, true)));

    // Line Height
    new Setting(container)
      .setName('Line Height')
      .addSlider(slider => {
        slider
          .setLimits(0.5, 2.5, 0.05)
          .setValue(fm.lineHeight ?? 1.1)
          .setDynamicTooltip()
          .onChange(value => this.updateFrontmatter({ lineHeight: value }, false));
        slider.sliderEl.addEventListener('pointerup', () => {
          const val = slider.getValue();
          this.updateFrontmatter({ lineHeight: val === 1.1 ? undefined : val }, true);
        });
      })
      .addExtraButton(btn => btn
        .setIcon('rotate-ccw')
        .setTooltip('Reset to 1.1')
        .onClick(() => this.updateFrontmatter({ lineHeight: undefined }, true)));

    // ========== MARGINS SECTION ==========
    this.createSectionHeader(container, 'MARGINS');

    // Description
    container.createDiv({ cls: 'section-description', text: 'Values in em' });

    // Header (top)
    new Setting(container)
      .setName('Header (top)')
      .addSlider(slider => {
        slider
          .setLimits(0, 8, 0.2)
          .setValue(fm.headerTop ?? 2.5)
          .setDynamicTooltip()
          .onChange(value => this.updateFrontmatter({ headerTop: value }, false));
        slider.sliderEl.addEventListener('pointerup', () => {
          const val = slider.getValue();
          this.updateFrontmatter({ headerTop: val === 2.5 ? undefined : val }, true);
        });
      })
      .addExtraButton(btn => btn
        .setIcon('rotate-ccw')
        .setTooltip('Reset to 2.5em')
        .onClick(() => this.updateFrontmatter({ headerTop: undefined }, true)));

    // Footer (bottom)
    new Setting(container)
      .setName('Footer (bottom)')
      .addSlider(slider => {
        slider
          .setLimits(0, 8, 0.2)
          .setValue(fm.footerBottom ?? 2.5)
          .setDynamicTooltip()
          .onChange(value => this.updateFrontmatter({ footerBottom: value }, false));
        slider.sliderEl.addEventListener('pointerup', () => {
          const val = slider.getValue();
          this.updateFrontmatter({ footerBottom: val === 2.5 ? undefined : val }, true);
        });
      })
      .addExtraButton(btn => btn
        .setIcon('rotate-ccw')
        .setTooltip('Reset to 2.5em')
        .onClick(() => this.updateFrontmatter({ footerBottom: undefined }, true)));

    // Title (top)
    new Setting(container)
      .setName('Title (top)')
      .addSlider(slider => {
        slider
          .setLimits(0, 12, 0.2)
          .setValue(fm.titleTop ?? 5)
          .setDynamicTooltip()
          .onChange(value => this.updateFrontmatter({ titleTop: value }, false));
        slider.sliderEl.addEventListener('pointerup', () => {
          const val = slider.getValue();
          this.updateFrontmatter({ titleTop: val === 5 ? undefined : val }, true);
        });
      })
      .addExtraButton(btn => btn
        .setIcon('rotate-ccw')
        .setTooltip('Reset to 5em')
        .onClick(() => this.updateFrontmatter({ titleTop: undefined }, true)));

    // Content (top)
    new Setting(container)
      .setName('Content (top)')
      .addSlider(slider => {
        slider
          .setLimits(0, 38, 0.2)
          .setValue(fm.contentTop ?? 24)
          .setDynamicTooltip()
          .onChange(value => this.updateFrontmatter({ contentTop: value }, false));
        slider.sliderEl.addEventListener('pointerup', () => {
          const val = slider.getValue();
          this.updateFrontmatter({ contentTop: val === 24 ? undefined : val }, true);
        });
      })
      .addExtraButton(btn => btn
        .setIcon('rotate-ccw')
        .setTooltip('Reset to 24em')
        .onClick(() => this.updateFrontmatter({ contentTop: undefined }, true)));

    // Content (left/right)
    new Setting(container)
      .setName('Content (left/right)')
      .addSlider(slider => {
        slider
          .setLimits(0, 12, 0.2)
          .setValue(fm.contentWidth ?? 5)
          .setDynamicTooltip()
          .onChange(value => this.updateFrontmatter({ contentWidth: value }, false));
        slider.sliderEl.addEventListener('pointerup', () => {
          const val = slider.getValue();
          this.updateFrontmatter({ contentWidth: val === 5 ? undefined : val }, true);
        });
      })
      .addExtraButton(btn => btn
        .setIcon('rotate-ccw')
        .setTooltip('Reset to 5em')
        .onClick(() => this.updateFrontmatter({ contentWidth: undefined }, true)));
  }

  /**
   * Get human-readable label for font weight
   */
  private getWeightLabel(weight: number): string {
    const labels: Record<number, string> = {
      100: '100 Thin',
      200: '200 Extra Light',
      300: '300 Light',
      400: '400 Regular',
      500: '500 Medium',
      600: '600 Semi Bold',
      700: '700 Bold',
      800: '800 Extra Bold',
      900: '900 Black',
    };
    return labels[weight] || `${weight}`;
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

    const theme = this.getThemeByName(fm.theme || '');
    const themePreset = theme?.presets[0];

    // Section: THEME
    this.createSectionHeader(container, 'THEME');

    new Setting(container)
      .setName('Theme')
      .addDropdown(dropdown => {
        // Add "Default" option for no theme
        dropdown.addOption('', '(Default)');
        // Add custom themes from themeLoader
        if (this.themeLoader) {
          const customThemes = this.themeLoader.getCustomThemes();
          customThemes.forEach(theme => {
            const name = theme.template.Name.toLowerCase();
            const displayName = theme.template.Name;
            dropdown.addOption(name, displayName);
          });
        }
        dropdown.setValue(fm.theme || '');
        dropdown.onChange(async value => {
          await this.updateFrontmatter({ theme: value || undefined });
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

      const theme = this.getThemeByName(currentFm.theme || '');
      const themePreset = theme?.presets[0];

      const defaultTitleColor = mode === 'light' ? (themePreset?.LightTitleTextColor || '#000000') : (themePreset?.DarkTitleTextColor || '#ffffff');
      const defaultBodyColor = mode === 'light' ? (themePreset?.LightBodyTextColor || '#333333') : (themePreset?.DarkBodyTextColor || '#e0e0e0');
      const defaultBgColor = mode === 'light' ? (themePreset?.LightBackgroundColor || '#ffffff') : (themePreset?.DarkBackgroundColor || '#1a1a2e');
      const defaultHeaderColor = mode === 'light' ? '#666666' : '#999999';
      const defaultFooterColor = mode === 'light' ? '#666666' : '#999999';

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

      // Header text color
      const headerRow = colorPickersContainer.createDiv({ cls: 'color-row' });
      headerRow.createEl('span', { text: 'Header', cls: 'color-label' });
      const headerPickerContainer = headerRow.createDiv({ cls: 'color-picker-wrapper' });
      new Setting(headerPickerContainer)
        .addColorPicker(picker => picker
          .setValue((mode === 'light' ? currentFm.lightHeaderText : currentFm.darkHeaderText) || defaultHeaderColor)
          .onChange(value => {
            if (mode === 'light') {
              this.updateFrontmatter({ lightHeaderText: value });
            } else {
              this.updateFrontmatter({ darkHeaderText: value });
            }
          }))
        .addExtraButton(btn => btn
          .setIcon('rotate-ccw')
          .setTooltip('Reset to theme default')
          .onClick(() => {
            if (mode === 'light') {
              this.updateFrontmatter({ lightHeaderText: undefined });
            } else {
              this.updateFrontmatter({ darkHeaderText: undefined });
            }
            renderColorPickers(mode);
          }));

      // Footer text color
      const footerRow = colorPickersContainer.createDiv({ cls: 'color-row' });
      footerRow.createEl('span', { text: 'Footer', cls: 'color-label' });
      const footerPickerContainer = footerRow.createDiv({ cls: 'color-picker-wrapper' });
      new Setting(footerPickerContainer)
        .addColorPicker(picker => picker
          .setValue((mode === 'light' ? currentFm.lightFooterText : currentFm.darkFooterText) || defaultFooterColor)
          .onChange(value => {
            if (mode === 'light') {
              this.updateFrontmatter({ lightFooterText: value });
            } else {
              this.updateFrontmatter({ darkFooterText: value });
            }
          }))
        .addExtraButton(btn => btn
          .setIcon('rotate-ccw')
          .setTooltip('Reset to theme default')
          .onClick(() => {
            if (mode === 'light') {
              this.updateFrontmatter({ lightFooterText: undefined });
            } else {
              this.updateFrontmatter({ darkFooterText: undefined });
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
        gradientPreview.setAttribute('title', 'Click Edit to customize gradient colors');

        // Edit button to open gradient editor modal
        const editBtn = bgPickerContainer.createEl('button', {
          cls: 'dynamic-edit-btn',
          text: 'Edit'
        });
        editBtn.addEventListener('click', () => {
          const restartAtSection = currentFm.dynamicBackgroundRestartAtSection || false;
          new GradientEditorModal(
            this.app,
            colors,
            restartAtSection,
            mode,
            (newColors, newRestartAtSection) => {
              const update: Partial<PresentationFrontmatter> = {
                dynamicBackgroundRestartAtSection: newRestartAtSection || undefined,
              };
              if (mode === 'light') {
                update.lightDynamicBackground = newColors;
              } else {
                update.darkDynamicBackground = newColors;
              }
              this.updateFrontmatter(update);
            }
          ).open();
        });

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

    // Create containers for color sections before the toggle handlers
    // so they can be referenced in the handlers
    let semanticColorsContainer: HTMLElement;
    let headingsContainer: HTMLElement;
    let layoutBgContainer: HTMLElement;

    const updateAllColorSections = (mode: 'light' | 'dark') => {
      renderColorPickers(mode);
      if (semanticColorsContainer) {
        this.renderSemanticColors(semanticColorsContainer, mode);
      }
      if (headingsContainer) {
        this.renderHeadingColors(headingsContainer, mode);
      }
      if (layoutBgContainer) {
        this.renderLayoutBackgrounds(layoutBgContainer, mode);
      }
    };

    renderColorPickers(this.themeAppearanceMode);

    lightBtn.addEventListener('click', () => {
      this.themeAppearanceMode = 'light';
      lightBtn.addClass('active');
      darkBtn.removeClass('active');
      updateAllColorSections('light');
    });

    darkBtn.addEventListener('click', () => {
      this.themeAppearanceMode = 'dark';
      darkBtn.addClass('active');
      lightBtn.removeClass('active');
      updateAllColorSections('dark');
    });

    // Section: SEMANTIC COLORS
    this.createSectionHeader(container, 'SEMANTIC COLORS');

    // Container for semantic colors that updates with mode toggle
    semanticColorsContainer = container.createDiv({ cls: 'semantic-colors-container' });
    this.renderSemanticColors(semanticColorsContainer, this.themeAppearanceMode);

    // Section: HEADING COLORS
    this.createSectionHeader(container, 'HEADING COLORS');

    headingsContainer = container.createDiv({ cls: 'heading-colors-container' });
    this.renderHeadingColors(headingsContainer, this.themeAppearanceMode);

    // Section: LAYOUT BACKGROUNDS
    this.createSectionHeader(container, 'LAYOUT BACKGROUNDS');

    layoutBgContainer = container.createDiv({ cls: 'layout-bg-container' });
    this.renderLayoutBackgrounds(layoutBgContainer, this.themeAppearanceMode);
  }

  private renderHeadingColors(container: HTMLElement, mode: 'light' | 'dark') {
    container.empty();
    const fm = this.presentation?.frontmatter;
    if (!fm) return;

    const theme = this.getThemeByName(fm.theme || '');
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
      
      // If only one heading available, just show a simple button that adds it directly
      if (availableHeadings.length === 1) {
        const config = availableHeadings[0];
        const addBtn = addRow.createEl('button', {
          cls: 'add-heading-color-btn',
          text: `+ Add ${config.label}`
        });
        addBtn.addEventListener('click', () => {
          const key = mode === 'light' ? config.lightKey : config.darkKey;
          const update: Partial<PresentationFrontmatter> = {};
          (update as any)[key] = [defaultTitleColor];
          this.updateFrontmatter(update);
        });
      } else {
        // Multiple headings available - show dropdown with placeholder
        const addBtn = addRow.createEl('button', {
          cls: 'add-heading-color-btn',
          text: '+ Add heading color'
        });
        
        const dropdown = addRow.createEl('select', { cls: 'heading-level-select mod-hidden' });
        // Add placeholder option
        const placeholder = dropdown.createEl('option', { value: '', text: 'Select heading...' });
        placeholder.disabled = true;
        placeholder.selected = true;
        availableHeadings.forEach(config => {
          dropdown.createEl('option', { value: String(config.level), text: config.label });
        });

        addBtn.addEventListener('click', () => {
          addBtn.addClass('mod-hidden');
          dropdown.removeClass('mod-hidden');
          dropdown.selectedIndex = 0; // Reset to placeholder
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
          }
        });

        dropdown.addEventListener('blur', (e) => {
          setTimeout(() => {
            if (dropdown.parentElement) {
              dropdown.addClass('mod-hidden');
              addBtn.removeClass('mod-hidden');
            }
          }, 100);
        });
      }
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

    const theme = this.getThemeByName(fm.theme || '');
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
      
      // If only one layout available, just show a simple button that adds it directly
      if (availableLayouts.length === 1) {
        const config = availableLayouts[0];
        const defaultBg = mode === 'light' 
          ? (themePreset?.LightBackgroundColor || '#ffffff') 
          : (themePreset?.DarkBackgroundColor || '#1a1a2e');
        const addBtn = addRow.createEl('button', {
          cls: 'add-layout-bg-btn',
          text: `+ Add ${config.label}`
        });
        addBtn.addEventListener('click', () => {
          const key = mode === 'light' ? config.lightKey : config.darkKey;
          const update: Partial<PresentationFrontmatter> = {};
          (update as any)[key] = defaultBg;
          this.updateFrontmatter(update);
        });
      } else {
        // Multiple layouts available - show dropdown with placeholder
        const addBtn = addRow.createEl('button', {
          cls: 'add-layout-bg-btn',
          text: '+ Add layout background'
        });
        
        const dropdown = addRow.createEl('select', { cls: 'layout-select mod-hidden' });
        // Add placeholder option
        const placeholder = dropdown.createEl('option', { value: '', text: 'Select layout...' });
        placeholder.disabled = true;
        placeholder.selected = true;
        availableLayouts.forEach(config => {
          dropdown.createEl('option', { value: config.label, text: config.label });
        });

        addBtn.addEventListener('click', () => {
          addBtn.addClass('mod-hidden');
          dropdown.removeClass('mod-hidden');
          dropdown.selectedIndex = 0; // Reset to placeholder
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
          }
        });

        dropdown.addEventListener('blur', (e) => {
          setTimeout(() => {
            if (dropdown.parentElement) {
              dropdown.addClass('mod-hidden');
              addBtn.removeClass('mod-hidden');
            }
          }, 100);
        });
      }
    }

    if (customLayouts.length === 0) {
      const helpText = container.createDiv({ cls: 'setting-item-description' });
      helpText.setText('Layouts use the theme Background color by default. Add custom backgrounds for specific slide types.');
    }
  }

  /**
   * Render semantic color settings (links, bullets, blockquotes, tables, code, progress bar)
   */
  private renderSemanticColors(container: HTMLElement, mode: 'light' | 'dark') {
    container.empty();
    const fm = this.presentation?.frontmatter;
    if (!fm) return;

    const theme = this.getThemeByName(fm.theme || '');
    const themePreset = theme?.presets[0];

    // Default colors for semantic elements
    const defaults = mode === 'light' ? {
      link: themePreset?.LightLinkColor || '#0066cc',
      bullet: themePreset?.LightBulletColor || '#333333',
      blockquoteBorder: themePreset?.LightBlockquoteBorder || '#cccccc',
      tableHeaderBg: themePreset?.LightTableHeaderBg || '#f0f0f0',
      codeBorder: themePreset?.LightCodeBorder || '#e0e0e0',
      progressBar: themePreset?.LightProgressBar || '#0066cc',
      bold: '#333333',
    } : {
      link: themePreset?.DarkLinkColor || '#66b3ff',
      bullet: themePreset?.DarkBulletColor || '#e0e0e0',
      blockquoteBorder: themePreset?.DarkBlockquoteBorder || '#555555',
      tableHeaderBg: themePreset?.DarkTableHeaderBg || '#333333',
      codeBorder: themePreset?.DarkCodeBorder || '#444444',
      progressBar: themePreset?.DarkProgressBar || '#66b3ff',
      bold: '#e0e0e0',
    };

    const semanticConfigs = [
      { 
        label: 'Link Color', 
        lightKey: 'lightLinkColor' as const, 
        darkKey: 'darkLinkColor' as const,
        defaultVal: defaults.link
      },
      { 
        label: 'Bullet Color', 
        lightKey: 'lightBulletColor' as const, 
        darkKey: 'darkBulletColor' as const,
        defaultVal: defaults.bullet
      },
      { 
        label: 'Blockquote Border', 
        lightKey: 'lightBlockquoteBorder' as const, 
        darkKey: 'darkBlockquoteBorder' as const,
        defaultVal: defaults.blockquoteBorder
      },
      { 
        label: 'Table Header BG', 
        lightKey: 'lightTableHeaderBg' as const, 
        darkKey: 'darkTableHeaderBg' as const,
        defaultVal: defaults.tableHeaderBg
      },
      { 
        label: 'Code Border', 
        lightKey: 'lightCodeBorder' as const, 
        darkKey: 'darkCodeBorder' as const,
        defaultVal: defaults.codeBorder
      },
      { 
        label: 'Progress Bar', 
        lightKey: 'lightProgressBar' as const, 
        darkKey: 'darkProgressBar' as const,
        defaultVal: defaults.progressBar
      },
      { 
        label: 'Bold Text', 
        lightKey: 'lightBoldColor' as const, 
        darkKey: 'darkBoldColor' as const,
        defaultVal: defaults.bold
      },
    ];

    // Render color pickers for each semantic color
    for (const config of semanticConfigs) {
      const key = mode === 'light' ? config.lightKey : config.darkKey;
      const currentValue = fm[key] || config.defaultVal;

      new Setting(container)
        .setName(config.label)
        .addColorPicker(picker => picker
          .setValue(currentValue)
          .onChange(value => {
            const update: Partial<PresentationFrontmatter> = {};
            (update as any)[key] = value;
            this.updateFrontmatter(update);
          }))
        .addExtraButton(btn => btn
          .setIcon('rotate-ccw')
          .setTooltip('Reset to theme default')
          .onClick(() => {
            const update: Partial<PresentationFrontmatter> = {};
            (update as any)[key] = undefined;
            this.updateFrontmatter(update);
            this.renderSemanticColors(container, mode);
          }));
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

    // Notify parent - the parent will trigger a full refresh via file modification
    // and editor-change event, so no need to call this.render() here
    if (this.onPresentationChange) {
      this.onPresentationChange(frontmatter, persistent);
    }
  }
}
