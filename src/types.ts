// Core types for Perspecta Slides

export interface PresentationFrontmatter {
  title?: string;
  author?: string;
  date?: string;
  theme?: string;
  
  // Typography
  titleFont?: string;
  bodyFont?: string;
  
  // Colors (iA Presenter style)
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
  lightFrame?: string;
  
  // Dark mode colors
  darkBackground?: string;
  darkTitleText?: string;
  darkBodyText?: string;
  darkFrame?: string;
  
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
}

export interface SlideMetadata {
  layout?: SlideLayout;
  background?: string;
  backgroundOpacity?: number;
  mode?: 'light' | 'dark';
  class?: string;
  transition?: string;
  notes?: string;
}

export type SlideLayout = 
  | 'default'
  | 'title'
  | 'section'
  | 'v-split'
  | 'h-split'
  | 'caption'
  | 'full-image'
  | 'title-and-columns'
  | 'grid';

export interface SlideElement {
  type: 'heading' | 'paragraph' | 'list' | 'blockquote' | 'image' | 'code' | 'table' | 'math';
  content: string;
  level?: number; // For headings
  visible: boolean; // Whether it appears on slide (vs speaker notes)
  raw: string;
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

export interface Theme {
  name: string;
  version: string;
  author?: string;
  description?: string;
  css: string;
  fonts?: {
    title?: string;
    body?: string;
  };
  colors?: {
    accent1?: string;
    accent2?: string;
    accent3?: string;
    accent4?: string;
    accent5?: string;
    accent6?: string;
  };
  layouts?: Record<SlideLayout, string>;
}

export interface PerspecaSlidesSettings {
  defaultTheme: string;
  showThumbnailNavigator: boolean;
  showInspector: boolean;
  defaultAspectRatio: '16:9' | '4:3' | '16:10' | 'auto';
  exportIncludeSpeakerNotes: boolean;
  customThemesFolder: string;
}

export const DEFAULT_SETTINGS: PerspecaSlidesSettings = {
  defaultTheme: 'zurich',
  showThumbnailNavigator: true,
  showInspector: true,
  defaultAspectRatio: '16:9',
  exportIncludeSpeakerNotes: false,
  customThemesFolder: 'perspecta-themes',
};
