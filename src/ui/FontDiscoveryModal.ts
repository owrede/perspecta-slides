import { App, Modal, Setting } from 'obsidian';

/**
 * Modal for selecting font weights and styles during discovery
 * Shows available weights/styles and lets user choose which to download
 */
export class FontDiscoveryModal extends Modal {
  private fontName: string;
  private availableWeights: number[];
  private availableStyles: string[];
  private selectedWeights: Set<number>;
  private selectedStyles: Set<string>;
  private onConfirm: (weights: number[], styles: string[]) => void;
  private onCancel: () => void;

  constructor(
    app: App,
    fontName: string,
    availableWeights: number[],
    availableStyles: string[],
    onConfirm: (weights: number[], styles: string[]) => void,
    onCancel: () => void
  ) {
    super(app);
    this.fontName = fontName;
    this.availableWeights = availableWeights.sort((a, b) => a - b);
    this.availableStyles = availableStyles.sort();
    this.selectedWeights = new Set(this.availableWeights); // All selected by default
    this.selectedStyles = new Set(this.availableStyles); // All selected by default
    this.onConfirm = onConfirm;
    this.onCancel = onCancel;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.addClass('perspecta-font-discovery-modal');

    // Title
    contentEl.createEl('h2', { text: `Download Font: ${this.fontName}` });

    // Description
    contentEl.createEl('p', {
      text: 'Select which font weights and styles you want to download. Smaller selections mean faster downloads.',
      cls: 'modal-description'
    });

    // Weights Section
    contentEl.createEl('h3', { text: 'Font Weights' });
    const weightsContainer = contentEl.createDiv({ cls: 'font-weights-container' });

    const weightLabels: Record<number, string> = {
      100: 'Thin',
      200: 'Extra Light',
      300: 'Light',
      400: 'Regular',
      500: 'Medium',
      600: 'Semi Bold',
      700: 'Bold',
      800: 'Extra Bold',
      900: 'Black'
    };

    for (const weight of this.availableWeights) {
      const label = weightLabels[weight] || `Weight ${weight}`;
      const checkboxContainer = weightsContainer.createDiv({ cls: 'weight-checkbox' });
      
      const checkbox = checkboxContainer.createEl('input', {
        type: 'checkbox',
        attr: {
          id: `weight-${weight}`,
          checked: true
        }
      });
      
      checkbox.addEventListener('change', (e) => {
        const isChecked = (e.target as HTMLInputElement).checked;
        if (isChecked) {
          this.selectedWeights.add(weight);
        } else {
          this.selectedWeights.delete(weight);
        }
      });

      const labelEl = checkboxContainer.createEl('label', {
        text: `${weight} - ${label}`,
        attr: { for: `weight-${weight}` }
      });
    }

    // Styles Section
    if (this.availableStyles.length > 1) {
      contentEl.createEl('h3', { text: 'Font Styles', cls: 'styles-section-header' });
      const stylesContainer = contentEl.createDiv({ cls: 'font-styles-container' });

      for (const style of this.availableStyles) {
        const styleLabel = style === 'italic' ? 'Italic' : 'Normal';
        const checkboxContainer = stylesContainer.createDiv({ cls: 'style-checkbox' });
        
        const checkbox = checkboxContainer.createEl('input', {
          type: 'checkbox',
          attr: {
            id: `style-${style}`,
            checked: true
          }
        });
        
        checkbox.addEventListener('change', (e) => {
          const isChecked = (e.target as HTMLInputElement).checked;
          if (isChecked) {
            this.selectedStyles.add(style);
          } else {
            this.selectedStyles.delete(style);
          }
        });

        const labelEl = checkboxContainer.createEl('label', {
          text: styleLabel,
          attr: { for: `style-${style}` }
        });
      }
    }

    // Summary
    const summary = contentEl.createDiv({ cls: 'download-summary' });
    const updateSummary = () => {
      const numWeights = this.selectedWeights.size;
      const numStyles = this.selectedStyles.size;
      const total = numWeights * numStyles;
      summary.setText(`Will download: ${total} font file(s) (${numWeights} weight${numWeights !== 1 ? 's' : ''} × ${numStyles} style${numStyles !== 1 ? 's' : ''})`);
    };
    updateSummary();

    // Update summary when selections change
    const allCheckboxes = contentEl.querySelectorAll('input[type="checkbox"]');
    allCheckboxes.forEach(checkbox => {
      checkbox.addEventListener('change', updateSummary);
    });

    // Buttons
    const buttonContainer = contentEl.createDiv({ cls: 'modal-button-container' });

    const cancelBtn = buttonContainer.createEl('button', {
      text: 'Cancel',
      cls: 'mod-default'
    });
    cancelBtn.addEventListener('click', () => {
      this.onCancel();
      this.close();
    });

    const confirmBtn = buttonContainer.createEl('button', {
      text: 'Download',
      cls: 'mod-cta'
    });
    confirmBtn.addEventListener('click', () => {
      this.onConfirm(
        Array.from(this.selectedWeights),
        Array.from(this.selectedStyles)
      );
      this.close();
    });
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
