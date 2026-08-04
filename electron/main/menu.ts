import { BrowserWindow, Menu, type MenuItemConstructorOptions } from 'electron';

const NEW_PROJECT_CHANNEL = 'menu:new-project';

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
          click: () => {
            BrowserWindow.getFocusedWindow()?.webContents.send(NEW_PROJECT_CHANNEL);
          },
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    { role: 'editMenu' },
    { role: 'help' },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
