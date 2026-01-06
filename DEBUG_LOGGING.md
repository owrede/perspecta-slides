# Debug Logging System

This document describes the debug logging system in Perspecta Slides.

## Overview

The plugin now includes a comprehensive debug logging system with **topic-specific logging** that can be toggled individually in the Debug settings tab.

## Debug Service

The `DebugService` class (`src/utils/DebugService.ts`) manages all debug logging:

```typescript
import { getDebugService } from './src/utils/DebugService';

const debug = getDebugService();
debug.log('topic-name', 'Message');
debug.warn('topic-name', 'Warning message');
debug.error('topic-name', 'Error message');
```

## Available Topics

The following debug topics are available:

- **presentation-view** - Activity in the presentation preview panel
- **presentation-window** - Activity in the external presentation window
- **slide-parsing** - Slide parsing and content analysis
- **font-loading** - Google Fonts downloading and caching
- **renderer** - Slide rendering logic
- **inspector** - Inspector panel updates
- **thumbnail-navigator** - Thumbnail navigator updates

## Settings

### Debug Tab

In **Settings → Debug**, you'll find:

**Legacy Debug Settings** (kept for backward compatibility)
- Debug slide rendering
- Debug font loading

**Topic-Specific Debug Logging**
- Debug: Presentation View
- Debug: Presentation Window
- Debug: Slide Parsing
- Debug: Font Loading
- Debug: Renderer
- Debug: Inspector
- Debug: Thumbnail Navigator

Each topic can be toggled independently.

### Configuration

Debug settings are stored in the plugin's data.json:

```json
{
  "debugTopics": {
    "presentation-view": false,
    "presentation-window": false,
    "slide-parsing": false,
    "font-loading": false,
    "renderer": false,
    "inspector": false,
    "thumbnail-navigator": false
  }
}
```

## Console Output

When a topic is enabled, log messages appear in the browser console (F12) with a prefix:

```
[presentation-view] loadFile called with file: My Presentation (my-presentation.md)
[presentation-window] ready-to-show event fired
[renderer] Rendering slide 1
```

Each message is prefixed with `[topic-name]` for easy filtering.

## API Reference

### `DebugService`

#### Methods

**log(topic: DebugTopic, message: string, data?: any): void**
- Logs a message if the topic is enabled
- Message should be a string (template literals recommended for combining data)
- Optional `data` parameter for additional context

**warn(topic: DebugTopic, message: string, data?: any): void**
- Logs a warning if the topic is enabled

**error(topic: DebugTopic, message: string, data?: any): void**
- Logs an error if the topic is enabled

**enableTopic(topic: DebugTopic): void**
- Programmatically enable a topic

**disableTopic(topic: DebugTopic): void**
- Programmatically disable a topic

**isEnabled(topic: DebugTopic): boolean**
- Check if a topic is currently enabled

**setTopicConfig(config: DebugTopicConfig): void**
- Bulk update topic configuration

**getTopics(): Array<{topic: DebugTopic; enabled: boolean}>**
- Get all topics and their current state

## Examples

### Basic Logging

```typescript
const debug = getDebugService();

// Simple message
debug.log('slide-parsing', 'Parsing slide');

// Message with data
const slideCount = presentation.slides.length;
debug.log('slide-parsing', `Found ${slideCount} slides`);

// Warning
debug.warn('font-loading', `Font not cached: ${fontName}`);

// Error
debug.error('renderer', `Failed to render: ${error.message}`);
```

### Conditional Logic

```typescript
const debug = getDebugService();

if (debug.isEnabled('presentation-view')) {
  // Do expensive debug work only if logging is enabled
  const details = computeExpensiveDebugInfo();
  debug.log('presentation-view', `Slide details: ${JSON.stringify(details)}`);
}
```

## Adding New Topics

To add a new debug topic:

1. Add it to the `DebugTopic` type in `src/utils/DebugService.ts`:
```typescript
export type DebugTopic = 
  | 'presentation-view'
  | 'presentation-window'
  | 'new-topic';  // Add here
```

2. Add it to the default settings in `src/types.ts`:
```typescript
debugTopics: {
  'new-topic': false,  // Add here
}
```

3. The setting will automatically appear in the Debug tab!

## Implementation Notes

- All debug messages are **no-op** when disabled (zero performance cost)
- Console output only happens when a topic is explicitly enabled
- Legacy settings (`debugSlideRendering`, `debugFontLoading`) are maintained for backward compatibility
- Topic settings are persisted in the plugin's data storage
- The debug service is a singleton accessible throughout the plugin via `getDebugService()`

## Filtering Console Output

In the browser console (F12), you can filter messages:

```javascript
// Show only presentation-view messages
console.log(window.$_entries)  // Obsidian quirk

// Or use browser filter:
// In DevTools, type in the Filter box:
[presentation-view]

// Show errors only:
[presentation-window] error
```

## Migration Guide

If updating from the old console.log system:

**Before:**
```typescript
console.log('Some message:', data);
```

**After:**
```typescript
const debug = getDebugService();
debug.log('topic-name', `Some message: ${JSON.stringify(data)}`);
```

## Performance Considerations

- Debug logging has **zero overhead** when disabled
- Enabled topics only log to console (no performance impact)
- Expensive debug computations should be wrapped in `isEnabled()` checks
- The debug service is extremely lightweight

## Troubleshooting

**Debug messages not appearing?**
- Open DevTools (F12) and check the Console tab
- Verify the topic is enabled in Settings → Debug
- Check that `getDebugService()` is being called correctly
- Look for messages with the `[topic-name]` prefix

**Too many messages?**
- Disable topics you don't need
- Filter the console by topic prefix using the Filter box in DevTools
- Look at specific file tabs (PresentationView.ts, PresentationWindow.ts, etc.)
