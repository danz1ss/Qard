import { app, BrowserWindow, ipcMain, Menu, shell } from 'electron';
import * as path from 'path';
import { setupGeminiHandlers } from './ipc/gemini.handlers';
import { setupTTSHandlers } from './ipc/tts.handlers';
import { setupSettingsHandlers } from './ipc/settings.handlers';
import { setupCollectionHandlers } from './ipc/collection.handlers';
import { setupReviewHandlers } from './ipc/review.handlers';
import { setupImportHandlers } from './ipc/import.handlers';
import { CollectionStorage } from './services/collection.storage';
import { SchedulerService } from './services/scheduler.service';
import { MediaService } from './services/media.service';
import { ImportService } from './services/import.service';

let mainWindow: BrowserWindow | null = null;
const storage = new CollectionStorage();

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
app.whenReady().then(async () => {
  await storage.open();
  const media = new MediaService(
    path.join(app.getPath('userData'), 'media')
  );
  await media.init();
  const scheduler = new SchedulerService(storage.service);
  const importService = new ImportService(storage.service, media);

  // Setup all IPC handlers
  setupGeminiHandlers(ipcMain);
  setupTTSHandlers(ipcMain);
  setupSettingsHandlers(ipcMain);
  setupCollectionHandlers(ipcMain, storage.service, media);
  setupReviewHandlers(ipcMain, scheduler);
  setupImportHandlers(ipcMain, importService);

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

// Сбрасываем несохранённые изменения БД на диск перед выходом
let dbFlushed = false;
app.on('will-quit', (event) => {
  if (dbFlushed) {
    return;
  }
  event.preventDefault();
  storage
    .flush()
    .finally(() => {
      dbFlushed = true;
      app.quit();
    });
});

// Quit when all windows are closed
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
