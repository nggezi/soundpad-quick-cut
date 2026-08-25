import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import path from "node:path";
import fs from "node:fs";
import { cancelExport, exportAudio, getWaveform, probeMedia } from "./ffmpeg-service.js";
import { addToSoundpad, getSoundpadCategories } from "./services/soundpad-api.js";
import type { ExportOptions } from "../shared/types.js";

const MEDIA_EXTENSIONS = [
  "mp4", "mkv", "mov", "avi", "webm", "flv", "wmv", "m4v", "mpg", "mpeg", "ts",
  "mp3", "wav", "flac", "m4a", "aac", "ogg", "opus",
];

export function registerIpcHandlers(getWindow: () => BrowserWindow | null): void {
  const focusedWindow = (): BrowserWindow | undefined =>
    getWindow() ?? BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];

  ipcMain.handle("dialog:openVideo", async () => {
    const win = focusedWindow();
    const options = {
      title: "选择视频或音频文件",
      properties: ["openFile" as const],
      filters: [
        { name: "媒体文件", extensions: MEDIA_EXTENSIONS },
        { name: "所有文件", extensions: ["*"] },
      ],
    };
    const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options);
    return result.canceled || result.filePaths.length === 0 ? null : result.filePaths[0];
  });

  ipcMain.handle("dialog:saveAudio", async (_e, defaultName: string) => {
    const win = focusedWindow();
    const options = {
      title: "导出音频",
      defaultPath: defaultName,
      filters: [
        { name: "WAV 音频", extensions: ["wav"] },
        { name: "MP3 音频", extensions: ["mp3"] },
      ],
    };
    const result = win ? await dialog.showSaveDialog(win, options) : await dialog.showSaveDialog(options);
    return result.canceled ? null : result.filePath;
  });

  ipcMain.handle("ffmpeg:probe", async (_e, filePath: string) => probeMedia(filePath));

  ipcMain.handle(
    "ffmpeg:waveform",
    async (_e, filePath: string, samples: number, durationHint?: number, window?: { start: number; end: number }) => {
    try {
      return await getWaveform(filePath, samples, durationHint, window);
    } catch (err) {
      return { points: [], error: (err as Error).message || "未知错误" };
    }
  });

  ipcMain.handle("ffmpeg:export", async (_e, opts: ExportOptions) => {
    return exportAudio(opts, (progress) => {
      focusedWindow()?.webContents.send("ffmpeg:exportProgress", progress);
    });
  });

  ipcMain.handle("ffmpeg:exportCancel", () => {
    cancelExport();
  });

  ipcMain.handle("shell:showInFolder", async (_e, filePath: string) => {
    shell.showItemInFolder(filePath);
  });

  ipcMain.handle("soundpad:add", async (_e, filePath: string, category?: string) =>
    addToSoundpad(filePath, category),
  );

  ipcMain.handle("soundpad:categories", () => getSoundpadCategories());

  // Destination for Soundpad-bound exports: the directory Soundpad already
  // uses for its sounds (so the clip survives temp cleanup), falling back to a
  // per-user folder if Soundpad has no sounds yet.
  ipcMain.handle("soundpad:exportPath", async (_e, fileName: string) => {
    const state = await getSoundpadCategories();
    const dir = state.soundDir || path.join(app.getPath("documents"), "Soundpad Quick Cut");
    fs.mkdirSync(dir, { recursive: true });
    const ext = (path.extname(fileName) || ".wav").toLowerCase();
    const base = path.basename(fileName, ext).replace(/[\\/:*?"<>|\r\n\t]/g, "_").trim();
    const name = base || "clip";
    let candidate = path.join(dir, `${name}${ext}`);
    let n = 1;
    while (fs.existsSync(candidate)) {
      candidate = path.join(dir, `${name}-${n}${ext}`);
      n++;
    }
    return candidate;
  });
}
