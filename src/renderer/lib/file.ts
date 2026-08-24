const VIDEO_EXTENSION_RE = /\.(mp4|mkv|mov|avi|webm|flv|wmv|m4v|mpg|mpeg|ts)$/i;
const AUDIO_EXTENSION_RE = /\.(mp3|wav|flac|m4a|aac|ogg|opus)$/i;

export const toFileUrl = (p: string): string => "file:///" + p.replace(/\\/g, "/");

export const fileName = (p: string): string => p.replace(/\\/g, "/").split("/").pop() || p;

export const baseName = (p: string): string => fileName(p).replace(/\.[^.]+$/, "");

export const isMediaFile = (p: string): boolean =>
  VIDEO_EXTENSION_RE.test(p) || AUDIO_EXTENSION_RE.test(p);
