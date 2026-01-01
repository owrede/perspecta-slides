import { 
  App, 
  Plugin, 
  PluginSettingTab, 
  Setting, 
  WorkspaceLeaf,
  TFile,
  MarkdownView,
  Notice,
  addIcon
} from 'obsidian';

import { PerspecaSlidesSettings, DEFAULT_SETTINGS, Presentation } from './src/types';
import { SlideParser } from './src/parser/SlideParser';
import { SlideRenderer } from './src/renderer/SlideRenderer';
import { getTheme, getThemeNames } from './src/themes';
import { ThumbnailNavigatorView, THUMBNAIL_VIEW_TYPE } from './src/ui/ThumbnailNavigator';
import { InspectorPanelView, INSPECTOR_VIEW_TYPE } from './src/ui/InspectorPanel';
import { PresentationView, PRESENTATION_VIEW_TYPE } from './src/ui/PresentationView';

const SLIDES_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>`;

export default class PerspectaSlidesPlugin extends Plugin {
  settings: PerspecaSlidesSettings = DEFAULT_SETTINGS;
  private parser: SlideParser = new SlideParser();

  async onload() {
    await this.loadSettings();

    addIcon('presentation', SLIDES_ICON);

    this.registerView(
      THUMBNAIL_VIEW_TYPE,
      (leaf) => new ThumbnailNavigatorView(leaf)
    );

    this.registerView(
      INSPECTOR_VIEW_TYPE,
      (leaf) => new InspectorPanelView(leaf)
    );

    this.registerView(
      PRESENTATION_VIEW_TYPE,
      (leaf) => new PresentationView(leaf)
    );

    this.addCommand({
      id: 'open-presentation-view',
      name: 'Open presentation view',
      checkCallback: (checking: boolean) => {
        const file = this.app.workspace.getActiveFile();
        if (file && file.extension === 'md') {
          if (!checking) {
            this.openPresentationView(file);
          }
          return true;
        }
        return false;
      }
    });

    this.addCommand({
      id: 'toggle-thumbnail-navigator',
      name: 'Toggle slide navigator',
      callback: () => {
        this.toggleThumbnailNavigator();
      }
    });

    this.addCommand({
      id: 'toggle-inspector',
      name: 'Toggle slide inspector',
      callback: () => {
        this.toggleInspector();
      }
    });

    this.addCommand({
      id: 'export-presentation-html',
      name: 'Export presentation to HTML',
      checkCallback: (checking: boolean) => {
        const file = this.app.workspace.getActiveFile();
        if (file && file.extension === 'md') {
          if (!checking) {
            this.exportToHTML(file);
          }
          return true;
        }
        return false;
      }
    });

    this.addCommand({
      id: 'start-presentation',
      name: 'Start presentation',
      checkCallback: (checking: boolean) => {
        const file = this.app.workspace.getActiveFile();
        if (file && file.extension === 'md') {
          if (!checking) {
            this.startPresentation(file);
          }
          return true;
        }
        return false;
      }
    });

    this.addCommand({
      id: 'insert-slide-separator',
      name: 'Insert slide separator',
      editorCallback: (editor) => {
        const cursor = editor.getCursor();
        editor.replaceRange('\n---\n\n', cursor);
        editor.setCursor({ line: cursor.line + 3, ch: 0 });
      }
    });

    this.addRibbonIcon('presentation', 'Open presentation view', () => {
      const file = this.app.workspace.getActiveFile();
      if (file && file.extension === 'md') {
        this.openPresentationView(file);
      } else {
        new Notice('Please open a markdown file first');
      }
    });

    this.addSettingTab(new PerspectaSlidesSettingTab(this.app, this));

    this.registerEvent(
      this.app.workspace.on('file-open', (file) => {
        if (file && file.extension === 'md') {
          this.updateSidebars(file);
        }
      })
    );

    this.registerEvent(
      this.app.workspace.on('editor-change', (editor) => {
        const file = this.app.workspace.getActiveFile();
        if (file) {
          this.debounceUpdateSidebars(file);
        }
      })
    );
  }

  onunload() {
    this.app.workspace.detachLeavesOfType(THUMBNAIL_VIEW_TYPE);
    this.app.workspace.detachLeavesOfType(INSPECTOR_VIEW_TYPE);
    this.app.workspace.detachLeavesOfType(PRESENTATION_VIEW_TYPE);
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  private async openPresentationView(file: TFile) {
    const existing = this.app.workspace.getLeavesOfType(PRESENTATION_VIEW_TYPE);
    
    let leaf: WorkspaceLeaf;
    if (existing.length > 0) {
      leaf = existing[0];
    } else {
      const activeLeaf = this.app.workspace.getLeaf(false);
      leaf = this.app.workspace.getLeaf('split', 'vertical');
    }

    await leaf.setViewState({
      type: PRESENTATION_VIEW_TYPE,
      active: true,
    });

    const view = leaf.view as PresentationView;
    await view.loadFile(file);

    this.app.workspace.revealLeaf(leaf);

    if (this.settings.showThumbnailNavigator) {
      await this.ensureThumbnailNavigator();
    }
    if (this.settings.showInspector) {
      await this.ensureInspector();
    }

    this.updateSidebars(file);
  }

  private async toggleThumbnailNavigator() {
    const existing = this.app.workspace.getLeavesOfType(THUMBNAIL_VIEW_TYPE);
    
    if (existing.length > 0) {
      existing[0].detach();
    } else {
      await this.ensureThumbnailNavigator();
      const file = this.app.workspace.getActiveFile();
      if (file) {
        this.updateSidebars(file);
      }
    }
  }

  private async toggleInspector() {
    const existing = this.app.workspace.getLeavesOfType(INSPECTOR_VIEW_TYPE);
    
    if (existing.length > 0) {
      existing[0].detach();
    } else {
      await this.ensureInspector();
      const file = this.app.workspace.getActiveFile();
      if (file) {
        this.updateSidebars(file);
      }
    }
  }

  private async ensureThumbnailNavigator() {
    const existing = this.app.workspace.getLeavesOfType(THUMBNAIL_VIEW_TYPE);
    if (existing.length > 0) return;

    const leaf = this.app.workspace.getLeftLeaf(false);
    if (leaf) {
      await leaf.setViewState({
        type: THUMBNAIL_VIEW_TYPE,
        active: true,
      });
    }
  }

  private async ensureInspector() {
    const existing = this.app.workspace.getLeavesOfType(INSPECTOR_VIEW_TYPE);
    if (existing.length > 0) return;

    const leaf = this.app.workspace.getRightLeaf(false);
    if (leaf) {
      await leaf.setViewState({
        type: INSPECTOR_VIEW_TYPE,
        active: true,
      });
    }
  }

  private updateTimeout: ReturnType<typeof setTimeout> | null = null;

  private debounceUpdateSidebars(file: TFile) {
    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
    }
    this.updateTimeout = setTimeout(() => {
      this.updateSidebars(file);
    }, 300);
  }

  private async updateSidebars(file: TFile) {
    const content = await this.app.vault.read(file);
    const presentation = this.parser.parse(content);

    const thumbnailLeaves = this.app.workspace.getLeavesOfType(THUMBNAIL_VIEW_TYPE);
    for (const leaf of thumbnailLeaves) {
      const view = leaf.view as ThumbnailNavigatorView;
      view.setPresentation(presentation);
      view.setOnSlideSelect((index) => {
        this.navigateToSlide(index, presentation);
      });
    }

    const inspectorLeaves = this.app.workspace.getLeavesOfType(INSPECTOR_VIEW_TYPE);
    for (const leaf of inspectorLeaves) {
      const view = leaf.view as InspectorPanelView;
      view.setPresentation(presentation);
      if (presentation.slides.length > 0) {
        view.setCurrentSlide(presentation.slides[0]);
      }
    }

    const presentationLeaves = this.app.workspace.getLeavesOfType(PRESENTATION_VIEW_TYPE);
    for (const leaf of presentationLeaves) {
      const view = leaf.view as PresentationView;
      view.setPresentation(presentation);
    }
  }

  private navigateToSlide(index: number, presentation: Presentation) {
    const presentationLeaves = this.app.workspace.getLeavesOfType(PRESENTATION_VIEW_TYPE);
    for (const leaf of presentationLeaves) {
      const view = leaf.view as PresentationView;
      view.goToSlide(index);
    }

    const inspectorLeaves = this.app.workspace.getLeavesOfType(INSPECTOR_VIEW_TYPE);
    for (const leaf of inspectorLeaves) {
      const view = leaf.view as InspectorPanelView;
      if (presentation.slides[index]) {
        view.setCurrentSlide(presentation.slides[index]);
      }
    }
  }

  private async exportToHTML(file: TFile) {
    const content = await this.app.vault.read(file);
    const presentation = this.parser.parse(content);
    const theme = getTheme(presentation.frontmatter.theme || this.settings.defaultTheme);
    const renderer = new SlideRenderer(presentation, theme);
    const html = renderer.renderHTML();

    const exportPath = file.path.replace(/\.md$/, '.html');
    
    const existingFile = this.app.vault.getAbstractFileByPath(exportPath);
    if (existingFile instanceof TFile) {
      await this.app.vault.modify(existingFile, html);
    } else {
      await this.app.vault.create(exportPath, html);
    }

    new Notice(`Exported presentation to ${exportPath}`);
  }

  private async startPresentation(file: TFile) {
    const content = await this.app.vault.read(file);
    const presentation = this.parser.parse(content);
    const theme = getTheme(presentation.frontmatter.theme || this.settings.defaultTheme);
    const renderer = new SlideRenderer(presentation, theme);
    const html = renderer.renderHTML();

    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
    } else {
      new Notice('Could not open presentation window. Please check your popup blocker settings.');
    }
  }
}

class PerspectaSlidesSettingTab extends PluginSettingTab {
  plugin: PerspectaSlidesPlugin;

  constructor(app: App, plugin: PerspectaSlidesPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

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

    new Setting(containerEl)
      .setName('Include speaker notes in export')
      .setDesc('Include speaker notes when exporting presentations to HTML.')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.exportIncludeSpeakerNotes)
        .onChange(async (value) => {
          this.plugin.settings.exportIncludeSpeakerNotes = value;
          await this.plugin.saveSettings();
        }));

    containerEl.createEl('h3', { text: 'Usage' });
    
    const usageEl = containerEl.createDiv({ cls: 'perspecta-usage' });
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
}
