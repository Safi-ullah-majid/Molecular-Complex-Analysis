const { app, BrowserWindow } = require('electron');
const { spawn } = require('child_process');

app.commandLine.appendSwitch('no-sandbox');

let mainWindow;
let backendProcess;

function startBackend() {
  backendProcess = spawn('python3', ['api.py'], {
    cwd: __dirname,
    stdio: 'inherit'
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    }
  });

  setTimeout(() => {
    mainWindow.loadURL('http://localhost:8000');
  }, 3000);
}

app.on('ready', () => {
  startBackend();
  createWindow();
});

app.on('quit', () => {
  if (backendProcess) backendProcess.kill();
});
