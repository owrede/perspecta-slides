// Core types for Perspecta Slides

export type ContentMode = 'ia-presenter' | 'advanced-slides';

export interface PresentationFrontmatter {
  title?: string;
  author?: string;
  date?: string;
  theme?: string;

  // Content mode: how to distinguish slide content from speaker notes
  contentMode?: ContentMode;

  // Typography - Fonts (overrides theme)
  titleFont?: string;
  titleFontWeight?: number;
  bodyFont?: string;
  bodyFontWeight?: number;
  headerFont?: string;  // Specific font for header (default: inherits body)
  headerFontWeight?: number;
  footerFont?: string;  // Specific font for footer (default: inherits body)
  footerFontWeight?: number;

  // Typography - Sizes (as percentage offset from defaults)
  titleFontSize?: number;   // % offset for all title/heading fonts (-50 to +50)
  bodyFontSize?: number;    // % offset for body text (-50 to +50)
  headerFontSize?: number;  // % offset for header text (-50 to +50)
  footerFontSize?: number;  // % offset for footer text (-50 to +50)

  // Legacy: fontSizeOffset affects all text (deprecated, use titleFontSize/bodyFontSize)
  fontSizeOffset?: number;

  // Typography - Spacing (in em)
  headlineSpacingBefore?: number;
  headlineSpacingAfter?: number;
  listItemSpacing?: number;
  lineHeight?: number;      // Line height multiplier (default: 1.1)

  // Typography - Margins (in em, absolute distance from slide edge)
  headerTop?: number;       // Distance of header from top edge (default: 2.5em)
  footerBottom?: number;    // Distance of footer from bottom edge (default: 2.5em)
  titleTop?: number;        // Distance of title from top edge (default: 5em)
  contentTop?: number;      // Distance of content from top edge (default: 12em)
  contentWidth?: number;    // Left/right margin for all content including header/footer (default: 5em)

  // Legacy: contentTopOffset as percentage (deprecated)
  contentTopOffset?: number;
  // Legacy: headerToEdge/footerToEdge (deprecated, use headerTop/footerBottom)
  headerToEdge?: number;
  footerToEdge?: number;

  // Semantic colors (overrides theme presets)
  // Light mode semantic colors
  lightLinkColor?: string;
  lightBulletColor?: string;
  lightBlockquoteBorder?: string;
  lightTableHeaderBg?: string;
  lightCodeBorder?: string;
  lightProgressBar?: string;

  // Dark mode semantic colors
  darkLinkColor?: string;
  darkBulletColor?: string;
  darkBlockquoteBorder?: string;
  darkTableHeaderBg?: string;
  darkCodeBorder?: string;
  darkProgressBar?: string;

  // Light mode colors
  lightBackground?: string;
  lightTitleText?: string;
  lightBodyText?: string;

  // Dark mode colors
  darkBackground?: string;
  darkTitleText?: string;
  darkBodyText?: string;

  // Per-heading colors (can be single color or gradient array)
  lightH1Color?: string[];
  lightH2Color?: string[];
  lightH3Color?: string[];
  lightH4Color?: string[];
  darkH1Color?: string[];
  darkH2Color?: string[];
  darkH3Color?: string[];
  darkH4Color?: string[];

  // Header/Footer text colors
  lightHeaderText?: string;
  lightFooterText?: string;
  darkHeaderText?: string;
  darkFooterText?: string;

  // Layout-specific backgrounds
  lightBgCover?: string;
  lightBgTitle?: string;
  lightBgSection?: string;
  darkBgCover?: string;
  darkBgTitle?: string;
  darkBgSection?: string;

  // Dynamic background gradient (color stops for gradient across slides)
  lightDynamicBackground?: string[]; // Array of color stops e.g., ['#ffffff', '#f0f0f0', '#e0e0e0']
  darkDynamicBackground?: string[];  // Array of color stops for dark mode
  useDynamicBackground?: 'light' | 'dark' | 'both' | 'none'; // Which mode uses dynamic bg
  dynamicBackgroundRestartAtSection?: boolean; // Restart gradient interpolation at each section slide

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

  // Image overlay settings
  imageOverlay?: string;           // Path to overlay image
  imageOverlayOpacity?: number;    // Opacity 0-100 (default 50 = 50% visible)
  imageOverlays?: {                // Multiple overlays for different aspect ratios
    path: string;
    aspectRatio?: '16:9' | '4:3' | '16:10';
  }[];
}

export interface SlideMetadata {
  layout?: SlideLayout;
  background?: string;
  backgroundOpacity?: number;
  backgroundFilter?: 'darken' | 'lighten' | 'blur' | 'none';
  mode?: 'light' | 'dark' | 'system';
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

  // Semantic colors (light mode)
  LightLinkColor: string;
  LightBulletColor: string;
  LightBlockquoteBorder: string;
  LightTableHeaderBg: string;
  LightCodeBorder: string;
  LightProgressBar: string;

  // Semantic colors (dark mode)
  DarkLinkColor: string;
  DarkBulletColor: string;
  DarkBlockquoteBorder: string;
  DarkTableHeaderBg: string;
  DarkCodeBorder: string;
  DarkProgressBar: string;

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
 * Theme mode preset for per-heading colors and layout backgrounds
 * (Used by custom themes loaded from theme.json)
 */
export interface ThemeModePreset {
  text: {
    h1: string[];
    h2: string[];
    h3: string[];
    h4: string[];
    body: string;
    header: string;
    footer: string;
  };
  backgrounds: {
    general: { type: 'solid' | 'gradient' | 'dynamic'; color?: string; colors?: string[] };
    cover: { type: 'solid' | 'gradient' | 'dynamic'; color?: string; colors?: string[] };
    title: { type: 'solid' | 'gradient' | 'dynamic'; color?: string; colors?: string[] };
    section: { type: 'solid' | 'gradient' | 'dynamic'; color?: string; colors?: string[] };
  };
  semanticColors: {
    link: string;
    bullet: string;
    blockquoteBorder: string;
    tableHeaderBg: string;
    codeBorder: string;
    progressBar: string;
  };
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
  /** Parsed theme.json data for custom themes (supports per-heading colors, etc.) */
  themeJsonData?: {
    presets: {
      light: ThemeModePreset;
      dark: ThemeModePreset;
    };
  };
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
  fontCacheFolder: string;
  debugSlideRendering: boolean;
  debugFontLoading: boolean;
  fontCache?: FontCacheData;
  // Debug topics (topic-specific debug logging)
  debugTopics?: {
    'presentation-view'?: boolean;
    'presentation-window'?: boolean;
    'slide-parsing'?: boolean;
    'font-loading'?: boolean;
    'renderer'?: boolean;
    'inspector'?: boolean;
    'thumbnail-navigator'?: boolean;
  };
}

/**
 * Font cache data stored in plugin settings
 */
export interface FontCacheData {
  fonts: Record<string, CachedFontData>;
}

export interface CachedFontData {
  name: string;
  displayName: string;
  sourceUrl: string;
  weights: number[];
  styles: string[];
  files: { weight: number; style: string; localPath: string; format: string }[];
  cachedAt: number;
}

export const DEFAULT_SETTINGS: PerspecaSlidesSettings = {
  defaultTheme: '',  // Empty = use CSS defaults
  showThumbnailNavigator: true,
  showInspector: true,
  defaultAspectRatio: '16:9',
  defaultContentMode: 'ia-presenter',
  exportIncludeSpeakerNotes: false,
  customThemesFolder: 'perspecta-themes',
  fontCacheFolder: 'perspecta-fonts',
  debugSlideRendering: false,
  debugFontLoading: false,
  fontCache: { fonts: {} },
  debugTopics: {
    'presentation-view': false,
    'presentation-window': false,
    'slide-parsing': false,
    'font-loading': false,
    'renderer': false,
    'inspector': false,
    'thumbnail-navigator': false,
  },
};

/**
 * Default semantic colors for when no theme is loaded
 */
export const DEFAULT_SEMANTIC_COLORS = {
  light: {
    link: '#0066cc',
    bullet: '#333333',
    blockquoteBorder: '#cccccc',
    tableHeaderBg: '#f0f0f0',
    codeBorder: '#e0e0e0',
    progressBar: '#0066cc',
  },
  dark: {
    link: '#66b3ff',
    bullet: '#e0e0e0',
    blockquoteBorder: '#555555',
    tableHeaderBg: '#333333',
    codeBorder: '#444444',
    progressBar: '#66b3ff',
  },
};
