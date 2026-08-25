import { useCallback, useEffect, useRef, useState } from "react";
import type { Clip, ProbeResult, RefinedWaveform, WaveformPoint } from "../../shared/types.js";
import { toFileUrl } from "../lib/file.js";

export interface SavedMaterial {
  path: string;
  url: string;
  probe: ProbeResult | null;
  waveform: WaveformPoint[];
  refined: RefinedWaveform | null;
  inPoint: number | null;
  outPoint: number | null;
  duration: number;
  clips: Clip[];
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
  clips: Clip[];
}

interface EditOp {
  idx: number;
  prev: { inPoint: number | null; outPoint: number | null; clips: Clip[] };
  next: { inPoint: number | null; outPoint: number | null; clips: Clip[] };
}

const uid = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

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
        refined: null,
        inPoint: m.inPoint ?? null,
        outPoint: m.outPoint ?? null,
        duration: m.duration ?? 0,
        clips: Array.isArray(m.clips) ? m.clips : [],
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
  const nextIdxRef = useRef(materials.length);
  const loadTokenRef = useRef(0);
  const refineTokenRef = useRef(0);
  const undoStack = useRef<EditOp[]>([]);
  const redoStack = useRef<EditOp[]>([]);

  useEffect(() => {
    try {
      const data: PersistedMaterial[] = materials.map((m) => ({
        path: m.path,
        inPoint: m.inPoint,
        outPoint: m.outPoint,
        duration: m.duration,
        clips: m.clips,
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

  // Selection edits (in/out/clips) go through here so every change lands on
  // the undo stack. Other fields (probe/waveform/...) are not recorded.
  const patchActive = useCallback(
    (patchData: Partial<SavedMaterial>) => {
      const idx = activeIdxRef.current;
      if (idx === null) return;
      const m = materialsRef.current[idx];
      if (!m) return;
      const touchesSelection =
        patchData.inPoint !== undefined || patchData.outPoint !== undefined || patchData.clips !== undefined;
      if (touchesSelection) {
        const prev = { inPoint: m.inPoint, outPoint: m.outPoint, clips: m.clips };
        const next = {
          inPoint: patchData.inPoint !== undefined ? patchData.inPoint : m.inPoint,
          outPoint: patchData.outPoint !== undefined ? patchData.outPoint : m.outPoint,
          clips: patchData.clips !== undefined ? patchData.clips : m.clips,
        };
        undoStack.current.push({ idx, prev, next });
        if (undoStack.current.length > 80) undoStack.current.shift();
        redoStack.current = [];
      }
      patch(idx, patchData);
    },
    [patch],
  );

  const undo = useCallback(() => {
    const op = undoStack.current.pop();
    if (!op) return;
    redoStack.current.push(op);
    patch(op.idx, op.prev);
  }, [patch]);

  const redo = useCallback(() => {
    const op = redoStack.current.pop();
    if (!op) return;
    undoStack.current.push(op);
    patch(op.idx, op.next);
  }, [patch]);

  const canUndo = undoStack.current.length > 0;
  const canRedo = redoStack.current.length > 0;

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
          refined: null,
          inPoint: null,
          outPoint: null,
          duration: 0,
          clips: [],
        },
      ]);
      setActiveIdx(idx);
      return analyze(filePath, idx);
    },
    [analyze],
  );

  const removeMaterial = useCallback((idx: number) => {
    nextIdxRef.current = Math.max(0, nextIdxRef.current - 1);
    loadTokenRef.current++;
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

  const addClip = useCallback(() => {
    const idx = activeIdxRef.current;
    if (idx === null) return;
    const m = materialsRef.current[idx];
    if (!m || m.inPoint === null || m.outPoint === null || m.outPoint <= m.inPoint) return;
    const clip: Clip = { id: uid(), inPoint: m.inPoint, outPoint: m.outPoint };
    patchActive({ clips: [...m.clips, clip] });
  }, [patchActive]);

  const removeClip = useCallback(
    (idx: number, clipId: string) => {
      const m = materialsRef.current[idx];
      if (!m) return;
      patchActive({ clips: m.clips.filter((c) => c.id !== clipId) });
    },
    [patchActive],
  );

  const selectClip = useCallback(
    (idx: number, clipId: string) => {
      const m = materialsRef.current[idx];
      const clip = m?.clips.find((c) => c.id === clipId);
      if (!m || !clip) return;
      setActiveIdx(idx);
      patchActive({ inPoint: clip.inPoint, outPoint: clip.outPoint });
    },
    [patchActive],
  );

  const refineWaveform = useCallback(
    async (start: number, end: number) => {
      const idx = activeIdxRef.current;
      if (idx === null) return;
      const m = materialsRef.current[idx];
      if (!m || !m.probe || end - start <= 0) return;
      const token = ++refineTokenRef.current;
      try {
        const result = await window.api.waveform(m.path, WAVEFORM_SAMPLES, m.duration, { start, end });
        if (token !== refineTokenRef.current || materialsRef.current[idx]?.path !== m.path) return;
        if (result.error && result.points.length === 0) return;
        patch(idx, { refined: { start, end, points: result.points } });
      } catch {
        // Refinement is best-effort; keep the base waveform.
      }
    },
    [patch],
  );

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
    addClip,
    removeClip,
    selectClip,
    refineWaveform,
    undo,
    redo,
    canUndo,
    canRedo,
  };
}
