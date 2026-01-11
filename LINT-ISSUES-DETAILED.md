# Complete Lint Issues Breakdown

**Total Issues:** 1,037 (516 errors, 521 warnings)
**Date:** 2026-01-10

---

## Issues by File (Sorted by Count)

| File | Issues | % of Total |
|------|--------|-----------|
| `src/ui/PresenterWindow.ts` | 202 | 19.5% |
| `src/ui/InspectorPanel.ts` | 111 | 10.7% |
| `main.ts` | 111 | 10.7% |
| `src/ui/PresentationWindow.ts` | 107 | 10.3% |
| `src/utils/ThemeExporter.ts` | 89 | 8.6% |
| `src/renderer/SlideRenderer.ts` | 85 | 8.2% |
| `src/ui/PresentationView.ts` | 83 | 8.0% |
| `src/utils/ExportService.ts` | 79 | 7.6% |
| `src/ui/SettingsTab.ts` | 30 | 2.9% |
| `src/parser/SlideParser.ts` | 30 | 2.9% |
| `src/themes/ThemeLoader.ts` | 27 | 2.6% |
| `src/utils/FontManager.ts` | 25 | 2.4% |
| `preload.ts` | 22 | 2.1% |
| `src/ui/ThumbnailNavigator.ts` | 18 | 1.7% |
| `src/themes/index.ts` | 7 | 0.7% |
| `src/utils/DebugService.ts` | 5 | 0.5% |
| `src/ui/FontDiscoveryModal.ts` | 4 | 0.4% |
| `src/themes/builtin/index.ts` | 2 | 0.2% |

---

## Issues by Rule Type (Top 20)

| Rule | Count | Severity | Auto-Fixable |
|------|-------|----------|--------------|
| `@typescript-eslint/prefer-nullish-coalescing` | 352 | ⚠️ Warning | ❌ No |
| `@typescript-eslint/no-unsafe-member-access` | 182 | 🔴 Error | ❌ No |
| `@typescript-eslint/no-unsafe-call` | 130 | 🔴 Error | ❌ No |
| `@typescript-eslint/no-explicit-any` | 72 | ⚠️ Warning | ❌ No |
| `@typescript-eslint/no-unused-vars` | 60 | ⚠️ Warning | ❌ No |
| `@typescript-eslint/no-unsafe-assignment` | 58 | 🔴 Error | ❌ No |
| `@typescript-eslint/no-floating-promises` | 47 | 🔴 Error | ❌ No |
| `no-duplicate-imports` | 33 | 🔴 Error | ✅ Yes |
| `no-console` | 32 | ⚠️ Warning | ❌ No |
| `@typescript-eslint/no-unsafe-argument` | 13 | 🔴 Error | ❌ No |
| `@typescript-eslint/no-misused-promises` | 12 | 🔴 Error | ❌ No |
| `no-case-declarations` | 10 | 🔴 Error | ❌ No |
| `@typescript-eslint/restrict-template-expressions` | 10 | 🔴 Error | ❌ No |
| `@typescript-eslint/require-await` | 10 | 🔴 Error | ❌ No |
| `@typescript-eslint/no-var-requires` | 4 | 🔴 Error | ❌ No |
| `@typescript-eslint/no-unsafe-return` | 4 | 🔴 Error | ❌ No |
| `prefer-const` | 3 | ⚠️ Warning | ✅ Yes |
| `@typescript-eslint/await-thenable` | 2 | 🔴 Error | ❌ No |
| `no-useless-escape` | 1 | ⚠️ Warning | ✅ Yes |
| `@typescript-eslint/prefer-optional-chain` | 1 | ⚠️ Warning | ✅ Yes |

---

## Detailed Analysis by Category

### 1. Type Safety Issues (440 errors - 42.4% of all issues)

These are the most critical issues undermining TypeScript's type safety guarantees.

#### `@typescript-eslint/no-unsafe-member-access` - 182 errors

**What it means:** Accessing properties on values typed as `any`, which bypasses type checking.

**Example pattern:**
```typescript
const ipcRenderer: any = require('electron').ipcRenderer;
ipcRenderer.on('event', ...);  // ❌ Unsafe member access .on on any value
```

**Files most affected:**
- `src/ui/PresenterWindow.ts` - ~60 occurrences
- `src/ui/PresentationWindow.ts` - ~40 occurrences
- `main.ts` - ~30 occurrences
- `src/ui/InspectorPanel.ts` - ~25 occurrences

**How to fix:**
```typescript
// Option 1: Proper typing
import type { IpcRenderer } from 'electron';
const ipcRenderer = require('electron').ipcRenderer as IpcRenderer;

// Option 2: Type guard
if (typeof obj === 'object' && obj !== null && 'property' in obj) {
  obj.property // ✅ Safe access
}
```

---

#### `@typescript-eslint/no-unsafe-call` - 130 errors

**What it means:** Calling functions on values typed as `any`.

**Example pattern:**
```typescript
const ipcRenderer: any = ...;
ipcRenderer.send('message', data);  // ❌ Unsafe call
```

**Files most affected:**
- `src/ui/PresenterWindow.ts` - ~45 occurrences
- `src/ui/PresentationWindow.ts` - ~30 occurrences
- `src/ui/InspectorPanel.ts` - ~20 occurrences

**How to fix:**
Add proper type definitions or type assertions.

---

#### `@typescript-eslint/no-unsafe-assignment` - 58 errors

**What it means:** Assigning `any` typed values to variables.

**Example pattern:**
```typescript
const data: any = response.getData();  // ❌ Unsafe assignment
```

---

#### `@typescript-eslint/no-explicit-any` - 72 warnings

**What it means:** Explicitly using `any` type annotations.

**Example pattern:**
```typescript
function handler(event: any, data: any) { ... }  // ❌ Explicit any
```

**How to fix:**
```typescript
// Use proper types
interface EventData {
  type: string;
  payload: unknown;
}
function handler(event: Event, data: EventData) { ... }  // ✅ Typed
```

---

### 2. Nullish Coalescing (352 warnings - 33.9% of all issues)

**What it means:** Using `||` for default values can cause bugs with falsy values.

**Problem:**
```typescript
const port = config.port || 3000;  // ❌ If port is 0, uses 3000!
const name = user.name || 'Unknown';  // ❌ If name is '', uses 'Unknown'
const enabled = settings.enabled || false;  // ❌ Always false!
```

**Fix:**
```typescript
const port = config.port ?? 3000;  // ✅ Only uses 3000 if null/undefined
const name = user.name ?? 'Unknown';  // ✅ '' is valid, won't replace
const enabled = settings.enabled ?? false;  // ✅ False is valid
```

**Files most affected:**
- `src/ui/PresenterWindow.ts` - ~120 occurrences
- `src/renderer/SlideRenderer.ts` - ~50 occurrences
- `src/utils/ExportService.ts` - ~40 occurrences
- `src/ui/InspectorPanel.ts` - ~35 occurrences

**Impact:** Medium risk - can cause subtle bugs with edge cases.

---

### 3. Unhandled Promises (47 errors - CRITICAL)

**What it means:** Async operations that aren't properly awaited or error-handled.

**Problem:**
```typescript
// Command handler
async function openPresentation() {
  this.loadPresentation(file);  // ❌ Promise not awaited, errors lost!
}
```

**Files affected:**
- `main.ts` - 21 occurrences
- `src/ui/PresentationView.ts` - 8 occurrences
- `src/ui/InspectorPanel.ts` - 7 occurrences
- `src/ui/PresenterWindow.ts` - 6 occurrences
- Others - 5 occurrences

**How to fix:**
```typescript
// Option 1: Await it
await this.loadPresentation(file);  // ✅

// Option 2: Handle errors
this.loadPresentation(file).catch(err => {
  console.error('Failed to load:', err);
});  // ✅

// Option 3: Intentional fire-and-forget
void this.loadPresentation(file);  // ✅ Explicit intent
```

**Why critical:** Silent failures, race conditions, unhandled rejections.

---

### 4. Unused Variables (60 warnings)

**What it means:** Variables, imports, or parameters that are defined but never used.

**Common patterns:**
```typescript
import { App, Plugin } from 'obsidian';  // ❌ App never used
function handler(event: Event, data: any) { ... }  // ❌ event never used
```

**Files affected:**
- `main.ts` - ~15 occurrences
- `src/ui/*` - ~30 occurrences (combined)
- Others - ~15 occurrences

**How to fix:**
```typescript
// Remove unused imports
import { Plugin } from 'obsidian';  // ✅

// Prefix unused params with _
function handler(_event: Event, data: any) { ... }  // ✅
```

---

### 5. Duplicate Imports (33 errors)

**What it means:** Same module imported multiple times.

**Example:**
```typescript
import { App } from 'obsidian';
import { Plugin, WorkspaceLeaf } from 'obsidian';  // ❌ Duplicate
```

**Fix:**
```typescript
import { App, Plugin, WorkspaceLeaf } from 'obsidian';  // ✅
```

**Auto-fixable:** ✅ Yes - Run `npm run lint:fix`

---

### 6. Console Usage (32 warnings)

**What it means:** Using `console.log()` instead of proper logging.

**Files affected:**
- `main.ts` - 12 occurrences
- `src/ui/PresentationView.ts` - 8 occurrences
- Others - 12 occurrences

**Fix:**
```typescript
// Replace with DebugService
console.log('Theme loaded');  // ❌
this.debugService.log('theme', 'Theme loaded');  // ✅
```

---

### 7. Async Functions Without Await (10 errors)

**What it means:** Functions marked `async` that don't have any `await` expressions.

**Problem:**
```typescript
async applyContentOnlyUpdate(slide: Slide) {  // ❌ No await inside
  this.updateSlideContent(slide);
}
```

**Fix:**
```typescript
// Remove async if not needed
applyContentOnlyUpdate(slide: Slide) {  // ✅
  this.updateSlideContent(slide);
}
```

**Locations:**
- `main.ts:950` - `applyContentOnlyUpdate`
- `main.ts:1006` - `applyStructuralUpdate`
- And 8 others

---

### 8. Promise Misuse (12 errors)

**What it means:** Promises returned where void/sync values expected.

**Example:**
```typescript
button.onClick(async () => {
  await doSomething();  // ❌ Promise returned, but onClick expects void
});
```

**Fix:**
```typescript
button.onClick(async () => {
  await doSomething().catch(err => console.error(err));
  // Or handle within the function
});
```

---

### 9. Template Expression Safety (10 errors)

**What it means:** Using values in template strings that might not convert safely.

**Example:**
```typescript
const msg = `Value: ${anyTypedValue}`;  // ❌ Unsafe conversion
```

---

### 10. Case Declarations (10 errors)

**What it means:** Variable declarations in switch cases without blocks.

**Problem:**
```typescript
switch (type) {
  case 'a':
    const x = 1;  // ❌ Needs block scope
    break;
  case 'b':
    const x = 2;  // ❌ Same name, same scope
    break;
}
```

**Fix:**
```typescript
switch (type) {
  case 'a': {  // ✅ Add braces
    const x = 1;
    break;
  }
  case 'b': {
    const x = 2;
    break;
  }
}
```

---

## Top 5 Most Problematic Files

### 1. `src/ui/PresenterWindow.ts` - 202 issues

**Breakdown:**
- 120 × `prefer-nullish-coalescing` warnings
- 60 × `no-unsafe-member-access` errors (IPC renderer)
- 45 × `no-unsafe-call` errors
- 15 × `no-explicit-any` warnings
- Others

**Main problem:** Heavy use of Electron IPC without proper typing.

---

### 2. `src/ui/InspectorPanel.ts` - 111 issues

**Breakdown:**
- 35 × `prefer-nullish-coalescing` warnings
- 25 × `no-unsafe-member-access` errors
- 20 × `no-unsafe-call` errors
- 15 × `no-unused-vars` warnings
- 7 × `no-floating-promises` errors
- Others

**Main problem:** DOM manipulation and event handling without proper types.

---

### 3. `main.ts` - 111 issues

**Breakdown:**
- 21 × `no-floating-promises` errors ⚠️ CRITICAL
- 15 × `no-unused-vars` warnings
- 12 × `no-console` warnings
- 10 × `prefer-nullish-coalescing` warnings
- 8 × `no-duplicate-imports` errors
- 30 × `no-unsafe-*` errors (IPC, Electron)
- Others

**Main problem:** Plugin initialization, command handlers not awaiting promises.

---

### 4. `src/ui/PresentationWindow.ts` - 107 issues

**Breakdown:**
- 40 × `no-unsafe-member-access` errors
- 30 × `no-unsafe-call` errors
- 20 × `prefer-nullish-coalescing` warnings
- Others

**Main problem:** Similar to PresenterWindow, Electron IPC typing issues.

---

### 5. `src/utils/ThemeExporter.ts` - 89 issues

**Breakdown:**
- 50 × `prefer-nullish-coalescing` warnings
- 20 × `no-unsafe-member-access` errors
- 10 × `no-explicit-any` warnings
- Others

**Main problem:** Theme property access and default value handling.

---

## Quick Wins (Easy Fixes)

### Can fix automatically:
- ✅ 33 × `no-duplicate-imports` - Run `npm run lint:fix`
- ✅ 3 × `prefer-const` - Run `npm run lint:fix`
- ✅ 1 × `no-useless-escape` - Run `npm run lint:fix`

### Can fix manually in <30 minutes:
- 10 × `require-await` - Remove `async` keyword
- 32 × `no-console` - Replace with `DebugService`
- ~30 × `no-unused-vars` - Delete or prefix with `_`

### Require systematic refactoring:
- 352 × `prefer-nullish-coalescing` - Convert `||` to `??`
- 440 × Unsafe `any` operations - Add proper types
- 47 × `no-floating-promises` - Add await/catch

---

## Prioritized Action Plan

### 🔴 Week 1: Fix Critical Errors (47 + 10 = 57 issues)

**Priority 1: Floating Promises (47 errors)**
```bash
grep -n "no-floating-promises" /tmp/lint-full.txt
```
Fix all unhandled promises in:
- `main.ts` command handlers (21 issues)
- UI update methods (26 issues)

**Priority 2: Async Without Await (10 errors)**
- Remove unnecessary `async` keywords

**Impact:** Prevents silent failures and race conditions.

---

### 🟡 Week 2: Fix Moderate Errors (70 issues)

**Duplicate Imports (33 errors)** - Auto-fixable
**Unused Variables (60 warnings)** - Delete or rename
**Console Statements (32 warnings)** - Replace with DebugService

---

### 🟢 Week 3-4: Type Safety (440 issues)

Systematically add types to eliminate:
- `no-unsafe-member-access` (182)
- `no-unsafe-call` (130)
- `no-unsafe-assignment` (58)
- `no-explicit-any` (72)

Focus on Electron/IPC code first (PresenterWindow, PresentationWindow).

---

### 🔵 Week 5-6: Code Quality (352 + others)

**Nullish Coalescing (352 warnings)**
- Convert `||` to `??` with tests
- Focus on configuration/settings files first

**Remaining Issues**
- Template expressions (10)
- Case declarations (10)
- Promise misuse (12)
- Others (20)

---

## Summary Statistics

| Category | Count | % |
|----------|-------|---|
| **Type Safety** | 440 | 42.4% |
| **Nullish Coalescing** | 352 | 33.9% |
| **Code Quality** | 138 | 13.3% |
| **Async Handling** | 69 | 6.7% |
| **Other** | 38 | 3.7% |
| **TOTAL** | 1,037 | 100% |

**Error vs Warning:**
- 🔴 Errors: 516 (49.8%)
- ⚠️ Warnings: 521 (50.2%)

**Effort Estimate:**
- Auto-fixable: ~40 issues (4%)
- Easy manual fixes: ~100 issues (10%)
- Moderate effort: ~400 issues (38%)
- Significant refactoring: ~500 issues (48%)

---

## Next Steps

1. **Run auto-fix again** for duplicate imports:
   ```bash
   npm run lint:fix
   ```

2. **Fix critical floating promises** (1-2 days):
   - Focus on `main.ts` command handlers
   - Add proper await/catch

3. **Add Electron type definitions** (2-3 days):
   - Create types for IPC renderer
   - Type Electron window objects

4. **Systematic nullish coalescing conversion** (1 week):
   - Convert with comprehensive testing
   - Group by file/component

5. **Long-term type safety improvements** (2-3 weeks):
   - Replace all `any` with proper types
   - Add type guards and assertions

**Goal:** Achieve <100 issues within 1 month, 0 errors within 2 months.
