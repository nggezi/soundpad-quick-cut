import { useCallback, useEffect, useRef, useState } from "react";
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

const STORAGE_KEY = "soundpad-quick-cut:materials:v1";

interface PersistedMaterial {
  path: string;
  inPoint: number | null;
  outPoint: number | null;
  duration: number;
}

function hydrate(): SavedMaterial[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const saved = JSON.parse(raw) as PersistedMaterial[];
    if (!Array.isArray(saved)) return [];
    return saved
      .filter((m) => m && typeof m.path === "string" && m.path.length > 0)
      .map((m) => ({
        path: m.path,
        url: toFileUrl(m.path),
        probe: null,
        waveform: [],
        inPoint: m.inPoint ?? null,
        outPoint: m.outPoint ?? null,
        duration: m.duration ?? 0,
      }));
  } catch {
    return [];
  }
}

export function useMaterials() {
  const [materials, setMaterials] = useState<SavedMaterial[]>(hydrate);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [waveformLoading, setWaveformLoading] = useState(false);

  const materialsRef = useRef(materials);
  materialsRef.current = materials;
  const activeIdxRef = useRef(activeIdx);
  activeIdxRef.current = activeIdx;
  // Always equals the current material count, so newly appended placeholders
  // always get an index matching their array position.
  const nextIdxRef = useRef(materials.length);
  const loadTokenRef = useRef(0);

  // Persist paths / selection / duration; waveform and probe are re-derived
  // on demand so storage stays tiny.
  useEffect(() => {
    try {
      const data: PersistedMaterial[] = materials.map((m) => ({
        path: m.path,
        inPoint: m.inPoint,
        outPoint: m.outPoint,
        duration: m.duration,
      }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Storage unavailable; the library just won't survive restarts.
    }
  }, [materials]);

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

  const analyze = useCallback(
    async (filePath: string, idx: number): Promise<LoadResult> => {
      const token = ++loadTokenRef.current;
      setWaveformLoading(true);
      try {
        const probe = await window.api.probe(filePath);
        if (token !== loadTokenRef.current || materialsRef.current[idx]?.path !== filePath) {
          return { ok: true };
        }
        const base: Partial<SavedMaterial> = { probe, duration: probe.duration };
        if (!probe.hasAudio) {
          patch(idx, base);
          return { ok: false, message: "该文件没有音频轨道" };
        }
        try {
          const result = await window.api.waveform(filePath, WAVEFORM_SAMPLES, probe.duration);
          if (token !== loadTokenRef.current || materialsRef.current[idx]?.path !== filePath) {
            return { ok: true };
          }
          if (result.error && result.points.length === 0) {
            patch(idx, base);
            return { ok: false, message: `波形提取失败: ${result.error.slice(0, 120)}` };
          }
          patch(idx, { ...base, waveform: result.points });
        } catch (err) {
          console.error("[materials] waveform failed:", err);
          patch(idx, base);
        }
        return { ok: true };
      } catch (err) {
        console.error("[materials] probe failed:", err);
        return { ok: false, message: "读取失败: " + (err as Error).message };
      } finally {
        if (token === loadTokenRef.current) setWaveformLoading(false);
      }
    },
    [patch],
  );

  const loadVideo = useCallback(
    async (filePath: string): Promise<LoadResult> => {
      const existing = materialsRef.current.findIndex((m) => m.path === filePath);
      if (existing >= 0) {
        setActiveIdx(existing);
        // A hydrated material has no probe yet; analyze it on first selection.
        if (materialsRef.current[existing].probe === null) {
          return analyze(filePath, existing);
        }
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
      return analyze(filePath, idx);
    },
    [analyze],
  );

  const removeMaterial = useCallback((idx: number) => {
    nextIdxRef.current = Math.max(0, nextIdxRef.current - 1);
    loadTokenRef.current++; // invalidate in-flight analysis of the removed item
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
