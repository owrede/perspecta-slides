import { 
  Presentation, 
  PresentationFrontmatter, 
  Slide, 
  SlideElement, 
  SlideMetadata, 
  SlideLayout 
} from '../types';

export class SlideParser {
  
  /**
   * Parse a markdown document into a Presentation
   * Following iA Presenter conventions:
   * - `---` separates slides (horizontal rule)
   * - Regular text = speaker notes (not visible on slide)
   * - Headings (#, ##, etc.) = visible on slide
   * - Tab-indented content = visible on slide
   * - `//` at start of line = comment (hidden from all)
   */
  parse(source: string): Presentation {
    const { frontmatter, content } = this.extractFrontmatter(source);
    const slides = this.parseSlides(content);
    
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
  
  private parseSlides(content: string): Slide[] {
    // Split by horizontal rule (---)
    // Must be at least 3 dashes on their own line
    const slideDelimiter = /\n---+\s*\n/;
    const rawSlides = content.split(slideDelimiter);
    
    return rawSlides
      .map((rawContent, index) => this.parseSlide(rawContent.trim(), index))
      .filter(slide => slide.elements.length > 0 || slide.speakerNotes.length > 0);
  }
  
  private parseSlide(rawContent: string, index: number): Slide {
    const lines = rawContent.split('\n');
    const elements: SlideElement[] = [];
    const speakerNotes: string[] = [];
    let metadata: SlideMetadata = {};
    
    // Check for per-slide metadata at the start (like iA Presenter content blocks)
    const { slideMetadata, contentLines } = this.extractSlideMetadata(lines);
    metadata = slideMetadata;
    
    let i = 0;
    while (i < contentLines.length) {
      const line = contentLines[i];
      
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
      
      // Headings - always visible on slide
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        const level = headingMatch[1].length;
        const content = headingMatch[2];
        elements.push({
          type: 'heading',
          content,
          level,
          visible: true,
          raw: line,
        });
        i++;
        continue;
      }
      
      // Tab-indented content - visible on slide
      if (line.startsWith('\t') || line.startsWith('    ')) {
        const unindentedLine = line.replace(/^(\t|    )/, '');
        const element = this.parseElement(unindentedLine, contentLines, i, true);
        elements.push(element.element);
        i = element.nextIndex;
        continue;
      }
      
      // Images - visible on slide
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
          visible: true, // Code blocks are typically visible
          raw: codeBlock.raw,
        });
        i = codeBlock.nextIndex;
        continue;
      }
      
      // Tables - visible on slide if tab-indented or detected
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
      
      // Regular paragraph - speaker notes (not visible)
      speakerNotes.push(line);
      i++;
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
  
  private detectLayout(elements: SlideElement[]): SlideLayout {
    const headings = elements.filter(e => e.type === 'heading');
    const images = elements.filter(e => e.type === 'image');
    const visibleContent = elements.filter(e => e.visible);
    
    // Full image: only image(s), no text
    if (images.length > 0 && headings.length === 0 && visibleContent.length === images.length) {
      return 'full-image';
    }
    
    // Title: H1 or H2 with minimal content
    if (headings.length > 0 && headings[0].level && headings[0].level <= 2) {
      if (visibleContent.length <= 2) {
        return 'title';
      }
    }
    
    // Section: single H3 with minimal content
    if (headings.length === 1 && headings[0].level === 3 && visibleContent.length <= 2) {
      return 'section';
    }
    
    // Caption: image with text below
    if (images.length === 1 && visibleContent.length > 1) {
      return 'caption';
    }
    
    // V-split: image and text side by side (detected by presence of both)
    if (images.length > 0 && headings.length > 0) {
      return 'v-split';
    }
    
    // Grid: multiple images
    if (images.length > 1) {
      return 'grid';
    }
    
    // Default layout
    return 'default';
  }
}
