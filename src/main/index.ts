import { app, BrowserWindow, dialog, ipcMain, shell, session } from "electron";
import { join } from "node:path";
import { approveOutputDirectory, isKnownExport, readRegisteredImage, registerImagePaths, registerWatermarkPath, saveExportFile } from "./files";
import type { SaveExportRequest } from "../shared/types";

// Some Linux desktop drivers fail before Electron can show the first window.
// Canvas rendering remains fully available through Chromium's software path.
if (process.platform === "linux") {
  app.disableHardwareAcceleration();
}

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  const window = new BrowserWindow({
    width: 1366,
    height: 820,
    minWidth: 960,
    minHeight: 680,
    backgroundColor: "#e9e5de",
    show: true,
    autoHideMenuBar: true,
    title: "简普水印工作室",
    webPreferences: {
      preload: join(__dirname, "../preload/index.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  mainWindow = window;

  window.on("closed", () => {
    if (mainWindow === window) mainWindow = null;
  });
  window.webContents.once("did-finish-load", () => {
    window.show();
    window.focus();
  });
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event) => event.preventDefault());

  if (process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void window.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) {
      createWindow();
      return;
    }
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });
}

function installIpcHandlers(): void {
  ipcMain.handle("images:select", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openFile", "multiSelections"],
      filters: [{ name: "图片", extensions: ["jpg", "jpeg", "png", "webp"] }],
    });
    return result.canceled ? [] : registerImagePaths(result.filePaths);
  });

  ipcMain.handle("images:register", (_event, paths: unknown) => {
    if (!Array.isArray(paths) || !paths.every((path) => typeof path === "string")) {
      throw new Error("拖入文件参数无效。");
    }
    return registerImagePaths(paths.slice(0, 500));
  });

  ipcMain.handle("images:read", (_event, id: unknown) => {
    if (typeof id !== "string") throw new Error("图片标识无效。");
    return readRegisteredImage(id);
  });

  ipcMain.handle("watermark:select", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openFile"],
      filters: [{ name: "Logo 图片", extensions: ["svg", "png", "jpg", "jpeg", "webp"] }],
    });
    if (result.canceled || !result.filePaths[0]) return null;
    return registerWatermarkPath(result.filePaths[0]);
  });

  ipcMain.handle("exports:choose-directory", async () => {
    const result = await dialog.showOpenDialog({ properties: ["openDirectory", "createDirectory"] });
    if (result.canceled || !result.filePaths[0]) return null;
    return approveOutputDirectory(result.filePaths[0]);
  });

  ipcMain.handle("exports:save", (_event, request: SaveExportRequest) => saveExportFile(request));
  ipcMain.handle("exports:show", async (_event, path: unknown) => {
    if (typeof path !== "string" || !isKnownExport(path)) throw new Error("文件路径无效。");
    shell.showItemInFolder(path);
  });
}

app.whenReady().then(() => {
  if (app.isPackaged) {
    const filter = { urls: ["http://*/*", "https://*/*"] };
    session.defaultSession.webRequest.onBeforeRequest(filter, (_details, callback) => callback({ cancel: true }));
  }
  installIpcHandlers();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
