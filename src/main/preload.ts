import { contextBridge, ipcRenderer, webUtils } from "electron";
import type { ExportOptions, ExportProgress } from "../shared/types.js";

// ---- Drag & drop: intercept in preload context ----
// Electron 28+ removed File.path. We must use webUtils.getPathForFile()
// BEFORE the File object leaves the preload context (contextBridge proxies
// lose the native file handle). So we intercept the drop event here,
// extract the path, and pass it to the renderer via a callback.

let onFileDrop: ((paths: string[]) => void) | null = null;

document.addEventListener("dragover", (e) => { e.preventDefault(); e.stopPropagation(); }, true);

document.addEventListener("drop", (e) => {
  e.preventDefault(); e.stopPropagation();
  const files = e.dataTransfer?.files;
  if (files && files.length > 0 && onFileDrop) {
    try {
      const paths: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const p = webUtils.getPathForFile(files[i]);
        if (p) paths.push(p);
      }
      if (paths.length > 0) onFileDrop(paths);
    } catch (err) { console.error("[preload] getPathForFile error:", err); }
  }
}, true);

// ---- Expose API to renderer ----
contextBridge.exposeInMainWorld("api", {
  // File dialog
  openVideo: () => ipcRenderer.invoke("dialog:openVideo"),
  saveAudio: (defaultName: string) => ipcRenderer.invoke("dialog:saveAudio", defaultName),

  // FFmpeg operations
  probe: (filePath: string) => ipcRenderer.invoke("ffmpeg:probe", filePath),
  waveform: (filePath: string, samples: number) => ipcRenderer.invoke("ffmpeg:waveform", filePath, samples),
  exportAudio: (opts: ExportOptions) => ipcRenderer.invoke("ffmpeg:export", opts),

  // Export progress subscription
  onExportProgress: (cb: (p: ExportProgress) => void) => {
    const handler = (_e: unknown, p: ExportProgress) => cb(p);
    ipcRenderer.on("ffmpeg:exportProgress", handler);
    return () => ipcRenderer.removeListener("ffmpeg:exportProgress", handler);
  },

  // Shell
  showInFolder: (filePath: string) => ipcRenderer.invoke("shell:showInFolder", filePath),

  // Soundpad integration
  addToSoundpad: (filePath: string, category?: string) => ipcRenderer.invoke("soundpad:add", filePath, category),

  // Drag & drop: register a callback for dropped files
  onFileDropped: (cb: (paths: string[]) => void) => { onFileDrop = cb; },
});
