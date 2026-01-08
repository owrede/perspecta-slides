# Testing the Initialization Context Fix

## Quick Test Scenarios

### Test 1: Cold Start with Visible Document
**Setup:**
1. Have a slide presentation file open in Obsidian (.md with slides)
2. Completely close Obsidian

**Test:**
1. Reopen Obsidian
2. The slide file is visible in the editor but not focused (another pane has focus, or just overall focus)

**Expected Result:**
- Navigator view opens automatically with all slides visible ✓
- Inspector view shows presentation settings ✓
- Preview pane shows slides rendered with theme colors ✓
- NO need to click "Open presentation view" or move cursor ✓

**What Should NOT Happen:**
- ✗ Empty navigator
- ✗ Empty inspector
- ✗ Black/missing theme in preview
- ✗ Need to click anything to "fix" it

---

### Test 2: Toggle Navigator Without Active Focus
**Setup:**
1. Obsidian open with slide file visible but not focused
2. Navigator is currently closed

**Test:**
1. Toggle navigator using command palette or keyboard shortcut
2. Command: "Toggle slide navigator"

**Expected Result:**
- Navigator opens immediately ✓
- Shows all slides ✓
- Theme/layout displays correctly ✓
- No empty state or errors ✓

**Debug Info:**
- Plugin searches workspace and finds the visible markdown file
- Sets it as the context for initialization
- Calls `updateSidebarsWithContext(file, true)` to force slide 0

---

### Test 3: Toggle Inspector Without Active Focus
**Setup:**
1. Obsidian open with slide file visible but not focused
2. Inspector is currently closed

**Test:**
1. Toggle inspector using command palette or keyboard shortcut
2. Command: "Toggle slide inspector"

**Expected Result:**
- Inspector opens immediately ✓
- Shows presentation settings (theme, fonts, colors) ✓
- All frontmatter fields visible ✓
- No empty state ✓

---

### Test 4: Multiple Documents in Split View
**Setup:**
1. Split view with two markdown files (or one slide file + one note)
2. Neither file is currently focused

**Test:**
1. Toggle navigator or inspector
2. Observe which file is used for initialization

**Expected Result:**
- One of the visible markdown files is found ✓
- Navigator/Inspector initialize with that file's content ✓
- Works reliably even with multiple files visible ✓

---

### Test 5: Switching Between Documents
**Setup:**
1. Have two slide presentation files open
2. File A has "blue" theme, File B has "red" theme
3. Currently focused on File A

**Test:**
1. Click to focus on File B
2. Toggle navigator (or it was already open)
3. Check that File B's theme is displayed

**Expected Result:**
- `lastUsedSlideDocument` updates to File B ✓
- Navigator shows File B's content ✓
- Theme colors match File B (not File A) ✓
- Inspector shows File B's settings ✓

---

### Test 6: Cursor-Based Selection (No Regression)
**Setup:**
1. Open a slide file and focus it (cursor active)
2. Place cursor on slide 5
3. Navigator is open

**Test:**
1. Observe navigator selection
2. Move cursor to slide 7
3. Observe navigator selection updates

**Expected Result:**
- Navigator selects slide 5 initially ✓
- When cursor moves to slide 7, navigator updates to slide 7 ✓
- No changes to cursor-based slide selection ✓
- Full backward compatibility ✓

---

## Testing Checklist

### Startup Scenarios
- [ ] Close Obsidian with slide file visible → Reopen → Works immediately
- [ ] Cold start with file in left pane (navigator pane) → Works
- [ ] Cold start with file in main editor → Works
- [ ] Cold start with file in right pane → Works

### Toggle Scenarios
- [ ] Toggle navigator with focused file → Works
- [ ] Toggle navigator with unfocused file → Works (uses visible file)
- [ ] Toggle navigator with no file open → Shows no slides (correct)
- [ ] Toggle inspector with focused file → Works
- [ ] Toggle inspector with unfocused file → Works (uses visible file)
- [ ] Toggle inspector with no file open → Shows no settings (correct)

### Multi-File Scenarios
- [ ] Two slides visible in split view → Works with either
- [ ] Slide + Note in split view → Works with slide file
- [ ] Switch between slides with focus → Correctly updates context
- [ ] Open new slide file → Updates lastUsedSlideDocument

### Regression Tests
- [ ] Normal editing with cursor → Still follows cursor position
- [ ] Cursor jumps to slide 5 → Navigator selects slide 5
- [ ] Right-click on slide in navigator → Still opens context menu
- [ ] Double-click to start presentation → Still works normally
- [ ] Theme editing in inspector → Settings still save correctly

### Edge Cases
- [ ] All slide files closed → gracefully handles null
- [ ] Split view with many files → Finds markdown correctly
- [ ] Fast clicking navigator toggle → No duplicate opens
- [ ] Very large slide files → Performance acceptable

---

## Debugging Information

If something doesn't work, check:

### In DevTools Console
```typescript
// Check if lastUsedSlideDocument is set
plugin.lastUsedSlideDocument  // Should be a TFile object

// Check visible markdown files
const allLeaves = app.workspace.getLeavesOfType('markdown');
console.log('Visible markdown files:', 
  allLeaves.map(l => l.view?.file?.path));
```

### Check Plugin Logs
- Look in Obsidian developer console
- Plugin may log initialization steps if debug mode is enabled
- Check `DebugService` for 'presentation-view' topic logs

### Manual Testing Script
```javascript
// In Obsidian console, run this to test findVisibleMarkdownFile
const plugin = app.plugins.getPlugin('perspecta-slides');
const file = plugin.findVisibleMarkdownFile();
console.log('Found visible file:', file?.path);
```

---

## Known Limitations

1. **Only finds first visible markdown file** - If multiple files are visible, picks the first one found
2. **No per-file preferences** - Uses first found, not necessarily the one you want
3. **Workspace search scope** - Only searches leaves already in workspace (not vault-wide search)

These are acceptable tradeoffs for automatic initialization.

---

## What Changed

### Files Modified
- `main.ts` - Core initialization logic added

### New Methods
- `findVisibleMarkdownFile()` - Searches workspace for markdown files
- `initializeLastUsedDocument()` - Initializes on startup
- `updateSidebarsWithContext()` - Controls slide context

### Modified Methods
- `openPresentationView()` - Now tracks document and forces first slide
- `toggleThumbnailNavigator()` - Multi-tier fallback + first slide context
- `toggleInspector()` - Multi-tier fallback + first slide context
- `onLayoutReady()` - Now initializes lastUsedSlideDocument

---

## Success Criteria

The fix is working if:
1. ✅ Navigator/Inspector/Preview initialize without manual clicks on startup
2. ✅ Toggling navigator/inspector without active focus finds the visible file
3. ✅ Theme colors and typography load immediately
4. ✅ Cursor-based selection still works during normal editing
5. ✅ No performance degradation
6. ✅ No errors in console
