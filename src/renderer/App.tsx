import { useCallback, useEffect, useRef, useState } from "react";
import { useMaterials } from "./hooks/useMaterials.js";
import { usePlayback } from "./hooks/usePlayback.js";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts.js";
import { useToast } from "./hooks/useToast.js";
import { TopBar } from "./components/TopBar.js";
import { MaterialList } from "./components/MaterialList.js";
import { EmptyState } from "./components/EmptyState.js";
import { Preview } from "./components/Preview.js";
import { TransportBar } from "./components/TransportBar.js";
import { TimelineInfo } from "./components/TimelineInfo.js";
import { TimelineControls } from "./components/TimelineControls.js";
import { ExportBar, CATEGORIES } from "./components/ExportBar.js";
import { Toast } from "./components/Toast.js";
import { Waveform } from "./components/Waveform.js";
import { IconWave } from "./components/Icons.js";
import { baseName, fileName, isMediaFile } from "./lib/file.js";
import type { ExportFormat } from "../shared/types.js";

const getStoredFormat = (): ExportFormat => {
  const stored = localStorage.getItem("exportFormat");
  return stored === "mp3" ? "mp3" : "wav";
};

const defaultSoundName = (filePath: string): string => baseName(filePath).slice(0, 5);

export default function App() {
  const {
    materials,
    activeIdx,
    active,
    waveformLoading,
    loadVideo,
    removeMaterial,
    switchMaterial,
    patchActive,
    clearSelection,
  } = useMaterials();

  const { toast, showToast } = useToast();
  const [exportFormat, setExportFormat] = useState<ExportFormat>(getStoredFormat);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [waveformZoom, setWaveformZoom] = useState(1);
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [soundName, setSoundName] = useState("");
  const [soundpadConnected, setSoundpadConnected] = useState(false);
  const [spCategories, setSpCategories] = useState<string[]>([]);

  const videoUrl = active?.url ?? null;
  const probe = active?.probe ?? null;
  const inPoint = active?.inPoint ?? null;
  const outPoint = active?.outPoint ?? null;
  const duration = active?.duration ?? 0;

  const selectionRef = useRef({ inPoint, outPoint, duration, fps: probe?.fps ?? 30 });
  selectionRef.current = { inPoint, outPoint, duration, fps: probe?.fps ?? 30 };

  const activeRef = useRef(active);
  activeRef.current = active;
  const categoryRef = useRef(category);
  categoryRef.current = category;
  const formatRef = useRef(exportFormat);
  formatRef.current = exportFormat;
  const soundNameRef = useRef(soundName);
  soundNameRef.current = soundName;
  // Per-material export counter, so clips from the same video get _01, _02...
  const exportCountRef = useRef(new Map<string, number>());

  // Load Soundpad categories once on mount (and whenever the user re-checks).
  useEffect(() => {
    let mounted = true;
    window.api.getSoundpadCategories().then((state) => {
      if (!mounted) return;
      setSoundpadConnected(state.connected);
      setSpCategories(state.categories);
    });
    return () => {
      mounted = false;
    };
  }, []);

  // When switching materials, refresh the placeholder (first 5 chars of the
  // video's file name) and clear any typed name. The counter is per material,
  // so numbering starts over automatically.
  useEffect(() => {
    if (active) setSoundName("");
  }, [active?.path]); // eslint-disable-line react-hooks/exhaustive-deps

  const playback = usePlayback(
    videoUrl,
    () => selectionRef.current,
    useCallback(
      (d: number) => {
        if (selectionRef.current.duration === 0 && d > 0) patchActive({ duration: d });
      },
      [patchActive],
    ),
  );

  useEffect(() => {
    return window.api.onExportProgress((p) => {
      setProgress(p.percent);
      if (p.done) setExporting(false);
    });
  }, []);

  const handleLoad = useCallback(
    async (filePath: string) => {
      const result = await loadVideo(filePath);
      if (!result.ok) showToast(result.message ?? "加载失败", "error");
    },
    [loadVideo, showToast],
  );

  const handleOpen = useCallback(async () => {
    const filePath = await window.api.openVideo();
    if (filePath) await handleLoad(filePath);
  }, [handleLoad]);

  const handleSelect = useCallback(
    (idx: number) => {
      switchMaterial(idx);
      playback.seek(0);
    },
    [switchMaterial, playback.seek],
  );

  const handleCancelExport = useCallback(() => {
    void window.api.cancelExport();
  }, []);

  useEffect(() => {
    let mounted = true;
    window.api.onFileDropped((paths: string[]) => {
      if (!mounted) return;
      setDragOver(false);
      const media = paths.filter(isMediaFile);
      if (media.length === 0) {
        showToast("拖入的文件不是支持的视频/音频格式", "error");
        return;
      }
      for (const p of media) void handleLoad(p);
    });
    const onOver = (e: DragEvent) => {
      e.preventDefault();
      setDragOver(true);
    };
    const onLeave = (e: DragEvent) => {
      if (e.relatedTarget === null) setDragOver(false);
    };
    document.addEventListener("dragover", onOver);
    document.addEventListener("dragleave", onLeave);
    return () => {
      mounted = false;
      document.removeEventListener("dragover", onOver);
      document.removeEventListener("dragleave", onLeave);
    };
  }, [handleLoad, showToast]);

  const setInHere = useCallback(() => {
    const v = playback.videoRef.current;
    const cur = activeRef.current;
    if (!v || !cur) return;
    const t = v.currentTime;
    patchActive({
      inPoint: t,
      outPoint: cur.outPoint !== null && t > cur.outPoint ? null : cur.outPoint,
    });
  }, [playback.videoRef, patchActive]);

  const setOutHere = useCallback(() => {
    const v = playback.videoRef.current;
    const cur = activeRef.current;
    if (!v || !cur) return;
    const t = v.currentTime;
    patchActive({
      outPoint: t,
      inPoint: cur.inPoint !== null && t < cur.inPoint ? null : cur.inPoint,
    });
  }, [playback.videoRef, patchActive]);

  const handleRegionChange = useCallback(
    (s: number, e: number) => {
      patchActive({ inPoint: s, outPoint: e });
    },
    [patchActive],
  );

  const handleFormatChange = useCallback((f: ExportFormat) => {
    setExportFormat(f);
    localStorage.setItem("exportFormat", f);
  }, []);

  const doExport = useCallback(
    async (toSoundpad: boolean) => {
      const cur = activeRef.current;
      if (!cur || cur.inPoint === null || cur.outPoint === null) return;
      const i = cur.inPoint;
      const o = cur.outPoint;
      const cat = toSoundpad ? categoryRef.current : "";
      const f = formatRef.current;
      const count = (exportCountRef.current.get(cur.path) ?? 0) + 1;
      const namePart = (soundNameRef.current.trim() || defaultSoundName(cur.path)).slice(0, 40);
      const suffix = `_${String(count).padStart(2, "0")}`;
      const fileName = `${namePart}${suffix}.${f}`;
      // Export to Soundpad: use a temp file so no save dialog interrupts the flow.
      // Plain file export: let the user pick the destination.
      const outPath = toSoundpad
        ? await window.api.soundpadExportPath(fileName)
        : await window.api.saveAudio(fileName);
      if (!outPath) return;

      setExporting(true);
      setProgress(0);
      try {
        await window.api.exportAudio({
          inputPath: cur.path,
          start: i,
          end: o,
          outputPath: outPath,
          format: f,
          mp3Bitrate: 192,
          wavSampleRate: 44100,
          wavChannels: 2,
        });
        if (toSoundpad) {
          const sp = await window.api.addToSoundpad(outPath, cat);
          if (sp.ok) exportCountRef.current.set(cur.path, count);
          showToast(
            sp.ok
              ? `已导出并添加至 Soundpad [${cat}]`
              : `导出失败，Soundpad: ${sp.error || "未连接"}`,
            "success",
          );
        } else {
          window.api.showInFolder(outPath);
          exportCountRef.current.set(cur.path, count);
          showToast("导出成功", "success");
        }
      } catch (err) {
        setExporting(false);
        const msg = (err as Error).message;
        showToast(msg === "导出已取消" ? "导出已取消" : "导出失败: " + msg, msg === "导出已取消" ? "success" : "error");
      }
    },
    [showToast],
  );

  const handleExportToSp = useCallback(() => void doExport(true), [doExport]);
  const handleExportFile = useCallback(() => void doExport(false), [doExport]);

  useKeyboardShortcuts({
    onClearSelection: clearSelection,
    onExport: handleExportFile,
    onPlayPause: playback.playOrPause,
    onInPoint: setInHere,
    onOutPoint: setOutHere,
    onPreview: playback.previewSelection,
    onStepFrame: playback.stepFrame,
    onStepSecond: playback.stepSecond,
  });

  const zoomOut = useCallback(
    () => setWaveformZoom((z) => Math.max(1, Math.round((z / 1.15) * 4) / 4)),
    [],
  );
  const zoomIn = useCallback(
    () => setWaveformZoom((z) => Math.min(40, Math.round(z * 1.15 * 4) / 4)),
    [],
  );
  const zoomReset = useCallback(() => setWaveformZoom(1), []);

  const canExport = active !== null && inPoint !== null && outPoint !== null;

  return (
    <div className="app">
      <TopBar
        fileName={videoUrl && active ? fileName(active.path) : null}
        materialCount={materials.length}
        onOpen={handleOpen}
      />
      <div className="workspace">
        {materials.length > 0 && (
          <MaterialList
            materials={materials}
            activeIdx={activeIdx}
            onSelect={handleSelect}
            onRemove={removeMaterial}
          />
        )}
        <div className="content">
          {!videoUrl || !active ? (
            <EmptyState dragOver={dragOver} />
          ) : (
            <>
              <Preview
                src={videoUrl}
                videoRef={playback.videoRef}
                onClick={playback.playOrPause}
                playing={playback.playing}
                currentTime={playback.currentTime}
                duration={duration}
              />
              <TransportBar
                playing={playback.playing}
                onPlayPause={playback.playOrPause}
                onStepFrame={playback.stepFrame}
                onStepSecond={playback.stepSecond}
                onHoldStart={playback.startRepeat}
                onHoldEnd={playback.stopRepeat}
                loop={playback.loop}
                onLoopChange={playback.setLoop}
                volume={playback.volume}
                onVolumeChange={playback.setVolume}
              />
              <div className="timeline">
                <TimelineInfo
                  currentTime={playback.currentTime}
                  inPoint={inPoint}
                  outPoint={outPoint}
                  duration={duration}
                  probe={probe}
                />
                <Waveform
                  points={active.waveform}
                  duration={duration}
                  inPoint={inPoint}
                  outPoint={outPoint}
                  loading={waveformLoading}
                  zoom={waveformZoom}
                  onSeek={playback.seek}
                  onRegionChange={handleRegionChange}
                  onZoomChange={setWaveformZoom}
                  onPlayhead={playback.subscribePlayhead}
                />
                <TimelineControls
                  inPoint={inPoint}
                  outPoint={outPoint}
                  zoom={waveformZoom}
                  onIn={setInHere}
                  onOut={setOutHere}
                  onPreview={playback.previewSelection}
                  onClear={clearSelection}
                  onZoomOut={zoomOut}
                  onZoomIn={zoomIn}
                  onZoomReset={zoomReset}
                />
              </div>
              <ExportBar
                soundName={soundName}
                soundNamePlaceholder={active ? defaultSoundName(active.path) : ""}
                category={category}
                categories={spCategories}
                soundpadConnected={soundpadConnected}
                format={exportFormat}
                exporting={exporting}
                progress={progress}
                waveformLoading={waveformLoading}
                canExport={canExport}
                onCategoryChange={setCategory}
                onFormatChange={handleFormatChange}
                onSoundNameChange={setSoundName}
                onExportToSoundpad={handleExportToSp}
                onExportFile={handleExportFile}
                onCancelExport={handleCancelExport}
              />
            </>
          )}
        </div>
      </div>
      {toast && <Toast toast={toast} />}
      {dragOver && (
        <div className="drag-overlay">
          <div className="drag-overlay-content">
            <div className="drag-overlay-icon"><IconWave size={30} /></div>
            <div className="drag-overlay-title">释放以导入视频文件</div>
          </div>
        </div>
      )}
    </div>
  );
}
