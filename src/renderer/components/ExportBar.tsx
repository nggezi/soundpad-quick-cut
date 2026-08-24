import { memo } from "react";
import type { ExportFormat } from "../../shared/types.js";
import { IconDownload, IconFolder, IconSoundpad, IconX } from "./Icons.js";

export const CATEGORIES = ["Quick Cut", "Voice", "FX", "Music", "Ambient"] as const;

interface Props {
  soundName: string;
  soundNamePlaceholder: string;
  category: string;
  categories: string[];
  soundpadConnected: boolean;
  format: ExportFormat;
  exporting: boolean;
  progress: number;
  waveformLoading: boolean;
  canExport: boolean;
  onCategoryChange: (c: string) => void;
  onFormatChange: (f: ExportFormat) => void;
  onSoundNameChange: (name: string) => void;
  onExportToSoundpad: () => void;
  onExportFile: () => void;
  onCancelExport: () => void;
}

export const ExportBar = memo(function ExportBar({
  soundName,
  soundNamePlaceholder,
  category,
  categories,
  soundpadConnected,
  format,
  exporting,
  progress,
  waveformLoading,
  canExport,
  onCategoryChange,
  onFormatChange,
  onSoundNameChange,
  onExportToSoundpad,
  onExportFile,
  onCancelExport,
}: Props) {
  const categoryOptions = categories.length > 0 ? categories : CATEGORIES;
  return (
    <div className="export-bar">
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
            <button onClick={onExportFile} disabled={!canExport}>
              <IconDownload size={15} />
              仅导出文件
            </button>
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
        {!exporting && !waveformLoading && <span className="status idle"><IconFolder size={12} />就绪，选好选区后即可导出</span>}
      </div>
    </div>
  );
});
