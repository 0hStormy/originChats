import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// rest of your code

let isWinMaximized = false

const createWindow = () => {
  const win = new BrowserWindow({
    titleBarStyle: 'visible',
    width: 720,
    height: 720,
    minWidth: 640,
    minHeight: 480,
    icon: 'static/icons/icon512.png',
    transparent: true,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    }
  })

  win.loadFile('index.html')
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

ipcMain.on('window-control', (event, action) => {
  const win = BrowserWindow.getFocusedWindow();
  if (!win) return;

  switch (action) {
    case 'close':
      win.close();
      break;
    case 'minimize':
      win.minimize();
      break;
    case 'maximize':
      if (win.isMaximized()) {
        win.restore();
        isWinMaximized = false
      } else {
        win.maximize();
        isWinMaximized = true
      }
      break;
    case 'restore':
      win.restore();
      break;
  }
});