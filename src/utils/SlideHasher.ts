import { Presentation, Slide, PresentationFrontmatter } from '../types';

/**
 * SlideHasher - Utility for detecting changes between presentation states
 * 
 * Uses content hashing to determine which slides actually changed,
 * enabling incremental updates instead of full re-renders.
 */

export interface SlideFingerprint {
  contentHash: string;
  metadataHash: string;
  combinedHash: string;
}

export interface PresentationCache {
  frontmatterHash: string;
  slideFingerprints: SlideFingerprint[];
  slideCount: number;
}

export type DiffType = 'none' | 'content-only' | 'structural';

export interface SlideDiff {
  type: DiffType;
  
  // For content-only changes: indices of slides whose content changed
  modifiedIndices: number[];
  
  // For structural changes
  addedIndices: number[];      // Indices where new slides were inserted
  removedIndices: number[];    // Old indices that were removed
  
  // Metadata changes
  frontmatterChanged: boolean;
  themeChanged: boolean;
}

/**
 * Simple fast hash function for strings
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(36);
}

/**
 * Generate a fingerprint for a single slide
 */
export function hashSlide(slide: Slide): SlideFingerprint {
  // Hash the content (all elements joined)
  const contentParts: string[] = [];
  for (const element of slide.elements) {
    contentParts.push(element.type + ':' + element.content + ':' + element.raw);
  }
  // Also include speaker notes in the hash
  contentParts.push('notes:' + slide.speakerNotes.join('|'));
  const contentHash = hashString(contentParts.join('||'));
  
  // Hash the metadata (including hidden state)
  const metadataWithHidden = { ...slide.metadata, hidden: slide.hidden };
  const metadataHash = hashString(JSON.stringify(metadataWithHidden));
  
  // Combined hash for quick comparison
  const combinedHash = hashString(contentHash + '::' + metadataHash);
  
  return { contentHash, metadataHash, combinedHash };
}

/**
 * Generate a hash for frontmatter
 */
export function hashFrontmatter(fm: PresentationFrontmatter): string {
  return hashString(JSON.stringify(fm));
}

/**
 * Build a cache from a presentation for future comparisons
 */
export function buildPresentationCache(presentation: Presentation): PresentationCache {
  return {
    frontmatterHash: hashFrontmatter(presentation.frontmatter),
    slideFingerprints: presentation.slides.map(slide => hashSlide(slide)),
    slideCount: presentation.slides.length,
  };
}

/**
 * Compare two presentations and determine what changed
 */
export function diffPresentations(
  oldCache: PresentationCache,
  newPresentation: Presentation
): SlideDiff {
  const newFrontmatterHash = hashFrontmatter(newPresentation.frontmatter);
  const frontmatterChanged = newFrontmatterHash !== oldCache.frontmatterHash;
  
  // Check if theme specifically changed (subset of frontmatter)
  const themeChanged = frontmatterChanged; // Simplified: any frontmatter change could affect theme
  
  const newSlideCount = newPresentation.slides.length;
  const oldSlideCount = oldCache.slideCount;
  
  // Generate fingerprints for new slides
  const newFingerprints = newPresentation.slides.map(slide => hashSlide(slide));
  
  // Case 1: Same slide count - check for content changes only
  if (newSlideCount === oldSlideCount) {
    const modifiedIndices: number[] = [];
    
    for (let i = 0; i < newSlideCount; i++) {
      if (newFingerprints[i].combinedHash !== oldCache.slideFingerprints[i]?.combinedHash) {
        modifiedIndices.push(i);
      }
    }
    
    // No changes at all
    if (modifiedIndices.length === 0 && !frontmatterChanged) {
      return {
        type: 'none',
        modifiedIndices: [],
        addedIndices: [],
        removedIndices: [],
        frontmatterChanged: false,
        themeChanged: false,
      };
    }
    
    // Content-only changes
    return {
      type: 'content-only',
      modifiedIndices,
      addedIndices: [],
      removedIndices: [],
      frontmatterChanged,
      themeChanged,
    };
  }
  
  // Case 2: Structural change - slides added or removed
  // Use a simple heuristic: find which slides match by hash
  const oldHashes = oldCache.slideFingerprints.map(fp => fp.combinedHash);
  const newHashes = newFingerprints.map(fp => fp.combinedHash);
  
  // Find slides that exist in both (by hash)
  const matchedOldIndices = new Set<number>();
  const matchedNewIndices = new Set<number>();
  const modifiedIndices: number[] = [];
  
  // First pass: find exact matches
  for (let newIdx = 0; newIdx < newHashes.length; newIdx++) {
    const hash = newHashes[newIdx];
    for (let oldIdx = 0; oldIdx < oldHashes.length; oldIdx++) {
      if (!matchedOldIndices.has(oldIdx) && oldHashes[oldIdx] === hash) {
        matchedOldIndices.add(oldIdx);
        matchedNewIndices.add(newIdx);
        break;
      }
    }
  }
  
  // Removed slides: old indices not matched
  const removedIndices: number[] = [];
  for (let i = 0; i < oldSlideCount; i++) {
    if (!matchedOldIndices.has(i)) {
      removedIndices.push(i);
    }
  }
  
  // Added slides: new indices not matched
  const addedIndices: number[] = [];
  for (let i = 0; i < newSlideCount; i++) {
    if (!matchedNewIndices.has(i)) {
      addedIndices.push(i);
    }
  }
  
  return {
    type: 'structural',
    modifiedIndices,
    addedIndices,
    removedIndices,
    frontmatterChanged,
    themeChanged,
  };
}

/**
 * Check if a diff requires a full re-render
 * (e.g., theme changed, too many structural changes)
 */
export function requiresFullRender(diff: SlideDiff): boolean {
  // Theme changes require full re-render of all slides
  if (diff.themeChanged) {
    return true;
  }
  
  // Large structural changes - simpler to re-render all
  if (diff.addedIndices.length > 5 || diff.removedIndices.length > 5) {
    return true;
  }
  
  return false;
}
