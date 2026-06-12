import { app, BrowserWindow, ipcMain, Menu, shell } from 'electron';
import * as path from 'path';
import { setupAnkiHandlers } from './ipc/anki.handlers';
import { setupGeminiHandlers } from './ipc/gemini.handlers';
import { setupTTSHandlers } from './ipc/tts.handlers';
import { setupSettingsHandlers } from './ipc/settings.handlers';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    title: 'AnkiGenerator',
    icon: path.join(__dirname, '../../assets/icon.png')
  });

  // Remove the menu bar
  Menu.setApplicationMenu(null);

  // Load the index.html from the dist/renderer folder
  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// App ready
app.whenReady().then(() => {
  // Setup all IPC handlers
  setupAnkiHandlers(ipcMain);
  setupGeminiHandlers(ipcMain);
  setupTTSHandlers(ipcMain);
  setupSettingsHandlers(ipcMain);

  // Handle external links
  ipcMain.handle('shell:openExternal', async (_, url: string) => {
    await shell.openExternal(url);
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
