import { Menu } from 'electron';

/** The app has no custom application menu -- New/Open/Save/Save As/Undo/Redo/Save Template/Save
 * Template As all live in the shared in-app toolbar (`App.tsx`), the same component used on
 * every host, so there is nothing left for a native File/Edit menu to do. On macOS, the OS-level
 * `appMenu` role (About/Hide/Quit, etc.) is kept -- that's platform convention independent of
 * this app's own actions, not something the toolbar replaces. Elsewhere, no menu bar at all. */
export function buildApplicationMenu(): void {
  const isMac = process.platform === 'darwin';

  if (!isMac) {
    Menu.setApplicationMenu(null);
    return;
  }

  Menu.setApplicationMenu(Menu.buildFromTemplate([{ role: 'appMenu' }]));
}
