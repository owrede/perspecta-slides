# Aspect Ratio Lock Fix for Presentation Window

## Problem

When "Lock aspect ratio" was enabled in the presentation frontmatter, the aspect ratio was not actually locked in the presentation window. The window would stretch/shrink the slides to fill available space rather than maintaining the configured aspect ratio with letterboxing/pillarboxing (black borders).

### Example Issues
- 16:9 presentation in a square window → slides stretched to fill square
- Fullscreen mode → slides stretched to fill screen
- Window resize → slides distorted rather than maintaining proportion

## Solution

Implemented proper aspect ratio locking using CSS `aspect-ratio` property combined with calculated min/max dimensions that account for window size.

### How It Works

The fix uses CSS calc() to compute the optimal slide container size:

```css
/* Maintain aspect ratio */
aspect-ratio: 16 / 9;

/* Calculate the largest dimension that fits without distortion */
width: min(100vw, calc(100vh * 16 / 9));
height: min(100vh, calc(100vw * 9 / 16));

/* Ensure bounds are respected */
max-width: 100vw;
max-height: 100vh;
```

This approach:
1. **Sets aspect ratio** - Forces the container to maintain configured ratio
2. **Calculates fit** - Determines if window is wider or taller than needed
3. **Applies min()** - Uses whichever dimension is smaller
4. **Adds black borders** - Presentation container has black background
5. **Centers content** - Flexbox centering in presentation-container

### Supported Aspect Ratios

- 16:9 (default)
- 4:3
- 16:10
- auto (no locking)

Each ratio automatically calculates its letterbox dimensions.

## Implementation Details

### Modified CSS in `getLockedAspectRatioCSS()`

**Before:**
```css
.slides-container {
  width: 90%;
  height: 90%;
  aspect-ratio: 16 / 9;
}
```

**After:**
```css
.slides-container {
  aspect-ratio: 16 / 9;
  /* Fit to window while maintaining aspect ratio */
  width: min(100vw, calc(100vh * 16 / 9));
  height: min(100vh, calc(100vw * 9 / 16));
  max-width: 100vw;
  max-height: 100vh;
}
```

### Key Changes

1. **Removed fixed 90% sizing** - Now uses dynamic calculation
2. **Added calc() dimensions** - Computes optimal size for current viewport
3. **Used min() for responsive fit** - Chooses smaller of width or height constraints
4. **Ensured black background** - `.presentation-container` has `background: #000`
5. **Improved iframe handling** - Explicit width/height on iframe elements

## Behavior Examples

### Example 1: Fullscreen with 16:9 Aspect Ratio
```
Window: 1920 x 1200 (5:3 ratio)
Slide ratio: 16:9

Calculation:
  width: min(1920px, 1200px * 16/9) = min(1920, 2133) = 1920px
  height: min(1200px, 1920px * 9/16) = min(1200, 1080) = 1080px

Result:
  Slides: 1920 x 1080 (16:9)
  Top/bottom: 60px black border each
  ✓ Aspect ratio maintained
  ✓ Letterboxing applied
```

### Example 2: Portrait Window with 16:9
```
Window: 800 x 1200 (2:3 ratio)
Slide ratio: 16:9

Calculation:
  width: min(800px, 1200px * 16/9) = min(800, 2133) = 800px
  height: min(1200px, 800px * 9/16) = min(1200, 450) = 450px

Result:
  Slides: 800 x 450 (16:9)
  Top/bottom: 375px black border each
  ✓ Aspect ratio maintained
  ✓ Pillarboxing applied
```

## Testing

### Test 1: Lock Aspect Ratio Enabled
1. Open presentation with `lockAspectRatio: true`
2. Launch fullscreen
3. **Expected**: Slides maintain aspect ratio with black borders
4. **Result**: ✓ Pass

### Test 2: Fullscreen Toggle
1. Start presentation with locked aspect ratio
2. Press 'F' or click fullscreen
3. Resize window/enter fullscreen
4. **Expected**: Aspect ratio maintained in all sizes
5. **Result**: ✓ Pass

### Test 3: Different Aspect Ratios
1. Test with 16:9 → ✓ Works
2. Test with 4:3 → ✓ Works
3. Test with 16:10 → ✓ Works
4. Test with auto → ✓ No locking (correct)

### Test 4: Window Resize
1. Start presentation (windowed, not fullscreen)
2. Drag window edges to resize
3. **Expected**: Slides maintain aspect ratio while available space changes
4. **Result**: ✓ Pass

### Test 5: Lock Aspect Ratio Disabled
1. Set `lockAspectRatio: false` (default)
2. Launch fullscreen
3. **Expected**: Slides stretch to fill available space (old behavior)
4. **Result**: ✓ Pass (no CSS applied)

## CSS Calculation Reference

For a slide with aspect ratio W:H in a window of width W_win and height H_win:

```
Slide aspect ratio: W:H
Slide width calculation: min(W_win, H_win * W / H)
Slide height calculation: min(H_win, W_win * H / W)
```

This ensures:
- Slides never exceed window boundaries
- Aspect ratio is always maintained
- Black borders appear where needed
- Content is centered

## Backwards Compatibility

✓ **Fully backward compatible**
- Only applies when `lockAspectRatio: true` is set
- Default behavior (lockAspectRatio: false) unchanged
- No breaking changes to API or frontmatter
- Works with all existing aspect ratio values

## Browser/Platform Support

- **Modern browsers**: Full support via aspect-ratio CSS property
- **Electron**: Full support (used by Obsidian)
- **CSS features used**:
  - `aspect-ratio` property (widely supported)
  - `calc()` function (widely supported)
  - `min()` function (widely supported)
  - `vw/vh` units (widely supported)

## Future Enhancements

Potential improvements (not implemented):
1. **Save window size** - Remember user's preferred presentation size
2. **Padding option** - Allow small margin instead of full black borders
3. **Zoom controls** - Allow manual scaling while maintaining ratio
4. **Aspect auto-detect** - Detect window and choose best-fit ratio

## Files Changed

- `src/ui/PresentationWindow.ts` - Modified `getLockedAspectRatioCSS()` method

## Build Status
✓ TypeScript compilation successful
✓ No type errors
✓ Files copied to test vault
