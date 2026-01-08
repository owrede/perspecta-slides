# Presenter View Implementation

## Overview

A new Presenter View has been implemented as an external Electron window, designed specifically for speakers to control presentations while reading speaker notes and monitoring progress.

## Key Features

### 1. **Toolbar (Top of Window)**
- **Mode Toggle Button** - Switch between two layout modes:
  - **Text Focus Mode** (default): Large text display with slide thumbnail hidden
  - **Slide Focus Mode**: Large slide preview with smaller text display
  - Visual indicator shows current mode
  
- **Timer Display & Controls**
  - Large, monospace timer showing elapsed time (HH:MM:SS)
  - Play button: Start/pause the timer
  - Reset button: Reset timer to 00:00:00
  - Useful for pacing presentations
  
- **Launch Presentation Button**
  - Opens the presentation window on secondary display
  - Can be windowed or fullscreen
  - Syncs with presenter view navigation

### 2. **Main Content Area (Center)**
Divided into three sections:

#### Slide Thumbnail (Collapsible)
- Small preview of current slide (top-left)
- Slide number badge
- Hidden in text focus mode to maximize text space
- Collapses automatically when window width < 1200px

#### Text Display Area (Center - Main Focus)
- **Large, readable text** of current paragraph (32px default, 48px in text focus mode)
- **Colored highlight box** around text to indicate focus
- Shows one "paragraph" at a time (can be slide content or speaker notes)
- Navigation counter: "X / Y" paragraphs
- Navigation counter: "X / Y" slides

#### Speaker Notes/Next Content (Bottom-Right)
- Additional context and speaker notes
- Hidden when window height < 800px
- Scrollable if content is long

### 3. **Navigation System**

#### Paragraph Navigation (←→ Arrow Keys)
- Move forward/backward through all content paragraphs
- Paragraphs include:
  - Slide content blocks (headings, paragraphs, lists)
  - Speaker notes (each note is a separate paragraph)
- Counter shows current position: "Paragraph X of Y"
- Automatically updates slide when paragraph belongs to different slide

#### Slide Navigation (↑↓ Arrow Keys)
- Jump directly to previous/next slide
- Resets paragraph pointer to first paragraph of new slide
- Counter shows: "Slide X of Y"

### 4. **Responsive Design**
- **Wide window**: All three sections visible (thumbnail, text, notes)
- **Medium window** (< 1200px): Thumbnail hidden, text + notes visible
- **Narrow window** (< 800px): Both thumbnail and notes hidden, text maximized
- **Text Focus Mode**: Always hides thumbnail and notes, maximizes text
- **Slide Focus Mode**: Reorganizes to prioritize slide preview

## Architecture

### Files Created
- **`src/ui/PresenterWindow.ts`** - Main presenter window implementation

### Files Modified
- **`main.ts`**:
  - Added `PresenterWindow` import
  - Added `presenterWindow` property to plugin
  - Added `openPresenterView()` method
  - Added `openPresenterViewWithPresentation()` method
  - Added two commands:
    - `open-presenter-view` - Open presenter view only
    - `open-presenter-presentation-fullscreen` - Open both windows, presentation fullscreen on secondary display

- **`src/ui/InspectorPanel.ts`**:
  - Added `getPresentation()` public method (used for theme exporting with unsaved changes)

### Key Methods

#### `PresenterWindow.ts`

**Public Methods:**
- `open(presentation, theme, sourceFile?, startSlide?, fullscreenOnSecondaryDisplay?)` - Open the window
- `updateContent(presentation, theme)` - Update with new presentation data
- `close()` - Close the window
- `isOpen()` - Check if window is open

**Private Methods:**
- `extractParagraphs()` - Parse slides + notes into navigable paragraphs
- `nextSlide()` / `previousSlide()` / `goToSlide()` - Slide navigation
- `nextParagraph()` / `previousParagraph()` - Paragraph navigation
- `updatePresenterView()` - Update UI with current state
- `loadHTMLContent()` - Load HTML into Electron window
- `generatePresenterHTML()` - Create full HTML document
- `generatePresenterCSS()` - Create responsive styling
- `generatePresenterScripts()` - Create JavaScript for UI interactions

## Paragraph Extraction Logic

The `extractParagraphs()` method breaks down presentations into navigable chunks:

1. **Slide Content** - Uses `slide.rawContent` split by major markdown blocks
2. **Speaker Notes** - Uses `slide.speakerNotes` array (one paragraph per note)
3. Result: A flat list of paragraphs across the entire presentation

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| ↑ / ↓ | Navigate between slides |
| ← / → | Navigate between paragraphs |
| Escape | Close window or exit fullscreen |

## Styling Details

### Dark Theme
- Background: `#1a1a1a` (very dark gray)
- Toolbar: `#242424` (slightly lighter)
- Text: `#e0e0e0` (light gray)
- Accent: `#4a9eff` (blue)

### Responsive Breakpoints
- `@media (max-width: 1200px)` - Hide slide thumbnail
- `@media (max-width: 800px)` - Hide notes area, larger text
- Text focus mode - Force hide both thumbnail and notes

### Typography
- System font stack for best performance
- Monospace for timer (Courier New)
- Large default text size (32px paragraph, 48px in text focus)

## IPC Communication

The window uses Electron IPC for toolbar interactions:
- `presenter:toggle-mode` - Switch between text and slide focus
- `presenter:launch-presentation` - Request presentation window launch
- `presenter:timer-action` - Handle timer play/pause/reset

## Future Enhancements

Potential improvements for future versions:
1. Slide thumbnail with rendered preview (using SlideRenderer)
2. Speaker notes HTML rendering (currently plain text)
3. Notes display below thumbnail with auto-scroll
4. Presenter notes window sync with presentation window
5. Keyboard shortcut customization
6. Presenter remote control (phone/tablet integration)
7. Timer display in presentation window
8. Slide transition animations in presenter view
9. Next slide preview in presenter window
10. Presentation time estimates per slide

## Integration with Theme System

The presenter window integrates with the existing theme system:
- Uses `SlideRenderer` for rendering slide previews
- Applies custom fonts from `FontManager`
- Respects theme colors and typography
- Supports dark/light color scheme detection

## Performance Considerations

- Paragraph extraction happens once on window open and on content updates
- Minimal DOM updates - only text and index counters change on navigation
- No re-rendering of full HTML on slide/paragraph changes
- Efficient CSS media queries for responsive behavior
