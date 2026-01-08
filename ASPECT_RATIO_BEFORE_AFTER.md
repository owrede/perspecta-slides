# Aspect Ratio Lock - Before & After Comparison

## Visual Comparison

### Scenario: 16:9 Presentation in Fullscreen (1920×1200 window)

#### BEFORE (Broken)
```
┌────────────────────────────────────────────────────────┐
│                                                        │
│              Slides stretched 1920×1200                │
│              (distorted - not 16:9!)                   │
│                  ┌──────────────────┐                  │
│                  │   SLIDE DISTORTED│                  │
│                  │   (looks wrong!)  │                  │
│                  │                  │                  │
│                  └──────────────────┘                  │
│                                                        │
└────────────────────────────────────────────────────────┘

Problem:
- Slides stretched to 1920×1200
- Aspect ratio 1920÷1200 = 1.6:1 (not 16:9 = 1.777:1)
- Content distorted vertically
- User sees squashed/stretched presentation
```

#### AFTER (Fixed)
```
┌────────────────────────────────────────────────────────┐
│                     BLACK BORDER                       │
│                                                        │
│           ┌──────────────────────────────────┐         │
│           │     SLIDES 1920×1080 (16:9)      │         │
│           │                                  │         │
│           │   ✓ Proper aspect ratio          │         │
│           │   ✓ No distortion                │         │
│           │                                  │         │
│           └──────────────────────────────────┘         │
│                                                        │
│                     BLACK BORDER                       │
└────────────────────────────────────────────────────────┘

Solution:
- Slides properly sized to 1920×1080
- Maintains 16:9 aspect ratio exactly
- Black letterbox borders top and bottom (60px each)
- Content displayed perfectly
```

---

### Scenario: 4:3 Presentation in Portrait (800×1200 window)

#### BEFORE (Broken)
```
┌──────────────────┐
│  SLIDES STRETCHED│
│  TO 800×1200     │
│  (4:3 → 2:3      │
│   DISTORTED!)    │
│                  │
│                  │
│                  │
│                  │
│                  │
│                  │
│                  │
│                  │
│                  │
└──────────────────┘

Wrong aspect ratio
```

#### AFTER (Fixed)
```
┌──────────────────┐
│ BLACK PILLARBOX  │
│ ┌──────────────┐ │
│ │ SLIDES       │ │
│ │ 800×600      │ │
│ │ (proper 4:3) │ │
│ │              │ │
│ │              │ │
│ └──────────────┘ │
│ BLACK PILLARBOX  │
│ (300px each)     │
└──────────────────┘

Correct aspect ratio
```

---

## Code Changes Comparison

### CSS Before
```css
.slides-container {
  position: relative;
  width: 90%;
  height: 90%;
  aspect-ratio: 16 / 9;
}
```

**Problem**: Fixed 90% dimensions don't account for window size or aspect ratio. The browser tries to apply aspect-ratio but the fixed 90% defeats the purpose.

### CSS After
```css
.slides-container {
  position: relative;
  /* Maintain aspect ratio with automatic letterboxing */
  aspect-ratio: 16 / 9;
  /* Calculate the largest dimension that fits in the window */
  width: min(100vw, calc(100vh * 16 / 9));
  height: min(100vh, calc(100vw * 9 / 16));
  /* Ensure it doesn't exceed window bounds */
  max-width: 100vw;
  max-height: 100vh;
}
```

**Benefits**:
- `aspect-ratio` enforces the ratio
- `width` calc ensures width doesn't exceed optimal
- `height` calc ensures height doesn't exceed optimal
- `min()` chooses whichever constraint is tighter
- Automatic letterboxing via flexbox + black background

---

## Mathematical Explanation

### For Window W_win × H_win and Aspect Ratio W:H

The slide container should be:
```
slide_width = min(100vw, calc(100vh * W / H))
slide_height = min(100vh, calc(100vw * H / W))
```

This means:
1. **Width Constraint**: Either fill entire viewport width, or fit the aspect ratio based on height
   - If window is wider than needed: `100vh * W / H` is smaller
   - If window is narrower: `100vw` is smaller (pillarbox)

2. **Height Constraint**: Either fill entire viewport height, or fit the aspect ratio based on width
   - If window is taller than needed: `100vw * H / W` is smaller
   - If window is shorter: `100vh` is smaller (letterbox)

3. **Result**: Always maintains aspect ratio, uses available space efficiently

### Example: 16:9 in 1920×1200
```
width = min(1920, 1200 * 16/9)
      = min(1920, 2133)
      = 1920  (window width wins)

height = min(1200, 1920 * 9/16)
       = min(1200, 1080)
       = 1080  (aspect ratio wins)

Final: 1920×1080 slides
Letterbox: (1200-1080)/2 = 60px top, 60px bottom
```

---

## Real-World Use Cases

### Professional Presentation
- **Setting**: Conference with 16:9 projector
- **Before**: Slides distorted, looks unprofessional
- **After**: Perfect 16:9 display, professional appearance ✓

### Weird Monitor
- **Setting**: Old 4:3 monitor with 16:9 slides
- **Before**: Slides stretched horizontally, hard to read
- **After**: Black borders but slides readable ✓

### Multi-Monitor Setup
- **Setting**: Different aspect ratio displays
- **Before**: Each window shows distorted slides
- **After**: Each window maintains proper ratio ✓

### Fullscreen Mode
- **Setting**: Presentation goes fullscreen
- **Before**: Fullscreen still distorted
- **After**: Fullscreen with perfect aspect ratio ✓

---

## Configuration

### Enable Aspect Ratio Lock

In presentation frontmatter:
```yaml
---
lockAspectRatio: true
aspectRatio: 16:9
---
```

Or other ratios:
```yaml
lockAspectRatio: true
aspectRatio: 4:3
```

### Disable (Default Behavior)
```yaml
lockAspectRatio: false
```
Or just omit it - stretches to fill window (old behavior)

---

## Testing Checklist

- [ ] Open 16:9 presentation fullscreen → no distortion
- [ ] Resize window → aspect ratio maintained
- [ ] Letterbox appears when window too wide
- [ ] Pillarbox appears when window too tall
- [ ] Black borders visible where needed
- [ ] All supported ratios (16:9, 4:3, 16:10) work
- [ ] lockAspectRatio: false still stretches (backward compat)
- [ ] On Windows, macOS, Linux
- [ ] In Obsidian presentation window

---

## Summary

| Aspect | Before | After |
|--------|--------|-------|
| Aspect Ratio | ✗ Distorted | ✓ Maintained |
| Fullscreen | ✗ Still distorted | ✓ Proper ratio |
| Letterboxing | ✗ None | ✓ Black borders |
| Window Resize | ✗ Distorts | ✓ Maintains ratio |
| Professional | ✗ Looks wrong | ✓ Looks perfect |
| Backward Compat | N/A | ✓ Full support |
