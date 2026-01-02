import { Presentation, Slide, SlideElement, PresentationFrontmatter, Theme, SlideLayout } from '../types';
import { generateThemeCSS } from '../themes';

/**
 * SlideRenderer - Renders presentations to HTML
 * 
 * Uses iA Presenter-compatible container/layout class pattern:
 * - Container class (e.g., .cover-container, .section-container) on outer element
 * - Layout class (e.g., .layout-cover, .layout-section) on content
 * - Light/dark appearance classes
 */
export class SlideRenderer {
  private presentation: Presentation;
  private theme: Theme | null = null;
  
  constructor(presentation: Presentation, theme?: Theme) {
    this.presentation = presentation;
    this.theme = theme || null;
  }

  /**
   * Get the container class for a layout (iA Presenter pattern)
   */
  private getContainerClass(layout: SlideLayout): string {
    switch (layout) {
      case 'cover': return 'cover-container';
      case 'title': return 'title-container';
      case 'section': return 'section-container';
      case 'full-image': return 'image-container';
      case 'half-image': return 'split-container';
      case 'caption': return 'caption-container';
      case 'grid': return 'grid-container';
      case '1-column':
      case '2-columns':
      case '3-columns':
      case '2-columns-1+2':
      case '2-columns-2+1':
        return 'columns-container';
      default: return 'default-container';
    }
  }

  /**
   * Render a slide thumbnail as HTML for embedding in an iframe
   */
  renderThumbnailHTML(slide: Slide, index: number): string {
    return this.renderSingleSlideHTML(slide, index, this.presentation.frontmatter);
  }
  
  /**
   * Render a single slide to standalone HTML (for thumbnails/iframes)
   */
  renderSingleSlideHTML(slide: Slide, index: number, frontmatter: PresentationFrontmatter): string {
    const themeClasses = this.theme?.template.CssClasses || '';
    const themeCSS = this.theme ? generateThemeCSS(this.theme) : '';
    
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>${this.getBaseStyles()}</style>
  <style>${themeCSS}</style>
</head>
<body class="perspecta-thumbnail ${themeClasses}">
  ${this.renderSlide(slide, index, frontmatter)}
</body>
</html>`;
  }
  
  /**
   * Render full presentation to HTML
   */
  renderHTML(): string {
    const { frontmatter, slides } = this.presentation;
    
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="viewport-fit=cover, width=device-width, height=device-height, initial-scale=1" />
  <title>${this.escapeHtml(frontmatter.title || 'Presentation')}</title>
  ${this.renderStyles(frontmatter)}
</head>
<body class="perspecta-slides transition-${frontmatter.transition || 'fade'}">
  <div class="reveal">
    <div class="slides">
      ${slides.map((slide, index) => this.renderSlide(slide, index, frontmatter)).join('\n')}
    </div>
  </div>
  ${this.renderScripts()}
</body>
</html>`;
  }

  // ============================================
  // SLIDE RENDERING
  // ============================================
  
  private renderSlide(slide: Slide, index: number, frontmatter: PresentationFrontmatter): string {
    const mode = slide.metadata.mode || 'light';
    const layout = (slide.metadata.layout || 'default') as SlideLayout;
    const containerClass = this.getContainerClass(layout);
    const customClass = slide.metadata.class || '';
    const isActive = index === 0 ? 'active' : '';
    
    let backgroundStyle = '';
    if (slide.metadata.background) {
      const opacity = slide.metadata.backgroundOpacity ?? 1;
      backgroundStyle = `background-image: url('${slide.metadata.background}'); background-size: cover; background-position: center;`;
      if (opacity < 1) {
        backgroundStyle += ` opacity: ${opacity};`;
      }
    }
    
    return `
    <section class="slide ${containerClass} ${mode} ${customClass} ${isActive}" data-index="${index}">
      ${backgroundStyle ? `<div class="slide-background" style="${backgroundStyle}"></div>` : ''}
      ${this.renderHeader(frontmatter, index)}
      <div class="slide-body">
        <div class="slide-content layout-${layout}">
          ${this.renderSlideContent(slide, layout)}
        </div>
      </div>
      ${this.renderFooter(frontmatter, index, this.presentation.slides.length)}
      ${slide.speakerNotes.length > 0 ? `<aside class="speaker-notes">${slide.speakerNotes.map(n => this.renderMarkdown(n)).join('<br>')}</aside>` : ''}
    </section>`;
  }

  // ============================================
  // LAYOUT TEMPLATES
  // ============================================
  
  private renderSlideContent(slide: Slide, layout: string): string {
    const elements = slide.elements.filter(e => e.visible);
    const images = elements.filter(e => e.type === 'image');
    const textElements = elements.filter(e => e.type !== 'image');
    const headings = elements.filter(e => e.type === 'heading' || e.type === 'kicker');
    const bodyElements = elements.filter(e => e.type !== 'heading' && e.type !== 'kicker' && e.type !== 'image');
    
    switch (layout as SlideLayout) {
      // ==================
      // STANDARD SLIDES
      // ==================
      
      case 'cover':
        return this.renderCoverLayout(elements);
      
      case 'title':
        return this.renderTitleLayout(elements);
        
      case 'section':
        return this.renderSectionLayout(elements);
        
      case 'default':
        return this.renderDefaultLayout(elements);
      
      // ==================
      // TEXT SLIDES
      // ==================
      
      case '1-column':
        return this.renderColumnLayout(elements, 1);
        
      case '2-columns':
        return this.renderColumnLayout(elements, 2, 'equal');
        
      case '3-columns':
        return this.renderColumnLayout(elements, 3, 'equal');
        
      case '2-columns-1+2':
        return this.renderColumnLayout(elements, 2, 'narrow-wide');
        
      case '2-columns-2+1':
        return this.renderColumnLayout(elements, 2, 'wide-narrow');
      
      // ==================
      // IMAGE SLIDES
      // ==================
      
      case 'full-image':
        return this.renderFullImageLayout(images);
        
      case 'caption':
        return this.renderCaptionLayout(headings, images, bodyElements);
        
      case 'half-image':
        return this.renderHalfImageLayout(elements, images, textElements);
        
      default:
        return this.renderDefaultLayout(elements);
    }
  }

  // ==================
  // STANDARD LAYOUTS
  // ==================
  
  /**
   * Cover Layout: Opening slide with centered content (iA Presenter compatible)
   */
  private renderCoverLayout(elements: SlideElement[]): string {
    return elements.map(e => this.renderElement(e)).join('\n');
  }
  
  /**
   * Title Layout: Centered content with large headings
   */
  private renderTitleLayout(elements: SlideElement[]): string {
    return elements.map(e => this.renderElement(e)).join('\n');
  }
  
  /**
   * Section Layout: Accent background, centered heading
   */
  private renderSectionLayout(elements: SlideElement[]): string {
    return elements.map(e => this.renderElement(e)).join('\n');
  }
  
  /**
   * Default Layout: Auto-detects columns based on columnIndex
   */
  private renderDefaultLayout(elements: SlideElement[]): string {
    const columnElements = elements.filter(e => e.columnIndex !== undefined);
    const nonColumnElements = elements.filter(e => e.columnIndex === undefined);
    
    // If no column elements, render as single column
    if (columnElements.length === 0) {
      return elements.map(e => this.renderElement(e)).join('\n');
    }
    
    // Auto-detect column count
    const maxColumnIndex = Math.max(...columnElements.map(e => e.columnIndex ?? 0));
    const columnCount = Math.min(maxColumnIndex + 1, 3); // Max 3 columns
    
    // Group elements by column
    const columns: SlideElement[][] = Array.from({ length: columnCount }, () => []);
    columnElements.forEach(e => {
      const idx = Math.min(e.columnIndex ?? 0, columnCount - 1);
      columns[idx].push(e);
    });
    
    return `
      <div class="slot-header">
        ${nonColumnElements.map(e => this.renderElement(e)).join('\n')}
      </div>
      <div class="slot-columns columns-${columnCount}">
        ${columns.map((col, i) => `
          <div class="column" data-column="${i + 1}">
            ${col.map(e => this.renderElement(e)).join('\n')}
          </div>
        `).join('\n')}
      </div>`;
  }

  // ==================
  // TEXT LAYOUTS
  // ==================
  
  /**
   * Column Layout: Explicit column control
   * @param elements All visible elements
   * @param columnCount Number of visual columns (1, 2, or 3)
   * @param ratio Column ratio: 'equal', 'narrow-wide' (1/3+2/3), 'wide-narrow' (2/3+1/3)
   */
  private renderColumnLayout(
    elements: SlideElement[], 
    columnCount: number, 
    ratio: 'equal' | 'narrow-wide' | 'wide-narrow' = 'equal'
  ): string {
    const columnElements = elements.filter(e => e.columnIndex !== undefined);
    const nonColumnElements = elements.filter(e => e.columnIndex === undefined);
    
    // Find how many data columns exist
    const maxDataColumn = columnElements.reduce((max, e) => 
      Math.max(max, e.columnIndex ?? 0), -1);
    const dataColumnCount = maxDataColumn + 1;
    
    // Group elements into visual columns, merging overflow into last column
    const columns: SlideElement[][] = Array.from({ length: columnCount }, () => []);
    columnElements.forEach(e => {
      let targetCol = e.columnIndex ?? 0;
      if (dataColumnCount > columnCount && targetCol >= columnCount - 1) {
        targetCol = columnCount - 1; // Merge into last column
      }
      columns[Math.min(targetCol, columnCount - 1)].push(e);
    });
    
    // If no column elements, distribute non-column body elements
    if (columnElements.length === 0) {
      const bodyElements = nonColumnElements.filter(e => 
        e.type !== 'heading' && e.type !== 'kicker');
      const headerElements = nonColumnElements.filter(e => 
        e.type === 'heading' || e.type === 'kicker');
      
      return `
        <div class="slide-content column-content">
          <div class="slot-header">
            ${headerElements.map(e => this.renderElement(e)).join('\n')}
          </div>
          <div class="slot-columns columns-${columnCount} ratio-${ratio}">
            <div class="column" data-column="1">
              ${bodyElements.map(e => this.renderElement(e)).join('\n')}
            </div>
            ${Array.from({ length: columnCount - 1 }, (_, i) => `
              <div class="column" data-column="${i + 2}"></div>
            `).join('\n')}
          </div>
        </div>`;
    }
    
    return `
      <div class="slide-content column-content">
        <div class="slot-header">
          ${nonColumnElements.map(e => this.renderElement(e)).join('\n')}
        </div>
        <div class="slot-columns columns-${columnCount} ratio-${ratio}">
          ${columns.map((col, i) => `
            <div class="column" data-column="${i + 1}">
              ${col.map(e => this.renderElement(e)).join('\n')}
            </div>
          `).join('\n')}
        </div>
      </div>`;
  }

  // ==================
  // IMAGE LAYOUTS
  // ==================
  
  /**
   * Full Image Layout: Images fill the entire slide
   * Multiple images split the space equally
   */
  private renderFullImageLayout(images: SlideElement[]): string {
    if (images.length === 0) {
      return `<div class="slide-content full-image-content empty">No images</div>`;
    }
    
    const direction = images.length <= 2 ? 'horizontal' : 'grid';
    
    return `
      <div class="slide-content full-image-content split-${direction} count-${images.length}">
        ${images.map(img => `
          <div class="image-slot">
            <img src="${this.escapeHtml(img.content)}" alt="" />
          </div>
        `).join('\n')}
      </div>`;
  }
  
  /**
   * Caption Layout: Full image with title bar at top, optional caption at bottom
   */
  private renderCaptionLayout(
    headings: SlideElement[], 
    images: SlideElement[], 
    bodyElements: SlideElement[]
  ): string {
    return `
      <div class="slide-content caption-content">
        <div class="slot-title-bar">
          ${headings.map(e => this.renderElement(e)).join('\n')}
        </div>
        <div class="slot-image">
          ${images.map(img => `
            <div class="image-slot">
              <img src="${this.escapeHtml(img.content)}" alt="" />
            </div>
          `).join('\n')}
        </div>
        ${bodyElements.length > 0 ? `
          <div class="slot-caption">
            ${bodyElements.map(e => this.renderElement(e)).join('\n')}
          </div>
        ` : ''}
      </div>`;
  }
  
  /**
   * Half Image Layout: Half for images, half for text
   * Image position based on content order
   */
  private renderHalfImageLayout(
    allElements: SlideElement[],
    images: SlideElement[], 
    textElements: SlideElement[]
  ): string {
    // Determine if images come first (image on left) or text comes first (image on right)
    const firstElement = allElements[0];
    const imageFirst = firstElement?.type === 'image';
    
    const imageContent = images.map(img => `
      <div class="image-slot">
        <img src="${this.escapeHtml(img.content)}" alt="" />
      </div>
    `).join('\n');
    
    const textContent = textElements.map(e => this.renderElement(e)).join('\n');
    
    if (imageFirst) {
      return `
        <div class="slide-content half-image-content image-left">
          <div class="slot-image">
            ${imageContent}
          </div>
          <div class="slot-text">
            ${textContent}
          </div>
        </div>`;
    } else {
      return `
        <div class="slide-content half-image-content image-right">
          <div class="slot-text">
            ${textContent}
          </div>
          <div class="slot-image">
            ${imageContent}
          </div>
        </div>`;
    }
  }

  // ============================================
  // ELEMENT RENDERING
  // ============================================
  
  private renderElement(element: SlideElement): string {
    switch (element.type) {
      case 'heading':
        const level = element.level || 1;
        return `<h${level}>${this.renderMarkdown(element.content)}</h${level}>`;
        
      case 'paragraph':
        return `<p>${this.renderMarkdown(element.content)}</p>`;
        
      case 'list':
        return this.renderList(element.content);
        
      case 'blockquote':
        return `<blockquote>${this.renderMarkdown(element.content)}</blockquote>`;
        
      case 'image':
        return `<figure><img src="${this.escapeHtml(element.content)}" alt="" /></figure>`;
        
      case 'code':
        const lines = element.content.split('\n');
        const language = lines[0] || '';
        const code = lines.slice(1).join('\n') || element.content;
        return `<pre><code class="language-${language}">${this.escapeHtml(code)}</code></pre>`;
        
      case 'table':
        return this.renderTable(element.content);
        
      case 'math':
        return `<div class="math-block">${this.escapeHtml(element.content)}</div>`;
        
      case 'kicker':
        return `<div class="kicker">${this.renderMarkdown(element.content)}</div>`;
        
      default:
        return `<p>${this.renderMarkdown(element.content)}</p>`;
    }
  }
  
  private renderList(content: string): string {
    const lines = content.split('\n');
    const isOrdered = /^\d+\./.test(lines[0]);
    const tag = isOrdered ? 'ol' : 'ul';
    
    const items = lines.map(line => {
      const text = line.replace(/^[-*+]\s+/, '').replace(/^\d+\.\s+/, '');
      return `<li>${this.renderMarkdown(text)}</li>`;
    }).join('\n');
    
    return `<${tag}>${items}</${tag}>`;
  }
  
  private renderTable(content: string): string {
    const lines = content.split('\n').filter(l => l.trim());
    if (lines.length < 2) return '';
    
    const headerCells = lines[0].split('|').filter(c => c.trim()).map(c => c.trim());
    const bodyLines = lines.slice(2);
    
    const header = `<tr>${headerCells.map(c => `<th>${this.renderMarkdown(c)}</th>`).join('')}</tr>`;
    const body = bodyLines.map(line => {
      const cells = line.split('|').filter(c => c.trim()).map(c => c.trim());
      return `<tr>${cells.map(c => `<td>${this.renderMarkdown(c)}</td>`).join('')}</tr>`;
    }).join('\n');
    
    return `<table><thead>${header}</thead><tbody>${body}</tbody></table>`;
  }
  
  private renderMarkdown(text: string): string {
    let html = this.escapeHtml(text);
    
    // Bold
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
    
    // Italic
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    html = html.replace(/_(.+?)_/g, '<em>$1</em>');
    
    // Highlight
    html = html.replace(/==(.+?)==/g, '<mark>$1</mark>');
    
    // Inline code
    html = html.replace(/`(.+?)`/g, '<code>$1</code>');
    
    // Links
    html = html.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');
    
    return html;
  }
  
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ============================================
  // HEADER / FOOTER
  // ============================================
  
  private renderHeader(frontmatter: PresentationFrontmatter, index: number): string {
    if (!frontmatter.headerLeft && !frontmatter.headerMiddle && !frontmatter.headerRight) {
      return '';
    }
    
    return `
      <header class="slide-header">
        <div class="header-left">${frontmatter.headerLeft || ''}</div>
        <div class="header-middle">${frontmatter.headerMiddle || ''}</div>
        <div class="header-right">${frontmatter.headerRight || ''}</div>
      </header>`;
  }
  
  private renderFooter(frontmatter: PresentationFrontmatter, index: number, total: number): string {
    const showNumbers = frontmatter.showSlideNumbers !== false;
    
    return `
      <footer class="slide-footer">
        <div class="footer-left">${frontmatter.footerLeft || ''}</div>
        <div class="footer-middle">${frontmatter.footerMiddle || ''}</div>
        <div class="footer-right">${showNumbers ? index + 1 : ''}</div>
      </footer>`;
  }

  // ============================================
  // STYLES
  // ============================================
  
  private getBaseStyles(): string {
    // For thumbnails: use min(vh, vw * aspect) to get the constraining dimension
    // This ensures fonts scale properly in both portrait and landscape containers
    return `
      * { margin: 0; padding: 0; box-sizing: border-box; }
      :root {
        /* Dynamic base unit: uses height in landscape, width in portrait */
        /* For 16:9 aspect ratio, base reference is 100vh when height-constrained */
        --slide-unit: min(1vh, 1.778vw);
      }
      html, body { 
        width: 100%; height: 100%; 
        font-family: var(--body-font, system-ui, -apple-system, sans-serif);
        overflow: hidden;
      }
      .perspecta-thumbnail { 
        background: var(--light-background, #fff);
        width: 100%;
        height: 100%;
      }
      
      /* Slide Base */
      .slide { 
        width: 100%; height: 100%; 
        display: flex; flex-direction: column;
        padding: 5%;
        position: relative;
      }
      .slide.light { background: var(--light-background, #fff); color: var(--dark-body-text, #000); }
      .slide.dark { background: var(--dark-background, #1a1a2e); color: var(--light-body-text, #fff); }
      
      /* Background */
      .slide-background {
        position: absolute;
        top: 0; left: 0; right: 0; bottom: 0;
        z-index: 0;
      }
      .slide-body { flex: 1; display: flex; flex-direction: column; position: relative; z-index: 1; min-height: 0; }
      .slide-content { flex: 1; display: flex; flex-direction: column; gap: calc(var(--slide-unit) * 1.5); }
      
      /* Typography - scaled dynamically based on container */
      h1, h2, h3, h4, h5, h6 { 
        font-family: var(--title-font, system-ui, -apple-system, sans-serif);
        font-weight: 700; line-height: 1.15; 
      }
      h1 { font-size: calc(var(--slide-unit) * 7); }
      h2 { font-size: calc(var(--slide-unit) * 5.5); }
      h3 { font-size: calc(var(--slide-unit) * 4.5); }
      h4 { font-size: calc(var(--slide-unit) * 3.5); }
      h5 { font-size: calc(var(--slide-unit) * 3); }
      h6 { font-size: calc(var(--slide-unit) * 2.5); }
      p { font-size: calc(var(--slide-unit) * 2.8); line-height: 1.4; }
      ul, ol { padding-left: 1.2em; font-size: calc(var(--slide-unit) * 2.8); }
      li { margin-bottom: 0.15em; }
      
      /* Kicker */
      .kicker { 
        font-size: calc(var(--slide-unit) * 1.8); 
        text-transform: uppercase; 
        letter-spacing: 0.08em; 
        opacity: 0.7; 
      }
      
      /* Slots */
      .slot-header { margin-bottom: calc(var(--slide-unit) * 1); }
      .slot-columns { display: flex; gap: calc(var(--slide-unit) * 2); flex: 1; align-items: flex-start; width: 100%; }
      .slot-columns .column { flex: 1; display: flex; flex-direction: column; }
      .slot-columns.columns-1 { flex-direction: column; }
      .slot-columns.ratio-narrow-wide .column[data-column="1"] { flex: 1; }
      .slot-columns.ratio-narrow-wide .column[data-column="2"] { flex: 2; }
      .slot-columns.ratio-wide-narrow .column[data-column="1"] { flex: 2; }
      .slot-columns.ratio-wide-narrow .column[data-column="2"] { flex: 1; }
      
      /* Layout: Cover */
      .layout-cover { justify-content: center; align-items: center; text-align: center; }
      .layout-cover h1 { font-size: calc(var(--slide-unit) * 9); }
      
      /* Layout: Title */
      .layout-title { justify-content: center; align-items: center; text-align: center; }
      .layout-title h1 { font-size: calc(var(--slide-unit) * 9); }
      .layout-title h2 { font-size: calc(var(--slide-unit) * 7); }
      
      /* Layout: Section */
      .section-container .slide-body { 
        background: var(--accent1, #1a1a2e); color: var(--light-body-text, #fff);
        margin: -5%; padding: 5%;
      }
      .layout-section { justify-content: center; align-items: center; text-align: center; }
      
      /* Layout: Default */
      .layout-default { align-items: flex-start; }
      
      /* Layout: Image */
      .layout-full-image { padding: 0; flex-direction: row; }
      .layout-full-image .image-slot { flex: 1; height: 100%; }
      .layout-full-image .image-slot img { width: 100%; height: 100%; object-fit: cover; }
      
      .layout-caption { padding: 0; }
      .layout-caption .slot-title-bar { padding: calc(var(--slide-unit) * 1) 5%; background: rgba(0,0,0,0.05); }
      .layout-caption .slot-image { flex: 1; display: flex; }
      .layout-caption .slot-image img { width: 100%; height: 100%; object-fit: cover; }
      .layout-caption .slot-caption { padding: calc(var(--slide-unit) * 1) 5%; text-align: center; font-size: calc(var(--slide-unit) * 2); }
      
      .layout-half-image { flex-direction: row; padding: 0; }
      .layout-half-image .slot-image { flex: 1; display: flex; flex-direction: column; }
      .layout-half-image .slot-image img { width: 100%; height: 100%; object-fit: cover; }
      .layout-half-image .slot-text { flex: 1; padding: 5%; display: flex; flex-direction: column; justify-content: center; }
      
      /* Header/Footer */
      .slide-header, .slide-footer { 
        display: flex; justify-content: space-between; 
        padding: calc(var(--slide-unit) * 0.5) 0; 
        font-size: calc(var(--slide-unit) * 1.5); 
        opacity: 0.5;
      }
      .slide-header > div, .slide-footer > div { flex: 1; }
      .slide-header .middle, .slide-footer .middle { text-align: center; }
      .slide-header .trailing, .slide-footer .trailing { text-align: right; }
    `;
  }
  
  private renderStyles(frontmatter: PresentationFrontmatter): string {
    const cssVars = this.generateCSSVariables(frontmatter);
    
    return `<style>
:root {
${cssVars}
  /* Dynamic base unit: uses the constraining dimension (height in landscape, width in portrait) */
  /* For 16:9 slides: 1vh when height-constrained, ~1.778vw when width-constrained */
  --slide-unit: min(1vh, 1.778vw);
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body {
  width: 100%;
  height: 100%;
  font-family: var(--body-font, system-ui, -apple-system, sans-serif);
  background: var(--background-color, #000);
  color: var(--body-text-color, #fff);
}

.reveal {
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.slides {
  width: 100%;
  height: 100%;
  position: relative;
}

/* Slide Base */
.slide {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 5%;
  position: absolute;
  top: 0;
  left: 0;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.4s ease, transform 0.4s ease, visibility 0s 0.4s;
}

.slide.active {
  opacity: 1;
  visibility: visible;
  transition: opacity 0.4s ease, transform 0.4s ease, visibility 0s 0s;
}

/* Transitions */
.transition-none .slide { transition: none; }
.transition-fade .slide { transform: none; }
.transition-slide .slide { transform: translateX(100%); }
.transition-slide .slide.active { transform: translateX(0); }
.transition-slide .slide.prev { transform: translateX(-100%); }

/* Color modes */
.slide.light {
  background: var(--light-background, #fff);
  color: var(--dark-body-text, #1a1a2e);
}

.slide.dark {
  background: var(--dark-background, #1a1a2e);
  color: var(--light-body-text, #fff);
}

/* Slide structure */
.slide-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.slide-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: calc(var(--slide-unit) * 2);
}

/* Header and Footer */
.slide-header, .slide-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: calc(var(--slide-unit) * 0.8) 0;
  font-size: calc(var(--slide-unit) * 1.8);
  opacity: 0.6;
}

/* Typography - scaled dynamically based on viewport */
h1, h2, h3, h4, h5, h6 {
  font-family: var(--title-font, system-ui, -apple-system, sans-serif);
  font-weight: 700;
  line-height: 1.15;
  margin-bottom: 0.4em;
}

h1 { font-size: calc(var(--slide-unit) * 7); }
h2 { font-size: calc(var(--slide-unit) * 5.5); }
h3 { font-size: calc(var(--slide-unit) * 4.5); }
h4 { font-size: calc(var(--slide-unit) * 3.5); }
h5 { font-size: calc(var(--slide-unit) * 3); }
h6 { font-size: calc(var(--slide-unit) * 2.5); }

p {
  font-size: calc(var(--slide-unit) * 2.8);
  line-height: 1.5;
  margin-bottom: 0.8em;
}

.kicker {
  font-size: calc(var(--slide-unit) * 1.8);
  text-transform: uppercase;
  letter-spacing: 0.12em;
  opacity: 0.7;
  margin-bottom: 0.5rem;
}

ul, ol {
  font-size: calc(var(--slide-unit) * 2.8);
  line-height: 1.6;
  padding-left: 1.5em;
}

li { margin-bottom: 0.5em; }

blockquote {
  font-size: calc(var(--slide-unit) * 3.2);
  font-style: italic;
  border-left: 4px solid var(--accent1, currentColor);
  padding-left: calc(var(--slide-unit) * 2);
  margin: calc(var(--slide-unit) * 1.5) 0;
}

img { max-width: 100%; max-height: 100%; object-fit: contain; }

figure { display: flex; flex-direction: column; align-items: center; gap: calc(var(--slide-unit) * 1); }

pre, code {
  font-family: 'SF Mono', 'Menlo', 'Monaco', 'Courier New', monospace;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 4px;
}

code { padding: 0.2em 0.4em; font-size: 0.9em; }

pre {
  padding: calc(var(--slide-unit) * 1.5);
  overflow-x: auto;
  font-size: calc(var(--slide-unit) * 2);
}

pre code { background: none; padding: 0; }

table { border-collapse: collapse; width: 100%; font-size: calc(var(--slide-unit) * 2.5); }
th, td { border: 1px solid rgba(0, 0, 0, 0.2); padding: calc(var(--slide-unit) * 1) calc(var(--slide-unit) * 1.5); text-align: left; }
th { background: rgba(0, 0, 0, 0.05); font-weight: 600; }

mark { background: var(--accent3, #f9c74f); padding: 0.1em 0.2em; }

/* ========================
   LAYOUT: SLOTS
   ======================== */

.slot-header {
  margin-bottom: calc(var(--slide-unit) * 2);
}

.slot-columns {
  display: flex;
  gap: calc(var(--slide-unit) * 4);
  flex: 1;
  align-items: flex-start;
}

.slot-columns .column {
  flex: 1;
  display: flex;
  flex-direction: column;
}

/* Column counts */
.slot-columns.columns-1 { flex-direction: column; }
.slot-columns.columns-1 .column { width: 100%; }

/* Column ratios (for 2-column layouts) */
.slot-columns.ratio-narrow-wide .column[data-column="1"] { flex: 1; }
.slot-columns.ratio-narrow-wide .column[data-column="2"] { flex: 2; }

.slot-columns.ratio-wide-narrow .column[data-column="1"] { flex: 2; }
.slot-columns.ratio-wide-narrow .column[data-column="2"] { flex: 1; }

/* ========================
   LAYOUT: COVER
   ======================== */

.layout-cover .slide-content {
  justify-content: center;
  align-items: center;
  text-align: center;
}

.layout-cover h1 { font-size: calc(var(--slide-unit) * 9); }
.layout-cover h2 { font-size: calc(var(--slide-unit) * 7); }

/* ========================
   LAYOUT: TITLE
   ======================== */

.layout-title .slide-content {
  justify-content: center;
  align-items: center;
  text-align: center;
}

.layout-title h1 { font-size: calc(var(--slide-unit) * 9); }
.layout-title h2 { font-size: calc(var(--slide-unit) * 7); }

/* ========================
   LAYOUT: SECTION
   ======================== */

.layout-section .slide-body {
  background: var(--accent1, #1a1a2e);
  color: var(--light-body-text, #fff);
  margin: -5%;
  padding: 5%;
}

.layout-section .slide-content {
  justify-content: center;
  align-items: center;
  text-align: center;
}

/* ========================
   LAYOUT: DEFAULT
   ======================== */

.layout-default .slide-content {
  align-items: flex-start;
}

/* ========================
   LAYOUT: TEXT COLUMNS
   ======================== */

.layout-1-column .slide-content,
.layout-2-columns .slide-content,
.layout-3-columns .slide-content,
.layout-2-columns-1\\+2 .slide-content,
.layout-2-columns-2\\+1 .slide-content {
  align-items: flex-start;
}

/* ========================
   LAYOUT: FULL IMAGE
   ======================== */

.layout-full-image {
  padding: 0 !important;
}

.layout-full-image .slide-body {
  margin: 0;
}

.layout-full-image .slide-content {
  padding: 0;
  margin: 0;
  flex-direction: row;
}

.layout-full-image .image-slot {
  flex: 1;
  height: 100%;
}

.layout-full-image .image-slot img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* ========================
   LAYOUT: CAPTION
   ======================== */

.layout-caption {
  padding: 0 !important;
}

.layout-caption .slide-body {
  margin: 0;
}

.layout-caption .slide-content {
  padding: 0;
}

.layout-caption .slot-title-bar {
  padding: calc(var(--slide-unit) * 2) 5%;
  background: rgba(0, 0, 0, 0.03);
}

.layout-caption .slot-image {
  flex: 1;
  display: flex;
  min-height: 0;
}

.layout-caption .slot-image .image-slot {
  flex: 1;
}

.layout-caption .slot-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.layout-caption .slot-caption {
  padding: calc(var(--slide-unit) * 1.5) 5%;
  text-align: center;
  font-size: calc(var(--slide-unit) * 2.5);
}

/* ========================
   LAYOUT: HALF IMAGE
   ======================== */

.layout-half-image {
  padding: 0 !important;
}

.layout-half-image .slide-body {
  margin: 0;
}

.layout-half-image .slide-content {
  flex-direction: row;
  padding: 0;
}

.layout-half-image .slot-image {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.layout-half-image .slot-image .image-slot {
  flex: 1;
  min-height: 0;
}

.layout-half-image .slot-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.layout-half-image .slot-text {
  flex: 1;
  padding: 5%;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

/* Navigation */
.nav-controls {
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  display: flex;
  gap: 0.5rem;
  z-index: 100;
}

.nav-btn {
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.3);
  color: white;
  cursor: pointer;
  font-size: 1.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.nav-btn:hover { background: rgba(0, 0, 0, 0.5); }

/* Progress bar */
.progress-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  height: 3px;
  background: var(--accent1, #000);
  transition: width 0.3s ease;
  z-index: 100;
}

/* Speaker notes (hidden by default, and explicitly hidden in thumbnails) */
.speaker-notes { display: none; }
.perspecta-thumbnail .speaker-notes { display: none !important; }

/* Print styles */
@media print {
  .slide {
    page-break-after: always;
    display: flex !important;
    position: relative;
  }
  .nav-controls, .progress-bar { display: none; }
}
</style>
${this.theme ? `<style>${this.theme.css}</style>` : ''}`;
  }
  
  private generateCSSVariables(frontmatter: PresentationFrontmatter): string {
    const vars: string[] = [];
    
    if (frontmatter.titleFont) vars.push(`  --title-font: ${frontmatter.titleFont};`);
    if (frontmatter.bodyFont) vars.push(`  --body-font: ${frontmatter.bodyFont};`);
    
    if (frontmatter.accent1) vars.push(`  --accent1: ${frontmatter.accent1};`);
    if (frontmatter.accent2) vars.push(`  --accent2: ${frontmatter.accent2};`);
    if (frontmatter.accent3) vars.push(`  --accent3: ${frontmatter.accent3};`);
    if (frontmatter.accent4) vars.push(`  --accent4: ${frontmatter.accent4};`);
    if (frontmatter.accent5) vars.push(`  --accent5: ${frontmatter.accent5};`);
    if (frontmatter.accent6) vars.push(`  --accent6: ${frontmatter.accent6};`);
    
    if (frontmatter.lightBackground) vars.push(`  --light-background: ${frontmatter.lightBackground};`);
    if (frontmatter.darkBackground) vars.push(`  --dark-background: ${frontmatter.darkBackground};`);
    if (frontmatter.lightTitleText) vars.push(`  --light-title-text: ${frontmatter.lightTitleText};`);
    if (frontmatter.darkTitleText) vars.push(`  --dark-title-text: ${frontmatter.darkTitleText};`);
    if (frontmatter.lightBodyText) vars.push(`  --light-body-text: ${frontmatter.lightBodyText};`);
    if (frontmatter.darkBodyText) vars.push(`  --dark-body-text: ${frontmatter.darkBodyText};`);
    
    return vars.join('\n');
  }

  // ============================================
  // SCRIPTS
  // ============================================
  
  private renderScripts(): string {
    return `<script>
(function() {
  let currentSlide = 0;
  const slides = document.querySelectorAll('.slide');
  const totalSlides = slides.length;
  
  function showSlide(index) {
    if (index < 0) index = 0;
    if (index >= totalSlides) index = totalSlides - 1;
    
    slides.forEach((slide, i) => {
      slide.classList.remove('active', 'prev');
      if (i === index) {
        slide.classList.add('active');
      } else if (i < index) {
        slide.classList.add('prev');
      }
    });
    
    currentSlide = index;
    updateProgress();
  }
  
  function updateProgress() {
    const progress = document.querySelector('.progress-bar');
    if (progress) {
      progress.style.width = ((currentSlide + 1) / totalSlides * 100) + '%';
    }
  }
  
  function nextSlide() { showSlide(currentSlide + 1); }
  function prevSlide() { showSlide(currentSlide - 1); }
  
  document.addEventListener('keydown', function(e) {
    switch(e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
      case ' ':
      case 'PageDown':
        e.preventDefault();
        nextSlide();
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
      case 'PageUp':
        e.preventDefault();
        prevSlide();
        break;
      case 'Home':
        e.preventDefault();
        showSlide(0);
        break;
      case 'End':
        e.preventDefault();
        showSlide(totalSlides - 1);
        break;
    }
  });
  
  document.addEventListener('click', function(e) {
    if (e.clientX > window.innerWidth / 2) {
      nextSlide();
    } else {
      prevSlide();
    }
  });
  
  // Add progress bar
  const progressBar = document.createElement('div');
  progressBar.className = 'progress-bar';
  document.body.appendChild(progressBar);
  updateProgress();
  
  showSlide(0);
})();
</script>`;
  }

  // ============================================
  // PRESENTER VIEW
  // ============================================
  
  renderPresenterHTML(): string {
    const { frontmatter, slides } = this.presentation;
    
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Presenter View - ${this.escapeHtml(frontmatter.title || 'Presentation')}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: 100%; height: 100%;
      font-family: system-ui, -apple-system, sans-serif;
      background: #1a1a2e; color: #eee;
      overflow: hidden;
    }
    .presenter-view {
      display: grid;
      grid-template-columns: 2fr 1fr;
      grid-template-rows: 1fr auto;
      gap: 16px; padding: 16px;
      height: 100vh;
    }
    .current-slide-container {
      background: #000; border-radius: 8px;
      overflow: hidden; display: flex;
      align-items: center; justify-content: center;
    }
    .current-slide-frame { width: 100%; height: 100%; border: none; }
    .side-panel { display: flex; flex-direction: column; gap: 16px; }
    .next-slide-container {
      background: #16213e; border-radius: 8px;
      padding: 12px; flex: 0 0 auto;
    }
    .next-slide-container h3 {
      font-size: 12px; text-transform: uppercase;
      letter-spacing: 0.1em; color: #888; margin-bottom: 8px;
    }
    .next-slide-preview {
      background: #000; border-radius: 4px;
      aspect-ratio: 16/9; overflow: hidden;
    }
    .next-slide-preview iframe { width: 100%; height: 100%; border: none; pointer-events: none; }
    .notes-container {
      background: #16213e; border-radius: 8px;
      padding: 16px; flex: 1; overflow-y: auto;
    }
    .notes-container h3 {
      font-size: 12px; text-transform: uppercase;
      letter-spacing: 0.1em; color: #888; margin-bottom: 12px;
    }
    .notes-content { font-size: 18px; line-height: 1.6; }
    .notes-content p { margin-bottom: 1em; }
    .controls {
      grid-column: 1 / -1;
      display: flex; justify-content: space-between; align-items: center;
      background: #16213e; border-radius: 8px; padding: 12px 24px;
    }
    .slide-counter { font-size: 24px; font-weight: 600; }
    .timer { font-size: 32px; font-family: monospace; font-weight: 600; }
    .nav-buttons { display: flex; gap: 12px; }
    .nav-btn {
      background: #0f3460; border: none; color: white;
      padding: 12px 24px; border-radius: 6px;
      font-size: 16px; cursor: pointer; transition: background 0.2s;
    }
    .nav-btn:hover { background: #1a4b8c; }
    .nav-btn.primary { background: #e94560; }
    .nav-btn.primary:hover { background: #ff6b8a; }
  </style>
</head>
<body>
  <div class="presenter-view">
    <div class="current-slide-container">
      <iframe id="current-slide-frame" class="current-slide-frame" srcdoc=""></iframe>
    </div>
    <div class="side-panel">
      <div class="next-slide-container">
        <h3>Next Slide</h3>
        <div class="next-slide-preview">
          <iframe id="next-slide-frame" srcdoc=""></iframe>
        </div>
      </div>
      <div class="notes-container">
        <h3>Speaker Notes</h3>
        <div id="notes-content" class="notes-content">
          <p>No notes for this slide.</p>
        </div>
      </div>
    </div>
    <div class="controls">
      <div class="slide-counter">
        <span id="current-slide-num">1</span> / <span id="total-slides">${slides.length}</span>
      </div>
      <div class="timer" id="timer">00:00:00</div>
      <div class="nav-buttons">
        <button class="nav-btn" onclick="prevSlide()">← Previous</button>
        <button class="nav-btn primary" onclick="nextSlide()">Next →</button>
      </div>
    </div>
  </div>
  <script>
    const slidesData = ${JSON.stringify(slides.map((s, i) => ({
      index: i,
      notes: s.speakerNotes,
      html: this.renderSingleSlideHTML(s, i, frontmatter)
    })))};
    
    let currentSlide = 0;
    const totalSlides = slidesData.length;
    let startTime = Date.now();
    
    function showSlide(index) {
      if (index < 0) index = 0;
      if (index >= totalSlides) index = totalSlides - 1;
      currentSlide = index;
      
      document.getElementById('current-slide-frame').srcdoc = slidesData[index].html;
      document.getElementById('current-slide-num').textContent = index + 1;
      
      const nextIndex = index + 1 < totalSlides ? index + 1 : index;
      document.getElementById('next-slide-frame').srcdoc = slidesData[nextIndex].html;
      
      const notes = slidesData[index].notes;
      const notesEl = document.getElementById('notes-content');
      if (notes && notes.length > 0) {
        notesEl.innerHTML = notes.map(n => '<p>' + n + '</p>').join('');
      } else {
        notesEl.innerHTML = '<p>No notes for this slide.</p>';
      }
    }
    
    function nextSlide() { showSlide(currentSlide + 1); }
    function prevSlide() { showSlide(currentSlide - 1); }
    
    document.addEventListener('keydown', function(e) {
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); nextSlide(); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); prevSlide(); }
    });
    
    setInterval(function() {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const h = Math.floor(elapsed / 3600);
      const m = Math.floor((elapsed % 3600) / 60);
      const s = elapsed % 60;
      document.getElementById('timer').textContent = 
        String(h).padStart(2, '0') + ':' + 
        String(m).padStart(2, '0') + ':' + 
        String(s).padStart(2, '0');
    }, 1000);
    
    showSlide(0);
  </script>
</body>
</html>`;
  }
  
  /**
   * Render slide thumbnail (simple version for lists)
   */
  renderSlideThumbnail(slide: Slide): string {
    const mode = slide.metadata.mode || 'light';
    const layout = slide.metadata.layout || 'default';
    
    return `
    <div class="slide-thumbnail ${mode} layout-${layout}">
      <div class="slide-content">
        ${this.renderSlideContent(slide, layout)}
      </div>
    </div>`;
  }
}
