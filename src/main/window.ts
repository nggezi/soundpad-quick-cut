import { BrowserWindow } from "electron";
import path from "node:path";

export function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
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
      // Drag & drop paths are resolved in the preload via webUtils, so the
      // renderer itself stays sandboxed-friendly.
      sandbox: false,
    },
  });

  if (process.env.NODE_ENV === "development") {
    void win.loadURL("http://localhost:5173");
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    void win.loadFile(path.join(__dirname, "../../renderer/index.html"));
  }

  return win;
}
