import { Theme, ThemeTemplate, ThemePreset } from '../../types';

// ============================================
// ZURICH THEME (iA Presenter format)
// ============================================

const zurichTemplate: ThemeTemplate = {
  Name: "Zurich",
  Version: "1.0.2",
  Author: "iA",
  ShortDescription: "Minimal Swiss design",
  LongDescription: "Clean, minimal Swiss design.\n- Fixed size for all headline levels\n- Simple color background\n- Default white on black\n- Default font: Helvetica",
  Css: "zurich.css",
  TitleFont: "Helvetica",
  BodyFont: "Helvetica",
  CssClasses: "fixed-size-headings"
};

const zurichPresets: ThemePreset[] = [{
  Name: "Default",
  TitleFont: "Helvetica Neue, Helvetica, Arial, sans-serif",
  BodyFont: "Helvetica Neue, Helvetica, Arial, sans-serif",
  Appearance: "light",
  DarkBodyTextColor: "#ffffff",
  LightBodyTextColor: "#333333",
  DarkTitleTextColor: "#ffffff",
  LightTitleTextColor: "#000000",
  DarkBackgroundColor: "#000000",
  LightBackgroundColor: "#ffffff",
  DarkAccent1: "#000000",
  LightAccent1: "#ffffff",
  Accent1: "#000000",
  Accent2: "#43aa8b",
  Accent3: "#f9c74f",
  Accent4: "#90be6d",
  Accent5: "#f8961e",
  Accent6: "#577590"
}];

const zurichCSS = `
/* Zurich Theme - Minimal Swiss Design */

:root {
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

/* Fixed-size headings (Swiss style) */
.fixed-size-headings h1,
.fixed-size-headings h2,
.fixed-size-headings h3,
.fixed-size-headings h4,
.fixed-size-headings h5,
.fixed-size-headings h6 {
  font-size: 2.5rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}

/* Cover and title slides */
.cover-container .slide-content,
.title-container .slide-content {
  justify-content: center;
  align-items: center;
  text-align: center;
}

.layout-cover h1, .layout-cover h2,
.layout-title h1, .layout-title h2 {
  font-size: 4rem !important;
}

/* Section slides - accent background */
.section-container {
  background: var(--accent1) !important;
}

.section-container .slide-content {
  justify-content: center;
  align-items: center;
  text-align: center;
  color: var(--dark-title-text);
}

/* Cycling section colors */
.slide:nth-child(6n+1).section-container { background: var(--accent1) !important; color: var(--light-title-text); }
.slide:nth-child(6n+2).section-container { background: var(--accent2) !important; color: var(--light-title-text); }
.slide:nth-child(6n+3).section-container { background: var(--accent3) !important; color: var(--dark-title-text); }
.slide:nth-child(6n+4).section-container { background: var(--accent4) !important; color: var(--dark-title-text); }
.slide:nth-child(6n+5).section-container { background: var(--accent5) !important; color: var(--dark-title-text); }
.slide:nth-child(6n+6).section-container { background: var(--accent6) !important; color: var(--light-title-text); }

/* Kicker styling */
.kicker {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  font-weight: 500;
  color: var(--accent2);
}

/* Code blocks */
pre {
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 4px;
}

.dark pre {
  border-color: rgba(255, 255, 255, 0.1);
}

/* Blockquote */
blockquote {
  border-left-width: 3px;
  border-left-color: var(--accent1);
  font-style: normal;
  font-weight: 500;
}

/* Tables */
table { border: none; }

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

.dark th, .dark td {
  border-bottom-color: rgba(255, 255, 255, 0.1);
}

/* Progress bar */
.progress-bar {
  background: var(--accent2);
}

/* Column spacing */
.slot-columns { gap: 3rem; }
`;

// ============================================
// TOKYO THEME
// ============================================

const tokyoTemplate: ThemeTemplate = {
  Name: "Tokyo",
  Version: "1.0.2",
  Author: "iA",
  ShortDescription: "Neon dark aesthetic",
  LongDescription: "Dark theme with vibrant neon accents.\n- Different sizes for headlines\n- Tokyo Metro line gradient backgrounds\n- Default white on dynamic color\n- System Font",
  Css: "tokyo.css",
  TitleFont: "System",
  BodyFont: "System",
  CssClasses: "variable-size-headings"
};

const tokyoPresets: ThemePreset[] = [{
  Name: "Default",
  TitleFont: "system-ui, -apple-system, sans-serif",
  BodyFont: "system-ui, -apple-system, sans-serif",
  Appearance: "dark",
  DarkBodyTextColor: "#ffffff",
  LightBodyTextColor: "#ffffff",
  DarkTitleTextColor: "#ffffff",
  LightTitleTextColor: "#ffffff",
  DarkBackgroundColor: "#0d1117",
  LightBackgroundColor: "#1e2127",
  Accent1: "#ff6b9d",
  Accent2: "#c678dd",
  Accent3: "#61afef",
  Accent4: "#98c379",
  Accent5: "#e5c07b",
  Accent6: "#56b6c2",
  LightBgGradient: ["#D3E9F8", "#CFDEED", "#E4DBEA", "#E9CDD7", "#F1DEDD", "#F8E6DE"],
  DarkBgGradient: ["#4EA9E2", "#3271B6", "#9977B3", "#D22E6B", "#CB3026", "#E6A63A"]
}];

const tokyoCSS = `
/* Tokyo Theme - Neon Dark */

:root {
  --code-background: #282c34;
  --code-text: #abb2bf;
  --code-comment: #5c6370;
  --code-type: #e5c07b;
  --code-include: #c678dd;
  --code-string: #98c379;
  --code-class-name: #61afef;
  --code-numbers: #d19a66;
  --code-variables: #e06c75;
  --code-functions: #61afef;
  --code-literal: #56b6c2;
  
  --dark-code-background: #0d1117;
  --dark-code-text: #c9d1d9;
}

/* Always dark appearance */
.slide.light {
  background: var(--light-background);
  color: var(--light-body-text);
}

/* Gradient headings */
.slide h1, .slide h2 {
  background: linear-gradient(135deg, var(--accent1), var(--accent2));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.slide h3, .slide h4, .slide h5, .slide h6 {
  color: var(--accent3);
}

/* Cover and title slides */
.cover-container .slide-content,
.title-container .slide-content {
  justify-content: center;
  align-items: center;
  text-align: center;
}

.layout-cover h1, .layout-cover h2,
.layout-title h1, .layout-title h2 {
  font-size: clamp(3rem, 6vw + 1.5vh, 7rem);
  font-weight: 800;
  letter-spacing: -0.03em;
}

/* Section slides with gradient overlay */
.section-container {
  background: linear-gradient(135deg, #0d1117 0%, #1e2127 100%) !important;
}

.section-container::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: 
    radial-gradient(circle at 20% 80%, rgba(255, 107, 157, 0.15) 0%, transparent 50%),
    radial-gradient(circle at 80% 20%, rgba(198, 120, 221, 0.15) 0%, transparent 50%);
  pointer-events: none;
}

.section-container .slide-content {
  justify-content: center;
  align-items: center;
  text-align: center;
  color: var(--dark-title-text);
  position: relative;
  z-index: 1;
}

/* Kicker */
.kicker {
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.2em;
  font-weight: 600;
  color: var(--accent1);
}

/* Code blocks with glow */
pre {
  background: var(--code-background);
  border: 1px solid rgba(255, 107, 157, 0.2);
  border-radius: 8px;
  box-shadow: 0 0 20px rgba(255, 107, 157, 0.1);
}

/* Blockquote */
blockquote {
  border-left-width: 4px;
  border-left-color: var(--accent2);
  background: rgba(198, 120, 221, 0.1);
  padding: 1rem 1.5rem;
  border-radius: 0 8px 8px 0;
}

/* Tables */
table {
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  overflow: hidden;
}

th {
  background: rgba(255, 107, 157, 0.1);
  color: var(--accent1);
}

/* Progress bar gradient */
.progress-bar {
  background: linear-gradient(90deg, var(--accent1), var(--accent2));
}

/* Links with glow */
a {
  color: var(--accent3);
  text-decoration: none;
}

a:hover {
  text-shadow: 0 0 10px var(--accent3);
}

.slot-columns { gap: 2.5rem; }
`;

// ============================================
// BERLIN THEME
// ============================================

const berlinTemplate: ThemeTemplate = {
  Name: "Berlin",
  Version: "1.0.0",
  Author: "Perspecta Slides",
  ShortDescription: "Professional blue tones",
  LongDescription: "Professional theme with deep blue tones.\n- Different sizes for headlines\n- Clean corporate style\n- Default white on blue\n- Default font: Source Sans Pro",
  Css: "berlin.css",
  TitleFont: "Source Sans Pro",
  BodyFont: "Source Sans Pro",
  CssClasses: "variable-size-headings"
};

const berlinPresets: ThemePreset[] = [{
  Name: "Default",
  TitleFont: "Source Sans Pro, Roboto, system-ui, sans-serif",
  BodyFont: "Source Sans Pro, Roboto, system-ui, sans-serif",
  Appearance: "light",
  DarkBodyTextColor: "#2d3748",
  LightBodyTextColor: "#f7fafc",
  DarkTitleTextColor: "#1a202c",
  LightTitleTextColor: "#ffffff",
  DarkBackgroundColor: "#ffffff",
  LightBackgroundColor: "#1a365d",
  DarkAccent1: "#1a365d",
  LightAccent1: "#63b3ed",
  Accent1: "#1a365d",
  Accent2: "#2c5282",
  Accent3: "#3182ce",
  Accent4: "#63b3ed",
  Accent5: "#e53e3e",
  Accent6: "#38a169"
}];

const berlinCSS = `
/* Berlin Theme - Professional Blue */

:root {
  --code-background: #f7fafc;
  --code-text: #2d3748;
  --code-comment: #718096;
  --code-type: #dd6b20;
  --code-include: #805ad5;
  --code-string: #38a169;
  --code-class-name: #3182ce;
  
  --dark-code-background: #0d1b2a;
  --dark-code-text: #e2e8f0;
}

.slide h1, .slide h2, .slide h3 {
  font-weight: 700;
  letter-spacing: -0.01em;
}

.slide.light h1, .slide.light h2 { color: var(--accent1); }
.slide.light h3, .slide.light h4 { color: var(--accent2); }
.slide.dark h1, .slide.dark h2 { color: var(--dark-title-text); }
.slide.dark h3, .slide.dark h4 { color: var(--accent2); }

/* Cover and title with gradient */
.cover-container,
.title-container {
  background: linear-gradient(180deg, var(--accent1) 0%, var(--accent2) 100%) !important;
}

.cover-container .slide-content,
.title-container .slide-content {
  justify-content: center;
  align-items: center;
  text-align: center;
}

.layout-cover h1, .layout-cover h2,
.layout-title h1, .layout-title h2 {
  font-size: clamp(2.5rem, 5vw + 1.5vh, 6rem);
  font-weight: 800;
  background: none;
}

/* Section slides */
.section-container {
  background: var(--accent2) !important;
}

.section-container .slide-content {
  justify-content: center;
  align-items: center;
  text-align: center;
}

/* Kicker */
.kicker {
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  font-weight: 600;
  color: var(--accent3);
}

/* Code blocks */
pre {
  background: var(--code-background);
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  border-left: 4px solid var(--accent3);
}

.dark pre {
  background: var(--dark-code-background);
  border-left-color: var(--accent4);
}

/* Blockquote */
blockquote {
  border-left: 4px solid var(--accent3);
  background: rgba(49, 130, 206, 0.05);
  padding: 1rem 1.5rem;
  font-style: italic;
}

/* Tables */
table {
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  overflow: hidden;
}

th {
  background: var(--accent1);
  color: var(--light-title-text);
}

/* Progress bar */
.progress-bar { background: var(--accent3); }

/* Header/Footer */
.slide-header, .slide-footer { color: var(--accent2); }
.dark .slide-header, .dark .slide-footer { color: rgba(255, 255, 255, 0.7); }

strong { color: var(--accent1); }
.dark strong { color: var(--accent4); }

.slot-columns { gap: 3rem; }
`;

// ============================================
// MINIMAL THEME
// ============================================

const minimalTemplate: ThemeTemplate = {
  Name: "Minimal",
  Version: "1.0.0",
  Author: "Perspecta Slides",
  ShortDescription: "Less is more",
  LongDescription: "Ultra-clean design with generous whitespace.\n- Variable heading sizes\n- Maximum whitespace\n- Simple black on white\n- Default font: Inter",
  Css: "minimal.css",
  TitleFont: "Inter",
  BodyFont: "Inter",
  CssClasses: "variable-size-headings"
};

const minimalPresets: ThemePreset[] = [{
  Name: "Default",
  TitleFont: "Inter, SF Pro Display, system-ui, sans-serif",
  BodyFont: "Inter, SF Pro Text, system-ui, sans-serif",
  Appearance: "light",
  DarkBodyTextColor: "#333333",
  LightBodyTextColor: "#e5e5e5",
  DarkTitleTextColor: "#111111",
  LightTitleTextColor: "#fafafa",
  DarkBackgroundColor: "#ffffff",
  LightBackgroundColor: "#111111",
  DarkAccent1: "#111111",
  LightAccent1: "#ffffff",
  Accent1: "#111111",
  Accent2: "#666666",
  Accent3: "#0066cc",
  Accent4: "#00aa55",
  Accent5: "#ff6600",
  Accent6: "#9933cc"
}];

const minimalCSS = `
/* Minimal Theme - Ultra Clean */

.slide { padding: 8%; }
.slide-content { gap: 2rem; }

.slide h1 {
  font-size: clamp(2.5rem, 5vw + 1vh, 5rem);
  font-weight: 600;
  letter-spacing: -0.03em;
  line-height: 1.1;
}

.slide h2 {
  font-size: clamp(2rem, 4vw + 0.8vh, 4rem);
  font-weight: 600;
  letter-spacing: -0.02em;
}

.slide h3, .slide h4, .slide h5, .slide h6 {
  font-weight: 500;
  letter-spacing: -0.01em;
}

.slide p {
  font-size: clamp(1.1rem, 1.4vw + 0.5vh, 2rem);
  line-height: 1.6;
  color: var(--accent2);
}

/* Cover and title */
.cover-container .slide-content,
.title-container .slide-content {
  justify-content: center;
  align-items: center;
  text-align: center;
  gap: 1.5rem;
}

.layout-cover h1, .layout-cover h2,
.layout-title h1, .layout-title h2 {
  font-size: clamp(3rem, 6vw + 1.5vh, 7rem);
}

.layout-cover p, .layout-title p {
  text-transform: uppercase;
  letter-spacing: 0.2em;
  font-weight: 500;
}

/* Section slides */
.section-container {
  background: var(--accent1) !important;
}

.section-container .slide-content {
  justify-content: center;
  align-items: center;
  text-align: center;
}

/* Kicker - subtle */
.kicker {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.25em;
  font-weight: 500;
  color: var(--accent2);
  opacity: 0.7;
}

/* Code - minimal */
pre {
  background: #fafafa;
  border: none;
  border-radius: 4px;
  padding: 1.5rem;
}

.dark pre { background: #1a1a1a; }

/* Blockquote - simple line */
blockquote {
  border-left: 2px solid var(--accent1);
  padding-left: 1.5rem;
  font-style: normal;
  color: var(--accent2);
}

/* Tables - minimal */
table { border: none; }

th {
  background: transparent;
  font-weight: 600;
  text-transform: uppercase;
  font-size: 0.7rem;
  letter-spacing: 0.15em;
  color: var(--accent2);
  border-bottom: 2px solid var(--accent1);
}

td { border-bottom: 1px solid rgba(0, 0, 0, 0.05); }

/* Lists - dash style */
ul { list-style: none; padding-left: 0; }

ul li {
  padding-left: 1.5rem;
  position: relative;
}

ul li::before {
  content: '—';
  position: absolute;
  left: 0;
  color: var(--accent2);
}

/* Progress bar - thin */
.progress-bar {
  height: 2px;
  background: var(--accent1);
}

/* Header/Footer - subdued */
.slide-header, .slide-footer {
  opacity: 0.4;
  font-size: 0.75rem;
}

code {
  background: rgba(0, 0, 0, 0.04);
  padding: 0.15em 0.4em;
  border-radius: 3px;
}

.dark code { background: rgba(255, 255, 255, 0.08); }

.slot-columns { gap: 4rem; }
`;

// ============================================
// HELVETICA THEME (iA Presenter format)
// ============================================

const helveticaTemplate: ThemeTemplate = {
  Name: "Helvetica",
  Version: "1.0.2",
  Author: "iA",
  ShortDescription: "Classic typography focus",
  LongDescription: "Classic Helvetica typography with clean design.\n- Professional typography focus\n- Balanced contrast\n- Default font: Helvetica Neue\n- Suitable for business presentations",
  Css: "helvetica.css",
  TitleFont: "Helvetica Neue",
  BodyFont: "Helvetica Neue",
  CssClasses: "helvetica-typography"
};

const helveticaPresets: ThemePreset[] = [
  {
    Name: "Default",
    TitleFont: "Helvetica Neue, Helvetica, Arial, sans-serif",
    BodyFont: "Helvetica Neue, Helvetica, Arial, sans-serif",
    Appearance: "light",
    DarkBodyTextColor: "#ffffff",
    LightBodyTextColor: "#1a1a1a",
    DarkTitleTextColor: "#ffffff",
    LightTitleTextColor: "#000000",
    DarkBackgroundColor: "#1a1a1a",
    LightBackgroundColor: "#ffffff",
    DarkAccent1: "#0066cc",
    LightAccent1: "#0066cc",
    Accent1: "#0066cc",
    Accent2: "#28a745",
    Accent3: "#ffc107",
    Accent4: "#dc3545",
    Accent5: "#6f42c1",
    Accent6: "#fd7e14"
  },
  {
    Name: "Dark",
    TitleFont: "Helvetica Neue, Helvetica, Arial, sans-serif",
    BodyFont: "Helvetica Neue, Helvetica, Arial, sans-serif",
    Appearance: "dark",
    DarkBodyTextColor: "#ffffff",
    LightBodyTextColor: "#1a1a1a",
    DarkTitleTextColor: "#ffffff",
    LightTitleTextColor: "#000000",
    DarkBackgroundColor: "#1a1a1a",
    LightBackgroundColor: "#ffffff",
    DarkAccent1: "#0066cc",
    LightAccent1: "#0066cc",
    Accent1: "#0066cc",
    Accent2: "#28a745",
    Accent3: "#ffc107",
    Accent4: "#dc3545",
    Accent5: "#6f42c1",
    Accent6: "#fd7e14"
  }
];

const helveticaCSS = `
/* Helvetica Theme - Classic Typography Focus */

/* Force hide speaker notes in thumbnails */
.perspecta-thumbnail .speaker-notes { 
  display: none !important; 
  visibility: hidden !important;
  opacity: 0 !important;
  height: 0 !important;
  overflow: hidden !important;
}

:root {
  --code-background: #f1f3f4;
  --code-text: #202124;
  --code-comment: #5f6368;
  --code-type: #d93025;
  --code-include: #7b1fa2;
  --code-string: #1a73e8;
  --code-class-name: #1967d2;
  --code-keyword: #7b1fa2;
  --code-function: #1a73e8;
  --code-variable: #5f6368;
  --code-number: #1967d2;
  --code-operator: #5f6368;
  --code-punctuation: #5f6368;
}

/* Typography emphasis */
.helvetica-typography h1,
.helvetica-typography h2,
.helvetica-typography h3,
.helvetica-typography h4,
.helvetica-typography h5,
.helvetica-typography h6 {
  font-weight: 500;
  letter-spacing: -0.02em;
}

.helvetica-typography h1 {
  font-weight: 300;
  letter-spacing: -0.03em;
}

.helvetica-typography h2 {
  font-weight: 400;
  letter-spacing: -0.025em;
}

/* Clean slide backgrounds */
.slide {
  border-radius: 2px;
}

/* Professional accent colors */
.kicker {
  font-weight: 600;
  letter-spacing: 0.08em;
  opacity: 0.8;
}

/* Enhanced code styling */
pre {
  border-radius: 6px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

code {
  font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
  font-size: 0.9em;
  font-weight: 500;
}

/* Clean blockquotes */
blockquote {
  border-left: 3px solid var(--accent1);
  font-style: normal;
  font-weight: 400;
}

/* Professional tables */
table {
  border-radius: 4px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

th, td {
  border: none;
  padding: 12px 16px;
}

th {
  background: var(--accent1);
  opacity: 0.1;
  font-weight: 600;
}

tr:nth-child(even) td {
  background: rgba(0, 0, 0, 0.02);
}

.dark tr:nth-child(even) td {
  background: rgba(255, 255, 255, 0.02);
}

.layout-section .slide-body {
  background: var(--accent1);
  color: var(--dark-body-text);
  margin: -5%;
  padding: 5%;
  border-radius: 0;
}

.light .layout-section .slide-body {
  color: var(--dark-body-text);
}

.dark .layout-section .slide-body {
  color: var(--dark-body-text);
}

/* Progress bar */
.progress-bar {
  height: 3px;
  background: var(--accent1);
}

/* Header/Footer - professional styling */
.slide-header, .slide-footer {
  opacity: 0.6;
  font-size: 0.8rem;
  font-weight: 500;
}

/* Column spacing */
.slot-columns { gap: 3rem; }

/* Image captions */
figcaption {
  font-size: 0.9rem;
  color: var(--light-body-text);
  opacity: 0.8;
  font-style: italic;
}

.dark figcaption {
  color: var(--dark-body-text);
}
`;

// ============================================
// BASEL THEME (iA Presenter format)
// ============================================

const baselTemplate: ThemeTemplate = {
  Name: "Basel",
  Version: "1.0.2",
  Author: "iA",
  ShortDescription: "Swiss Serif Typography",
  LongDescription: "Professional theme with serif typography.\n- Different sizes for headlines\n- Elegant Swiss style\n- Default white on charcoal\n- Default font: Noto Serif",
  Css: "basel.css",
  TitleFont: "Noto Serif",
  BodyFont: "Noto Serif",
  CssClasses: "variable-size-headings"
};

const baselPresets: ThemePreset[] = [{
  Name: "Default",
  TitleFont: "Noto Serif, serif",
  BodyFont: "Noto Serif, serif",
  Appearance: "dark",
  DarkBodyTextColor: "#ffffff",
  LightBodyTextColor: "#333333",
  DarkTitleTextColor: "#ffffff",
  LightTitleTextColor: "#111111",
  DarkBackgroundColor: "#000000",
  LightBackgroundColor: "#ffffff",
  DarkAccent1: "#FF3333",
  LightAccent1: "#FF3333",
  Accent1: "#FF3333",
  Accent2: "#43aa8b",
  Accent3: "#f9c74f",
  Accent4: "#90be6d",
  Accent5: "#f8961e",
  Accent6: "#577590"
}, {
  Name: "Light",
  TitleFont: "Noto Serif, serif",
  BodyFont: "Noto Serif, serif",
  Appearance: "light",
  DarkBodyTextColor: "#ffffff",
  LightBodyTextColor: "#333333",
  DarkTitleTextColor: "#ffffff",
  LightTitleTextColor: "#111111",
  DarkBackgroundColor: "#000000",
  LightBackgroundColor: "#ffffff",
  DarkAccent1: "#000000",
  LightAccent1: "#ffffff",
  Accent1: "#FF3333",
  Accent2: "#333333",
  Accent3: "#666666",
  Accent4: "#999999",
  Accent5: "#CCCCCC",
  Accent6: "#EEEEEE"
}];

const baselCSS = `
/* Basel Theme - Swiss Serif Typography */

:root {
  --code-background: #eeeeee;
  --code-border: rgba(0, 0, 0, 0.05);
  --code-text: #303030;
  --code-comment: #9ea4aa;
  --code-type: #9f3b4f;
  --code-include: #8c3a94;
  --code-string: #6959a1;
  --code-class-name: #4968a8;
  --code-numbers: #a58a2a;
  --code-variables: #4689cc;
  --code-functions: #cf5da8;
  --code-literal: #db651c;
  
  --dark-code-background: #282828;
  --dark-code-border: rgba(255, 255, 255, 0.08);
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

/* Import Noto Serif fonts */
@import url('https://fonts.googleapis.com/css2?family=Noto+Serif:ital,wght@0,400;0,700;1,400;1,700&display=swap');

/* Typography - Classic serif */
.slide h1, .slide h2, .slide h3 {
  font-family: 'Noto Serif', serif;
  font-weight: 700;
  line-height: 1.2;
}

.slide p, .slide li {
  font-family: 'Noto Serif', serif;
  font-weight: 400;
  line-height: 1.6;
}

/* Cover and title slides with inverted styling */
.cover-container, .title-container {
  background: var(--accent1) !important;
}

.cover-container .slide-content,
.title-container .slide-content {
  justify-content: center;
  align-items: center;
  text-align: center;

}

.layout-cover h1, .layout-cover h2,
.layout-title h1, .layout-title h2 {

}

/* Code styling */
pre {
  background: var(--code-background);
  border: 1px solid var(--code-border);
  border-radius: 4px;
  padding: 1.5rem;
}

.dark pre {
  background: var(--dark-code-background);
  border-color: var(--dark-code-border);
}

code {
  font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
  font-size: 0.9em;
}

/* Kicker styling */
.kicker {
  font-family: 'Noto Serif', serif;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  font-weight: 700;
  color: var(--accent2);
}
`;

// ============================================
// COPENHAGEN THEME (iA Presenter format)
// ============================================

const copenhagenTemplate: ThemeTemplate = {
  Name: "Copenhagen",
  Version: "1.0.2",
  Author: "iA",
  ShortDescription: "Nordic Minimalist Design",
  LongDescription: "Clean, light design with blue accents.\n- Mixed font sizes\n- Generous whitespace\n- Default blue on light gray\n- Default font: IBM Plex Sans",
  Css: "copenhagen.css",
  TitleFont: "IBM Plex Sans",
  BodyFont: "IBM Plex Sans",
  CssClasses: "variable-size-headings"
};

const copenhagenPresets: ThemePreset[] = [{
  Name: "Default",
  TitleFont: "Albert Sans, sans-serif",
  BodyFont: "Albert Sans, sans-serif",
  Appearance: "dark",
  DarkBodyTextColor: "rgba(255, 255, 255, 0.9)",
  LightBodyTextColor: "rgba(0, 0, 0, 0.7)",
  DarkTitleTextColor: "rgba(255, 255, 255, 0.9)",
  LightTitleTextColor: "rgba(0, 0, 0, 0.7)",
  DarkBackgroundColor: "#6E9075",
  LightBackgroundColor: "#ffffff",
  DarkAccent1: "#6E9075",
  LightAccent1: "#E1EBE3",
  Accent1: "#6E9075",
  Accent2: "#43aa8b",
  Accent3: "#f9c74f",
  Accent4: "#90be6d",
  Accent5: "#f8961e",
  Accent6: "#577590"
}, {
  Name: "Light",
  TitleFont: "Albert Sans, sans-serif",
  BodyFont: "Albert Sans, sans-serif",
  Appearance: "light",
  DarkBodyTextColor: "rgba(255, 255, 255, 0.9)",
  LightBodyTextColor: "rgba(0, 0, 0, 0.7)",
  DarkTitleTextColor: "rgba(255, 255, 255, 0.9)",
  LightTitleTextColor: "rgba(0, 0, 0, 0.7)",
  DarkBackgroundColor: "#6E9075",
  LightBackgroundColor: "#ffffff",
  DarkAccent1: "#6E9075",
  LightAccent1: "#E1EBE3",
  Accent1: "#6E9075",
  Accent2: "#333333",
  Accent3: "#666666",
  Accent4: "#999999",
  Accent5: "#CCCCCC",
  Accent6: "#EEEEEE"
}];

const copenhagenCSS = `
/* Copenhagen Theme - Nordic Elegance */

:root {
  --code-background: #eeeeee;
  --code-border: rgba(0, 0, 0, 0.05);
  --code-text: #303030;
  --code-comment: #9ea4aa;
  --code-type: #9f3b4f;
  --code-include: #8c3a94;
  --code-string: #6959a1;
  --code-class-name: #4968a8;
  --code-numbers: #a58a2a;
  --code-variables: #4689cc;
  --code-functions: #cf5da8;
  --code-literal: #db651c;
  
  --dark-code-background: #181818;
  --dark-code-border: rgba(255, 255, 255, 0.08);
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

/* Import Albert Sans font */
@import url('https://fonts.googleapis.com/css2?family=Albert+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;0,900;1,400;1,500;1,600;1,700;1,800;1,900&display=swap');

/* Nordic typography with weight hierarchy */
[class*='layout-'] > div h1 {
  font-weight: 900;
}
[class*='layout-'] > div h2 {
  font-weight: 800;
}
[class*='layout-'] > div h3 {
  font-weight: 700;
}
[class*='layout-'] > div h4 {
  font-weight: 600;
}

h1 + h2,
h1 + h3,
h2 + h3,
h1 + h1,
h1 + h3,
h2 + h3,
h4 + h5 {
  font-weight: 500 !important;
}

/* Clean Nordic styling */
.slide {
  font-family: 'Albert Sans', sans-serif;
}

.slide h1, .slide h2, .slide h3, .slide h4 {
  font-family: 'Albert Sans', sans-serif;
  line-height: 1.2;
}

.slide p, .slide li {
  font-family: 'Albert Sans', sans-serif;
  line-height: 1.5;
}

/* Cover and title slides */
.cover-container, .title-container {
  background: var(--accent1) !important;
}

.cover-container .slide-content,
.title-container .slide-content {
  justify-content: center;
  align-items: center;
  text-align: center;

}

.layout-cover h1, .layout-cover h2,
.layout-title h1, .layout-title h2 {

}

/* Code styling */
pre {
  background: var(--code-background);
  border: 1px solid var(--code-border);
  border-radius: 4px;
  padding: 1.5rem;
}

.dark pre {
  background: var(--dark-code-background);
  border-color: var(--dark-code-border);
}

code {
  font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
  font-size: 0.9em;
}

/* Kicker styling */
.kicker {
  font-family: 'Albert Sans', sans-serif;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  font-weight: 600;
  color: var(--dark-accent1);
}
`;


// ============================================
// GARAMOND THEME
// ============================================

const garamondTemplate: ThemeTemplate = {
  Name: "Garamond",
  Version: "1.0.3",
  Author: "iA",
  ShortDescription: "Classic Book Design",
  LongDescription: "Inspired by Renaissance typography, this style emphasizes readability, elegance, and proportion, echoing the traditions of classic printed books.",
  Css: "garamond.css",
  TitleFont: "iA Garamond",
  BodyFont: "iA Garamond",
  CssClasses: "variable-size-headings"
};

const garamondPresets: ThemePreset[] = [
  {
    Name: "Light",
    TitleFont: "iA Garamond",
    BodyFont: "iA Garamond",
    DarkBodyTextColor: "#ffffff",
    LightBodyTextColor: "#111111",
    DarkTitleTextColor: "#ffffff",
    LightTitleTextColor: "#000000",
    DarkBackgroundColor: "#000000",
    LightBackgroundColor: "#ffffff",
    Appearance: "light",
    Accent1: "#FF3333",
    Accent2: "#43aa8b",
    Accent3: "#f9c74f",
    Accent4: "#90be6d",
    Accent5: "#f8961e",
    Accent6: "#577590"
  },
  {
    Name: "Dark",
    TitleFont: "iA Garamond",
    BodyFont: "iA Garamond",
    DarkBodyTextColor: "#ffffff",
    LightBodyTextColor: "#111111",
    DarkTitleTextColor: "#ffffff",
    LightTitleTextColor: "#000000",
    DarkBackgroundColor: "#000000",
    LightBackgroundColor: "#ffffff",
    Appearance: "dark",
    Accent1: "#FF3333",
    Accent2: "#333333",
    Accent3: "#666666",
    Accent4: "#999999",
    Accent5: "#cccccc",
    Accent6: "#eeeeee"
  }
];

const garamondCSS = `
/* Garamond Theme - Classic Book Design */
@font-face {
  font-family: 'iA Garamond';
  src: url('https://ia.net/fonts/iAGaramond.woff2') format('woff2');
  font-weight: 400 700;
}

.slide { font-family: 'iA Garamond', serif; }

.slide h1, .slide h2, .slide h3 {
  font-family: 'iA Garamond', serif;
  font-weight: 400;
}

.layout-cover h1, .layout-title h1 {
  font-size: 4.5rem;
  letter-spacing: -0.02em;
}

.section-container .slide-content {
  justify-content: center;
  align-items: center;
  text-align: center;
}
`;

// ============================================
// LA THEME
// ============================================

const laTemplate: ThemeTemplate = {
  Name: "LA",
  Version: "1.0.2",
  Author: "iA",
  ShortDescription: "West Coast vibes",
  LongDescription: "Bold, sunny, and distinct design inspired by Los Angeles.\n- Different sizes for headlines\n- Palm Tree and Sunset colors\n- Default font: Roboto Slab",
  Css: "la.css",
  TitleFont: "Roboto Slab",
  BodyFont: "Roboto Slab",
  CssClasses: "variable-size-headings"
};

const laPresets: ThemePreset[] = [
  {
    Name: "Default",
    TitleFont: "Roboto Slab",
    BodyFont: "Roboto Slab",
    Appearance: "light",
    DarkBodyTextColor: "#ffffff",
    LightBodyTextColor: "#ffffff",
    DarkTitleTextColor: "#ffffff",
    LightTitleTextColor: "#ffffff",
    DarkBackgroundColor: "#1a1a1a",
    LightBackgroundColor: "#f94144",
    DarkAccent1: "#ffffff",
    LightAccent1: "#ffffff",
    Accent1: "#f94144",
    Accent2: "#43aa8b",
    Accent3: "#f9c74f",
    Accent4: "#90be6d",
    Accent5: "#f8961e",
    Accent6: "#577590",
    LightBgGradient: ["#F9C74F", "#F8961E", "#F3722C", "#F94144"],
    DarkBgGradient: ["#F94144", "#F3722C", "#F8961E", "#F9C74F"]
  }
];

const laCSS = `
/* LA Theme - West Coast Vibes */
@import url('https://fonts.googleapis.com/css2?family=Roboto+Slab:wght@300;400;700;900&display=swap');

.slide { font-family: 'Roboto Slab', serif; }
.slide h1, .slide h2, .slide h3 { font-weight: 900; }

.cover-container, .title-container {
  border-top: 4px solid var(--accent1);
  border-bottom: 4px solid var(--accent1);
  padding: 2rem 0;
}
`;

// ============================================
// MILANO THEME
// ============================================

const milanoTemplate: ThemeTemplate = {
  Name: "Milano",
  Version: "1.0.2",
  Author: "iA",
  ShortDescription: "High fashion aesthetic",
  LongDescription: "Elegant and sophisticated design inspired by Italian fashion.\n- High contrast serif typography\n- Minimalist grid\n- Default white on dynamic color\n- Default font: Playfair Display",
  Css: "milano.css",
  TitleFont: "Playfair Display",
  BodyFont: "Playfair Display",
  CssClasses: "variable-size-headings"
};

const milanoPresets: ThemePreset[] = [
  {
    Name: "Default",
    TitleFont: "Playfair Display",
    BodyFont: "Playfair Display",
    Appearance: "light",
    DarkBodyTextColor: "#ffffff",
    LightBodyTextColor: "#ffffff",
    DarkTitleTextColor: "#ffffff",
    LightTitleTextColor: "#ffffff",
    DarkBackgroundColor: "#1a1a1a",
    LightBackgroundColor: "#000000",
    DarkAccent1: "#ffffff",
    LightAccent1: "#ffffff",
    Accent1: "#f94144",
    Accent2: "#43aa8b",
    Accent3: "#f9c74f",
    Accent4: "#90be6d",
    Accent5: "#f8961e",
    Accent6: "#577590",
    LightBgGradient: ["#79BCD9", "#75C8AE", "#5A3D2B", "#D2AB1E", "#F4A127", "#E5771E", "#BF3131"],
    DarkBgGradient: ["#BF3131", "#E5771E", "#F4A127", "#D2AB1E", "#5A3D2B", "#75C8AE", "#79BCD9"]
  }
];

const milanoCSS = `
/* Milano Theme - High Fashion Aesthetic */
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400;1,700&display=swap');

.slide { font-family: 'Playfair Display', serif; }
.slide h1, .slide h2, .slide h3 { font-weight: 900; }

.layout-cover div, .layout-title div {
  border-bottom: 2px solid var(--accent1);
  border-top: 2px solid var(--accent1);
  padding: 1rem 0;
}

[class*='layout-'] h1 + h2, [class*='layout-'] h1 + h3 {
  font-style: italic;
}
`;


// ============================================
// NEW YORK THEME
// ============================================

const newYorkTemplate: ThemeTemplate = {
  Name: "New York",
  Version: "1.0.2",
  Author: "iA",
  ShortDescription: "Concrete jungle where dreams are made of",
  LongDescription: "Bold and energetic design inspired by NYC.\n- Different sizes for headlines\n- Dynamic yellow and black\n- Default font: Inter",
  Css: "newyork.css",
  TitleFont: "Inter",
  BodyFont: "Inter",
  CssClasses: "variable-size-headings"
};

const newYorkPresets: ThemePreset[] = [
  {
    Name: "Default",
    TitleFont: "Inter",
    BodyFont: "Inter",
    Appearance: "light",
    DarkBodyTextColor: "#ffffff",
    LightBodyTextColor: "#111111",
    DarkTitleTextColor: "#FFC400",
    LightTitleTextColor: "#000000",
    DarkBackgroundColor: "#000000",
    LightBackgroundColor: "#ffffff",
    DarkAccent1: "#FFC400",
    LightAccent1: "#FFC400",
    Accent1: "#f94144",
    Accent2: "#43aa8b",
    Accent3: "#f9c74f",
    Accent4: "#90be6d",
    Accent5: "#f8961e",
    Accent6: "#577590"
  }
];

const newYorkCSS = `
/* New York Theme - Urban Energy */
.slide { font-family: 'Inter', sans-serif; }
.slide h1, .slide h2, .slide h3 { font-weight: 800; text-transform: uppercase; }

.cover-container, .title-container, .section-container {
  background-color: var(--accent1) !important;
}
`;

// ============================================
// PARIS THEME
// ============================================

const parisTemplate: ThemeTemplate = {
  Name: "Paris",
  Version: "1.0.2",
  Author: "iA",
  ShortDescription: "City of Light",
  LongDescription: "Classic and classy design with elegant typography.\n- Different sizes for headlines\n- Subtle color background\n- Default font: Literata",
  Css: "paris.css",
  TitleFont: "Literata",
  BodyFont: "Literata",
  CssClasses: "variable-size-headings"
};

const parisPresets: ThemePreset[] = [
  {
    Name: "Default",
    TitleFont: "Literata",
    BodyFont: "Literata",
    Appearance: "light",
    DarkBodyTextColor: "#ffffff",
    LightBodyTextColor: "#11100E",
    DarkTitleTextColor: "#ffffff",
    LightTitleTextColor: "#11100E",
    DarkBackgroundColor: "#11100E",
    LightBackgroundColor: "#EBE7E7",
    DarkAccent1: "#6A6256",
    LightAccent1: "#EBE7E7",
    Accent1: "#6A6256",
    Accent2: "#43aa8b",
    Accent3: "#f9c74f",
    Accent4: "#90be6d",
    Accent5: "#f8961e",
    Accent6: "#577590"
  }
];

const parisCSS = `
/* Paris Theme - Classic & Classy */
@import url('https://fonts.googleapis.com/css2?family=Literata:ital,wght@0,300;0,400;0,700;1,400&display=swap');

.slide { font-family: 'Literata', serif; }
.slide h1 { text-transform: uppercase; font-weight: 700; }

.section-container {
  background-color: var(--accent1) !important;

}
`;

// ============================================
// SAN FRANCISCO THEME
// ============================================

const sanFranciscoTemplate: ThemeTemplate = {
  Name: "San Francisco",
  Version: "1.0.2",
  Author: "iA",
  ShortDescription: "Tech and Fog",
  LongDescription: "Colorful, bold, and different design.\n- High-tech aesthetic\n- San Francisco Metro line gradients\n- Default white on black\n- Default font: Inter",
  Css: "sanfrancisco.css",
  TitleFont: "Inter",
  BodyFont: "Inter",
  CssClasses: "variable-size-headings"
};

const sanFranciscoPresets: ThemePreset[] = [
  {
    Name: "Default",
    TitleFont: "Inter",
    BodyFont: "Inter",
    Appearance: "light",
    DarkBodyTextColor: "#ffffff",
    LightBodyTextColor: "#ffffff",
    DarkTitleTextColor: "#ffffff",
    LightTitleTextColor: "#ffffff",
    DarkBackgroundColor: "transparent",
    LightBackgroundColor: "transparent",
    DarkAccent1: "#ffffff",
    LightAccent1: "#ffffff",
    Accent1: "#f94144",
    Accent2: "#43aa8b",
    Accent3: "#f9c74f",
    Accent4: "#90be6d",
    Accent5: "#f8961e",
    Accent6: "#577590",
    LightBgGradient: ["#00A8FF", "#2E3BFF", "#5900FF", "#8300FF", "#BC00FF", "#E600DE", "#FF08A1", "#FF3852", "#FF5A19", "#FF8300", "#FFC400"],
    DarkBgGradient: ["#004B72", "#1C238D", "#320090", "#51009D", "#67008C", "#73006F", "#7D004E", "#7C0010", "#9E2D00", "#A45400", "#9D7900"]
  }
];

const sanFranciscoCSS = `
/* San Francisco Theme - Tech Bold */
.slide { font-family: 'Inter', sans-serif; }
.slide h1, .slide h2, .slide h3 { font-weight: 900; }

.cover-container, .title-container {
  background: linear-gradient(135deg, var(--accent1), var(--accent2)) !important;
}
`;


// ============================================
// VANCOUVER THEME
// ============================================

const vancouverTemplate: ThemeTemplate = {
  Name: "Vancouver",
  Version: "1.0.2",
  Author: "iA",
  ShortDescription: "Earthy and fresh",
  LongDescription: "Natural and organic design with Montserrat typography.\n- Different sizes for headlines\n- Dynamic earthy color backgrounds\n- Default font: Montserrat",
  Css: "vancouver.css",
  TitleFont: "Montserrat",
  BodyFont: "Montserrat",
  CssClasses: "variable-size-headings"
};

const vancouverPresets: ThemePreset[] = [
  {
    Name: "Default",
    TitleFont: "Montserrat",
    BodyFont: "Montserrat",
    Appearance: "light",
    DarkBodyTextColor: "#ffffff",
    LightBodyTextColor: "#222222",
    DarkTitleTextColor: "#ffffff",
    LightTitleTextColor: "#000000",
    DarkBackgroundColor: "#222222",
    LightBackgroundColor: "#f4f4f4",
    DarkAccent1: "#A7987C",
    LightAccent1: "#A7987C",
    Accent1: "#f94144",
    Accent2: "#43aa8b",
    Accent3: "#f9c74f",
    Accent4: "#90be6d",
    Accent5: "#f8961e",
    Accent6: "#577590",
    LightBgGradient: ["#CFCAC7", "#D7C7C4", "#BAC8C1", "#C9D1BF", "#EADFCE", "#E2E2E2"],
    DarkBgGradient: ["#4D4036", "#72483E", "#739382", "#8EA079", "#A6916A", "#848484"]
  }
];

const vancouverCSS = `
/* Vancouver Theme - Natural & Organic */
@import url('https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,300;0,400;0,700;1,400&display=swap');

.slide { font-family: 'Montserrat', sans-serif; }
.slide h1, .slide h2 { font-weight: 700; }

.section-container {
  background-color: var(--accent1) !important;

}
`;

// ============================================
// EXPORTS
// ============================================

function createBuiltInTheme(template: ThemeTemplate, presets: ThemePreset[], css: string): Theme {
  return {
    template,
    presets,
    css,
    basePath: '',
    isBuiltIn: true,
  };
}

export const builtInThemes: Record<string, Theme> = {
  zurich: createBuiltInTheme(zurichTemplate, zurichPresets, zurichCSS),
  tokyo: createBuiltInTheme(tokyoTemplate, tokyoPresets, tokyoCSS),
  berlin: createBuiltInTheme(berlinTemplate, berlinPresets, berlinCSS),
  minimal: createBuiltInTheme(minimalTemplate, minimalPresets, minimalCSS),
  helvetica: createBuiltInTheme(helveticaTemplate, helveticaPresets, helveticaCSS),
  basel: createBuiltInTheme(baselTemplate, baselPresets, baselCSS),
  copenhagen: createBuiltInTheme(copenhagenTemplate, copenhagenPresets, copenhagenCSS),
  garamond: createBuiltInTheme(garamondTemplate, garamondPresets, garamondCSS),
  la: createBuiltInTheme(laTemplate, laPresets, laCSS),
  milano: createBuiltInTheme(milanoTemplate, milanoPresets, milanoCSS),
  newyork: createBuiltInTheme(newYorkTemplate, newYorkPresets, newYorkCSS),
  paris: createBuiltInTheme(parisTemplate, parisPresets, parisCSS),
  sanfrancisco: createBuiltInTheme(sanFranciscoTemplate, sanFranciscoPresets, sanFranciscoCSS),
  vancouver: createBuiltInTheme(vancouverTemplate, vancouverPresets, vancouverCSS),
};

export function getBuiltInTheme(name: string): Theme | undefined {
  return builtInThemes[name.toLowerCase()];
}

export function getBuiltInThemeNames(): string[] {
  return Object.keys(builtInThemes);
}
