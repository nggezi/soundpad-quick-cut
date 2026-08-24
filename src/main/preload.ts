import { contextBridge, ipcRenderer, webUtils } from "electron";
import type { ExportOptions, ExportProgress, SoundpadCategories } from "../shared/types.js";
import type { SoundpadQuickCutApi } from "../shared/api.js";

// Electron 28+ removed File.path; resolve dropped-file paths here via
// webUtils before the File objects leave the preload context.
let onFileDrop: ((paths: string[]) => void) | null = null;

document.addEventListener(
  "dragover",
  (e) => {
    e.preventDefault();
    e.stopPropagation();
  },
  true,
);

document.addEventListener(
  "drop",
  (e) => {
    e.preventDefault();
    e.stopPropagation();
    const files = e.dataTransfer?.files;
    if (!files || files.length === 0 || !onFileDrop) return;
    try {
      const paths: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const p = webUtils.getPathForFile(files[i]);
        if (p) paths.push(p);
      }
      if (paths.length > 0) onFileDrop(paths);
    } catch (err) {
      console.error("[preload] getPathForFile error:", err);
    }
  },
  true,
);

const api: SoundpadQuickCutApi = {
  openVideo: () => ipcRenderer.invoke("dialog:openVideo"),
  saveAudio: (defaultName: string) => ipcRenderer.invoke("dialog:saveAudio", defaultName),
  probe: (filePath: string) => ipcRenderer.invoke("ffmpeg:probe", filePath),
  waveform: (filePath: string, samples: number, durationHint?: number) =>
    ipcRenderer.invoke("ffmpeg:waveform", filePath, samples, durationHint),
  exportAudio: (opts: ExportOptions) => ipcRenderer.invoke("ffmpeg:export", opts),
  cancelExport: () => ipcRenderer.invoke("ffmpeg:exportCancel"),
  onExportProgress: (cb) => {
    const handler = (_e: unknown, p: ExportProgress) => cb(p);
    ipcRenderer.on("ffmpeg:exportProgress", handler);
    return () => ipcRenderer.removeListener("ffmpeg:exportProgress", handler);
  },
  showInFolder: (filePath: string) => ipcRenderer.invoke("shell:showInFolder", filePath),
  addToSoundpad: (filePath: string, category?: string) => ipcRenderer.invoke("soundpad:add", filePath, category),
  getSoundpadCategories: (): Promise<SoundpadCategories> => ipcRenderer.invoke("soundpad:categories"),
  soundpadExportPath: (fileName: string) => ipcRenderer.invoke("soundpad:exportPath", fileName),
  onFileDropped: (cb: (paths: string[]) => void) => {
    onFileDrop = cb;
  },
};

contextBridge.exposeInMainWorld("api", api);
