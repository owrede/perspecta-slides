import { Presentation, Slide, SlideElement, PresentationFrontmatter, Theme } from '../types';

export class SlideRenderer {
  private presentation: Presentation;
  private theme: Theme | null = null;
  
  constructor(presentation: Presentation, theme?: Theme) {
    this.presentation = presentation;
    this.theme = theme || null;
  }
  
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
<body class="perspecta-slides ${frontmatter.aspectRatio || '16-9'}">
  <div class="reveal">
    <div class="slides">
      ${slides.map((slide, index) => this.renderSlide(slide, index, frontmatter)).join('\n')}
    </div>
  </div>
  ${this.renderScripts()}
</body>
</html>`;
  }
  
  private renderStyles(frontmatter: PresentationFrontmatter): string {
    const cssVars = this.generateCSSVariables(frontmatter);
    
    return `<style>
:root {
${cssVars}
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
  background: var(--background-color);
  color: var(--body-text-color);
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

.slide {
  width: 100%;
  height: 100%;
  display: none;
  flex-direction: column;
  padding: 5%;
  position: absolute;
  top: 0;
  left: 0;
}

.slide.active {
  display: flex;
}

.slide.light {
  background: var(--light-background, #fff);
  color: var(--dark-body-text, #000);
}

.slide.dark {
  background: var(--dark-background, #000);
  color: var(--light-body-text, #fff);
}

/* Header and Footer */
.slide-header, .slide-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 2rem;
  font-size: 0.875rem;
  opacity: 0.7;
}

.slide-header {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
}

.slide-footer {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
}

/* Slide Content */
.slide-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 3rem;
  gap: 1.5rem;
}

/* Layout: Default */
.layout-default .slide-content {
  align-items: flex-start;
}

/* Layout: Title */
.layout-title .slide-content {
  justify-content: center;
  align-items: center;
  text-align: center;
}

.layout-title h1, .layout-title h2 {
  font-size: 3.5rem;
}

/* Layout: Section */
.layout-section .slide-content {
  justify-content: center;
  align-items: center;
  text-align: center;
  background: var(--accent1, #000);
  color: var(--light-title-text, #fff);
}

/* Layout: V-Split */
.layout-v-split .slide-content {
  flex-direction: row;
  gap: 3rem;
}

.layout-v-split .text-content,
.layout-v-split .media-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

/* Layout: Caption */
.layout-caption .slide-content {
  flex-direction: column;
}

.layout-caption .media-content {
  flex: 2;
  display: flex;
  justify-content: center;
  align-items: center;
}

.layout-caption .text-content {
  flex: 1;
  text-align: center;
}

/* Layout: Full Image */
.layout-full-image {
  padding: 0 !important;
}

.layout-full-image .slide-content {
  padding: 0;
}

.layout-full-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* Layout: Grid */
.layout-grid .slide-content {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

/* Typography */
h1, h2, h3, h4, h5, h6 {
  font-family: var(--title-font, system-ui, -apple-system, sans-serif);
  font-weight: 700;
  line-height: 1.2;
  margin-bottom: 0.5em;
}

h1 { font-size: 3rem; }
h2 { font-size: 2.5rem; }
h3 { font-size: 2rem; }
h4 { font-size: 1.5rem; }
h5 { font-size: 1.25rem; }
h6 { font-size: 1rem; }

p {
  font-size: 1.25rem;
  line-height: 1.6;
  margin-bottom: 1em;
}

/* Kicker (small text above title) */
.kicker {
  font-size: 0.875rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  opacity: 0.7;
  margin-bottom: 0.5rem;
}

/* Lists */
ul, ol {
  font-size: 1.25rem;
  line-height: 1.8;
  padding-left: 1.5em;
}

li {
  margin-bottom: 0.5em;
}

/* Blockquotes */
blockquote {
  font-size: 1.5rem;
  font-style: italic;
  border-left: 4px solid var(--accent1, #000);
  padding-left: 1.5rem;
  margin: 1rem 0;
}

/* Images */
img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

figure {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

figcaption {
  font-size: 0.875rem;
  opacity: 0.7;
}

/* Code */
pre, code {
  font-family: 'SF Mono', 'Menlo', 'Monaco', 'Courier New', monospace;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 4px;
}

code {
  padding: 0.2em 0.4em;
  font-size: 0.9em;
}

pre {
  padding: 1rem;
  overflow-x: auto;
  font-size: 0.875rem;
}

pre code {
  background: none;
  padding: 0;
}

/* Tables */
table {
  border-collapse: collapse;
  width: 100%;
  font-size: 1rem;
}

th, td {
  border: 1px solid rgba(0, 0, 0, 0.2);
  padding: 0.75rem 1rem;
  text-align: left;
}

th {
  background: rgba(0, 0, 0, 0.05);
  font-weight: 600;
}

/* Math */
.math-block {
  font-size: 1.5rem;
  text-align: center;
  padding: 1rem;
}

/* Highlight */
mark {
  background: var(--accent3, #f9c74f);
  padding: 0.1em 0.2em;
}

/* Background image support */
.slide[data-background] {
  position: relative;
}

.slide-background {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: -1;
  object-fit: cover;
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

.nav-btn:hover {
  background: rgba(0, 0, 0, 0.5);
}

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

/* Speaker notes (hidden by default) */
.speaker-notes {
  display: none;
}

/* Print styles */
@media print {
  .slide {
    page-break-after: always;
    display: flex !important;
    position: relative;
  }
  
  .nav-controls, .progress-bar {
    display: none;
  }
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
  
  private renderSlide(slide: Slide, index: number, frontmatter: PresentationFrontmatter): string {
    const mode = slide.metadata.mode || 'light';
    const layout = slide.metadata.layout || 'default';
    const customClass = slide.metadata.class || '';
    const isActive = index === 0 ? 'active' : '';
    
    const backgroundStyle = slide.metadata.background 
      ? `background-image: url('${slide.metadata.background}'); background-size: cover; background-position: center;`
      : '';
    
    const opacity = slide.metadata.backgroundOpacity !== undefined 
      ? slide.metadata.backgroundOpacity 
      : 1;
    
    return `
    <section class="slide ${mode} layout-${layout} ${customClass} ${isActive}" 
             data-index="${index}"
             style="${backgroundStyle}">
      ${this.renderHeader(frontmatter, index)}
      <div class="slide-content">
        ${this.renderSlideContent(slide, layout)}
      </div>
      ${this.renderFooter(frontmatter, index, this.presentation.slides.length)}
      ${slide.speakerNotes.length > 0 ? `<aside class="speaker-notes">${slide.speakerNotes.map(n => this.renderMarkdown(n)).join('<br>')}</aside>` : ''}
    </section>`;
  }
  
  private renderHeader(frontmatter: PresentationFrontmatter, index: number): string {
    if (!frontmatter.headerLeft && !frontmatter.headerMiddle && !frontmatter.headerRight) {
      return '';
    }
    
    return `
      <div class="slide-header">
        <div class="header-left">${frontmatter.headerLeft || ''}</div>
        <div class="header-middle">${frontmatter.headerMiddle || ''}</div>
        <div class="header-right">${frontmatter.headerRight || ''}</div>
      </div>`;
  }
  
  private renderFooter(frontmatter: PresentationFrontmatter, index: number, total: number): string {
    const showNumbers = frontmatter.showSlideNumbers !== false;
    
    return `
      <div class="slide-footer">
        <div class="footer-left">${frontmatter.footerLeft || ''}</div>
        <div class="footer-middle">${frontmatter.footerMiddle || ''}</div>
        <div class="footer-right">${showNumbers ? index + 1 : ''}</div>
      </div>`;
  }
  
  private renderSlideContent(slide: Slide, layout: string): string {
    const elements = slide.elements.filter(e => e.visible);
    
    // For v-split layout, separate text and media
    if (layout === 'v-split') {
      const textElements = elements.filter(e => e.type !== 'image');
      const mediaElements = elements.filter(e => e.type === 'image');
      
      return `
        <div class="text-content">
          ${textElements.map(e => this.renderElement(e)).join('\n')}
        </div>
        <div class="media-content">
          ${mediaElements.map(e => this.renderElement(e)).join('\n')}
        </div>`;
    }
    
    // For caption layout
    if (layout === 'caption') {
      const mediaElements = elements.filter(e => e.type === 'image');
      const textElements = elements.filter(e => e.type !== 'image');
      
      return `
        <div class="media-content">
          ${mediaElements.map(e => this.renderElement(e)).join('\n')}
        </div>
        <div class="text-content">
          ${textElements.map(e => this.renderElement(e)).join('\n')}
        </div>`;
    }
    
    // Default: render all elements in order
    return elements.map(e => this.renderElement(e)).join('\n');
  }
  
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
    const bodyLines = lines.slice(2); // Skip header and separator
    
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
    
    // Strikethrough
    html = html.replace(/~~(.+?)~~/g, '<del>$1</del>');
    
    // Highlight
    html = html.replace(/==(.+?)==/g, '<mark>$1</mark>');
    
    // Inline code
    html = html.replace(/`(.+?)`/g, '<code>$1</code>');
    
    // Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
    
    // Inline math
    html = html.replace(/\$(.+?)\$/g, '<span class="math-inline">$1</span>');
    
    return html;
  }
  
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
  
  private renderScripts(): string {
    return `
<script>
(function() {
  const slides = document.querySelectorAll('.slide');
  let currentSlide = 0;
  
  function showSlide(index) {
    if (index < 0) index = 0;
    if (index >= slides.length) index = slides.length - 1;
    
    slides.forEach((slide, i) => {
      slide.classList.toggle('active', i === index);
    });
    
    currentSlide = index;
    updateProgress();
  }
  
  function updateProgress() {
    const progress = document.querySelector('.progress-bar');
    if (progress) {
      const percent = ((currentSlide + 1) / slides.length) * 100;
      progress.style.width = percent + '%';
    }
  }
  
  function nextSlide() {
    showSlide(currentSlide + 1);
  }
  
  function prevSlide() {
    showSlide(currentSlide - 1);
  }
  
  // Keyboard navigation
  document.addEventListener('keydown', (e) => {
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
        showSlide(slides.length - 1);
        break;
    }
  });
  
  // Touch navigation
  let touchStartX = 0;
  document.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
  });
  
  document.addEventListener('touchend', (e) => {
    const touchEndX = e.changedTouches[0].screenX;
    const diff = touchStartX - touchEndX;
    
    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        nextSlide();
      } else {
        prevSlide();
      }
    }
  });
  
  // Click navigation
  document.addEventListener('click', (e) => {
    const x = e.clientX;
    const width = window.innerWidth;
    
    if (x > width * 0.7) {
      nextSlide();
    } else if (x < width * 0.3) {
      prevSlide();
    }
  });
  
  // Add progress bar
  const progressBar = document.createElement('div');
  progressBar.className = 'progress-bar';
  document.body.appendChild(progressBar);
  updateProgress();
})();
</script>`;
  }
  
  /**
   * Render a single slide to HTML for thumbnail preview
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
