import { ItemView, WorkspaceLeaf, Setting } from 'obsidian';
import { Presentation, Slide, SlideLayout, SlideMetadata } from '../types';
import { getThemeNames } from '../themes';

export const INSPECTOR_VIEW_TYPE = 'perspecta-inspector';

type InspectorTab = 'text' | 'images' | 'design';

export class InspectorPanelView extends ItemView {
  private presentation: Presentation | null = null;
  private currentSlide: Slide | null = null;
  private currentTab: InspectorTab = 'text';
  private onSlideUpdate: ((slide: Slide) => void) | null = null;
  private onPresentationUpdate: ((presentation: Presentation) => void) | null = null;
  
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
    return 'settings';
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
  
  setPresentation(presentation: Presentation) {
    this.presentation = presentation;
    this.render();
  }
  
  setCurrentSlide(slide: Slide) {
    this.currentSlide = slide;
    this.render();
  }
  
  setOnSlideUpdate(callback: (slide: Slide) => void) {
    this.onSlideUpdate = callback;
  }
  
  setOnPresentationUpdate(callback: (presentation: Presentation) => void) {
    this.onPresentationUpdate = callback;
  }
  
  private render() {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    
    // Tab bar
    const tabBar = container.createDiv({ cls: 'inspector-tabs' });
    this.createTab(tabBar, 'text', 'Text', 'type');
    this.createTab(tabBar, 'images', 'Images', 'image');
    this.createTab(tabBar, 'design', 'Design', 'palette');
    
    // Tab content
    const content = container.createDiv({ cls: 'inspector-content' });
    
    switch (this.currentTab) {
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
  
  private createTab(container: HTMLElement, id: InspectorTab, label: string, icon: string) {
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
    empty.createEl('p', { text: 'Select a slide to edit its properties' });
  }
  
  private renderTextTab(container: HTMLElement) {
    container.createEl('h4', { text: 'Text Formatting' });
    
    // iA Presenter style: Speech vs Text on Slide
    const section1 = container.createDiv({ cls: 'inspector-section' });
    section1.createEl('h5', { text: 'Speech (Speaker Notes)' });
    section1.createEl('p', { 
      cls: 'help-text',
      text: 'Regular paragraphs are speaker notes - only you see them during presentation.' 
    });
    
    const formatButtons1 = section1.createDiv({ cls: 'format-buttons' });
    this.createFormatButton(formatButtons1, 'Bold', '**text**', 'bold');
    this.createFormatButton(formatButtons1, 'Italic', '*text*', 'italic');
    this.createFormatButton(formatButtons1, 'Highlight', '==text==', 'highlighter');
    
    const section2 = container.createDiv({ cls: 'inspector-section' });
    section2.createEl('h5', { text: 'Text on Slide' });
    section2.createEl('p', { 
      cls: 'help-text',
      text: 'Headings and tab-indented content appear on the slide.' 
    });
    
    const formatButtons2 = section2.createDiv({ cls: 'format-buttons' });
    this.createFormatButton(formatButtons2, 'H1', '# ', 'heading-1');
    this.createFormatButton(formatButtons2, 'H2', '## ', 'heading-2');
    this.createFormatButton(formatButtons2, 'H3', '### ', 'heading-3');
    this.createFormatButton(formatButtons2, 'List', '\t- ', 'list');
    this.createFormatButton(formatButtons2, 'Quote', '\t> ', 'quote');
    
    // Slide separator info
    const section3 = container.createDiv({ cls: 'inspector-section' });
    section3.createEl('h5', { text: 'Structure' });
    section3.createEl('p', { 
      cls: 'help-text',
      text: 'Use --- on its own line to create a new slide.' 
    });
    
    this.createFormatButton(section3, 'New Slide', '\n---\n', 'separator-horizontal');
    this.createFormatButton(section3, 'Comment', '// ', 'message-circle');
  }
  
  private renderImagesTab(container: HTMLElement) {
    container.createEl('h4', { text: 'Images & Media' });
    
    const section1 = container.createDiv({ cls: 'inspector-section' });
    section1.createEl('h5', { text: 'Add Image' });
    section1.createEl('p', { 
      cls: 'help-text',
      text: 'Images appear on slides automatically.' 
    });
    
    const formatButtons = section1.createDiv({ cls: 'format-buttons' });
    this.createFormatButton(formatButtons, 'Image', '![alt](image.png)', 'image');
    
    // Background image for current slide
    if (this.currentSlide) {
      const section2 = container.createDiv({ cls: 'inspector-section' });
      section2.createEl('h5', { text: 'Slide Background' });
      
      new Setting(section2)
        .setName('Background Image')
        .setDesc('URL or path to background image')
        .addText(text => text
          .setPlaceholder('background.jpg')
          .setValue(this.currentSlide?.metadata.background || '')
          .onChange(value => {
            if (this.currentSlide) {
              this.currentSlide.metadata.background = value;
              this.notifySlideUpdate();
            }
          }));
      
      new Setting(section2)
        .setName('Opacity')
        .setDesc('Background image opacity (0-100%)')
        .addSlider(slider => slider
          .setLimits(0, 100, 10)
          .setValue((this.currentSlide?.metadata.backgroundOpacity || 1) * 100)
          .setDynamicTooltip()
          .onChange(value => {
            if (this.currentSlide) {
              this.currentSlide.metadata.backgroundOpacity = value / 100;
              this.notifySlideUpdate();
            }
          }));
    }
  }
  
  private renderDesignTab(container: HTMLElement) {
    container.createEl('h4', { text: 'Design' });
    
    // Theme selection (presentation-level)
    if (this.presentation) {
      const section1 = container.createDiv({ cls: 'inspector-section' });
      section1.createEl('h5', { text: 'Presentation Theme' });
      
      new Setting(section1)
        .setName('Theme')
        .addDropdown(dropdown => {
          getThemeNames().forEach(name => {
            dropdown.addOption(name, name.charAt(0).toUpperCase() + name.slice(1));
          });
          dropdown.setValue(this.presentation?.frontmatter.theme || 'zurich');
          dropdown.onChange(value => {
            if (this.presentation) {
              this.presentation.frontmatter.theme = value;
              this.notifyPresentationUpdate();
            }
          });
        });
    }
    
    // Per-slide settings
    if (this.currentSlide) {
      const section2 = container.createDiv({ cls: 'inspector-section' });
      section2.createEl('h5', { text: 'Slide Settings' });
      
      // Layout
      new Setting(section2)
        .setName('Layout')
        .addDropdown(dropdown => {
          const layouts: SlideLayout[] = [
            'default', 'title', 'section', 'v-split', 
            'caption', 'full-image', 'grid'
          ];
          layouts.forEach(layout => {
            dropdown.addOption(layout, layout.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase()));
          });
          dropdown.setValue(this.currentSlide?.metadata.layout || 'default');
          dropdown.onChange(value => {
            if (this.currentSlide) {
              this.currentSlide.metadata.layout = value as SlideLayout;
              this.notifySlideUpdate();
            }
          });
        });
      
      // Light/Dark mode
      new Setting(section2)
        .setName('Color Mode')
        .addDropdown(dropdown => {
          dropdown.addOption('light', 'Light');
          dropdown.addOption('dark', 'Dark');
          dropdown.setValue(this.currentSlide?.metadata.mode || 'light');
          dropdown.onChange(value => {
            if (this.currentSlide) {
              this.currentSlide.metadata.mode = value as 'light' | 'dark';
              this.notifySlideUpdate();
            }
          });
        });
      
      // Custom CSS class
      new Setting(section2)
        .setName('Custom Class')
        .setDesc('Add custom CSS class to this slide')
        .addText(text => text
          .setPlaceholder('my-custom-slide')
          .setValue(this.currentSlide?.metadata.class || '')
          .onChange(value => {
            if (this.currentSlide) {
              this.currentSlide.metadata.class = value;
              this.notifySlideUpdate();
            }
          }));
    }
    
    // Colors section (presentation-level)
    if (this.presentation) {
      const section3 = container.createDiv({ cls: 'inspector-section' });
      section3.createEl('h5', { text: 'Colors' });
      
      const colors = [
        { key: 'accent1', label: 'Primary' },
        { key: 'accent2', label: 'Secondary' },
        { key: 'accent3', label: 'Tertiary' },
      ];
      
      colors.forEach(({ key, label }) => {
        new Setting(section3)
          .setName(label)
          .addColorPicker(picker => {
            const value = (this.presentation?.frontmatter as any)[key] || '#000000';
            picker.setValue(value);
            picker.onChange(value => {
              if (this.presentation) {
                (this.presentation.frontmatter as any)[key] = value;
                this.notifyPresentationUpdate();
              }
            });
          });
      });
    }
  }
  
  private createFormatButton(container: HTMLElement, label: string, format: string, icon: string) {
    const btn = container.createEl('button', { cls: 'format-button' });
    btn.createSpan({ text: label });
    btn.setAttribute('title', `Insert: ${format}`);
    
    btn.addEventListener('click', () => {
      // Dispatch event to insert format at cursor
      this.app.workspace.trigger('perspecta:insert-format', format);
    });
  }
  
  private notifySlideUpdate() {
    if (this.currentSlide && this.onSlideUpdate) {
      this.onSlideUpdate(this.currentSlide);
    }
  }
  
  private notifyPresentationUpdate() {
    if (this.presentation && this.onPresentationUpdate) {
      this.onPresentationUpdate(this.presentation);
    }
  }
}
