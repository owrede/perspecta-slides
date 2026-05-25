/**
 * IpcListenerManager — owns the Electron main-process IPC listeners the
 * presenter window uses to talk back to the plugin.
 *
 * Extracted from main.ts. The plugin registered two `ipcMain` listeners
 * (`presenter:slide-changed`, `presenter:open-presentation`) and tracked
 * disposers so it could remove them on unload — important because plugin
 * reloads are frequent during development and, without cleanup, each
 * reload stacked another copy of every handler.
 *
 * This manager keeps that register/dispose lifecycle in one place and is
 * decoupled from the presenter window: the plugin passes two callbacks,
 * and the manager wires them to the IPC channels. Electron is required
 * lazily and the whole thing no-ops gracefully on non-desktop runtimes
 * where `ipcMain` is unavailable.
 */

export interface IpcListenerCallbacks {
  /** Fired when the presenter window reports the active slide changed. */
  onSlideChanged: (slideIndex: number) => void;
  /** Fired when the presenter window requests opening the presentation window. */
  onOpenPresentation: () => void;
}

export class IpcListenerManager {
  private disposers: Array<() => void> = [];

  /**
   * Register the IPC listeners. Idempotent in the sense that calling it
   * twice without `dispose()` in between would double-register — callers
   * should dispose first. No-op when Electron's `ipcMain` isn't present.
   */
  register(callbacks: IpcListenerCallbacks): void {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const electron = require('electron');
      const ipcMain = electron?.ipcMain;
      if (!ipcMain) {
        return;
      }

      const onSlideChanged = (_event: unknown, slideIndex: number) => {
        callbacks.onSlideChanged(slideIndex);
      };
      const onOpenPresentation = (_event: unknown) => {
        callbacks.onOpenPresentation();
      };

      ipcMain.on('presenter:slide-changed', onSlideChanged);
      ipcMain.on('presenter:open-presentation', onOpenPresentation);

      this.disposers.push(() =>
        ipcMain.removeListener('presenter:slide-changed', onSlideChanged)
      );
      this.disposers.push(() =>
        ipcMain.removeListener('presenter:open-presentation', onOpenPresentation)
      );
    } catch {
      // Electron not available — non-desktop runtime. Nothing to register.
    }
  }

  /** Remove all registered listeners. Safe to call multiple times. */
  dispose(): void {
    for (const dispose of this.disposers) {
      try {
        dispose();
      } catch (e) {
        console.warn('[Perspecta] IPC dispose error:', e);
      }
    }
    this.disposers = [];
  }
}
