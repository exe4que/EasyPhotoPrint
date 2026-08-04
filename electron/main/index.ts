import { app, BrowserWindow } from 'electron';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { registerIpcHandlers } from './ipc/index.js';
import { buildApplicationMenu } from './menu.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const isDevelopment = Boolean(process.env.ELECTRON_RENDERER_URL);

function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1180,
    minHeight: 760,
    backgroundColor: '#0f172a',
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  window.once('ready-to-show', () => {
    window.show();
  });

  if (isDevelopment && process.env.ELECTRON_RENDERER_URL) {
    const rendererUrl = new URL('src/index.html', `${process.env.ELECTRON_RENDERER_URL}/`).toString();
    void window.loadURL(rendererUrl);
  } else {
    void window.loadFile(join(__dirname, '../renderer/src/index.html'));
  }

  return window;
}

app.whenReady().then(() => {
  registerIpcHandlers();
  buildApplicationMenu();
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
