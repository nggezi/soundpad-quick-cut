import type {
  ExportOptions,
  ExportProgress,
  ProbeResult,
  SoundpadResult,
  WaveformPoint,
} from "./types.js";

export interface SoundpadQuickCutApi {
  openVideo: () => Promise<string | null>;
  saveAudio: (defaultName: string) => Promise<string | null>;
  tempAudioPath: (fileName: string) => Promise<string>;
  probe: (filePath: string) => Promise<ProbeResult>;
  waveform: (filePath: string, samples: number, durationHint?: number) => Promise<WaveformPoint[]>;
  exportAudio: (opts: ExportOptions) => Promise<void>;
  onExportProgress: (cb: (p: ExportProgress) => void) => () => void;
  showInFolder: (filePath: string) => Promise<void>;
  addToSoundpad: (filePath: string, category?: string) => Promise<SoundpadResult>;
  onFileDropped: (cb: (paths: string[]) => void) => void;
}
