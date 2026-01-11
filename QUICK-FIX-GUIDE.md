# Quick Fix Guide - 1,037 Lint Issues

**TL;DR:** Auto-fix 37 issues now, manually fix 47 critical errors this week, tackle the rest systematically over 4-6 weeks.

---

## Immediate Actions (Right Now - 5 minutes)

### 1. Auto-fix 37 Issues

```bash
npm run lint:fix
```

This will automatically fix:
- ✅ 33 duplicate imports
- ✅ 3 prefer-const violations
- ✅ 1 useless escape

**Remaining after:** 1,000 issues

---

## Critical Fixes (This Week - 4-8 hours)

### 2. Fix 47 Floating Promises 🔴 CRITICAL

**What:** Async operations not properly handled - can cause silent failures.

**Where to find them:**
```bash
grep -n "no-floating-promises" <(npm run lint 2>&1)
```

**Locations:**
- `main.ts` lines: 253, 257, 279, 291, 299, 310, 335, 350, 365, 380, 392, 402, 417, 521, 540, 606, 656, 661, 866, 880, 926, 939 (22 issues)
- `src/ui/PresentationView.ts` - 8 issues
- `src/ui/InspectorPanel.ts` - 7 issues
- `src/ui/PresenterWindow.ts` - 6 issues
- Others - 4 issues

**Example - main.ts:253**
```typescript
// BEFORE (line 253) ❌
if (activeFile && activeFile.extension === 'md') {
  this.updateSidebars(activeFile);  // Not awaited!
}

// AFTER ✅
if (activeFile && activeFile.extension === 'md') {
  await this.updateSidebars(activeFile);
  // Or if you can't await:
  this.updateSidebars(activeFile).catch(err =>
    console.error('Failed to update sidebars:', err)
  );
}
```

**How to fix systematically:**
1. Search for each line number in the file
2. Add `await` if inside async function
3. Add `.catch()` if can't await
4. Use `void` operator if intentional fire-and-forget:
   ```typescript
   void this.updateSidebars(activeFile);  // Explicit intent
   ```

### 3. Fix 10 Async Without Await

**Where:** `main.ts` and UI files

**Example:**
```typescript
// BEFORE ❌
async applyContentOnlyUpdate(slide: Slide) {
  this.updateSlideContent(slide);  // No await inside!
}

// AFTER ✅
applyContentOnlyUpdate(slide: Slide) {  // Remove async
  this.updateSlideContent(slide);
}
```

Search for: `@typescript-eslint/require-await`

**Remaining after week 1:** ~950 issues

---

## Week 2: Quick Wins (8-12 hours)

### 4. Remove/Rename 60 Unused Variables

**Find them:**
```bash
grep "no-unused-vars" <(npm run lint 2>&1)
```

**Examples:**
```typescript
// BEFORE ❌
import { App, Plugin } from 'obsidian';  // App never used

// AFTER ✅
import { Plugin } from 'obsidian';
```

```typescript
// BEFORE ❌
function handler(event: Event, data: any) {  // event never used
  processData(data);
}

// AFTER ✅
function handler(_event: Event, data: any) {  // Prefix with _
  processData(data);
}
```

### 5. Replace 32 Console Statements

**Find:** `grep "no-console"`

**Before:**
```typescript
console.log('Theme loaded:', theme.name);  // ❌
```

**After:**
```typescript
this.debugService.log('theme', 'Theme loaded:', theme.name);  // ✅
```

**Remaining after week 2:** ~850 issues

---

## Week 3-4: Type Safety (20-30 hours)

### 6. Fix 440 Unsafe Any Operations

**The Big Problem:** Electron IPC and DOM manipulation without types.

#### Step 1: Type Electron IPC (Fixes ~200 issues)

**Create:** `src/types/electron.d.ts`
```typescript
import type { IpcRenderer } from 'electron';

declare global {
  interface Window {
    electronAPI?: {
      send: (channel: string, ...args: any[]) => void;
      on: (channel: string, callback: (...args: any[]) => void) => void;
      removeListener: (channel: string, callback: (...args: any[]) => void) => void;
    };
  }
}

export interface ElectronIPC {
  ipcRenderer: IpcRenderer;
}
```

**Then in PresenterWindow.ts:**
```typescript
// BEFORE ❌
const ipcRenderer: any = require('electron').ipcRenderer;
ipcRenderer.on('event', (event: any, data: any) => { ... });

// AFTER ✅
import type { IpcRenderer } from 'electron';
const { ipcRenderer } = require('electron') as { ipcRenderer: IpcRenderer };
ipcRenderer.on('event', (_event, data: unknown) => {
  // Add type guard
  if (isEventData(data)) {
    processData(data);
  }
});
```

#### Step 2: Replace explicit `any` (72 warnings)

**Pattern to find:**
```bash
grep "@typescript-eslint/no-explicit-any"
```

**Replace with:**
- `unknown` (for truly unknown types, then use type guards)
- Proper interface/type
- Generic type parameters

```typescript
// BEFORE ❌
function process(data: any) { ... }

// AFTER ✅
function process(data: unknown) {
  if (typeof data === 'object' && data !== null && 'field' in data) {
    // Now TypeScript knows it's safe
  }
}
```

**Remaining after week 4:** ~400 issues

---

## Week 5-6: Code Quality (15-20 hours)

### 7. Convert 352 `||` to `??`

**The Issue:**
```typescript
const port = config.port || 3000;  // ❌ If port is 0, uses 3000!
const name = user.name || 'Unknown';  // ❌ If name is '', uses 'Unknown'!
```

**The Fix:**
```typescript
const port = config.port ?? 3000;  // ✅ 0 is valid
const name = user.name ?? 'Unknown';  // ✅ '' is valid
```

**Where:**
```bash
grep "prefer-nullish-coalescing" <(npm run lint 2>&1) | wc -l
# 352 occurrences
```

**Strategy:**
1. Fix one file at a time
2. Run tests after each file
3. Focus on config/settings files first (higher risk)

**Files with most occurrences:**
- `src/ui/PresenterWindow.ts` - 120
- `src/renderer/SlideRenderer.ts` - 50
- `src/utils/ExportService.ts` - 40
- `src/ui/InspectorPanel.ts` - 35

**Remaining after week 6:** <100 issues

---

## Example: Fixing PresenterWindow.ts (202 → ~50 issues)

### Session 1: Type the IPC (2 hours)
```typescript
// Add at top
import type { IpcRenderer } from 'electron';

// Replace all IPC code
const { ipcRenderer } = require('electron') as { ipcRenderer: IpcRenderer };
```
**Fixes:** ~100 unsafe-member-access and unsafe-call errors

### Session 2: Nullish Coalescing (1 hour)
```bash
# Find all || in the file
grep -n "||" src/ui/PresenterWindow.ts

# Replace with ?? where appropriate
```
**Fixes:** ~120 prefer-nullish-coalescing warnings

**Result:** 202 → ~50 issues (75% reduction)

---

## Progress Tracking

| Week | Focus | Issues Fixed | Remaining | % Done |
|------|-------|--------------|-----------|--------|
| 0 | Auto-fix | 37 | 1,000 | 3.6% |
| 1 | Critical (promises) | 57 | 943 | 9.1% |
| 2 | Quick wins | 100 | 843 | 18.7% |
| 3-4 | Type safety | 450 | 393 | 62.1% |
| 5-6 | Nullish coalescing | 352 | 41 | 96.0% |
| 7+ | Cleanup | 41 | 0 | 100% |

---

## File-by-File Priority

### High Priority (Fix First)
1. ✅ **main.ts** (111 issues) - Plugin core, has critical floating promises
2. ✅ **src/ui/PresenterWindow.ts** (202) - Most issues, IPC heavy
3. ✅ **src/ui/PresentationWindow.ts** (107) - Similar to above

### Medium Priority (Week 3-4)
4. **src/ui/InspectorPanel.ts** (111)
5. **src/utils/ThemeExporter.ts** (89)
6. **src/renderer/SlideRenderer.ts** (85)
7. **src/ui/PresentationView.ts** (83)

### Lower Priority (Week 5+)
8-18. Remaining files (< 30 issues each)

---

## Verification After Each Fix

```bash
# After fixing a file
npm run lint src/ui/PresenterWindow.ts

# Full project check
npm run lint

# Type check
npm run typecheck

# Run tests (when added)
npm test
```

---

## When to Use ESLint Disable

**Rarely.** But if you must:

```typescript
// Disable for one line (document WHY)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const data: any = externalUntypedLibrary.getData();  // TODO: Add types in v2

// Disable for block
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
// Legacy code, will be refactored in ticket #123
legacyObject.unknownProperty.deepAccess;
/* eslint-enable @typescript-eslint/no-unsafe-member-access */
```

**Rule:** Never disable errors without a comment explaining why + ticket/TODO.

---

## Tools to Help

### Find Issues by Type
```bash
# All floating promises
npm run lint 2>&1 | grep "no-floating-promises"

# All in specific file
npm run lint -- src/ui/PresenterWindow.ts

# Count by rule
npm run lint 2>&1 | grep -oE "@typescript-eslint/[a-z-]+" | sort | uniq -c | sort -rn
```

### Before/After Comparison
```bash
# Save current state
npm run lint 2>&1 | tee /tmp/before.txt

# Make fixes...

# Compare
npm run lint 2>&1 | tee /tmp/after.txt
diff <(wc -l /tmp/before.txt) <(wc -l /tmp/after.txt)
```

---

## Expected Timeline

**Aggressive (Full-time):** 2 weeks
**Moderate (Part-time):** 6 weeks
**Relaxed (As you go):** 3 months

**Recommendation:** Fix critical issues (week 1-2) ASAP, then tackle systematically during normal development.

---

## Success Criteria

- ✅ 0 `no-floating-promises` errors (Week 1)
- ✅ 0 `no-unsafe-*` errors (Week 4)
- ✅ < 50 total warnings (Week 6)
- ✅ CI/CD passing lint checks (Week 2)
- ✅ 0 errors, < 10 warnings (Week 8)

**Current:** 516 errors, 521 warnings
**Target:** 0 errors, <10 warnings

---

Good luck! Start with `npm run lint:fix` and tackle the floating promises. 🚀
