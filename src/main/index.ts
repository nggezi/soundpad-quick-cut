import { app, BrowserWindow, ipcMain, dialog, shell, Menu } from "electron";
import path from "node:path";
import { probeMedia } from "./ffmpeg-service.js";
import { getWaveform } from "./ffmpeg-service.js";
import { exportAudio } from "./ffmpeg-service.js";
import { addToSoundpad } from "./services/soundpad-api.js";

// __dirname is available in CJS (CommonJS) context

// Hide default menu bar (File, Edit, View...)
Menu.setApplicationMenu(null);

// ========== IPC handlers MUST be registered BEFORE app is ready ==========
ipcMain.handle("dialog:openVideo", async () => {
  const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
  const result = await dialog.showOpenDialog(win!, {
    title: "选择视频文件",
    properties: ["openFile"],
    filters: [
      { name: "视频文件", extensions: ["mp4", "mkv", "mov", "avi", "webm", "flv", "wmv", "m4v", "mpg", "mpeg", "ts"] },
      { name: "所有文件", extensions: ["*"] },
    ],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

ipcMain.handle("dialog:saveAudio", async (_e, defaultName: string) => {
  const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
  const result = await dialog.showSaveDialog(win!, {
    title: "导出音频",
    defaultPath: defaultName,
    filters: [
      { name: "WAV 音频", extensions: ["wav"] },
      { name: "MP3 音频", extensions: ["mp3"] },
    ],
  });
  if (result.canceled) return null;
  return result.filePath;
});

ipcMain.handle("ffmpeg:probe", async (_e, filePath: string) => {
  console.log("[IPC] probe:", filePath);
  try {
    const result = await probeMedia(filePath);
    console.log("[IPC] probe result:", JSON.stringify(result));
    return result;
  } catch (err) {
    console.error("[IPC] probe error:", err);
    throw err;
  }
});

ipcMain.handle("ffmpeg:waveform", async (_e, filePath: string, samples: number) => {
  console.log("[IPC] waveform:", filePath, "samples:", samples);
  try {
    return await getWaveform(filePath, samples);
  } catch (err) {
    console.error("[IPC] waveform error:", err);
    return [];
  }
});

ipcMain.handle("ffmpeg:export", async (_e, opts: import("../shared/types.js").ExportOptions) => {
  return exportAudio(opts, (progress) => {
    mainWindow?.webContents.send("ffmpeg:exportProgress", progress);
  });
});

ipcMain.handle("shell:showInFolder", async (_e, filePath: string) => {
  shell.showItemInFolder(filePath);
});

ipcMain.handle("soundpad:add", async (_e, filePath: string, category?: string) => {
  return addToSoundpad(filePath, category);
});

console.log("[main] IPC handlers registered");

// ========== Window creation ==========

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: "#0f1115",
    title: "Soundpad Quick Cut",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,   // Required: allow preload to access DOM for drag & drop
    },
  });

  if (process.env.NODE_ENV === "development") {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    mainWindow.loadFile(path.join(__dirname, "../../renderer/index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  console.log("[main] app ready");
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
