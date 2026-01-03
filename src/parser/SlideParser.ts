import { 
  Presentation, 
  PresentationFrontmatter, 
  Slide, 
  SlideElement, 
  SlideMetadata, 
  SlideLayout,
  ContentMode,
  ImageData
} from '../types';

export class SlideParser {
  private defaultContentMode: ContentMode = 'ia-presenter';
  private debugMode: boolean = false;

  constructor() {}

  /**
   * Set the default content mode (used when not specified in frontmatter)
   */
  setDefaultContentMode(mode: ContentMode) {
    this.defaultContentMode = mode;
  }
  
  /**
   * Enable or disable debug mode for console logging
   */
  setDebugMode(enabled: boolean) {
    this.debugMode = enabled;
  }
  
  /**
   * Log debug messages if debug mode is enabled
   */
  private debugLog(...args: any[]) {
    if (this.debugMode) {
      console.log(...args);
    }
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
    let elements: SlideElement[] = [];
    const speakerNotes: string[] = [];
    let metadata: SlideMetadata = {};
    
    // Check for per-slide metadata at the start (like iA Presenter content blocks)
    const { slideMetadata, contentLines } = this.extractSlideMetadata(lines);
    metadata = slideMetadata;
    
    // Check if we have an explicit column layout BEFORE extracting metadata
    const hasExplicitColumnLayout = this.hasExplicitColumnLayout(lines);
    
    // Check for no-autocolumn modifier
    const layoutValue = metadata.layout as string;
    const isNoAutocolumn = layoutValue === 'default;no-autocolumn' || layoutValue === 'no-autocolumn';
    
    // Use different parsing strategies based on content mode
    if (contentMode === 'advanced-slides') {
      this.parseSlideAdvancedMode(contentLines, elements, speakerNotes, hasExplicitColumnLayout);
    } else {
      this.parseSlideIAPresenterMode(contentLines, elements, speakerNotes);
    }
    
    // Auto-detect layout if not specified
    const wasLayoutAutoDetected = !metadata.layout;
    if (!metadata.layout) {
      metadata.layout = this.detectLayout(elements);
    }
    
    // Apply auto-column detection for default layout
    // Also apply it when layout was auto-detected as default
    if (metadata.layout === 'default' && !isNoAutocolumn) {
      this.debugLog('Before auto-detection:', elements.map(e => ({ type: e.type, content: e.content.substring(0, 30), columnIndex: e.columnIndex })));
      elements = this.autoDetectColumns(elements, contentLines);
      this.debugLog('After auto-detection:', elements.map(e => ({ type: e.type, content: e.content.substring(0, 30), columnIndex: e.columnIndex })));
    }
    
    // If no-autocolumn was specified, ensure layout is just 'default'
    if (isNoAutocolumn) {
      metadata.layout = 'default';
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
    // Detect column blocks for multi-column layouts (tab-indented only)
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
      
      // Images - visible (both standard markdown and Obsidian wiki-link syntax)
      const imageResult = this.parseImage(line);
      if (imageResult) {
        elements.push(imageResult);
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
    speakerNotes: string[],
    hasExplicitColumnLayout: boolean
  ): void {
    let inSpeakerNotes = false;
    let i = 0;
    let currentColumnIndex = 0;
    
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
        const headingElement: SlideElement = {
          type: 'heading',
          content: headingMatch[2],
          level: headingMatch[1].length,
          visible: true,
          raw: line,
        };
        
        // For explicit column layouts, treat H3 headings as column separators
        if (hasExplicitColumnLayout && headingMatch[1].length === 3) {
          // Increment column index for new column headings (except the first one)
          if (currentColumnIndex > 0 || elements.some(e => e.columnIndex !== undefined)) {
            currentColumnIndex++;
          }
          headingElement.columnIndex = currentColumnIndex;
        }
        
        elements.push(headingElement);
        i++;
        continue;
      }
      
      // Images (both standard markdown and Obsidian wiki-link syntax)
      const imageResult = this.parseImage(line);
      if (imageResult) {
        elements.push(imageResult);
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
        
    this.debugLog(`Starting list at line ${i}: "${line}"`);
        
        while (nextIndex < contentLines.length) {
          const nextLine = contentLines[nextIndex];
          
          // Stop at empty line - this separates list blocks for auto-column detection
          if (nextLine.trim() === '') {
            this.debugLog(`List ended at empty line ${nextIndex}`);
            break;
          }
          
          if (nextLine.match(/^[-*+]\s+/) || nextLine.match(/^\d+\.\s+/)) {
            listItems.push(nextLine);
            nextIndex++;
          } else {
            break;
          }
        }
        
        this.debugLog(`Created list with ${listItems.length} items`);
        
        const listElement: SlideElement = {
          type: 'list',
          content: listItems.join('\n'),
          visible: true,
          raw: listItems.join('\n'),
        };
        
        // Assign to column if using explicit column layout
        if (hasExplicitColumnLayout) {
          listElement.columnIndex = Math.min(currentColumnIndex, 2);
        }
        
        elements.push(listElement);
        i = nextIndex;
        continue;
      }
      
      // Blockquote
      if (line.startsWith('>')) {
        const blockquoteElement: SlideElement = {
          type: 'blockquote',
          content: line.replace(/^>\s*/, ''),
          visible: true,
          raw: line,
        };
        
        // Assign to column if using explicit column layout
        if (hasExplicitColumnLayout) {
          blockquoteElement.columnIndex = Math.min(currentColumnIndex, 2);
        }
        
        elements.push(blockquoteElement);
        i++;
        continue;
      }
      
      // Regular paragraph - visible in Advanced Slides mode
      const paragraphElement: SlideElement = {
        type: 'paragraph',
        content: line,
        visible: true,
        raw: line,
      };
      
      // Assign to column if using explicit column layout
      if (hasExplicitColumnLayout) {
        paragraphElement.columnIndex = Math.min(currentColumnIndex, 2);
      }
      
      elements.push(paragraphElement);
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
  
  /**
   * Check if the slide has an explicit column layout declared
   */
  private hasExplicitColumnLayout(lines: string[]): boolean {
    // Look for layout metadata at the start
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed === '') break;
      
      const layoutMatch = trimmed.match(/^layout:\s*(.+)$/i);
      if (layoutMatch) {
        const layout = layoutMatch[1].trim().toLowerCase();
        return layout.includes('column') || layout.includes('columns');
      }
    }
    return false;
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
        let layoutValue = layoutMatch[1].trim();
        metadata.layout = layoutValue as SlideLayout;
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
        
        // Stop at empty line - this separates list blocks for auto-column detection
        if (nextLine.trim() === '') {
          break;
        }
        
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
  
  /**
   * Auto-detect columns in default layout based on content patterns
   * Returns elements with columnIndex assigned
   */
  private autoDetectColumns(elements: SlideElement[], contentLines?: string[]): SlideElement[] {
    if (elements.length === 0) return elements;
    
    // Check if auto-columns is disabled in raw content
    // Look for no-autocolumn in the original raw content lines
    if (contentLines) {
      const hasNoAutocolumn = contentLines.some(line => 
        line.trim().includes('no-autocolumn') || 
        line.trim().includes('default;no-autocolumn')
      );
      if (hasNoAutocolumn) {
        return elements;
      }
    }
    
    // Group elements by type to detect patterns
    const h3Elements = elements.filter(e => e.type === 'heading' && e.level === 3);
    const h2Elements = elements.filter(e => e.type === 'heading' && e.level === 2);
    
    // Case 1: Multiple H3 headings - use them as column separators
    if (h3Elements.length >= 2) {
      let currentColumn = 0;
      let h3Count = 0;
      return elements.map(e => {
        if (e.type === 'heading' && e.level === 3) {
          // New H3 starts a new column (except the first one)
          if (h3Count > 0) currentColumn++;
          h3Count++;
          e.columnIndex = currentColumn;
        } else if (e.type === 'heading' && e.level !== 3) {
          // Other headings don't belong to columns
          e.columnIndex = undefined;
        } else {
          // Other content belongs to current column
          e.columnIndex = currentColumn;
        }
        return e;
      });
    }
    
    // Case 2: Multiple H2 headings (and no H3s) - use them as column separators
    if (h3Elements.length === 0 && h2Elements.length >= 2) {
      let currentColumn = 0;
      let h2Count = 0;
      return elements.map(e => {
        if (e.type === 'heading' && e.level === 2) {
          // New H2 starts a new column (except the first one)
          if (h2Count > 0) currentColumn++;
          h2Count++;
          e.columnIndex = currentColumn;
        } else if (e.type === 'heading') {
          // Other headings don't belong to columns
          e.columnIndex = undefined;
        } else {
          // Other content belongs to current column
          e.columnIndex = currentColumn;
        }
        return e;
      });
    }
    
    // Case 3: Content blocks separated by empty lines
    if (contentLines) {
      const assignments = this.detectColumnsByEmptyLines(contentLines, elements);
      if (assignments.some(a => a !== undefined)) {
        return elements.map((e, i) => {
          e.columnIndex = assignments[i];
          return e;
        });
      }
    }
    
    return elements;
  }
  
  /**
   * Detect columns based on empty line separations in content
   * Returns an array mapping element indices to column indices
   */
  private detectColumnsByEmptyLines(contentLines: string[], elements: SlideElement[]): number[] {
    const assignments: number[] = new Array(elements.length).fill(undefined);
    let currentColumn = 0;
    let elementIndex = 0;
    let inContentBlock = false;
    let foundFirstBlock = false;
    
    this.debugLog('detectColumnsByEmptyLines called');
    this.debugLog('contentLines:', contentLines);
    this.debugLog('elements:', elements.map((e, i) => ({ 
      index: i, 
      type: e.type, 
      visible: e.visible, 
      content: e.content.substring(0, 30),
      fullContent: e.content,
      raw: e.raw
    })));
    
    // Create a map of content lines to element indices for easier lookup
    const contentToElementMap = new Map<string, number[]>();
    elements.forEach((element, idx) => {
      if (element.visible && (element.type === 'paragraph' || element.type === 'list' || element.type === 'blockquote')) {
        // For lists, store each line separately and track all elements that match
        if (element.type === 'list') {
          const lines = element.content.split('\n');
          lines.forEach(line => {
            const trimmed = line.trim();
            if (!contentToElementMap.has(trimmed)) {
              contentToElementMap.set(trimmed, []);
            }
            contentToElementMap.get(trimmed)!.push(idx);
          });
        } else {
          const trimmed = element.content.trim();
          if (!contentToElementMap.has(trimmed)) {
            contentToElementMap.set(trimmed, []);
          }
          contentToElementMap.get(trimmed)!.push(idx);
        }
      }
    });
    
    this.debugLog('Content to element map:');
    contentToElementMap.forEach((value, key) => {
      this.debugLog(`  "${key}" -> elements [${value.join(', ')}]`);
    });
    
    for (let lineIndex = 0; lineIndex < contentLines.length; lineIndex++) {
      const line = contentLines[lineIndex];
      const trimmed = line.trim();
      
      // Skip empty lines and comments
      if (trimmed === '' || trimmed.startsWith('//')) {
        if (trimmed === '' && inContentBlock) {
          // Empty line ends the current content block
          inContentBlock = false;
        }
        continue;
      }
      
      // Skip headings (they're not part of column content)
      if (trimmed.startsWith('#')) {
        inContentBlock = false;
        continue;
      }
      
      // We have content
      if (!inContentBlock) {
        // Starting a new content block
        if (foundFirstBlock) {
          currentColumn++;
        } else {
          foundFirstBlock = true;
        }
        inContentBlock = true;
      }
      
      // Find the element for this content
      const elementIndices = contentToElementMap.get(trimmed);
      if (elementIndices && elementIndices.length > 0) {
        // Use the first unused element for this content
        let elementIdx = elementIndices[0];
        for (const idx of elementIndices) {
          if (assignments[idx] === undefined) {
            elementIdx = idx;
            break;
          }
        }
        assignments[elementIdx] = Math.min(currentColumn, 2);
        this.debugLog(`Line "${trimmed}" assigned to column ${currentColumn} (element ${elementIdx})`);
      } else if (trimmed !== '' && !trimmed.startsWith('#')) {
        this.debugLog(`No match found for line: "${trimmed}"`);
      }
    }
    
    // Check if we actually detected multiple columns
    const uniqueColumns = new Set(assignments.filter(a => a !== undefined));
    this.debugLog('Final assignments:', assignments);
    this.debugLog('Unique columns detected:', uniqueColumns);
    
    if (uniqueColumns.size <= 1) {
      return new Array(elements.length).fill(undefined);
    }
    
    return assignments;
  }

  /**
   * Check if element content matches a line from the source
   */
  private contentMatchesLine(elementContent: string, line: string): boolean {
    // For lists, check if the line matches the first list item
    if (elementContent.includes('\n')) {
      const firstLine = elementContent.split('\n')[0].trim();
      return firstLine === line.trim();
    }
    return elementContent.trim() === line.trim();
  }

  /**
   * Parse an image from a line (supports standard markdown and Obsidian wiki-link syntax)
   * 
   * Supported formats:
   * - Standard markdown: ![alt](path/to/image.png)
   * - Obsidian wiki-link: ![[image.png]]
   * - Obsidian with alt: ![[image.png|alt text]]
   * - Obsidian with size: ![[image.png|100x200]] or ![[image.png|100]]
   * 
   * Returns null if line is not an image
   */
  private parseImage(line: string): SlideElement | null {
    // Standard markdown image: ![alt](path)
    const markdownMatch = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (markdownMatch) {
      const alt = markdownMatch[1];
      const src = markdownMatch[2];
      
      const imageData: ImageData = {
        src,
        alt: alt || undefined,
        size: 'cover', // Default to cover for presentation slides
        isWikiLink: false,
      };
      
      return {
        type: 'image',
        content: src,
        visible: true,
        raw: line,
        imageData,
      };
    }
    
    // Obsidian wiki-link image: ![[path]] or ![[path|alt]] or ![[path|widthxheight]]
    const wikiLinkMatch = line.match(/^!\[\[([^\]|]+)(?:\|([^\]]*))?\]\]$/);
    if (wikiLinkMatch) {
      const src = wikiLinkMatch[1];
      const modifier = wikiLinkMatch[2]; // Could be alt text or dimensions
      
      let alt: string | undefined;
      
      // Check if modifier is dimensions (e.g., "100" or "100x200")
      if (modifier && !/^\d+(?:x\d+)?$/.test(modifier)) {
        // It's alt text, not dimensions
        alt = modifier;
      }
      
      const imageData: ImageData = {
        src,
        alt,
        size: 'cover', // Default to cover for presentation slides
        isWikiLink: true,
      };
      
      return {
        type: 'image',
        content: src,
        visible: true,
        raw: line,
        imageData,
      };
    }
    
    return null;
  }
}
