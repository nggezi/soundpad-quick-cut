import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import path from "node:path";
import fs from "node:fs";
import { exportAudio, getWaveform, probeMedia } from "./ffmpeg-service.js";
import { addToSoundpad } from "./services/soundpad-api.js";
import type { ExportOptions } from "../shared/types.js";

const VIDEO_EXTENSIONS = ["mp4", "mkv", "mov", "avi", "webm", "flv", "wmv", "m4v", "mpg", "mpeg", "ts"];

export function registerIpcHandlers(getWindow: () => BrowserWindow | null): void {
  const focusedWindow = (): BrowserWindow | undefined =>
    getWindow() ?? BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];

  ipcMain.handle("dialog:openVideo", async () => {
    const win = focusedWindow();
    const options = {
      title: "选择视频文件",
      properties: ["openFile" as const],
      filters: [
        { name: "视频文件", extensions: VIDEO_EXTENSIONS },
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

  // Path in the OS temp folder for exports that go straight to Soundpad.
  // The name is the user-facing clip name (e.g. "片段_01.wav"); we strip
  // characters that are illegal in filenames or would break the pipe command,
  // and append a numeric suffix if the file already exists.
  ipcMain.handle("dialog:tempAudioPath", (_e, fileName: string) => {
    const ext = (path.extname(fileName) || ".wav").toLowerCase();
    const base = path.basename(fileName, ext).replace(/[\\/:*?"<>|\r\n\t]/g, "_").trim();
    const name = base || "clip";
    const dir = app.getPath("temp");
    let candidate = path.join(dir, `${name}${ext}`);
    let n = 1;
    while (fs.existsSync(candidate)) {
      candidate = path.join(dir, `${name}-${n}${ext}`);
      n++;
    }
    return candidate;
  });

  ipcMain.handle("ffmpeg:probe", async (_e, filePath: string) => probeMedia(filePath));

  ipcMain.handle("ffmpeg:waveform", async (_e, filePath: string, samples: number, durationHint?: number) =>
    getWaveform(filePath, samples, durationHint),
  );

  ipcMain.handle("ffmpeg:export", async (_e, opts: ExportOptions) => {
    return exportAudio(opts, (progress) => {
      focusedWindow()?.webContents.send("ffmpeg:exportProgress", progress);
    });
  });

  ipcMain.handle("shell:showInFolder", async (_e, filePath: string) => {
    shell.showItemInFolder(filePath);
  });

  ipcMain.handle("soundpad:add", async (_e, filePath: string, category?: string) =>
    addToSoundpad(filePath, category),
  );
}
