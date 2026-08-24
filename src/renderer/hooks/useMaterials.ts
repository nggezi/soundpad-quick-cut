import { useCallback, useRef, useState } from "react";
import type { ProbeResult, WaveformPoint } from "../../shared/types.js";
import { toFileUrl } from "../lib/file.js";

export interface SavedMaterial {
  path: string;
  url: string;
  probe: ProbeResult | null;
  waveform: WaveformPoint[];
  inPoint: number | null;
  outPoint: number | null;
  duration: number;
}

export interface LoadResult {
  ok: boolean;
  message?: string;
}

export const WAVEFORM_SAMPLES = 4000;

export function useMaterials() {
  const [materials, setMaterials] = useState<SavedMaterial[]>([]);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [waveformLoading, setWaveformLoading] = useState(false);

  const materialsRef = useRef(materials);
  materialsRef.current = materials;
  const activeIdxRef = useRef(activeIdx);
  activeIdxRef.current = activeIdx;
  // Always equals the current material count, so newly appended placeholders
  // always get an index matching their array position.
  const nextIdxRef = useRef(0);

  const patch = useCallback((idx: number, patchData: Partial<SavedMaterial>) => {
    setMaterials((prev) => {
      if (idx < 0 || idx >= prev.length) return prev;
      const next = [...prev];
      next[idx] = { ...next[idx], ...patchData };
      return next;
    });
  }, []);

  const patchActive = useCallback(
    (patchData: Partial<SavedMaterial>) => {
      const idx = activeIdxRef.current;
      if (idx !== null) patch(idx, patchData);
    },
    [patch],
  );

  const loadVideo = useCallback(
    async (filePath: string): Promise<LoadResult> => {
      const existing = materialsRef.current.findIndex((m) => m.path === filePath);
      if (existing >= 0) {
        setActiveIdx(existing);
        return { ok: true };
      }

      const idx = nextIdxRef.current++;
      setMaterials((prev) => [
        ...prev,
        {
          path: filePath,
          url: toFileUrl(filePath),
          probe: null,
          waveform: [],
          inPoint: null,
          outPoint: null,
          duration: 0,
        },
      ]);
      setActiveIdx(idx);
      setWaveformLoading(true);

      try {
        const probe = await window.api.probe(filePath);
        if (materialsRef.current[idx]?.path !== filePath) return { ok: true };

        const base: Partial<SavedMaterial> = { probe, duration: probe.duration };
        if (!probe.hasAudio) {
          patch(idx, base);
          return { ok: false, message: "该文件没有音频轨道" };
        }

        try {
          const waveform = await window.api.waveform(filePath, WAVEFORM_SAMPLES, probe.duration);
          if (materialsRef.current[idx]?.path !== filePath) return { ok: true };
          patch(idx, { ...base, waveform });
        } catch (err) {
          console.error("[materials] waveform failed:", err);
          patch(idx, base);
        }
        return { ok: true };
      } catch (err) {
        console.error("[materials] probe failed:", err);
        return { ok: false, message: "读取失败: " + (err as Error).message };
      } finally {
        setWaveformLoading(false);
      }
    },
    [patch],
  );

  const removeMaterial = useCallback((idx: number) => {
    nextIdxRef.current = Math.max(0, nextIdxRef.current - 1);
    setMaterials((prev) => prev.filter((_, i) => i !== idx));
    setActiveIdx((prev) =>
      prev === null ? null : prev === idx ? null : prev > idx ? prev - 1 : prev,
    );
  }, []);

  const switchMaterial = useCallback((idx: number) => {
    setActiveIdx(idx);
  }, []);

  const clearSelection = useCallback(() => {
    patchActive({ inPoint: null, outPoint: null });
  }, [patchActive]);

  const active = activeIdx !== null ? materials[activeIdx] ?? null : null;

  return {
    materials,
    activeIdx,
    active,
    waveformLoading,
    loadVideo,
    removeMaterial,
    switchMaterial,
    patchActive,
    clearSelection,
  };
}
