// Shared types between main and renderer processes

export interface ProbeResult {
  duration: number; // seconds
  width?: number;
  height?: number;
  hasAudio: boolean;
  hasVideo: boolean;
  audioCodec?: string;
  audioSampleRate?: number;
  audioChannels?: number;
  videoCodec?: string;
  fps?: number;
  format?: string;
  bitrate?: number;
}

export interface WaveformPoint {
  t: number; // time in seconds
  min: number; // -1..1
  max: number; // -1..1
}

export interface WaveformResult {
  points: WaveformPoint[];
  error?: string;
}

export interface WaveformWindow {
  start: number;
  end: number;
}

export interface RefinedWaveform {
  start: number;
  end: number;
  points: WaveformPoint[];
}

export interface Clip {
  id: string;
  inPoint: number;
  outPoint: number;
}

export type ExportFormat = "wav" | "mp3";

export interface ExportOptions {
  inputPath: string;
  start: number; // seconds
  end: number; // seconds
  outputPath: string;
  format: ExportFormat;
  // mp3 options
  mp3Bitrate?: number; // e.g. 192
  // wav options
  wavSampleRate?: number; // e.g. 44100
  wavChannels?: number; // 1 or 2
  // audio effects
  fadeInMs?: number;
  fadeOutMs?: number;
  gainDb?: number;
}

export interface ExportProgress {
  percent: number; // 0..100
  done: boolean;
  error?: string;
  outputPath?: string;
}

export interface SoundpadResult {
  ok: boolean;
  error?: string;
}

export interface SoundpadCategories {
  connected: boolean;
  categories: string[];
  soundDir: string | null;
}

export type IpcChannels = {
  "dialog:openVideo": () => string | null;
  "dialog:saveAudio": (defaultName: string) => string | null;
  "ffmpeg:probe": (filePath: string) => ProbeResult;
  "ffmpeg:waveform": (filePath: string, samples: number, durationHint?: number, window?: WaveformWindow) => WaveformResult;
  "ffmpeg:export": (opts: ExportOptions) => void;
  "ffmpeg:exportCancel": () => void;
  "ffmpeg:exportProgress": (cb: (p: ExportProgress) => void) => void;
  "shell:showInFolder": (filePath: string) => void;
  "soundpad:add": (filePath: string, category?: string) => SoundpadResult;
  "soundpad:categories": () => SoundpadCategories;
  "soundpad:exportPath": (fileName: string) => string;
};
