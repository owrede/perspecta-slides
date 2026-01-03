# Incremental Update System Design

## Current Behavior

The current system has basic incremental updates but still over-renders in many cases:

1. **On editor change**: Debounced 100ms, then:
   - Re-parses entire document
   - If slide count changed → full re-render of all views
   - If slide count same → updates only current slide

2. **Problems**:
   - Editing slide 3 still re-parses entire document
   - If slide count changes, ALL thumbnails re-render (expensive)
   - No content-based change detection (slide may not have actually changed)
   - Frontmatter changes trigger full re-render unnecessarily
   - Theme/layout changes on one slide re-render everything

## Proposed Architecture

### 1. Slide Content Hashing

Track a hash/fingerprint for each slide to detect actual changes:

```typescript
interface SlideFingerprint {
  contentHash: string;      // Hash of slide text content
  metadataHash: string;     // Hash of slide metadata (layout, mode, etc.)
  combinedHash: string;     // Combined for quick comparison
}

interface PresentationCache {
  frontmatterHash: string;
  slideFingerprints: SlideFingerprint[];
  slideCount: number;
}
```

### 2. Diff Algorithm

Compare old and new presentations to determine minimal updates:

```typescript
interface SlideDiff {
  type: 'none' | 'content-only' | 'structural';
  
  // For content-only changes
  modifiedIndices: number[];    // Slides whose content changed
  
  // For structural changes
  added: { index: number, slide: Slide }[];
  removed: number[];            // Old indices that were removed
  moved: { from: number, to: number }[];
  
  // Metadata
  frontmatterChanged: boolean;
  themeChanged: boolean;
}

function diffPresentations(oldCache: PresentationCache, newPresentation: Presentation): SlideDiff {
  // 1. Check frontmatter changes
  const newFrontmatterHash = hashFrontmatter(newPresentation.frontmatter);
  const frontmatterChanged = newFrontmatterHash !== oldCache.frontmatterHash;
  
  // 2. Quick check: same slide count?
  if (newPresentation.slides.length === oldCache.slideCount) {
    // Compare hashes slide by slide
    const modified = [];
    for (let i = 0; i < newPresentation.slides.length; i++) {
      const newHash = hashSlide(newPresentation.slides[i]);
      if (newHash !== oldCache.slideFingerprints[i]?.combinedHash) {
        modified.push(i);
      }
    }
    
    if (modified.length === 0 && !frontmatterChanged) {
      return { type: 'none', ... };
    }
    
    return { type: 'content-only', modifiedIndices: modified, ... };
  }
  
  // 3. Structural change: slides added/removed
  // Use LCS (Longest Common Subsequence) or simpler heuristic
  return computeStructuralDiff(oldCache, newPresentation);
}
```

### 3. Update Strategies

#### A. No Changes (`type: 'none'`)
- Do nothing
- Most common case when user is just navigating

#### B. Content-Only Changes (`type: 'content-only'`)
- Only re-render thumbnails for `modifiedIndices`
- Only re-render preview if current slide is in `modifiedIndices`
- Update inspector if current slide changed

```typescript
async applyContentOnlyUpdate(diff: SlideDiff, presentation: Presentation) {
  for (const idx of diff.modifiedIndices) {
    // Update thumbnail at index (no DOM restructuring)
    thumbnailNav.updateSlideContent(idx, presentation.slides[idx]);
    
    // Update preview only if this is the current slide
    if (idx === this.currentSlideIndex) {
      previewView.updateSlideContent(idx, presentation.slides[idx]);
    }
  }
}
```

#### C. Structural Changes (`type: 'structural'`)
- More complex DOM updates needed
- Process in order: removes, then adds, then moves
- Use document fragments for batch DOM operations

```typescript
async applyStructuralUpdate(diff: SlideDiff, presentation: Presentation) {
  // 1. Remove deleted slides (highest index first to preserve indices)
  for (const idx of diff.removed.sort((a, b) => b - a)) {
    thumbnailNav.removeSlideAt(idx);
  }
  
  // 2. Add new slides
  for (const { index, slide } of diff.added) {
    thumbnailNav.insertSlideAt(index, slide);
  }
  
  // 3. Update remaining modified content
  for (const idx of diff.modifiedIndices) {
    thumbnailNav.updateSlideContent(idx, presentation.slides[idx]);
  }
  
  // 4. Re-number all slides (simple loop, no iframe reload)
  thumbnailNav.renumberSlides();
}
```

### 4. ThumbnailNavigator Enhancements

Add methods for granular DOM manipulation:

```typescript
class ThumbnailNavigatorView {
  private slideElements: Map<number, HTMLElement> = new Map();
  
  // Update just the iframe content of a specific slide
  updateSlideContent(index: number, slide: Slide): void {
    const element = this.slideElements.get(index);
    if (!element) return;
    
    const iframe = element.querySelector('.thumbnail-iframe');
    iframe.srcdoc = this.renderer.renderThumbnailHTML(slide, index);
  }
  
  // Remove a slide element from the DOM
  removeSlideAt(index: number): void {
    const element = this.slideElements.get(index);
    element?.remove();
    
    // Shift map indices down
    this.reindexSlideElements();
  }
  
  // Insert a new slide element at position
  insertSlideAt(index: number, slide: Slide): void {
    const newElement = this.createThumbnailItem(slide, index);
    const container = this.getListContainer();
    
    const existingElement = this.slideElements.get(index);
    if (existingElement) {
      container.insertBefore(newElement, existingElement);
    } else {
      container.appendChild(newElement);
    }
    
    this.reindexSlideElements();
  }
  
  // Just update the number badge (no iframe reload)
  renumberSlides(): void {
    this.slideElements.forEach((el, idx) => {
      const badge = el.querySelector('.badge-text');
      if (badge) badge.textContent = String(idx + 1);
    });
  }
}
```

### 5. PresentationView Enhancements

Similar approach for the preview:

```typescript
class PresentationView {
  // Only update if current slide changed
  updateCurrentSlideIfNeeded(diff: SlideDiff, presentation: Presentation): void {
    if (!diff.modifiedIndices.includes(this.currentSlideIndex)) {
      return; // Current slide unchanged, skip
    }
    
    // Re-render just the current slide content
    const slideEl = this.getCurrentSlideElement();
    this.renderSlideContent(slideEl, presentation.slides[this.currentSlideIndex]);
  }
}
```

### 6. Hash Function

Simple fast hash for content comparison:

```typescript
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(36);
}

function hashSlide(slide: Slide): string {
  const content = slide.elements.map(e => e.content).join('|');
  const metadata = JSON.stringify(slide.metadata);
  return hashString(content + '||' + metadata);
}

function hashFrontmatter(fm: PresentationFrontmatter): string {
  return hashString(JSON.stringify(fm));
}
```

### 7. Integration Flow

```typescript
class PerspectaSlidesPlugin {
  private presentationCache: PresentationCache | null = null;
  
  private async updateSidebarsIncremental(file: TFile) {
    const content = await this.app.vault.read(file);
    const presentation = this.parser.parse(content);
    
    // Compute diff
    const diff = this.presentationCache 
      ? diffPresentations(this.presentationCache, presentation)
      : { type: 'structural', ... }; // First load = full render
    
    // Apply minimal updates based on diff type
    switch (diff.type) {
      case 'none':
        // Nothing changed, skip
        return;
        
      case 'content-only':
        await this.applyContentOnlyUpdate(diff, presentation);
        break;
        
      case 'structural':
        await this.applyStructuralUpdate(diff, presentation);
        break;
    }
    
    // Update cache for next comparison
    this.presentationCache = buildCache(presentation);
  }
}
```

### 8. Performance Expectations

| Scenario | Current | Proposed |
|----------|---------|----------|
| Type a character in slide 3 of 20 | Re-render all 20 thumbnails | Re-render 1 thumbnail |
| Navigate between slides | Re-render all | No re-render |
| Add a new slide | Re-render all | Add 1 DOM element, renumber |
| Delete a slide | Re-render all | Remove 1 DOM element, renumber |
| Change theme | Re-render all | Re-render all (correct) |
| No actual change (cursor move) | Re-render current | No re-render |

### 9. Edge Cases

1. **Rapid editing**: Debouncing already handles this (100ms delay)
2. **Large presentations**: Hash comparison is O(n) but fast
3. **Theme changes**: Detected via frontmatter hash, triggers full re-render
4. **Slide reordering**: Detected as structural change, handled via remove/insert
5. **Empty document**: Handle gracefully with empty state

### 10. Implementation Priority

1. **Phase 1**: Add hashing and cache infrastructure
2. **Phase 2**: Implement content-only updates (biggest win)
3. **Phase 3**: Implement structural updates with DOM manipulation
4. **Phase 4**: Optimize with virtual scrolling for 100+ slide presentations

## Files to Modify

- `src/utils/SlideHasher.ts` (new) - Hashing and diff logic
- `main.ts` - Update `updateSidebarsIncremental` to use diff
- `src/ui/ThumbnailNavigator.ts` - Add granular update methods
- `src/ui/PresentationView.ts` - Add granular update methods
