// Core types for Perspecta Slides

export type ContentMode = 'ia-presenter' | 'advanced-slides';

export interface PresentationFrontmatter {
  title?: string;
  author?: string;
  date?: string;
  theme?: string;
  
  // Content mode: how to distinguish slide content from speaker notes
  contentMode?: ContentMode;
  
  // Typography (overrides theme)
  titleFont?: string;
  bodyFont?: string;
  
  // Font size offset as percentage (-50 to +50, e.g., -20 makes text 20% smaller)
  fontSizeOffset?: number;
  
  // Content top offset - pushes column content down (0 to 50, as percentage of slide height)
  contentTopOffset?: number;
  
  // Colors (overrides theme presets)
  accent1?: string;
  accent2?: string;
  accent3?: string;
  accent4?: string;
  accent5?: string;
  accent6?: string;
  
  // Light mode colors
  lightBackground?: string;
  lightTitleText?: string;
  lightBodyText?: string;
  
  // Dark mode colors
  darkBackground?: string;
  darkTitleText?: string;
  darkBodyText?: string;
  
  // Dynamic background gradient (color stops for gradient across slides)
  lightDynamicBackground?: string[]; // Array of color stops e.g., ['#ffffff', '#f0f0f0', '#e0e0e0']
  darkDynamicBackground?: string[];  // Array of color stops for dark mode
  useDynamicBackground?: 'light' | 'dark' | 'both' | 'none'; // Which mode uses dynamic bg
  
  // Header/Footer
  headerLeft?: string;
  headerMiddle?: string;
  headerRight?: string;
  footerLeft?: string;
  footerMiddle?: string;
  footerRight?: string;
  
  // Logo
  logo?: string;
  logoSize?: string;
  
  // Presentation settings
  aspectRatio?: '16:9' | '4:3' | '16:10' | 'auto';
  showProgress?: boolean;
  showSlideNumbers?: boolean;
  transition?: 'none' | 'fade' | 'slide';
  
  // Appearance mode (default for all slides, can be overridden per-slide)
  mode?: 'light' | 'dark' | 'system';
}

export interface SlideMetadata {
  layout?: SlideLayout;
  background?: string;
  backgroundOpacity?: number;
  backgroundFilter?: 'darken' | 'lighten' | 'blur' | 'none';
  mode?: 'light' | 'dark';
  class?: string;
  transition?: string;
  notes?: string;
}

/**
 * Slide Layout Types (iA Presenter compatible + column extensions)
 * 
 * STANDARD SLIDES:
 * - cover: Opening/title slide with centered content
 * - title: Title slide with large heading
 * - section: Chapter/section divider
 * - default: Standard text slide, auto-detects columns
 * 
 * COLUMN SLIDES (explicit column control):
 * - 1-column: Single column, no auto-detection
 * - 2-columns: Two equal width columns (50/50)
 * - 3-columns: Three equal width columns (33/33/33)
 * - 2-columns-1+2: Left narrow (1/3), right wide (2/3)
 * - 2-columns-2+1: Left wide (2/3), right narrow (1/3)
 * 
 * IMAGE SLIDES:
 * - full-image: Image fills entire slide
 * - half-image: Half for image(s), half for text (v-split)
 * - caption: Full image with title bar and caption
 * 
 * GRID SLIDES:
 * - grid: Auto-grid for multiple items (2x2, 2x3, etc.)
 */
export type SlideLayout = 
  // Standard slides (iA Presenter compatible)
  | 'cover'
  | 'title'
  | 'section'
  | 'default'
  // Column slides (Perspecta extension)
  | '1-column'
  | '2-columns'
  | '3-columns'
  | '2-columns-1+2'
  | '2-columns-2+1'
  // Image slides
  | 'full-image'
  | 'half-image'
  | 'half-image-horizontal'
  | 'caption'
  // Grid slides
  | 'grid';

/**
 * Image metadata for positioning and styling
 */
export interface ImageData {
  /** Original path/URL from markdown */
  src: string;
  /** Alt text */
  alt?: string;
  /** Sizing mode: cover (fill, crop) or contain (fit, letterbox) */
  size?: 'cover' | 'contain';
  /** Horizontal position: left, center, right, or percentage/pixels */
  x?: string;
  /** Vertical position: top, center, bottom, or percentage/pixels */
  y?: string;
  /** Zoom level as percentage (100 = no zoom) */
  zoom?: number;
  /** CSS filter effect */
  filter?: 'none' | 'darken' | 'lighten' | 'blur' | 'grayscale' | 'sepia';
  /** Opacity as percentage (0-100) */
  opacity?: number;
  /** On-image caption */
  caption?: string;
  /** Whether this is an Obsidian wiki-link (![[...]]) */
  isWikiLink?: boolean;
}

export interface SlideElement {
  type: 'heading' | 'paragraph' | 'list' | 'blockquote' | 'image' | 'code' | 'table' | 'math' | 'kicker';
  content: string;
  level?: number;
  visible: boolean;
  raw: string;
  columnIndex?: number;
  /** Image-specific metadata (only for type: 'image') */
  imageData?: ImageData;
}

export interface Slide {
  index: number;
  metadata: SlideMetadata;
  elements: SlideElement[];
  speakerNotes: string[];
  rawContent: string;
}

export interface Presentation {
  frontmatter: PresentationFrontmatter;
  slides: Slide[];
  source: string;
}

// ============================================
// THEME SYSTEM (iA Presenter compatible)
// ============================================

/**
 * Layout example for theme preview
 */
export interface ThemeLayoutExample {
  Name: string;
  Markdown: string;
}

/**
 * Theme template definition (template.json)
 */
export interface ThemeTemplate {
  Name: string;
  Version: string;
  Author?: string;
  ShortDescription?: string;
  LongDescription?: string;
  Css: string;
  TitleFont: string;
  BodyFont: string;
  CssClasses?: string;
  LayoutExamples?: ThemeLayoutExample[];
}

/**
 * Color preset (from presets.json)
 */
export interface ThemePreset {
  Name: string;
  TitleFont?: string;
  BodyFont?: string;
  Appearance: 'light' | 'dark';
  
  // Text colors
  DarkBodyTextColor: string;
  LightBodyTextColor: string;
  DarkTitleTextColor: string;
  LightTitleTextColor: string;
  
  // Background colors
  DarkBackgroundColor: string;
  LightBackgroundColor: string;
  
  // Accent colors (per-appearance and shared)
  DarkAccent1?: string;
  LightAccent1?: string;
  Accent1: string;
  Accent2: string;
  Accent3: string;
  Accent4: string;
  Accent5: string;
  Accent6: string;
  
  // Background gradients (array of colors)
  LightBgGradient?: string[];
  DarkBgGradient?: string[];
}

/**
 * Presets file structure (presets.json)
 */
export interface ThemePresetsFile {
  Presets: ThemePreset[];
}

/**
 * Loaded theme with all resources
 */
export interface Theme {
  template: ThemeTemplate;
  presets: ThemePreset[];
  css: string;
  basePath: string;
  thumbnail?: string;
  isBuiltIn: boolean;
}

// ============================================
// SETTINGS
// ============================================

export interface PerspecaSlidesSettings {
  defaultTheme: string;
  showThumbnailNavigator: boolean;
  showInspector: boolean;
  defaultAspectRatio: '16:9' | '4:3' | '16:10' | 'auto';
  defaultContentMode: ContentMode;
  exportIncludeSpeakerNotes: boolean;
  customThemesFolder: string;
  debugSlideRendering: boolean;
}

export const DEFAULT_SETTINGS: PerspecaSlidesSettings = {
  defaultTheme: 'zurich',
  showThumbnailNavigator: true,
  showInspector: true,
  defaultAspectRatio: '16:9',
  defaultContentMode: 'ia-presenter',
  exportIncludeSpeakerNotes: false,
  customThemesFolder: 'perspecta-themes',
  debugSlideRendering: false,
};
