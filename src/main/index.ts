import { app, BrowserWindow, Menu } from "electron";
import { registerIpcHandlers } from "./ipc.js";
import { createMainWindow } from "./window.js";

// No default menu bar (File, Edit, View, ...)
Menu.setApplicationMenu(null);

let mainWindow: BrowserWindow | null = null;

function openMainWindow(): BrowserWindow {
  const win = createMainWindow();
  win.on("closed", () => {
    if (mainWindow === win) mainWindow = null;
  });
  return win;
}

app.whenReady().then(() => {
  registerIpcHandlers(() => mainWindow);
  mainWindow = openMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = openMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
