import type {
  ExportOptions,
  ExportProgress,
  ProbeResult,
  SoundpadCategories,
  SoundpadResult,
  WaveformResult,
} from "./types.js";

export interface SoundpadQuickCutApi {
  openVideo: () => Promise<string | null>;
  saveAudio: (defaultName: string) => Promise<string | null>;
  probe: (filePath: string) => Promise<ProbeResult>;
  waveform: (filePath: string, samples: number, durationHint?: number) => Promise<WaveformResult>;
  exportAudio: (opts: ExportOptions) => Promise<void>;
  cancelExport: () => Promise<void>;
  onExportProgress: (cb: (p: ExportProgress) => void) => () => void;
  showInFolder: (filePath: string) => Promise<void>;
  addToSoundpad: (filePath: string, category?: string) => Promise<SoundpadResult>;
  getSoundpadCategories: () => Promise<SoundpadCategories>;
  soundpadExportPath: (fileName: string) => Promise<string>;
  onFileDropped: (cb: (paths: string[]) => void) => void;
}
