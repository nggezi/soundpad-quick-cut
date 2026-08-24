import type { SoundpadQuickCutApi } from "../shared/api.js";

declare global {
  interface Window {
    api: SoundpadQuickCutApi;
  }
}

export {};
