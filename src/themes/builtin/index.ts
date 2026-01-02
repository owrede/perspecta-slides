import { Theme, ThemeTemplate, ThemePreset } from '../../types';

// ============================================
// ZURICH THEME (iA Presenter format)
// ============================================

const zurichTemplate: ThemeTemplate = {
  Name: "Zurich",
  Version: "1.0.0",
  Author: "Perspecta Slides",
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
  DarkBodyTextColor: "#000000",
  LightBodyTextColor: "#ffffff",
  DarkTitleTextColor: "#000000",
  LightTitleTextColor: "#ffffff",
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
  color: var(--light-background);
}

/* Cycling section colors */
.slide:nth-child(6n+1).section-container { background: var(--accent1) !important; }
.slide:nth-child(6n+2).section-container { background: var(--accent2) !important; }
.slide:nth-child(6n+3).section-container { background: var(--accent3) !important; color: var(--dark-background); }
.slide:nth-child(6n+4).section-container { background: var(--accent4) !important; color: var(--dark-background); }
.slide:nth-child(6n+5).section-container { background: var(--accent5) !important; color: var(--dark-background); }
.slide:nth-child(6n+6).section-container { background: var(--accent6) !important; }

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
  Version: "1.0.0",
  Author: "Perspecta Slides",
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
  DarkBodyTextColor: "#000000",
  LightBodyTextColor: "#ffffff",
  DarkTitleTextColor: "#000000",
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
  color: var(--light-title-text);
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
  color: white;
}

.layout-cover h1, .layout-cover h2,
.layout-title h1, .layout-title h2 {
  font-size: clamp(2.5rem, 5vw + 1.5vh, 6rem);
  font-weight: 800;
  color: white !important;
  background: none;
  -webkit-text-fill-color: white;
}

/* Section slides */
.section-container {
  background: var(--accent2) !important;
}

.section-container .slide-content {
  justify-content: center;
  align-items: center;
  text-align: center;
  color: white;
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
  color: white;
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
  color: white;
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
};

export function getBuiltInTheme(name: string): Theme | undefined {
  return builtInThemes[name.toLowerCase()];
}

export function getBuiltInThemeNames(): string[] {
  return Object.keys(builtInThemes);
}
