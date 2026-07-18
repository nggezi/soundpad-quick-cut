import React, { useCallback, useEffect, useRef, useState } from "react";
import { Waveform } from "./components/Waveform.js";
import type { ProbeResult, WaveformPoint, ExportOptions, ExportProgress } from "../shared/types.js";

declare global {
  interface Window {
    api: {
      openVideo: () => Promise<string | null>;
      saveAudio: (defaultName: string) => Promise<string | null>;
      probe: (filePath: string) => Promise<ProbeResult>;
      waveform: (filePath: string, samples: number) => Promise<WaveformPoint[]>;
      exportAudio: (opts: ExportOptions) => Promise<void>;
      onExportProgress: (cb: (p: ExportProgress) => void) => () => void;
      showInFolder: (filePath: string) => Promise<void>;
      onFileDropped: (cb: (paths: string[]) => void) => void;
      addToSoundpad: (filePath: string, category?: string) => Promise<{ ok: boolean; error?: string }>;
    };
  }
}

const fmtTime = (s: number): string => {
  if (!isFinite(s) || s < 0) return "00:00.00";
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${sec.toFixed(2).padStart(5, "0")}`;
};

interface Saved {
  path: string; url: string; probe: ProbeResult | null;
  waveform: WaveformPoint[]; inPoint: number | null; outPoint: number | null; duration: number;
}

const CATEGORIES = ["Quick Cut", "Voice", "FX", "Music", "Ambient"];
const getStoredFormat = (): "wav" | "mp3" => (localStorage.getItem("exportFormat") as "wav" | "mp3") || "wav";
const setStoredFormat = (f: "wav" | "mp3") => localStorage.setItem("exportFormat", f);

export default function App() {
  const [materials, setMaterials] = useState<Saved[]>([]);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  const videoPath = activeIdx !== null ? materials[activeIdx]?.path ?? null : null;
  const videoUrl = activeIdx !== null ? materials[activeIdx]?.url ?? null : null;
  const probe = activeIdx !== null ? materials[activeIdx]?.probe ?? null : null;
  const waveform = activeIdx !== null ? materials[activeIdx]?.waveform ?? [] : [];
  const inPoint = activeIdx !== null ? materials[activeIdx]?.inPoint ?? null : null;
  const outPoint = activeIdx !== null ? materials[activeIdx]?.outPoint ?? null : null;
  const duration = activeIdx !== null ? materials[activeIdx]?.duration ?? 0 : 0;

  const [waveformLoading, setWaveformLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [exportFormat, setExportFormat] = useState<"wav" | "mp3">(getStoredFormat());
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [toast, setToast] = useState<{ msg: string; kind: "success" | "error" } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [waveformZoom, setWaveformZoom] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [category, setCategory] = useState("Quick Cut");

  const videoRef = useRef<HTMLVideoElement>(null);
  const previewCheckRef = useRef<(() => void) | null>(null);

  const pathRef = useRef(videoPath); pathRef.current = videoPath;
  const inRef = useRef(inPoint); inRef.current = inPoint;
  const outRef = useRef(outPoint); outRef.current = outPoint;
  const durRef = useRef(duration); durRef.current = duration;
  const fpsRef = useRef(30); fpsRef.current = probe?.fps ?? 30;
  const catRef = useRef(category); catRef.current = category;

  const updateMaterial = useCallback((idx: number, patch: Partial<Saved>) => {
    setMaterials((prev) => { const next = [...prev]; if (idx >= 0 && idx < next.length) next[idx] = { ...next[idx], ...patch }; return next; });
  }, []);

  const setInPoint = useCallback((v: number | null) => { if (activeIdx !== null) updateMaterial(activeIdx, { inPoint: v }); }, [activeIdx, updateMaterial]);
  const setOutPoint = useCallback((v: number | null) => { if (activeIdx !== null) updateMaterial(activeIdx, { outPoint: v }); }, [activeIdx, updateMaterial]);
  const setDurationFn = useCallback((v: number) => { if (activeIdx !== null) updateMaterial(activeIdx, { duration: v }); }, [activeIdx, updateMaterial]);

  const saveCurrent = useCallback(() => {
    if (activeIdx === null || !pathRef.current) return;
    updateMaterial(activeIdx, { probe, waveform, inPoint, outPoint, duration, path: pathRef.current, url: videoUrl! });
  }, [activeIdx, probe, waveform, inPoint, outPoint, duration, videoUrl, updateMaterial]);

  // ---- Play helper: seek to inPoint if outside selection ----
  const playOrPause = useCallback(() => {
    const v = videoRef.current; if (!v) return;
    if (v.paused) {
      const i = inRef.current, o = outRef.current;
      // Seek to inPoint if before selection OR after selection ended
      if (i !== null && (v.currentTime < i || (o !== null && v.currentTime >= o))) {
        v.currentTime = i;
      }
      v.play();
    } else { v.pause(); }
  }, []);

  const repeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stepFrame = (dir: 1 | -1) => { const v = videoRef.current; if (!v) return; v.currentTime = Math.max(0, Math.min(durRef.current, v.currentTime + dir / fpsRef.current)); };
  const stepSecond = (dir: 1 | -1) => { const v = videoRef.current; if (!v) return; v.currentTime = Math.max(0, Math.min(durRef.current, v.currentTime + dir)); };
  const startRepeat = (fn: () => void) => { fn(); repeatRef.current = setInterval(fn, 80); };
  const stopRepeat = () => { if (repeatRef.current) { clearInterval(repeatRef.current); repeatRef.current = null; } };
  useEffect(() => () => stopRepeat(), []);

  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t); }, [toast]);

  useEffect(() => {
    const off = window.api.onExportProgress((p) => { setProgress(p.percent); if (p.done) { setExporting(false); if (p.error) setToast({ msg: "导出失败", kind: "error" }); else setToast({ msg: "导出成功", kind: "success" }); } });
    return off;
  }, []);
  const nextIdxRef = useRef(0);
  const matRef = useRef(materials); matRef.current = materials; // stable ref

  const loadVideo = useCallback(async (filePath: string) => {
    const url = "file:///" + filePath.replace(/\\/g, "/");
    const existing = materials.findIndex((m) => m.path === filePath);
    if (existing >= 0) { setActiveIdx(existing); return; }
    const newIdx = nextIdxRef.current++;
    const empty: Saved = { path: filePath, url, probe: null, waveform: [], inPoint: null, outPoint: null, duration: 0 };
    setMaterials((prev) => [...prev, empty]);
    setActiveIdx(newIdx);
    setCurrentTime(0);
    setWaveformLoading(true);
    try {
      const p = await window.api.probe(filePath);
      // Verify this material wasn't removed during the await
      if (matRef.current[newIdx]?.path !== filePath) return;
      if (p.hasAudio) {
        try {
          const w = await window.api.waveform(filePath, 4000);
          if (matRef.current[newIdx]?.path !== filePath) return;
          updateMaterial(newIdx, { probe: p, waveform: w, duration: p.duration });
        } catch { updateMaterial(newIdx, { probe: p, duration: p.duration }); }
      } else { updateMaterial(newIdx, { probe: p, duration: p.duration }); setToast({ msg: "无音频轨道", kind: "error" }); }
    } catch (e) { setToast({ msg: "读取失败: " + (e as Error).message, kind: "error" }); }
    finally { setWaveformLoading(false); }
  }, [materials, updateMaterial]);

  const removeMaterial = useCallback((idx: number) => {
    setMaterials((prev) => prev.filter((_, i) => i !== idx));
    setActiveIdx((prev) => prev === null ? null : prev === idx ? null : prev > idx ? prev - 1 : prev);
  }, []);

  const switchMaterial = useCallback((idx: number) => { saveCurrent(); setActiveIdx(idx); setCurrentTime(0); }, [saveCurrent]);

  const handleOpen = useCallback(async () => { const p = await window.api.openVideo(); if (p) loadVideo(p); }, [loadVideo]);

  useEffect(() => {
    let mounted = true;
    window.api.onFileDropped((paths: string[]) => {
      if (!mounted) return;
      setDragOver(false);
      for (const filePath of paths) {
        if (/\.(mp4|mkv|mov|avi|webm|flv|wmv|m4v|mpg|mpeg|ts)$/i.test(filePath)) {
          loadVideo(filePath);
        }
      }
    });
    const onOver = (e: DragEvent) => { e.preventDefault(); setDragOver(true); };
    const onLeave = (e: DragEvent) => { if (e.relatedTarget === null) setDragOver(false); };
    document.addEventListener("dragover", onOver); document.addEventListener("dragleave", onLeave);
    return () => { mounted = false; document.removeEventListener("dragover", onOver); document.removeEventListener("dragleave", onLeave); };
  }, [loadVideo]);

  useEffect(() => {
    const v = videoRef.current; if (!v) return;
    let raf: number;
    const tick = () => { setCurrentTime(v.currentTime); if (outRef.current !== null && v.currentTime >= outRef.current) v.pause(); raf = requestAnimationFrame(tick); };
    const onMeta = () => { if (durRef.current === 0 && v.duration > 0) setDurationFn(v.duration); };
    v.addEventListener("loadedmetadata", onMeta);
    v.addEventListener("play", () => { setPlaying(true); raf = requestAnimationFrame(tick); });
    v.addEventListener("pause", () => { setPlaying(false); cancelAnimationFrame(raf); });
    v.addEventListener("ended", () => { setPlaying(false); cancelAnimationFrame(raf); });
    return () => { cancelAnimationFrame(raf); v.removeEventListener("loadedmetadata", onMeta); };
  }, [videoUrl]);

  const handleSeek = useCallback((t: number) => { const v = videoRef.current; if (v) v.currentTime = t; setCurrentTime(t); }, []);
  const handleRegionChange = useCallback((s: number, e: number) => {
    if (activeIdx !== null) updateMaterial(activeIdx, { inPoint: s, outPoint: e });
  }, [activeIdx, updateMaterial]);
  const handleZoomChange = useCallback((z: number) => setWaveformZoom(z), []);

  const setInHere = useCallback(() => {
    const v = videoRef.current; if (!v) return;
    const t = v.currentTime;
    if (activeIdx === null) return;
    const curOut = materials[activeIdx]?.outPoint ?? null;
    updateMaterial(activeIdx, { inPoint: t, outPoint: (curOut !== null && t > curOut ? null : curOut) });
  }, [activeIdx, materials, updateMaterial]);

  const setOutHere = useCallback(() => {
    const v = videoRef.current; if (!v) return;
    const t = v.currentTime;
    if (activeIdx === null) return;
    const curIn = materials[activeIdx]?.inPoint ?? null;
    updateMaterial(activeIdx, { outPoint: t, inPoint: (curIn !== null && t < curIn ? null : curIn) });
  }, [activeIdx, materials, updateMaterial]);

  const handlePreview = useCallback(() => {
    const v = videoRef.current; if (!v) return;
    const i = inRef.current, o = outRef.current; if (i === null || o === null) return;
    if (previewCheckRef.current) v.removeEventListener("timeupdate", previewCheckRef.current);
    v.currentTime = i; v.play();
    const check = () => { if (v.currentTime >= o) { v.pause(); v.removeEventListener("timeupdate", check); previewCheckRef.current = null; } };
    previewCheckRef.current = check; v.addEventListener("timeupdate", check);
  }, []);
  useEffect(() => () => { if (previewCheckRef.current && videoRef.current) videoRef.current.removeEventListener("timeupdate", previewCheckRef.current); }, [videoUrl]);

  const doExport = useCallback(async (toSoundpad: boolean) => {
    const p = pathRef.current, i = inRef.current, o = outRef.current;
    if (!p || i === null || o === null) return;
    const baseName = p.replace(/\\/g, "/").split("/").pop()!.replace(/\.[^.]+$/, "");
    const cat = toSoundpad ? catRef.current : "";
    const prefix = cat ? cat + "_" : "";
    const f = exportFormat;
    const defaultName = prefix + baseName + "_" + fmtTime(i).replace(/[:.]/g, "-") + "." + f;
    const outPath = await window.api.saveAudio(defaultName);
    if (!outPath) return;
    setExporting(true); setProgress(0);
    try {
      await window.api.exportAudio({ inputPath: p, start: i, end: o, outputPath: outPath, format: f, mp3Bitrate: 192, wavSampleRate: 44100, wavChannels: 2 });
      window.api.showInFolder(outPath);
      if (toSoundpad) {
        const sp = await window.api.addToSoundpad(outPath, cat);
        setToast({ msg: sp.ok ? "已添加至 Soundpad [" + cat + "]" : "导出成功，但 Soundpad: " + (sp.error || "未连接"), kind: "success" });
      } else {
        setToast({ msg: "导出成功", kind: "success" });
      }
    } catch (e) { setExporting(false); setToast({ msg: "导出失败: " + (e as Error).message, kind: "error" }); }
  }, [exportFormat]);

  const handleExport = useCallback(() => doExport(false), [doExport]);
  const handleExportToSp = useCallback(() => doExport(true), [doExport]);

  const setInRef = useRef(setInHere); setInRef.current = setInHere;
  const setOutRef = useRef(setOutHere); setOutRef.current = setOutHere;
  const previewRef = useRef(handlePreview); previewRef.current = handlePreview;
  const exportRef = useRef(handleExport); exportRef.current = handleExport;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      const v = videoRef.current; if (!v) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "e") { e.preventDefault(); exportRef.current(); return; }
      switch (e.key.toLowerCase()) {
        case " ": e.preventDefault(); playOrPause(); break;
        case "i": setInRef.current(); break;
        case "o": setOutRef.current(); break;
        case "arrowleft": e.shiftKey ? stepSecond(-1) : stepFrame(-1); break;
        case "arrowright": e.shiftKey ? stepSecond(1) : stepFrame(1); break;
        case "p": previewRef.current(); break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const selDur = inPoint !== null && outPoint !== null ? outPoint - inPoint : 0;
  const showSidebar = materials.length > 0;

  return (
    <div className="app">
      <div className="topbar">
        <span className="title">Soundpad Quick Cut</span>
        <button onClick={handleOpen} className="primary">导入视频</button>
        {videoPath && <span className="filename" title={videoPath}>{videoPath.replace(/\\/g, "/").split("/").pop()}</span>}
        <div className="spacer" />
        {materials.length > 0 && <span className="mat-count">{materials.length} 个素材</span>}
      </div>

      <div className="workspace">
        {showSidebar && (
          <div className="sidebar">
            <div className="sidebar-header">素材库</div>
            <div className="sidebar-list">
              {materials.map((m, i) => (
                <div key={i} className={"sidebar-item" + (i === activeIdx ? " active" : "")} onClick={() => switchMaterial(i)}>
                  <span className="sidebar-item-name" title={m.path}>{m.path.replace(/\\/g, "/").split("/").pop()}</span>
                  <span className="sidebar-item-time">{m.duration > 0 ? fmtTime(m.duration) : "..."}</span>
                  <button className="sidebar-item-del" onClick={(e) => { e.stopPropagation(); removeMaterial(i); }} title="移除">x</button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="content">
          {!videoUrl ? (
            <div className="empty-state">
              <div className={"dropzone" + (dragOver ? " dragover" : "")}>
                <div className="big"></div>
                <div>拖入视频文件，或点击上方"导入视频"</div>
                <div className="hint">MP4 / MKV / MOV / AVI / WebM</div>
              </div>
            </div>
          ) : (
            <>
              <div className="preview">
                <video ref={videoRef} src={videoUrl} controls={false}
                  onClick={playOrPause} />
              </div>

              <div className="transport-bar">
                <button onMouseDown={() => startRepeat(() => stepFrame(-1))} onMouseUp={stopRepeat} onMouseLeave={stopRepeat}>-1帧</button>
                <button onMouseDown={() => startRepeat(() => stepSecond(-1))} onMouseUp={stopRepeat} onMouseLeave={stopRepeat}>-1秒</button>
                <button className="primary play-btn" onClick={playOrPause}>{playing ? "暂停" : "播放"}</button>
                <button onMouseDown={() => startRepeat(() => stepSecond(1))} onMouseUp={stopRepeat} onMouseLeave={stopRepeat}>+1秒</button>
                <button onMouseDown={() => startRepeat(() => stepFrame(1))} onMouseUp={stopRepeat} onMouseLeave={stopRepeat}>+1帧</button>
              </div>

              <div className="timeline">
                <div className="timeline-info">
                  <span className="tc-item">入点 <span className="in">{inPoint !== null ? fmtTime(inPoint) : "--:--.--"}</span></span>
                  <span className="tc-item">当前 <span className="value">{fmtTime(currentTime)}</span></span>
                  <span className="tc-item">出点 <span className="out">{outPoint !== null ? fmtTime(outPoint) : "--:--.--"}</span></span>
                  <span className="tc-item">时长 <span className="value">{fmtTime(duration)}</span></span>
                  <span className="tc-item">选段 <span className="value">{selDur > 0 ? fmtTime(selDur) : "--:--.--"}</span></span>
                  {probe && <span className="tc-item">音频 <span className="value">{probe.audioCodec} {probe.audioSampleRate}Hz {probe.audioChannels}ch</span></span>}
                </div>

                <Waveform
                  points={waveform} duration={duration} playhead={currentTime}
                  inPoint={inPoint} outPoint={outPoint} loading={waveformLoading}
                  zoom={waveformZoom} playing={playing}
                  onSeek={handleSeek} onRegionChange={handleRegionChange} onZoomChange={handleZoomChange} />

                <div className="controls">
                  <div className="controls-left">
                    <button className="io-btn in" onClick={setInHere}>入点 <span className="kbd">I</span></button>
                    <button className="io-btn out" onClick={setOutHere}>出点 <span className="kbd">O</span></button>
                    <button onClick={handlePreview} disabled={inPoint === null || outPoint === null}>预听 <span className="kbd">P</span></button>
                    <button onClick={() => { setInPoint(null); setOutPoint(null); saveCurrent(); }}
                      disabled={inPoint === null && outPoint === null}>清除选区</button>
                  </div>
                  <div className="controls-right">
                    <button onClick={() => setWaveformZoom(Math.max(1, Math.round(waveformZoom / 1.15 * 4) / 4))} disabled={waveformZoom <= 1}>-</button>
                    <span className="zoom-label">{waveformZoom.toFixed(1)}x</span>
                    <button onClick={() => setWaveformZoom(Math.min(40, Math.round(waveformZoom * 1.15 * 4) / 4))} disabled={waveformZoom >= 40}>+</button>
                    <button onClick={() => setWaveformZoom(1)} disabled={waveformZoom === 1}>重置</button>
                    <span className="kbd">Ctrl+滚轮</span>
                  </div>
                </div>
              </div>

              <div className="export-bar">
                <select value={category} onChange={(e) => setCategory(e.target.value)}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <select value={exportFormat} onChange={(e) => { const f = e.target.value as "wav" | "mp3"; setExportFormat(f); setStoredFormat(f); }}>
                  <option value="wav">WAV</option>
                  <option value="mp3">MP3 192kbps</option>
                </select>
                <button className="primary" onClick={handleExportToSp}
                  disabled={exporting || inPoint === null || outPoint === null || !videoPath}>
                  {exporting ? "导出中..." : "导出到 Soundpad"}
                </button>
                <button onClick={handleExport}
                  disabled={exporting || inPoint === null || outPoint === null || !videoPath}>
                  仅导出文件
                </button>
                {exporting && <div className="progress"><div className="fill" style={{ width: `${progress}%` }} /></div>}
                {exporting && <span className="status">{progress.toFixed(0)}%</span>}
                {!exporting && <span className="status">{waveformLoading ? "分析波形..." : ""}</span>}
              </div>
            </>
          )}
        </div>
      </div>

      {toast && <div className={"toast " + toast.kind}>{toast.msg}</div>}
      {dragOver && (<div className="drag-overlay"><div className="drag-overlay-content"><div className="drag-overlay-icon"></div><div>释放以导入视频文件</div></div></div>)}
    </div>
  );
}