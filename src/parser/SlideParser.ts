import { 
  Presentation, 
  PresentationFrontmatter, 
  Slide, 
  SlideElement, 
  SlideMetadata, 
  SlideLayout,
  ContentMode
} from '../types';

export class SlideParser {
  private defaultContentMode: ContentMode = 'ia-presenter';
  
  /**
   * Set the default content mode (used when not specified in frontmatter)
   */
  setDefaultContentMode(mode: ContentMode) {
    this.defaultContentMode = mode;
  }
  
  /**
   * Parse a markdown document into a Presentation
   * 
   * Content Mode determines how slide content vs speaker notes are distinguished:
   * 
   * 'ia-presenter' (iA Presenter style):
   * - `---` separates slides (horizontal rule)
   * - Regular text = speaker notes (not visible on slide)
   * - Headings (#, ##, etc.) = visible on slide
   * - Tab-indented content = visible on slide
   * - `//` at start of line = comment (hidden from all)
   * 
   * 'advanced-slides' (Obsidian Advanced Slides style):
   * - `---` separates slides
   * - All content is visible on slide by default
   * - `note:` on its own line marks the start of speaker notes
   * - Everything after `note:` until next slide is speaker notes
   */
  parse(source: string): Presentation {
    const { frontmatter, content } = this.extractFrontmatter(source);
    const contentMode = frontmatter.contentMode || this.defaultContentMode;
    const slides = this.parseSlides(content, contentMode);
    
    return {
      frontmatter,
      slides,
      source,
    };
  }
  
  private extractFrontmatter(source: string): { frontmatter: PresentationFrontmatter; content: string } {
    const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n/;
    const match = source.match(frontmatterRegex);
    
    if (!match) {
      return { frontmatter: {}, content: source };
    }
    
    const frontmatterStr = match[1];
    const content = source.slice(match[0].length);
    const frontmatter = this.parseFrontmatterYAML(frontmatterStr);
    
    return { frontmatter, content };
  }
  
  private parseFrontmatterYAML(yaml: string): PresentationFrontmatter {
    const frontmatter: PresentationFrontmatter = {};
    const lines = yaml.split('\n');
    
    for (const line of lines) {
      const colonIndex = line.indexOf(':');
      if (colonIndex === -1) continue;
      
      const key = line.slice(0, colonIndex).trim();
      let value = line.slice(colonIndex + 1).trim();
      
      // Remove quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) || 
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      
      // Map YAML keys to frontmatter properties
      const keyMap: Record<string, keyof PresentationFrontmatter> = {
        'title': 'title',
        'author': 'author',
        'date': 'date',
        'theme': 'theme',
        'title-font': 'titleFont',
        'titleFont': 'titleFont',
        'body-font': 'bodyFont',
        'bodyFont': 'bodyFont',
        'accent1': 'accent1',
        'accent2': 'accent2',
        'accent3': 'accent3',
        'accent4': 'accent4',
        'accent5': 'accent5',
        'accent6': 'accent6',
        'light-background': 'lightBackground',
        'lightBackground': 'lightBackground',
        'dark-background': 'darkBackground',
        'darkBackground': 'darkBackground',
        'header-left': 'headerLeft',
        'headerLeft': 'headerLeft',
        'header-middle': 'headerMiddle',
        'headerMiddle': 'headerMiddle',
        'header-right': 'headerRight',
        'headerRight': 'headerRight',
        'footer-left': 'footerLeft',
        'footerLeft': 'footerLeft',
        'footer-middle': 'footerMiddle',
        'footerMiddle': 'footerMiddle',
        'footer-right': 'footerRight',
        'footerRight': 'footerRight',
        'logo': 'logo',
        'logo-size': 'logoSize',
        'logoSize': 'logoSize',
        'aspect-ratio': 'aspectRatio',
        'aspectRatio': 'aspectRatio',
        'show-progress': 'showProgress',
        'showProgress': 'showProgress',
        'show-slide-numbers': 'showSlideNumbers',
        'showSlideNumbers': 'showSlideNumbers',
        'transition': 'transition',
        'content-mode': 'contentMode',
        'contentMode': 'contentMode',
      };
      
      const mappedKey = keyMap[key];
      if (mappedKey) {
        // Handle boolean values
        if (value === 'true') {
          (frontmatter as any)[mappedKey] = true;
        } else if (value === 'false') {
          (frontmatter as any)[mappedKey] = false;
        } else {
          (frontmatter as any)[mappedKey] = value;
        }
      }
    }
    
    return frontmatter;
  }
  
  private parseSlides(content: string, contentMode: ContentMode): Slide[] {
    // Split by horizontal rule (---)
    // Must be at least 3 dashes on their own line
    const slideDelimiter = /\n---+\s*\n/;
    const rawSlides = content.split(slideDelimiter);
    
    return rawSlides
      .map((rawContent, index) => this.parseSlide(rawContent.trim(), index, contentMode))
      .filter(slide => slide.elements.length > 0 || slide.speakerNotes.length > 0);
  }
  
  private parseSlide(rawContent: string, index: number, contentMode: ContentMode): Slide {
    const lines = rawContent.split('\n');
    const elements: SlideElement[] = [];
    const speakerNotes: string[] = [];
    let metadata: SlideMetadata = {};
    
    // Check for per-slide metadata at the start (like iA Presenter content blocks)
    const { slideMetadata, contentLines } = this.extractSlideMetadata(lines);
    metadata = slideMetadata;
    
    // Use different parsing strategies based on content mode
    if (contentMode === 'advanced-slides') {
      this.parseSlideAdvancedMode(contentLines, elements, speakerNotes);
    } else {
      this.parseSlideIAPresenterMode(contentLines, elements, speakerNotes);
    }
    
    // Auto-detect layout if not specified
    if (!metadata.layout) {
      metadata.layout = this.detectLayout(elements);
    }
    
    return {
      index,
      metadata,
      elements,
      speakerNotes,
      rawContent,
    };
  }
  
  /**
   * Parse slide content using iA Presenter mode:
   * - Tab-indented content = visible on slide
   * - Non-indented paragraphs = speaker notes
   * - Headings, images, code blocks = always visible
   */
  private parseSlideIAPresenterMode(
    contentLines: string[], 
    elements: SlideElement[], 
    speakerNotes: string[]
  ): void {
    // Detect column blocks for multi-column layouts
    const columnBlocks = this.detectColumnBlocks(contentLines);
    const hasColumns = columnBlocks.length > 1;
    
    let i = 0;
    let currentColumnIndex = 0;
    let lastWasColumnContent = false;
    
    while (i < contentLines.length) {
      const line = contentLines[i];
      
      // Check if line is truly empty (not starting with tab)
      const isTabIndented = line.startsWith('\t') || line.startsWith('    ');
      const isTrulyEmpty = line.trim() === '' && !isTabIndented;
      
      // Skip truly empty lines but track for column separation
      if (isTrulyEmpty) {
        if (lastWasColumnContent && hasColumns) {
          // Check if next non-empty line is also column content
          let nextI = i + 1;
          while (nextI < contentLines.length && contentLines[nextI].trim() === '' && 
                 !contentLines[nextI].startsWith('\t') && !contentLines[nextI].startsWith('    ')) {
            nextI++;
          }
          if (nextI < contentLines.length) {
            const nextLine = contentLines[nextI];
            if (nextLine.startsWith('\t') || nextLine.startsWith('    ')) {
              currentColumnIndex++;
            }
          }
        }
        lastWasColumnContent = false;
        i++;
        continue;
      }
      
      // Tab-indented empty line - continuation of current column
      if (isTabIndented && line.trim() === '') {
        i++;
        continue;
      }
      
      // Comments (// at start) - skip entirely
      if (line.trim().startsWith('//')) {
        i++;
        continue;
      }
      
      // Kicker (^text)
      const kickerMatch = line.match(/^\^(.+)$/);
      if (kickerMatch) {
        elements.push({
          type: 'kicker',
          content: kickerMatch[1].trim(),
          visible: true,
          raw: line,
        });
        i++;
        lastWasColumnContent = false;
        continue;
      }
      
      // Headings - always visible
      // If followed by tab-indented content, assign to current column
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        // Check if next non-empty line is tab-indented (column content)
        let nextI = i + 1;
        while (nextI < contentLines.length && contentLines[nextI].trim() === '') {
          nextI++;
        }
        const nextIsColumnContent = nextI < contentLines.length && 
          (contentLines[nextI].startsWith('\t') || contentLines[nextI].startsWith('    '));
        
        const headingElement: SlideElement = {
          type: 'heading',
          content: headingMatch[2],
          level: headingMatch[1].length,
          visible: true,
          raw: line,
        };
        
        // If this heading precedes column content, assign it to that column
        if (hasColumns && nextIsColumnContent) {
          headingElement.columnIndex = Math.min(currentColumnIndex, 2);
        }
        
        elements.push(headingElement);
        i++;
        lastWasColumnContent = false;
        continue;
      }
      
      // Tab-indented content - visible (potential column content)
      if (isTabIndented) {
        const unindentedLine = line.replace(/^(\t|    )/, '');
        const element = this.parseElement(unindentedLine, contentLines, i, true);
        
        if (hasColumns) {
          element.element.columnIndex = Math.min(currentColumnIndex, 2);
        }
        
        elements.push(element.element);
        i = element.nextIndex;
        lastWasColumnContent = true;
        continue;
      }
      
      // Images - visible
      const imageMatch = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
      if (imageMatch) {
        elements.push({
          type: 'image',
          content: imageMatch[2],
          visible: true,
          raw: line,
        });
        i++;
        lastWasColumnContent = false;
        continue;
      }
      
      // Code blocks - visible
      if (line.startsWith('```')) {
        const codeBlock = this.parseCodeBlock(contentLines, i);
        elements.push({
          type: 'code',
          content: codeBlock.content,
          visible: true,
          raw: codeBlock.raw,
        });
        i = codeBlock.nextIndex;
        lastWasColumnContent = false;
        continue;
      }
      
      // Tables - visible
      if (line.includes('|') && line.trim().startsWith('|')) {
        const table = this.parseTable(contentLines, i);
        elements.push({
          type: 'table',
          content: table.content,
          visible: true,
          raw: table.raw,
        });
        i = table.nextIndex;
        lastWasColumnContent = false;
        continue;
      }
      
      // Math blocks - visible
      if (line.startsWith('$$')) {
        const mathBlock = this.parseMathBlock(contentLines, i);
        elements.push({
          type: 'math',
          content: mathBlock.content,
          visible: true,
          raw: mathBlock.raw,
        });
        i = mathBlock.nextIndex;
        lastWasColumnContent = false;
        continue;
      }
      
      // Regular paragraph - speaker notes (not visible in iA Presenter mode)
      speakerNotes.push(line);
      i++;
      lastWasColumnContent = false;
    }
  }
  
  /**
   * Parse slide content using Advanced Slides mode:
   * - All content is visible by default
   * - `note:` on its own line marks the start of speaker notes
   * - Everything after `note:` is speaker notes
   */
  private parseSlideAdvancedMode(
    contentLines: string[], 
    elements: SlideElement[], 
    speakerNotes: string[]
  ): void {
    let inSpeakerNotes = false;
    let i = 0;
    
    while (i < contentLines.length) {
      const line = contentLines[i];
      
      // Check for note: marker (case-insensitive, can have whitespace)
      if (line.trim().toLowerCase() === 'note:' || line.trim().toLowerCase() === 'notes:') {
        inSpeakerNotes = true;
        i++;
        continue;
      }
      
      // If we're in speaker notes section, add to notes
      if (inSpeakerNotes) {
        if (line.trim() !== '') {
          speakerNotes.push(line);
        }
        i++;
        continue;
      }
      
      // Skip empty lines
      if (line.trim() === '') {
        i++;
        continue;
      }
      
      // Comments (// at start) - skip entirely
      if (line.trim().startsWith('//')) {
        i++;
        continue;
      }
      
      // Kicker (^text)
      const kickerMatch = line.match(/^\^(.+)$/);
      if (kickerMatch) {
        elements.push({
          type: 'kicker',
          content: kickerMatch[1].trim(),
          visible: true,
          raw: line,
        });
        i++;
        continue;
      }
      
      // Headings
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        elements.push({
          type: 'heading',
          content: headingMatch[2],
          level: headingMatch[1].length,
          visible: true,
          raw: line,
        });
        i++;
        continue;
      }
      
      // Images
      const imageMatch = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
      if (imageMatch) {
        elements.push({
          type: 'image',
          content: imageMatch[2],
          visible: true,
          raw: line,
        });
        i++;
        continue;
      }
      
      // Code blocks
      if (line.startsWith('```')) {
        const codeBlock = this.parseCodeBlock(contentLines, i);
        elements.push({
          type: 'code',
          content: codeBlock.content,
          visible: true,
          raw: codeBlock.raw,
        });
        i = codeBlock.nextIndex;
        continue;
      }
      
      // Tables
      if (line.includes('|') && line.trim().startsWith('|')) {
        const table = this.parseTable(contentLines, i);
        elements.push({
          type: 'table',
          content: table.content,
          visible: true,
          raw: table.raw,
        });
        i = table.nextIndex;
        continue;
      }
      
      // Math blocks
      if (line.startsWith('$$')) {
        const mathBlock = this.parseMathBlock(contentLines, i);
        elements.push({
          type: 'math',
          content: mathBlock.content,
          visible: true,
          raw: mathBlock.raw,
        });
        i = mathBlock.nextIndex;
        continue;
      }
      
      // Lists
      const listMatch = line.match(/^[-*+]\s+(.+)$/) || line.match(/^\d+\.\s+(.+)$/);
      if (listMatch) {
        const listItems: string[] = [line];
        let nextIndex = i + 1;
        
        while (nextIndex < contentLines.length) {
          const nextLine = contentLines[nextIndex];
          if (nextLine.match(/^[-*+]\s+/) || nextLine.match(/^\d+\.\s+/)) {
            listItems.push(nextLine);
            nextIndex++;
          } else {
            break;
          }
        }
        
        elements.push({
          type: 'list',
          content: listItems.join('\n'),
          visible: true,
          raw: listItems.join('\n'),
        });
        i = nextIndex;
        continue;
      }
      
      // Blockquote
      if (line.startsWith('>')) {
        elements.push({
          type: 'blockquote',
          content: line.replace(/^>\s*/, ''),
          visible: true,
          raw: line,
        });
        i++;
        continue;
      }
      
      // Regular paragraph - visible in Advanced Slides mode
      elements.push({
        type: 'paragraph',
        content: line,
        visible: true,
        raw: line,
      });
      i++;
    }
  }
  
  /**
   * Detect column blocks in slide content.
   * Column blocks are groups of tab-indented content separated by truly empty lines
   * (lines that don't start with a tab). Tab-indented empty lines are part of the current block.
   */
  private detectColumnBlocks(lines: string[]): string[][] {
    const blocks: string[][] = [];
    let currentBlock: string[] = [];
    let inTabContent = false;
    
    for (const line of lines) {
      const isTabIndented = line.startsWith('\t') || line.startsWith('    ');
      const isEmpty = line.trim() === '';
      const isTrulyEmpty = isEmpty && !isTabIndented;
      
      if (isTabIndented) {
        // Tab-indented content (including empty tab-indented lines) - part of current block
        currentBlock.push(line);
        inTabContent = true;
      } else if (isTrulyEmpty && inTabContent) {
        // Truly empty line (no tab) while in tab content - end of column block
        if (currentBlock.length > 0) {
          blocks.push(currentBlock);
          currentBlock = [];
        }
        inTabContent = false;
      } else {
        // Non-tab, non-empty content - not column content
        inTabContent = false;
      }
    }
    
    // Don't forget the last block
    if (currentBlock.length > 0) {
      blocks.push(currentBlock);
    }
    
    return blocks;
  }
  
  private extractSlideMetadata(lines: string[]): { slideMetadata: SlideMetadata; contentLines: string[] } {
    const metadata: SlideMetadata = {};
    let startIndex = 0;
    
    // Look for metadata at the start of the slide
    // Format: key: value (similar to iA Presenter content blocks)
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Empty line ends metadata section
      if (line === '') {
        startIndex = i + 1;
        break;
      }
      
      // Check for metadata patterns
      const layoutMatch = line.match(/^layout:\s*(.+)$/i);
      if (layoutMatch) {
        metadata.layout = layoutMatch[1].trim() as SlideLayout;
        startIndex = i + 1;
        continue;
      }
      
      const backgroundMatch = line.match(/^background:\s*(.+)$/i);
      if (backgroundMatch) {
        metadata.background = backgroundMatch[1].trim();
        startIndex = i + 1;
        continue;
      }
      
      const opacityMatch = line.match(/^opacity:\s*(\d+)%?$/i);
      if (opacityMatch) {
        metadata.backgroundOpacity = parseInt(opacityMatch[1]) / 100;
        startIndex = i + 1;
        continue;
      }
      
      const modeMatch = line.match(/^mode:\s*(light|dark)$/i);
      if (modeMatch) {
        metadata.mode = modeMatch[1].toLowerCase() as 'light' | 'dark';
        startIndex = i + 1;
        continue;
      }
      
      const classMatch = line.match(/^class:\s*(.+)$/i);
      if (classMatch) {
        metadata.class = classMatch[1].trim();
        startIndex = i + 1;
        continue;
      }
      
      const filterMatch = line.match(/^filter:\s*(darken|lighten|blur|none)$/i);
      if (filterMatch) {
        metadata.backgroundFilter = filterMatch[1].toLowerCase() as 'darken' | 'lighten' | 'blur' | 'none';
        startIndex = i + 1;
        continue;
      }
      
      // If line doesn't match any metadata pattern, stop looking
      if (!line.includes(':') || line.startsWith('#')) {
        break;
      }
    }
    
    return {
      slideMetadata: metadata,
      contentLines: lines.slice(startIndex),
    };
  }
  
  private parseElement(
    line: string, 
    allLines: string[], 
    currentIndex: number,
    visible: boolean
  ): { element: SlideElement; nextIndex: number } {
    // List item
    const listMatch = line.match(/^[-*+]\s+(.+)$/) || line.match(/^\d+\.\s+(.+)$/);
    if (listMatch) {
      const listItems: string[] = [line];
      let nextIndex = currentIndex + 1;
      
      while (nextIndex < allLines.length) {
        const nextLine = allLines[nextIndex];
        const isIndented = nextLine.startsWith('\t') || nextLine.startsWith('    ');
        const unindented = nextLine.replace(/^(\t|    )/, '');
        
        if (isIndented && (unindented.match(/^[-*+]\s+/) || unindented.match(/^\d+\.\s+/))) {
          listItems.push(unindented);
          nextIndex++;
        } else {
          break;
        }
      }
      
      return {
        element: {
          type: 'list',
          content: listItems.join('\n'),
          visible,
          raw: listItems.join('\n'),
        },
        nextIndex,
      };
    }
    
    // Blockquote
    if (line.startsWith('>')) {
      return {
        element: {
          type: 'blockquote',
          content: line.replace(/^>\s*/, ''),
          visible,
          raw: line,
        },
        nextIndex: currentIndex + 1,
      };
    }
    
    // Default: paragraph
    return {
      element: {
        type: 'paragraph',
        content: line,
        visible,
        raw: line,
      },
      nextIndex: currentIndex + 1,
    };
  }
  
  private parseCodeBlock(lines: string[], startIndex: number): { content: string; raw: string; nextIndex: number } {
    const firstLine = lines[startIndex];
    const language = firstLine.replace(/^```/, '').trim();
    const codeLines: string[] = [];
    let i = startIndex + 1;
    
    while (i < lines.length && !lines[i].startsWith('```')) {
      codeLines.push(lines[i]);
      i++;
    }
    
    const content = language ? `${language}\n${codeLines.join('\n')}` : codeLines.join('\n');
    const raw = lines.slice(startIndex, i + 1).join('\n');
    
    return { content, raw, nextIndex: i + 1 };
  }
  
  private parseTable(lines: string[], startIndex: number): { content: string; raw: string; nextIndex: number } {
    const tableLines: string[] = [];
    let i = startIndex;
    
    while (i < lines.length && lines[i].includes('|')) {
      tableLines.push(lines[i]);
      i++;
    }
    
    return {
      content: tableLines.join('\n'),
      raw: tableLines.join('\n'),
      nextIndex: i,
    };
  }
  
  private parseMathBlock(lines: string[], startIndex: number): { content: string; raw: string; nextIndex: number } {
    const mathLines: string[] = [lines[startIndex]];
    let i = startIndex + 1;
    
    // If starts with $$, look for closing $$
    if (lines[startIndex].trim() === '$$') {
      while (i < lines.length && lines[i].trim() !== '$$') {
        mathLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) {
        mathLines.push(lines[i]);
        i++;
      }
    }
    
    return {
      content: mathLines.join('\n').replace(/^\$\$|\$\$$/g, '').trim(),
      raw: mathLines.join('\n'),
      nextIndex: i,
    };
  }
  
  /**
   * Auto-detect layout based on slide content
   * 
   * Detection priority:
   * 1. Column content → default (auto-columns)
   * 2. Images only → full-image
   * 3. Image + text → half-image
   * 4. H1/H2 with minimal content → title
   * 5. Single H3 → section
   * 6. Otherwise → default
   */
  private detectLayout(elements: SlideElement[]): SlideLayout {
    const headings = elements.filter(e => e.type === 'heading');
    const images = elements.filter(e => e.type === 'image');
    const visibleContent = elements.filter(e => e.visible);
    const textContent = visibleContent.filter(e => e.type !== 'image');
    
    // Check for column content - use 'default' which auto-detects columns
    const columnElements = elements.filter(e => e.columnIndex !== undefined);
    if (columnElements.length > 0) {
      // Default layout handles auto-column detection
      return 'default';
    }
    
    // Full image: only image(s), no text content
    if (images.length > 0 && textContent.length === 0) {
      return 'full-image';
    }
    
    // Half-image: images and text together
    if (images.length > 0 && textContent.length > 0) {
      return 'half-image';
    }
    
    // Title: H1 or H2 with minimal content (1-2 elements)
    if (headings.length > 0 && headings[0].level && headings[0].level <= 2) {
      if (visibleContent.length <= 2) {
        return 'title';
      }
    }
    
    // Section: single H3 with minimal content
    if (headings.length === 1 && headings[0].level === 3 && visibleContent.length <= 2) {
      return 'section';
    }
    
    // Default layout (handles everything else, including auto-column detection)
    return 'default';
  }
}
