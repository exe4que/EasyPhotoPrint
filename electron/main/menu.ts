import { BrowserWindow, Menu, type MenuItemConstructorOptions } from 'electron';

const NEW_PROJECT_CHANNEL = 'menu:new-project';
const OPEN_PROJECT_CHANNEL = 'menu:open-project';
const SAVE_PROJECT_CHANNEL = 'menu:save-project';
const SAVE_PROJECT_AS_CHANNEL = 'menu:save-project-as';
const UNDO_CHANNEL = 'menu:undo';
const REDO_CHANNEL = 'menu:redo';

function sendToFocusedWindow(channel: string): void {
  BrowserWindow.getFocusedWindow()?.webContents.send(channel);
}

export function buildApplicationMenu(): void {
  const isMac = process.platform === 'darwin';

  const template: MenuItemConstructorOptions[] = [
    ...(isMac ? [{ role: 'appMenu' } as const] : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'New',
          accelerator: 'CmdOrCtrl+N',
          click: () => sendToFocusedWindow(NEW_PROJECT_CHANNEL),
        },
        {
          label: 'Open...',
          accelerator: 'CmdOrCtrl+O',
          click: () => sendToFocusedWindow(OPEN_PROJECT_CHANNEL),
        },
        { type: 'separator' },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: () => sendToFocusedWindow(SAVE_PROJECT_CHANNEL),
        },
        {
          label: 'Save As...',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => sendToFocusedWindow(SAVE_PROJECT_AS_CHANNEL),
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        {
          label: 'Undo',
          accelerator: 'CmdOrCtrl+Z',
          click: () => sendToFocusedWindow(UNDO_CHANNEL),
        },
        {
          label: 'Redo',
          accelerator: 'CmdOrCtrl+Shift+Z',
          click: () => sendToFocusedWindow(REDO_CHANNEL),
        },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    { role: 'help' },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
