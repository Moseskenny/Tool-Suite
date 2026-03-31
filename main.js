// Add 'dialog' to this list
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process'); // This lets us launch hidden .exe files

let pythonProcess = null; // We store the engine here so we can kill it later

function createWindow () {
 const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: false, 
    transparent: true, 
    backgroundColor: '#00000000', // <--- THIS KILLS THE WHITE CORNERS ON WINDOWS
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // 👇 FIXED: Pointing exactly to the frontend folder
  mainWindow.loadFile(path.join(__dirname, 'frontend', 'index.html'));

  // --- Custom Window Controls ---
  ipcMain.on('window-minimize', () => mainWindow.minimize());
  ipcMain.on('window-maximize', () => {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  });
  ipcMain.on('window-close', () => mainWindow.close());

}
function startPythonEngine() {
  // Find the engine block based on whether we are in dev-mode or installed-mode
  const enginePath = app.isPackaged
    ? path.join(process.resourcesPath, 'toolsuite-engine.exe') // Production path
    : path.join(__dirname, 'backend', 'dist', 'toolsuite-engine.exe'); // Developer path

  // Turn the key
  console.log("Starting ToolSuite Engine at:", enginePath);
  pythonProcess = spawn(enginePath, { detached: false });

  // Optional: Log errors so we can debug
  pythonProcess.stderr.on('data', (data) => {
    console.error(`Engine Error: ${data}`);
  });
}

app.whenReady().then(() => {
  startPythonEngine(); // Starts the backend invisibly
  createWindow();      // Opens your beautiful squircle UI
});

// THE KILLSWITCH: If the app closes, assassinate the Python process immediately
app.on('will-quit', () => {
  if (pythonProcess) {
    console.log("Assassinating Python Engine...");
    pythonProcess.kill();
  }
});

// --- Folder Selection Handler ---
ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  });
  if (result.canceled) {
    return null;
  } else {
    return result.filePaths[0];
  }
});
//hello