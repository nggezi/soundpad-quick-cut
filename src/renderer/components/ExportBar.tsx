import { memo } from "react";
import type { ExportFormat } from "../../shared/types.js";
import {
  IconDownload,
  IconFolder,
  IconPause,
  IconPlay,
  IconSoundpad,
  IconX,
} from "./Icons.js";

export const CATEGORIES = ["Quick Cut", "Voice", "FX", "Music", "Ambient"] as const;

interface Props {
  soundName: string;
  soundNamePlaceholder: string;
  category: string;
  categories: string[];
  soundpadConnected: boolean;
  format: ExportFormat;
  clipsCount: number;
  exporting: boolean;
  progress: number;
  waveformLoading: boolean;
  canExport: boolean;
  fadeInMs: number;
  fadeOutMs: number;
  gainDb: number;
  lastExportPath: string | null;
  previewingExport: boolean;
  onCategoryChange: (c: string) => void;
  onFormatChange: (f: ExportFormat) => void;
  onSoundNameChange: (name: string) => void;
  onExportToSoundpad: () => void;
  onExportAllToSoundpad: () => void;
  onExportFile: () => void;
  onCancelExport: () => void;
  onFadeInChange: (v: number) => void;
  onFadeOutChange: (v: number) => void;
  onGainChange: (v: number) => void;
  onPreviewExport: () => void;
}

export const ExportBar = memo(function ExportBar({
  soundName,
  soundNamePlaceholder,
  category,
  categories,
  soundpadConnected,
  format,
  clipsCount,
  exporting,
  progress,
  waveformLoading,
  canExport,
  fadeInMs,
  fadeOutMs,
  gainDb,
  lastExportPath,
  previewingExport,
  onCategoryChange,
  onFormatChange,
  onSoundNameChange,
  onExportToSoundpad,
  onExportAllToSoundpad,
  onExportFile,
  onCancelExport,
  onFadeInChange,
  onFadeOutChange,
  onGainChange,
  onPreviewExport,
}: Props) {
  const categoryOptions = categories.length > 0 ? categories : CATEGORIES;
  return (
    <div className="export-bar">
      <div className="export-row">
        <span className={"sp-status " + (soundpadConnected ? "connected" : "disconnected")} title={soundpadConnected ? "Soundpad 已连接" : "Soundpad 未运行或未启用远程控制"}>
          <i />
          {soundpadConnected ? "Soundpad 已连接" : "Soundpad 未连接"}
        </span>
        <div className="export-options">
          <label className="export-field export-name">
            <span className="export-field-label">命名</span>
            <input
              value={soundName}
              onChange={(e) => onSoundNameChange(e.target.value)}
              placeholder={soundNamePlaceholder || "片段名称"}
              maxLength={40}
              spellCheck={false}
            />
          </label>
          <label className="export-field">
            <span className="export-field-label">分类</span>
            <select value={category} onChange={(e) => onCategoryChange(e.target.value)}>
              {categoryOptions.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="export-field">
            <span className="export-field-label">格式</span>
            <select value={format} onChange={(e) => onFormatChange(e.target.value as ExportFormat)}>
              <option value="wav">WAV 无损</option>
              <option value="mp3">MP3 192kbps</option>
            </select>
          </label>
        </div>
      </div>
      <div className="export-row export-row-bottom">
        <div className="fx-controls">
          <label className="fx-field">
            <span>淡入 ms</span>
            <input
              type="number"
              min={0}
              max={2000}
              step={10}
              value={fadeInMs}
              onChange={(e) => onFadeInChange(Math.max(0, parseInt(e.target.value) || 0))}
            />
          </label>
          <label className="fx-field">
            <span>淡出 ms</span>
            <input
              type="number"
              min={0}
              max={2000}
              step={10}
              value={fadeOutMs}
              onChange={(e) => onFadeOutChange(Math.max(0, parseInt(e.target.value) || 0))}
            />
          </label>
          <label className="fx-field">
            <span>增益 dB</span>
            <input
              type="number"
              min={-30}
              max={30}
              step={1}
              value={gainDb}
              onChange={(e) => onGainChange(Math.max(-30, Math.min(30, parseInt(e.target.value) || 0)))}
            />
          </label>
        </div>
        <div className="export-actions">
          {exporting ? (
            <button className="danger" onClick={onCancelExport}>
              <IconX size={15} />
              取消导出
            </button>
          ) : (
            <>
              <button
                className="primary"
                onClick={onExportToSoundpad}
                disabled={!canExport}
              >
                <IconSoundpad size={16} />
                导出到 Soundpad
              </button>
              {clipsCount > 0 && (
                <button onClick={onExportAllToSoundpad} disabled={!soundpadConnected}>
                  <IconSoundpad size={15} />
                  全部导出 ({clipsCount})
                </button>
              )}
              <button onClick={onExportFile} disabled={!canExport}>
                <IconDownload size={15} />
                仅导出文件
              </button>
              {lastExportPath && (
                <button className="preview-btn" onClick={onPreviewExport} title="试听刚导出的音频">
                  {previewingExport ? <IconPause size={15} /> : <IconPlay size={15} />}
                  试听
                </button>
              )}
            </>
          )}
        </div>
        <div className="export-status">
          {exporting && (
            <>
              <div className="progress"><div className="fill" style={{ width: `${progress}%` }} /></div>
              <span className="status">{progress.toFixed(0)}%</span>
            </>
          )}
          {!exporting && waveformLoading && (
            <span className="status working"><span className="spinner" />分析波形...</span>
          )}
          {!exporting && !waveformLoading && <span className="status idle"><IconFolder size={12} />就绪</span>}
        </div>
      </div>
    </div>
  );
});
