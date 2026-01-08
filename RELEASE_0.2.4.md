# Release 0.2.4 - Presenter View IPC Communication & Bidirectional Sync

## Major Features

### Presenter View IPC Communication Fixed
- **Issue**: The Presenter View was unable to communicate with the main Obsidian process
- **Root Cause**: The plugin runs in Electron's renderer process, not the main process, making `ipcMain` unavailable
- **Solution**: Implemented a polling mechanism that detects slide changes in the presenter window via periodic `executeJavaScript` calls

### Bidirectional Slide Synchronization
- **Presenter → Presentation**: When you click PLAY in the Presenter View, the Presentation Window opens
- **Presentation → Presenter**: When you navigate slides in the Presentation Window (arrow keys), the Presenter View automatically scrolls to the corresponding slide
- Full sync works in both directions, keeping both windows in perfect synchronization

## Technical Changes

### PresenterWindow.ts
- Added `notifySlideChange(slideIndex)` method to programmatically update the presenter view
- Implemented polling interval in `injectCallbacksIntoWindow()` that checks for changes every 500ms
- Fixed callback injection timing by calling it from the fallback timeout instead of relying on the unreliable `ready-to-show` event
- Always set `window.__lastSlideChange` and `window.__lastOpenPresentation` flags when events occur

### PresentationWindow.ts
- Added `onSlideChanged` callback property and `setOnSlideChanged()` setter
- Invokes the callback whenever `goToSlide()` is called

### main.ts
- Registered `setOnSlideChanged` callbacks in both `startPresentationAtSlide()` and `openPresenterViewWithPresentation()`
- These callbacks trigger `presenterWindow.notifySlideChange()` to keep the presenter view in sync

## Bug Fixes
- Fixed race condition where presentation window was created without the slide change callback registered
- Removed debug console logging that was cluttering the developer console

## Testing Notes
- Enable "Debug: Presentation Window" in Perspecta Slides settings to see detailed logs
- Both windows should now stay in sync regardless of which one you're navigating

## Version
- Version: 0.2.4
- Package version: 0.2.4
- Manifest version: 0.2.4
