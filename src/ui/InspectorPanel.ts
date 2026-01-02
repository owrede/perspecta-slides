import { ItemView, WorkspaceLeaf, Setting, TFile, setIcon } from 'obsidian';
import { Presentation, Slide, SlideLayout, SlideMetadata, PresentationFrontmatter } from '../types';
import { getThemeNames } from '../themes';

export const INSPECTOR_VIEW_TYPE = 'perspecta-inspector';

type InspectorTab = 'presentation' | 'text' | 'images' | 'design';

export class InspectorPanelView extends ItemView {
  private presentation: Presentation | null = null;
  private currentSlide: Slide | null = null;
  private currentSlideIndex: number = 0;
  private currentTab: InspectorTab = 'design';
  private currentFile: TFile | null = null;
  private onSlideMetadataChange: ((slideIndex: number, metadata: Partial<SlideMetadata>) => void) | null = null;
  private onPresentationChange: ((frontmatter: Partial<PresentationFrontmatter>) => void) | null = null;
  
  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
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
    this.render();
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
  
  setOnSlideMetadataChange(callback: (slideIndex: number, metadata: Partial<SlideMetadata>) => void) {
    this.onSlideMetadataChange = callback;
  }
  
  setOnPresentationChange(callback: (frontmatter: Partial<PresentationFrontmatter>) => void) {
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
    this.createTab(tabBar, 'design', 'Design');
    this.createTab(tabBar, 'images', 'Images');
    this.createTab(tabBar, 'text', 'Text');
    
    // Tab content
    const content = container.createDiv({ cls: 'inspector-content' });
    
    switch (this.currentTab) {
      case 'presentation':
        this.renderPresentationTab(content);
        break;
      case 'text':
        this.renderTextTab(content);
        break;
      case 'images':
        this.renderImagesTab(content);
        break;
      case 'design':
        this.renderDesignTab(content);
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
    empty.createEl('p', { text: 'Open a presentation to edit settings' });
  }
  
  // ============================================
  // PRESENTATION TAB - Global frontmatter settings
  // ============================================
  private renderPresentationTab(container: HTMLElement) {
    const fm = this.presentation?.frontmatter;
    if (!fm) return;
    
    // Title & Author
    const section1 = container.createDiv({ cls: 'inspector-section' });
    section1.createEl('h5', { text: 'Presentation Info' });
    
    new Setting(section1)
      .setName('Title')
      .addText(text => text
        .setPlaceholder('Presentation Title')
        .setValue(fm.title || '')
        .onChange(value => this.updateFrontmatter({ title: value })));
    
    new Setting(section1)
      .setName('Author')
      .addText(text => text
        .setPlaceholder('Author Name')
        .setValue(fm.author || '')
        .onChange(value => this.updateFrontmatter({ author: value })));
    
    new Setting(section1)
      .setName('Date')
      .addText(text => text
        .setPlaceholder('YYYY-MM-DD')
        .setValue(fm.date || '')
        .onChange(value => this.updateFrontmatter({ date: value })));
    
    // Theme
    const section2 = container.createDiv({ cls: 'inspector-section' });
    section2.createEl('h5', { text: 'Theme' });
    
    new Setting(section2)
      .setName('Theme')
      .addDropdown(dropdown => {
        getThemeNames().forEach(name => {
          dropdown.addOption(name, name.charAt(0).toUpperCase() + name.slice(1));
        });
        dropdown.setValue(fm.theme || 'zurich');
        dropdown.onChange(value => this.updateFrontmatter({ theme: value }));
      });
    
    new Setting(section2)
      .setName('Aspect Ratio')
      .addDropdown(dropdown => {
        dropdown.addOption('16:9', '16:9 (Widescreen)');
        dropdown.addOption('4:3', '4:3 (Standard)');
        dropdown.addOption('16:10', '16:10');
        dropdown.setValue(fm.aspectRatio || '16:9');
        dropdown.onChange(value => this.updateFrontmatter({ aspectRatio: value as any }));
      });
    
    // Typography
    const section3 = container.createDiv({ cls: 'inspector-section' });
    section3.createEl('h5', { text: 'Typography' });
    
    new Setting(section3)
      .setName('Title Font')
      .addText(text => text
        .setPlaceholder('Helvetica, Arial, sans-serif')
        .setValue(fm.titleFont || '')
        .onChange(value => this.updateFrontmatter({ titleFont: value })));
    
    new Setting(section3)
      .setName('Body Font')
      .addText(text => text
        .setPlaceholder('Georgia, serif')
        .setValue(fm.bodyFont || '')
        .onChange(value => this.updateFrontmatter({ bodyFont: value })));
    
    // Header & Footer
    const section4 = container.createDiv({ cls: 'inspector-section' });
    section4.createEl('h5', { text: 'Header & Footer' });
    
    new Setting(section4)
      .setName('Header Left')
      .addText(text => text
        .setPlaceholder('Company Name')
        .setValue(fm.headerLeft || '')
        .onChange(value => this.updateFrontmatter({ headerLeft: value })));
    
    new Setting(section4)
      .setName('Header Right')
      .addText(text => text
        .setPlaceholder('')
        .setValue(fm.headerRight || '')
        .onChange(value => this.updateFrontmatter({ headerRight: value })));
    
    new Setting(section4)
      .setName('Footer Left')
      .addText(text => text
        .setPlaceholder('')
        .setValue(fm.footerLeft || '')
        .onChange(value => this.updateFrontmatter({ footerLeft: value })));
    
    new Setting(section4)
      .setName('Show Slide Numbers')
      .addToggle(toggle => toggle
        .setValue(fm.showSlideNumbers !== false)
        .onChange(value => this.updateFrontmatter({ showSlideNumbers: value })));
    
    // Transitions
    const section4b = container.createDiv({ cls: 'inspector-section' });
    section4b.createEl('h5', { text: 'Transitions' });
    
    new Setting(section4b)
      .setName('Slide Transition')
      .addDropdown(dropdown => {
        dropdown.addOption('fade', 'Fade');
        dropdown.addOption('slide', 'Slide');
        dropdown.addOption('none', 'None');
        dropdown.setValue(fm.transition || 'fade');
        dropdown.onChange(value => this.updateFrontmatter({ transition: value as any }));
      });
    
    // Colors
    const section5 = container.createDiv({ cls: 'inspector-section' });
    section5.createEl('h5', { text: 'Colors' });
    
    new Setting(section5)
      .setName('Primary (Accent 1)')
      .addColorPicker(picker => picker
        .setValue(fm.accent1 || '#000000')
        .onChange(value => this.updateFrontmatter({ accent1: value })));
    
    new Setting(section5)
      .setName('Secondary (Accent 2)')
      .addColorPicker(picker => picker
        .setValue(fm.accent2 || '#43aa8b')
        .onChange(value => this.updateFrontmatter({ accent2: value })));
    
    new Setting(section5)
      .setName('Tertiary (Accent 3)')
      .addColorPicker(picker => picker
        .setValue(fm.accent3 || '#f9c74f')
        .onChange(value => this.updateFrontmatter({ accent3: value })));
  }
  
  // ============================================
  // DESIGN TAB - Per-slide layout and appearance
  // ============================================
  private renderDesignTab(container: HTMLElement) {
    if (!this.currentSlide) {
      container.createEl('p', { 
        cls: 'help-text centered',
        text: 'Select a slide in the navigator to edit its design.' 
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
    columnSection.createEl('p', { 
      cls: 'help-text',
      text: 'Explicit column control (overrides auto-detection)' 
    });
    
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
    imageSection.createEl('p', { 
      cls: 'help-text',
      text: 'Layouts optimized for images' 
    });
    
    const imageGrid = imageSection.createDiv({ cls: 'layout-picker' });
    
    const imageLayouts: { id: SlideLayout; label: string; icon: string }[] = [
      { id: 'full-image', label: 'Full', icon: 'image' },
      { id: 'caption', label: 'Caption', icon: 'image' },
      { id: 'half-image', label: 'Half', icon: 'panel-left-close' },
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
    
    // Color Mode
    const section2 = container.createDiv({ cls: 'inspector-section' });
    section2.createEl('h5', { text: 'Appearance' });
    
    const modeToggle = section2.createDiv({ cls: 'mode-toggle' });
    
    const lightBtn = modeToggle.createDiv({ 
      cls: `mode-option ${(this.currentSlide?.metadata.mode || 'light') === 'light' ? 'active' : ''}` 
    });
    lightBtn.createSpan({ text: '☀️ Light' });
    lightBtn.addEventListener('click', () => this.updateSlideMetadata({ mode: 'light' }));
    
    const darkBtn = modeToggle.createDiv({ 
      cls: `mode-option ${this.currentSlide?.metadata.mode === 'dark' ? 'active' : ''}` 
    });
    darkBtn.createSpan({ text: '🌙 Dark' });
    darkBtn.addEventListener('click', () => this.updateSlideMetadata({ mode: 'dark' }));
    
    // Custom class
    new Setting(section2)
      .setName('Custom CSS Class')
      .setDesc('Add custom styling class')
      .addText(text => text
        .setPlaceholder('my-special-slide')
        .setValue(this.currentSlide?.metadata.class || '')
        .onChange(value => this.updateSlideMetadata({ class: value }, true)));
  }
  
  // ============================================
  // IMAGES TAB - Background and media settings
  // ============================================
  private renderImagesTab(container: HTMLElement) {
    if (!this.currentSlide) {
      container.createEl('p', { 
        cls: 'help-text centered',
        text: 'Select a slide to edit its images.' 
      });
      return;
    }
    
    // Current slide indicator
    const slideInfo = container.createDiv({ cls: 'current-slide-info' });
    slideInfo.createEl('span', { 
      cls: 'slide-badge',
      text: `Slide ${this.currentSlideIndex + 1}` 
    });
    
    // Insert image
    const section1 = container.createDiv({ cls: 'inspector-section' });
    section1.createEl('h5', { text: 'Add Image' });
    section1.createEl('p', { 
      cls: 'help-text',
      text: 'Images in your content appear on the slide automatically.' 
    });
    
    const formatButtons = section1.createDiv({ cls: 'format-buttons' });
    this.createFormatButton(formatButtons, '🖼️ Insert Image', '![](image.png)');
    
    // Background image
    const section2 = container.createDiv({ cls: 'inspector-section' });
    section2.createEl('h5', { text: 'Slide Background' });
    
    new Setting(section2)
      .setName('Background Image')
      .setDesc('Path or URL to background image')
      .addText(text => text
        .setPlaceholder('background.jpg')
        .setValue(this.currentSlide?.metadata.background || '')
        .onChange(value => this.updateSlideMetadata({ background: value }, true)));
    
    new Setting(section2)
      .setName('Background Opacity')
      .addSlider(slider => slider
        .setLimits(0, 100, 5)
        .setValue((this.currentSlide?.metadata.backgroundOpacity ?? 1) * 100)
        .setDynamicTooltip()
        .onChange(value => this.updateSlideMetadata({ backgroundOpacity: value / 100 })));
    
    // Image positioning info
    const section3 = container.createDiv({ cls: 'inspector-section' });
    section3.createEl('h5', { text: 'Image Tips' });
    section3.createEl('p', { 
      cls: 'help-text',
      text: '• Use Split layout for side-by-side text and image\n• Use Full Image layout for full-bleed images\n• Use Caption layout for image with text below' 
    });
  }
  
  // ============================================
  // TEXT TAB - Formatting helpers
  // ============================================
  private renderTextTab(container: HTMLElement) {
    // Speech (Speaker Notes)
    const section1 = container.createDiv({ cls: 'inspector-section' });
    section1.createEl('h5', { text: 'Speech (Speaker Notes)' });
    section1.createEl('p', { 
      cls: 'help-text',
      text: 'Regular paragraphs are speaker notes — only you see them.' 
    });
    
    const formatButtons1 = section1.createDiv({ cls: 'format-buttons' });
    this.createFormatButton(formatButtons1, 'Bold', '**text**');
    this.createFormatButton(formatButtons1, 'Italic', '*text*');
    this.createFormatButton(formatButtons1, 'Highlight', '==text==');
    this.createFormatButton(formatButtons1, 'Link', '[text](url)');
    
    // Text on Slide
    const section2 = container.createDiv({ cls: 'inspector-section' });
    section2.createEl('h5', { text: 'Text on Slide' });
    section2.createEl('p', { 
      cls: 'help-text',
      text: 'Headings and tab-indented content appear on the slide.' 
    });
    
    const formatButtons2 = section2.createDiv({ cls: 'format-buttons' });
    this.createFormatButton(formatButtons2, 'H1', '# ');
    this.createFormatButton(formatButtons2, 'H2', '## ');
    this.createFormatButton(formatButtons2, 'H3', '### ');
    this.createFormatButton(formatButtons2, 'H4', '#### ');
    this.createFormatButton(formatButtons2, 'H5', '##### ');
    this.createFormatButton(formatButtons2, '^Kicker', '^');
    
    const formatButtons3 = section2.createDiv({ cls: 'format-buttons' });
    this.createFormatButton(formatButtons3, '⇥ List', '\t- ');
    this.createFormatButton(formatButtons3, '⇥ Numbered', '\t1. ');
    this.createFormatButton(formatButtons3, '⇥ Quote', '\t> ');
    this.createFormatButton(formatButtons3, '⇥ Text', '\t');
    
    // Structure
    const section3 = container.createDiv({ cls: 'inspector-section' });
    section3.createEl('h5', { text: 'Structure' });
    
    const formatButtons4 = section3.createDiv({ cls: 'format-buttons' });
    this.createFormatButton(formatButtons4, '--- New Slide', '\n\n---\n\n');
    this.createFormatButton(formatButtons4, '// Comment', '// ');
    
    // Code & Math
    const section4 = container.createDiv({ cls: 'inspector-section' });
    section4.createEl('h5', { text: 'Code & Math' });
    
    const formatButtons5 = section4.createDiv({ cls: 'format-buttons' });
    this.createFormatButton(formatButtons5, '`Code`', '`code`');
    this.createFormatButton(formatButtons5, '```Block```', '\n```\ncode\n```\n');
    this.createFormatButton(formatButtons5, '$Math$', '$x^2$');
  }
  
  // ============================================
  // Helper methods
  // ============================================
  
  private createFormatButton(container: HTMLElement, label: string, format: string) {
    const btn = container.createEl('button', { cls: 'format-button' });
    btn.createSpan({ text: label });
    btn.setAttribute('title', `Insert: ${format.replace(/\n/g, '↵')}`);
    
    btn.addEventListener('click', () => {
      this.app.workspace.trigger('perspecta:insert-format', format);
    });
  }
  
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
  
  private updateFrontmatter(frontmatter: Partial<PresentationFrontmatter>) {
    if (!this.presentation) return;
    
    // Update local state
    Object.assign(this.presentation.frontmatter, frontmatter);
    
    // Notify parent to update markdown file
    if (this.onPresentationChange) {
      this.onPresentationChange(frontmatter);
    }
  }
}
