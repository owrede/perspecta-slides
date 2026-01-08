# Corrected Approach: Tracking Actual Usage Only

## Key Insight

`lastUsedSlideDocument` should **ONLY** track when a file is actually being **used** (opened, edited, presented), NOT when a file is temporarily found visible in the workspace.

## What Changed from Initial Implementation

### Before (Incorrect)
```
Startup: Scan workspace, find visible file, store as lastUsedSlideDocument
Result: Tracking is artificial - file wasn't actually being used
```

### After (Correct)
```
Startup: Do nothing - don't scan or store anything
When user opens/edits/presents: Track as lastUsedSlideDocument
When toggling view without active file: 
  - Temporarily use findVisibleMarkdownFile() as fallback
  - Do NOT store it as "used"
Result: Only tracks actual usage
```

## Implementation Details

### What `lastUsedSlideDocument` Tracks

**Set When:**
1. `openPresentationView(file)` - User opens presentation view
2. `active-leaf-change` event - User focuses on a markdown file
3. `updateSidebars(file)` - User is editing (cursor changes)

**NOT Set When:**
- Startup/initialization
- Visible file is found for fallback
- Any automatic discovery

### View Toggle Fallback (3 Levels)

```
toggleNavigator() / toggleInspector():
  Level 1: Is a file currently active?
    YES → Use it
    NO → Go to Level 2
  
  Level 2: Is there a visible markdown file?
    YES → Use it (temporarily, don't track as "used")
    NO → Go to Level 3
  
  Level 3: Was a file used previously?
    YES → Use lastUsedSlideDocument
    NO → Show empty (correct behavior)
```

### Key Distinction

**Visible File Search** ≠ **Last Used File**
- `findVisibleMarkdownFile()` - Temporary fallback, for initialization
- `lastUsedSlideDocument` - Persistent history, from actual usage

A visible file may be found and used for temporary display, but it doesn't change the "last used" history.

## Code Changes

### Removed
```typescript
// No longer initializes on startup
this.initializeLastUsedDocument();  // DELETED
```

### Removed Method
```typescript
private initializeLastUsedDocument(): void { }  // DELETED
```

### Updated Toggle Methods
```typescript
toggleNavigator() {
  // Level 1: Active file?
  let file = this.app.workspace.getActiveFile();
  
  // Level 2: Visible file? (NOT tracked as "used")
  if (!file || file.extension !== 'md') {
    file = this.findVisibleMarkdownFile();
  }
  
  // Level 3: Last used file? (actual usage history)
  if (!file && this.lastUsedSlideDocument) {
    file = this.lastUsedSlideDocument;
  }
  
  if (file) {
    await this.updateSidebarsWithContext(file, true);
  }
}
```

## Usage Scenarios

### Scenario 1: Cold Start, Visible But Unfocused
```
Start Obsidian → Slide file visible but unfocused
  lastUsedSlideDocument = null (never used)

User clicks navigator toggle:
  1. No active file
  2. Visible file found
  3. Use for display (don't track as "used")
  4. Navigator shows slides
  
User then opens/edits the file:
  lastUsedSlideDocument = now set
```

### Scenario 2: Multiple Sessions
```
Session 1:
  Open Slides.md → Edit it
  lastUsedSlideDocument = Slides.md

Close Obsidian

Session 2:
  Start Obsidian (empty workspace)
  Toggle navigator
  1. No active file
  2. No visible file
  3. lastUsedSlideDocument = Slides.md (from last session!)
  4. Navigator shows Slides.md
```

### Scenario 3: Split View with Multiple Files
```
Editor split: Notes.md | Slides.md (both visible)
Focus on Notes.md

Toggle navigator:
  1. Active file = Notes.md (not markdown? or wrong type)
  2. Visible file = find one of them
  3. Use for display (temp)
  
If user had previously edited Slides.md:
  lastUsedSlideDocument = Slides.md
  (But navigator uses visible file temp)
```

## Benefits of Correct Approach

✅ **Accurate Tracking** - Only actual usage is recorded  
✅ **Clean State** - No artificial initialization  
✅ **Predictable Fallback** - Uses what user actually worked with  
✅ **Multi-Session Awareness** - Remembers last session's file  
✅ **Temporary Fallback** - Visible file search doesn't pollute history  

## Testing with Correct Approach

### Test: Cold Start
```
1. Close Obsidian
2. Open Obsidian with Slides.md visible but unfocused
   → Navigator is EMPTY (correct - never used)
3. Toggle navigator
   → Shows slides (uses visible file)
4. Edit the file
   → Now lastUsedSlideDocument = Slides.md
5. Close Obsidian
6. Reopen
   → lastUsedSlideDocument still set
   → Navigator can use it as fallback
```

### Test: Visible File NOT Stored as Used
```
1. Never open/edit Slides.md
2. Slides.md is visible in pane
3. Toggle navigator
   → Shows slides (temp visible file)
4. Toggle navigator off, then on again
   → Still shows slides
5. Close Slides.md
6. Toggle navigator
   → Empty (because we never actually "used" it)
   → Correct!
```

## Documentation Updated

All docs now clarify:
- `lastUsedSlideDocument` = tracking actual usage only
- `findVisibleMarkdownFile()` = temporary fallback, not tracking
- Distinction between "found" and "used"
- Three-level fallback without artificial initialization

## Build Status
✅ Compilation successful
✅ No type errors
✅ Files copied to test vault
