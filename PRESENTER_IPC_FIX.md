# Presenter View IPC Communication Fix

## Problem

When clicking PLAY or navigating slides in the Presenter View, the console showed:
```
[Presenter] Callback not ready, using IPC
[Presenter] Sent IPC: presenter:open-presentation
```

The IPC messages were being sent but never received by the main Obsidian process because the plugin runs in the renderer process, not the main process where `ipcMain` exists.

## Root Cause

The presenter window HTML was checking if the injected callback functions existed before using them:

```javascript
if (window.__presenterCallbacks && window.__presenterCallbacks.onOpenPresentation) {
  // Call it
} else {
  // Fall back to IPC (which doesn't work)
}
```

The issue: Callback injection happens **after** the window is shown (in the `ready-to-show` event), but the HTML event listeners are attached during page load. If a user clicked PLAY quickly, the callbacks might not be injected yet.

## Solution

Changed the approach to **always update the polling flags** (`window.__lastOpenPresentation` and `window.__lastSlideChange`) immediately when events occur, regardless of whether the callbacks are injected. The main process polls these values every 500ms and detects changes by timestamp.

### Changes Made

**File: `src/ui/PresenterWindow.ts`**

1. **Slide Navigation** (line 578-589):
   - Now **always** sets `window.__lastSlideChange = {index, timestamp}` when a slide changes
   - Callback injection is now optional (nice-to-have, not required)

2. **PLAY Button Click** (line 602-613):
   - Now **always** sets `window.__lastOpenPresentation = {timestamp}` when PLAY is clicked
   - Callback injection is now optional

The polling mechanism in `injectCallbacksIntoWindow()` (lines 120-153) will detect these timestamp changes and invoke the appropriate handlers in the main process.

## How It Works Now

1. **User clicks PLAY** → Presenter window immediately sets `window.__lastOpenPresentation`
2. **Polling loop** (every 500ms) → Detects timestamp change via `executeJavaScript`
3. **Main process** → Invokes `openPresentationHandler()` → Calls `this.onOpenPresentationWindow()` → Plugin calls `startPresentation()`

Same flow for slide navigation with `window.__lastSlideChange`.

## Testing

1. Enable **presentation-window** debug topic in Obsidian Perspecta Slides settings
2. Open Presenter View and check console logs for:
   - `[Poll] Detected open presentation request` when you click PLAY
   - `[Poll] Detected slide change to N` when you navigate slides
3. Verify that clicking PLAY actually opens the presentation window
4. Verify that keyboard/click navigation in presenter view syncs to the presentation window

## Fallback Strategy

If polling doesn't work for some reason:
- Callbacks still inject after `ready-to-show` and may be called directly if clicked slowly
- Both mechanisms work together for reliability
