import { Theme } from '../types';

export const zurichTheme: Theme = {
  name: 'Zurich',
  version: '1.0.0',
  author: 'Perspecta Slides',
  description: 'Minimal Swiss design with clean typography. Default white on black.',
  fonts: {
    title: 'Helvetica, Arial, sans-serif',
    body: 'Helvetica, Arial, sans-serif',
  },
  colors: {
    accent1: '#000000',
    accent2: '#43aa8b',
    accent3: '#f9c74f',
    accent4: '#90be6d',
    accent5: '#f8961e',
    accent6: '#577590',
  },
  css: `
/* Zurich Theme - Minimal Swiss Design */

:root {
  --title-font: Helvetica, Arial, sans-serif;
  --body-font: Helvetica, Arial, sans-serif;
  --accent1: #000;
  --accent2: #43aa8b;
  --accent3: #f9c74f;
  --accent4: #90be6d;
  --accent5: #f8961e;
  --accent6: #577590;
  --light-background: #fff;
  --dark-background: #000;
  --light-title-text: #fff;
  --dark-title-text: #000;
  --light-body-text: #fff;
  --dark-body-text: #000;
  
  /* Code highlighting */
  --code-background: #eeeeee;
  --code-text: #303030;
  --code-comment: #6b7279;
  --code-type: #9f3b4f;
  --code-include: #8c3a94;
  --code-string: #6959a1;
  --code-class-name: #4968a8;
  --code-numbers: #a58a2a;
  --code-variables: #4689cc;
  --code-functions: #cf5da8;
  --code-literal: #db651c;
  
  --dark-code-background: #1b1b1b;
  --dark-code-text: #f7f7f7;
  --dark-code-comment: #80878d;
  --dark-code-type: #ef98a8;
  --dark-code-include: #c596c9;
  --dark-code-string: #a59cc7;
  --dark-code-class-name: #94a5cb;
  --dark-code-numbers: #e8d670;
  --dark-code-variables: #77b5e3;
  --dark-code-functions: #df8dc0;
  --dark-code-literal: #f6b99a;
}

/* Zurich uses fixed-size headings - all headings same size */
.slide h1, .slide h2, .slide h3, 
.slide h4, .slide h5, .slide h6 {
  font-size: 2.5rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}

/* Title slides get larger text */
.layout-title h1, .layout-title h2 {
  font-size: 4rem;
}

/* Section slides */
.layout-section {
  background: var(--accent1) !important;
}

.layout-section .slide-content {
  color: var(--light-title-text);
}

/* Kicker styling */
.kicker {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  font-weight: 500;
}

/* Clean borders for code */
pre {
  border: 1px solid rgba(0, 0, 0, 0.1);
}

.dark pre {
  background: var(--dark-code-background);
  border-color: rgba(255, 255, 255, 0.1);
}

/* Blockquote styling */
blockquote {
  border-left-width: 3px;
  border-left-color: var(--accent1);
  font-style: normal;
  font-weight: 500;
}

/* Tables */
table {
  border: none;
}

th, td {
  border: none;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
}

th {
  background: transparent;
  font-weight: 700;
  text-transform: uppercase;
  font-size: 0.75rem;
  letter-spacing: 0.1em;
}

/* Progress bar */
.progress-bar {
  background: var(--accent2);
}

/* Accent colors for different slides */
.slide:nth-child(6n+1) .layout-section { background: var(--accent1) !important; }
.slide:nth-child(6n+2) .layout-section { background: var(--accent2) !important; }
.slide:nth-child(6n+3) .layout-section { background: var(--accent3) !important; color: var(--dark-title-text); }
.slide:nth-child(6n+4) .layout-section { background: var(--accent4) !important; color: var(--dark-title-text); }
.slide:nth-child(6n+5) .layout-section { background: var(--accent5) !important; color: var(--dark-title-text); }
.slide:nth-child(6n+6) .layout-section { background: var(--accent6) !important; }
`,
};

export default zurichTheme;
