/**
 * CursorTracker — watches the active Markdown editor's cursor line and
 * fires a callback when it moves to a different line (or file).
 *
 * Extracted from main.ts. The plugin uses this to keep the inspector /
 * thumbnail navigator in sync with the slide the user's cursor is in.
 *
 * Two detection paths run in parallel for robustness across Obsidian's
 * editor backends:
 *   1. A 150ms poll of `editor.getCursor()` — works with both CodeMirror
 *      5 and 6, and survives cases where the CM event doesn't fire.
 *   2. A CodeMirror 5 `cursorActivity` event listener — lower latency
 *      when available.
 *
 * Both feed the same de-duplicated `onLineChange` callback, so a line
 * move is reported at most once regardless of which path saw it first.
 *
 * Lifecycle: call `attach()` whenever the active view changes; it tears
 * down any previous tracking first. Call `detach()` on plugin unload.
 * The poll interval is registered through the injected `registerInterval`
 * hook (Obsidian's `Component.registerInterval`) so it's also cleared
 * automatically on unload as a backstop.
 */

import type { App, TFile } from 'obsidian';
import { MarkdownView } from 'obsidian';

export interface CursorTrackerOptions {
  app: App;
  /**
   * Obsidian's `Component.registerInterval`, bound to the plugin.
   * Ensures the poll timer is cleared on unload even if `detach()` is
   * somehow missed.
   */
  registerInterval: (id: number) => number;
  /** Called when the cursor moves to a different line or file. */
  onLineChange: (file: TFile, line: number) => void;
  /**
   * Called once each time tracking attaches to a view, after the poll
   * is installed. The plugin uses this to refresh inspector focus
   * immediately rather than waiting for the first cursor move.
   */
  onAttach: () => void;
}

export class CursorTracker {
  private opts: CursorTrackerOptions;
  private cleanup: (() => void) | null = null;
  private lastLine = -1;
  private lastFile = '';

  constructor(opts: CursorTrackerOptions) {
    this.opts = opts;
  }

  /**
   * Begin tracking the currently active Markdown view. Tears down any
   * previous tracking first. No-op (after teardown) if there's no active
   * Markdown view or the active file isn't a `.md` file.
   */
  attach(): void {
    this.detach();

    const activeView = this.opts.app.workspace.getActiveViewOfType(MarkdownView);
    if (!activeView) {
      return;
    }

    const editor = activeView.editor;
    const file = activeView.file;
    if (!file || file.extension !== 'md') {
      return;
    }

    const report = (line: number) => {
      if (line !== this.lastLine || file.path !== this.lastFile) {
        this.lastLine = line;
        this.lastFile = file.path;
        this.opts.onLineChange(file, line);
      }
    };

    // Path 1: poll. Works with both CM5 and CM6.
    const pollInterval = window.setInterval(() => {
      const currentView = this.opts.app.workspace.getActiveViewOfType(MarkdownView);
      if (!currentView || currentView.file?.path !== file.path) {
        return;
      }
      report(currentView.editor.getCursor().line);
    }, 150);
    this.opts.registerInterval(pollInterval);

    this.cleanup = () => {
      window.clearInterval(pollInterval);
    };

    this.opts.onAttach();

    // Path 2: CodeMirror 5 cursorActivity (lower latency where present).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cm = (editor as any).cm;
    if (cm?.on) {
      const handleCursorChange = () => {
        report(editor.getCursor().line);
      };
      cm.on('cursorActivity', handleCursorChange);
      const previous = this.cleanup;
      this.cleanup = () => {
        previous?.();
        cm.off('cursorActivity', handleCursorChange);
      };
    }
  }

  /** Stop tracking and release the active view's listeners. Idempotent. */
  detach(): void {
    if (this.cleanup) {
      this.cleanup();
      this.cleanup = null;
    }
  }
}
