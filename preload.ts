/**
 * Preload script for presentation window
 * Exposes safe APIs to the renderer process for window control
 */

const { contextBridge, ipcRenderer } = require('electron');

// Expose native window control API to the renderer
contextBridge.exposeInMainWorld('nativeWindow', {
  /**
   * Signal to main process that a drag has been detected
   * Main process will start tracking mouse position
   */
  startDragging: () => {
    ipcRenderer.send('presentation-window-drag-start');
  },

  /**
   * Send cursor position delta to main process while dragging
   * Main process uses this to move the window
   */
  updateDragPosition: (dx: number, dy: number) => {
    ipcRenderer.send('presentation-window-drag-move', { dx, dy });
  },

  /**
   * Signal to main process that dragging has ended
   */
  stopDragging: () => {
    ipcRenderer.send('presentation-window-drag-stop');
  },
});

// Presenter-window bridge. Channel-restricted on purpose: the renderer
// can only emit the two presenter intents, not arbitrary IPC. This is
// the secure replacement for the old `require('electron').ipcRenderer`
// path that needed nodeIntegration:true in the renderer.
contextBridge.exposeInMainWorld('perspectaPresenter', {
  /** Tell the plugin the active slide changed in the presenter UI. */
  notifySlideChanged: (slideIndex: number) => {
    ipcRenderer.send('presenter:slide-changed', slideIndex);
  },
  /** Ask the plugin to open the fullscreen presentation window. */
  requestOpenPresentation: () => {
    ipcRenderer.send('presenter:open-presentation');
  },
});
