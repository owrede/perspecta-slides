# Linting Setup & Report

**Date:** 2026-01-10
**Project:** Perspecta Slides v0.2.10
**Status:** ✅ Linting infrastructure configured

---

## Summary

Linting and code formatting tools have been successfully configured for the Perspecta Slides codebase. This establishes a foundation for code quality enforcement and consistency.

### What Was Added

- ✅ **ESLint** - TypeScript linting with strict rules
- ✅ **Prettier** - Code formatting
- ✅ **Configuration Files** - `.eslintrc.json`, `.prettierrc`, ignore files
- ✅ **NPM Scripts** - `lint`, `lint:fix`, `format`, `format:check`, `typecheck`
- ✅ **Auto-Fix Applied** - 234 issues automatically fixed

---

## Configuration Details

### ESLint Configuration

**Parser:** `@typescript-eslint/parser`
**Plugins:** `@typescript-eslint/eslint-plugin`
**Extends:**
- `eslint:recommended`
- `plugin:@typescript-eslint/recommended`
- `plugin:@typescript-eslint/recommended-requiring-type-checking`

**Key Rules Enabled:**
- `@typescript-eslint/no-floating-promises: error` - Catch unhandled promises
- `@typescript-eslint/no-misused-promises: error` - Prevent promise misuse
- `@typescript-eslint/await-thenable: error` - Only await promises
- `@typescript-eslint/consistent-type-imports: warn` - Use `import type` where possible
- `@typescript-eslint/prefer-nullish-coalescing: warn` - Prefer `??` over `||`
- `@typescript-eslint/prefer-optional-chain: warn` - Use optional chaining
- `no-console: warn` - Discourage console usage (allow warn/error)
- `curly: error` - Require braces for all control statements
- `eqeqeq: error` - Require strict equality

### Prettier Configuration

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "es5",
  "tabWidth": 2,
  "printWidth": 100
}
```

---

## Current State Analysis

### Issues Before Auto-Fix
- **Total:** 1,271 problems
- **Errors:** 685
- **Warnings:** 586

### Issues After Auto-Fix + Format
- **Total:** 1,037 problems
- **Errors:** 516
- **Warnings:** 521

### Improvement
- **Fixed Automatically:** 234 issues (18.4%)
- **Remaining:** 1,037 issues (81.6%)

---

## Issue Breakdown by Rule

| Rule | Count | Severity | Description |
|------|-------|----------|-------------|
| `prefer-nullish-coalescing` | 352 | Warning | Should use `??` instead of `\|\|` |
| `no-unsafe-member-access` | 182 | Error | Unsafe access of `any` typed values |
| `no-unsafe-call` | 130 | Error | Unsafe function calls on `any` values |
| `no-explicit-any` | 72 | Warning | Explicit `any` types used |
| `no-unused-vars` | 60 | Warning | Unused variables/parameters |
| `no-unsafe-assignment` | 58 | Error | Unsafe assignments from `any` |
| `no-floating-promises` | 47 | Error | Promises not properly handled |
| `no-unsafe-argument` | 13 | Error | Unsafe arguments passed |
| `no-misused-promises` | 12 | Error | Promises used incorrectly |
| `restrict-template-expressions` | 10 | Error | Unsafe template expressions |
| `require-await` | 10 | Error | Async functions without await |
| `no-var-requires` | 4 | Error | CommonJS require in TypeScript |
| `no-unsafe-return` | 4 | Error | Unsafe return values |
| Others | 83 | Mixed | Various other issues |

---

## Most Problematic Issue Categories

### 1. **Type Safety Issues (440 errors)**

**Problem:** Extensive use of `any` types and unsafe operations
**Files Affected:** All files, especially `main.ts`, UI components, renderer
**Impact:** High - Undermines TypeScript's type safety

**Examples:**
- `no-unsafe-member-access` (182)
- `no-unsafe-call` (130)
- `no-unsafe-assignment` (58)
- `no-explicit-any` (72)

**Recommendation:**
- Replace `any` with proper types
- Use type guards for unknown types
- Add type definitions for external libraries
- Enable stricter TypeScript compiler options

---

### 2. **Nullish Coalescing (352 warnings)**

**Problem:** Using `||` instead of `??` for default values
**Impact:** Medium - Can cause bugs with falsy values (0, false, '')

**Example:**
```typescript
// Current (problematic with falsy values)
const value = config.option || defaultValue;

// Should be
const value = config.option ?? defaultValue;
```

**Auto-Fix Available:** No (requires manual review)
**Recommendation:** Convert systematically, testing each change

---

### 3. **Unhandled Promises (47 errors)**

**Problem:** Async operations not properly awaited or error-handled
**Impact:** High - Can cause silent failures and race conditions

**Files Most Affected:**
- `main.ts` - Plugin initialization, command handlers
- `src/ui/PresentationView.ts` - Async rendering
- `src/utils/FontManager.ts` - Font downloads

**Recommendation:**
- Add `await` where appropriate
- Use `.catch()` for error handling
- Add `void` operator for intentional fire-and-forget

---

### 4. **Unused Variables (60 warnings)**

**Problem:** Dead code and unused imports
**Impact:** Low - Code cleanliness, bundle size

**Recommendation:**
- Remove unused imports/variables
- Prefix intentionally unused params with `_`
- Example: `function handler(_event: Event, data: Data)`

---

### 5. **Async Functions Without Await (10 errors)**

**Problem:** Functions marked `async` that don't use `await`
**Impact:** Medium - Misleading, unnecessary Promise wrapping

**Locations:**
- `main.ts:950` - `applyContentOnlyUpdate`
- `main.ts:1006` - `applyStructuralUpdate`

**Recommendation:**
- Remove `async` keyword if no await needed
- Or add proper async operations

---

## NPM Scripts Added

```json
{
  "lint": "eslint . --ext .ts",
  "lint:fix": "eslint . --ext .ts --fix",
  "format": "prettier --write \"**/*.{ts,json,md,css}\"",
  "format:check": "prettier --check \"**/*.{ts,json,md,css}\"",
  "typecheck": "tsc --noEmit"
}
```

### Usage

```bash
# Check for linting issues
npm run lint

# Auto-fix what's possible
npm run lint:fix

# Format code
npm run format

# Check formatting without changing files
npm run format:check

# Type-check without building
npm run typecheck
```

---

## Recommended Next Steps

### Immediate (Week 1)
1. **Fix Critical Errors First**
   - [ ] Fix all `no-floating-promises` (47 issues)
   - [ ] Remove unused variables (60 issues)
   - [ ] Fix `require-await` (10 issues)

2. **Update CI/CD**
   - [ ] Add lint check to GitHub Actions workflow
   - [ ] Make lint pass required for PRs
   - [ ] Add pre-commit hook (optional)

### Short-term (Week 2-3)
3. **Improve Type Safety**
   - [ ] Replace `any` types with proper types (72 occurrences)
   - [ ] Add type guards for unsafe operations
   - [ ] Fix unsafe member access (182 errors)

4. **Code Quality Improvements**
   - [ ] Convert `||` to `??` where appropriate (352 warnings)
   - [ ] Remove console.log statements (use DebugService)

### Long-term (Month 1-2)
5. **Achieve Zero Errors**
   - [ ] Systematic cleanup of all 516 errors
   - [ ] Document any intentional rule suppressions
   - [ ] Add JSDoc for complex functions

6. **Optimize Configuration**
   - [ ] Fine-tune ESLint rules based on team preferences
   - [ ] Add additional plugins (e.g., `eslint-plugin-import`)
   - [ ] Consider stricter TypeScript compiler options

---

## Rule Exceptions

For cases where rules need to be disabled, use inline comments:

```typescript
// Disable specific rule for next line
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const data: any = externalLibrary.getData();

// Disable for entire file (use sparingly)
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
```

**Important:** Always document WHY a rule is disabled.

---

## CI/CD Integration Example

Add to `.github/workflows/ci.yml`:

```yaml
name: Lint & Type Check

on: [push, pull_request]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - run: npm ci
      - run: npm run lint
      - run: npm run format:check
      - run: npm run typecheck
```

---

## Pre-commit Hook (Optional)

Using Husky and lint-staged:

```bash
npm install -D husky lint-staged
npx husky init
```

`.husky/pre-commit`:
```bash
#!/usr/bin/env sh
npx lint-staged
```

`package.json`:
```json
{
  "lint-staged": {
    "*.ts": [
      "eslint --fix",
      "prettier --write"
    ],
    "*.{json,md,css}": [
      "prettier --write"
    ]
  }
}
```

---

## Benefits Achieved

✅ **Consistency** - Enforced code style across the project
✅ **Quality** - Automated detection of common errors and anti-patterns
✅ **Safety** - TypeScript strict mode violations caught early
✅ **Maintainability** - Cleaner, more readable code
✅ **Collaboration** - Clear standards for contributors
✅ **CI/CD Ready** - Foundation for automated quality checks

---

## Files Modified

- `package.json` - Added dependencies and scripts
- `.eslintrc.json` - ESLint configuration (new)
- `.prettierrc` - Prettier configuration (new)
- `.eslintignore` - ESLint ignore patterns (new)
- `.prettierignore` - Prettier ignore patterns (new)
- All `*.ts` files - Auto-fixed and formatted

---

## Metrics

| Metric | Value |
|--------|-------|
| **Total Lines of Code** | ~18,006 |
| **Files Linted** | 23 TypeScript files |
| **Issues Identified** | 1,271 |
| **Issues Auto-Fixed** | 234 (18.4%) |
| **Issues Remaining** | 1,037 (81.6%) |
| **Critical Errors** | 47 floating promises |
| **Type Safety Issues** | 440 unsafe `any` operations |

---

## Conclusion

The linting infrastructure is now in place and has already improved code quality through automatic fixes. The remaining 1,037 issues represent opportunities for further improvement, with the most critical being unhandled promises and type safety issues.

**Status:** 🟡 Baseline established, incremental improvement needed
**Priority:** Focus on fixing the 47 floating promises and 10 require-await errors first

---

**Next Action:** Review and fix critical errors, then integrate into CI/CD pipeline.
